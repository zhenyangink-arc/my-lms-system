-- Publish the first real smart-textbook scene image from the private R2 bucket.
-- The renderer signs object access server-side; clients never receive R2 credentials.
update public.digital_textbook_media_assets as asset
set
  object_key = 'images/smart-textbook/korean-level-one/chapter-01/mission-map-scene-v1.webp',
  production_status = 'ready',
  alt_text = jsonb_build_object(
    'zh-CN', '明亮的校园语言交换活动空间里，两名大学生面对面微笑，一名学生抬手主动问候。',
    'ko-KR', '밝은 캠퍼스 언어 교환 행사 공간에서 대학생 두 명이 마주 보고 웃으며 한 학생이 손을 들어 먼저 인사합니다.'
  ),
  metadata = jsonb_build_object(
    'width', 1600,
    'height', 640,
    'mimeType', 'image/webp',
    'sourceStatus', '已制作',
    'version', 1
  ),
  updated_at = now()
from public.digital_textbook_nodes as node
join public.digital_textbook_modules as module on module.id = node.module_id
join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
join public.digital_textbook_versions as version on version.id = chapter.version_id
join public.digital_textbooks as textbook on textbook.id = version.textbook_id
where asset.node_id = node.id
  and asset.asset_key = 'chapter-01-image-01'
  and node.node_code = 'mission-map'
  and chapter.chapter_number = 1
  and textbook.slug = 'korean-level-one';
