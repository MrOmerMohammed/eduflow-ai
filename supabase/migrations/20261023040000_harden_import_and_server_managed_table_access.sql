-- Keep the privileged CSV import aligned with active school-admin authorization.
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
  if not exists (
    select 1
    from public.school_memberships sm
    join public.schools s on s.id = sm.school_id
    join public.user_roles ur on ur.user_id = sm.user_id and ur.school_id = sm.school_id
    join public.roles ro on ro.id = ur.role_id
    where sm.user_id = p_actor_user_id
      and sm.school_id = p_school_id
      and sm.status = 'active'
      and sm.role = 'admin'
      and s.status = 'active'
      and ro.key = 'admin'
      and ro.scope = 'school'
  ) then
    raise exception 'Insufficient permission';
  end if;
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

-- These records are managed exclusively through server-side privileged workflows.
REVOKE ALL PRIVILEGES ON TABLE
  public.ai_execution_runs,
  public.ai_execution_steps,
  public.ai_tool_permissions,
  public.ai_tools,
  public.attendance_records,
  public.attendance_sessions,
  public.communication_campaigns,
  public.communication_recipients,
  public.import_batches,
  public.import_rows,
  public.notification_preferences,
  public.notifications,
  public.school_database_provisioning
FROM PUBLIC, anon, authenticated;
