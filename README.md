# EduFlow AI

EduFlow AI is a multi-tenant school management SaaS for administrators, teachers and operational staff. It combines student records, academics, attendance, exams, finance, HR, communication, analytics, data import and controlled AI operations in one school workspace.

## Production stack

- Next.js 16 + React 19 + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Render deployment
- Role-based school access: Administrator, Teacher, Staff
- Guided school onboarding
- Secure gateway/RPC workflows
- Audit logging and tenant isolation

---

# User Guide

This section is the operating manual for a school using EduFlow AI. Follow the role-specific workflow below instead of trying to configure everything at once.

## 1. Login and school workspace

1. Open the EduFlow AI login page.
2. Sign in with the account assigned to you.
3. EduFlow AI identifies your active school membership and school role.
4. The dashboard shows only the modules available to your role.
5. Keep the `schoolId` context when moving between modules; navigation normally preserves it automatically.
6. Sign out from the dashboard when finished, especially on shared school computers.

### Roles

| Role | Main responsibility | Typical access |
|---|---|---|
| Administrator | Configure and operate the school | Full school-management workspace |
| Teacher | Teaching and classroom operations | Students, Academic, Attendance, Exams, Communication, Notifications, AI |
| Staff | Operational/read access | Students, Academic, Attendance view, Communication, Notifications |

The application enforces access at both the application route level and the database/server-operation level. A hidden navigation item is not the only security control.

---

# 2. Administrator Guide

The Administrator should complete the school setup in this order:

**School setup → Academic structure → Students → Teachers/Staff → Attendance → Exams → Fees → Communication → Imports → Analytics → AI**

## 2.1 Administrator navigation

The administrator workspace contains:

1. **Overview** — school command center and high-level counts.
2. **Analytics** — management KPIs and operational intelligence.
3. **Students** — student registry, search and student records.
4. **Academic** — academic years, grades, sections, subjects, curriculum and lessons.
5. **Attendance** — daily class attendance.
6. **Exams** — examination setup, subjects, marks and results.
7. **Finance** — fee structures and secured finance workflows.
8. **Staff & HR** — staff records, teacher/staff account assignment and leave workflows.
9. **Communication** — school and targeted communications.
10. **Notifications** — in-app notifications and preferences.
11. **Parent Portal** — parent-facing dashboard functionality.
12. **Data Import** — safe workbook staging, validation and explicit import.
13. **AI Assistant** — authorized natural-language school operations.
14. **School setup** — school profile/onboarding configuration.

## 2.2 First-time school setup

Before adding students, configure the academic structure.

Recommended order:

1. Open **School setup**.
2. Complete the school profile and education-board information.
3. Create the current **Academic Year**.
4. Create **Grades**.
5. Create **Sections** under each grade.
6. Set section capacity where required.
7. Create **Subjects**.
8. Create curriculum units and lessons where the school uses curriculum tracking.
9. Add teachers and operational staff.
10. Verify the school dashboard before importing or entering the student population.

Do not create placeholder students merely to represent an estimated school population. The onboarding profile stores operating information; actual student records should be created through the Students workflow or validated import.

---

# 3. How to Add Students

There are two supported approaches:

- **Manual entry** — best for a small number of students.
- **Data Import** — best for an existing school database or large student population.

## 3.1 Add one student manually

1. Open **Students**.
2. Click **+ Add student**.
3. Enter the school's official **Admission number**.
4. Enter **First name**.
5. Enter **Middle name** if applicable.
6. Enter **Last name** if applicable.
7. Enter **Date of birth**.
8. Select **Gender** if the school records it.
9. Add student **Email** if available.
10. Add student **Phone** if available.
11. Select the correct **Status**:
   - Active
   - Inactive
   - Graduated
   - Transferred
   - Withdrawn
12. Click **Create student**.
13. Confirm that the student detail page opens successfully.

### Important

The admission number should be the school's official identifier. Do not create duplicate admission numbers.

After creation, use the student record/detail workflow to continue the student's academic/enrollment setup as required by the school.

## 3.2 Search and manage students

From **Students**:

- Search by student name.
- Search by admission number.
- Filter by status.
- Click **Open** to inspect a student record.
- Use the student detail page for the student's broader school record.

For a large school, use consistent admission-number conventions and avoid creating multiple records for the same student.

---

# 4. How to Import an Existing Student Database

Use **Data Import** when the school already has an Excel workbook.

The import process intentionally uses a safety gate:

**Upload → Preview & Validate → Fix errors → Commit**

## Step-by-step

1. Open **Data Import**.
2. Select the target **Academic Year**.
3. Choose the school's `.xlsx` or `.xlsm` workbook.
4. Click **Preview & Validate**.
5. Review:
   - Rows parsed
   - Valid rows
   - Invalid rows
   - Source workbook/school information
6. If invalid rows exist, stop and correct the workbook.
7. Upload the corrected workbook again.
8. Continue only when the invalid-row count is **0**.
9. Click **Commit validated import**.
10. Return to **Students** and verify the imported records.

### Import safety rule

Preview is non-destructive. It does not write student, guardian or enrollment records.

Never treat a successful preview as a completed import. The explicit **Commit validated import** action is required.

---

# 5. Academic Setup Guide

Open **Academic** after the school structure is ready.

Recommended setup:

1. Create academic year.
2. Create grades.
3. Create sections.
4. Create subjects.
5. Create curriculum units where needed.
6. Create lessons where needed.
7. Configure timetable entries.
8. Assign teachers to timetable/teaching activities as applicable.

A clean academic hierarchy is important because attendance and exam workflows use the academic year, grade/section and student enrollment information.

---

# 6. Teacher Account Guide for the Administrator

Teacher accounts are assigned by the school administrator.

## Create a teacher login

1. Open **Staff & HR**.
2. Open **Staff accounts & access**.
3. Enter:
   - Employee number
   - First name
   - Last name
   - Login email
   - Access role
   - Designation
   - Department
   - Employment type
   - Joining date
4. Select **Teacher** as the access role.
5. Click **Create account & send invite**.
6. If the email does not already have an EduFlow account, an invitation is sent.
7. If the user already exists, the school role is assigned to that account.
8. Ask the teacher to complete the invitation/login process.
9. Verify the teacher can see the expected teacher workspace.

## Staff login

Use the same workflow, but select **Staff** as the access role.

Only an administrator should use the Staff & HR area for assigning school access.

---

# 7. Teacher Guide

A teacher's normal daily workflow is:

**Login → Overview → Academic → Attendance → Exams → Communication → Notifications**

The teacher should focus on classroom operations rather than school-wide administration.

## Teacher navigation

Depending on the assigned role and current application permissions, the teacher workspace provides:

- Overview
- Students
- Academic
- Attendance
- Exams
- Communication
- Notifications
- AI Assistant

The teacher does not receive administrator-only navigation such as Finance, Staff & HR, Data Import, School setup or Analytics.

---

# 8. How a Teacher Marks Attendance

This is the standard daily attendance workflow.

## Step 1 — Open Attendance

1. Log in as a teacher.
2. Open **Attendance**.
3. Confirm the correct **Academic Year**.
4. Select the correct **Grade/Section**.
5. Select the attendance **Date**.

EduFlow AI loads the active enrollment roster for that section and date.

## Step 2 — Mark every student

Each student can be assigned one of four statuses:

- **Present** — student attended normally.
- **Absent** — student did not attend.
- **Late** — student attended but arrived late.
- **Excused** — absence is excused according to the school's attendance policy.

Use the status buttons beside each student.

## Step 3 — Review the totals

The attendance screen displays:

- Present
- Absent
- Late
- Excused

Review the counts before saving.

## Step 4 — Save

Click **Save attendance**.

The system saves the attendance records for the selected:

- School
- Academic year
- Section
- Date

The saved session is audit logged.

### Unsaved-change protection

If you change the academic year, section or date after modifying attendance, EduFlow AI warns you before discarding unsaved changes.

---

# 9. Attendance Percentage Calculation

EduFlow AI treats **Present** and **Late** as attended days, while **Excused** is excluded from the attendance-rate denominator in the current attendance workflow.

### Formula

**Attendance % = ((Present + Late) ÷ (Present + Absent + Late)) × 100**

### Example

Suppose a student has:

- Present = 80
- Late = 5
- Absent = 10
- Excused = 5

First calculate the attendance-eligible days:

**80 + 5 + 10 = 95**

Then calculate attended days:

**80 + 5 = 85**

Attendance percentage:

**85 ÷ 95 × 100 = 89.47%**

So the student's attendance percentage is **89.47%** under this rule.

### Why is Excused excluded?

The current attendance interface labels Excused as **"Excluded from rate"**. This means an approved excused absence does not reduce the attendance percentage.

### School policy note

If a school wants a different policy — for example, counting late differently or including excused days in the denominator — that calculation should be explicitly defined before using the percentage for official reports.

---

# 10. Daily Attendance Best Practices

Teachers should:

1. Mark attendance on the actual class date.
2. Select the correct section before editing.
3. Check the roster against the physical/digital class register.
4. Use **Late** instead of **Absent** when the student attended late.
5. Use **Excused** only when the absence is approved according to school policy.
6. Review Present/Absent/Late/Excused totals.
7. Save attendance before leaving the page.
8. Correct mistakes promptly using the authorized workflow.
9. Never share another teacher's login.

Administrators should periodically review attendance records and investigate unusual absence patterns.

---

# 11. Exam and Result Workflow

## Administrator/Teacher workflow

1. Open **Exams**.
2. Select the academic year.
3. Create an exam.
4. Enter:
   - Exam name
   - Exam type
   - Start date
   - End date
   - Maximum marks
5. Create the exam.
6. Add the relevant subject.
7. Configure:
   - Subject
   - Maximum marks
   - Pass marks
   - Exam date
8. Load the student results list.
9. Enter marks.
10. Enter grade/remarks where required.
11. Save results.

The application validates that marks are entered before saving the result set.

---

# 12. Finance Workflow

Administrators use **Finance** to configure fee structures.

Current workflow:

1. Open **Finance**.
2. Select the academic year.
3. Enter the fee name.
4. Select fee type:
   - Tuition
   - Admission
   - Transport
   - Hostel
   - Library
   - Exam
   - Activity
   - Other
5. Select frequency:
   - One time
   - Monthly
   - Quarterly
   - Term
   - Annual
6. Enter the amount.
7. Optionally set a due day.
8. Optionally target a grade.
9. Click **Create structure**.

The secured gateway already contains finance actions for fee assignment, invoices, payments and balances. The current finance screen exposes fee-structure configuration while the remaining collection UI is being expanded.

---

# 13. Staff & HR Workflow

Administrators can use **Staff & HR** to:

- Create staff records.
- Assign teacher/staff school access.
- Configure leave types.
- Review leave requests.
- Manage staff-related workflows.

Teacher and staff users should not use administrator HR controls.

---

# 14. Communication

Use **Communication** for school communication workflows.

Typical sequence:

1. Open Communication.
2. Create a communication campaign.
3. Define the title and message.
4. Select the communication channel.
5. Select the audience.
6. Optionally target specific students.
7. Review the message.
8. Send through the authorized workflow.

Teachers can use communication features permitted by their role. Administrators retain school-level control.

---

# 15. Notifications

Open **Notifications** to:

- View notifications.
- Mark individual notifications as read.
- Mark all notifications as read.
- Review notification preferences.
- Configure available notification preferences.

---

# 16. AI Assistant

The **AI Assistant** allows authorized users to ask school questions in natural language.

Examples:

- "Find student 1001"
- "Show today's attendance"
- "Show exam results"
- "Give me today's dashboard"

The AI workflow uses an authorized execution plan. It should only perform operations permitted for the current user and school.

### AI safety rule

Do not use the AI Assistant as a way to bypass role permissions. Administrator, teacher and staff permissions still apply.

---

# 17. Analytics

**Analytics** is an administrator-facing management area.

Use it for school-level operational intelligence and KPIs. Teachers and staff do not receive administrator analytics access in the current role model.

---

# 18. Parent Portal

The **Parent Portal** is an administrator-accessible school module in the current navigation model.

Use it to manage/inspect the parent-facing workflow as the parent portal implementation evolves.

---

# 19. Role Permission Summary

| Capability | Administrator | Teacher | Staff |
|---|---:|---:|---:|
| Overview | Yes | Yes | Yes |
| Students | Manage/View | View | View |
| Academic | Manage/View | Manage/View | View |
| Attendance | Manage/View | Manage/View | View |
| Exams | Manage/View | Manage/View | No |
| Finance | Yes | No | No |
| Staff & HR | Yes | No | No |
| Communication | Send/View | Send/View | View |
| Notifications | Manage/View | Manage/View | View |
| Parent Portal | Yes | No | No |
| Data Import | Yes | No | No |
| Analytics | Yes | No | No |
| AI Assistant | Manage/Use | Use | No |
| School setup | Yes | No | No |

Role permissions are enforced server-side as well as through navigation.

---

# 20. Recommended School Go-Live Sequence

Use this checklist for a new school.

### Phase 1 — School foundation

- [ ] School profile completed
- [ ] Education board configured
- [ ] Academic year created
- [ ] Grades created
- [ ] Sections created
- [ ] Subjects created
- [ ] Curriculum configured if required

### Phase 2 — People

- [ ] Administrator account verified
- [ ] Teacher staff records created
- [ ] Teacher invitations sent
- [ ] Staff invitations sent
- [ ] Teacher login tested
- [ ] Staff login tested

### Phase 3 — Students

- [ ] Student data cleaned
- [ ] Admission numbers checked for duplicates
- [ ] Existing student workbook prepared if importing
- [ ] Import preview completed
- [ ] Invalid rows corrected
- [ ] Import committed
- [ ] Student registry verified
- [ ] Student enrollments/academic placement verified

### Phase 4 — Daily operations

- [ ] Teacher can open Attendance
- [ ] Teacher can load the correct section
- [ ] Teacher can mark Present/Absent/Late/Excused
- [ ] Teacher can save attendance
- [ ] Attendance totals reviewed
- [ ] Attendance percentage policy confirmed

### Phase 5 — Assessment and fees

- [ ] Exams created
- [ ] Subjects attached to exams
- [ ] Marks entry tested
- [ ] Results saved
- [ ] Fee structures configured
- [ ] Finance permissions verified

### Phase 6 — Communication and security

- [ ] Communication tested
- [ ] Notifications tested
- [ ] AI Assistant tested
- [ ] Administrator restrictions tested
- [ ] Teacher restrictions tested
- [ ] Staff restrictions tested
- [ ] Password recovery tested
- [ ] Audit/security controls reviewed

---

# 21. Common Problems and Fixes

### "I cannot see a navigation item"

Your role may not have permission for that module. Check that the correct school account and school membership are being used.

### "Teacher cannot access Finance"

This is expected under the current role model. Finance is administrator-only.

### "Staff can see Attendance but cannot mark it"

This is expected. Staff currently have attendance view access, while attendance management is assigned to administrators and teachers.

### "Attendance roster is empty"

Check:

1. Correct academic year.
2. Correct grade/section.
3. Correct date.
4. Students have active enrollment in that section.
5. The user has access to the school.

### "Import preview shows invalid rows"

Do not commit the workbook. Correct the source data and run Preview & Validate again. Commit is blocked while invalid rows remain.

### "I changed the attendance section and lost my edits"

EduFlow AI asks for confirmation before discarding unsaved attendance changes. Choose the option that keeps the current work, then save before changing the section/date.

### "Teacher invitation was not received"

Verify the login email address and check the school's configured Supabase Auth email delivery settings.

---

# 22. Administrator Daily Routine

A practical daily routine is:

**Morning**
1. Open Overview.
2. Check school operational status.
3. Review Notifications.
4. Review attendance completion.
5. Follow up on exceptions.

**During the school day**
1. Monitor communication.
2. Review operational issues.
3. Support teachers/staff.
4. Update student/staff records when required.

**End of day**
1. Confirm attendance is submitted for required sections.
2. Review important notifications.
3. Check unresolved operational items.
4. Review relevant analytics.
5. Sign out from shared devices.

---

# 23. Teacher Daily Routine

**Before class**
1. Login.
2. Open Attendance.
3. Select the correct academic year and section.
4. Confirm the date.

**During/after class**
1. Mark each student.
2. Use Late for late arrivals.
3. Use Excused only for approved cases.
4. Review totals.
5. Save attendance.

**Assessment days**
1. Open Exams.
2. Select the correct exam/subject.
3. Enter marks carefully.
4. Review marks.
5. Save results.

**End of day**
1. Check Notifications.
2. Review Communication.
3. Confirm attendance was saved.

---

# 24. Data Quality Rules

For reliable school reporting:

- Use one official admission number per student.
- Do not create duplicate student records.
- Keep student status current.
- Keep academic-year enrollment accurate.
- Assign students to the correct grade and section.
- Use consistent subject codes.
- Record attendance on the correct date.
- Use the same attendance policy throughout the school.
- Verify imported data before committing it.
- Restrict account creation and role assignment to authorized administrators.

---

## Client-ready onboarding

A new school follows a guided setup before entering its workspace:

1. School profile and education board
2. Academic year
3. Grades, sections and capacity
4. Student population
5. Teachers and staff
6. Attendance, exams and fee workflows
7. Optional services such as transport, hostel and parent portal
8. Review and completion

The questionnaire stores the school's operating profile. It does not create fake students or staff from estimated counts.

## Local development

Copy the required Supabase variables into `.env.local`, install dependencies with `npm install`, then run `npm run typecheck` and `npm run build`. Start production with `npm start`.

## Production requirements

- Never expose `SUPABASE_SECRET_KEY` to browser code.
- Configure Supabase Auth email settings and redirect URLs for the production domain.
- Configure the production site URL.
- Keep database migrations synchronized with the repository.
- Enable leaked-password protection in Supabase Auth before onboarding real customers.
- Test administrator, teacher and staff access separately before a school goes live.

## Client launch checklist

- [ ] Production domain configured
- [ ] Supabase Auth email delivery configured
- [ ] Password recovery tested
- [ ] School onboarding completed
- [ ] Administrator account verified
- [ ] Teacher invite tested
- [ ] Staff invite tested
- [ ] Role restrictions tested
- [ ] Student import tested
- [ ] Attendance workflow tested
- [ ] Attendance percentage policy confirmed
- [ ] Exam workflow tested
- [ ] Finance workflow tested
- [ ] Communication workflow tested
- [ ] AI assistant tested with authorized and unauthorized requests
- [ ] Backup/recovery process documented
- [ ] Privacy, Terms and Security pages reviewed
