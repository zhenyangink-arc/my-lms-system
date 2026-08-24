-- Publish the generated 5:2 primary learning scene for Chapters 3–16.
with target_media as (
  select media.id
  from public.digital_textbook_media_assets media
  join public.digital_textbook_nodes node on node.id = media.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number between 3 and 16
    and media.media_type = 'image'
    and media.asset_key like 'chapter-%-image-01'
)
update public.digital_textbook_media_assets media
set
  production_status = 'ready',
  metadata = coalesce(media.metadata, '{}'::jsonb) || '{
    "source":"generated_course_scene",
    "storage":"cloudflare_r2",
    "aspectRatio":"5:2"
  }'::jsonb,
  updated_at = now()
where media.id in (select id from target_media);
