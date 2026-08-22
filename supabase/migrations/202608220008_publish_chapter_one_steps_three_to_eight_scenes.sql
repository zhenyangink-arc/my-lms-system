-- Give chapter 01 steps 03-08 distinct, task-specific scene headers while
-- keeping presentation in the shared smart-textbook renderer.
with scene_seed(node_code, asset_key, purpose, object_key, alt_text, goal_zh, goal_ko) as (
  values
    ('topic-and-copula', 'chapter-01-image-03', '语法形态判断情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-03-scene-2x.webp',
      '两名学生观察身份卡，在教师引导下比较名词词尾。', '先看名词词尾，再正确选择 이에요/예요 和 은/는。', '명사의 끝소리를 보고 이에요/예요와 은/는을 바르게 고르세요.'),
    ('introduce-yourself', 'chapter-01-image-04', '句型排序与替换情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-04-scene-2x.webp',
      '两名学生把四张表达卡排成自然的自我介绍顺序。', '把问候、姓名、身份和结束语连成自然的自我介绍。', '인사, 이름, 신분과 마무리를 자연스러운 자기소개로 이어 보세요.'),
    ('club-first-meeting', 'chapter-01-image-05', '初次见面实战对话情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-05-scene-2x.webp',
      '国际交流中心里，两名学生第一次见面并轮流交谈。', '听懂两个完整场景，轮流完成初次见面对话。', '두 개의 완전한 장면을 이해하고 첫 만남 대화를 번갈아 완성하세요.'),
    ('listen-and-respond', 'chapter-01-image-06', '听辨与双角色口语任务情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-06-scene-2x.webp',
      '语言实验室里，一名学生戴耳机听辨，另一名学生对着麦克风表达。', '先从原话听出身份，再完成 30 秒、至少 8 轮的双角色交流。', '실제 음성에서 신분을 듣고 30초, 8턴 이상의 두 역할 대화를 완성하세요.'),
    ('profile-note', 'chapter-01-image-07', '新成员卡读写情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-07-scene-2x.webp',
      '校园学习区里，两名学生阅读新成员卡并书写个人介绍。', '读出姓名、国籍和身份，再写一张 4—5 句的新成员介绍卡。', '이름, 국적과 신분을 읽고 4~5문장의 새 회원 소개 카드를 쓰세요.'),
    ('can-do-check', 'chapter-01-image-08', '章节综合交流与复盘情景图', 'images/smart-textbook/korean-level-one/chapter-01/step-08-scene-2x.webp',
      '语言交换活动中，两名学生完成交流，旁边展示五项空白自查标记。', '完成综合检测和五项自查，确认自己能独立完成第一次见面。', '종합 확인과 다섯 가지 자기 점검으로 첫 만남을 독립적으로 완성할 수 있는지 확인하세요.')
), resolved as (
  select node.id as node_id, scene_seed.*
  from scene_seed
  join public.digital_textbook_nodes as node on node.node_code = scene_seed.node_code
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and chapter.status = 'published'
)
insert into public.digital_textbook_media_assets (
  node_id, asset_key, media_type, purpose, object_key,
  production_status, alt_text, metadata
)
select
  node_id,
  asset_key,
  'image',
  purpose,
  object_key,
  'ready',
  jsonb_build_object('zh-CN', alt_text, 'ko-KR', alt_text),
  jsonb_build_object(
    'width', 3600,
    'height', 1800,
    'aspectRatio', '2:1',
    'encoding', 'lossless-webp',
    'density', '2x',
    'goalZh', goal_zh,
    'goalKo', goal_ko,
    'presentation', 'task-scene'
  )
from resolved
on conflict (node_id, asset_key) do update set
  purpose = excluded.purpose,
  object_key = excluded.object_key,
  production_status = excluded.production_status,
  alt_text = excluded.alt_text,
  metadata = excluded.metadata,
  updated_at = now();
