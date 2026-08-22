-- Replace the heavily compressed panorama with a lossless WebP rendition.
update public.digital_textbook_media_assets as asset
set object_key = 'images/smart-textbook/korean-level-one/chapter-01/vocabulary-scene-v4.webp',
    metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
      'width', 1800,
      'height', 900,
      'aspectRatio', '2:1',
      'encoding', 'lossless-webp'
    ),
    updated_at = now()
from public.digital_textbook_nodes as node
where node.id = asset.node_id
  and node.node_code = 'people-and-greetings'
  and asset.asset_key = 'chapter-01-image-02';
