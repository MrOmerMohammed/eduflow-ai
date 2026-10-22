-- Seed required system roles and least-privilege permissions.
-- The schema baseline intentionally contains no tenant data, but workspace bootstrap
-- cannot run until these system records exist.
INSERT INTO public.roles (key, name, scope, description, is_system)
VALUES
  ('organization_admin', 'Organization Administrator', 'organization', 'Manages organization-level settings and school workspaces.', true),
  ('admin', 'School Administrator', 'school', 'Full administrative control for one school.', true),
  ('principal', 'Principal', 'school', 'Leads academic and school operations.', true),
  ('vice_principal', 'Vice Principal', 'school', 'Supports academic and operational management.', true),
  ('teacher', 'Teacher', 'school', 'Manages assigned teaching and attendance workflows.', true),
  ('staff', 'School Staff', 'school', 'Performs permitted administrative support workflows.', true),
  ('parent', 'Parent / Guardian', 'school', 'Accesses only linked student and guardian workflows.', true),
  ('student', 'Student', 'school', 'Accesses only permitted student workflows.', true),
  ('super_admin', 'Platform Administrator', 'platform', 'Platform-level operator role.', true)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    scope = EXCLUDED.scope,
    description = EXCLUDED.description,
    is_system = true;

INSERT INTO public.permissions (key, name, module, action, description)
VALUES
  ('student.view', 'View students', 'students', 'view', 'View student records in an authorized school.'),
  ('student.manage', 'Manage students', 'students', 'manage', 'Create and update student records and enrollment.'),
  ('academic.manage', 'Manage academics', 'academics', 'manage', 'Manage academic years, grades, sections, subjects and curriculum.'),
  ('attendance.view', 'View attendance', 'attendance', 'view', 'View attendance rosters and summaries.'),
  ('attendance.manage', 'Manage attendance', 'attendance', 'manage', 'Record and update attendance.'),
  ('exam.view', 'View exams', 'exams', 'view', 'View exams and results.'),
  ('exam.manage', 'Manage exams', 'exams', 'manage', 'Create exams and save results.'),
  ('finance.view', 'View finance', 'finance', 'view', 'View fee balances and finance records.'),
  ('finance.manage', 'Manage finance', 'finance', 'manage', 'Manage fee structures, invoices and payments.'),
  ('staff.view', 'View staff', 'staff', 'view', 'View staff records.'),
  ('staff.manage', 'Manage staff', 'staff', 'manage', 'Manage staff records and staff workflows.'),
  ('communication.view', 'View communication', 'communication', 'view', 'View communication campaigns.'),
  ('communication.send', 'Send communication', 'communication', 'send', 'Create and send school communications.'),
  ('notification.view', 'View notifications', 'notifications', 'view', 'View and acknowledge notifications.'),
  ('notification.manage', 'Manage notifications', 'notifications', 'manage', 'Manage notification preferences and delivery settings.'),
  ('data.import', 'Import data', 'imports', 'import', 'Preview, validate and commit school data imports.'),
  ('management.view', 'View management analytics', 'analytics', 'view', 'View management dashboards and KPIs.'),
  ('ai.use', 'Use AI assistant', 'ai', 'use', 'Use authorized AI assistant capabilities.'),
  ('ai.manage', 'Manage AI tools', 'ai', 'manage', 'Configure AI tools and permissions.')
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    action = EXCLUDED.action,
    description = EXCLUDED.description;

WITH role_permission_map(role_key, permission_key) AS (
  SELECT 'admin', p.key FROM public.permissions p
  UNION ALL SELECT 'principal', p.key FROM public.permissions p
    WHERE p.key IN ('student.view','student.manage','academic.manage','attendance.view','attendance.manage','exam.view','exam.manage','finance.view','finance.manage','staff.view','staff.manage','communication.view','communication.send','notification.view','notification.manage','data.import','management.view','ai.use')
  UNION ALL SELECT 'vice_principal', p.key FROM public.permissions p
    WHERE p.key IN ('student.view','student.manage','academic.manage','attendance.view','attendance.manage','exam.view','exam.manage','finance.view','staff.view','communication.view','communication.send','notification.view','management.view','ai.use')
  UNION ALL SELECT 'teacher', p.key FROM public.permissions p
    WHERE p.key IN ('student.view','academic.manage','attendance.view','attendance.manage','exam.view','communication.view','notification.view','ai.use')
  UNION ALL SELECT 'staff', p.key FROM public.permissions p
    WHERE p.key IN ('student.view','attendance.view','staff.view','communication.view','notification.view')
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_map m
JOIN public.roles r ON r.key = m.role_key AND r.is_system = true
JOIN public.permissions p ON p.key = m.permission_key
ON CONFLICT (role_id, permission_id) DO NOTHING;
