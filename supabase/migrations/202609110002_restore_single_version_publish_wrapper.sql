-- Restore the single-version authoring wrapper after 202609110001 was applied
-- after 202609100004 in the first-enable environment. Keep the roleplay
-- evidence-grading exception in the base publisher only.
begin;

create or replace function public.publish_runtime_snapshot_base_v2(
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
  state_value text;
  book uuid := (p_scope ->> 'textbookId')::uuid;
begin
  perform runtime_publish_private.owner_guard(p_actor);
  perform runtime_publish_private.authoring_lock();
  select state into state_value
  from runtime_publish_private.authoring_control
  where textbook_id = book;
  if state_value = 'draining' then
    raise exception 'TEXTBOOK_DRAIN_INCOMPLETE';
  end if;
  if exists (
    select 1
    from runtime_publish_private.retired_snapshots
    where snapshot_id = case
      when p_operation = 'publish' then p_bundle ->> 'snapshotId'
      else p_target
    end
  ) then
    raise exception 'RETIRED_SNAPSHOT_NOT_EXECUTABLE';
  end if;
  result := public.publish_runtime_snapshot_base_v2(
    p_actor, p_scope, p_expected, p_operation, p_bundle, p_target
  );
  update runtime_publish_private.authoring_control
  set state = 'open'
  where textbook_id = book;
  return result;
end
$$;

-- Establish the single-version control row for textbooks that already have a
-- published Runtime pointer. Existing immutable snapshots remain intact. Their
-- previous capture intentionally fails the new revision fence until an owner
-- publishes a fresh snapshot through the restored wrapper.
insert into runtime_publish_private.authoring_control(textbook_id, state, revision)
select distinct snapshot.textbook_id, 'open', 1
from runtime_publish_private.pointers as pointer
join runtime_publish_private.snapshots as snapshot on snapshot.id = pointer.snapshot_id
on conflict (textbook_id) do nothing;

revoke all on function public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) to service_role;

commit;
