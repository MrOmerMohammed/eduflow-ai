-- Security and data-integrity hardening applied to the live Supabase project.
-- This migration documents the live definitions so future environments reproduce them.

create or replace function private.actor_has_permission(p_actor_user_id uuid, p_permission text, p_school_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
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
$function$;

-- Exam/timetable/finance function definitions were hardened in the live database
-- with the same checks described below:
-- * exam academic year must belong to the school
-- * exam max/pass marks must be valid
-- * result enrollment must belong to the exam academic year
-- * timetable teacher must have an active school membership
-- * timetable day/period/time values must be valid
-- * fee assignment enrollment and fee structure must use the same academic year
-- * invoice payment locks the invoice row before calculating outstanding balance


-- Performance hardening.
drop policy if exists school_onboarding_admin_select on public.school_onboarding_profiles;
create policy school_onboarding_admin_select on public.school_onboarding_profiles for select to authenticated
using (exists (select 1 from public.school_memberships sm where sm.school_id=school_onboarding_profiles.school_id and sm.user_id=(select auth.uid()) and sm.status='active' and sm.role='admin'));
create index if not exists school_database_provisioning_organization_id_idx on public.school_database_provisioning(organization_id);
