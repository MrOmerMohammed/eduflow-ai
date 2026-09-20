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

## Roles
### Administrator
School configuration, user access, academics, students, attendance, exams, finance, HR, communication, imports, analytics and AI.
### Teacher
Teaching workspace, student visibility, academics, attendance, exams, communication, notifications and authorized AI.
### Staff
Operational/read access to the modules assigned to the staff role.

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
- [ ] Exam workflow tested
- [ ] Finance workflow tested
- [ ] Communication workflow tested
- [ ] AI assistant tested with authorized and unauthorized requests
- [ ] Backup/recovery process documented
- [ ] Privacy, Terms and Security pages reviewed