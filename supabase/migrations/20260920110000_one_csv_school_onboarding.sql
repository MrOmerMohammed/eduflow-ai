-- One-CSV school onboarding. Applied to production via Supabase execute_sql.
-- Keeps the application migration history reproducible.
create or replace function public.import_school_setup(p_actor_user_id uuid,p_school_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r jsonb; y uuid; g uuid; s uuid; sub uuid; st uuid; gd uuid; staff uuid;
 n text; c text; e text; ph text;
 counts jsonb:=jsonb_build_object('academic_years',0,'grades',0,'sections',0,'subjects',0,'students',0,'enrollments',0,'guardians',0,'guardian_links',0,'teachers',0,'teacher_assignments',0);
begin
 if p_actor_user_id is null or p_school_id is null then raise exception 'Actor and school are required'; end if;
 if not exists(select 1 from public.user_roles ur join public.roles ro on ro.id=ur.role_id where ur.user_id=p_actor_user_id and ur.school_id=p_school_id and ro.key in('admin','principal','vice_principal','organization_admin','super_admin')) then raise exception 'Insufficient permission'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Import rows are required'; end if;
 for r in select value from jsonb_array_elements(p_rows) loop
  n:=nullif(trim(coalesce(r->>'academic_year','')),''); if n is null then raise exception 'Academic year is required'; end if;
  select id into y from public.academic_years where school_id=p_school_id and lower(name)=lower(n) limit 1;
  if y is null then insert into public.academic_years(school_id,name,start_date,end_date,is_current) values(p_school_id,n,coalesce(nullif(r->>'academic_year_start','')::date,current_date),coalesce(nullif(r->>'academic_year_end','')::date,current_date+interval '1 year'),coalesce(nullif(r->>'academic_year_current','')::boolean,false)) returning id into y; counts:=jsonb_set(counts,'{academic_years}',to_jsonb((counts->>'academic_years')::int+1)); end if;
  n:=nullif(trim(coalesce(r->>'grade','')),''); if n is null then raise exception 'Grade is required'; end if;
  c:=coalesce(nullif(trim(r->>'grade_code'),''),upper(regexp_replace(n,'[^A-Za-z0-9]+','','g')));
  select id into g from public.grades where school_id=p_school_id and lower(name)=lower(n) limit 1;
  if g is null then insert into public.grades(school_id,name,code,sort_order) values(p_school_id,n,upper(c),0) returning id into g; counts:=jsonb_set(counts,'{grades}',to_jsonb((counts->>'grades')::int+1)); end if;
  n:=nullif(trim(coalesce(r->>'section','')),''); if n is null then raise exception 'Section is required'; end if;
  select id into s from public.sections where school_id=p_school_id and grade_id=g and lower(name)=lower(n) limit 1;
  if s is null then insert into public.sections(school_id,grade_id,name,capacity) values(p_school_id,g,n,nullif(r->>'section_capacity','')::int) returning id into s; counts:=jsonb_set(counts,'{sections}',to_jsonb((counts->>'sections')::int+1)); end if;
  n:=nullif(trim(coalesce(r->>'subject','')),'');
  if n is not null then
   c:=coalesce(nullif(trim(r->>'subject_code'),''),upper(regexp_replace(n,'[^A-Za-z0-9]+','','g')));
   select id into sub from public.subjects where school_id=p_school_id and lower(name)=lower(n) limit 1;
   if sub is null then insert into public.subjects(school_id,name,code) values(p_school_id,n,upper(c)) returning id into sub; counts:=jsonb_set(counts,'{subjects}',to_jsonb((counts->>'subjects')::int+1)); end if;
  else sub:=null; end if;
  c:=nullif(trim(coalesce(r->>'admission_number','')),''); if c is null then raise exception 'Admission number is required'; end if;
  select id into st from public.students where school_id=p_school_id and admission_number=c limit 1;
  if st is null then
   if nullif(trim(coalesce(r->>'first_name','')),'') is null then raise exception 'First name is required for %',c; end if;
   insert into public.students(school_id,admission_number,first_name,middle_name,last_name,date_of_birth,gender,email,phone,status) values(p_school_id,c,trim(r->>'first_name'),nullif(trim(r->>'middle_name'),''),nullif(trim(r->>'last_name'),''),nullif(r->>'date_of_birth','')::date,nullif(trim(r->>'gender'),''),nullif(trim(r->>'student_email'),''),nullif(trim(r->>'student_phone'),''),coalesce(nullif(r->>'student_status',''),'active')) returning id into st;
   counts:=jsonb_set(counts,'{students}',to_jsonb((counts->>'students')::int+1));
  end if;
  if not exists(select 1 from public.student_enrollments where school_id=p_school_id and student_id=st and academic_year_id=y) then
   insert into public.student_enrollments(school_id,student_id,academic_year_id,grade_id,section_id,roll_number,status) values(p_school_id,st,y,g,s,nullif(trim(r->>'roll_number'),''),'active');
   counts:=jsonb_set(counts,'{enrollments}',to_jsonb((counts->>'enrollments')::int+1));
  end if;
  n:=nullif(trim(coalesce(r->>'guardian_name','')),'');
  if n is not null then
   e:=nullif(lower(trim(coalesce(r->>'guardian_email',''))),''); ph:=nullif(trim(coalesce(r->>'guardian_phone','')),'');
   select id into gd from public.guardians where school_id=p_school_id and ((e is not null and lower(coalesce(email,''))=e) or (e is null and ph is not null and coalesce(phone,'')=ph)) limit 1;
   if gd is null then insert into public.guardians(school_id,full_name,relationship,phone,email,address) values(p_school_id,n,nullif(trim(r->>'guardian_relationship'),''),ph,e,'{}'::jsonb) returning id into gd; counts:=jsonb_set(counts,'{guardians}',to_jsonb((counts->>'guardians')::int+1)); end if;
   insert into public.student_guardians(student_id,guardian_id,is_primary) values(st,gd,coalesce(nullif(r->>'guardian_primary','')::boolean,true)) on conflict(student_id,guardian_id) do nothing;
   counts:=jsonb_set(counts,'{guardian_links}',to_jsonb((counts->>'guardian_links')::int+1));
  end if;
  e:=nullif(lower(trim(coalesce(r->>'teacher_email',''))),'');
  if e is not null then
   select id into staff from public.staff_members where school_id=p_school_id and lower(coalesce(email,''))=e limit 1;
   if staff is null then
    insert into public.staff_members(school_id,employee_number,first_name,last_name,email,phone,designation,department,employment_type,joining_date)
    values(p_school_id,coalesce(nullif(trim(r->>'teacher_employee_number'),''),'IMP-'||substr(md5(e),1,8)),coalesce(nullif(trim(r->>'teacher_first_name'),''),split_part(r->>'teacher_name',' ',1)),nullif(trim(r->>'teacher_last_name'),''),e,nullif(trim(r->>'teacher_phone'),''),coalesce(nullif(trim(r->>'teacher_designation'),''),'Teacher'),nullif(trim(r->>'teacher_department'),''),coalesce(nullif(trim(r->>'teacher_employment_type'),''),'full_time'),coalesce(nullif(r->>'teacher_joining_date','')::date,current_date)) returning id into staff;
    counts:=jsonb_set(counts,'{teachers}',to_jsonb((counts->>'teachers')::int+1));
   end if;
  end if;
 end loop;
 insert into public.audit_logs(school_id,actor_user_id,action,entity_type,metadata) values(p_school_id,p_actor_user_id,'school.bulk_import','school',counts);
 return counts;
end;
$$;
revoke all on function public.import_school_setup(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.import_school_setup(uuid,uuid,jsonb) to service_role;