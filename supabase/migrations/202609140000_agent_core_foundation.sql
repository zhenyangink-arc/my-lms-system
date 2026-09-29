-- Stage 0B. Source only; never apply to a shared/production DB as part of tests.
begin;
create schema agent_core_private;
revoke all on schema agent_core_private from public, anon, authenticated, service_role;

create table public.agent_definition_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id),
  actor_id uuid not null references public.profiles(id), agent_code text not null, version text not null,
  status text not null check(status in ('published','disabled')), manifest jsonb not null check(jsonb_typeof(manifest)='object'),
  created_at timestamptz not null default clock_timestamp(), unique(tenant_id,agent_code,version), unique(tenant_id,id)
);
create table public.agent_conversations (
  id uuid primary key, tenant_id uuid not null references public.tenants(id), actor_id uuid not null references public.profiles(id),
  agent_code text not null, app_id text not null, scope_kind text not null, scope_ref text not null,
  status text not null default 'active' check(status in ('active','closed')),
  created_at timestamptz not null default clock_timestamp(), unique(tenant_id,actor_id,id)
);
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, actor_id uuid not null,
  conversation_id uuid not null, input_message_id uuid not null, definition_id uuid not null,
  agent_code text not null, profile_version text not null, skill_ref jsonb not null,
  scope_ref text not null, status text not null default 'created' check(status in ('created','running','waiting_tool','completed','failed','cancelled')),
  idempotency_key text not null check(length(idempotency_key) between 8 and 128),
  request_digest text not null check(request_digest ~ '^[a-f0-9]{64}$'),
  budget jsonb not null, deadline_at timestamptz not null, lease_expires_at timestamptz not null,
  state_version integer not null default 1, fencing_token uuid not null default gen_random_uuid(), execution_attempt integer not null default 1,
  retry_of_run_id uuid, context_metadata jsonb not null default '{}', terminal_reason text,
  created_at timestamptz not null default clock_timestamp(), ended_at timestamptz,
  unique(tenant_id,actor_id,id), unique(tenant_id,actor_id,conversation_id,idempotency_key),
  foreign key(tenant_id,actor_id,conversation_id) references public.agent_conversations(tenant_id,actor_id,id),
  foreign key(tenant_id,definition_id) references public.agent_definition_versions(tenant_id,id),
  foreign key(tenant_id,actor_id,retry_of_run_id) references public.agent_runs(tenant_id,actor_id,id)
);
create unique index agent_runs_one_active on public.agent_runs(conversation_id) where status in ('created','running','waiting_tool');
create table public.agent_messages (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, actor_id uuid not null,
  conversation_id uuid not null, run_id uuid not null, role text not null check(role in ('user','assistant')),
  content text not null check(length(content)<=100000), state text not null check(state in ('accepted','final','partial')),
  origin text not null default 'agent_core', source_refs jsonb not null default '[]',
  created_at timestamptz not null default clock_timestamp(), unique(run_id,role), unique(tenant_id,actor_id,id),
  foreign key(tenant_id,actor_id,conversation_id) references public.agent_conversations(tenant_id,actor_id,id),
  foreign key(tenant_id,actor_id,run_id) references public.agent_runs(tenant_id,actor_id,id) deferrable initially deferred
);
alter table public.agent_runs add constraint agent_runs_input_fk foreign key(tenant_id,actor_id,input_message_id)
  references public.agent_messages(tenant_id,actor_id,id) deferrable initially deferred;
create table public.agent_run_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, actor_id uuid not null, run_id uuid not null,
  seq bigint not null, kind text not null, model_call_id uuid, tool_call_id text, skill_run_id uuid,
  metadata jsonb not null default '{}', created_at timestamptz not null default clock_timestamp(), unique(run_id,seq),
  foreign key(tenant_id,actor_id,run_id) references public.agent_runs(tenant_id,actor_id,id)
);
create unique index agent_run_usage_once on public.agent_run_events(run_id,model_call_id) where kind='model.usage';
create index agent_runs_actor_created on public.agent_runs(tenant_id,actor_id,created_at desc);
create index agent_messages_conversation_created on public.agent_messages(conversation_id,created_at);

-- Additive extension. Unknown call usage lives in RunEvent; never fake old non-null counters as zero.
alter table public.ai_token_usage
  add column run_id uuid references public.agent_runs(id), add column model_call_id uuid,
  add column attempt_index integer, add column usage_status text check(usage_status in ('reported','estimated','unknown')),
  add column duration_ms integer;
create unique index agent_usage_call_once on public.ai_token_usage(run_id,model_call_id) where run_id is not null;
create policy agent_usage_browser_insert_boundary on public.ai_token_usage as restrictive for insert to authenticated with check(run_id is null);
create policy agent_usage_browser_update_boundary on public.ai_token_usage as restrictive for update to authenticated using(run_id is null) with check(run_id is null);
create policy agent_usage_browser_delete_boundary on public.ai_token_usage as restrictive for delete to authenticated using(run_id is null);

create function agent_core_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'AGENT_IMMUTABLE'; end $$;
create trigger agent_definition_immutable before update or delete on public.agent_definition_versions for each row execute function agent_core_private.immutable();
create trigger agent_event_immutable before update or delete on public.agent_run_events for each row execute function agent_core_private.immutable();

-- Service-only RPC parameters must come from verified Next intake, never request JSON.
-- This DB check additionally verifies live active membership; domain app/resource policy remains server-side.
create function agent_core_private.actor_guard(p_tenant uuid,p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
  if p_tenant is null or p_actor is null or not exists(
    select 1 from public.profiles p join public.tenant_memberships m on m.user_id=p.id
      join public.tenants t on t.id=m.tenant_id
    where p.id=p_actor and p.status='active' and m.tenant_id=p_tenant and m.status='active' and t.status='active'
  ) then raise exception 'FORBIDDEN'; end if;
end $$;

create function agent_core_private.definition_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform agent_core_private.actor_guard(new.tenant_id,new.actor_id);
  if (new.manifest-'agentCode'-'definitionVersion'-'status'-'promptVersion'-'contextVersion'-'model'-'allowedSkillRefs'-'allowedToolRefs'-'policyVersion'-'budget')<>'{}'::jsonb
    or new.manifest->>'agentCode' is distinct from new.agent_code
    or new.manifest#>>'{definitionVersion,name}' is distinct from new.agent_code
    or new.manifest#>>'{definitionVersion,version}' is distinct from new.version
    or new.manifest->>'status' is distinct from new.status
    or jsonb_typeof(new.manifest->'model') is distinct from 'object'
    or ((new.manifest->'model')-'provider'-'model'-'configVersion')<>'{}'::jsonb
    or new.manifest#>>'{promptVersion,version}' is null or new.manifest#>>'{contextVersion,version}' is null
  then raise exception 'INVALID_REQUEST'; end if;
  return new;
end $$;
create trigger agent_definition_guard before insert on public.agent_definition_versions for each row execute function agent_core_private.definition_guard();

create function agent_core_private.run_json(r public.agent_runs) returns jsonb language sql set search_path='' as $$
select jsonb_build_object('id',r.id,'conversationId',r.conversation_id,'inputMessageId',r.input_message_id,
  'actorId',r.actor_id,'tenantId',r.tenant_id,'agentCode',r.agent_code,'scopeRef',r.scope_ref,
  'definitionVersion',jsonb_build_object('name',r.agent_code,'version',r.profile_version),'skillRef',r.skill_ref,
  'status',r.status,'stateVersion',r.state_version,'fencingToken',r.fencing_token,'executionAttempt',r.execution_attempt,
  'leaseExpiresAt',r.lease_expires_at,'deadlineAt',r.deadline_at,'budget',r.budget,'createdAt',r.created_at);
$$;

create function agent_core_private.check_budget(b jsonb) returns void language plpgsql set search_path='' as $$
declare k text; n numeric;
begin
  if b is null or jsonb_typeof(b)<>'object' then raise exception 'BUDGET_UNAVAILABLE'; end if;
  foreach k in array array['maxModelCalls','maxToolExecutions','maxInputTokensPerCall','maxOutputTokensPerCall','reservedTokens','usedModelCalls','usedToolExecutions'] loop
    if not(b ? k) or jsonb_typeof(b->k)<>'number' then raise exception 'BUDGET_UNAVAILABLE'; end if;
    n:=(b->>k)::numeric;
    if n<0 or n<>trunc(n) or n>10000000 then raise exception 'BUDGET_UNAVAILABLE'; end if;
  end loop;
  if (b->>'maxModelCalls')::int not between 1 and 16 or (b->>'maxToolExecutions')::int>32
     or (b->>'maxInputTokensPerCall')::int<1 or (b->>'maxOutputTokensPerCall')::int not between 1 and 8192
     or (b->>'usedModelCalls')::int>(b->>'maxModelCalls')::int or (b->>'usedToolExecutions')::int>(b->>'maxToolExecutions')::int
     or (b->>'reservedTokens')::numeric < (b->>'maxModelCalls')::numeric*((b->>'maxInputTokensPerCall')::numeric+(b->>'maxOutputTokensPerCall')::numeric)
  then raise exception 'BUDGET_UNAVAILABLE'; end if;
end $$;

create function public.admit_agent_run_v1(p_tenant uuid,p_actor uuid,p_conversation uuid,p_agent text,p_app text,p_scope_kind text,p_scope_ref text,
  p_key text,p_digest text,p_message text,p_definition_version text,p_skill jsonb,p_budget jsonb,p_deadline timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.agent_conversations; r public.agent_runs; d public.agent_definition_versions; rid uuid:=gen_random_uuid(); mid uuid:=gen_random_uuid();
begin
  perform agent_core_private.actor_guard(p_tenant,p_actor);
  if p_app is null or length(p_app)=0 or p_scope_ref is null or length(p_scope_ref)=0 or p_conversation is null then raise exception 'FORBIDDEN'; end if;
  -- The transaction lock also serializes first conversation creation on retry.
  perform pg_advisory_xact_lock(hashtextextended(p_conversation::text, 908));
  select * into c from public.agent_conversations where id=p_conversation for update;
  if found and (c.tenant_id<>p_tenant or c.actor_id<>p_actor or c.agent_code<>p_agent or c.app_id<>p_app or c.scope_kind<>p_scope_kind or c.scope_ref<>p_scope_ref or c.status<>'active') then raise exception 'FORBIDDEN'; end if;
  select * into r from public.agent_runs where conversation_id=p_conversation and tenant_id=p_tenant and actor_id=p_actor and idempotency_key=p_key;
  if found then
    if r.request_digest is distinct from p_digest then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('run',agent_core_private.run_json(r),'replayed',true);
  end if;
  if exists(select 1 from public.agent_runs where conversation_id=p_conversation and status in ('created','running','waiting_tool')) then raise exception 'CONVERSATION_BUSY'; end if;
  select * into d from public.agent_definition_versions where tenant_id=p_tenant and agent_code=p_agent and version=p_definition_version and status='published';
  if not found then raise exception 'BUDGET_UNAVAILABLE'; end if;
  perform agent_core_private.check_budget(p_budget);
  if (p_budget-'deadlineAt'-'usedModelCalls'-'usedToolExecutions') is distinct from (d.manifest->'budget')
     or (p_budget->>'usedModelCalls')::int<>0 or (p_budget->>'usedToolExecutions')::int<>0
     or p_deadline is null or p_deadline<=clock_timestamp() or p_deadline>clock_timestamp()+interval '45 seconds'
     or (p_budget->>'deadlineAt')::timestamptz is distinct from p_deadline
     or not coalesce((d.manifest->'allowedSkillRefs') @> jsonb_build_array(p_skill),false)
  then raise exception 'BUDGET_UNAVAILABLE'; end if;
  if p_message is null or length(trim(p_message)) not between 1 and 8000 then raise exception 'INVALID_REQUEST'; end if;
  if c.id is null then
    insert into public.agent_conversations(id,tenant_id,actor_id,agent_code,app_id,scope_kind,scope_ref)
      values(p_conversation,p_tenant,p_actor,p_agent,p_app,p_scope_kind,p_scope_ref);
  end if;
  insert into public.agent_runs(id,tenant_id,actor_id,conversation_id,input_message_id,definition_id,agent_code,profile_version,skill_ref,scope_ref,idempotency_key,request_digest,budget,deadline_at,lease_expires_at)
    values(rid,p_tenant,p_actor,p_conversation,mid,d.id,p_agent,p_definition_version,p_skill,p_scope_ref,p_key,p_digest,p_budget,p_deadline,p_deadline) returning * into r;
  insert into public.agent_messages(id,tenant_id,actor_id,conversation_id,run_id,role,content,state)
    values(mid,p_tenant,p_actor,p_conversation,rid,'user',p_message,'accepted');
  return jsonb_build_object('run',agent_core_private.run_json(r),'replayed',false);
end $$;

create function public.transition_agent_run_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_expected_status text,p_expected_version integer,p_fence uuid,p_to text,p_budget jsonb,p_final text default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; terminal boolean;
begin
  -- Stop-only cleanup remains valid after membership/authority expiry. The
  -- service-only caller still supplies bound owner IDs and the live fence/version.
  if p_to not in ('failed','cancelled') then perform agent_core_private.actor_guard(p_tenant,p_actor); end if;
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if r.status in ('completed','failed','cancelled') or r.status is distinct from p_expected_status or r.state_version is distinct from p_expected_version or r.fencing_token is distinct from p_fence then raise exception 'PERSISTENCE_FAILED'; end if;
  if not coalesce((r.status='created' and p_to in ('running','failed','cancelled')) or (r.status='running' and p_to in ('waiting_tool','completed','failed','cancelled')) or (r.status='waiting_tool' and p_to in ('running','failed','cancelled')),false) then raise exception 'PERSISTENCE_FAILED'; end if;
  terminal:=p_to in ('completed','failed','cancelled');
  if p_to not in ('failed','cancelled') and least(r.deadline_at,r.lease_expires_at)<=clock_timestamp() then raise exception 'DEADLINE_EXCEEDED'; end if;
  perform agent_core_private.check_budget(p_budget);
  if (p_budget-'usedModelCalls'-'usedToolExecutions') is distinct from (r.budget-'usedModelCalls'-'usedToolExecutions')
    or (p_budget->>'usedModelCalls')::int<(r.budget->>'usedModelCalls')::int
    or (p_budget->>'usedToolExecutions')::int<(r.budget->>'usedToolExecutions')::int then raise exception 'BUDGET_UNAVAILABLE'; end if;
  if p_to='completed' and p_final is null then raise exception 'INVALID_REQUEST'; end if;
  if not terminal and p_final is not null then raise exception 'INVALID_REQUEST'; end if;
  update public.agent_runs set status=p_to,state_version=state_version+1,budget=p_budget,
    terminal_reason=case when terminal then left(p_reason,100) else null end,
    ended_at=case when terminal then clock_timestamp() else null end where id=p_run returning * into r;
  if terminal and p_final is not null then
    insert into public.agent_messages(tenant_id,actor_id,conversation_id,run_id,role,content,state)
      values(p_tenant,p_actor,r.conversation_id,p_run,'assistant',p_final,case when p_to='completed' then 'final' else 'partial' end);
  end if;
  if terminal then
    insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,metadata)
      select p_tenant,p_actor,p_run,coalesce(max(seq),0)+1,'run.'||p_to,'{}'::jsonb from public.agent_run_events where run_id=p_run;
  end if;
  return agent_core_private.run_json(r);
end $$;

create function public.append_agent_run_event_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_version integer,p_fence uuid,p_event jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.agent_runs;
begin
  perform agent_core_private.actor_guard(p_tenant,p_actor);
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if r.state_version is distinct from p_version or r.fencing_token is distinct from p_fence or r.status in ('completed','failed','cancelled') then raise exception 'PERSISTENCE_FAILED'; end if;
  if p_event->>'kind' is null or p_event->>'kind' not in ('run.started','permission.checked','context.resolved','skill.selected','model.started','tool.started','tool.completed')
     or (p_event-'kind'-'runId'-'at'-'modelCallId'-'toolCallId'-'skillRunId'-'contextSnapshotId'-'errorCode')<>'{}'::jsonb
     or p_event->>'runId' is distinct from p_run::text then raise exception 'INVALID_REQUEST'; end if;
  if p_event->>'kind'='context.resolved' and (p_event->>'contextSnapshotId' is null
    or (r.context_metadata ? 'snapshotId' and r.context_metadata->>'snapshotId' is distinct from p_event->>'contextSnapshotId')) then raise exception 'INVALID_REQUEST'; end if;
  insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,model_call_id,tool_call_id,skill_run_id,metadata)
    select p_tenant,p_actor,p_run,coalesce(max(seq),0)+1,p_event->>'kind',(p_event->>'modelCallId')::uuid,p_event->>'toolCallId',(p_event->>'skillRunId')::uuid,
      jsonb_strip_nulls(jsonb_build_object('errorCode',p_event->>'errorCode','contextSnapshotId',p_event->>'contextSnapshotId')) from public.agent_run_events where run_id=p_run;
  if p_event->>'kind'='context.resolved' then
    update public.agent_runs set context_metadata=jsonb_build_object('snapshotId',(p_event->>'contextSnapshotId')::uuid) where id=p_run;
  end if;
end $$;

create function public.record_agent_usage_v1(p_tenant uuid,p_actor uuid,p_run uuid,p_version integer,p_fence uuid,p_record jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; u jsonb:=p_record->'usage'; old_record jsonb; n text;
begin
  -- Accounting for an already-started call is allowed during stop cleanup.
  select * into r from public.agent_runs where id=p_run and tenant_id=p_tenant and actor_id=p_actor for update;
  if not found then raise exception 'RUN_NOT_FOUND'; end if;
  if r.state_version is distinct from p_version or r.fencing_token is distinct from p_fence or r.status in ('completed','failed','cancelled') then raise exception 'PERSISTENCE_FAILED'; end if;
  if (p_record-'runId'-'modelCallId'-'attemptIndex'-'provider'-'model'-'durationMs'-'usage')<>'{}'::jsonb
    or p_record->>'runId' is distinct from p_run::text or p_record->>'modelCallId' is null
    or (p_record->>'attemptIndex')::int is distinct from r.execution_attempt or (p_record->>'durationMs')::int<0
    or u->>'status' is null or u->>'status' not in ('reported','estimated','unknown') then raise exception 'INVALID_REQUEST'; end if;
  if u->>'status'='unknown' then
    if u<>jsonb_build_object('status','unknown') then raise exception 'INVALID_REQUEST'; end if;
  else
    foreach n in array array['inputTokens','outputTokens','totalTokens'] loop
      if u->>n is null or (u->>n)::int<0 then raise exception 'INVALID_REQUEST'; end if;
    end loop;
    if (u-'status'-'inputTokens'-'outputTokens'-'totalTokens')<>'{}'::jsonb or (u->>'totalTokens')::int<>(u->>'inputTokens')::int+(u->>'outputTokens')::int then raise exception 'INVALID_REQUEST'; end if;
  end if;
  select metadata into old_record from public.agent_run_events where run_id=p_run and model_call_id=(p_record->>'modelCallId')::uuid and kind='model.usage';
  if found then
    if old_record is distinct from p_record then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return;
  end if;
  insert into public.agent_run_events(tenant_id,actor_id,run_id,seq,kind,model_call_id,metadata)
    select p_tenant,p_actor,p_run,coalesce(max(seq),0)+1,'model.usage',(p_record->>'modelCallId')::uuid,p_record from public.agent_run_events where run_id=p_run;
  if u->>'status'<>'unknown' then
    insert into public.ai_token_usage(user_id,tenant_id,provider,model,feature_code,agent_code,input_tokens,output_tokens,total_tokens,run_id,model_call_id,attempt_index,usage_status,duration_ms)
      values(p_actor,p_tenant,p_record->>'provider',p_record->>'model','agent_core',r.agent_code,(u->>'inputTokens')::int,(u->>'outputTokens')::int,(u->>'totalTokens')::int,p_run,(p_record->>'modelCallId')::uuid,r.execution_attempt,u->>'status',(p_record->>'durationMs')::int);
  end if;
end $$;

do $$ declare tbl text; fn record; begin
  foreach tbl in array array['agent_definition_versions','agent_conversations','agent_messages','agent_runs','agent_run_events'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',tbl);
    execute format('grant select on public.%I to service_role',tbl);
  end loop;
  -- Definition publishing is an explicit server control-plane action, never a browser operation.
  grant insert on public.agent_definition_versions to service_role;
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='agent_core_private') or (n.nspname='public' and p.proname in ('admit_agent_run_v1','transition_agent_run_v1','append_agent_run_event_v1','record_agent_usage_v1')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',fn.signature);
    if fn.signature::text not like 'agent_core_private.%' then execute format('grant execute on function %s to service_role',fn.signature); end if;
  end loop;
end $$;
commit;
