-- Run inside a transaction and ALWAYS roll back. Never publish a real lesson.
do $$
declare
  v_owner uuid;
  v_node public.learning_agent_script_nodes%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_snapshot jsonb;
  v_patch jsonb;
  v_secret jsonb;
  v_token text;
  v_rejected boolean;
begin
  select id into v_owner from public.profiles where global_role = 'platform_owner' and status = 'active' limit 1;
  if v_owner is null then raise exception 'Test requires an active platform owner'; end if;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select n.* into v_node from public.learning_agent_script_nodes n
  join public.learning_agent_script_versions v on v.id = n.script_version_id
  where v.status = 'draft' order by n.id limit 1;
  if v_node.id is null then raise exception 'Test requires a draft node'; end if;
  v_before := to_jsonb(v_node);
  v_patch := jsonb_build_object('configuration', v_node.configuration || jsonb_build_object('interaction',
    jsonb_build_object('kind', 'single_choice', 'prompt', jsonb_build_object('zh-CN','事务测试'), 'options', jsonb_build_array('A','B'))));
  v_secret := jsonb_build_object('correct_option_index', 1, 'correct_feedback', jsonb_build_object('zh-CN','正确'),
    'incorrect_feedback', jsonb_build_object('zh-CN','再试一次'), 'evaluation', jsonb_build_object('kind','option_index'));

  -- A constraint failure in the SECOND write must roll back the first write.
  v_rejected := false;
  begin
    perform public.save_teaching_script_node_atomic(v_node.id, v_node.updated_at, v_patch,
      v_secret || jsonb_build_object('correct_feedback', '[]'::jsonb));
  exception when check_violation then v_rejected := true;
  end;
  select to_jsonb(n) into v_after from public.learning_agent_script_nodes n where id = v_node.id;
  if not v_rejected or v_before is distinct from v_after then raise exception 'FAIL: second-write failure did not roll back node'; end if;

  -- Same revision remains usable after rollback; normal save commits both records.
  perform public.save_teaching_script_node_atomic(v_node.id, v_node.updated_at, v_patch, v_secret);
  if not exists(select 1 from public.learning_agent_node_interaction_secrets where node_id = v_node.id and correct_option_index = 1) then
    raise exception 'FAIL: answer not saved';
  end if;
  v_rejected := false;
  begin
    perform public.save_teaching_script_node_atomic(v_node.id, '1900-01-01'::timestamptz, v_patch, v_secret);
  exception when raise_exception then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: stale save accepted'; end if;

  v_snapshot := public.teaching_script_publish_snapshot(v_node.script_version_id);
  v_token := v_snapshot->>'token';
  if v_snapshot->'nodes' is null or v_token is null then raise exception 'FAIL: missing snapshot'; end if;
  -- Answer-only changes must invalidate the checked snapshot too.
  update public.learning_agent_node_interaction_secrets set correct_option_index = 0 where node_id = v_node.id;
  if public.teaching_script_publish_snapshot(v_node.script_version_id)->>'token' = v_token then raise exception 'FAIL: answer change not detected'; end if;
  v_rejected := false;
  begin
    perform public.publish_teaching_script_checked(v_node.script_version_id, 'rollback test', v_token);
  exception when raise_exception then
    if sqlerrm not like '%检查期间%' then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: publication accepted changed snapshot'; end if;
  if has_function_privilege('authenticated', 'public.publish_learning_agent_script_version_unchecked(uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: unchecked publication still exposed';
  end if;

  -- Switching off the question deletes its private answer in the same transaction.
  select * into v_node from public.learning_agent_script_nodes where id = v_node.id;
  perform public.save_teaching_script_node_atomic(v_node.id, v_node.updated_at,
    jsonb_build_object('configuration', v_node.configuration - 'interaction'), null);
  if exists(select 1 from public.learning_agent_node_interaction_secrets where node_id = v_node.id) then raise exception 'FAIL: old answer retained'; end if;
  perform set_config('request.jwt.claim.sub', '', true);
  v_rejected := false;
  begin
    perform public.teaching_script_publish_snapshot(v_node.script_version_id);
  exception when raise_exception then v_rejected := true;
  end;
  if not v_rejected then raise exception 'FAIL: anonymous snapshot access'; end if;
end;
$$;
select 'PASS: atomic rollback/retry, stale save, answer snapshot, stale publication, private RPC, answer removal, authentication' as result;
