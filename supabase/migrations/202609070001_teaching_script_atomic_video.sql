begin;

-- One transaction for public lesson content and the private answer key.
create function public.save_teaching_script_node_atomic(
  p_node_id uuid, p_expected_updated_at timestamptz, p_node jsonb, p_secret jsonb
) returns jsonb language plpgsql security definer
set search_path = public, private, auth as $$
declare
  v_current public.learning_agent_script_nodes%rowtype;
  v_input public.learning_agent_script_nodes%rowtype;
  v_version_id uuid;
  v_status text;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以修改教学脚本';
  end if;
  -- Same table-lock order as publication, before taking any version/row locks.
  lock table public.learning_agent_script_nodes in row exclusive mode;
  lock table public.learning_agent_node_interaction_secrets in row exclusive mode;
  select script_version_id into v_version_id from public.learning_agent_script_nodes where id = p_node_id;
  select status into v_status from public.learning_agent_script_versions where id = v_version_id for update;
  if v_status is distinct from 'draft' then raise exception '只有草稿中的教学小节可以修改。'; end if;
  select * into v_current from public.learning_agent_script_nodes where id = p_node_id for update;
  if not found or v_current.updated_at is distinct from p_expected_updated_at then
    raise exception '这个小节已经被其他操作更新，请刷新页面后重新编辑，避免覆盖别人的修改。';
  end if;
  v_input := jsonb_populate_record(v_current, p_node);
  if v_input.configuration #>> '{interaction,kind}' = 'single_choice' then
    if p_secret is null or jsonb_typeof(v_input.configuration #> '{interaction,options}') is distinct from 'array' then
      raise exception '单选题必须同时保存选项和正确答案。';
    end if;
    if jsonb_array_length(v_input.configuration #> '{interaction,options}') not between 2 and 6
      or (p_secret->>'correct_option_index') is null
      or (p_secret->>'correct_option_index')::integer not between 0 and jsonb_array_length(v_input.configuration #> '{interaction,options}') - 1 then
      raise exception '正确答案与当前选项不匹配。';
    end if;
  end if;
  update public.learning_agent_script_nodes set
    node_key = v_input.node_key, node_type = v_input.node_type, title = v_input.title,
    teacher_script = v_input.teacher_script, configuration = v_input.configuration,
    reference_activity_id = v_input.reference_activity_id, action_type = v_input.action_type,
    next_node_key = v_input.next_node_key, remediation_node_key = v_input.remediation_node_key,
    is_required = v_input.is_required
  where id = p_node_id;
  if v_input.configuration #>> '{interaction,kind}' = 'single_choice' then
    insert into public.learning_agent_node_interaction_secrets
      (node_id, correct_option_index, correct_feedback, incorrect_feedback, evaluation)
    values (p_node_id, (p_secret->>'correct_option_index')::smallint,
      p_secret->'correct_feedback', p_secret->'incorrect_feedback', p_secret->'evaluation')
    on conflict (node_id) do update set
      correct_option_index = excluded.correct_option_index, correct_feedback = excluded.correct_feedback,
      incorrect_feedback = excluded.incorrect_feedback, evaluation = excluded.evaluation;
  else
    delete from public.learning_agent_node_interaction_secrets where node_id = p_node_id;
  end if;
  return jsonb_build_object('id', p_node_id);
end;
$$;
revoke all on function public.save_teaching_script_node_atomic(uuid,timestamptz,jsonb,jsonb) from public, anon;
grant execute on function public.save_teaching_script_node_atomic(uuid,timestamptz,jsonb,jsonb) to authenticated;

-- A single SQL statement observes a consistent snapshot, including private answers.
-- Answers participate in the fingerprint but are never returned by this endpoint.
create function public.teaching_script_publish_snapshot(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, auth as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not private.is_platform_owner() then raise exception '只有平台负责人可以检查教学脚本'; end if;
  select jsonb_build_object(
    'nodes', coalesce(n.nodes, '[]'::jsonb),
    'token', md5(jsonb_build_object('version', to_jsonb(v), 'nodes', n.nodes, 'answers', n.answers)::text)
  ) into v_result
  from public.learning_agent_script_versions v
  cross join lateral (
    select jsonb_agg(to_jsonb(node) order by node.id) as nodes,
      jsonb_agg(to_jsonb(secret) order by node.id) as answers
    from public.learning_agent_script_nodes node
    left join public.learning_agent_node_interaction_secrets secret on secret.node_id = node.id
    where node.script_version_id = v.id
  ) n where v.id = p_version_id and v.status = 'draft';
  if v_result is null then raise exception '只有草稿版本可以发布'; end if;
  return v_result;
end;
$$;
revoke all on function public.teaching_script_publish_snapshot(uuid) from public, anon;
grant execute on function public.teaching_script_publish_snapshot(uuid) to authenticated;

-- Keep existing graph validation, but remove the old unchecked public entrypoint.
alter function public.publish_learning_agent_script_version(uuid,text) rename to publish_learning_agent_script_version_unchecked;
revoke all on function public.publish_learning_agent_script_version_unchecked(uuid,text) from public, anon, authenticated, service_role;

create function public.publish_teaching_script_checked(p_script_version_id uuid, p_change_note text, p_expected_token text)
returns jsonb language plpgsql security definer set search_path = public, private, auth as $$
declare v_snapshot jsonb;
begin
  if auth.uid() is null or not private.is_platform_owner() then raise exception '只有平台负责人可以发布教学脚本'; end if;
  -- Short commit-time locks cover updates, answers, deletion, insertion and ordering.
  -- No database lock is held while the application checks R2 over the network.
  lock table public.learning_agent_script_nodes in share row exclusive mode;
  lock table public.learning_agent_node_interaction_secrets in share row exclusive mode;
  perform 1 from public.learning_agent_script_versions where id = p_script_version_id for update;
  v_snapshot := public.teaching_script_publish_snapshot(p_script_version_id);
  if p_expected_token is null or v_snapshot->>'token' is distinct from p_expected_token then
    raise exception '检查期间教学脚本已修改，请重新检查后再发布。';
  end if;
  return public.publish_learning_agent_script_version_unchecked(p_script_version_id, p_change_note);
end;
$$;
revoke all on function public.publish_teaching_script_checked(uuid,text,text) from public, anon;
grant execute on function public.publish_teaching_script_checked(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
