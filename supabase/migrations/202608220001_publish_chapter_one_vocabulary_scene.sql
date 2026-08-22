-- Publish the generated chapter-one vocabulary scene from private Cloudflare R2.
update public.digital_textbook_media_assets as asset
set
  purpose = '核心词汇人物与动作情景图',
  object_key = 'images/smart-textbook/korean-level-one/chapter-01/vocabulary-scene-v1.webp',
  production_status = 'ready',
  alt_text = jsonb_build_object(
    'zh-CN', '校园语言交换中心的四个连续场景：学习者介绍自己和姓名，老师、学生与朋友一起交流，两位新朋友初次见面问候，以及伙伴共同学习韩语。',
    'ko-KR', '캠퍼스 언어 교환 센터의 네 장면으로 학습자의 자기소개와 이름, 선생님·학생·친구의 만남, 처음 만난 두 사람의 인사와 한국어 공부를 보여 줍니다.'
  ),
  metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
    'width', 1200,
    'height', 900,
    'format', 'webp',
    'sourceStatus', 'AI 生成后人工核对',
    'vocabularyCoverage', jsonb_build_array(
      '저', '이름', '학생', '선생님', '친구', '사람',
      '만나다', '인사하다', '소개하다', '한국어', '처음', '반갑다'
    )
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
