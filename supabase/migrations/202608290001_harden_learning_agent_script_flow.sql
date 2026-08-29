-- Prevent broken teaching flows from reaching students.
-- Older drafts used an invisible action to mark completion. Preserve that intent
-- while moving completion into the explicit flow configuration.
update public.learning_agent_script_nodes
set configuration = jsonb_set(configuration, '{terminal}', 'true'::jsonb, true),
    action_type = 'none',
    next_node_key = null
where action_type = 'complete_lesson';

create or replace function public.publish_learning_agent_script_version(
  p_script_version_id uuid,
  p_change_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_version public.learning_agent_script_versions%rowtype;
  v_node_count integer;
  v_terminal_count integer;
  v_reachable_count integer;
  v_has_cycle boolean;
  v_missing_link text;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以发布教学脚本';
  end if;

  select * into v_version
  from public.learning_agent_script_versions
  where id = p_script_version_id
  for update;
  if not found then raise exception '没有找到要发布的教学脚本'; end if;
  if v_version.status <> 'draft' then raise exception '只有草稿版本可以发布'; end if;

  select count(*) into v_node_count
  from public.learning_agent_script_nodes
  where script_version_id = p_script_version_id;
  if v_node_count = 0 then raise exception '教学脚本至少需要一个小节'; end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and nullif(trim(node.teacher_script->>'zh-CN'), '') is null
  ) then
    raise exception '每个教学小节都必须填写中文老师台词';
  end if;

  select coalesce(node.next_node_key, node.remediation_node_key) into v_missing_link
  from public.learning_agent_script_nodes node
  where node.script_version_id = p_script_version_id
    and (
      (node.next_node_key is not null and not exists (
        select 1 from public.learning_agent_script_nodes target
        where target.script_version_id = p_script_version_id
          and target.node_key = node.next_node_key
      ))
      or
      (node.remediation_node_key is not null and not exists (
        select 1 from public.learning_agent_script_nodes target
        where target.script_version_id = p_script_version_id
          and target.node_key = node.remediation_node_key
      ))
    )
  limit 1;
  if v_missing_link is not null then raise exception '教学流程引用了不存在的小节：%', v_missing_link; end if;

  select count(*) into v_terminal_count
  from public.learning_agent_script_nodes node
  where node.script_version_id = p_script_version_id
    and node.configuration->'terminal' = 'true'::jsonb;
  if v_terminal_count <> 1 then
    raise exception '教学流程必须且只能设置一个“结束当前学习步骤”的小节';
  end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and node.configuration->'terminal' = 'true'::jsonb
      and node.next_node_key is not null
  ) then
    raise exception '结束小节不能再设置后续跳转';
  end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and node.configuration->'terminal' is distinct from 'true'::jsonb
      and node.next_node_key is null
      and not exists (
        select 1 from public.learning_agent_script_nodes later
        where later.script_version_id = p_script_version_id
          and later.sort_order > node.sort_order
      )
  ) then
    raise exception '最后一个小节必须设置为“结束当前学习步骤”';
  end if;

  with recursive flow_walk as (
    select
      first_node.id,
      first_node.node_key,
      first_node.sort_order,
      first_node.next_node_key,
      first_node.configuration,
      array[first_node.id]::uuid[] as visited_ids,
      false as has_cycle
    from (
      select node.id, node.node_key, node.sort_order, node.next_node_key, node.configuration
      from public.learning_agent_script_nodes node
      where node.script_version_id = p_script_version_id
      order by node.sort_order, node.id
      limit 1
    ) first_node

    union all

    select
      target.id,
      target.node_key,
      target.sort_order,
      target.next_node_key,
      target.configuration,
      current_node.visited_ids || target.id,
      target.id = any(current_node.visited_ids)
    from flow_walk current_node
    join lateral (
      select candidate.id, candidate.node_key, candidate.sort_order,
        candidate.next_node_key, candidate.configuration
      from public.learning_agent_script_nodes candidate
      where candidate.script_version_id = p_script_version_id
        and (
          (current_node.next_node_key is not null and candidate.node_key = current_node.next_node_key)
          or
          (
            current_node.next_node_key is null
            and current_node.configuration->'terminal' is distinct from 'true'::jsonb
            and candidate.sort_order > current_node.sort_order
          )
        )
      order by candidate.sort_order, candidate.id
      limit 1
    ) target on true
    where not current_node.has_cycle
      and current_node.configuration->'terminal' is distinct from 'true'::jsonb
  )
  select count(distinct id), coalesce(bool_or(has_cycle), false)
  into v_reachable_count, v_has_cycle
  from flow_walk;

  if v_has_cycle then raise exception '教学流程存在循环跳转，请重新选择后续小节'; end if;
  if v_reachable_count <> v_node_count then
    raise exception '教学流程中存在无法到达的小节，请检查跳转设置和小节顺序';
  end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and node.node_type = 'question'
      and node.reference_activity_id is null
      and coalesce(node.configuration->'interaction'->>'kind', '') <> 'single_choice'
  ) then
    raise exception '理解检查必须新建单选题或选择一个教材活动';
  end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and coalesce(node.configuration->'interaction'->>'kind', '') = 'single_choice'
      and (
        jsonb_typeof(node.configuration->'interaction'->'options') <> 'array'
        or jsonb_array_length(node.configuration->'interaction'->'options') < 2
        or not exists (
          select 1 from public.learning_agent_node_interaction_secrets secret
          where secret.node_id = node.id
            and secret.correct_option_index >= 0
            and secret.correct_option_index < jsonb_array_length(node.configuration->'interaction'->'options')
        )
      )
  ) then
    raise exception '自定义单选检查缺少有效选项或正确答案';
  end if;

  if exists (
    select 1 from public.learning_agent_script_nodes node
    where node.script_version_id = p_script_version_id
      and (
        (node.action_type = 'focus_activity' and node.reference_activity_id is null)
        or
        (node.action_type = 'play_expression' and coalesce(node.configuration->'studentTask'->>'kind', '') <> 'play_expression_audio')
        or node.action_type not in ('none', 'focus_activity', 'play_expression')
      )
  ) then
    raise exception '教学小节包含无效的页面联动设置';
  end if;

  update public.learning_agent_script_versions
  set status = 'archived'
  where lesson_id = v_version.lesson_id and status = 'published';

  update public.learning_agent_script_versions
  set status = 'published',
      change_note = left(trim(coalesce(p_change_note, '')), 500),
      published_by = auth.uid(),
      published_at = now()
  where id = p_script_version_id;

  update public.learning_agent_lessons
  set revision = v_version.version_number,
      status = 'published'
  where id = v_version.lesson_id;

  insert into public.learning_agent_publish_logs (
    lesson_id, script_version_id, action, actor_id, details
  ) values (
    v_version.lesson_id, p_script_version_id, 'publish', auth.uid(),
    jsonb_build_object(
      'changeNote', left(trim(coalesce(p_change_note, '')), 500),
      'nodeCount', v_node_count,
      'terminalCount', v_terminal_count
    )
  );

  return jsonb_build_object(
    'scriptVersionId', p_script_version_id,
    'versionNumber', v_version.version_number,
    'nodeCount', v_node_count
  );
end;
$$;

revoke all on function public.publish_learning_agent_script_version(uuid, text) from public, anon;
grant execute on function public.publish_learning_agent_script_version(uuid, text) to authenticated;
