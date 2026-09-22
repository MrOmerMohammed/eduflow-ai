-- Production public function snapshot, functions 41-60; generated 2026-09-22.
-- DATA-FREE.

CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(p_actor_user_id uuid, p_school_id uuid, p_student_id uuid, p_academic_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_total int; v_present int; v_absent int; v_late int; v_excused int; v_counted int; v_pct numeric; begin if p_actor_user_id is null or not private.actor_has_permission(p_actor_user_id,'attendance.view',p_school_id) then raise exception 'Attendance access denied'; end if; if not exists(select 1 from public.students where id=p_student_id and school_id=p_school_id) then raise exception 'Student does not belong to this school'; end if; select count(*),count(*) filter(where ar.status='present'),count(*) filter(where ar.status='absent'),count(*) filter(where ar.status='late'),count(*) filter(where ar.status='excused'),count(*) filter(where ar.status in ('present','absent','late')) into v_total,v_present,v_absent,v_late,v_excused,v_counted from public.attendance_records ar join public.attendance_sessions s on s.id=ar.session_id where ar.school_id=p_school_id and ar.student_id=p_student_id and s.academic_year_id=p_academic_year_id and s.status in ('submitted','locked'); v_pct:=case when v_counted=0 then 0 else round(((v_present+v_late)::numeric/v_counted::numeric)*100,2) end; return jsonb_build_object('total',v_total,'present',v_present,'absent',v_absent,'late',v_late,'excused',v_excused,'counted',v_counted,'percentage',v_pct); end; $function$


CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(p_actor_user_id uuid, p_school_id uuid, p_student_id uuid, p_academic_year_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_total int; v_present int; v_absent int; v_late int; v_excused int; v_counted int; v_pct numeric;
begin
  if p_actor_user_id is null or not private.actor_has_permission(p_actor_user_id,'attendance.view',p_school_id) then raise exception 'Attendance access denied'; end if;
  if not exists(select 1 from public.students where id=p_student_id and school_id=p_school_id) then raise exception 'Student does not belong to this school'; end if;
  select count(*),
    count(*) filter(where ar.status='present'),
    count(*) filter(where ar.status='absent'),
    count(*) filter(where ar.status='late'),
    count(*) filter(where ar.status='excused'),
    count(*) filter(where ar.status in ('present','absent','late'))
  into v_total,v_present,v_absent,v_late,v_excused,v_counted
  from public.attendance_records ar
  join public.attendance_sessions s on s.id=ar.session_id
  where ar.school_id=p_school_id and ar.student_id=p_student_id
    and s.academic_year_id=p_academic_year_id
    and s.status in ('submitted','locked')
    and (p_start_date is null or s.attendance_date >= p_start_date)
    and (p_end_date is null or s.attendance_date <= p_end_date);
  v_pct:=case when v_counted=0 then 0 else round(((v_present+v_late)::numeric/v_counted::numeric)*100,2) end;
  return jsonb_build_object('total',v_total,'present',v_present,'absent',v_absent,'late',v_late,'excused',v_excused,'counted',v_counted,'percentage',v_pct,'start_date',p_start_date,'end_date',p_end_date);
end;
$function$


CREATE OR REPLACE FUNCTION public.get_student_fee_balance(p_actor_user_id uuid, p_school_id uuid, p_enrollment_id uuid)
 RETURNS TABLE(invoice_id uuid, invoice_number text, due_date date, total numeric, paid numeric, balance numeric, status text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select i.id,i.invoice_number,i.due_date,i.total,coalesce(sum(p.amount) filter(where p.status='completed'),0),i.total-coalesce(sum(p.amount) filter(where p.status='completed'),0),i.status from public.fee_invoices i left join public.fee_payments p on p.invoice_id=i.id and p.school_id=p_school_id where i.school_id=p_school_id and i.enrollment_id=p_enrollment_id and private.actor_has_permission(p_actor_user_id,'finance.view',p_school_id) group by i.id order by i.due_date,i.invoice_number; $function$


CREATE OR REPLACE FUNCTION public.import_school_setup(p_actor_user_id uuid, p_school_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r jsonb;
  v_year_id uuid;
  v_grade_id uuid;
  v_section_id uuid;
  v_subject_id uuid;
  v_student_id uuid;
  v_guardian_id uuid;
  v_staff_id uuid;
  v_existing uuid;
  v_count jsonb := jsonb_build_object('academic_years',0,'grades',0,'sections',0,'subjects',0,'students',0,'enrollments',0,'guardians',0,'guardian_links',0,'teachers',0,'teacher_assignments',0);
  v_name text; v_code text; v_email text; v_phone text; v_key text;
begin
  if p_actor_user_id is null or p_school_id is null then raise exception 'Actor and school are required'; end if;
  if not exists(select 1 from public.user_roles ur join public.roles ro on ro.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and ro.key in('admin','principal','vice_principal','organization_admin','super_admin')) then raise exception 'Insufficient permission'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 then raise exception 'Import rows are required'; end if;

  for r in select value from jsonb_array_elements(p_rows)
  loop
    -- Academic year
    v_name := nullif(trim(coalesce(r->>'academic_year','')), '');
    if v_name is null then raise exception 'Academic year is required'; end if;
    select id into v_year_id from public.academic_years where school_id=p_school_id and lower(name)=lower(v_name) limit 1;
    if v_year_id is null then
      insert into public.academic_years(school_id,name,start_date,end_date,is_current)
      values(p_school_id,v_name,
        coalesce(nullif(r->>'academic_year_start','')::date, current_date),
        coalesce(nullif(r->>'academic_year_end','')::date, current_date + interval '1 year'),
        coalesce(nullif(r->>'academic_year_current','')::boolean,false))
      returning id into v_year_id;
      v_count := jsonb_set(v_count,'{academic_years}',to_jsonb((v_count->>'academic_years')::int+1));
    end if;

    -- Grade
    v_name := nullif(trim(coalesce(r->>'grade','')), '');
    if v_name is null then raise exception 'Grade is required'; end if;
    v_code := coalesce(nullif(trim(r->>'grade_code'),''), upper(regexp_replace(v_name,'[^A-Za-z0-9]+','','g')));
    select id into v_grade_id from public.grades where school_id=p_school_id and lower(name)=lower(v_name) limit 1;
    if v_grade_id is null then
      insert into public.grades(school_id,name,code,sort_order) values(p_school_id,v_name,upper(v_code),0) returning id into v_grade_id;
      v_count := jsonb_set(v_count,'{grades}',to_jsonb((v_count->>'grades')::int+1));
    end if;

    -- Section
    v_name := nullif(trim(coalesce(r->>'section','')), '');
    if v_name is null then raise exception 'Section is required'; end if;
    select id into v_section_id from public.sections where school_id=p_school_id and grade_id=v_grade_id and lower(name)=lower(v_name) limit 1;
    if v_section_id is null then
      insert into public.sections(school_id,grade_id,name,capacity) values(p_school_id,v_grade_id,v_name,nullif(r->>'section_capacity','')::int) returning id into v_section_id;
      v_count := jsonb_set(v_count,'{sections}',to_jsonb((v_count->>'sections')::int+1));
    end if;

    -- Subject (optional)
    v_name := nullif(trim(coalesce(r->>'subject','')), '');
    if v_name is not null then
      v_code := coalesce(nullif(trim(r->>'subject_code'),''), upper(regexp_replace(v_name,'[^A-Za-z0-9]+','','g')));
      select id into v_subject_id from public.subjects where school_id=p_school_id and lower(name)=lower(v_name) limit 1;
      if v_subject_id is null then
        insert into public.subjects(school_id,name,code) values(p_school_id,v_name,upper(v_code)) returning id into v_subject_id;
        v_count := jsonb_set(v_count,'{subjects}',to_jsonb((v_count->>'subjects')::int+1));
      end if;
    else
      v_subject_id := null;
    end if;

    -- Student
    v_key := nullif(trim(coalesce(r->>'admission_number','')), '');
    if v_key is null then raise exception 'Admission number is required'; end if;
    select id into v_student_id from public.students where school_id=p_school_id and admission_number=v_key limit 1;
    if v_student_id is null then
      if nullif(trim(coalesce(r->>'first_name','')),'') is null then raise exception 'First name is required for %', v_key; end if;
      insert into public.students(school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status)
      values(p_school_id,v_key,trim(r->>'first_name'),nullif(trim(r->>'middle_name'),''),
        nullif(trim(r->>'last_name'),''),nullif(r->>'date_of_birth','')::date,nullif(trim(r->>'gender'),''),
        nullif(trim(r->>'student_email'),''),nullif(trim(r->>'student_phone'),''),coalesce(nullif(r->>'student_status',''),'active'))
      returning id into v_student_id;
      v_count := jsonb_set(v_count,'{students}',to_jsonb((v_count->>'students')::int+1));
    end if;

    -- Enrollment
    if not exists(select 1 from public.student_enrollments where school_id=p_school_id and student_id=v_student_id and academic_year_id=v_year_id) then
      insert into public.student_enrollments(school_id,student_id,academic_year_id,grade_id,section_id,roll_number,status)
      values(p_school_id,v_student_id,v_year_id,v_grade_id,v_section_id,nullif(trim(r->>'roll_number'),''),'active');
      v_count := jsonb_set(v_count,'{enrollments}',to_jsonb((v_count->>'enrollments')::int+1));
    end if;

    -- Guardian
    v_name := nullif(trim(coalesce(r->>'guardian_name','')), '');
    if v_name is not null then
      v_email := nullif(lower(trim(coalesce(r->>'guardian_email',''))),'');
      v_phone := nullif(trim(coalesce(r->>'guardian_phone','')),'');
      select id into v_guardian_id from public.guardians
        where school_id=p_school_id
          and ((v_email is not null and lower(coalesce(email,''))=v_email) or (v_email is null and v_phone is not null and coalesce(phone,'')=v_phone))
        limit 1;
      if v_guardian_id is null then
        insert into public.guardians(school_id,full_name,relationship,phone,email,address)
        values(p_school_id,v_name,nullif(trim(r->>'guardian_relationship'),''),v_phone,v_email,'{}'::jsonb)
        returning id into v_guardian_id;
        v_count := jsonb_set(v_count,'{guardians}',to_jsonb((v_count->>'guardians')::int+1));
      end if;
      insert into public.student_guardians(student_id,guardian_id,is_primary)
      values(v_student_id,v_guardian_id,coalesce(nullif(r->>'guardian_primary','')::boolean,true))
      on conflict(student_id,guardian_id) do nothing;
      v_count := jsonb_set(v_count,'{guardian_links}',to_jsonb((v_count->>'guardian_links')::int+1));
    end if;

    -- Teacher/staff record
    v_email := nullif(lower(trim(coalesce(r->>'teacher_email',''))),'');
    if v_email is not null then
      select id into v_staff_id from public.staff_members where school_id=p_school_id and lower(coalesce(email,''))=v_email limit 1;
      if v_staff_id is null then
        insert into public.staff_members(school_id,employee_number,first_name,last_name,email,phone,designation,department,employment_type,joining_date)
        values(p_school_id,
          coalesce(nullif(trim(r->>'teacher_employee_number'),''), 'IMP-'||substr(md5(v_email),1,8)),
          coalesce(nullif(trim(r->>'teacher_first_name'),''), split_part(r->>'teacher_name',' ',1)),
          nullif(trim(r->>'teacher_last_name'),''),
          v_email,
          nullif(trim(r->>'teacher_phone'),''),
          coalesce(nullif(trim(r->>'teacher_designation'),''),'Teacher'),
          nullif(trim(r->>'teacher_department'),''),
          coalesce(nullif(trim(r->>'teacher_employment_type'),''),'full_time'),
          coalesce(nullif(r->>'teacher_joining_date','')::date,current_date))
        returning id into v_staff_id;
        v_count := jsonb_set(v_count,'{teachers}',to_jsonb((v_count->>'teachers')::int+1));
      end if;
    end if;
  end loop;

  insert into public.audit_logs(school_id,actor_user_id,action,entity_type,metadata)
  values(p_school_id,p_actor_user_id,'school.bulk_import','school',v_count);

  return v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.link_student_guardian(p_actor_user_id uuid, p_school_id uuid, p_student_id uuid, p_guardian_id uuid, p_is_primary boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not private.actor_has_permission(p_actor_user_id, 'student.manage', p_school_id) then
    raise exception 'Insufficient permission';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = p_school_id) then
    raise exception 'Student does not belong to school';
  end if;
  if not exists (select 1 from public.guardians where id = p_guardian_id and school_id = p_school_id) then
    raise exception 'Guardian does not belong to school';
  end if;

  if p_is_primary then
    update public.student_guardians sg
    set is_primary = false
    where sg.student_id = p_student_id;
  end if;

  insert into public.student_guardians(student_id, guardian_id, is_primary)
  values (p_student_id, p_guardian_id, p_is_primary)
  on conflict (student_id, guardian_id)
  do update set is_primary = excluded.is_primary;

  insert into public.audit_logs(school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_school_id, p_actor_user_id, 'student.guardian.link', 'student', p_student_id,
    jsonb_build_object('guardian_id', p_guardian_id, 'is_primary', p_is_primary)
  );

  return jsonb_build_object('student_id', p_student_id, 'guardian_id', p_guardian_id, 'is_primary', p_is_primary);
end;
$function$


CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_actor_user_id uuid, p_school_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_count integer:=0; v_org uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'notification.view',p_school_id) then raise exception 'Permission denied'; end if;
 update public.notifications set read_at=now()
 where user_id=p_actor_user_id and school_id=p_school_id and read_at is null;
 get diagnostics v_count=row_count;
 if v_count>0 then
   select organization_id into v_org from public.schools where id=p_school_id;
   insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,metadata)
   values(v_org,p_school_id,p_actor_user_id,'notification.read_all','notification',jsonb_build_object('count',v_count));
 end if;
 return v_count;
end;
$function$


CREATE OR REPLACE FUNCTION public.mark_notification_read(p_actor_user_id uuid, p_school_id uuid, p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org uuid; v_changed boolean:=false;
begin
 if not private.actor_has_permission(p_actor_user_id,'notification.view',p_school_id) then raise exception 'Permission denied'; end if;
 update public.notifications set read_at=coalesce(read_at,now())
 where id=p_notification_id and user_id=p_actor_user_id and school_id=p_school_id;
 v_changed:=found;
 if v_changed then
   select organization_id into v_org from public.schools where id=p_school_id;
   insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
   values(v_org,p_school_id,p_actor_user_id,'notification.read','notification',p_notification_id,'{}'::jsonb);
 end if;
 return v_changed;
end;
$function$


CREATE OR REPLACE FUNCTION public.record_fee_payment(p_actor_user_id uuid, p_school_id uuid, p_invoice_id uuid, p_receipt_number text, p_amount numeric, p_payment_method text, p_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_total numeric; v_paid numeric; v_org uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'finance.manage',p_school_id) then raise exception 'not authorized'; end if;
 select total into v_total from public.fee_invoices where id=p_invoice_id and school_id=p_school_id and status not in ('cancelled','void','failed') for update;
 if v_total is null then raise exception 'invoice not found'; end if;
 select coalesce(sum(amount) filter(where status='completed'),0) into v_paid from public.fee_payments where invoice_id=p_invoice_id and school_id=p_school_id;
 if p_amount is null or p_amount<=0 or p_amount>v_total-v_paid then raise exception 'payment exceeds outstanding balance'; end if;
 if nullif(trim(p_receipt_number),'') is null then raise exception 'receipt number is required'; end if;
 if nullif(trim(p_payment_method),'') is null then raise exception 'payment method is required'; end if;
 insert into public.fee_payments(school_id,invoice_id,receipt_number,amount,payment_method,reference,received_by) values(p_school_id,p_invoice_id,trim(p_receipt_number),p_amount,p_payment_method,p_reference,p_actor_user_id) returning id into v_id;
 v_paid:=v_paid+p_amount;
 update public.fee_invoices set status=case when v_paid=v_total then 'paid' else 'partially_paid' end,updated_at=now() where id=p_invoice_id;
 select organization_id into v_org from public.schools where id=p_school_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_org,p_school_id,p_actor_user_id,'fee_payment.record','fee_payment',v_id,jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount,'method',p_payment_method));
 return v_id;
end $function$


CREATE OR REPLACE FUNCTION public.save_attendance(p_actor_user_id uuid, p_school_id uuid, p_academic_year_id uuid, p_section_id uuid, p_attendance_date date, p_records jsonb, p_status text DEFAULT 'submitted'::text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_session_id uuid; v_old_status text; v_count int := 0; r jsonb; v_enrollment uuid; v_student uuid; v_att_status text; v_remarks text;
begin
  if p_actor_user_id is null or not private.actor_has_permission(p_actor_user_id,'attendance.manage',p_school_id) then raise exception 'Attendance access denied'; end if;
  if p_status not in ('open','submitted','locked') then raise exception 'Invalid attendance session status'; end if;
  if jsonb_typeof(p_records) <> 'array' then raise exception 'records must be an array'; end if;
  if not exists (select 1 from public.sections where id=p_section_id and school_id=p_school_id) then raise exception 'Section does not belong to this school'; end if;
  if not exists (select 1 from public.academic_years where id=p_academic_year_id and school_id=p_school_id) then raise exception 'Academic year does not belong to this school'; end if;
  select id,status into v_session_id,v_old_status from public.attendance_sessions where school_id=p_school_id and academic_year_id=p_academic_year_id and section_id=p_section_id and attendance_date=p_attendance_date for update;
  if v_session_id is null then
    insert into public.attendance_sessions(school_id,academic_year_id,section_id,attendance_date,status,notes,created_by,created_at,updated_at)
    values(p_school_id,p_academic_year_id,p_section_id,p_attendance_date,p_status,p_notes,p_actor_user_id,now(),now()) returning id into v_session_id;
  elsif v_old_status='locked' then raise exception 'Attendance session is locked';
  else
    update public.attendance_sessions set status=p_status,notes=p_notes,updated_at=now() where id=v_session_id;
  end if;
  for r in select value from jsonb_array_elements(p_records)
  loop
    v_enrollment := nullif(r->>'enrollmentId','')::uuid;
    v_att_status := r->>'status';
    v_remarks := nullif(r->>'remarks','');
    if v_enrollment is null or v_att_status not in ('present','absent','late','excused') then raise exception 'Invalid attendance record'; end if;
    select e.student_id into v_student from public.student_enrollments e where e.id=v_enrollment and e.school_id=p_school_id and e.academic_year_id=p_academic_year_id and e.section_id=p_section_id and e.status='active';
    if v_student is null then raise exception 'Attendance enrollment is not valid for this section'; end if;
    insert into public.attendance_records(session_id,school_id,student_id,enrollment_id,status,remarks,marked_by,marked_at,updated_at)
    values(v_session_id,p_school_id,v_student,v_enrollment,v_att_status,v_remarks,p_actor_user_id,now(),now())
    on conflict(session_id,enrollment_id) do update set status=excluded.status,remarks=excluded.remarks,marked_by=excluded.marked_by,marked_at=excluded.marked_at,updated_at=now();
    v_count := v_count + 1;
  end loop;
  insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata,created_at)
  values(p_actor_user_id,p_school_id,'attendance.save','attendance_session',v_session_id,jsonb_build_object('record_count',v_count,'status',p_status,'attendance_date',p_attendance_date),now());
  return jsonb_build_object('session_id',v_session_id,'status',p_status,'record_count',v_count);
exception when unique_violation then raise exception 'Attendance record already exists';
end;$function$


CREATE OR REPLACE FUNCTION public.save_exam_results(p_actor_user_id uuid, p_school_id uuid, p_exam_subject_id uuid, p_results jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_count integer:=0; r jsonb; v_enrollment uuid; v_marks numeric; v_grade text; v_remarks text; v_exam_id uuid; v_exam_year uuid; v_max_marks numeric;
begin
 if not private.actor_has_permission(p_actor_user_id,'exam.manage',p_school_id) then raise exception 'permission denied'; end if;
 select es.exam_id,es.max_marks,e.academic_year_id into v_exam_id,v_max_marks,v_exam_year from public.exam_subjects es join public.exams e on e.id=es.exam_id where es.id=p_exam_subject_id and es.school_id=p_school_id and e.school_id=p_school_id;
 if v_exam_id is null then raise exception 'exam subject not found'; end if;
 if jsonb_typeof(p_results)<>'array' then raise exception 'results must be an array'; end if;
 for r in select * from jsonb_array_elements(p_results) loop
   begin v_enrollment:=(r->>'enrollmentId')::uuid; exception when others then raise exception 'invalid enrollment id'; end;
   begin v_marks:=(r->>'marks')::numeric; exception when others then raise exception 'invalid marks'; end;
   v_grade:=nullif(r->>'grade',''); v_remarks:=nullif(r->>'remarks','');
   if v_marks is null or v_marks<0 or v_marks>v_max_marks then raise exception 'marks out of range'; end if;
   if not exists(select 1 from public.student_enrollments se where se.id=v_enrollment and se.school_id=p_school_id and se.academic_year_id=v_exam_year) then raise exception 'enrollment does not belong to exam academic year'; end if;
   insert into public.exam_results(school_id,exam_subject_id,enrollment_id,marks,grade,remarks,entered_by) values(p_school_id,p_exam_subject_id,v_enrollment,v_marks,v_grade,v_remarks,p_actor_user_id)
   on conflict(exam_subject_id,enrollment_id) do update set marks=excluded.marks,grade=excluded.grade,remarks=excluded.remarks,entered_by=excluded.entered_by,updated_at=now();
   v_count:=v_count+1;
 end loop;
 insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_school_id,p_actor_user_id,'exam.results.save','exam_subject',p_exam_subject_id,jsonb_build_object('record_count',v_count));
 return v_count;
end $function$


CREATE OR REPLACE FUNCTION public.save_school_onboarding(p_actor_user_id uuid, p_school_id uuid, p_status text, p_current_step integer, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_org_id uuid; v_admin boolean; v_status text;
begin
  if p_actor_user_id is null or p_school_id is null then raise exception 'User and school are required'; end if;
  v_status := case when p_status='completed' then 'completed' else 'in_progress' end;
  select s.organization_id into v_org_id from public.schools s where s.id=p_school_id and s.status='active';
  if v_org_id is null then raise exception 'School not found or inactive'; end if;
  select exists(select 1 from public.school_memberships sm where sm.school_id=p_school_id and sm.user_id=p_actor_user_id and sm.status='active' and sm.role='admin') into v_admin;
  if not v_admin then raise exception 'Only school administrators can complete school setup'; end if;
  insert into public.school_onboarding_profiles(school_id,status,current_step,answers,completed_at,updated_at)
  values(p_school_id,v_status,greatest(1,least(coalesce(p_current_step,1),8)),coalesce(p_answers,'{}'::jsonb),case when v_status='completed' then now() else null end,now())
  on conflict(school_id) do update set status=excluded.status,current_step=excluded.current_step,answers=excluded.answers,completed_at=excluded.completed_at,updated_at=now();
  insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(v_org_id,p_school_id,p_actor_user_id,'school.onboarding.save','school_onboarding',p_school_id,jsonb_build_object('status',v_status,'current_step',p_current_step));
  return jsonb_build_object('school_id',p_school_id,'status',v_status,'current_step',greatest(1,least(coalesce(p_current_step,1),8)));
end; $function$


CREATE OR REPLACE FUNCTION public.send_communication_campaign(p_actor_user_id uuid, p_school_id uuid, p_campaign_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_campaign public.communication_campaigns%rowtype;
declare v_count integer:=0;
begin
 if not private.actor_has_permission(p_actor_user_id,'communication.send',p_school_id) then raise exception 'Permission denied'; end if;
 select * into v_campaign from public.communication_campaigns where id=p_campaign_id and school_id=p_school_id for update;
 if not found then raise exception 'Campaign not found'; end if;
 if v_campaign.status<>'draft' then raise exception 'Only draft campaigns can be sent'; end if;
 if v_campaign.scheduled_at is not null and v_campaign.scheduled_at>now() then raise exception 'Campaign is scheduled for a future time'; end if;
 if v_campaign.audience_type='all_guardians' then
   insert into public.communication_recipients(campaign_id,guardian_id)
   select v_campaign.id,g.id from public.guardians g where g.school_id=p_school_id and (g.user_id is not null or g.phone is not null or g.email is not null) on conflict do nothing;
 elsif v_campaign.audience_type='student_guardians' then
   insert into public.communication_recipients(campaign_id,guardian_id)
   select distinct v_campaign.id,g.guardian_id from public.student_guardians g join public.students s on s.id=g.student_id and s.school_id=p_school_id
   where g.guardian_id is not null and (v_campaign.target_student_ids is null or s.id=any(v_campaign.target_student_ids)) on conflict do nothing;
 elsif v_campaign.audience_type='staff' then
   insert into public.communication_recipients(campaign_id,staff_id)
   select v_campaign.id,st.id from public.staff_members st where st.school_id=p_school_id and st.status='active' on conflict do nothing;
 elsif v_campaign.audience_type='all_school' then
   insert into public.communication_recipients(campaign_id,guardian_id)
   select v_campaign.id,g.id from public.guardians g where g.school_id=p_school_id and (g.user_id is not null or g.phone is not null or g.email is not null) on conflict do nothing;
   insert into public.communication_recipients(campaign_id,staff_id)
   select v_campaign.id,st.id from public.staff_members st where st.school_id=p_school_id and st.status='active' on conflict do nothing;
 end if;
 update public.communication_recipients set delivery_status='sent',delivered_at=now() where campaign_id=v_campaign.id and delivery_status='queued';
 get diagnostics v_count=row_count;
 if v_campaign.channel='in_app' then
   insert into public.notifications(school_id,user_id,title,body,notification_type,related_entity_type,related_entity_id)
   select p_school_id,g.user_id,v_campaign.title,v_campaign.body,'communication','communication_campaign',v_campaign.id
   from public.communication_recipients r join public.guardians g on g.id=r.guardian_id
   left join public.notification_preferences np on np.user_id=g.user_id and np.school_id=p_school_id
   where r.campaign_id=v_campaign.id and g.user_id is not null and coalesce(np.in_app_enabled,true);
   insert into public.notifications(school_id,user_id,title,body,notification_type,related_entity_type,related_entity_id)
   select p_school_id,st.user_id,v_campaign.title,v_campaign.body,'communication','communication_campaign',v_campaign.id
   from public.communication_recipients r join public.staff_members st on st.id=r.staff_id
   left join public.notification_preferences np on np.user_id=st.user_id and np.school_id=p_school_id
   where r.campaign_id=v_campaign.id and st.user_id is not null and coalesce(np.in_app_enabled,true);
 end if;
 update public.communication_campaigns set status='sent',sent_at=now(),updated_at=now() where id=v_campaign.id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'communication.campaign.send','communication_campaign',v_campaign.id,jsonb_build_object('recipient_count',v_count,'channel',v_campaign.channel)
 from public.schools s where s.id=p_school_id;
 return jsonb_build_object('campaign_id',v_campaign.id,'status','sent','recipient_count',v_count);
end;
$function$


CREATE OR REPLACE FUNCTION public.set_leave_request_status(p_actor_user_id uuid, p_school_id uuid, p_leave_request_id uuid, p_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'staff.manage',p_school_id) then raise exception 'permission denied'; end if;
 if p_status not in ('approved','rejected','cancelled') then raise exception 'invalid leave status'; end if;
 update public.leave_requests set status=p_status,approved_by=case when p_status='approved' then p_actor_user_id else approved_by end,approved_at=case when p_status='approved' then now() else approved_at end,updated_at=now() where id=p_leave_request_id and school_id=p_school_id returning id into v_id;
 if v_id is null then raise exception 'leave request not found'; end if;
 insert into public.audit_logs(actor_user_id,school_id,action,entity_type,entity_id,metadata) values(p_actor_user_id,p_school_id,'leave.status.update','leave_request',v_id,jsonb_build_object('status',p_status));
 return v_id;
end;$function$


CREATE OR REPLACE FUNCTION public.set_notification_preferences(p_actor_user_id uuid, p_school_id uuid, p_in_app_enabled boolean, p_email_enabled boolean, p_sms_enabled boolean, p_whatsapp_enabled boolean)
 RETURNS notification_preferences
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_preferences public.notification_preferences; v_org uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'notification.manage',p_school_id) then raise exception 'Permission denied'; end if;
 insert into public.notification_preferences(user_id,school_id,in_app_enabled,email_enabled,sms_enabled,whatsapp_enabled,updated_at)
 values(p_actor_user_id,p_school_id,p_in_app_enabled,p_email_enabled,p_sms_enabled,p_whatsapp_enabled,now())
 on conflict(user_id,school_id) do update set
   in_app_enabled=excluded.in_app_enabled,email_enabled=excluded.email_enabled,sms_enabled=excluded.sms_enabled,whatsapp_enabled=excluded.whatsapp_enabled,updated_at=now()
 returning * into v_preferences;
 select organization_id into v_org from public.schools where id=p_school_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 values(v_org,p_school_id,p_actor_user_id,'notification.preferences.update','notification_preferences',p_actor_user_id,
 jsonb_build_object('in_app_enabled',p_in_app_enabled,'email_enabled',p_email_enabled,'sms_enabled',p_sms_enabled,'whatsapp_enabled',p_whatsapp_enabled));
 return v_preferences;
end;
$function$


CREATE OR REPLACE FUNCTION public.stage_import_rows(p_actor_user_id uuid, p_school_id uuid, p_batch_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_total integer;
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if jsonb_typeof(p_rows) <> 'array' then raise exception 'Rows must be an array'; end if;
 if jsonb_array_length(p_rows) > 10000 then raise exception 'Import exceeds 10000 rows'; end if;
 if not exists(select 1 from public.import_batches b where b.id=p_batch_id and b.school_id=p_school_id and b.status in ('staged','validated')) then raise exception 'Import batch is not editable'; end if;
 delete from public.import_rows where batch_id=p_batch_id;
 insert into public.import_rows(batch_id,row_number,raw_data,normalized_data)
 select p_batch_id,(x->>'row_number')::integer,coalesce(x->'raw_data','{}'::jsonb),coalesce(x->'normalized_data','{}'::jsonb) from jsonb_array_elements(p_rows) x;
 select count(*) into v_total from public.import_rows where batch_id=p_batch_id;
 update public.import_batches set total_rows=v_total,valid_rows=0,invalid_rows=0,skipped_rows=0,committed_rows=0,status='staged',validated_at=null,committed_at=null where id=p_batch_id;
 return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total);
end; $function$


CREATE OR REPLACE FUNCTION public.update_staff_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin new.updated_at=now(); return new; end; $function$


CREATE OR REPLACE FUNCTION public.update_student(p_actor_user_id uuid, p_student_id uuid, p_school_id uuid, p_admission_number text, p_first_name text, p_middle_name text DEFAULT NULL::text, p_last_name text DEFAULT NULL::text, p_date_of_birth date DEFAULT NULL::date, p_gender text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_status text DEFAULT 'active'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_org_id uuid;
  v_existing_school uuid;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not private.actor_has_permission(p_actor_user_id, 'student.manage', p_school_id) then
    raise exception 'Insufficient permission';
  end if;
  select school_id into v_existing_school from public.students where id = p_student_id;
  if v_existing_school is null or v_existing_school <> p_school_id then
    raise exception 'Student does not belong to school';
  end if;
  if nullif(trim(p_admission_number), '') is null or nullif(trim(p_first_name), '') is null then
    raise exception 'Admission number and first name are required';
  end if;
  if p_status not in ('active','inactive','graduated','transferred','withdrawn') then
    raise exception 'Invalid student status';
  end if;

  select organization_id into v_org_id from public.schools where id = p_school_id;

  update public.students
  set admission_number = trim(p_admission_number),
      first_name = trim(p_first_name),
      middle_name = nullif(trim(p_middle_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      date_of_birth = p_date_of_birth,
      gender = nullif(trim(p_gender), ''),
      email = nullif(trim(p_email), ''),
      phone = nullif(trim(p_phone), ''),
      status = p_status,
      updated_at = now()
  where id = p_student_id and school_id = p_school_id;

  insert into public.audit_logs(organization_id, school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id, p_school_id, p_actor_user_id, 'student.update', 'student', p_student_id,
    jsonb_build_object('admission_number', trim(p_admission_number), 'status', p_status)
  );

  return jsonb_build_object('id', p_student_id, 'school_id', p_school_id, 'admission_number', trim(p_admission_number));
exception
  when unique_violation then
    raise exception 'Admission number already exists in this school';
end;
$function$


CREATE OR REPLACE FUNCTION public.validate_import_batch(p_actor_user_id uuid, p_school_id uuid, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; v_errors jsonb; v_valid integer:=0; v_invalid integer:=0; v_total integer:=0;
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if not exists(select 1 from public.import_batches b where b.id=p_batch_id and b.school_id=p_school_id and b.status in ('staged','validated','ready')) then raise exception 'Import batch not found'; end if;
 for r in select * from public.import_rows where batch_id=p_batch_id order by row_number loop
  select coalesce(jsonb_agg(msg),'[]'::jsonb) into v_errors from (
   select 'Student name is required'::text msg where nullif(btrim(r.normalized_data->>'name'),'') is null
   union all select 'Class is required' where nullif(btrim(r.normalized_data->>'class'),'') is null
   union all select 'Father name is required' where nullif(btrim(r.normalized_data->>'father_name'),'') is null
   union all select 'Mobile number is required' where nullif(regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'),'') is null
   union all select 'Mobile number must contain 10 digits' where nullif(regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'),'') is not null and length(regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g')) <> 10
   union all select 'Class is not configured in this school' where not exists(select 1 from public.grades g where g.school_id=p_school_id and lower(btrim(g.name))=lower(btrim(r.normalized_data->>'class')))
   union all select 'Duplicate student in this import' where exists(select 1 from public.import_rows d where d.batch_id=r.batch_id and d.id<>r.id and lower(btrim(d.normalized_data->>'name'))=lower(btrim(r.normalized_data->>'name')) and regexp_replace(coalesce(d.normalized_data->>'mobile',''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'))
   union all select 'Student already exists with the same name and mobile' where exists(select 1 from public.students s where s.school_id=p_school_id and lower(btrim(concat_ws(' ',s.first_name,s.middle_name,s.last_name)))=lower(btrim(r.normalized_data->>'name')) and regexp_replace(coalesce(s.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'))
  ) q;
  update public.import_rows set errors=v_errors,status=case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end where id=r.id;
 end loop;
 select count(*) filter(where status='valid'),count(*) filter(where status='invalid'),count(*) into v_valid,v_invalid,v_total from public.import_rows where batch_id=p_batch_id;
 update public.import_batches set valid_rows=v_valid,invalid_rows=v_invalid,status=case when v_invalid=0 and v_valid>0 then 'ready' else 'validated' end,validated_at=now() where id=p_batch_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.validate','import_batch',p_batch_id,jsonb_build_object('total_rows',v_total,'valid_rows',v_valid,'invalid_rows',v_invalid) from public.schools s where s.id=p_school_id;
 return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total,'valid_rows',v_valid,'invalid_rows',v_invalid);
end; $function$

