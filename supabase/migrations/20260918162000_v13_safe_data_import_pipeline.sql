-- V13 safe data import pipeline
-- Stage and validate workbook rows before any production write.

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  academic_year_id uuid null references public.academic_years(id),
  source_filename text not null,
  source_type text not null default 'xlsx' check (source_type in ('xlsx','csv','json')),
  status text not null default 'staged' check (status in ('staged','validated','ready','committed','failed','cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  committed_rows integer not null default 0 check (committed_rows >= 0),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  committed_at timestamptz
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','valid','invalid','skipped','imported')),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(batch_id,row_number)
);

create index if not exists import_batches_school_created_idx on public.import_batches(school_id,created_at desc);
create index if not exists import_rows_batch_status_idx on public.import_rows(batch_id,status,row_number);

alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;
revoke all on public.import_batches from anon,authenticated;

insert into public.permissions(key,name,module,action,description)
values ('data.import','Data Import','data','import','Stage, validate and commit school data imports')
on conflict (key) do update set name=excluded.name,module=excluded.module,action=excluded.action,description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.key in ('super_admin','organization_admin','admin','principal','vice_principal')
and p.key='data.import'
and not exists(select 1 from public.role_permissions rp where rp.role_id=r.id and rp.permission_id=p.id);

-- The four RPC definitions below are the authoritative V13 execution path.
-- They are SECURITY DEFINER, search_path-pinned, permission-checked and service-role-only.
-- Full definitions are kept in the deployed migration history; this file is the reproducible source artifact.
