-- Production private-schema function snapshot; generated 2026-09-22.
-- DATA-FREE.

CREATE OR REPLACE FUNCTION private.actor_has_permission(p_actor_user_id uuid, p_permission text, p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.school_memberships sm
    join public.user_roles ur on ur.user_id=sm.user_id and ur.school_id=sm.school_id
    join public.roles r on r.id=ur.role_id
    join public.role_permissions rp on rp.role_id=r.id
    join public.permissions p on p.id=rp.permission_id
    where sm.user_id=p_actor_user_id and sm.school_id=p_school_id and sm.status='active'
      and p.key=p_permission and r.key not in ('parent','student')
  );
$function$


CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin insert into public.user_profiles(user_id,full_name,metadata) values (new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),jsonb_build_object('auth_created_at',new.created_at)) on conflict (user_id) do update set full_name=coalesce(excluded.full_name,public.user_profiles.full_name),updated_at=now(); return new; end; $function$


CREATE OR REPLACE FUNCTION private.has_permission(target_permission text, target_organization uuid DEFAULT NULL::uuid, target_school uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id where ur.user_id=(select auth.uid()) and p.key=target_permission and ((target_school is not null and ur.school_id=target_school) or (target_school is null and target_organization is not null and ur.organization_id=target_organization) or (target_school is null and target_organization is null and ur.organization_id is null and ur.school_id is null))); $function$


CREATE OR REPLACE FUNCTION private.has_staff_permission(p_permission text, p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.actor_has_permission((select auth.uid()), p_permission, p_school_id);
$function$


CREATE OR REPLACE FUNCTION private.is_org_member(target_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.organization_memberships om where om.organization_id = target_org and om.user_id = (select auth.uid()) and om.status = 'active');
$function$


CREATE OR REPLACE FUNCTION private.is_school_member(target_school uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.school_memberships sm where sm.school_id = target_school and sm.user_id = (select auth.uid()) and sm.status = 'active');
$function$

