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
- Supabase: production migration history contains the complete historical sequence, while the repository contains only a subset; migration source-of-truth reconciliation remains open
- Supabase security advisor: 13 RLS-enabled/no-policy tables and leaked-password protection disabled
- Commercial status: pilot-ready foundation, not yet broad-launch ready

## Working Rule

Do not add major features while a P0/P1 sellability gate is open. Fix, verify, and then advance to the next gate.
