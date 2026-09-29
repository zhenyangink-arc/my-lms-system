-- Keep publication dependency capture strict for every answer-graded activity,
-- while allowing the Chapter 1 dialogue roleplay to use its actual atomic
-- recording-evidence completion path (which has no answer-key secret).

create or replace function public.publish_runtime_snapshot_v2(
  p_actor uuid,
  p_scope jsonb,
  p_expected jsonb,
  p_operation text,
  p_bundle jsonb,
  p_target text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  captured jsonb;
begin
  perform runtime_publish_private.owner_guard(p_actor);
  perform runtime_publish_private.authoring_lock();

  if p_operation = 'publish' then
    captured := runtime_publish_private.capture(p_scope);
    if p_bundle #> '{privatePayload,dependencies}' is distinct from captured then
      raise exception 'PUBLICATION_SOURCE_CAPTURE_CONFLICT' using errcode = '40001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(captured -> 'digital_textbook_activities') as activity
      where not (
        activity ->> 'activity_key' = 'dialogue-roleplay'
        and activity ->> 'activity_type' = 'speaking'
      )
      and (
        select count(*)
        from jsonb_array_elements(captured -> 'digital_textbook_activity_secrets') as secret
        where secret ->> 'activity_id' = activity ->> 'id'
      ) <> 1
    ) then
      raise exception 'PUBLICATION_GRADER_DEPENDENCY_MISSING';
    end if;
  else
    if not exists (
      select 1
      from runtime_publish_private.dependency_fences
      where snapshot_id = p_target
    ) then
      raise exception 'PUBLICATION_UNFENCED_ROLLBACK';
    end if;
  end if;

  result := public.publish_runtime_snapshot_v1(
    p_actor, p_scope, p_expected, p_operation, p_bundle, p_target
  );
  if p_operation = 'publish' then
    insert into runtime_publish_private.dependency_fences
    values (p_bundle ->> 'snapshotId', p_scope, captured)
    on conflict (snapshot_id) do nothing;
  end if;
  return result;
end
$$;

revoke all on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) to service_role;

