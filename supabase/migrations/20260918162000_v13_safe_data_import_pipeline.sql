-- V13 safe data import pipeline
-- Stage and validate workbook rows before any production write.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  academic_year_id uuid null references public.academic_years(id),
  source_filename text not null,
  source_type text not null default 'xlsx' check (source_type in ('xlsx','csv','json')),
  status text not null default 'staged' check (status in ('staged','validated','ready','committed','failed','cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  committed_rows integer not null default 0 check (committed_rows >= 0),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  committed_at timestamptz
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','valid','invalid','skipped','imported')),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(batch_id,row_number)
);

create index if not exists import_batches_school_created_idx on public.import_batches(school_id,created_at desc);
create index if not exists import_rows_batch_status_idx on public.import_rows(batch_id,status,row_number);

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
revoke all on public.import_batches from anon,authenticated;

insert into public.permissions(key,name,module,action,description)
values ('data.import','Data Import','data','import','Stage, validate and commit school data imports')
on conflict (key) do update set name=excluded.name,module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('super_admin','organization_admin','admin','principal','vice_principal')
and p.key='data.import'
and not exists(select 1 from public.role_permissions rp where rp.role_id=r.id and rp.permission_id=p.id);

-- The four RPC definitions below are the authoritative V13 execution path.
-- They are SECURITY DEFINER, search_path-pinned, permission-checked and service-role-only.
-- Full definitions are kept in the deployed migration history; this file is the reproducible source artifact.

create or replace function public.create_import_batch(p_actor_user_id uuid,p_school_id uuid,p_source_filename text,p_source_type text default 'xlsx',p_academic_year_id uuid default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if length(btrim(coalesce(p_source_filename,''))) < 1 then raise exception 'Source filename is required'; end if;
 if p_source_type not in ('xlsx','csv','json') then raise exception 'Unsupported source type'; end if;
 if p_academic_year_id is not null and not exists(select 1 from public.academic_years ay where ay.id=p_academic_year_id and ay.school_id=p_school_id) then raise exception 'Academic year does not belong to this school'; end if;
 insert into public.import_batches(school_id,created_by,academic_year_id,source_filename,source_type)
 values(p_school_id,p_actor_user_id,p_academic_year_id,btrim(p_source_filename),p_source_type) returning id into v_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.create','import_batch',v_id,jsonb_build_object('source_filename',btrim(p_source_filename),'source_type',p_source_type)
 from public.schools s where s.id=p_school_id;
 return v_id;
end; $$;

create or replace function public.stage_import_rows(p_actor_user_id uuid,p_school_id uuid,p_batch_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_total integer;
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>10000 then raise exception 'Rows must be an array of at most 10000 rows'; end if;
 if not exists(select 1 from public.import_batches where id=p_batch_id and school_id=p_school_id and status in ('staged','validated')) then raise exception 'Import batch is not editable'; end if;
 delete from public.import_rows where batch_id=p_batch_id;
 insert into public.import_rows(batch_id,row_number,raw_data,normalized_data)
 select p_batch_id,(x->>'row_number')::integer,coalesce(x->'raw_data','{}'::jsonb),coalesce(x->'normalized_data','{}'::jsonb)
 from jsonb_array_elements(p_rows) x;
 select count(*) into v_total from public.import_rows where batch_id=p_batch_id;
 update public.import_batches set total_rows=v_total,valid_rows=0,invalid_rows=0,skipped_rows=0,committed_rows=0,status='staged',validated_at=null,committed_at=null where id=p_batch_id;
 return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total);
end; $$;

create or replace function public.validate_import_batch(p_actor_user_id uuid,p_school_id uuid,p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r record; v_errors jsonb; v_valid integer:=0; v_invalid integer:=0; v_total integer:=0;
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 if not exists(select 1 from public.import_batches where id=p_batch_id and school_id=p_school_id and status in ('staged','validated','ready')) then raise exception 'Import batch not found'; end if;
 for r in select * from public.import_rows where batch_id=p_batch_id order by row_number loop
  select coalesce(jsonb_agg(msg),'[]'::jsonb) into v_errors from (
   select 'Student name is required'::text msg where nullif(btrim(r.normalized_data->>'name'),'') is null
   union all select 'Class is required' where nullif(btrim(r.normalized_data->>'class'),'') is null
   union all select 'Father name is required' where nullif(btrim(r.normalized_data->>'father_name'),'') is null
   union all select 'Mobile number is required' where nullif(regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'),'') is null
   union all select 'Mobile number must contain 10 digits' where nullif(regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'),'') is not null and length(regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g'))<>10
   union all select 'Class is not configured in this school' where not exists(select 1 from public.grades g where g.school_id=p_school_id and lower(btrim(g.name))=lower(btrim(r.normalized_data->>'class')))
   union all select 'Duplicate student in this import' where exists(select 1 from public.import_rows d where d.batch_id=r.batch_id and d.id<>r.id and lower(btrim(d.normalized_data->>'name'))=lower(btrim(r.normalized_data->>'name')) and regexp_replace(coalesce(d.normalized_data->>'mobile',''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'))
   union all select 'Student already exists with the same name and mobile' where exists(select 1 from public.students s where s.school_id=p_school_id and lower(btrim(concat_ws(' ',s.first_name,s.middle_name,s.last_name)))=lower(btrim(r.normalized_data->>'name')) and regexp_replace(coalesce(s.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g'))
  ) q;
  update public.import_rows set errors=v_errors,status=case when jsonb_array_length(v_errors)=0 then 'valid' else 'invalid' end where id=r.id;
 end loop;
 select count(*) filter(where status='valid'),count(*) filter(where status='invalid'),count(*) into v_valid,v_invalid,v_total from public.import_rows where batch_id=p_batch_id;
 update public.import_batches set valid_rows=v_valid,invalid_rows=v_invalid,status=case when v_invalid=0 and v_valid>0 then 'ready' else 'validated' end,validated_at=now() where id=p_batch_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.validate','import_batch',p_batch_id,jsonb_build_object('total_rows',v_total,'valid_rows',v_valid,'invalid_rows',v_invalid)
 from public.schools s where s.id=p_school_id;
 return jsonb_build_object('batch_id',p_batch_id,'total_rows',v_total,'valid_rows',v_valid,'invalid_rows',v_invalid);
end; $$;

create or replace function public.commit_import_batch(p_actor_user_id uuid,p_school_id uuid,p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r record; v_guardian uuid; v_student uuid; v_grade uuid; v_section uuid; v_ay uuid; v_imported integer:=0; v_skipped integer:=0; v_name text; v_first text; v_last text; v_parts text[];
begin
 if not private.actor_has_permission(p_actor_user_id,'data.import',p_school_id) then raise exception 'Data import access denied'; end if;
 select academic_year_id into v_ay from public.import_batches where id=p_batch_id and school_id=p_school_id and status='ready';
 if not found or v_ay is null then raise exception 'Import batch is not ready to commit with an academic year'; end if;
 for r in select * from public.import_rows where batch_id=p_batch_id and status='valid' order by row_number loop
  v_name:=btrim(r.normalized_data->>'name'); v_parts:=string_to_array(v_name,' '); v_first:=v_parts[1]; v_last:=case when array_length(v_parts,1)>1 then array_to_string(v_parts[2:array_length(v_parts,1)],' ') else null end;
  select s.id into v_student from public.students s where s.school_id=p_school_id and lower(btrim(concat_ws(' ',s.first_name,s.middle_name,s.last_name)))=lower(v_name) and regexp_replace(coalesce(s.phone,''),'[^0-9]','','g')=regexp_replace(coalesce(r.normalized_data->>'mobile',''),'[^0-9]','','g') limit 1;
  if v_student is not null then update public.import_rows set status='skipped',errors=jsonb_build_array('Student already exists') where id=r.id; v_skipped:=v_skipped+1; continue; end if;
  select id into v_grade from public.grades where school_id=p_school_id and lower(btrim(name))=lower(btrim(r.normalized_data->>'class')) limit 1;
  if v_grade is null then raise exception 'Class is not configured in this school'; end if;
  select id into v_section from public.sections where school_id=p_school_id and grade_id=v_grade order by created_at limit 1;
  insert into public.students(school_id,admission_number,first_name,last_name,phone,status,metadata)
  values(p_school_id,'IMP-'||upper(substr(replace(p_batch_id::text,'-',''),1,8))||'-'||r.row_number,v_first,v_last,regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g'),'active',jsonb_build_object('import_batch_id',p_batch_id,'source_row',r.row_number,'source_name',v_name))
  returning id into v_student;
  select id into v_guardian from public.guardians where school_id=p_school_id and regexp_replace(coalesce(phone,''),'[^0-9]','','g')=regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g') limit 1;
  if v_guardian is null then insert into public.guardians(school_id,full_name,relationship,phone,address) values(p_school_id,btrim(r.normalized_data->>'father_name'),'father',regexp_replace(r.normalized_data->>'mobile','[^0-9]','','g'),'{}'::jsonb) returning id into v_guardian; end if;
  insert into public.student_guardians(student_id,guardian_id,is_primary) values(v_student,v_guardian,true) on conflict (student_id,guardian_id) do update set is_primary=excluded.is_primary;
  insert into public.student_enrollments(school_id,student_id,academic_year_id,grade_id,section_id,status) values(p_school_id,v_student,v_ay,v_grade,v_section,'active');
  update public.import_rows set status='imported',errors='[]'::jsonb where id=r.id; v_imported:=v_imported+1;
 end loop;
 update public.import_batches set status='committed',committed_rows=v_imported,skipped_rows=v_skipped,committed_at=now() where id=p_batch_id;
 insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
 select s.organization_id,p_school_id,p_actor_user_id,'data.import.commit','import_batch',p_batch_id,jsonb_build_object('committed_rows',v_imported,'skipped_rows',v_skipped)
 from public.schools s where s.id=p_school_id;
 return jsonb_build_object('batch_id',p_batch_id,'committed_rows',v_imported,'skipped_rows',v_skipped);
end; $$;

revoke execute on function public.create_import_batch(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke execute on function public.stage_import_rows(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.validate_import_batch(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.commit_import_batch(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_import_batch(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.stage_import_rows(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.validate_import_batch(uuid,uuid,uuid) to service_role;
grant execute on function public.commit_import_batch(uuid,uuid,uuid) to service_role;
