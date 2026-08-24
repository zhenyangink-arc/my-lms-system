-- Publish the generated Chapter 2 primary scene already stored in Cloudflare R2.
update public.digital_textbook_media_assets media
set
  production_status = 'ready',
  metadata = coalesce(media.metadata, '{}'::jsonb) || '{
    "source":"generated_course_scene",
    "storage":"cloudflare_r2",
    "width":1983,
    "height":793,
    "aspectRatio":"5:2"
  }'::jsonb,
  updated_at = now()
where media.object_key = 'korean-level-one/chapter-02/images/chapter-02-01-scene.png'
  and media.media_type = 'image';
