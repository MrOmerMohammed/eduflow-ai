-- EduFlow AI production schema reconciliation manifest
-- Generated: 2026-09-22
-- Project: vzgnymdrgylshemjdamg
-- This file is intentionally verification-only. It does NOT mutate production.

select
  current_setting('server_version') as postgres_version,
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')) as functions,
  (select count(*) from pg_indexes where schemaname='public') as public_indexes,
  (select count(*) from pg_policies where schemaname='public') as public_policies,
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select max(version) from supabase_migrations.schema_migrations) as latest_migration;

-- Expected production snapshot:
-- PostgreSQL 17.6
-- public tables: 50
-- functions (public + private): 64
-- public indexes: 191
-- public RLS policies: 51
-- migrations: 52
-- latest migration: 20260920182753
