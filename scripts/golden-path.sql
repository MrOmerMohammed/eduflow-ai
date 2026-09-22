-- EduFlow AI Golden Path integration harness
-- Purpose: exercise the end-to-end school workflow against a disposable/test database.
-- IMPORTANT: This script is intentionally wrapped in a transaction and ALWAYS rolls back.
-- It does not create production data. Run it only against a test/preview database.

BEGIN;

CREATE TEMP TABLE golden_path_ids (key text PRIMARY KEY, id uuid);

-- Existing test actor. Replace with a test-school admin UUID when running outside the current project.
-- The script is a DB/RPC harness, not an HTTP smoke test.
INSERT INTO golden_path_ids
SELECT 'academic_year', (public.create_academic_year(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  'Golden Path Test 2026',
  DATE '2026-04-01',
  DATE '2027-03-31',
  false
)->>'id')::uuid;

INSERT INTO golden_path_ids
SELECT 'grade', (public.create_grade(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  'Golden Path Grade',
  'GPG',
  99
)->>'id')::uuid;

INSERT INTO golden_path_ids
SELECT 'section', (public.create_section(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='grade'),
  'A',
  40
)->>'id')::uuid;

SELECT public.create_subject(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  'Golden Path Mathematics',
  'GPM',
  'Golden path integration subject'
);

INSERT INTO golden_path_ids
SELECT 'subject', id
FROM public.subjects
WHERE school_id='0f531d29-cf28-41f3-9b54-8272adf29b2b'
  AND code='GPM'
ORDER BY created_at DESC
LIMIT 1;

INSERT INTO golden_path_ids
SELECT 'student', (public.create_student(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  'GOLDEN-001',
  'Asha',
  NULL,
  'Test',
  DATE '2012-06-15',
  'female',
  NULL,
  '9999999999',
  'active'
)->>'id')::uuid;

INSERT INTO golden_path_ids
SELECT 'enrollment', (public.create_student_enrollment(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='student'),
  (SELECT id FROM golden_path_ids WHERE key='academic_year'),
  (SELECT id FROM golden_path_ids WHERE key='grade'),
  (SELECT id FROM golden_path_ids WHERE key='section'),
  '1',
  'active'
)->>'id')::uuid;

SELECT public.save_attendance(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='academic_year'),
  (SELECT id FROM golden_path_ids WHERE key='section'),
  DATE '2026-09-22',
  jsonb_build_array(jsonb_build_object(
    'enrollmentId',(SELECT id FROM golden_path_ids WHERE key='enrollment'),
    'status','present',
    'remarks','Golden path'
  )),
  'submitted',
  'Golden path integration'
);

INSERT INTO golden_path_ids
SELECT 'exam', public.create_exam(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='academic_year'),
  'Golden Path Midterm',
  'midterm',
  DATE '2026-09-22',
  DATE '2026-09-30',
  100
);

INSERT INTO golden_path_ids
SELECT 'exam_subject', public.create_exam_subject(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='exam'),
  (SELECT id FROM golden_path_ids WHERE key='subject'),
  DATE '2026-09-25',
  100,
  35
);

SELECT public.save_exam_results(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='exam_subject'),
  jsonb_build_array(jsonb_build_object(
    'enrollmentId',(SELECT id FROM golden_path_ids WHERE key='enrollment'),
    'marks',87,
    'grade','A',
    'remarks','Golden path'
  ))
);

INSERT INTO golden_path_ids
SELECT 'fee_structure', public.create_fee_structure(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='academic_year'),
  'Golden Path Tuition',
  'tuition',
  'monthly',
  1000,
  10,
  (SELECT id FROM golden_path_ids WHERE key='grade')
);

INSERT INTO golden_path_ids
SELECT 'fee_assignment', public.assign_student_fee(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='enrollment'),
  (SELECT id FROM golden_path_ids WHERE key='fee_structure'),
  1000,
  0
);

INSERT INTO golden_path_ids
SELECT 'invoice', public.create_fee_invoice(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='enrollment'),
  'GOLDEN-INV-001',
  DATE '2026-09-30',
  jsonb_build_array(jsonb_build_object(
    'fee_structure_id',(SELECT id FROM golden_path_ids WHERE key='fee_structure'),
    'description','Golden Path Tuition',
    'amount',1000,
    'discount',0
  )),
  0,
  'Golden path'
);

INSERT INTO golden_path_ids
SELECT 'payment', public.record_fee_payment(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  (SELECT id FROM golden_path_ids WHERE key='invoice'),
  'GOLDEN-REC-001',
  1000,
  'cash',
  'GOLDEN'
);

-- AI authorization/planning is read/ledger-oriented and should be exercised after
-- the school data exists.
SELECT public.ai_list_tools(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b'
);

SELECT public.ai_authorize_tool(
  '9e8974fc-4e89-488f-a094-92d9e0e47894',
  '0f531d29-cf28-41f3-9b54-8272adf29b2b',
  'student.search',
  jsonb_build_object('schoolId','0f531d29-cf28-41f3-9b54-8272adf29b2b','query','Asha')
);

SELECT jsonb_build_object(
  'fee_balance', COALESCE((
    SELECT jsonb_agg(to_jsonb(b))
    FROM public.get_student_fee_balance(
      '9e8974fc-4e89-488f-a094-92d9e0e47894',
      '0f531d29-cf28-41f3-9b54-8272adf29b2b',
      (SELECT id FROM golden_path_ids WHERE key='enrollment')
    ) b
  ), '[]'::jsonb),
  'ids', (SELECT jsonb_object_agg(key,id) FROM golden_path_ids)
) AS golden_path_verification;

-- No test data is retained.
ROLLBACK;
