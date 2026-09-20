-- Allow school administrators to resume onboarding safely
grant select on table public.school_onboarding_profiles to authenticated;

drop policy if exists school_onboarding_admin_select on public.school_onboarding_profiles;
create policy school_onboarding_admin_select on public.school_onboarding_profiles
for select to authenticated
using (
  exists (
    select 1
    from public.school_memberships sm
    where sm.school_id = school_onboarding_profiles.school_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
      and sm.role = 'admin'
  )
);
