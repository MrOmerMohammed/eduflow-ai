# Production Database Reconciliation

Updated: 2026-09-22

## Finding

Production Supabase contains the complete migration history from 2026-09-16 through 2026-09-20, while the Git repository currently contains only the later subset of migration files.

This is a source-control/reproducibility risk. It does not mean production should be reset or that historical migrations should be fabricated.

## Production migration history

Production currently reports 52 migration versions, including the original foundation, auth/RBAC, student, attendance, academic, exams, finance, HR, communication, notifications, parent, analytics, import, AI, indexing, provisioning, onboarding and workspace-hardening migrations.

Latest production migration:

20260920182753_harden_workspace_bootstrap

## Repository migration files

The repository currently contains these migration files:

- 20260916194843_fix_bootstrap_school_workspace_role_scope.sql
- 20260918160333_v12_management_intelligence.sql
- 20260918162000_v13_safe_data_import_pipeline.sql
- 20260920085500_role_based_school_access.sql
- 20260920110000_one_csv_school_onboarding.sql
- 20260920120000_school_onboarding_profiles.sql
- 20260920120500_school_onboarding_admin_read_policy.sql
- 20260920130000_security_integrity_hardening.sql
- 20260920182753_harden_workspace_bootstrap.sql

## Canonical baseline added (2026-09-22)

A data-free production schema baseline is now committed under `supabase/baseline/`. It captures production tables, constraints/indexes, RLS/policies, private/public functions, and triggers without copying production data or fabricating the missing historical migrations.

Baseline files:

- `01_tables.sql`
- `02_constraints_indexes.sql`
- `03_rls_policies.sql`
- `04_private_functions.sql`
- `04_public_functions_1_20.sql`
- `04_public_functions_21_40.sql`
- `04_public_functions_41_60.sql`
- `04_public_functions_61_80.sql`
- `09_triggers.sql`

## Required resolution

Before broad commercial launch, choose and document one canonical database source-of-truth strategy.

Recommended approach:

1. Preserve the current production database.
2. Do not invent missing historical migration files.
3. Export/snapshot the production schema.
4. Establish a clean baseline for future development.
5. Ensure every new production schema change is committed as a repository migration before deployment.
6. Add CI validation so future migration drift is detected.
7. Test a clean database/bootstrap path from the canonical baseline.

## Current gate

PARTIALLY CLOSED — production schema is now captured as a canonical, data-free baseline. Full reproducibility remains to be proven by replaying the baseline on a clean database and running the Golden Path harness.

The application can continue to operate on the existing production database, but this gate must close before claiming full commercial readiness.
