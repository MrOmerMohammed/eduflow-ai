-- School onboarding profile and guided setup
create table if not exists public.school_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  current_step integer not null default 1 check (current_step between 1 and 8),
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_onboarding_profiles enable row level security;
revoke all on table public.school_onboarding_profiles from public, anon, authenticated;

create or replace function public.save_school_onboarding(
  p_actor_user_id uuid,
  p_school_id uuid,
  p_status text,
  p_current_step integer,
  p_answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_admin boolean;
  v_status text;
begin
  if p_actor_user_id is null or p_school_id is null then
    raise exception 'User and school are required';
  end if;

  v_status := case when p_status = 'completed' then 'completed' else 'in_progress' end;

  select s.organization_id into v_org_id
  from public.schools s
  where s.id = p_school_id and s.status = 'active';

  if v_org_id is null then
    raise exception 'School not found or inactive';
  end if;

  select exists(
    select 1 from public.school_memberships sm
    where sm.school_id = p_school_id
      and sm.user_id = p_actor_user_id
      and sm.status = 'active'
      and sm.role = 'admin'
  ) into v_admin;

  if not v_admin then
    raise exception 'Only school administrators can complete school setup';
  end if;

  insert into public.school_onboarding_profiles(
    school_id,status,current_step,answers,completed_at,updated_at
  )
  values(
    p_school_id,
    v_status,
    greatest(1,least(coalesce(p_current_step,1),8)),
    coalesce(p_answers,'{}'::jsonb),
    case when v_status='completed' then now() else null end,
    now()
  )
  on conflict(school_id) do update set
    status=excluded.status,
    current_step=excluded.current_step,
    answers=excluded.answers,
    completed_at=excluded.completed_at,
    updated_at=now();

  insert into public.audit_logs(
    organization_id,school_id,actor_user_id,action,entity_type,entity_id,metadata
  )
  values(
    v_org_id,p_school_id,p_actor_user_id,'school.onboarding.save',
    'school_onboarding',p_school_id,
    jsonb_build_object('status',v_status,'current_step',p_current_step)
  );

  return jsonb_build_object(
    'school_id',p_school_id,
    'status',v_status,
    'current_step',greatest(1,least(coalesce(p_current_step,1),8))
  );
end;
$$;

revoke all on function public.save_school_onboarding(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.save_school_onboarding(uuid,uuid,text,integer,jsonb) to service_role;
