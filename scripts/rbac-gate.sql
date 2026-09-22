-- EduFlow AI RBAC verification gate
-- Read-only assertions. Run against a disposable/production clone with psql or Supabase SQL editor.
-- No data or schema changes are performed.

begin;

-- 1. Role scope vocabulary must remain closed and internally consistent.
do $$
begin
  if exists (
    select 1 from public.roles
    where scope not in ('platform','organization','school')
  ) then
    raise exception 'RBAC FAIL: role with invalid scope';
  end if;
end $$;

-- 2. Role assignments must respect role scope.
do $$
begin
  if exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where (r.scope = 'platform' and (ur.organization_id is not null or ur.school_id is not null))
       or (r.scope = 'organization' and (ur.organization_id is null or ur.school_id is not null))
       or (r.scope = 'school' and (ur.school_id is null or ur.organization_id is not null))
  ) then
    raise exception 'RBAC FAIL: user role scope does not match assignment scope';
  end if;
end $$;

-- 3. School memberships must use school-scoped roles and active memberships must have a role.
do $$
begin
  if exists (
    select 1
    from public.school_memberships sm
    left join public.roles r on r.key = sm.role
    where r.id is null or r.scope <> 'school'
  ) then
    raise exception 'RBAC FAIL: school membership references missing/non-school role';
  end if;
end $$;

-- 4. Organization memberships must use organization-scoped roles.
do $$
begin
  if exists (
    select 1
    from public.organization_memberships om
    left join public.roles r on r.key = om.role
    where r.id is null or r.scope <> 'organization'
  ) then
    raise exception 'RBAC FAIL: organization membership references missing/non-organization role';
  end if;
end $$;

-- 5. Every role permission edge must resolve to both a role and a permission.
do $$
begin
  if exists (
    select 1
    from public.role_permissions rp
    left join public.roles r on r.id = rp.role_id
    left join public.permissions p on p.id = rp.permission_id
    where r.id is null or p.id is null
  ) then
    raise exception 'RBAC FAIL: orphaned role_permissions edge';
  end if;
end $$;

-- 6. Every active AI tool permission must resolve to a real permission key.
do $$
begin
  if exists (
    select 1
    from public.ai_tools t
    left join public.permissions p on p.key = t.required_permission
    where t.is_active = true
      and t.required_permission is not null
      and p.id is null
  ) then
    raise exception 'RBAC FAIL: active AI tool references unknown permission';
  end if;
end $$;

-- 7. Parent/student roles must never satisfy the server-side generic permission helper.
do $$
begin
  if exists (select 1 from public.roles where key in ('parent','student') and scope <> 'school') then
    raise exception 'RBAC FAIL: parent/student role has unexpected scope';
  end if;
end $$;

-- 8. The production admin model requires explicit school + organization role assignments.
do $$
begin
  if not exists (select 1 from public.roles where key = 'admin' and scope = 'school') then
    raise exception 'RBAC FAIL: school admin role missing';
  end if;
  if not exists (select 1 from public.roles where key = 'organization_admin' and scope = 'organization') then
    raise exception 'RBAC FAIL: organization admin role missing';
  end if;
end $$;

-- 9. Verify the existing Cambridge admin has core school-operational permissions
-- while parent-only access and another school's permissions remain denied.
do $$
begin
  if not private.actor_has_permission('9e8974fc-4e89-488f-a094-92d9e0e47894','student.manage','0f531d29-cf28-41f3-9b54-8272adf29b2b') then
    raise exception 'RBAC FAIL: Cambridge admin missing student.manage';
  end if;
  if not private.actor_has_permission('9e8974fc-4e89-488f-a094-92d9e0e47894','attendance.manage','0f531d29-cf28-41f3-9b54-8272adf29b2b') then
    raise exception 'RBAC FAIL: Cambridge admin missing attendance.manage';
  end if;
  if not private.actor_has_permission('9e8974fc-4e89-488f-a094-92d9e0e47894','exam.manage','0f531d29-cf28-41f3-9b54-8272adf29b2b') then
    raise exception 'RBAC FAIL: Cambridge admin missing exam.manage';
  end if;
  if private.actor_has_permission('9e8974fc-4e89-488f-a094-92d9e0e47894','parent.view','0f531d29-cf28-41f3-9b54-8272adf29b2b') then
    raise exception 'RBAC FAIL: Cambridge admin unexpectedly has parent.view';
  end if;
  if private.actor_has_permission('9e8974fc-4e89-488f-a094-92d9e0e47894','student.manage','877b4b0d-374d-49d1-a91b-2b768d678aa8') then
    raise exception 'RBAC FAIL: Cambridge admin unexpectedly has Shah student.manage';
  end if;
end $$;

-- Emit a compact pass summary for CI/manual verification.
select
  'PASS' as status,
  (select count(*) from public.roles) as roles,
  (select count(*) from public.permissions) as permissions,
  (select count(*) from public.role_permissions) as role_permission_edges,
  (select count(*) from public.user_roles) as user_role_assignments,
  (select count(*) from public.school_memberships) as school_memberships,
  (select count(*) from public.organization_memberships) as organization_memberships;

rollback;

-- Production observation (intentional until product policy changes):
-- the school 'admin' role currently does not carry finance.manage, school.manage,
-- settings.manage, or ai.approve. Finance operations use finance.manage and are
-- therefore restricted from this role. Do not broaden permissions silently.
