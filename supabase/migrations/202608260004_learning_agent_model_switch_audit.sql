begin;

create table if not exists public.learning_agent_model_change_logs (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.learning_agent_profiles(id) on delete cascade,
  changed_by uuid references auth.users(id) on delete set null,
  previous_provider text not null check (previous_provider in ('qwen', 'deepseek')),
  previous_model text not null,
  next_provider text not null check (next_provider in ('qwen', 'deepseek')),
  next_model text not null,
  created_at timestamptz not null default now()
);

create index if not exists learning_agent_model_change_logs_profile_created_idx
  on public.learning_agent_model_change_logs(agent_profile_id, created_at desc);

alter table public.learning_agent_model_change_logs enable row level security;
revoke all on public.learning_agent_model_change_logs from anon, authenticated;
grant all on public.learning_agent_model_change_logs to service_role;

create or replace function public.set_learning_agent_model(
  p_agent_code text,
  p_provider text,
  p_model text,
  p_changed_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_previous_provider text;
  v_previous_model text;
begin
  if p_provider not in ('qwen', 'deepseek') then
    raise exception 'unsupported learning agent provider';
  end if;
  if p_model !~ '^[A-Za-z0-9._:-]{2,100}$' then
    raise exception 'invalid learning agent model';
  end if;

  select profile.id, secret.provider, secret.model
    into v_profile_id, v_previous_provider, v_previous_model
  from public.learning_agent_profiles profile
  join public.learning_agent_profile_secrets secret
    on secret.agent_profile_id = profile.id
  where profile.agent_code = p_agent_code
    and profile.status = 'published'
  for update of secret;

  if v_profile_id is null then
    raise exception 'learning agent not found';
  end if;
  if v_previous_provider = p_provider and v_previous_model = p_model then
    return;
  end if;

  update public.learning_agent_profile_secrets
  set provider = p_provider,
      model = p_model,
      updated_at = pg_catalog.now()
  where agent_profile_id = v_profile_id;

  insert into public.learning_agent_model_change_logs (
    agent_profile_id,
    changed_by,
    previous_provider,
    previous_model,
    next_provider,
    next_model
  ) values (
    v_profile_id,
    p_changed_by,
    v_previous_provider,
    v_previous_model,
    p_provider,
    p_model
  );
end;
$$;

revoke all on function public.set_learning_agent_model(text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_learning_agent_model(text, text, text, uuid)
  to service_role;

comment on table public.learning_agent_model_change_logs is
  '平台负责人切换课程教学 Agent 供应商或模型的审计记录。';

commit;
