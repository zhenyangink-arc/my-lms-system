-- Keep image-specific vocabulary positions with the media asset rather than in the shared renderer.
update public.digital_textbook_media_assets as asset
set metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
  'wordHotspots', jsonb_build_object(
    '저',         jsonb_build_object('left', 22, 'top', 55),
    '이름',       jsonb_build_object('left', 25, 'top', 65),
    '학생',       jsonb_build_object('left', 45, 'top', 45),
    '선생님',     jsonb_build_object('left', 57, 'top', 48),
    '친구',       jsonb_build_object('left', 75, 'top', 46),
    '사람',       jsonb_build_object('left', 82, 'top', 56),
    '만나다',     jsonb_build_object('left', 40, 'top', 88),
    '인사하다',   jsonb_build_object('left', 23, 'top', 88),
    '소개하다',   jsonb_build_object('left', 31, 'top', 78),
    '한국어',     jsonb_build_object('left', 72, 'top', 88),
    '처음',       jsonb_build_object('left', 50, 'top', 88),
    '반갑다',     jsonb_build_object('left', 82, 'top', 88)
  )
),
updated_at = now()
from public.digital_textbook_nodes as node
where node.id = asset.node_id
  and node.node_code = 'people-and-greetings'
  and asset.asset_key = 'chapter-01-image-02';
