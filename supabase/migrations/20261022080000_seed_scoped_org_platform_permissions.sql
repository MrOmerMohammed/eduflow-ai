-- Add scoped organization/platform permissions without granting them to school staff.
INSERT INTO public.permissions (key, name, module, action, description)
VALUES
  ('organization.view', 'View organization', 'organization', 'view', 'View organization-level settings and associated schools.'),
  ('organization.manage', 'Manage organization', 'organization', 'manage', 'Update organization-level settings and membership.'),
  ('school.view', 'View school settings', 'school', 'view', 'View school configuration.'),
  ('school.manage', 'Manage school settings', 'school', 'manage', 'Update school configuration.'),
  ('school.create', 'Create school', 'school', 'create', 'Create a school under an authorized organization.'),
  ('platform.manage', 'Manage platform', 'platform', 'manage', 'Perform authorized platform administration.'),
  ('platform.audit', 'View platform audit', 'platform', 'audit', 'Review platform-level audit records.')
ON CONFLICT (key) DO UPDATE
SET name=EXCLUDED.name,module=EXCLUDED.module,action=EXCLUDED.action,description=EXCLUDED.description;

WITH mapping(role_key, permission_key) AS (
  SELECT 'organization_admin', p.key FROM public.permissions p
    WHERE p.key IN ('organization.view','organization.manage','school.view','school.manage','school.create')
  UNION ALL
  SELECT 'admin', p.key FROM public.permissions p WHERE p.key IN ('school.view','school.manage')
  UNION ALL
  SELECT 'principal', p.key FROM public.permissions p WHERE p.key IN ('school.view')
  UNION ALL
  SELECT 'super_admin', p.key FROM public.permissions p
    WHERE p.key IN ('organization.view','organization.manage','school.view','school.manage','school.create','platform.manage','platform.audit')
)
INSERT INTO public.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM mapping m
JOIN public.roles r ON r.key=m.role_key AND r.is_system=true
JOIN public.permissions p ON p.key=m.permission_key
ON CONFLICT(role_id,permission_id) DO NOTHING;
