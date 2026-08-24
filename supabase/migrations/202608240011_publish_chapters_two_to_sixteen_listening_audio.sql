-- Publish the reproducible R2 listening master for Chapters 2–16.
-- The source transcripts and object keys remain database-driven: earlier chapter
-- migrations own the language content, while this migration promotes the two
-- prepared normal/slow assets and exposes them through the shared player.

with target_audio as (
  select
    activity.id as activity_id,
    case when media.asset_key like '%-slow' then 1 else 0 end as page_index,
    secret.transcript_ko,
    media.object_key,
    jsonb_build_object(
      'edition', 'temporary_tts',
      'storage', 'cloudflare_r2',
      'speed', case when media.asset_key like '%-slow' then 'slow' else 'normal' end
    ) as metadata
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  join public.digital_textbook_activity_secrets secret on secret.activity_id = activity.id
  join public.digital_textbook_media_assets media
    on media.activity_id = activity.id
   and media.media_type = 'audio'
   and (media.asset_key like '%-normal' or media.asset_key like '%-slow')
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and activity.activity_type = 'listening'
)
insert into public.digital_textbook_listening_tracks (
  activity_id,
  page_index,
  transcript_ko,
  audio_object_key,
  audio_status,
  metadata
)
select
  activity_id,
  page_index,
  transcript_ko,
  object_key,
  'ready',
  metadata
from target_audio
on conflict (activity_id, page_index) do update set
  transcript_ko = excluded.transcript_ko,
  audio_object_key = excluded.audio_object_key,
  audio_status = excluded.audio_status,
  metadata = excluded.metadata,
  updated_at = now();

with target_activities as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and activity.activity_type = 'listening'
)
update public.digital_textbook_media_assets media
set production_status = 'ready', updated_at = now()
where media.activity_id in (select id from target_activities)
  and media.media_type = 'audio'
  and (media.asset_key like '%-normal' or media.asset_key like '%-slow');

with target_audio as (
  select activity.id as activity_id, media.object_key
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  join public.digital_textbook_media_assets media
    on media.activity_id = activity.id
   and media.media_type = 'audio'
   and media.asset_key like '%-normal'
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and activity.activity_type = 'listening'
)
update public.digital_textbook_activity_secrets secret
set
  audio_object_key = target_audio.object_key,
  audio_status = 'ready',
  updated_at = now()
from target_audio
where secret.activity_id = target_audio.activity_id;

with target_activities as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 2 and 16
    and activity.activity_type = 'listening'
)
update public.digital_textbook_activities activity
set
  public_config = jsonb_set(
    coalesce(activity.public_config, '{}'::jsonb),
    '{audioStatus}',
    '"ready"'::jsonb,
    true
  ),
  updated_at = now()
where activity.id in (select id from target_activities);
