-- Make initial workspace creation safe to retry.
-- The bootstrap flow is pre-school-scoped, so it must never require schoolId.
-- If a user already has an active school membership, return that workspace
-- instead of creating a second organization/school during a retry or race.

create or replace function public.bootstrap_school_workspace(
  p_actor_user_id uuid,
  p_org_name text,
  p_school_name text,
  p_school_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org_id uuid;
  v_school_id uuid;
  v_existing_school_id uuid;
  v_org_role_id uuid;
  v_admin_role_id uuid;
  v_slug text;
  v_full_name text;
  v_existing_role text;
  v_existing_school_name text;
  v_existing_school_code text;
begin
  if p_actor_user_id is null then raise exception 'Actor is required'; end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id) then raise exception 'Actor not found'; end if;
  if nullif(trim(p_org_name), '') is null or nullif(trim(p_school_name), '') is null or nullif(trim(p_school_code), '') is null then
    raise exception 'Organization name, school name and school code are required';
  end if;

  select sm.school_id, sm.role
    into v_existing_school_id, v_existing_role
    from public.school_memberships sm
   where sm.user_id = p_actor_user_id
     and sm.status = 'active'
   limit 1;

  if v_existing_school_id is not null then
    if v_existing_role <> 'admin' then
      raise exception 'User already belongs to a school workspace';
    end if;

    select s.organization_id, s.name, s.code
      into v_org_id, v_existing_school_name, v_existing_school_code
      from public.schools s
     where s.id = v_existing_school_id
       and s.status = 'active';

    if v_org_id is null then
      raise exception 'Existing school workspace is not active';
    end if;

    return jsonb_build_object(
      'organization_id', v_org_id,
      'school_id', v_existing_school_id,
      'organization_name', (select o.name from public.organizations o where o.id = v_org_id),
      'school_name', v_existing_school_name,
      'school_code', v_existing_school_code
    );
  end if;

  select coalesce(nullif(raw_user_meta_data->>'full_name',''), email)
    into v_full_name
    from auth.users
   where id = p_actor_user_id;

  v_slug := lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'organization'; end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
  end if;

  select id into v_org_role_id
    from public.roles
   where key = 'organization_admin' and is_system = true
   limit 1;
  select id into v_admin_role_id
    from public.roles
   where key = 'admin' and is_system = true
   limit 1;
  if v_org_role_id is null or v_admin_role_id is null then
    raise exception 'Required system roles are not configured';
  end if;

  insert into public.organizations(name, slug, status)
  values (trim(p_org_name), v_slug, 'active')
  returning id into v_org_id;

  insert into public.schools(organization_id, name, code, address, settings, status)
  values (v_org_id, trim(p_school_name), upper(trim(p_school_code)), '{}'::jsonb, '{}'::jsonb, 'active')
  returning id into v_school_id;

  insert into public.organization_memberships(organization_id, user_id, role, status)
  values (v_org_id, p_actor_user_id, 'organization_admin', 'active');

  insert into public.school_memberships(school_id, user_id, role, status)
  values (v_school_id, p_actor_user_id, 'admin', 'active');

  insert into public.user_roles(user_id, role_id, organization_id, school_id)
  values
    (p_actor_user_id, v_org_role_id, v_org_id, null),
    (p_actor_user_id, v_admin_role_id, null, v_school_id);

  insert into public.user_profiles(user_id, full_name)
  values (p_actor_user_id, coalesce(v_full_name, trim(p_org_name)))
  on conflict(user_id) do update
    set full_name = coalesce(public.user_profiles.full_name, excluded.full_name),
        updated_at = now();

  insert into public.audit_logs(organization_id, school_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_org_id, v_school_id, p_actor_user_id, 'workspace.bootstrap', 'school', v_school_id,
    jsonb_build_object(
      'organization_name', trim(p_org_name),
      'school_name', trim(p_school_name),
      'school_code', upper(trim(p_school_code))
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'school_id', v_school_id,
    'organization_name', trim(p_org_name),
    'school_name', trim(p_school_name),
    'school_code', upper(trim(p_school_code))
  );
end;
$function$;

revoke execute on function public.bootstrap_school_workspace(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_school_workspace(uuid, text, text, text) to service_role;
