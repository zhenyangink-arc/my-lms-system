-- The generated source scenes are 1983x793 (approximately 5:2). Their first
-- production export incorrectly forced them to 2:1, stretching people
-- vertically. Record the corrected proportional 2x export dimensions.
update public.digital_textbook_media_assets as asset
set metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
      'width', 3600,
      'height', 1440,
      'aspectRatio', '5:2',
      'sourceWidth', 1983,
      'sourceHeight', 793,
      'proportionalScale', true
    ),
    updated_at = now()
from public.digital_textbook_nodes as node
join public.digital_textbook_modules as module on module.id = node.module_id
join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
where node.id = asset.node_id
  and chapter.chapter_number = 1
  and node.node_code in (
    'topic-and-copula',
    'introduce-yourself',
    'club-first-meeting',
    'listen-and-respond',
    'profile-note',
    'can-do-check'
  )
  and asset.asset_key between 'chapter-01-image-03' and 'chapter-01-image-08';
