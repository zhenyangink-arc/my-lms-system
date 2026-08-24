-- Publish the generated 5:2 learning scenes for every Chapter 11 module.
with target_media as (
  select media.id
  from public.digital_textbook_media_assets media
  join public.digital_textbook_nodes node on node.id = media.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 11
    and media.asset_key in ('chapter-11-image-02','chapter-11-image-03','chapter-11-image-08','chapter-11-image-09','chapter-11-image-10','chapter-11-image-11','chapter-11-image-12')
)
update public.digital_textbook_media_assets media
set production_status = 'ready', metadata = coalesce(media.metadata, '{}'::jsonb) || '{"source":"generated_course_scene","storage":"cloudflare_r2","aspectRatio":"5:2"}'::jsonb, updated_at = now()
where media.id in (select id from target_media);
