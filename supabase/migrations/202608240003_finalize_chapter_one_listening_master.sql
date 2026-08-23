-- Finalize the private listening master before audio production. The script
-- stays in the secrets table; browser-readable config contains no transcript.

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
set transcript_ko = '안녕하세요? 저는 수진이에요. 한국 사람이에요. 저는 학생이에요. 요즘 한국어를 배워요. 처음 만나서 반가워요.',
    audio_object_key = 'korean-level-one/chapter-01/listening/chapter-01-listening-identity-normal.mp3',
    audio_status = 'pending',
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
  "scriptRevision":"chapter-01-listening-v1",
  "expectedDurationSeconds":18,
  "audioStatus":"pending"
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
set production_status = 'pending',
    metadata = asset.metadata || jsonb_build_object(
      'scriptRevision', 'chapter-01-listening-v1',
      'scriptVisibility', 'private',
      'locale', 'ko-KR',
      'voiceProfile', 'F04/sujin',
      'format', 'mp3',
      'sampleRateHz', 48000,
      'channels', 1,
      'speakingRate', case when asset.asset_key like '%-slow' then 0.78 else 0.92 end,
      'targetDurationSeconds', case when asset.asset_key like '%-slow' then 22 else 18 end
    ),
    updated_at = now()
where asset.id in (select id from target_assets);
