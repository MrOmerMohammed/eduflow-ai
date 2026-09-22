# EduFlow AI — Production Readiness Audit

Updated: 2026-09-22

## Scope
This is the Phase 1 repository audit for the sellability roadmap. It inventories the current application surface and records verified gaps without treating unfinished modules as complete.

## Repository inventory
- Total tracked files: 105
- Next.js pages: 26
- API route handlers: 10
- Supabase migrations in Git: 9
- Canonical production baseline files: 9
- Test-like artifacts: 2 (testing plan and Golden Path SQL)
- Node: 20.x
- Next.js: 16.3.3
- React: 19.2.0
- TypeScript: 5.9.2

## Security findings
Positive controls verified: server-side auth checks, server-only secret key usage, school membership context, administrator check for school setup, actor/school-aware RPC mutations, and RLS enabled on production public tables.

Open findings:
1. Supabase security advisor reports leaked-password protection disabled.
2. Supabase reports 13 public tables with RLS enabled but no policies. These must be classified as intentionally server-only versus missing policy coverage; they must not be opened blindly.
3. Cross-school isolation still requires executed negative tests.
4. Administrator, teacher and staff access still requires executed negative tests.
5. Authentication flows require deployed end-to-end verification.
6. Backup/restore has not yet been demonstrated.

## API contract findings
The central gateway has explicit action dispatch and server-side authentication. It combines RLS-backed reads with privileged RPC-backed mutations. It is therefore a high-value contract-test target. Frontend/backend payload mismatches have previously caused required-field failures, so action names, payload shapes and RPC arguments must be tested together.

## Import findings
Two import paths exist: workbook staging/validation and one-CSV school setup. The school CSV path validates before calling the transactional import RPC. Teacher invitation/role assignment and optional timetable creation occur after that import and need explicit failure/retry verification.

## Finance finding
The gateway contains fee structure, student assignment, invoice, payment and balance actions. The current Finance UI exposes fee-structure creation but not the complete collection lifecycle. Finance is INCOMPLETE for sellability.

## Parent finding
A parent dashboard RPC and UI exist, but the current parent surface is administrator-accessible rather than a separate parent-authenticated portal. The UI also contains administrator navigation. Parent functionality is INCOMPLETE for sellability.

## AI finding
The AI UI calls the AI route and displays execution plans, authorization status and results. The controlled tool/execution architecture exists. The AI gate remains open until read, mutation, unauthorized and invalid requests are executed and audit records verified.

## Feature status
- Authentication: Needs hardening
- School bootstrap: Needs hardening
- School onboarding: Needs hardening
- Students: Needs hardening
- Academic: Needs hardening
- Attendance: Needs hardening
- Exams/results: Needs hardening
- Finance: INCOMPLETE
- Staff/HR: Needs hardening
- Communication: Needs hardening
- Notifications: Needs hardening
- Parent portal: INCOMPLETE
- AI: Needs hardening
- Analytics: Needs hardening
- One-CSV onboarding: Needs hardening
- Observability: INCOMPLETE
- Backup/recovery: INCOMPLETE
- CI/CD: Needs hardening
- SaaS billing: INCOMPLETE
- Legal/trust pages: Needs review

## Phase 1 exit criteria
Phase 1 is not complete until security/RBAC/tenant-isolation negative tests exist, API contracts have representative automated coverage, Render production configuration is verified, Supabase security findings are classified and actionable auth findings are resolved, the database baseline is reproducible on a clean disposable environment, and the Golden Path executes without manual database intervention.

## Next execution order
1. Supabase production-safety verification.
2. Tenant-isolation and RBAC negative tests.
3. Authentication verification.
4. Render health-check configuration and live deployment verification.
5. Clean disposable database baseline replay.
6. Golden Path execution.
7. Fix failures before advancing to Finance/Parent completion.

This document is evidence for the roadmap; it does not declare the product sellable.