do $$
declare
  pattern_node_id uuid;
  pattern_activity_id uuid;
  step jsonb;
  step_id text;
  step_line text;
  step_speaker jsonb;
  answer_indexes jsonb;
  updated_steps jsonb := '[]'::jsonb;
begin
  select node.id, activity.id
    into pattern_node_id, pattern_activity_id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
    and activity.activity_key = 'pattern-choice'
  order by version.version_number desc
  limit 1;

  if pattern_activity_id is null then
    raise exception 'Cannot add guided conversation audio: pattern-choice activity is missing';
  end if;

  select answer_key->'value' into answer_indexes
  from public.digital_textbook_activity_secrets
  where activity_id = pattern_activity_id;

  for step in
    select value
    from jsonb_array_elements((select public_config #> '{conversation,steps}' from public.digital_textbook_activities where id = pattern_activity_id))
  loop
    step_id := step->>'id';
    step_line := case
      when step->>'kind' = 'choice' then coalesce(
        step->'options'->>((answer_indexes->>(step->>'choiceIndex')::integer)::integer),
        ''
      )
      else coalesce(step->>'line', '')
    end;
    step_speaker := coalesce(step->'speaker', '{}'::jsonb);
    updated_steps := updated_steps || jsonb_build_array(
      step || jsonb_build_object('audioAssetKey', 'guided-dialogue-' || step_id)
    );

    insert into public.digital_textbook_media_assets (
      node_id,
      activity_id,
      asset_key,
      media_type,
      purpose,
      object_key,
      production_status,
      alt_text,
      metadata
    ) values (
      pattern_node_id,
      pattern_activity_id,
      'guided-dialogue-' || step_id,
      'audio',
      'guided-conversation-line',
      'korean-level-one/chapter-01/patterns/guided-dialogue/' || step_id || '.mp3',
      'pending',
      jsonb_build_object(
        'zh-CN', coalesce(step_speaker->>'zh-CN', '') || '的韩语对话音频',
        'ko-KR', coalesce(step_speaker->>'ko-KR', '') || '의 한국어 대화 음성'
      ),
      jsonb_build_object(
        'conversationStepId', step_id,
        'speaker', step_speaker,
        'transcriptKo', step_line,
        'storage', 'cloudflare-r2',
        'format', 'audio/mpeg'
      )
    )
    on conflict (node_id, asset_key) do update set
      activity_id = excluded.activity_id,
      purpose = excluded.purpose,
      object_key = excluded.object_key,
      alt_text = excluded.alt_text,
      metadata = excluded.metadata,
      updated_at = now();
  end loop;

  update public.digital_textbook_activities
  set public_config = jsonb_set(public_config, '{conversation,steps}', updated_steps, false),
      updated_at = now()
  where id = pattern_activity_id;
end $$;

comment on column public.digital_textbook_media_assets.object_key is
  'Cloudflare R2 object key. Clients receive only a short-lived signed URL from the server loader.';
