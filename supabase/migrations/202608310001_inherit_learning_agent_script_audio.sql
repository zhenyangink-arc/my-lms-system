begin;

-- Script nodes receive new UUIDs whenever a draft is created. Reuse the R2
-- objects from the newest compatible earlier version by creating new database
-- associations for the current version. The source rows remain untouched so
-- archived versions are still reproducible.
with target_versions as (
  select target.id, target.lesson_id, target.version_number
  from public.learning_agent_script_versions target
  where target.status in ('published', 'draft')
    and not exists (
      select 1
      from public.learning_agent_script_nodes target_node
      join public.learning_agent_script_audio_assets target_asset
        on target_asset.script_node_id = target_node.id
      where target_node.script_version_id = target.id
    )
), source_versions as (
  select
    target.id as target_version_id,
    source.id as source_version_id
  from target_versions target
  join lateral (
    select candidate.id
    from public.learning_agent_script_versions candidate
    where candidate.lesson_id = target.lesson_id
      and candidate.version_number < target.version_number
      and exists (
        select 1
        from public.learning_agent_script_nodes source_node
        join public.learning_agent_script_audio_assets source_asset
          on source_asset.script_node_id = source_node.id
        where source_node.script_version_id = candidate.id
      )
    order by candidate.version_number desc
    limit 1
  ) source on true
), compatible_nodes as (
  select
    target_node.id as target_node_id,
    source_node.id as source_node_id
  from source_versions versions
  join public.learning_agent_script_nodes target_node
    on target_node.script_version_id = versions.target_version_id
  join public.learning_agent_script_nodes source_node
    on source_node.script_version_id = versions.source_version_id
   and source_node.node_key = target_node.node_key
  where source_node.teacher_script = target_node.teacher_script
    and coalesce(source_node.configuration->'bufferLine', '{}'::jsonb)
      = coalesce(target_node.configuration->'bufferLine', '{}'::jsonb)
    and coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'voiceEnabled', performance.item->'voiceEnabled',
          'voiceLanguage', performance.item->'voiceLanguage',
          'voiceRate', performance.item->'voiceRate'
        )
        order by performance.ordinality
      )
      from jsonb_array_elements(
        coalesce(source_node.configuration->'scriptPerformances', '[]'::jsonb)
      ) with ordinality as performance(item, ordinality)
    ), '[]'::jsonb) = coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'voiceEnabled', performance.item->'voiceEnabled',
          'voiceLanguage', performance.item->'voiceLanguage',
          'voiceRate', performance.item->'voiceRate'
        )
        order by performance.ordinality
      )
      from jsonb_array_elements(
        coalesce(target_node.configuration->'scriptPerformances', '[]'::jsonb)
      ) with ordinality as performance(item, ordinality)
    ), '[]'::jsonb)
)
insert into public.learning_agent_script_audio_assets (
  script_node_id,
  locale,
  segment_index,
  content_hash,
  object_key,
  duration_ms,
  cue_timeline,
  voice_manifest,
  production_status
)
select
  compatible.target_node_id,
  source_asset.locale,
  source_asset.segment_index,
  source_asset.content_hash,
  source_asset.object_key,
  source_asset.duration_ms,
  source_asset.cue_timeline,
  source_asset.voice_manifest,
  source_asset.production_status
from compatible_nodes compatible
join public.learning_agent_script_audio_assets source_asset
  on source_asset.script_node_id = compatible.source_node_id
on conflict (script_node_id, locale, segment_index) do nothing;

create or replace function public.create_learning_agent_script_draft(
  p_lesson_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_existing uuid;
  v_published uuid;
  v_created uuid;
  v_next_version integer;
begin
  if auth.uid() is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以编辑教学脚本';
  end if;

  perform 1 from public.learning_agent_lessons where id = p_lesson_id for update;
  if not found then raise exception '没有找到对应的教学模块'; end if;

  select id into v_existing
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id and status = 'draft'
  limit 1;
  if v_existing is not null then return v_existing; end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id;

  select id into v_published
  from public.learning_agent_script_versions
  where lesson_id = p_lesson_id and status = 'published'
  limit 1;

  insert into public.learning_agent_script_versions (
    lesson_id, version_number, status, title, created_by
  )
  select p_lesson_id, v_next_version, 'draft',
    coalesce((select title from public.learning_agent_script_versions where id = v_published), '{}'::jsonb),
    auth.uid()
  returning id into v_created;

  if v_published is not null then
    insert into public.learning_agent_script_nodes (
      script_version_id, node_key, node_type, sort_order, title, teacher_script,
      configuration, reference_activity_id, action_type, next_node_key,
      remediation_node_key, is_required
    )
    select v_created, node_key, node_type, sort_order, title, teacher_script,
      configuration, reference_activity_id, action_type, next_node_key,
      remediation_node_key, is_required
    from public.learning_agent_script_nodes
    where script_version_id = v_published
    order by sort_order;

    insert into public.learning_agent_script_audio_assets (
      script_node_id,
      locale,
      segment_index,
      content_hash,
      object_key,
      duration_ms,
      cue_timeline,
      voice_manifest,
      production_status
    )
    select
      draft_node.id,
      source_asset.locale,
      source_asset.segment_index,
      source_asset.content_hash,
      source_asset.object_key,
      source_asset.duration_ms,
      source_asset.cue_timeline,
      source_asset.voice_manifest,
      source_asset.production_status
    from public.learning_agent_script_nodes source_node
    join public.learning_agent_script_nodes draft_node
      on draft_node.script_version_id = v_created
     and draft_node.node_key = source_node.node_key
    join public.learning_agent_script_audio_assets source_asset
      on source_asset.script_node_id = source_node.id
    where source_node.script_version_id = v_published
    on conflict (script_node_id, locale, segment_index) do nothing;
  end if;

  insert into public.learning_agent_publish_logs (
    lesson_id, script_version_id, action, actor_id, details
  ) values (
    p_lesson_id, v_created, 'create_draft', auth.uid(),
    jsonb_build_object('sourceVersionId', v_published)
  );

  return v_created;
end;
$$;

revoke all on function public.create_learning_agent_script_draft(uuid) from public, anon;
grant execute on function public.create_learning_agent_script_draft(uuid) to authenticated;

commit;
