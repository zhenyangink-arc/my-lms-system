-- Align vocabulary callouts with the people and actions visible in the panorama.
update public.digital_textbook_media_assets as asset
set metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
  'wordHotspots', jsonb_build_object(
    '저',         jsonb_build_object('left', 31, 'top', 49),
    '이름',       jsonb_build_object('left', 33, 'top', 58),
    '학생',       jsonb_build_object('left', 53, 'top', 47),
    '선생님',     jsonb_build_object('left', 62, 'top', 44),
    '친구',       jsonb_build_object('left', 73, 'top', 48),
    '사람',       jsonb_build_object('left', 80, 'top', 54),
    '만나다',     jsonb_build_object('left', 43, 'top', 84),
    '인사하다',   jsonb_build_object('left', 31, 'top', 82),
    '소개하다',   jsonb_build_object('left', 38, 'top', 48),
    '한국어',     jsonb_build_object('left', 69, 'top', 84),
    '처음',       jsonb_build_object('left', 39, 'top', 82),
    '반갑다',     jsonb_build_object('left', 48, 'top', 82)
  )
),
updated_at = now()
from public.digital_textbook_nodes as node
where node.id = asset.node_id
  and node.node_code = 'people-and-greetings'
  and asset.asset_key = 'chapter-01-image-02';
