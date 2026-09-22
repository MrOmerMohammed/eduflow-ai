-- Production public function snapshot, functions 21-40; generated 2026-09-22.
-- DATA-FREE.

CREATE OR REPLACE FUNCTION public.create_leave_type(p_actor_user_id uuid, p_school_id uuid, p_name text, p_code text, p_annual_limit numeric DEFAULT NULL::numeric, p_is_paid boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'staff.manage',p_school_id) then raise exception 'permission denied'; end if;
 if trim(coalesce(p_name,''))='' or trim(coalesce(p_code,''))='' then raise exception 'leave type name and code are required'; end if;
 insert into public.leave_types(school_id,name,code,annual_limit,is_paid) values(p_school_id,trim(p_name),upper(trim(p_code)),p_annual_limit,p_is_paid) returning id into v_id;
 insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'leave_type.create','leave_type',v_id,jsonb_build_object('code',p_code));
 return v_id;
end;$function$


CREATE OR REPLACE FUNCTION public.create_lesson(p_actor_user_id uuid, p_school_id uuid, p_section_id uuid, p_subject_id uuid, p_curriculum_unit_id uuid, p_title text, p_content text, p_scheduled_date date)
 RETURNS lessons
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r public.lessons; begin if not private.actor_has_permission(p_actor_user_id,'academic.manage',p_school_id) then raise exception 'Permission denied'; end if; if not exists(select 1 from public.sections where id=p_section_id and school_id=p_school_id) then raise exception 'Section does not belong to school'; end if; if not exists(select 1 from public.subjects where id=p_subject_id and school_id=p_school_id) then raise exception 'Subject does not belong to school'; end if; insert into public.lessons(school_id,section_id,subject_id,curriculum_unit_id,title,content,scheduled_date,created_by) values(p_school_id,p_section_id,p_subject_id,p_curriculum_unit_id,trim(p_title),p_content,p_scheduled_date,p_actor_user_id) returning * into r; insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'lesson.create','lesson',r.id,jsonb_build_object('title',r.title)); return r; end $function$


CREATE OR REPLACE FUNCTION public.create_section(p_actor_user_id uuid, p_school_id uuid, p_grade_id uuid, p_name text, p_capacity integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_id uuid; begin if p_actor_user_id is null then raise exception 'Actor is required'; end if; if not exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and r.key in('admin','principal','vice_principal','organization_admin','super_admin')) then raise exception 'Insufficient permission'; end if; if not exists(select 1 from public.grades where id=p_grade_id and school_id=p_school_id) then raise exception 'Grade does not belong to school'; end if; if nullif(trim(p_name),'') is null then raise exception 'Name is required'; end if; if p_capacity is not null and p_capacity<1 then raise exception 'Capacity must be positive'; end if; insert into public.sections(school_id,grade_id,name,capacity) values(p_school_id,p_grade_id,trim(p_name),p_capacity) returning id into v_id; insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'section.create','section',v_id,jsonb_build_object('grade_id',p_grade_id,'name',trim(p_name),'capacity',p_capacity)); return jsonb_build_object('id',v_id,'school_id',p_school_id,'grade_id',p_grade_id,'name',trim(p_name),'capacity',p_capacity); end; $function$


CREATE OR REPLACE FUNCTION public.create_staff(p_actor_user_id uuid, p_school_id uuid, p_employee_number text, p_first_name text, p_middle_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_designation text DEFAULT 'Staff'::text, p_department text DEFAULT NULL::text, p_employment_type text DEFAULT 'full_time'::text, p_joining_date date DEFAULT CURRENT_DATE, p_salary numeric DEFAULT NULL::numeric, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'staff.manage',p_school_id) then raise exception 'permission denied'; end if;
 if trim(coalesce(p_employee_number,''))='' or trim(coalesce(p_first_name,''))='' or trim(coalesce(p_designation,''))='' then raise exception 'employee number, first name and designation are required'; end if;
 insert into public.staff_members(school_id,user_id,employee_number,first_name,middle_name,last_name,email,phone,designation,department,employment_type,joining_date,salary)
 values(p_school_id,p_user_id,trim(p_employee_number),trim(p_first_name),nullif(trim(p_middle_name),''),nullif(trim(p_last_name),''),nullif(trim(p_email),''),nullif(trim(p_phone),''),trim(p_designation),nullif(trim(p_department),''),p_employment_type,p_joining_date,p_salary) returning id into v_id;
 insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'staff.create','staff_member',v_id,jsonb_build_object('employee_number',p_employee_number));
 return v_id;
end;$function$


CREATE OR REPLACE FUNCTION public.create_student(p_actor_user_id uuid, p_school_id uuid, p_admission_number text, p_first_name text, p_middle_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_status text DEFAULT 'active'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_org_id uuid;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not private.actor_has_permission(p_actor_user_id, 'student.manage', p_school_id) then
    raise exception 'Insufficient permission';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id and status = 'active') then
    raise exception 'School not found or inactive';
  end if;
  if nullif(trim(p_admission_number), '') is null or nullif(trim(p_first_name), '') is null then
    raise exception 'Admission number and first name are required';
  end if;
  if p_status not in ('active','inactive','graduated','transferred','withdrawn') then
    raise exception 'Invalid student status';
  end if;

  select organization_id into v_org_id from public.schools where id = p_school_id;

  insert into public.students(
    school_id, admission_number, first_name, middle_name, last_name,
    date_of_birth, gender, email, phone, status
  ) values (
    p_school_id, trim(p_admission_number), trim(p_first_name), nullif(trim(p_middle_name), ''),
    nullif(trim(p_last_name), ''), p_date_of_birth, nullif(trim(p_gender), ''),
    nullif(trim(p_email), ''), nullif(trim(p_phone), ''), p_status
  ) returning id into v_id;

  insert into public.audit_logs(organization_id, school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id, p_school_id, p_actor_user_id, 'student.create', 'student', v_id,
    jsonb_build_object('admission_number', trim(p_admission_number), 'first_name', trim(p_first_name), 'status', p_status)
  );

  return jsonb_build_object('id', v_id, 'school_id', p_school_id, 'admission_number', trim(p_admission_number));
exception
  when unique_violation then
    raise exception 'Admission number already exists in this school';
end;
$function$


CREATE OR REPLACE FUNCTION public.create_student_enrollment(p_actor_user_id uuid, p_school_id uuid, p_student_id uuid, p_academic_year_id uuid, p_grade_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_roll_number text DEFAULT NULL::text, p_status text DEFAULT 'active'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not private.actor_has_permission(p_actor_user_id, 'student.manage', p_school_id) then
    raise exception 'Insufficient permission';
  end if;
  if p_status not in ('active','completed','withdrawn','transferred') then
    raise exception 'Invalid enrollment status';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = p_school_id) then
    raise exception 'Student does not belong to school';
  end if;
  if not exists (select 1 from public.academic_years where id = p_academic_year_id and school_id = p_school_id) then
    raise exception 'Academic year does not belong to school';
  end if;
  if not exists (select 1 from public.grades where id = p_grade_id and school_id = p_school_id) then
    raise exception 'Grade does not belong to school';
  end if;
  if p_section_id is not null and not exists (
    select 1 from public.sections where id = p_section_id and school_id = p_school_id and grade_id = p_grade_id
  ) then
    raise exception 'Section does not belong to school and grade';
  end if;

  insert into public.student_enrollments(
    school_id, student_id, academic_year_id, grade_id, section_id, roll_number, status
  ) values (
    p_school_id, p_student_id, p_academic_year_id, p_grade_id, p_section_id, nullif(trim(p_roll_number), ''), p_status
  ) returning id into v_id;

  insert into public.audit_logs(school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_school_id, p_actor_user_id, 'enrollment.create', 'student_enrollment', v_id,
    jsonb_build_object('student_id', p_student_id, 'academic_year_id', p_academic_year_id, 'grade_id', p_grade_id, 'section_id', p_section_id)
  );

  return jsonb_build_object('id', v_id, 'student_id', p_student_id, 'academic_year_id', p_academic_year_id, 'grade_id', p_grade_id, 'section_id', p_section_id, 'status', p_status);
exception
  when unique_violation then
    raise exception 'Student is already enrolled for this academic year';
end;
$function$


CREATE OR REPLACE FUNCTION public.create_subject(p_actor_user_id uuid, p_school_id uuid, p_name text, p_code text, p_description text DEFAULT NULL::text)
 RETURNS subjects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r public.subjects; begin if not private.actor_has_permission(p_actor_user_id,'academic.manage',p_school_id) then raise exception 'Permission denied'; end if; insert into public.subjects(school_id,name,code,description) values(p_school_id,trim(p_name),upper(trim(p_code)),p_description) returning * into r; insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'subject.create','subject',r.id,jsonb_build_object('name',r.name,'code',r.code)); return r; end $function$


CREATE OR REPLACE FUNCTION public.create_timetable_entry(p_actor_user_id uuid, p_school_id uuid, p_section_id uuid, p_subject_id uuid, p_teacher_user_id uuid, p_day_of_week smallint, p_period_no integer, p_starts_at time without time zone, p_ends_at time without time zone, p_room text)
 RETURNS timetable_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.timetable_entries;
begin
 if not private.actor_has_permission(p_actor_user_id,'academic.manage',p_school_id) then raise exception 'Permission denied'; end if;
 if not exists(select 1 from public.sections where id=p_section_id and school_id=p_school_id) then raise exception 'Section does not belong to school'; end if;
 if not exists(select 1 from public.subjects where id=p_subject_id and school_id=p_school_id) then raise exception 'Subject does not belong to school'; end if;
 if p_teacher_user_id is not null and not exists(select 1 from public.school_memberships where user_id=p_teacher_user_id and school_id=p_school_id and status='active') then raise exception 'Teacher does not belong to this school'; end if;
 if p_day_of_week not between 0 and 6 then raise exception 'Day of week must be between 0 and 6'; end if;
 if p_period_no is null or p_period_no<1 then raise exception 'Period number must be positive'; end if;
 if p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'End time must be after start time'; end if;
 insert into public.timetable_entries(school_id,section_id,subject_id,teacher_user_id,day_of_week,period_no,starts_at,ends_at,room) values(p_school_id,p_section_id,p_subject_id,p_teacher_user_id,p_day_of_week,p_period_no,p_starts_at,p_ends_at,p_room) returning * into r;
 insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'timetable.create','timetable_entry',r.id,jsonb_build_object('day',p_day_of_week,'period',p_period_no));
 return r;
end $function$


CREATE OR REPLACE FUNCTION public.enqueue_school_database_provisioning()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.school_database_provisioning (school_id, organization_id, database_key)
  values (
    new.id,
    new.organization_id,
    'school_' || replace(new.id::text, '-', '')
  )
  on conflict (school_id) do nothing;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_attendance_roster(p_actor_user_id uuid, p_school_id uuid, p_section_id uuid, p_academic_year_id uuid, p_attendance_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_session jsonb; v_rows jsonb; begin if p_actor_user_id is null or not private.actor_has_permission(p_actor_user_id,'attendance.view',p_school_id) then raise exception 'Attendance access denied'; end if; if not exists(select 1 from public.schools s where s.id=p_school_id and s.status='active') then raise exception 'School is not active'; end if; if not exists(select 1 from public.sections s where s.id=p_section_id and s.school_id=p_school_id) then raise exception 'Section does not belong to this school'; end if; if not exists(select 1 from public.academic_years y where y.id=p_academic_year_id and y.school_id=p_school_id) then raise exception 'Academic year does not belong to this school'; end if; select jsonb_build_object('id',s.id,'status',s.status,'notes',s.notes,'attendance_date',s.attendance_date,'section_id',s.section_id,'academic_year_id',s.academic_year_id) into v_session from public.attendance_sessions s where s.school_id=p_school_id and s.section_id=p_section_id and s.academic_year_id=p_academic_year_id and s.attendance_date=p_attendance_date; select coalesce(jsonb_agg(jsonb_build_object('student_id',st.id,'enrollment_id',e.id,'admission_number',st.admission_number,'first_name',st.first_name,'middle_name',st.middle_name,'last_name',st.last_name,'roll_number',e.roll_number,'status',coalesce(ar.status,'absent'),'remarks',ar.remarks) order by coalesce(e.roll_number,''),st.first_name,st.last_name),'[]'::jsonb) into v_rows from public.student_enrollments e join public.students st on st.id=e.student_id left join public.attendance_sessions sess on sess.school_id=p_school_id and sess.section_id=p_section_id and sess.academic_year_id=p_academic_year_id and sess.attendance_date=p_attendance_date left join public.attendance_records ar on ar.session_id=sess.id and ar.enrollment_id=e.id where e.school_id=p_school_id and e.academic_year_id=p_academic_year_id and e.section_id=p_section_id and e.status='active' and st.status='active'; return jsonb_build_object('session',v_session,'session_id',case when v_session is null then null else v_session->'id' end,'records',v_rows,'rows',v_rows); end; $function$


CREATE OR REPLACE FUNCTION public.get_communication_campaigns(p_actor_user_id uuid, p_school_id uuid)
 RETURNS SETOF communication_campaigns
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.*
  from public.communication_campaigns c
  where c.school_id=p_school_id
    and private.actor_has_permission(p_actor_user_id,'communication.view',p_school_id)
  order by c.created_at desc;
$function$


CREATE OR REPLACE FUNCTION public.get_exam_results(p_actor_user_id uuid, p_school_id uuid, p_exam_subject_id uuid)
 RETURNS TABLE(enrollment_id uuid, student_id uuid, admission_number text, first_name text, last_name text, marks numeric, grade text, remarks text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select se.id,s.id,s.admission_number,s.first_name,s.last_name,er.marks,er.grade,er.remarks from public.exam_subjects es join public.student_enrollments se on se.section_id is not null and se.school_id=p_school_id join public.students s on s.id=se.student_id and s.school_id=p_school_id left join public.exam_results er on er.exam_subject_id=es.id and er.enrollment_id=se.id where es.id=p_exam_subject_id and es.school_id=p_school_id and private.actor_has_permission(p_actor_user_id,'exam.view',p_school_id) order by coalesce(se.roll_number,''),s.first_name,s.last_name $function$


CREATE OR REPLACE FUNCTION public.get_management_dashboard(p_actor_user_id uuid, p_school_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select public.get_management_dashboard(p_actor_user_id,p_school_id,p_academic_year_id,null::date,null::date); $function$


CREATE OR REPLACE FUNCTION public.get_management_dashboard(p_actor_user_id uuid, p_school_id uuid, p_academic_year_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
     from public.attendance_records ar
     join public.attendance_sessions ats on ats.id=ar.session_id
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
end;$function$


CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_actor_user_id uuid, p_school_id uuid)
 RETURNS notification_preferences
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_preferences public.notification_preferences;
begin
 if not private.actor_has_permission(p_actor_user_id,'notification.manage',p_school_id) then raise exception 'Permission denied'; end if;
 insert into public.notification_preferences(user_id,school_id) values(p_actor_user_id,p_school_id) on conflict(user_id,school_id) do nothing;
 select * into v_preferences from public.notification_preferences where user_id=p_actor_user_id and school_id=p_school_id;
 return v_preferences;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_notifications(p_actor_user_id uuid, p_school_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, school_id uuid, user_id uuid, title text, body text, notification_type text, related_entity_type text, related_entity_id uuid, read_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select n.id,n.school_id,n.user_id,n.title,n.body,n.notification_type,n.related_entity_type,n.related_entity_id,n.read_at,n.created_at
 from public.notifications n
 where n.user_id=p_actor_user_id and n.school_id=p_school_id
   and private.actor_has_permission(p_actor_user_id,'notification.view',p_school_id)
 order by n.created_at desc
 limit greatest(1,least(coalesce(p_limit,50),100));
$function$


CREATE OR REPLACE FUNCTION public.get_organization_entitlements(p_actor_user_id uuid, p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
  v_org record;
  v_student_count integer;
  v_school_count integer;
  v_ai_month integer;
begin
  if p_actor_user_id is null or p_school_id is null then
    raise exception 'actor and school are required';
  end if;

  select s.organization_id into v_org_id
  from public.schools s
  join public.school_memberships sm on sm.school_id = s.id
  where s.id = p_school_id
    and sm.user_id = p_actor_user_id
    and sm.status = 'active'
  limit 1;

  if v_org_id is null then
    raise exception 'access denied';
  end if;

  select o.* into v_org from public.organizations o where o.id = v_org_id;
  if not found then raise exception 'organization not found'; end if;

  select count(*) into v_student_count
  from public.students s
  where s.school_id in (select id from public.schools where organization_id = v_org_id)
    and s.status = 'active';

  select count(*) into v_school_count
  from public.schools s
  where s.organization_id = v_org_id
    and s.status = 'active';

  select count(*) into v_ai_month
  from public.ai_action_logs l
  join public.schools s on s.id = l.school_id
  where s.organization_id = v_org_id
    and l.created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'organization_id', v_org_id,
    'plan', v_org.plan,
    'billing_status', v_org.billing_status,
    'trial_ends_at', v_org.trial_ends_at,
    'max_students', v_org.max_students,
    'max_schools', v_org.max_schools,
    'ai_monthly_limit', v_org.ai_monthly_limit,
    'active_students', v_student_count,
    'active_schools', v_school_count,
    'ai_actions_this_month', v_ai_month,
    'trial_active', v_org.billing_status = 'trialing' and v_org.trial_ends_at > now(),
    'subscription_active', v_org.billing_status in ('trialing','active')
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.get_parent_dashboard(p_actor_user_id uuid, p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_guardian_id uuid;
  v_org_id uuid;
  v_data jsonb;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  select g.id into v_guardian_id from public.guardians g
  where g.school_id = p_school_id and g.user_id = p_actor_user_id limit 1;
  if v_guardian_id is null then raise exception 'Parent access is not configured for this school'; end if;
  if not exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where ur.user_id=p_actor_user_id and ur.school_id=p_school_id
      and r.key='parent' and p.key='parent.view'
  ) then raise exception 'Insufficient permission'; end if;
  select s.organization_id into v_org_id from public.schools s where s.id=p_school_id;
  select jsonb_build_object(
    'guardian', jsonb_build_object('id',g.id,'full_name',g.full_name,'relationship',g.relationship,'phone',g.phone,'email',g.email,'address',g.address),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student',jsonb_build_object('id',st.id,'admission_number',st.admission_number,'first_name',st.first_name,'middle_name',st.middle_name,'last_name',st.last_name,'date_of_birth',st.date_of_birth,'gender',st.gender,'status',st.status),
        'is_primary',sg.is_primary,
        'enrollment',(select jsonb_build_object('id',se.id,'academic_year_id',se.academic_year_id,'academic_year',ay.name,'grade',gr.name,'section',sec.name,'roll_number',se.roll_number,'status',se.status)
          from public.student_enrollments se left join public.academic_years ay on ay.id=se.academic_year_id left join public.grades gr on gr.id=se.grade_id left join public.sections sec on sec.id=se.section_id
          where se.student_id=st.id and se.school_id=p_school_id order by se.created_at desc limit 1),
        'attendance',(select jsonb_build_object('total',count(ar.id),'present',count(*) filter(where lower(ar.status)='present'),'absent',count(*) filter(where lower(ar.status)='absent'),'late',count(*) filter(where lower(ar.status)='late'),'excused',count(*) filter(where lower(ar.status)='excused'))
          from public.attendance_records ar where ar.student_id=st.id and ar.school_id=p_school_id),
        'fees',(select jsonb_build_object('invoiced',coalesce(sum(fi.total),0),'paid',coalesce((select sum(fp.amount) from public.fee_payments fp where fp.school_id=p_school_id and fp.invoice_id in(select fi2.id from public.fee_invoices fi2 where fi2.enrollment_id=se2.id and fi2.school_id=p_school_id) and fp.status='posted'),0),'balance',coalesce(sum(fi.total),0)-coalesce((select sum(fp2.amount) from public.fee_payments fp2 where fp2.school_id=p_school_id and fp2.invoice_id in(select fi3.id from public.fee_invoices fi3 where fi3.enrollment_id=se2.id and fi3.school_id=p_school_id) and fp2.status='posted'),0))
          from public.fee_invoices fi where fi.enrollment_id=se2.id and fi.school_id=p_school_id)
      ) order by st.first_name,st.last_name)
      from public.student_guardians sg join public.students st on st.id=sg.student_id and st.school_id=p_school_id
      left join lateral(select se.id from public.student_enrollments se where se.student_id=st.id and se.school_id=p_school_id order by se.created_at desc limit 1) se2 on true
      where sg.guardian_id=g.id
    ),'[]'::jsonb)
  ) into v_data from public.guardians g where g.id=v_guardian_id;
  insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(v_org_id,p_school_id,p_actor_user_id,'parent.dashboard.view','guardian',v_guardian_id,jsonb_build_object('child_count',jsonb_array_length(coalesce(v_data->'children','[]'::jsonb))));
  return v_data;
end;
$function$


CREATE OR REPLACE FUNCTION public.get_school_database_provisioning(p_actor_user_id uuid, p_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row jsonb;
begin
  if not exists (
    select 1 from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = p_actor_user_id
      and sm.status = 'active'
  ) then
    raise exception 'School access denied';
  end if;

  select to_jsonb(sdp) into v_row
  from public.school_database_provisioning sdp
  where sdp.school_id = p_school_id;

  return coalesce(v_row, '{}'::jsonb);
end;
$function$


CREATE OR REPLACE FUNCTION public.get_staff(p_actor_user_id uuid, p_school_id uuid, p_status text DEFAULT NULL::text)
 RETURNS SETOF staff_members
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select s from public.staff_members s where s.school_id=p_school_id and (p_status is null or s.status=p_status) and private.actor_has_permission(p_actor_user_id,'staff.view',p_school_id) order by s.first_name,s.last_name,s.employee_number;
$function$

