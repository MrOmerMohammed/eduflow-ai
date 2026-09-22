# Production Schema Baseline Manifest

Generated: 2026-09-22

## Production reference

- Supabase project: `vzgnymdrgylshemjdamg`
- Latest production migration: `20260920182753_harden_workspace_bootstrap`
- Production migration count: 52
- Production data is not included in this baseline.
- Historical migrations that are missing from Git are not fabricated.

## Baseline contents

- `supabase/baseline/01_tables.sql` — public table definitions
- `supabase/baseline/02_constraints_indexes.sql` — primary/unique/check/foreign-key constraints and non-constraint indexes
- `supabase/baseline/03_rls_policies.sql` — RLS enablement and policies
- `supabase/baseline/04_private_functions.sql` — private schema functions
- `supabase/baseline/04_public_functions_1_20.sql`
- `supabase/baseline/04_public_functions_21_40.sql`
- `supabase/baseline/04_public_functions_41_60.sql`
- `supabase/baseline/04_public_functions_61_80.sql`
- `supabase/baseline/09_triggers.sql`

## Verification

The table/constraint/index baseline was replay-tested in a temporary schema inside a transaction against the production database connection. The transaction was rolled back and no production data/schema was changed.

Remaining reproducibility verification:

1. Replay the complete baseline, including functions, RLS/policies and triggers, on a clean disposable database/branch.
2. Run `scripts/golden-path.sql` plus the HTTP gateway flow.
3. Keep future schema changes as repository migrations and validate migration drift in CI.

## Safety rule

Never reset production to reconstruct historical migration files. The baseline is the canonical starting point for future development; production remains authoritative until a clean replacement environment has passed the full verification suite.
