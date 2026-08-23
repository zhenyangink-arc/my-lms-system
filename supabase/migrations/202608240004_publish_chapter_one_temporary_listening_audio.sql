-- Publish temporary machine-generated Korean demonstration audio. These files
-- intentionally reuse the final R2 keys so a later human recording can replace
-- them without changing the learner-facing contract.

with target_activity as (
  select activity.id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activity_secrets as secret
set audio_status = 'ready',
    updated_at = now()
where secret.activity_id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activities as activity
set public_config = activity.public_config || '{
  "audioStatus":"ready",
  "audioEdition":"temporary_tts",
  "audioVoice":"ko-KR-SunHiNeural"
}'::jsonb,
    updated_at = now()
where activity.id in (select id from target_activity);

with target_assets as (
  select asset.id, asset.asset_key
  from public.digital_textbook_media_assets as asset
  join public.digital_textbook_activities as activity on activity.id = asset.activity_id
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
    and asset.asset_key in (
      'chapter-01-listening-identity-normal',
      'chapter-01-listening-identity-slow'
    )
)
update public.digital_textbook_media_assets as asset
set production_status = 'ready',
    metadata = asset.metadata || jsonb_build_object(
      'audioEdition', 'temporary_tts',
      'generatedBy', 'edge-tts',
      'voice', 'ko-KR-SunHiNeural',
      'sampleRateHz', 24000,
      'channels', 1,
      'durationSeconds', case when asset.asset_key like '%-slow' then 17.328 else 14.136 end,
      'replaceableByHumanRecording', true
    ),
    updated_at = now()
where asset.id in (select id from target_assets);
