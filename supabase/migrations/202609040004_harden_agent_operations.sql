begin;

create or replace function private.valid_guide_agent_trigger_phrases(value text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(value) between 1 and 20
    and not exists (
      select 1
      from unnest(value) as phrase
      where char_length(btrim(phrase)) not between 2 and 80
    );
$$;

revoke all on function private.valid_guide_agent_trigger_phrases(text[])
  from public, anon, authenticated, service_role;

alter table public.guide_agent_navigation_rules
  drop constraint if exists guide_agent_navigation_rules_trigger_phrases_valid,
  add constraint guide_agent_navigation_rules_trigger_phrases_valid
    check (private.valid_guide_agent_trigger_phrases(trigger_phrases)),
  drop constraint if exists guide_agent_navigation_rules_target_path_allowed,
  add constraint guide_agent_navigation_rules_target_path_allowed check (
    target_path in (
      '/dashboard',
      '/dashboard/courses',
      '/dashboard/courses/korean/korean-basic/korean-beginner',
      '/dashboard/practice/course',
      '/dashboard/practice/skills',
      '/dashboard/practice/review#guide-target-review-questions',
      '/dashboard/assignments',
      '/dashboard/assignments/korean',
      '/dashboard/universities',
      '/dashboard/universities/targets',
      '/dashboard/universities/library',
      '/dashboard#reminders'
    )
  );

create table if not exists public.guide_agent_navigation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null,
  agent_profile_id uuid not null references public.learning_agent_profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_type text not null check (
    change_type in ('created', 'updated', 'enabled', 'disabled', 'deleted', 'rollback')
  ),
  source_version_number integer check (source_version_number is null or source_version_number > 0),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (rule_id, version_number)
);

create index if not exists guide_agent_navigation_rule_versions_rule_idx
  on public.guide_agent_navigation_rule_versions(rule_id, version_number desc);

create table if not exists public.guide_agent_failures (
  id uuid primary key default gen_random_uuid(),
  agent_profile_id uuid not null references public.learning_agent_profiles(id) on delete cascade,
  session_id uuid not null references public.guide_agent_sessions(id) on delete cascade,
  user_message_id uuid not null references public.guide_agent_messages(id) on delete cascade,
  stage text not null check (stage in ('environment', 'upstream', 'stream', 'persistence', 'historical')),
  error_code text not null check (error_code ~ '^[a-z0-9_]{3,80}$'),
  provider text,
  model text,
  public_message text not null check (char_length(public_message) between 2 and 240),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_message_id)
);

create index if not exists guide_agent_failures_profile_created_idx
  on public.guide_agent_failures(agent_profile_id, created_at desc);
create index if not exists guide_agent_failures_session_created_idx
  on public.guide_agent_failures(session_id, created_at);

alter table public.guide_agent_navigation_rule_versions enable row level security;
alter table public.guide_agent_failures enable row level security;

revoke all on public.guide_agent_navigation_rules from public, anon, authenticated, service_role;
revoke all on public.guide_agent_operation_logs from public, anon, authenticated, service_role;
revoke all on public.guide_agent_navigation_rule_versions from public, anon, authenticated, service_role;
revoke all on public.guide_agent_failures from public, anon, authenticated, service_role;

grant select on public.guide_agent_navigation_rules to service_role;
grant select on public.guide_agent_operation_logs to service_role;
grant select on public.guide_agent_navigation_rule_versions to service_role;
grant select, insert on public.guide_agent_failures to service_role;

insert into public.guide_agent_navigation_rule_versions (
  rule_id,
  agent_profile_id,
  version_number,
  snapshot,
  change_type,
  actor_id,
  created_at
)
select
  rule.id,
  rule.agent_profile_id,
  1,
  jsonb_build_object(
    'name', rule.name,
    'trigger_phrases', to_jsonb(rule.trigger_phrases),
    'action_type', rule.action_type,
    'target_path', rule.target_path,
    'target_element_id', rule.target_element_id,
    'response_text', rule.response_text,
    'priority', rule.priority,
    'status', rule.status
  ),
  'created',
  coalesce(rule.updated_by, rule.created_by),
  rule.created_at
from public.guide_agent_navigation_rules as rule
where not exists (
  select 1
  from public.guide_agent_navigation_rule_versions as version
  where version.rule_id = rule.id
);

insert into public.guide_agent_failures (
  agent_profile_id,
  session_id,
  user_message_id,
  stage,
  error_code,
  public_message,
  duration_ms
)
select
  session.agent_profile_id,
  session.id,
  latest_message.id,
  'historical',
  'historical_unanswered',
  '该历史会话没有保存到助手回复。',
  null
from public.guide_agent_sessions as session
join lateral (
  select message.id, message.role
  from public.guide_agent_messages as message
  where message.session_id = session.id
  order by message.created_at desc, message.id desc
  limit 1
) as latest_message on latest_message.role = 'user'
on conflict (user_message_id) do nothing;

create or replace function private.enforce_guide_agent_event_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Agent 运营审计和事件记录只允许追加，历史记录不可修改或删除';
end;
$$;

revoke all on function private.enforce_guide_agent_event_append_only()
  from public, anon, authenticated, service_role;

drop trigger if exists guide_agent_operation_logs_append_only on public.guide_agent_operation_logs;
create trigger guide_agent_operation_logs_append_only
before update or delete on public.guide_agent_operation_logs
for each row execute function private.enforce_guide_agent_event_append_only();

drop trigger if exists guide_agent_navigation_rule_versions_append_only on public.guide_agent_navigation_rule_versions;
create trigger guide_agent_navigation_rule_versions_append_only
before update or delete on public.guide_agent_navigation_rule_versions
for each row execute function private.enforce_guide_agent_event_append_only();

drop trigger if exists guide_agent_failures_append_only on public.guide_agent_failures;
create trigger guide_agent_failures_append_only
before update or delete on public.guide_agent_failures
for each row execute function private.enforce_guide_agent_event_append_only();

drop trigger if exists learning_agent_model_change_logs_append_only on public.learning_agent_model_change_logs;
create trigger learning_agent_model_change_logs_append_only
before update or delete on public.learning_agent_model_change_logs
for each row execute function private.enforce_guide_agent_event_append_only();

create or replace function public.save_guide_agent_navigation_rule(
  p_rule_id uuid,
  p_agent_profile_id uuid,
  p_name text,
  p_trigger_phrases text[],
  p_action_type text,
  p_target_path text,
  p_target_element_id text,
  p_response_text text,
  p_priority integer,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rule public.guide_agent_navigation_rules%rowtype;
  v_version integer;
  v_change_type text;
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  if not exists (
    select 1 from public.learning_agent_profiles
    where id = p_agent_profile_id and agent_code = 'uply-guide-agent' and status = 'published'
  ) then
    raise exception 'guide agent profile not found';
  end if;

  if p_rule_id is null then
    insert into public.guide_agent_navigation_rules (
      agent_profile_id, name, trigger_phrases, action_type, target_path,
      target_element_id, response_text, priority, status, created_by, updated_by
    ) values (
      p_agent_profile_id, btrim(p_name), p_trigger_phrases, p_action_type, p_target_path,
      case when p_action_type = 'highlight' then nullif(btrim(p_target_element_id), '') else null end,
      btrim(p_response_text), p_priority, p_status, v_actor_id, v_actor_id
    ) returning * into v_rule;
    v_change_type := 'created';
  else
    update public.guide_agent_navigation_rules
    set name = btrim(p_name),
        trigger_phrases = p_trigger_phrases,
        action_type = p_action_type,
        target_path = p_target_path,
        target_element_id = case when p_action_type = 'highlight' then nullif(btrim(p_target_element_id), '') else null end,
        response_text = btrim(p_response_text),
        priority = p_priority,
        status = p_status,
        updated_by = v_actor_id
    where id = p_rule_id and agent_profile_id = p_agent_profile_id
    returning * into v_rule;
    if not found then raise exception 'navigation rule not found'; end if;
    v_change_type := 'updated';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.guide_agent_navigation_rule_versions
  where rule_id = v_rule.id;

  insert into public.guide_agent_navigation_rule_versions (
    rule_id, agent_profile_id, version_number, snapshot, change_type, actor_id
  ) values (
    v_rule.id,
    v_rule.agent_profile_id,
    v_version,
    jsonb_build_object(
      'name', v_rule.name,
      'trigger_phrases', to_jsonb(v_rule.trigger_phrases),
      'action_type', v_rule.action_type,
      'target_path', v_rule.target_path,
      'target_element_id', v_rule.target_element_id,
      'response_text', v_rule.response_text,
      'priority', v_rule.priority,
      'status', v_rule.status
    ),
    v_change_type,
    v_actor_id
  );

  insert into public.guide_agent_operation_logs (
    actor_id, action, target_type, target_id, summary, details
  ) values (
    v_actor_id,
    case when v_change_type = 'created' then '新增导航规则' else '更新导航规则' end,
    'navigation_rule',
    v_rule.id,
    case when v_change_type = 'created' then '新增规则“' else '更新规则“' end || v_rule.name || '”',
    jsonb_build_object('version', v_version, 'targetPath', v_rule.target_path, 'actionType', v_rule.action_type, 'status', v_rule.status)
  );

  return v_rule.id;
end;
$$;

create or replace function public.set_guide_agent_navigation_rule_status(
  p_rule_id uuid,
  p_agent_profile_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rule public.guide_agent_navigation_rules%rowtype;
  v_version integer;
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  if p_status not in ('enabled', 'disabled') then raise exception 'invalid rule status'; end if;

  update public.guide_agent_navigation_rules
  set status = p_status, updated_by = v_actor_id
  where id = p_rule_id and agent_profile_id = p_agent_profile_id
  returning * into v_rule;
  if not found then raise exception 'navigation rule not found'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.guide_agent_navigation_rule_versions where rule_id = v_rule.id;
  insert into public.guide_agent_navigation_rule_versions (
    rule_id, agent_profile_id, version_number, snapshot, change_type, actor_id
  ) values (
    v_rule.id,
    v_rule.agent_profile_id,
    v_version,
    jsonb_build_object(
      'name', v_rule.name,
      'trigger_phrases', to_jsonb(v_rule.trigger_phrases),
      'action_type', v_rule.action_type,
      'target_path', v_rule.target_path,
      'target_element_id', v_rule.target_element_id,
      'response_text', v_rule.response_text,
      'priority', v_rule.priority,
      'status', v_rule.status
    ),
    p_status,
    v_actor_id
  );
  insert into public.guide_agent_operation_logs (actor_id, action, target_type, target_id, summary, details)
  values (
    v_actor_id,
    case when p_status = 'enabled' then '启用导航规则' else '停用导航规则' end,
    'navigation_rule',
    v_rule.id,
    case when p_status = 'enabled' then '启用规则“' else '停用规则“' end || v_rule.name || '”',
    jsonb_build_object('version', v_version, 'status', p_status)
  );
  return v_rule.id;
end;
$$;

create or replace function public.delete_guide_agent_navigation_rule(
  p_rule_id uuid,
  p_agent_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_rule public.guide_agent_navigation_rules%rowtype;
  v_version integer;
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  select * into v_rule
  from public.guide_agent_navigation_rules
  where id = p_rule_id and agent_profile_id = p_agent_profile_id
  for update;
  if not found then raise exception 'navigation rule not found'; end if;

  select coalesce(max(version_number), 0) + 1 into v_version
  from public.guide_agent_navigation_rule_versions where rule_id = v_rule.id;
  insert into public.guide_agent_navigation_rule_versions (
    rule_id, agent_profile_id, version_number, snapshot, change_type, actor_id
  ) values (
    v_rule.id,
    v_rule.agent_profile_id,
    v_version,
    jsonb_build_object(
      'name', v_rule.name,
      'trigger_phrases', to_jsonb(v_rule.trigger_phrases),
      'action_type', v_rule.action_type,
      'target_path', v_rule.target_path,
      'target_element_id', v_rule.target_element_id,
      'response_text', v_rule.response_text,
      'priority', v_rule.priority,
      'status', v_rule.status
    ),
    'deleted',
    v_actor_id
  );
  delete from public.guide_agent_navigation_rules where id = v_rule.id;
  insert into public.guide_agent_operation_logs (actor_id, action, target_type, target_id, summary, details)
  values (
    v_actor_id,
    '删除导航规则',
    'navigation_rule',
    v_rule.id,
    '删除规则“' || v_rule.name || '”',
    jsonb_build_object('version', v_version)
  );
  return v_rule.id;
end;
$$;

create or replace function public.rollback_guide_agent_navigation_rule(
  p_rule_id uuid,
  p_agent_profile_id uuid,
  p_version_number integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_source public.guide_agent_navigation_rule_versions%rowtype;
  v_rule public.guide_agent_navigation_rules%rowtype;
  v_next_version integer;
  v_trigger_phrases text[];
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  select * into v_source
  from public.guide_agent_navigation_rule_versions
  where rule_id = p_rule_id
    and agent_profile_id = p_agent_profile_id
    and version_number = p_version_number;
  if not found then raise exception 'navigation rule version not found'; end if;

  select array_agg(value order by ordinal)
  into v_trigger_phrases
  from jsonb_array_elements_text(v_source.snapshot -> 'trigger_phrases') with ordinality as phrase(value, ordinal);

  if exists (select 1 from public.guide_agent_navigation_rules where id = p_rule_id) then
    update public.guide_agent_navigation_rules
    set name = v_source.snapshot ->> 'name',
        trigger_phrases = v_trigger_phrases,
        action_type = v_source.snapshot ->> 'action_type',
        target_path = v_source.snapshot ->> 'target_path',
        target_element_id = nullif(v_source.snapshot ->> 'target_element_id', ''),
        response_text = v_source.snapshot ->> 'response_text',
        priority = (v_source.snapshot ->> 'priority')::integer,
        status = v_source.snapshot ->> 'status',
        updated_by = v_actor_id
    where id = p_rule_id and agent_profile_id = p_agent_profile_id
    returning * into v_rule;
  else
    insert into public.guide_agent_navigation_rules (
      id, agent_profile_id, name, trigger_phrases, action_type, target_path,
      target_element_id, response_text, priority, status, created_by, updated_by
    ) values (
      p_rule_id,
      p_agent_profile_id,
      v_source.snapshot ->> 'name',
      v_trigger_phrases,
      v_source.snapshot ->> 'action_type',
      v_source.snapshot ->> 'target_path',
      nullif(v_source.snapshot ->> 'target_element_id', ''),
      v_source.snapshot ->> 'response_text',
      (v_source.snapshot ->> 'priority')::integer,
      v_source.snapshot ->> 'status',
      v_actor_id,
      v_actor_id
    ) returning * into v_rule;
  end if;
  if v_rule.id is null then raise exception 'navigation rule rollback failed'; end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.guide_agent_navigation_rule_versions where rule_id = p_rule_id;
  insert into public.guide_agent_navigation_rule_versions (
    rule_id, agent_profile_id, version_number, snapshot, change_type,
    source_version_number, actor_id
  ) values (
    v_rule.id,
    v_rule.agent_profile_id,
    v_next_version,
    jsonb_build_object(
      'name', v_rule.name,
      'trigger_phrases', to_jsonb(v_rule.trigger_phrases),
      'action_type', v_rule.action_type,
      'target_path', v_rule.target_path,
      'target_element_id', v_rule.target_element_id,
      'response_text', v_rule.response_text,
      'priority', v_rule.priority,
      'status', v_rule.status
    ),
    'rollback',
    p_version_number,
    v_actor_id
  );
  insert into public.guide_agent_operation_logs (actor_id, action, target_type, target_id, summary, details)
  values (
    v_actor_id,
    '恢复导航规则版本',
    'navigation_rule',
    v_rule.id,
    '将规则“' || v_rule.name || '”恢复到版本 ' || p_version_number,
    jsonb_build_object('version', v_next_version, 'sourceVersion', p_version_number)
  );
  return v_rule.id;
end;
$$;

create or replace function public.update_guide_agent_behavior(
  p_agent_profile_id uuid,
  p_system_prompt text,
  p_max_output_characters integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  if char_length(btrim(p_system_prompt)) not between 40 and 6000 then
    raise exception 'invalid system prompt';
  end if;
  if p_max_output_characters not between 120 and 1000 then
    raise exception 'invalid output character limit';
  end if;
  update public.learning_agent_profile_secrets as secret
  set system_prompt = btrim(p_system_prompt),
      reply_policy = coalesce(secret.reply_policy, '{}'::jsonb) || jsonb_build_object('maxOutputCharacters', p_max_output_characters),
      updated_at = now()
  from public.learning_agent_profiles as profile
  where secret.agent_profile_id = p_agent_profile_id
    and profile.id = secret.agent_profile_id
    and profile.agent_code = 'uply-guide-agent'
    and profile.status = 'published';
  if not found then raise exception 'guide agent profile not found'; end if;
  insert into public.guide_agent_operation_logs (actor_id, action, target_type, target_id, summary, details)
  values (
    v_actor_id,
    '更新 Agent 配置',
    'agent_profile',
    p_agent_profile_id,
    '更新系统提示词与回复长度上限（' || p_max_output_characters || ' 字）',
    jsonb_build_object('maxOutputCharacters', p_max_output_characters)
  );
end;
$$;

create or replace function public.get_guide_agent_operations_metrics(p_agent_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  select jsonb_build_object(
    'conversations', (select count(*) from public.guide_agent_sessions where agent_profile_id = p_agent_profile_id),
    'studentQuestions', (
      select count(*) from public.guide_agent_messages as message
      join public.guide_agent_sessions as session on session.id = message.session_id
      where session.agent_profile_id = p_agent_profile_id and message.role = 'user'
    ),
    'localRuleReplies', (
      select count(*) from public.guide_agent_messages as message
      join public.guide_agent_sessions as session on session.id = message.session_id
      where session.agent_profile_id = p_agent_profile_id and message.role = 'assistant' and message.response_mode = 'local_rule'
    ),
    'modelReplies', (
      select count(*) from public.guide_agent_messages as message
      join public.guide_agent_sessions as session on session.id = message.session_id
      where session.agent_profile_id = p_agent_profile_id
        and message.role = 'assistant'
        and (message.response_mode = 'model' or (message.response_mode is null and message.provider is not null and message.provider <> 'local'))
    ),
    'failedRequests', (select count(*) from public.guide_agent_failures where agent_profile_id = p_agent_profile_id),
    'averageFirstTokenMs', (
      select round(avg(message.first_token_ms))::integer
      from public.guide_agent_messages as message
      join public.guide_agent_sessions as session on session.id = message.session_id
      where session.agent_profile_id = p_agent_profile_id
        and message.role = 'assistant'
        and message.response_mode = 'model'
        and message.first_token_ms is not null
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.list_guide_agent_conversations(
  p_agent_profile_id uuid,
  p_query text,
  p_limit integer,
  p_offset integer,
  p_audit_scope text
)
returns table (
  id uuid,
  tenant_id uuid,
  student_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  student_name text,
  tenant_name text,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_query text := nullif(btrim(p_query), '');
begin
  if not private.is_platform_owner() then
    raise insufficient_privilege using message = 'platform owner required';
  end if;
  if p_limit not between 1 and 50 or p_offset < 0 then raise exception 'invalid pagination'; end if;
  if v_query is not null and char_length(v_query) > 100 then raise exception 'query too long'; end if;
  if p_audit_scope not in ('overview', 'conversations') then raise exception 'invalid audit scope'; end if;

  insert into public.guide_agent_operation_logs (actor_id, action, target_type, target_id, summary, details)
  values (
    v_actor_id,
    '查看学生会话',
    'conversation_collection',
    p_agent_profile_id,
    case when p_audit_scope = 'overview' then '查看 Agent 最近会话摘要' else '查看 Agent 学生会话记录' end,
    jsonb_build_object('scope', p_audit_scope, 'page', floor(p_offset::numeric / p_limit) + 1, 'pageSize', p_limit, 'hasQuery', v_query is not null)
  );

  return query
  select
    session.id,
    session.tenant_id,
    session.student_id,
    session.status,
    session.created_at,
    session.updated_at,
    coalesce(nullif(btrim(profile.full_name), ''), nullif(btrim(profile.email), ''), '未填写姓名') as student_name,
    coalesce(nullif(btrim(tenant.name), ''), '未知机构') as tenant_name,
    count(*) over() as total_count
  from public.guide_agent_sessions as session
  left join public.profiles as profile on profile.id = session.student_id
  left join public.tenants as tenant on tenant.id = session.tenant_id
  where session.agent_profile_id = p_agent_profile_id
    and (
      v_query is null
      or lower(coalesce(profile.full_name, '')) like '%' || lower(v_query) || '%'
      or lower(coalesce(profile.email, '')) like '%' || lower(v_query) || '%'
      or lower(coalesce(tenant.name, '')) like '%' || lower(v_query) || '%'
      or exists (
        select 1
        from public.guide_agent_messages as message
        where message.session_id = session.id
          and lower(message.content) like '%' || lower(v_query) || '%'
      )
    )
  order by session.updated_at desc, session.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke all on function public.save_guide_agent_navigation_rule(uuid, uuid, text, text[], text, text, text, text, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_guide_agent_navigation_rule_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_guide_agent_navigation_rule(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.rollback_guide_agent_navigation_rule(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.update_guide_agent_behavior(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_guide_agent_operations_metrics(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_guide_agent_conversations(uuid, text, integer, integer, text)
  from public, anon, authenticated, service_role;

grant execute on function public.save_guide_agent_navigation_rule(uuid, uuid, text, text[], text, text, text, text, integer, text)
  to authenticated;
grant execute on function public.set_guide_agent_navigation_rule_status(uuid, uuid, text)
  to authenticated;
grant execute on function public.delete_guide_agent_navigation_rule(uuid, uuid)
  to authenticated;
grant execute on function public.rollback_guide_agent_navigation_rule(uuid, uuid, integer)
  to authenticated;
grant execute on function public.update_guide_agent_behavior(uuid, text, integer)
  to authenticated;
grant execute on function public.get_guide_agent_operations_metrics(uuid)
  to authenticated;
grant execute on function public.list_guide_agent_conversations(uuid, text, integer, integer, text)
  to authenticated;

comment on table public.guide_agent_navigation_rule_versions is
  '导航规则的不可变版本历史，可恢复当前规则或已删除规则。';
comment on table public.guide_agent_failures is
  '导航 Agent 请求失败事件，不保存供应商原始错误或密钥。';

commit;
