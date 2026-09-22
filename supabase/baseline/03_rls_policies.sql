-- Production RLS and policy snapshot; generated 2026-09-22.
-- DATA-FREE. Internal/server-controlled tables intentionally retain RLS with no client policies where applicable.

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_execution_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_execution_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_database_provisioning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_onboarding_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "authenticated can view permissions through own roles" ON public.permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (user_roles ur
     JOIN role_permissions rp ON ((rp.role_id = ur.role_id)))
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (rp.permission_id = permissions.id)))));
CREATE POLICY "authenticated can view role permissions through own roles" ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role_id = role_permissions.role_id)))));
CREATE POLICY "authenticated can view roles" ON public.roles AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_roles ur
  WHERE ((ur.user_id = ( SELECT auth.uid() AS uid)) AND (ur.role_id = roles.id)))));
CREATE POLICY "members read audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING (((actor_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_org_member(audit_logs.organization_id) AS is_org_member)));
CREATE POLICY "members read own ai action logs" ON public.ai_action_logs AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_org_member(ai_action_logs.organization_id) AS is_org_member)));
CREATE POLICY "org members read ai agents" ON public.ai_agents AS PERMISSIVE FOR SELECT TO authenticated USING (((organization_id IS NULL) OR ( SELECT private.is_org_member(ai_agents.organization_id) AS is_org_member)));
CREATE POLICY "org members read organization memberships" ON public.organization_memberships AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_org_member(organization_memberships.organization_id) AS is_org_member)));
CREATE POLICY "org members read organizations" ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.is_org_member(organizations.id) AS is_org_member));
CREATE POLICY "school members read academic years" ON public.academic_years AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.is_school_member(academic_years.school_id) AS is_school_member));
CREATE POLICY "school members read grades" ON public.grades AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.is_school_member(grades.school_id) AS is_school_member));
CREATE POLICY "school members read school memberships" ON public.school_memberships AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_school_member(school_memberships.school_id) AS is_school_member)));
CREATE POLICY "school members read schools" ON public.schools AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.is_school_member(schools.id) AS is_school_member));
CREATE POLICY "school members read sections" ON public.sections AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.is_school_member(sections.school_id) AS is_school_member));
CREATE POLICY "student permission read enrollments" ON public.student_enrollments AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.has_staff_permission('student.view'::text, student_enrollments.school_id) AS has_staff_permission));
CREATE POLICY "student permission read guardians" ON public.guardians AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.has_staff_permission('student.view'::text, guardians.school_id) AS has_staff_permission));
CREATE POLICY "student permission read student guardians" ON public.student_guardians AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_guardians.student_id) AND ( SELECT private.has_staff_permission('student.view'::text, s.school_id) AS has_staff_permission)))));
CREATE POLICY "student permission read students" ON public.students AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.has_staff_permission('student.view'::text, students.school_id) AS has_staff_permission));
CREATE POLICY "users create own ai conversations" ON public.ai_conversations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_org_member(ai_conversations.organization_id) AS is_org_member)));
CREATE POLICY "users create own ai messages" ON public.ai_messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "users delete own ai conversations" ON public.ai_conversations AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "users read own ai conversations" ON public.ai_conversations AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_org_member(ai_conversations.organization_id) AS is_org_member)));
CREATE POLICY "users read own ai messages" ON public.ai_messages AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ai_conversations c
  WHERE ((c.id = ai_messages.conversation_id) AND (c.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "users read own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "users update own ai conversations" ON public.ai_conversations AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.is_org_member(ai_conversations.organization_id) AS is_org_member)));
CREATE POLICY "users update own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY curriculum_units_school_member ON public.curriculum_units AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY exam_results_school_member ON public.exam_results AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY exam_subjects_school_member ON public.exam_subjects AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY exams_school_member ON public.exams AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY fee_invoice_items_finance_read ON public.fee_invoice_items AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.actor_has_permission(( SELECT auth.uid() AS uid), 'finance.view'::text, fee_invoice_items.school_id) AS actor_has_permission));
CREATE POLICY fee_invoices_finance_read ON public.fee_invoices AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.actor_has_permission(( SELECT auth.uid() AS uid), 'finance.view'::text, fee_invoices.school_id) AS actor_has_permission));
CREATE POLICY fee_payments_finance_read ON public.fee_payments AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.actor_has_permission(( SELECT auth.uid() AS uid), 'finance.view'::text, fee_payments.school_id) AS actor_has_permission));
CREATE POLICY fee_structures_finance_read ON public.fee_structures AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.actor_has_permission(( SELECT auth.uid() AS uid), 'finance.view'::text, fee_structures.school_id) AS actor_has_permission));
CREATE POLICY leave_request_delete ON public.leave_requests AS PERMISSIVE FOR DELETE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_request_insert ON public.leave_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_request_update ON public.leave_requests AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id)) WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_request_view ON public.leave_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((private.has_staff_permission('staff.view'::text, school_id) OR private.has_staff_permission('staff.manage'::text, school_id)));
CREATE POLICY leave_type_delete ON public.leave_types AS PERMISSIVE FOR DELETE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_type_insert ON public.leave_types AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_type_update ON public.leave_types AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id)) WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY leave_type_view ON public.leave_types AS PERMISSIVE FOR SELECT TO authenticated USING ((private.has_staff_permission('staff.view'::text, school_id) OR private.has_staff_permission('staff.manage'::text, school_id)));
CREATE POLICY lessons_school_member ON public.lessons AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY school_onboarding_admin_select ON public.school_onboarding_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM school_memberships sm
  WHERE ((sm.school_id = school_onboarding_profiles.school_id) AND (sm.user_id = ( SELECT auth.uid() AS uid)) AND (sm.status = 'active'::text) AND (sm.role = 'admin'::text)))));
CREATE POLICY staff_delete ON public.staff_members AS PERMISSIVE FOR DELETE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY staff_insert ON public.staff_members AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY staff_update ON public.staff_members AS PERMISSIVE FOR UPDATE TO authenticated USING (private.has_staff_permission('staff.manage'::text, school_id)) WITH CHECK (private.has_staff_permission('staff.manage'::text, school_id));
CREATE POLICY staff_view ON public.staff_members AS PERMISSIVE FOR SELECT TO authenticated USING ((private.has_staff_permission('staff.view'::text, school_id) OR private.has_staff_permission('staff.manage'::text, school_id)));
CREATE POLICY student_fee_assignments_finance_read ON public.student_fee_assignments AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT private.actor_has_permission(( SELECT auth.uid() AS uid), 'finance.view'::text, student_fee_assignments.school_id) AS actor_has_permission));
CREATE POLICY subjects_school_member ON public.subjects AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
CREATE POLICY timetable_school_member ON public.timetable_entries AS PERMISSIVE FOR ALL TO - USING (private.is_school_member(school_id)) WITH CHECK (private.is_school_member(school_id));
