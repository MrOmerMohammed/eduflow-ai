-- Align the school admin role with the Finance module exposed in the admin UI.
-- Finance RPCs authorize through private.actor_has_permission(..., 'finance.manage', ...).
-- The admin navigation already exposes /finance, so admin must have the
-- corresponding read/write finance permissions.

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
  and p.key in ('finance.view', 'finance.manage')
on conflict (role_id, permission_id) do nothing;
