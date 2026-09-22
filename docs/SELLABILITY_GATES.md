# EduFlow AI Sellability Gates

This document is the release gate for taking EduFlow AI from pilot-ready to a commercially deployable school ERP.

## Gate 1 — Production Safety

- [ ] Authentication and password recovery verified
- [ ] Leaked-password protection enabled in Supabase Auth
- [ ] RBAC verified for administrator, teacher and staff
- [ ] Cross-school tenant isolation tested
- [ ] RLS and privileged RPC paths reviewed
- [ ] Secrets verified server-only
- [ ] Production environment variables verified
- [ ] Backup and restore procedure tested
- [ ] Supabase production migration history reconciled with repository strategy

## Gate 2 — Golden Path

A representative school must be able to complete:

School -> Admin -> Academic year -> Grades/Sections -> Students -> Teacher -> Attendance -> Exam -> Results -> Fees -> Payment -> Parent -> AI.

Every step must succeed without manual database intervention.

### Golden-path harness

A rollback-only SQL integration harness is now committed at `scripts/golden-path.sql`.

It exercises the database/RPC workflow for:

- academic year
- grade and section
- subject
- student and enrollment
- attendance
- exam and exam subject
- exam results
- fee structure and student fee assignment
- invoice and payment
- AI tool catalog/authorization

The harness intentionally rolls back all writes. It is a verification aid, not a production seed.

**Important:** the harness does not yet constitute a passed commercial Golden Path. A clean test/preview database run still needs to be executed end-to-end, including the parent identity/dashboard and the HTTP gateway layer.

## Gate 3 — Reliability

- [ ] Typecheck
- [ ] Production build
- [ ] Production health smoke test
- [ ] Authentication regression tests
- [ ] Tenant-isolation regression tests
- [ ] RBAC regression tests
- [ ] Student/import regression tests
- [ ] Attendance regression tests
- [ ] Exam/results regression tests
- [ ] Finance regression tests
- [ ] Parent regression tests
- [ ] AI authorization regression tests

## Gate 4 — Customer Readiness

- [ ] School onboarding can be completed by an administrator
- [ ] Parent experience is customer-facing and verified
- [ ] Finance lifecycle is complete: structure -> assignment -> invoice -> payment -> receipt/balance -> parent visibility
- [ ] Communication and notifications are verified
- [ ] Support and incident procedures exist
- [ ] Privacy, terms and security documentation are production-ready

## Gate 5 — Pilot

Run one real school through the complete Golden Path. Classify issues as:

- P0: security/data/business critical
- P1: workflow blocker
- P2: usability defect
- P3: enhancement

No P0/P1 issue should remain open before broad commercial rollout.

## Current Status

As of 2026-09-22:

- Render deployment: live
- Node runtime: pinned to 20.x
- Health endpoint: implemented
- CI: typecheck + build + production health smoke test
- Supabase: 52 production migrations are present; missing historical source files are not fabricated. A data-free production schema baseline is committed under `supabase/baseline/` and its table/constraint/index layer has been replay-tested in a disposable transaction. Full clean-database + Golden Path verification remains open
- Supabase security advisor: 13 RLS-enabled/no-policy tables and leaked-password protection disabled
- Golden-path harness: committed, rollback-only, not yet a passed end-to-end commercial test
- Production currently has two schools but no students/staff records, so real-school workflow coverage is still unproven
- Commercial status: pilot-ready foundation, not yet broad-launch ready

## Working Rule

Do not add major features while a P0/P1 sellability gate is open. Fix, verify, and then advance to the next gate.
