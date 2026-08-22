-- Replace the 4:3 vocabulary scene with a full-width 16:9 extension. Existing
-- subjects are preserved and the extra canvas is added horizontally.
update public.digital_textbook_media_assets as asset
set
  object_key = 'images/smart-textbook/korean-level-one/chapter-01/vocabulary-scene-v2.webp',
  production_status = 'ready',
  metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
    'width', 1600,
    'height', 900,
    'format', 'webp',
    'aspectRatio', '16:9',
    'sourceStatus', 'AI 横向扩展后人工核对'
  ),
  updated_at = now()
from public.digital_textbook_nodes as node
join public.digital_textbook_modules as module on module.id = node.module_id
join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions as version on version.id = chapter.version_id
join public.digital_textbooks as textbook on textbook.id = version.textbook_id
where asset.node_id = node.id
  and textbook.slug = 'korean-level-one-smart'
  and chapter.chapter_number = 1
  and node.node_code = 'people-and-greetings'
  and asset.asset_key = 'chapter-01-image-02';
