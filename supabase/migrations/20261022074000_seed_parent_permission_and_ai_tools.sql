-- Complete the parent portal permission and register the built-in read-only AI tools.
INSERT INTO public.permissions (key, name, module, action, description)
VALUES
  ('parent.view', 'View linked student portal', 'parent', 'view', 'View only students explicitly linked to the authenticated guardian.')
ON CONFLICT (key) DO UPDATE
SET name=EXCLUDED.name, module=EXCLUDED.module, action=EXCLUDED.action, description=EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key='parent.view'
WHERE r.key='parent' AND r.is_system=true
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.ai_tools
  (organization_id, name, slug, description, input_schema, risk_level, required_permission, handler_key, is_active)
SELECT
  NULL, t.name, t.slug, t.description, t.input_schema::jsonb, 'read', t.required_permission, t.handler_key, true
FROM (VALUES
  ('Student search', 'student.search', 'Find students in the active school workspace.', '{"type":"object"}', 'student.view', 'student_search'),
  ('Student record', 'student.get', 'Retrieve one student record and current enrollment.', '{"type":"object"}', 'student.view', 'student_get'),
  ('Student attendance', 'attendance.student', 'Review attendance for a student in this school.', '{"type":"object"}', 'attendance.view', 'attendance_student'),
  ('Student fee balance', 'finance.student_balance', 'Review fee invoices, payments and balance for a student.', '{"type":"object"}', 'finance.view', 'finance_student_balance'),
  ('Exam results', 'exam.results', 'Review exam marks and results for a student.', '{"type":"object"}', 'exam.view', 'exam_results'),
  ('Timetable lookup', 'timetable.lookup', 'Search the school timetable by subject, section or day.', '{"type":"object"}', 'academic.manage', 'timetable_lookup'),
  ('Management dashboard', 'management.dashboard', 'Return high-level counts for the active school.', '{"type":"object"}', 'management.view', 'management_dashboard')
) AS t(name, slug, description, input_schema, required_permission, handler_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_tools existing
  WHERE existing.organization_id IS NULL AND existing.slug=t.slug
);
