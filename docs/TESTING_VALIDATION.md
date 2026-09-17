# EduFlow AI — Testing & Validation Plan

This document is the release gate for every ERP phase. A phase is not considered complete until the applicable checks pass in development/backend and the deployed application is smoke-tested.

## Release gate

Each phase must pass four layers:

1. **Build validation** — TypeScript/build succeeds with zero errors.
2. **Backend validation** — schema, constraints, RLS/security, functions and representative data are verified with direct database checks.
3. **Functional validation** — primary user journeys work end-to-end in the deployed app.
4. **Negative/security validation** — invalid input, unauthorized access, cross-school access and duplicate/conflicting operations are rejected safely.

For major phases, run the checks at least twice after fixes: once immediately after implementation and once against the deployed build.

## V1 — Foundation / Authentication / Core RBAC

- [ ] Sign-up creates an authenticated user/profile correctly.
- [ ] Login/logout/session persistence works.
- [ ] Unauthenticated users cannot access protected application routes.
- [ ] Organization, school and membership records have correct relationships.
- [ ] Roles and permissions resolve correctly for representative users.
- [ ] RLS is enabled on every exposed public table.
- [ ] Cross-organization and cross-school reads/writes are rejected.
- [ ] No service/secret key is present in client code.
- [ ] Audit records are generated for protected mutations where designed.

**Pass evidence:** build succeeds, representative SQL checks pass, and login → dashboard works in the deployed app.

## V2 — School Management / Academic Setup

- [ ] Organization + school workspace creation succeeds.
- [ ] Bootstrap assigns organization-scoped and school-scoped roles consistently.
- [ ] Academic year creation works and duplicate school/year names are rejected.
- [ ] Grade creation works and duplicate school/grade names are rejected.
- [ ] Section creation works and duplicate school/grade/section names are rejected.
- [ ] Only authorized workspace members can invoke management mutations.
- [ ] Gateway functions use hardened execution settings and restricted execution grants.
- [ ] Invalid UUIDs and missing required fields are rejected.
- [ ] Existing school data remains isolated from another school.

**Pass evidence:** setup journey completes, duplicate/unauthorized tests fail safely, and database constraints/security checks pass.

## V3 — Student Information System

### Registry
- [ ] Student list loads for the active school.
- [ ] Search returns only students belonging to the active school.
- [ ] Empty search/no-result state is clear.
- [ ] Student creation validates required fields.
- [ ] Duplicate admission numbers are rejected per school.

### Student 360
- [ ] Student profile loads by ID.
- [ ] Core profile edits persist after reload.
- [ ] Status changes persist.
- [ ] Guardian creation and student linking work.
- [ ] First linked guardian can become primary according to business rules.
- [ ] Enrollment can be created for an academic year + grade + section.
- [ ] Section choices are filtered by selected grade.
- [ ] Enrollment history reloads from the database.
- [ ] Duplicate student/year enrollment is rejected by the database rule.

### Negative/security tests
- [ ] Unknown student ID returns a safe not-found/error response.
- [ ] A user cannot read another school's student by changing `schoolId` or student ID.
- [ ] A user cannot mutate a student outside their school.
- [ ] Invalid enrollment combinations are rejected.
- [ ] Direct client requests cannot bypass the server gateway/RBAC boundary.

**Pass evidence:** create/test student → edit → guardian → enrollment → reload, plus cross-school and duplicate tests, all pass on the deployed build.

## V4 — Attendance

- [ ] Teacher/admin can open attendance for a class/section and date.
- [ ] Bulk mark present/absent/late works.
- [ ] Individual corrections work.
- [ ] Duplicate attendance for the same student/date is prevented or handled deterministically.
- [ ] Attendance history and percentage calculations are correct against known sample data.
- [ ] Teacher sees only assigned/authorized classes.
- [ ] Parent/student views expose only their own authorized attendance.
- [ ] Low-attendance alert rule can be evaluated from stored attendance.
- [ ] Audit trail exists for attendance changes.

**Pass evidence:** known 10–20 student test set with manually calculated expected percentages matches application output.

## V5 — Academic / Curriculum / Timetable

- [ ] Subjects/curriculum can be configured per grade/year.
- [ ] Teacher/class assignments respect school boundaries.
- [ ] Timetable creation prevents invalid/conflicting assignments according to rules.
- [ ] Teacher and class timetable views match stored records.
- [ ] Unauthorized users cannot alter academic configuration.
- [ ] Representative timetable conflict tests are rejected.

**Pass evidence:** one complete class timetable plus conflict/authorization tests pass.

## V6 — Exams & Assessment

- [ ] Exam/assessment creation works.
- [ ] Subjects and assessment components are correctly scoped.
- [ ] Marks entry supports valid ranges and rejects invalid values.
- [ ] Bulk marks entry handles partial/invalid rows safely.
- [ ] Grade/percentage calculations match independently calculated expected values.
- [ ] Report card generation reflects the correct academic year/student/class.
- [ ] Published results have controlled edit permissions and auditability.

**Pass evidence:** fixed sample marks set produces independently verified expected totals/grades.

## V7 — Fees / Finance

- [ ] Fee structures can be configured by school/year/class as designed.
- [ ] Invoices are generated correctly.
- [ ] Payments update balances atomically.
- [ ] Duplicate payment/retry scenarios are safe and idempotent where required.
- [ ] Outstanding balances match ledger calculations.
- [ ] Finance roles cannot access another school's financial data.
- [ ] Financial mutations are audited.

**Pass evidence:** known invoice/payment ledger reconciles to expected outstanding balance.

## V8 — Staff / HR

- [ ] Staff profiles and school membership are created correctly.
- [ ] Role assignments match organizational scope.
- [ ] Leave requests and approval workflow work.
- [ ] Staff cannot access records outside authorized scope.
- [ ] Sensitive HR actions are audited.

**Pass evidence:** employee lifecycle + leave approval scenario passes with authorization checks.

## V9 — Parent / Teacher / Student Portals

- [ ] Each portal shows only role-appropriate data.
- [ ] Parent-to-student relationships are enforced.
- [ ] Teacher access is limited to assigned/authorized academic data.
- [ ] Student access is limited to their own records.
- [ ] Communication actions cannot be used to target unauthorized recipients.

**Pass evidence:** three-role access matrix tested against the same school dataset.

## V10 — Communication Center

- [ ] Notifications can be composed and targeted by authorized scope.
- [ ] Email/SMS/WhatsApp integrations use server-side credentials only.
- [ ] Failed sends are represented safely and can be retried.
- [ ] Bulk communication respects recipient scope and deduplication rules.
- [ ] Communication events are auditable.

**Pass evidence:** controlled test recipients receive expected messages and unauthorized targeting is rejected.

## V11 — Transport / Library / Hostel / Inventory

For each operational module:

- [ ] CRUD lifecycle works.
- [ ] Relationships and capacity/availability constraints work.
- [ ] Search/filter/report views match database state.
- [ ] Duplicate/conflicting operations are rejected or handled deterministically.
- [ ] School/organization isolation is verified.
- [ ] Role permissions are verified.
- [ ] Important mutations are audited.

**Pass evidence:** one complete lifecycle scenario per module plus negative/security tests.

## V12 — Analytics / Management Intelligence

- [ ] Dashboard metrics reconcile with source tables.
- [ ] Date/year/school filters produce correct results.
- [ ] No tenant can see another tenant's analytics.
- [ ] Large demo dataset remains usable under expected query patterns.
- [ ] Export/report calculations reconcile to dashboard values.

**Pass evidence:** independently calculated KPI sample matches dashboard output.

## AI Orchestrator / Automation Release Gate

- [ ] Every AI action maps to an allowlisted tool.
- [ ] AI cannot directly mutate the database with unrestricted credentials.
- [ ] Permission checks run before every protected action.
- [ ] Business validation runs before mutation.
- [ ] Mutations generate appropriate audit records.
- [ ] Prompt/input manipulation cannot bypass tool authorization.
- [ ] AI receives only the minimum data needed for the requested operation.
- [ ] Failed actions do not partially mutate state where atomicity is required.
- [ ] Automation workflows are idempotent where retries are possible.

**Pass evidence:** run representative natural-language requests for read, create, update, unauthorized and invalid actions and inspect both result and audit trail.

## Production readiness gate

Before calling the ERP commercially ready:

- [ ] All completed phases have passing validation evidence.
- [ ] Latest Git commit is deployed and Render status is `live`.
- [ ] Production smoke test passes after deployment.
- [ ] Supabase security/RLS checks pass.
- [ ] No production secrets are committed to GitHub or exposed to the browser.
- [ ] Error states are user-safe and do not leak internal details.
- [ ] Core workflows have regression tests after each new phase.
- [ ] Backup/recovery and migration procedure is documented.
- [ ] Monitoring/logging is sufficient to diagnose production failures.

## Version sign-off rule

A version is marked **PASS** only when all mandatory checks for that phase are checked and the deployed build has been tested. If a check fails, the version remains **IN VALIDATION** until the defect is fixed and the affected checks are rerun.
