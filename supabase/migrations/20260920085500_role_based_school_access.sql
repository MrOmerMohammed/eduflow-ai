-- EduFlow AI role-based school access
insert into public.roles(key,name,scope,description,is_system)
values ('staff','Staff','school','Operational school staff with read access to core school data and notifications.',true)
on conflict(key) do update set name=excluded.name,description=excluded.description,is_system=true;

delete from public.role_permissions rp using public.roles r, public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id and r.key='teacher'
  and p.key in ('staff.manage','staff.view','finance.manage','finance.view','data.import','analytics.view','student.manage','ai.manage','school.manage','settings.manage');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key='staff'
  and p.key in ('dashboard.view','student.view','academic.view','attendance.view','communication.view','notification.view')
on conflict do nothing;

create or replace function public.assign_school_role(
  p_actor_user_id uuid,
  p_school_id uuid,
  p_target_user_id uuid,
  p_role_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_role_id uuid;
  v_actor_ok boolean;
  v_role_name text;
begin
  if p_actor_user_id is null or p_target_user_id is null then raise exception 'User is required'; end if;
  if p_role_key not in ('admin','teacher','staff') then raise exception 'Invalid school role'; end if;

  select s.organization_id into v_org_id
  from public.schools s
  where s.id=p_school_id and s.status='active';
  if v_org_id is null then raise exception 'School not found or inactive'; end if;

  select exists(
    select 1 from public.school_memberships sm
    where sm.school_id=p_school_id
      and sm.user_id=p_actor_user_id
      and sm.status='active'
      and sm.role='admin'
  ) into v_actor_ok;
  if not v_actor_ok then raise exception 'Only school administrators can assign roles'; end if;

  select r.id,r.name into v_role_id,v_role_name
  from public.roles r
  where r.key=p_role_key and r.scope='school' and r.is_system=true;
  if v_role_id is null then raise exception 'School role is not configured'; end if;

  insert into public.school_memberships(school_id,user_id,role,status)
  values(p_school_id,p_target_user_id,p_role_key,'active')
  on conflict(school_id,user_id)
  do update set role=excluded.role,status='active';

  delete from public.user_roles
  where user_id=p_target_user_id and school_id=p_school_id;

  insert into public.user_roles(user_id,role_id,organization_id,school_id)
  values(p_target_user_id,v_role_id,null,p_school_id);

  update public.staff_members
  set user_id=p_target_user_id,updated_at=now()
  where school_id=p_school_id
    and lower(email)=lower((select email from auth.users where id=p_target_user_id));

  insert into public.audit_logs(organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(v_org_id,p_school_id,p_actor_user_id,'school.role.assign','user',p_target_user_id,
         jsonb_build_object('role',p_role_key,'role_name',v_role_name));

  return jsonb_build_object(
    'user_id',p_target_user_id,
    'school_id',p_school_id,
    'role',p_role_key,
    'role_name',v_role_name
  );
end;
$$;

revoke all on function public.assign_school_role(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.assign_school_role(uuid,uuid,uuid,text) to service_role;
