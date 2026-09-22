-- EduFlow AI production schema baseline
-- Generated from Supabase production catalog on 2026-09-22.
-- DATA-FREE: schema only. Canonical baseline; not a historical migration replay.

create table if not exists public.academic_years (
  id uuid default gen_random_uuid(),
  school_id uuid,
  name text,
  start_date date,
  end_date date,
  is_current boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.ai_action_logs (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  school_id uuid,
  user_id uuid,
  agent_id uuid,
  action_name text,
  input jsonb default '{}'::jsonb,
  output jsonb,
  status text,
  created_at timestamp with time zone default now()
);

create table if not exists public.ai_agents (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  name text,
  slug text,
  description text,
  agent_type text,
  system_prompt text,
  config jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.ai_conversations (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  school_id uuid,
  user_id uuid,
  agent_id uuid,
  title text,
  context jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.ai_execution_runs (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  school_id uuid,
  user_id uuid,
  conversation_id uuid,
  request_text text,
  intent text,
  status text default 'planned'::text,
  idempotency_key text,
  plan jsonb default '{}'::jsonb,
  result jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone
);

create table if not exists public.ai_execution_steps (
  id uuid default gen_random_uuid(),
  run_id uuid,
  step_order integer,
  tool_slug text,
  handler_key text,
  risk_level text,
  input jsonb default '{}'::jsonb,
  status text default 'planned'::text,
  authz jsonb default '{}'::jsonb,
  output jsonb,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

create table if not exists public.ai_messages (
  id uuid default gen_random_uuid(),
  conversation_id uuid,
  role text,
  content text,
  tool_name text,
  tool_result jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.ai_tool_permissions (
  id uuid default gen_random_uuid(),
  tool_id uuid,
  role_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.ai_tools (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  name text,
  slug text,
  description text,
  input_schema jsonb default '{}'::jsonb,
  risk_level text default 'read'::text,
  required_permission text,
  handler_key text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.attendance_records (
  id uuid default gen_random_uuid(),
  session_id uuid,
  school_id uuid,
  student_id uuid,
  enrollment_id uuid,
  status text,
  remarks text,
  marked_by uuid,
  marked_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.attendance_sessions (
  id uuid default gen_random_uuid(),
  school_id uuid,
  academic_year_id uuid,
  section_id uuid,
  attendance_date date,
  status text default 'open'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.audit_logs (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  school_id uuid,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.communication_campaigns (
  id uuid default gen_random_uuid(),
  school_id uuid,
  created_by uuid,
  title text,
  body text,
  channel text,
  audience_type text,
  status text default 'draft'::text,
  target_student_ids uuid[],
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.communication_recipients (
  id uuid default gen_random_uuid(),
  campaign_id uuid,
  guardian_id uuid,
  staff_id uuid,
  delivery_status text default 'queued'::text,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone default now()
);

create table if not exists public.curriculum_units (
  id uuid default gen_random_uuid(),
  school_id uuid,
  grade_id uuid,
  subject_id uuid,
  name text,
  description text,
  sequence_no integer default 1,
  created_at timestamp with time zone default now()
);

create table if not exists public.exam_results (
  id uuid default gen_random_uuid(),
  school_id uuid,
  exam_subject_id uuid,
  enrollment_id uuid,
  marks numeric(8,2),
  grade text,
  remarks text,
  entered_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.exam_subjects (
  id uuid default gen_random_uuid(),
  school_id uuid,
  exam_id uuid,
  subject_id uuid,
  exam_date date,
  max_marks numeric(8,2) default 100,
  pass_marks numeric(8,2) default 35,
  created_at timestamp with time zone default now()
);

create table if not exists public.exams (
  id uuid default gen_random_uuid(),
  school_id uuid,
  academic_year_id uuid,
  name text,
  exam_type text,
  start_date date,
  end_date date,
  status text default 'draft'::text,
  max_marks numeric(8,2) default 100,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.fee_invoice_items (
  id uuid default gen_random_uuid(),
  school_id uuid,
  invoice_id uuid,
  fee_structure_id uuid,
  description text,
  amount numeric(12,2),
  discount numeric(12,2) default 0,
  line_total numeric(12,2) generated always as ((amount - discount)) stored
);

create table if not exists public.fee_invoices (
  id uuid default gen_random_uuid(),
  school_id uuid,
  enrollment_id uuid,
  invoice_number text,
  invoice_date date default CURRENT_DATE,
  due_date date,
  subtotal numeric(12,2),
  discount numeric(12,2) default 0,
  total numeric(12,2) generated always as ((subtotal - discount)) stored,
  status text default 'issued'::text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.fee_payments (
  id uuid default gen_random_uuid(),
  school_id uuid,
  invoice_id uuid,
  receipt_number text,
  payment_date date default CURRENT_DATE,
  amount numeric(12,2),
  payment_method text,
  reference text,
  status text default 'completed'::text,
  received_by uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.fee_structures (
  id uuid default gen_random_uuid(),
  school_id uuid,
  academic_year_id uuid,
  name text,
  fee_type text,
  frequency text default 'one_time'::text,
  amount numeric(12,2),
  due_day integer,
  grade_id uuid,
  active boolean default true,
  created_by uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.grades (
  id uuid default gen_random_uuid(),
  school_id uuid,
  name text,
  code text,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.guardians (
  id uuid default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  full_name text,
  relationship text,
  phone text,
  email text,
  address jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.import_batches (
  id uuid default gen_random_uuid(),
  school_id uuid,
  created_by uuid,
  academic_year_id uuid,
  source_filename text,
  source_type text default 'xlsx'::text,
  status text default 'staged'::text,
  total_rows integer default 0,
  valid_rows integer default 0,
  invalid_rows integer default 0,
  skipped_rows integer default 0,
  committed_rows integer default 0,
  created_at timestamp with time zone default now(),
  validated_at timestamp with time zone,
  committed_at timestamp with time zone
);

create table if not exists public.import_rows (
  id uuid default gen_random_uuid(),
  batch_id uuid,
  row_number integer,
  raw_data jsonb default '{}'::jsonb,
  normalized_data jsonb default '{}'::jsonb,
  status text default 'pending'::text,
  errors jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.leave_requests (
  id uuid default gen_random_uuid(),
  school_id uuid,
  staff_id uuid,
  leave_type_id uuid,
  start_date date,
  end_date date,
  days numeric(8,2),
  reason text,
  status text default 'pending'::text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.leave_types (
  id uuid default gen_random_uuid(),
  school_id uuid,
  name text,
  code text,
  annual_limit numeric(8,2),
  is_paid boolean default true,
  is_active boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.lessons (
  id uuid default gen_random_uuid(),
  school_id uuid,
  section_id uuid,
  subject_id uuid,
  curriculum_unit_id uuid,
  title text,
  content text,
  scheduled_date date,
  status text default 'planned'::text,
  created_by uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.notification_preferences (
  user_id uuid,
  school_id uuid,
  in_app_enabled boolean default true,
  email_enabled boolean default true,
  sms_enabled boolean default true,
  whatsapp_enabled boolean default true,
  updated_at timestamp with time zone default now()
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  title text,
  body text,
  notification_type text default 'general'::text,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create table if not exists public.organization_memberships (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  role text,
  status text default 'active'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.organizations (
  id uuid default gen_random_uuid(),
  name text,
  slug text,
  status text default 'active'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  plan text default 'starter'::text,
  billing_status text default 'trialing'::text,
  trial_ends_at timestamp with time zone default (now() + '14 days'::interval),
  max_students integer default 500,
  max_schools integer default 1,
  ai_monthly_limit integer default 1000
);

create table if not exists public.permissions (
  id uuid default gen_random_uuid(),
  key text,
  name text,
  module text,
  action text,
  description text,
  created_at timestamp with time zone default now()
);

create table if not exists public.role_permissions (
  role_id uuid,
  permission_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.roles (
  id uuid default gen_random_uuid(),
  key text,
  name text,
  scope text,
  description text,
  is_system boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.school_database_provisioning (
  id uuid default gen_random_uuid(),
  school_id uuid,
  organization_id uuid,
  database_mode text default 'dedicated_project'::text,
  status text default 'pending'::text,
  database_key text,
  external_project_id text,
  database_url text,
  error_message text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.school_memberships (
  id uuid default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  role text,
  status text default 'active'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.school_onboarding_profiles (
  id uuid default gen_random_uuid(),
  school_id uuid,
  status text default 'in_progress'::text,
  current_step integer default 1,
  answers jsonb default '{}'::jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.schools (
  id uuid default gen_random_uuid(),
  organization_id uuid,
  name text,
  code text,
  address jsonb default '{}'::jsonb,
  settings jsonb default '{}'::jsonb,
  status text default 'active'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.sections (
  id uuid default gen_random_uuid(),
  school_id uuid,
  grade_id uuid,
  name text,
  capacity integer,
  created_at timestamp with time zone default now()
);

create table if not exists public.staff_members (
  id uuid default gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  employee_number text,
  first_name text,
  middle_name text,
  last_name text,
  email text,
  phone text,
  date_of_birth date,
  gender text,
  employment_type text default 'full_time'::text,
  department text,
  designation text,
  joining_date date default CURRENT_DATE,
  status text default 'active'::text,
  salary numeric(14,2),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.student_enrollments (
  id uuid default gen_random_uuid(),
  school_id uuid,
  student_id uuid,
  academic_year_id uuid,
  grade_id uuid,
  section_id uuid,
  roll_number text,
  status text default 'active'::text,
  created_at timestamp with time zone default now()
);

create table if not exists public.student_fee_assignments (
  id uuid default gen_random_uuid(),
  school_id uuid,
  enrollment_id uuid,
  fee_structure_id uuid,
  amount numeric(12,2),
  discount numeric(12,2) default 0,
  status text default 'active'::text,
  assigned_by uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.student_guardians (
  student_id uuid,
  guardian_id uuid,
  is_primary boolean default false
);

create table if not exists public.students (
  id uuid default gen_random_uuid(),
  school_id uuid,
  admission_number text,
  first_name text,
  middle_name text,
  last_name text,
  date_of_birth date,
  gender text,
  email text,
  phone text,
  status text default 'active'::text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.subjects (
  id uuid default gen_random_uuid(),
  school_id uuid,
  name text,
  code text,
  description text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.timetable_entries (
  id uuid default gen_random_uuid(),
  school_id uuid,
  section_id uuid,
  subject_id uuid,
  teacher_user_id uuid,
  day_of_week smallint,
  period_no integer,
  starts_at time without time zone,
  ends_at time without time zone,
  room text,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.user_profiles (
  user_id uuid,
  full_name text,
  phone text,
  avatar_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.user_roles (
  id uuid default gen_random_uuid(),
  user_id uuid,
  role_id uuid,
  organization_id uuid,
  school_id uuid,
  created_at timestamp with time zone default now()
);
