-- V12 management intelligence
revoke execute on function public.get_parent_dashboard(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_parent_dashboard(uuid, uuid) to service_role;

insert into public.permissions (key,name,module,action,description)
values ('management.view','View management intelligence','management','view','View school management intelligence and operational KPIs')
on conflict (key) do update set name=excluded.name,module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where p.key='management.view' and r.key in ('super_admin','organization_admin','principal','vice_principal','admin')
on conflict do nothing;

create or replace function public.get_management_dashboard(
  p_actor_user_id uuid,p_school_id uuid,p_academic_year_id uuid,
  p_start_date date default null,p_end_date date default null
) returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_year record; v_start date; v_end date; v_student_total integer; v_enrolled integer; v_staff integer;
 v_att_total integer; v_present integer; v_absent integer; v_late integer; v_excused integer;
 v_invoiced numeric; v_paid numeric; v_exam_total integer; v_exam_results integer; v_exam_avg numeric; v_grades jsonb;
begin
 if p_actor_user_id is null or p_school_id is null or p_academic_year_id is null then raise exception 'Required management dashboard parameters are missing'; end if;
 if p_start_date is not null and p_end_date is not null and p_end_date<p_start_date then raise exception 'End date must be on or after start date'; end if;
 if not private.actor_has_permission(p_actor_user_id,'management.view',p_school_id) then raise exception 'Management analytics access denied'; end if;
 select ay.id,ay.name,ay.start_date,ay.end_date,s.organization_id into v_year
 from public.academic_years ay join public.schools s on s.id=ay.school_id
 where ay.id=p_academic_year_id and ay.school_id=p_school_id;
 if not found then raise exception 'Academic year not found'; end if;
 v_start:=coalesce(p_start_date,v_year.start_date); v_end:=coalesce(p_end_date,v_year.end_date);
 select count(*) into v_student_total from public.students where school_id=p_school_id and status='active';
 select count(*) into v_enrolled from public.student_enrollments where school_id=p_school_id and academic_year_id=p_academic_year_id and status='active';
 select count(*) into v_staff from public.staff_members where school_id=p_school_id and status='active';
 select count(*),count(*) filter(where ar.status='present'),count(*) filter(where ar.status='absent'),count(*) filter(where ar.status='late'),count(*) filter(where ar.status='excused')
 into v_att_total,v_present,v_absent,v_late,v_excused
 from public.attendance_records ar join public.attendance_sessions ats on ats.id=ar.session_id
 where ar.school_id=p_school_id and ats.academic_year_id=p_academic_year_id and ats.attendance_date between v_start and v_end;
 select coalesce(sum(fi.total),0) into v_invoiced from public.fee_invoices fi join public.student_enrollments se on se.id=fi.enrollment_id
 where fi.school_id=p_school_id and se.academic_year_id=p_academic_year_id and fi.status not in('cancelled','void','failed') and fi.invoice_date between v_start and v_end;
 select coalesce(sum(fp.amount),0) into v_paid from public.fee_payments fp join public.fee_invoices fi on fi.id=fp.invoice_id join public.student_enrollments se on se.id=fi.enrollment_id
 where fp.school_id=p_school_id and se.academic_year_id=p_academic_year_id and fp.status not in('cancelled','void','failed') and fp.payment_date between v_start and v_end;
 select count(distinct e.id),count(er.id),coalesce(avg(case when es.max_marks>0 then er.marks/es.max_marks*100 end),0)
 into v_exam_total,v_exam_results,v_exam_avg from public.exams e
 left join public.exam_subjects es on es.exam_id=e.id left join public.exam_results er on er.exam_subject_id=es.id
 where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id and e.start_date<=v_end and coalesce(e.end_date,e.start_date)>=v_start;
 select coalesce(jsonb_agg(jsonb_build_object('grade_id',x.grade_id,'grade',x.grade,'enrolled',x.enrolled,'attendance_total',x.attendance_total,'attendance_rate',x.attendance_rate) order by x.sort_order),'[]'::jsonb)
 into v_grades from (
   select g.id grade_id,g.name grade,g.sort_order,
     count(distinct se.id) filter(where se.status='active') enrolled,
     coalesce(max(a.attendance_total),0) attendance_total,
     coalesce(max(a.attendance_rate),0) attendance_rate
   from public.grades g
   left join public.student_enrollments se on se.grade_id=g.id and se.school_id=p_school_id and se.academic_year_id=p_academic_year_id and se.status='active'
   left join lateral (
     select count(ar.id) attendance_total,
       coalesce(round(100.0*count(ar.id) filter(where ar.status in('present','late'))/nullif(count(ar.id),0),2),0) attendance_rate
     from public.attendance_records ar join public.attendance_sessions ats on ats.id=ar.session_id
     where ar.enrollment_id=se.id and ar.school_id=p_school_id and ats.academic_year_id=p_academic_year_id and ats.attendance_date between v_start and v_end
   ) a on true
   where g.school_id=p_school_id group by g.id,g.name,g.sort_order
 ) x;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(v_year.organization_id,p_school_id,p_actor_user_id,'management.dashboard.view','management_dashboard',p_academic_year_id,jsonb_build_object('academic_year_id',p_academic_year_id,'start_date',v_start,'end_date',v_end));
 return jsonb_build_object('academic_year',v_year.name,'start_date',v_start,'end_date',v_end,
  'students',jsonb_build_object('total',v_student_total,'enrolled',v_enrolled),'staff',jsonb_build_object('active',v_staff),
  'attendance',jsonb_build_object('total',v_att_total,'present',v_present,'absent',v_absent,'late',v_late,'excused',v_excused,'rate',coalesce(round(100.0*(v_present+v_late)/nullif(v_att_total,0),2),0)),
  'finance',jsonb_build_object('invoiced',v_invoiced,'paid',v_paid),
  'exams',jsonb_build_object('total',v_exam_total,'results',v_exam_results,'average_percentage',coalesce(round(v_exam_avg,2),0)),'grades',v_grades);
end;$function$;
revoke execute on function public.get_management_dashboard(uuid,uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.get_management_dashboard(uuid,uuid,uuid,date,date) to service_role;
