begin;

-- Generated from the read-only UPLY BOOK chapter-two master.
-- source_sha256: 83f74f20cbaf86519e541ecb273302293888195e78c1b2d590550cebe39dcf71
-- The chapter, assessment, images and audio remain draft/pending until human review.
-- The current passing score is the master's recorded historical value of 60;
-- the revised score remains pending platform validation.

select set_config('app.platform_content_migration', 'on', true);

do $seed$
declare
  version_uuid uuid;
  lesson_uuid uuid;
  chapter_uuid uuid;
  test_uuid uuid;
  module_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
  module_seed jsonb;
  activity_seed jsonb;
  media_seed jsonb;
begin
  select version.id into version_uuid
  from public.digital_textbook_versions as version
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
  order by version.version_number desc
  limit 1;

  if version_uuid is null then
    raise exception 'Cannot convert chapter 02: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner'
    and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 02: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-02'
  limit 1;

  if test_uuid is null then
    select id into test_uuid
    from public.chapter_tests
    where lesson_id = lesson_uuid
      and chapter_number = 2
    limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3300000-0000-4000-8000-000000000002'::uuid,
      lesson_uuid,
      'korean-level-one-02',
      'korean-level-one',
      2,
      '第 02 章测试：这是什么？',
      '제02과 평가: 이거는 뭐예요?',
      '检查物品词汇、距离指示、有无表达、名词连接与礼貌请求。',
      12,
      60,
      '{"recognition":"词汇识别","structure":"语法形态","reading":"对话与便条理解","assembly":"表达组织"}'::jsonb,
      1,
      'draft',
      '10000000-0000-4000-8000-000000000001'::uuid
    )
    returning id into test_uuid;
  else
    update public.chapter_tests
    set
      lesson_id = lesson_uuid,
      slug = 'korean-level-one-02',
      course_key = 'korean-level-one',
      chapter_number = 2,
      title = '第 02 章测试：这是什么？',
      korean_title = '제02과 평가: 이거는 뭐예요?',
      description = '检查物品词汇、距离指示、有无表达、名词连接与礼貌请求。',
      duration_minutes = 12,
      passing_score = 60,
      skills = '{"recognition":"词汇识别","structure":"语法形态","reading":"对话与便条理解","assembly":"表达组织"}'::jsonb,
      version = 1,
      status = 'draft',
      student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
      updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id = test_uuid
    and question_key not in (
      'golden-02-01', 'golden-02-02', 'golden-02-03', 'golden-02-04',
      'golden-02-05', 'golden-02-06', 'golden-02-07', 'golden-02-08',
      'golden-02-09', 'golden-02-10', 'golden-02-11', 'golden-02-12'
    );

  update public.chapter_test_questions
  set sort_order = sort_order + 100, updated_at = now()
  where test_id = test_uuid;

  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation,
    skill, sort_order, question_type, default_points, difficulty, tags,
    status, version, is_chapter_test_item, ebook_section_step,
    ebook_page_reference
  ) values
    (test_uuid, 'golden-02-01', '物品在说话人手边时，“这是什么？”应怎样说？', '["이거는 뭐예요?","그거는 뭐예요?","저거는 뭐예요?","지금 몇 시예요?"]', 0, '说话人近处使用 이거，询问名称使用 뭐예요?', 'recognition', 1, 'single_choice', 10, 'foundation', '["距离","母本§5.2"]', 'draft', 1, true, 'STEP 02', '母本 §5.2'),
    (test_uuid, 'golden-02-02', '“연필 주세요.”中的 연필 是什么？', '["铅笔","橡皮","钥匙","雨伞"]', 0, '연필 是铅笔，整句表示“请给我铅笔”。', 'recognition', 2, 'single_choice', 10, 'foundation', '["词汇","母本§4"]', 'draft', 1, true, 'STEP 02', '母本 §4'),
    (test_uuid, 'golden-02-03', '“공책___ 있어요?”应填入哪一项？', '["가","이","하고","주세요"]', 1, '공책末音节有收音，使用 이。', 'structure', 3, 'single_choice', 10, 'foundation', '["이/가","母本§5.1"]', 'draft', 1, true, 'STEP 03', '母本 §5.1'),
    (test_uuid, 'golden-02-04', '“지우개___ 있어요?”应填入哪一项？', '["가","이","과","는"]', 0, '지우개末音节没有收音，使用 가。', 'structure', 4, 'single_choice', 10, 'foundation', '["이/가","母本§5.1"]', 'draft', 1, true, 'STEP 03', '母本 §5.1'),
    (test_uuid, 'golden-02-05', '物品靠近听话人时，应选择哪一句？', '["이거는 공책이에요?","그거는 공책이에요?","저거는 공책이에요?","공책이 없어요?"]', 1, '听话人近处使用 그거。', 'structure', 5, 'single_choice', 10, 'foundation', '["距离","母本§5.2"]', 'draft', 1, true, 'STEP 03', '母本 §5.2'),
    (test_uuid, 'golden-02-06', '哪一句是在礼貌请求铅笔？', '["연필이 있어요?","연필이 없어요.","연필 주세요.","연필하고 있어요."]', 2, '名词后空一格接 주세요，表示礼貌请求。', 'structure', 6, 'single_choice', 10, 'foundation', '["请求","母本§5.3"]', 'draft', 1, true, 'STEP 03', '母本 §5.3'),
    (test_uuid, 'golden-02-07', '口语中连接“笔记本和铅笔”最合适的是哪一项？', '["공책고 연필","공책하고 연필","공책이 연필","공책 주세요 연필"]', 1, '日常口语可用 하고 连接两个名词。', 'structure', 7, 'single_choice', 10, 'medium', '["名词连接","母本§5.4"]', 'draft', 1, true, 'STEP 03', '母本 §5.4'),
    (test_uuid, 'golden-02-08', '实际没有橡皮时，怎样回答“지우개가 있어요?”最自然？', '["아니요, 없어요.","네, 있어요.","지우개 주세요.","저거는 뭐예요?"]', 0, '否定并说明不存在使用 아니요, 없어요.', 'reading', 8, 'single_choice', 10, 'foundation', '["对话回应","母本§6"]', 'draft', 1, true, 'STEP 05', '母本 §6'),
    (test_uuid, 'golden-02-09', '母本两个场景中，主场景没有什么，第二场景远处是什么？', '["연필／볼펜","공책／책","지우개／지도","우산／연필"]', 2, '主场景没有橡皮，第二场景远处是地图。', 'reading', 9, 'single_choice', 10, 'medium', '["对话事实","母本§6.3"]', 'draft', 1, true, 'STEP 05', '母本 §6.3'),
    (test_uuid, 'golden-02-10', '课堂用品便条中写着“연필이 없어요.”，缺少什么？', '["书","铅笔","笔记本","橡皮"]', 1, '연필이 없어요 表示没有铅笔。', 'reading', 10, 'single_choice', 10, 'foundation', '["阅读","母本§8.1"]', 'draft', 1, true, 'STEP 07', '母本 §8.1'),
    (test_uuid, 'golden-02-11', '哪一组最符合物品交流的自然顺序？', '["请求→问名称→回答→问有无","问有无→请求→问名称→回答","回答→问名称→请求→问有无","问名称→回答→问有无→回答→请求"]', 3, '先辨认物品，再确认有无，最后提出请求。', 'assembly', 11, 'single_choice', 10, 'medium', '["对话结构","母本§3.4"]', 'draft', 1, true, 'STEP 08', '母本 §3.4'),
    (test_uuid, 'golden-02-12', '课末双角色任务必须满足哪一项？', '["只背物品清单","只问一次名称","约30秒、至少8轮，并包含距离、名称、有无和两件物品请求","加入价格与付款"]', 2, '母本要求约30秒、至少8轮的双角色物品交流；价格与付款不属于本课。', 'assembly', 12, 'single_choice', 10, 'medium', '["任务合同","母本§10"]', 'draft', 1, true, 'STEP 08', '母本 §10')
  on conflict (test_id, question_key) do update set
    prompt = excluded.prompt,
    options = excluded.options,
    correct_option = excluded.correct_option,
    explanation = excluded.explanation,
    skill = excluded.skill,
    sort_order = excluded.sort_order,
    question_type = excluded.question_type,
    default_points = excluded.default_points,
    difficulty = excluded.difficulty,
    tags = excluded.tags,
    status = 'draft',
    version = excluded.version,
    is_chapter_test_item = excluded.is_chapter_test_item,
    ebook_section_step = excluded.ebook_section_step,
    ebook_page_reference = excluded.ebook_page_reference,
    updated_at = now();

  select id into chapter_uuid
  from public.digital_textbook_chapters
  where version_id = version_uuid
    and (chapter_number = 2 or slug = 'what-is-this')
  order by (slug = 'what-is-this') desc
  limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal,
      status, production_status, editorial_status, native_review_status,
      audio_status, image_status, source_revision
    ) values (
      version_uuid,
      test_uuid,
      'what-is-this',
      2,
      '{"zh-CN":"这是什么？","ko-KR":"이거는 뭐예요?"}'::jsonb,
      '{"zh-CN":"王明在校园文具店辨认不同距离的课堂用品，询问库存并向店员智恩请求笔记本和铅笔；之后在教室与敏智继续确认物品名称。","ko-KR":"왕밍은 교내 문구점에서 거리에 따라 수업 물건을 가리키고 재고를 물은 뒤 지은에게 공책과 연필을 요청합니다. 교실에서는 민지와 물건 이름을 다시 확인합니다."}'::jsonb,
      '{"zh-CN":"按距离使用指示表达，询问和回答物品名称与有无，并完成约30秒、至少8轮的双角色物品请求对话。","ko-KR":"거리에 맞는 지시 표현으로 물건 이름과 유무를 묻고 답하며 약 30초, 8턴 이상의 두 역할 요청 대화를 완성합니다."}'::jsonb,
      'draft', 'editorial_review', 'pending', 'pending', 'pending', 'pending',
      'UPLY BOOK 第02课 이거는 뭐예요.md @ 2026-08-18 / sha256:83f74f20cbaf86519e541ecb273302293888195e78c1b2d590550cebe39dcf71'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters
    set
      chapter_test_id = test_uuid,
      slug = 'what-is-this',
      chapter_number = 2,
      title = '{"zh-CN":"这是什么？","ko-KR":"이거는 뭐예요?"}'::jsonb,
      scenario = '{"zh-CN":"王明在校园文具店辨认不同距离的课堂用品，询问库存并向店员智恩请求笔记本和铅笔；之后在教室与敏智继续确认物品名称。","ko-KR":"왕밍은 교내 문구점에서 거리에 따라 수업 물건을 가리키고 재고를 물은 뒤 지은에게 공책과 연필을 요청합니다. 교실에서는 민지와 물건 이름을 다시 확인합니다."}'::jsonb,
      goal = '{"zh-CN":"按距离使用指示表达，询问和回答物品名称与有无，并完成约30秒、至少8轮的双角色物品请求对话。","ko-KR":"거리에 맞는 지시 표현으로 물건 이름과 유무를 묻고 답하며 약 30초, 8턴 이상의 두 역할 요청 대화를 완성합니다."}'::jsonb,
      status = 'draft',
      production_status = 'editorial_review',
      editorial_status = 'pending',
      native_review_status = 'pending',
      audio_status = 'pending',
      image_status = 'pending',
      source_revision = 'UPLY BOOK 第02课 이거는 뭐예요.md @ 2026-08-18 / sha256:83f74f20cbaf86519e541ecb273302293888195e78c1b2d590550cebe39dcf71',
      updated_at = now()
    where id = chapter_uuid;
  end if;

  for module_seed in
    select value from jsonb_array_elements($modules$
    [
      {
        "code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"nodeCode":"mission-map",
        "title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},
        "description":{"zh-CN":"看清人物、物品距离和课末任务，再开始学习。","ko-KR":"인물, 물건의 거리와 단원 과제를 확인하고 학습을 시작합니다."},
        "nodeTitle":{"zh-CN":"文具店里怎样说清楚需要的物品？","ko-KR":"문구점에서 필요한 물건을 어떻게 말할까요?"},
        "content":{"lead":{"zh-CN":"王明要先辨认柜台物品，再确认铅笔和橡皮的库存，最后请求有货的两件物品。","ko-KR":"왕밍은 물건 이름을 확인하고 연필과 지우개의 재고를 물은 뒤 있는 물건 두 개를 요청합니다."},"targets":[{"ko":"이거는 뭐예요?","zh":"询问近处物品"},{"ko":"연필이 있어요?","zh":"确认物品有无"},{"ko":"아니요, 없어요.","zh":"说明没有"},{"ko":"공책하고 연필 주세요.","zh":"请求两件物品"}],"coach":{"zh-CN":"课末必须由两个角色交替至少8轮；价格和付款不属于本课。","ko-KR":"단원 과제는 두 역할이 8턴 이상 번갈아 말하며 가격과 결제는 다루지 않습니다."},"completion":{"zh-CN":"答对不计分场景诊断后完成本节点。","ko-KR":"점수에 포함되지 않는 장면 진단을 맞히면 완료됩니다."},"nextNode":"objects-and-distance"}
      },
      {
        "code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"nodeCode":"objects-and-distance",
        "title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},
        "description":{"zh-CN":"学习18个母表核心词和4个本课必用功能项。","ko-KR":"원고의 핵심 어휘 18개와 단원 필수 기능 표현 4개를 익힙니다."},
        "nodeTitle":{"zh-CN":"认出物品，也记住怎样问和请求","ko-KR":"물건을 알고 묻고 요청하는 표현까지 익히기"},
        "content":{"lead":{"zh-CN":"先看图猜词，再点读原形和搭配；下列22项由母本18词母表及本课可调用表达中的4个功能项组成，正式音频均待制作。","ko-KR":"그림으로 뜻을 짐작한 뒤 기본형과 결합 표현을 읽습니다. 아래 22개 항목은 원고 어휘 18개와 필수 기능 표현 4개이며 정식 음원은 제작 대기 중입니다."},"vocabulary":[
          {"ko":"물건","zh":"物品","pos":"名词","collocation":"물건이 있어요."},{"ko":"책","zh":"书","pos":"名词","collocation":"책이 있어요."},{"ko":"공책","zh":"笔记本","pos":"名词","collocation":"공책 주세요."},{"ko":"연필","zh":"铅笔","pos":"名词","collocation":"연필이 있어요?"},{"ko":"볼펜","zh":"圆珠笔","pos":"名词","collocation":"볼펜이 없어요."},{"ko":"지우개","zh":"橡皮","pos":"名词","collocation":"지우개가 있어요?"},{"ko":"가방","zh":"包","pos":"名词","collocation":"이거는 가방이에요."},{"ko":"휴대폰","zh":"手机","pos":"名词","collocation":"휴대폰이 있어요?"},{"ko":"우산","zh":"雨伞","pos":"名词","collocation":"저 우산"},{"ko":"열쇠","zh":"钥匙","pos":"名词","collocation":"열쇠가 있어요."},{"ko":"지도","zh":"地图","pos":"名词","collocation":"저거는 지도예요."},{"ko":"이거","zh":"这个","pos":"指示代词","collocation":"이거는 뭐예요?"},{"ko":"그거","zh":"那个（靠近听话人）","pos":"指示代词","collocation":"그거는 공책이에요?"},{"ko":"저거","zh":"那个（离双方都远）","pos":"指示代词","collocation":"저거는 지도예요."},{"ko":"이／그／저","zh":"这／那／那个","pos":"指示冠词","collocation":"이 책／그 공책／저 지도"},{"ko":"있다","zh":"有、存在","pos":"存在形容词","collocation":"공책이 있어요."},{"ko":"없다","zh":"没有、不存在","pos":"存在形容词","collocation":"연필이 없어요."},{"ko":"여기","zh":"这里","pos":"代词","collocation":"네, 여기 있어요."},{"ko":"뭐","zh":"什么","pos":"疑问词","collocation":"이거는 뭐예요?"},{"ko":"주세요","zh":"请给我","pos":"请求表达","collocation":"연필 주세요."},{"ko":"하고","zh":"和、与","pos":"连接助词","collocation":"공책하고 연필"},{"ko":"아니요","zh":"不、不是","pos":"应答表达","collocation":"아니요, 없어요."}
        ],"coach":{"zh-CN":"强制证据是词义题答对并确认已朗读整句；其他点读与快指为自主练习。","ko-KR":"필수 증거는 뜻 문항 정답과 문장 낭독 확인이며 나머지 듣기와 빠른 지목은 자율 연습입니다."},"nextNode":"point-exist-request"}
      },
      {
        "code":"grammar","order":3,"accent":"iris","type":"learn","minutes":16,"nodeCode":"point-exist-request",
        "title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},
        "description":{"zh-CN":"用四张语法卡掌握有无、距离、请求和名词连接。","ko-KR":"네 장의 문법 카드로 유무, 거리, 요청과 명사 연결을 익힙니다."},
        "nodeTitle":{"zh-CN":"指清楚、问有无、再提出请求","ko-KR":"가리키고 유무를 물은 뒤 요청하기"},
        "content":{"lead":{"zh-CN":"先判断物品距离，再看名词末音节收音；确认库存后才提出单件或两件请求。","ko-KR":"먼저 물건의 거리를 판단하고 명사의 받침을 확인한 뒤 재고에 맞게 한두 물건을 요청합니다."},"grammarCards":[
          {"form":"N이/가 있어요·없어요","function":{"zh-CN":"询问并说明物品是否存在或可提供。","ko-KR":"물건이 있거나 없는지 묻고 답합니다."},"rules":["有收音：N + 이 있어요/없어요","无收音：N + 가 있어요/없어요","问句形态不变，回答可省略已知物品"],"examples":[{"ko":"연필이 있어요?","zh":"有铅笔吗？","audioId":"chapter-02-grammar-01-example-01","audioStatus":"pending"},{"ko":"지우개가 있어요? 아니요, 없어요.","zh":"有橡皮吗？不，没有。","audioId":"chapter-02-grammar-01-example-02","audioStatus":"pending"},{"ko":"책이 있어요. 연필이 없어요.","zh":"有书。没有铅笔。","audioId":"chapter-02-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：지우개이 있어요? 正确：지우개가 있어요?；없어요 是“没有”，不是 아니에요“不是”。","ko-KR":"잘못: 지우개이 있어요? 바른 표현: 지우개가 있어요? 없어요와 아니에요를 구별하세요."},"source":{"zh-CN":"母本 §5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
          {"form":"이/그/저 + N；이거/그거/저거","function":{"zh-CN":"按物品与说话双方的距离指出目标。","ko-KR":"말하는 사람과 듣는 사람에게서 떨어진 거리에 맞게 물건을 가리킵니다."},"rules":["说话人近处：이/이거","听话人近处：그/그거","双方远处：저/저거","代词不能再直接修饰同一个名词"],"examples":[{"ko":"이거는 뭐예요?","zh":"这是什么？","audioId":"chapter-02-grammar-02-example-01","audioStatus":"pending"},{"ko":"민지 씨, 그거는 연필이에요?","zh":"敏智，那个是铅笔吗？","audioId":"chapter-02-grammar-02-example-02","audioStatus":"pending"},{"ko":"이 우산이에요? 아니요, 저 우산이에요.","zh":"是这把伞吗？不，是远处那把伞。","audioId":"chapter-02-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：이거 책이에요. 正确：이거는 책이에요. 或 이 책이에요.；本课完整形也要能听懂 이건/그건/저건。","ko-KR":"잘못: 이거 책이에요. 바른 표현: 이거는 책이에요. 또는 이 책이에요. 축약형 이건/그건/저건도 알아듣습니다."},"source":{"zh-CN":"母本 §5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N 주세요","function":{"zh-CN":"在服务或交接场景中礼貌请求物品。","ko-KR":"서비스나 물건 전달 장면에서 물건을 공손하게 요청합니다."},"rules":["名词 + 空格 + 주세요","名词有无收音不改变 주세요","两件物品先用 하고 等连接"],"examples":[{"ko":"연필 주세요.","zh":"请给我铅笔。","audioId":"chapter-02-grammar-03-example-01","audioStatus":"pending"},{"ko":"공책하고 연필 주세요.","zh":"请给我笔记本和铅笔。","audioId":"chapter-02-grammar-03-example-02","audioStatus":"pending"},{"ko":"그럼 연필 주세요.","zh":"那么请给我铅笔。","audioId":"chapter-02-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：연필주세요. 正确：연필 주세요.；있어요? 只确认有无，주세요 才是请求。","ko-KR":"잘못: 연필주세요. 바른 표현: 연필 주세요. 있어요?는 유무 확인이고 주세요는 요청입니다."},"source":{"zh-CN":"母本 §5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N하고 N；N과/와 N","function":{"zh-CN":"连接两个需要确认或请求的物品。","ko-KR":"확인하거나 요청할 두 물건을 연결합니다."},"rules":["口语 하고 不受收音影响","有收音名词后用 과，无收音后用 와","本课口语输出优先 하고"],"examples":[{"ko":"공책하고 연필 주세요.","zh":"请给我笔记本和铅笔。","audioId":"chapter-02-grammar-04-example-01","audioStatus":"pending"},{"ko":"공책하고 지우개 주세요.","zh":"请给我笔记本和橡皮。","audioId":"chapter-02-grammar-04-example-02","audioStatus":"pending"},{"ko":"그럼 공책하고 연필 주세요.","zh":"那么请给我笔记本和铅笔。","audioId":"chapter-02-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：지우개과 연필. 正确：지우개와 연필 或 지우개하고 연필；不要写成连接谓语的 -고。","ko-KR":"잘못: 지우개과 연필. 바른 표현: 지우개와 연필 또는 지우개하고 연필. 서술어 연결 -고와 구별하세요."},"source":{"zh-CN":"母本 §5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}}
        ],"coach":{"zh-CN":"五项填空必须一次全部正确；功能解释与扩展变形为自主展示。","ko-KR":"다섯 빈칸을 모두 맞혀야 하며 기능 설명과 확장 변형은 자율 활동입니다."},"nextNode":"object-exchange-lab"}
      },
      {
        "code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,"nodeCode":"object-exchange-lab",
        "title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},
        "description":{"zh-CN":"把距离、有无和请求句连成真实话轮。","ko-KR":"거리, 유무와 요청 표현을 실제 말차례로 연결합니다."},
        "nodeTitle":{"zh-CN":"从一个问句走到完整请求","ko-KR":"한 질문에서 완전한 요청까지"},
        "content":{"lead":{"zh-CN":"每张排序卡都是可独立说出的完整话轮，先找开头与结尾，再检查问答是否相邻。","ko-KR":"각 배열 카드는 독립적인 말차례입니다. 시작과 끝을 찾고 질문과 대답이 붙어 있는지 확인하세요."},"pattern":"이거는 뭐예요? → N이에요/예요. → N이/가 있어요? → 네, 있어요./아니요, 없어요. → N하고 N 주세요.","substitutions":["이거／그거／저거","책이／연필이／지우개가","연필 주세요.／공책하고 연필 주세요."],"substitutionGroups":[["이거는 뭐예요?","그거는 뭐예요?","저거는 뭐예요?"],["책이 있어요?","연필이 있어요?","지우개가 있어요?"],["연필 주세요.","공책 주세요.","공책하고 연필 주세요."]],"quickResponse":["네, 있어요.","아니요, 없어요."],"personalOutput":["一个距离问句","一个有无句","一个两件物品请求"],"coach":{"zh-CN":"排序题答对即完成；替换、快答和三句个人表达为自主练习。","ko-KR":"배열 문항을 맞히면 완료되며 대치, 빠른 응답과 세 문장 표현은 자율 연습입니다."},"nextNode":"supply-desk-dialogue"}
      },
      {
        "code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":12,"nodeCode":"supply-desk-dialogue",
        "title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},
        "description":{"zh-CN":"在文具店和教室两个完整场景中根据回答继续交流。","ko-KR":"문구점과 교실의 두 장면에서 대답에 맞게 대화를 이어 갑니다."},
        "nodeTitle":{"zh-CN":"没有的物品不能继续当作已拿到","ko-KR":"없는 물건은 받은 것처럼 말할 수 없어요"},
        "content":{"lead":{"zh-CN":"主场景8轮完成辨认、库存确认和领取；第二场景6轮练习听话人近处与双方远处的距离。整段和逐句音频均待制作。","ko-KR":"주 장면은 8턴으로 이름, 재고와 수령을 확인하고 두 번째 장면은 6턴으로 듣는 사람 가까이와 양쪽에서 먼 거리를 연습합니다. 전체와 문장별 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":"场景1｜校园文具店柜台","context":{"zh-CN":"王明根据铅笔有货、橡皮缺货的回答调整最终请求。","ko-KR":"왕밍은 연필은 있고 지우개는 없다는 답에 맞게 마지막 요청을 바꿉니다."},"lines":[{"speaker":"왕밍","ko":"안녕하세요? 이거는 뭐예요?","zh":"你好，这是什么？"},{"speaker":"지은","ko":"공책이에요.","zh":"是笔记本。"},{"speaker":"왕밍","ko":"연필이 있어요?","zh":"有铅笔吗？"},{"speaker":"지은","ko":"네, 있어요.","zh":"有。"},{"speaker":"왕밍","ko":"지우개가 있어요?","zh":"有橡皮吗？"},{"speaker":"지은","ko":"아니요, 없어요.","zh":"不，没有。"},{"speaker":"왕밍","ko":"그럼 공책하고 연필 주세요.","zh":"那么请给我笔记本和铅笔。"},{"speaker":"지은","ko":"네, 여기 있어요.","zh":"好，在这里。"}]},{"title":"场景2｜教室书桌旁","context":{"zh-CN":"敏智手边是圆珠笔，远处展示板上是地图。","ko-KR":"민지 가까이에는 볼펜이 있고 먼 게시판에는 지도가 있습니다."},"lines":[{"speaker":"왕밍","ko":"민지 씨, 그거는 연필이에요?","zh":"敏智，那个是铅笔吗？"},{"speaker":"민지","ko":"아니요, 볼펜이에요.","zh":"不，是圆珠笔。"},{"speaker":"왕밍","ko":"아, 네. 저거는 뭐예요?","zh":"啊，好的。远处那个是什么？"},{"speaker":"민지","ko":"지도예요.","zh":"是地图。"},{"speaker":"왕밍","ko":"책이 있어요?","zh":"有书吗？"},{"speaker":"민지","ko":"네, 여기 있어요.","zh":"有，在这里。"}]}],"coach":{"zh-CN":"完成两场景事实组合题和缺货自然回应题；信息替换与试录为自主练习。","ko-KR":"두 장면의 사실 조합과 품절 응답 문항을 완료하며 정보 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-request"}
      },
      {
        "code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":11,"nodeCode":"listen-and-request",
        "title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},
        "description":{"zh-CN":"听出缺少的物品，再提交约30秒的双角色物品交流。","ko-KR":"없는 물건을 듣고 약 30초의 두 역할 물건 대화를 제출합니다."},
        "nodeTitle":{"zh-CN":"听懂“有／没有”，再决定请求什么","ko-KR":"있음과 없음을 듣고 요청할 물건 정하기"},
        "content":{"lead":{"zh-CN":"听力答案只来自音频原话；正常速和慢速为独立私有绑定，当前都待母语审校、录制与文件核验。","ko-KR":"듣기 답은 음성의 실제 표현에서만 찾습니다. 보통 속도와 느린 속도는 별도 비공개 파일로 연결되며 원어민 검수와 녹음, 파일 확인 대기 중입니다."},"listenFor":["연필问答","지우개问答","肯定与否定","最终请求"],"speakingFrame":"A/B：至少两种距离 → 名称问答 → 两次有无问答 → 两件请求 → 交付回应","speakingCriteria":["至少两种距离","一个名称问答","两次有无问答","一个肯定和一个否定","하고连接两件物品请求","交付或结束回应"],"coach":{"zh-CN":"当前不提供发音评分；开放录音不作为客观完成证据，系统仅保存未复核提交。","ko-KR":"현재 발음 점수를 제공하지 않으며 공개형 녹음은 객관적 완료 증거가 아니라 검토 전 제출로만 저장됩니다."},"nextNode":"supply-card"}
      },
      {
        "code":"read_write","order":7,"accent":"iris","type":"practice","minutes":11,"nodeCode":"supply-card",
        "title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},
        "description":{"zh-CN":"读懂课堂用品便条中的状态与请求，再写原创便条。","ko-KR":"수업 준비물 메모의 상태와 요청을 읽고 새 메모를 씁니다."},
        "nodeTitle":{"zh-CN":"读清“有什么”，写清“要什么”","ko-KR":"있는 물건을 읽고 필요한 물건을 쓰기"},
        "content":{"lead":{"zh-CN":"按“物品—有无状态—最终请求”找信息；写作必须包含辨认、有、没有和两件物品请求。","ko-KR":"물건—유무 상태—마지막 요청 순서로 정보를 찾고 쓰기에는 확인, 있음, 없음과 두 물건 요청을 넣습니다."},"reading":"수업 준비물 메모\n책이 있어요.\n공책이 있어요.\n연필이 없어요.\n지우개가 있어요.\n공책하고 지우개 주세요.","questions":["무엇이 없어요?","무엇하고 무엇을 요청해요?","책이 있어요, 없어요?"],"writingFrame":"이거는 ___이에요/예요. → ___이/가 있어요. → ___이/가 없어요. → ___하고 ___ 주세요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"originalExample":"이거는 가방이에요. 책이 있어요. 볼펜이 없어요. 우산하고 열쇠 주세요.","coach":{"zh-CN":"阅读三题全部答对；开放写作仅保存结构合格、待复核的提交，不替代客观证据。","ko-KR":"읽기 세 문항을 모두 맞히고 공개형 쓰기는 구조가 맞는 검토 전 제출로만 저장되며 객관적 증거를 대신하지 않습니다."},"nextNode":"can-do-check"}
      },
      {
        "code":"review","order":8,"accent":"coral","type":"review","minutes":8,"nodeCode":"can-do-check",
        "title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},
        "description":{"zh-CN":"完成综合检测、五项Can-do自查并记录返回节点。","ko-KR":"종합 문항과 다섯 가지 Can-do를 점검하고 돌아갈 학습 위치를 기록합니다."},
        "nodeTitle":{"zh-CN":"我能根据回答拿到正确物品吗？","ko-KR":"대답에 맞게 필요한 물건을 받을 수 있나요?"},
        "content":{"lead":{"zh-CN":"把错误分到词汇距离、语法、理解、听说或读写，再返回最短复习路径。","ko-KR":"오류를 어휘·거리, 문법, 이해, 듣기·말하기 또는 읽기·쓰기로 나누어 가장 짧은 복습 경로로 돌아갑니다."},"checklist":[{"ko":"거리에 맞게 물건을 가리키고 이름을 물을 수 있어요.","zh":"我能按距离指物并问答名称"},{"ko":"물건의 유무를 묻고 답할 수 있어요.","zh":"我能询问并回答物品有无"},{"ko":"두 물건을 연결해 공손하게 요청할 수 있어요.","zh":"我能连接两件物品并礼貌请求"},{"ko":"준비물 메모를 읽고 새 메모를 쓸 수 있어요.","zh":"我能读写课堂用品便条"},{"ko":"두 역할로 30초 동안 8턴 이상 대화할 수 있어요.","zh":"我能完成30秒、8轮以上双角色交流"}],"returnMap":[{"reason":"词汇／距离","node":"objects-and-distance"},{"reason":"语法","node":"point-exist-request"},{"reason":"理解","node":"supply-desk-dialogue"},{"reason":"听说","node":"listen-and-request"},{"reason":"读写","node":"supply-card"}],"coach":{"zh-CN":"综合多选与自查均提交后完成；八节点的客观活动全部完成才解锁章节测试。","ko-KR":"종합 복수 선택과 자기 점검을 제출하고 여덟 노드의 객관 활동을 모두 완료해야 단원 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-02"}
      }
    ]
    $modules$::jsonb)
  loop
    insert into public.digital_textbook_modules (
      chapter_id, module_code, sort_order, accent_role, title, description
    ) values (
      chapter_uuid,
      module_seed ->> 'code',
      (module_seed ->> 'order')::integer,
      module_seed ->> 'accent',
      module_seed -> 'title',
      module_seed -> 'description'
    )
    on conflict (chapter_id, module_code) do update set
      sort_order = excluded.sort_order,
      accent_role = excluded.accent_role,
      title = excluded.title,
      description = excluded.description,
      updated_at = now()
    returning id into module_uuid;

    insert into public.digital_textbook_nodes (
      module_id, node_code, node_type, sort_order, estimated_minutes, title, content
    ) values (
      module_uuid,
      module_seed ->> 'nodeCode',
      module_seed ->> 'type',
      1,
      (module_seed ->> 'minutes')::integer,
      module_seed -> 'nodeTitle',
      module_seed -> 'content'
    )
    on conflict (module_id, node_code) do update set
      node_type = excluded.node_type,
      estimated_minutes = excluded.estimated_minutes,
      title = excluded.title,
      content = excluded.content,
      updated_at = now();
  end loop;

  for activity_seed in
    select value from jsonb_array_elements($activities$
    [
      {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"王明指着自己手边一个不认识的物品，最适合先说什么？","ko-KR":"왕밍이 자기 가까이에 있는 모르는 물건을 가리킵니다. 가장 먼저 할 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合“询问手边物品名称”的表达；本题不计分。","ko-KR":"가까이에 있는 물건의 이름을 묻는 표현을 고르세요. 점수에는 포함되지 않습니다."},"options":["이거는 뭐예요?","지금 몇 시예요?","감기에 걸렸어요.","서울역으로 가 주세요."],"config":{"shuffle":false,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"이거는 뭐예요? 用于询问说话人近处物品的名称。","ko-KR":"이거는 뭐예요?는 말하는 사람 가까이에 있는 물건의 이름을 묻습니다."},"feedback":[{"zh-CN":"看王明手指的是人、时间、身体还是物品。","ko-KR":"왕밍이 사람, 시간, 몸 상태, 물건 중 무엇을 가리키는지 보세요."},{"zh-CN":"寻找同时含“这个”和“什么”的问句。","ko-KR":"‘이것’과 ‘무엇’을 함께 나타내는 질문을 찾으세요."},{"zh-CN":"答案是 이거는 뭐예요?；其他三句分别问时间、说明感冒或请求去首尔站。","ko-KR":"정답은 이거는 뭐예요?이며 나머지는 시간, 감기 상태 또는 서울역 이동 요청입니다."}]}},
      {"nodeCode":"objects-and-distance","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在 연필 주세요. 中，연필 是什么？","ko-KR":"연필 주세요.에서 연필은 무엇이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 한 번 읽고 확인란을 선택하세요."},"options":["铅笔","橡皮","钥匙","雨伞"],"config":{"shuffle":false,"audioPending":true,"readAloudConfirmation":{"label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"연필 是铅笔，整句表示“请给我铅笔”。","ko-KR":"연필은 필기구이며 문장은 연필을 달라는 뜻입니다."},"feedback":[{"zh-CN":"先判断这是书写、擦除、开锁还是挡雨用品。","ko-KR":"쓰기, 지우기, 자물쇠 열기, 비 막기 중 어떤 물건인지 생각하세요."},{"zh-CN":"지우개 用来擦，연필 用来写。","ko-KR":"지우개는 지우고 연필은 씁니다."},{"zh-CN":"正确答案是“铅笔”；还需确认已朗读整句。","ko-KR":"정답은 연필이며 문장 전체 낭독도 확인해야 합니다."}]}},
      {"nodeCode":"point-exist-request","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成五小题，检查有无助词、距离、请求和名词连接。","ko-KR":"유무 조사, 거리, 요청과 명사 연결을 확인하는 다섯 문항을 완성하세요."},"instruction":{"zh-CN":"依次填写：공책___ 있어요?／지우개___ 있어요?／听话人近处：___는 공책이에요?／연필 ___／공책___ 연필 주세요.","ko-KR":"차례로 쓰세요. 공책___ 있어요?／지우개___ 있어요?／듣는 사람 가까이: ___는 공책이에요?／연필 ___／공책___ 연필 주세요."},"options":[],"config":{"normalize":"NFC","items":[{"id":"batchim_i","label":"공책___ 있어요?","placeholder":"이/가"},{"id":"no_batchim_ga","label":"지우개___ 있어요?","placeholder":"이/가"},{"id":"near_listener","label":"___는 공책이에요?","placeholder":"이거/그거/저거"},{"id":"request","label":"연필 ___","placeholder":"请求表达"},{"id":"connector","label":"공책___ 연필 주세요.","placeholder":"连接表达"}]},"answer":{"kind":"text_array","value":["이","가","그거","주세요","하고"]},"explanation":{"correct":{"zh-CN":"五项规范答案依次为 이、가、그거、주세요、하고。","ko-KR":"다섯 답은 차례로 이, 가, 그거, 주세요, 하고입니다."},"feedback":[{"zh-CN":"先标出每空属于有无、距离、请求还是连接。","ko-KR":"각 빈칸이 유무, 거리, 요청, 연결 중 무엇인지 표시하세요."},{"zh-CN":"检查 책 的收音、개 无收音、听话人近处、请求和口语连接。","ko-KR":"책의 받침, 받침 없는 개, 듣는 사람 가까이, 요청과 구어 연결을 확인하세요."},{"zh-CN":"答案依次是 이、가、그거、주세요、하고，须全部正确重做。","ko-KR":"정답은 이, 가, 그거, 주세요, 하고이며 모두 맞게 다시 쓰세요."}]}},
      {"nodeCode":"object-exchange-lab","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"把五个完整话轮排成自然的物品交流。","ko-KR":"다섯 개의 완전한 말차례를 자연스러운 물건 대화 순서로 배열하세요."},"instruction":{"zh-CN":"按“问名称—答名称—问有无—答有无—请求”排序。","ko-KR":"이름 질문—이름 대답—유무 질문—유무 대답—요청 순서로 배열하세요."},"options":["공책하고 연필 주세요.","공책이에요.","네, 있어요.","이거는 뭐예요?","연필이 있어요?"],"config":{"resettable":true},"answer":{"kind":"order","value":[3,1,4,2,0]},"explanation":{"correct":{"zh-CN":"先问答名称，再问答有无，最后请求。","ko-KR":"이름을 묻고 답한 뒤 유무를 묻고 답하고 마지막에 요청합니다."},"feedback":[{"zh-CN":"先找询问名称的开头和提出请求的结尾。","ko-KR":"이름 질문의 시작과 요청의 끝을 먼저 찾으세요."},{"zh-CN":"中间两组必须是 뭐예요?—공책이에요 和 있어요?—네, 있어요。","ko-KR":"가운데는 뭐예요?—공책이에요와 있어요?—네, 있어요가 짝입니다."},{"zh-CN":"正确顺序：이거는 뭐예요? → 공책이에요. → 연필이 있어요? → 네, 있어요. → 공책하고 연필 주세요.。","ko-KR":"정답 순서는 이거는 뭐예요? → 공책이에요. → 연필이 있어요? → 네, 있어요. → 공책하고 연필 주세요.입니다."}]}},
      {"nodeCode":"supply-desk-dialogue","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景？","ko-KR":"두 장면의 물건 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“主场景没有的物品／第二场景远处物品”的正确组合。","ko-KR":"주 장면에 없는 물건／두 번째 장면에서 멀리 있는 물건의 맞는 조합을 고르세요."},"options":["지우개／지도","연필／볼펜","공책／책","우산／연필"],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"主场景没有橡皮；第二场景远处是地图。","ko-KR":"주 장면에는 지우개가 없고 두 번째 장면의 먼 물건은 지도입니다."},"feedback":[{"zh-CN":"分别找主场景的否定回答和第二场景含 저거 的问答。","ko-KR":"주 장면의 부정 대답과 두 번째 장면의 저거 문답을 찾으세요."},{"zh-CN":"없어요 对应橡皮；저거 的回答是地图。","ko-KR":"없어요는 지우개에 대한 답이고 저거의 답은 지도입니다."},{"zh-CN":"正确组合是 지우개／지도。","ko-KR":"정답은 지우개／지도입니다."}]}},
      {"nodeCode":"supply-desk-dialogue","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"文具店实际没有橡皮。怎样回答 지우개가 있어요? 最自然？","ko-KR":"문구점에 지우개가 없습니다. 지우개가 있어요?에 가장 자연스러운 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择同时表达否定和“没有”的礼貌回答。","ko-KR":"부정과 없음을 함께 나타내는 공손한 대답을 고르세요."},"options":["아니요, 없어요.","네, 있어요.","지우개 주세요.","이거는 뭐예요?"],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"아니요, 없어요. 同时否定并说明没有。","ko-KR":"아니요, 없어요.는 부정하고 없다는 상태를 함께 말합니다."},"feedback":[{"zh-CN":"先确认实际状态是“没有”。","ko-KR":"실제 상태가 없다는 것을 먼저 확인하세요."},{"zh-CN":"答案要以 아니요 开头并包含 없어요。","ko-KR":"아니요로 시작하고 없어요를 포함한 답을 찾으세요."},{"zh-CN":"正确答案是 아니요, 없어요.。","ko-KR":"정답은 아니요, 없어요.입니다."}]}},
      {"nodeCode":"listen-and-request","key":"listening-missing-item","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听文具店对话，判断没有什么。","ko-KR":"문구점 대화를 듣고 없는 물건을 고르세요."},"instruction":{"zh-CN":"正常语速最多听两遍，慢速最多听一遍；只依据音频中的 있어요/없어요 作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 음성의 있어요/없어요에 근거해 답하세요."},"options":["지우개","연필","공책","우산"],"config":{"audioId":"chapter-02-listening-missing-item","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1},"answer":{"kind":"index","value":0},"transcript":"손님: 연필이 있어요? 직원: 네, 있어요. 손님: 지우개가 있어요? 직원: 아니요, 없어요. 손님: 그럼 연필 주세요. 직원: 네, 여기 있어요.","audioObjectKey":"korean-level-one/chapter-02/listening/chapter-02-listening-missing-item.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是 지우개；第二组问答明确说 아니요, 없어요.。","ko-KR":"정답은 지우개이며 두 번째 문답에서 아니요, 없어요.라고 말합니다."},"feedback":[{"zh-CN":"再听含 아니요 的回答，找它前面的物品问句。","ko-KR":"아니요가 있는 대답 앞의 물건 질문을 다시 들으세요."},{"zh-CN":"第二组问答是否定；第一组铅笔是肯定。","ko-KR":"두 번째 문답은 부정이고 첫 번째 연필 문답은 긍정입니다."},{"zh-CN":"答案是 지우개；공책 和 우산 没有出现在原文。","ko-KR":"정답은 지우개이며 공책과 우산은 원문에 나오지 않습니다."}]}},
      {"nodeCode":"listen-and-request","key":"speaking-object-request","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成约30秒、至少8轮的双角色物品交流。","ko-KR":"두 역할을 번갈아 맡아 약 30초 동안 물건 대화를 8턴 이상 이어 가세요."},"instruction":{"zh-CN":"加入至少两种距离、名称问答、两次有无问答、肯定与否定、两件物品请求和交付回应。","ko-KR":"두 거리 표현, 이름 문답, 두 번의 유무 문답, 긍정과 부정, 두 물건 요청과 전달 응답을 넣으세요."},"options":[],"config":{"minimumSeconds":25,"maximumSeconds":40,"minimumTurns":8,"requiredCriteria":6,"enforceCompletionRequirements":true,"pronunciationScore":false,"criteria":["至少两种距离","一个名称问答","两次有无问答","一个肯定和一个否定","하고连接两件物品请求","交付或结束回应"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据和六项自查，当前不提供发音评分，也不把未复核录音作为客观正确答案。","ko-KR":"녹음 정보와 여섯 항목 점검을 저장했으며 발음 점수나 검토 전 녹음을 객관식 정답으로 판정하지 않습니다."},"feedback":[{"zh-CN":"先检查两个角色、8轮、名称问答和两次有无问答。","ko-KR":"두 역할, 8턴, 이름 문답과 두 번의 유무 문답을 확인하세요."},{"zh-CN":"再检查两种距离、肯定与否定以及两件物品请求。","ko-KR":"두 거리, 긍정과 부정, 두 물건 요청을 확인하세요."},{"zh-CN":"对照六项清单补齐后重录；系统不显示虚假发音准确率。","ko-KR":"여섯 항목을 보완해 다시 녹음하세요. 시스템은 부정확한 발음 점수를 표시하지 않습니다."}]}},
      {"nodeCode":"supply-card","key":"reading-supply-card","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读课堂用品便条，完成缺少物品、请求组合和书的状态三题。","ko-KR":"수업 준비물 메모를 읽고 없는 물건, 요청한 물건과 책의 상태 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，依据必须来自卡片原句。","ko-KR":"문제마다 하나를 고르고 카드 문장에서 근거를 찾으세요."},"options":[],"config":{"reading":"수업 준비물 메모\n책이 있어요.\n공책이 있어요.\n연필이 없어요.\n지우개가 있어요.\n공책하고 지우개 주세요.","items":[{"id":"missing","question":"무엇이 없어요?","options":["연필","책","공책","지우개"]},{"id":"request","question":"무엇하고 무엇을 요청해요?","options":["공책하고 지우개","책하고 연필","공책하고 연필","책하고 지우개"]},{"id":"book","question":"책이 있어요, 없어요?","options":["있어요","없어요","몰라요","요청해요"]}],"shuffle":false},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是 연필、공책하고 지우개、있어요。","ko-KR":"정답은 차례로 연필, 공책하고 지우개, 있어요입니다."},"feedback":[{"zh-CN":"分别圈出含 없어요、주세요 和 책 的句子。","ko-KR":"없어요, 주세요와 책이 있는 문장을 각각 찾으세요."},{"zh-CN":"不要把最终请求和缺少的物品混在一起；请求中没有铅笔。","ko-KR":"마지막 요청과 없는 물건을 섞지 마세요. 요청에는 연필이 없습니다."},{"zh-CN":"依据依次是 연필이 없어요.／공책하고 지우개 주세요.／책이 있어요.。","ko-KR":"근거는 연필이 없어요.／공책하고 지우개 주세요.／책이 있어요.입니다."}]}},
      {"nodeCode":"supply-card","key":"write-object-note","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给同学写一张4—5句的课堂物品便条。","ko-KR":"친구에게 4~5문장의 수업 준비물 메모를 쓰세요."},"instruction":{"zh-CN":"写一个物品辨认、一种“有”、一种“没有”和一个连接两件物品的请求；不复制示范。","ko-KR":"물건 확인, 있음, 없음과 두 물건을 연결한 요청을 쓰고 예시를 베끼지 마세요."},"options":[],"config":{"minSentences":4,"maxSentences":5,"minimumHangulCharacters":20,"minimumPhraseGroups":5,"minimumInformationKinds":4,"requireCompletionChecklist":true,"requiredPhraseGroups":[["이거는","그거는","저거는","이 책","그 공책","저 지도"],["있어요"],["없어요"],["하고"],["주세요"]],"informationChecklist":["物品辨认","有","没有","两件物品请求"],"rubricConfirmation":"我已按信息完整、核心语法、可理解度、格式与语气完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存4—5句且含四类结构的便条和量规自查，当前不按唯一范文判定，也不把未复核写作作为客观正确答案。","ko-KR":"네 가지 구조와 자기 점검을 담은 4~5문장 메모를 저장했으며 하나의 예시와 일치시키거나 검토 전 쓰기를 객관식 정답으로 판정하지 않습니다."},"feedback":[{"zh-CN":"先数辨认、有、没有和两件请求四类信息。","ko-KR":"확인, 있음, 없음과 두 물건 요청 네 정보를 세어 보세요."},{"zh-CN":"检查 이/가、하고、주세요 与空格。","ko-KR":"이/가, 하고, 주세요와 띄어쓰기를 확인하세요."},{"zh-CN":"按结构支架补齐具体缺项，但不复制示范。","ko-KR":"구조 틀로 빠진 부분을 보완하되 예시를 그대로 베끼지 마세요."}]}},
      {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接帮助完成“物品辨认与请求”的表达。","ko-KR":"물건을 확인하고 요청할 때 직접 사용할 수 있는 표현을 모두 고르세요."},"instruction":{"zh-CN":"全部选对且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 않아야 합니다."},"options":["이거는 뭐예요?","연필이 있어요?","공책하고 연필 주세요.","지금 몇 시예요?"],"config":{"selection":"multiple"},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"辨认、问有无和两件请求都直接服务本课任务。","ko-KR":"물건 확인, 유무 질문과 두 물건 요청은 단원 과제에 직접 필요합니다."},"feedback":[{"zh-CN":"按辨认、问有无、请求三个步骤检查。","ko-KR":"물건 확인, 유무 질문, 요청 세 단계로 확인하세요."},{"zh-CN":"有一句属于时间场景。","ko-KR":"한 문장은 시간 상황의 표현입니다."},{"zh-CN":"正确集合是A、B、C；D用于询问时间。","ko-KR":"정답은 A, B, C이며 D는 시간을 묻습니다."}]}},
      {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 가지 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项时至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 모두 답하고 복습이 필요하면 돌아갈 위치를 하나 이상, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"distance","label":"我能按距离指物并问答名称／거리에 맞게 물건 이름을 묻고 답할 수 있어요"},{"id":"existence","label":"我能询问并回答物品有无／물건의 유무를 묻고 답할 수 있어요"},{"id":"request","label":"我能连接两件物品并请求／두 물건을 연결해 요청할 수 있어요"},{"id":"readingWriting","label":"我能读写课堂用品便条／준비물 메모를 읽고 쓸 수 있어요"},{"id":"dialogue","label":"我能完成30秒双角色交流／30초 두 역할 대화를 할 수 있어요"}],"returnNodes":[{"value":"objects-and-distance","label":"词汇／距离"},{"value":"point-exist-request","label":"语法"},{"value":"supply-desk-dialogue","label":"对话理解"},{"value":"listen-and-request","label":"听说"},{"value":"supply-card","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；主观自查不替代客观活动证据。","ko-KR":"다섯 항목과 복습 위치를 저장했으며 자기 점검은 객관 활동 증거를 대신하지 않습니다."},"feedback":[{"zh-CN":"逐项回想距离、有无、两件请求、读写和录音。","ko-KR":"거리, 유무, 두 물건 요청, 읽기·쓰기와 녹음을 떠올려 보세요."},{"zh-CN":"把复习需要对应到具体节点。","ko-KR":"복습 필요를 구체적인 학습 위치와 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 모두 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
    ]
    $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = activity_seed ->> 'nodeCode';

    insert into public.digital_textbook_activities (
      node_id, activity_key, activity_type, sort_order,
      prompt, instruction, options, public_config, max_attempts,
      counts_toward_completion
    ) values (
      node_uuid,
      activity_seed ->> 'key',
      activity_seed ->> 'type',
      (activity_seed ->> 'order')::integer,
      activity_seed -> 'prompt',
      activity_seed -> 'instruction',
      activity_seed -> 'options',
      activity_seed -> 'config',
      (activity_seed ->> 'maxAttempts')::integer,
      (activity_seed ->> 'counts')::boolean
    )
    on conflict (node_id, activity_key) do update set
      activity_type = excluded.activity_type,
      sort_order = excluded.sort_order,
      prompt = excluded.prompt,
      instruction = excluded.instruction,
      options = excluded.options,
      public_config = excluded.public_config,
      max_attempts = excluded.max_attempts,
      counts_toward_completion = excluded.counts_toward_completion,
      updated_at = now()
    returning id into activity_uuid;

    insert into public.digital_textbook_activity_secrets (
      activity_id, answer_key, explanation, transcript_ko,
      audio_object_key, audio_status
    ) values (
      activity_uuid,
      activity_seed -> 'answer',
      activity_seed -> 'explanation',
      activity_seed ->> 'transcript',
      activity_seed ->> 'audioObjectKey',
      coalesce(activity_seed ->> 'audioStatus', 'pending')
    )
    on conflict (activity_id) do update set
      answer_key = excluded.answer_key,
      explanation = excluded.explanation,
      transcript_ko = excluded.transcript_ko,
      audio_object_key = excluded.audio_object_key,
      audio_status = excluded.audio_status,
      updated_at = now();
  end loop;

  delete from public.digital_textbook_activities as activity
  using public.digital_textbook_nodes as node,
        public.digital_textbook_modules as module
  where activity.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check', 'vocabulary-check', 'grammar-fill', 'pattern-order',
      'dialogue-fact-check', 'dialogue-response', 'listening-missing-item',
      'speaking-object-request', 'reading-supply-card', 'write-object-note',
      'review-multiple', 'self-check'
    );

  for media_seed in
    select value from jsonb_array_elements($images$
    [
      {"nodeCode":"mission-map","key":"chapter-02-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-02/images/chapter-02-01-scene.png","alt":{"zh-CN":"校园文具店柜台，顾客和店员两侧及远处展示架呈现三种清晰物品距离。","ko-KR":"교내 문구점에서 손님과 직원 양쪽, 먼 진열대에 물건이 놓여 세 거리가 보입니다."},"width":1600,"height":900},
      {"nodeCode":"objects-and-distance","key":"chapter-02-image-02","purpose":"核心词汇课堂物品卡","objectKey":"korean-level-one/chapter-02/images/chapter-02-02-vocabulary.png","alt":{"zh-CN":"十种课堂与随身物品的无品牌实物教学卡，不在图片中写答案。","ko-KR":"상표와 정답 글자가 없는 열 가지 수업 및 소지품 학습 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"point-exist-request","key":"chapter-02-image-03","purpose":"距离、有无、连接与请求总图","objectKey":"korean-level-one/chapter-02/images/chapter-02-03-grammar-overview.png","alt":{"zh-CN":"三种距离、收音分流、名词连接与礼貌请求的完整语法流程图。","ko-KR":"세 거리, 받침 분기, 명사 연결과 공손한 요청의 문법 흐름도입니다."},"width":1600,"height":900},
      {"nodeCode":"point-exist-request","key":"chapter-02-image-04","purpose":"이/가有无结构图","objectKey":"korean-level-one/chapter-02/images/chapter-02-03a-existence.png","alt":{"zh-CN":"按名词末音节有无收音分流到이或가，并连接있어요或없어요。","ko-KR":"명사 받침에 따라 이 또는 가를 고르고 있어요나 없어요로 이어집니다."},"width":1200,"height":900},
      {"nodeCode":"point-exist-request","key":"chapter-02-image-05","purpose":"指示距离结构图","objectKey":"korean-level-one/chapter-02/images/chapter-02-03b-distance.png","alt":{"zh-CN":"说话人、听话人与物品位置对应이、그、저三种距离。","ko-KR":"말하는 사람, 듣는 사람과 물건 위치가 이, 그, 저 세 거리에 대응합니다."},"width":1200,"height":900},
      {"nodeCode":"point-exist-request","key":"chapter-02-image-06","purpose":"名词请求结构图","objectKey":"korean-level-one/chapter-02/images/chapter-02-03c-request.png","alt":{"zh-CN":"名词后留空格再接주세요的礼貌请求结构。","ko-KR":"명사 뒤를 띄고 주세요를 붙이는 공손한 요청 구조입니다."},"width":1200,"height":900},
      {"nodeCode":"point-exist-request","key":"chapter-02-image-07","purpose":"名词连接结构图","objectKey":"korean-level-one/chapter-02/images/chapter-02-03d-connector.png","alt":{"zh-CN":"口语하고与书面과/와连接两个名词的分流图。","ko-KR":"구어 하고와 중립적 과/와로 두 명사를 연결하는 분기 그림입니다."},"width":1200,"height":900},
      {"nodeCode":"object-exchange-lab","key":"chapter-02-image-08","purpose":"句型对话语块卡","objectKey":"korean-level-one/chapter-02/images/chapter-02-04-pattern-blocks.png","alt":{"zh-CN":"询问名称、回答、询问有无、回应和请求五张完整话轮卡。","ko-KR":"이름 질문, 대답, 유무 질문, 응답과 요청을 나타내는 다섯 말차례 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"supply-desk-dialogue","key":"chapter-02-image-09","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-02/images/chapter-02-05-dialogue.png","alt":{"zh-CN":"校园文具店柜台与教室书桌旁两个物品交流场景，空间关系清楚。","ko-KR":"교내 문구점 계산대와 교실 책상 옆의 두 물건 대화 장면입니다."},"width":1600,"height":900},
      {"nodeCode":"listen-and-request","key":"chapter-02-image-10","purpose":"听力物品选项图","objectKey":"korean-level-one/chapter-02/images/chapter-02-06-listening-options.png","alt":{"zh-CN":"铅笔、橡皮、笔记本和雨伞四张无文字实物选项卡。","ko-KR":"글자 없는 연필, 지우개, 공책과 우산 네 가지 선택 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"supply-card","key":"chapter-02-image-11","purpose":"课堂用品便条版式","objectKey":"korean-level-one/chapter-02/images/chapter-02-07-supply-note.png","alt":{"zh-CN":"同学之间使用的简洁课堂用品便条版式，不用图标泄露答案。","ko-KR":"정답 아이콘이 없는 친구 사이의 간단한 수업 준비물 메모 양식입니다."},"width":1200,"height":1600},
      {"nodeCode":"can-do-check","key":"chapter-02-image-12","purpose":"最终双角色任务流程图","objectKey":"korean-level-one/chapter-02/images/chapter-02-08-final-task.png","alt":{"zh-CN":"从指物、名称问答、两次有无问答到两件请求、交付和录音提交的流程。","ko-KR":"물건 지시, 이름 문답, 두 번의 유무 문답, 두 물건 요청, 전달과 녹음 제출 흐름입니다."},"width":1600,"height":900}
    ]
    $images$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = media_seed ->> 'nodeCode';

    insert into public.digital_textbook_media_assets (
      node_id, asset_key, media_type, purpose, object_key,
      production_status, alt_text, metadata
    ) values (
      node_uuid,
      media_seed ->> 'key',
      'image',
      media_seed ->> 'purpose',
      media_seed ->> 'objectKey',
      'pending',
      media_seed -> 'alt',
      jsonb_build_object(
        'width', (media_seed ->> 'width')::integer,
        'height', (media_seed ->> 'height')::integer,
        'sourceStatus', '待制作'
      )
    )
    on conflict (node_id, asset_key) do update set
      purpose = excluded.purpose,
      object_key = excluded.object_key,
      production_status = 'pending',
      alt_text = excluded.alt_text,
      metadata = excluded.metadata,
      updated_at = now();
  end loop;

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'objects-and-distance';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    'chapter-02-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇原形点读',
    'korean-level-one/chapter-02/audio/vocabulary/chapter-02-vocabulary-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-02-vocabulary-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value ->> 'word')
  from jsonb_array_elements($vocabulary$
    [{"word":"물건","collocation":"물건이 있어요."},{"word":"책","collocation":"책이 있어요."},{"word":"공책","collocation":"공책 주세요."},{"word":"연필","collocation":"연필이 있어요?"},{"word":"볼펜","collocation":"볼펜이 없어요."},{"word":"지우개","collocation":"지우개가 있어요?"},{"word":"가방","collocation":"이거는 가방이에요."},{"word":"휴대폰","collocation":"휴대폰이 있어요?"},{"word":"우산","collocation":"저 우산"},{"word":"열쇠","collocation":"열쇠가 있어요."},{"word":"지도","collocation":"저거는 지도예요."},{"word":"이거","collocation":"이거는 뭐예요?"},{"word":"그거","collocation":"그거는 공책이에요?"},{"word":"저거","collocation":"저거는 지도예요."},{"word":"이／그／저","collocation":"이 책／그 공책／저 지도"},{"word":"있다","collocation":"공책이 있어요."},{"word":"없다","collocation":"연필이 없어요."},{"word":"여기","collocation":"네, 여기 있어요."}]
  $vocabulary$::jsonb) with ordinality as item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    'chapter-02-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇搭配例句点读',
    'korean-level-one/chapter-02/audio/vocabulary/chapter-02-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-02-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value ->> 'collocation')
  from jsonb_array_elements($vocabulary$
    [{"word":"물건","collocation":"물건이 있어요."},{"word":"책","collocation":"책이 있어요."},{"word":"공책","collocation":"공책 주세요."},{"word":"연필","collocation":"연필이 있어요?"},{"word":"볼펜","collocation":"볼펜이 없어요."},{"word":"지우개","collocation":"지우개가 있어요?"},{"word":"가방","collocation":"이거는 가방이에요."},{"word":"휴대폰","collocation":"휴대폰이 있어요?"},{"word":"우산","collocation":"저 우산"},{"word":"열쇠","collocation":"열쇠가 있어요."},{"word":"지도","collocation":"저거는 지도예요."},{"word":"이거","collocation":"이거는 뭐예요?"},{"word":"그거","collocation":"그거는 공책이에요?"},{"word":"저거","collocation":"저거는 지도예요."},{"word":"이／그／저","collocation":"이 책／그 공책／저 지도"},{"word":"있다","collocation":"공책이 있어요."},{"word":"없다","collocation":"연필이 없어요."},{"word":"여기","collocation":"네, 여기 있어요."}]
  $vocabulary$::jsonb) with ordinality as item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'point-exist-request';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    item.value ->> 'id',
    'audio',
    '语法卡母版与语境复现例句',
    'korean-level-one/chapter-02/audio/grammar/' || (item.value ->> 'id') || '.mp3',
    'pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', item.value ->> 'id', 'script', item.value ->> 'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-02-grammar-01-example-01","script":"연필이 있어요?"},{"id":"chapter-02-grammar-01-example-02","script":"지우개가 있어요? 아니요, 없어요."},{"id":"chapter-02-grammar-01-example-03","script":"책이 있어요. 연필이 없어요."},{"id":"chapter-02-grammar-02-example-01","script":"이거는 뭐예요?"},{"id":"chapter-02-grammar-02-example-02","script":"민지 씨, 그거는 연필이에요?"},{"id":"chapter-02-grammar-02-example-03","script":"이 우산이에요? 아니요, 저 우산이에요."},{"id":"chapter-02-grammar-03-example-01","script":"연필 주세요."},{"id":"chapter-02-grammar-03-example-02","script":"공책하고 연필 주세요."},{"id":"chapter-02-grammar-03-example-03","script":"그럼 연필 주세요."},{"id":"chapter-02-grammar-04-example-01","script":"공책하고 연필 주세요."},{"id":"chapter-02-grammar-04-example-02","script":"공책하고 지우개 주세요."},{"id":"chapter-02-grammar-04-example-03","script":"그럼 공책하고 연필 주세요."}]
  $grammar$::jsonb) as item(value)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'supply-desk-dialogue';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    item.value ->> 'id',
    'audio',
    item.value ->> 'purpose',
    'korean-level-one/chapter-02/audio/dialogue/' || (item.value ->> 'id') || '.mp3',
    'pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,
    item.value - 'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-02-dialogue-main-line-01","purpose":"主对话逐句","script":"안녕하세요? 이거는 뭐예요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-main-line-02","purpose":"主对话逐句","script":"공책이에요.","speaker":"F01／지은"},{"id":"chapter-02-dialogue-main-line-03","purpose":"主对话逐句","script":"연필이 있어요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 있어요.","speaker":"F01／지은"},{"id":"chapter-02-dialogue-main-line-05","purpose":"主对话逐句","script":"지우개가 있어요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-main-line-06","purpose":"主对话逐句","script":"아니요, 없어요.","speaker":"F01／지은"},{"id":"chapter-02-dialogue-main-line-07","purpose":"主对话逐句","script":"그럼 공책하고 연필 주세요.","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-main-line-08","purpose":"主对话逐句","script":"네, 여기 있어요.","speaker":"F01／지은"},{"id":"chapter-02-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"M01／F01"},{"id":"chapter-02-dialogue-alt-line-01","purpose":"第二对话逐句","script":"민지 씨, 그거는 연필이에요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-alt-line-02","purpose":"第二对话逐句","script":"아니요, 볼펜이에요.","speaker":"F02／민지"},{"id":"chapter-02-dialogue-alt-line-03","purpose":"第二对话逐句","script":"아, 네. 저거는 뭐예요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-alt-line-04","purpose":"第二对话逐句","script":"지도예요.","speaker":"F02／민지"},{"id":"chapter-02-dialogue-alt-line-05","purpose":"第二对话逐句","script":"책이 있어요?","speaker":"M01／왕밍"},{"id":"chapter-02-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 여기 있어요.","speaker":"F02／민지"},{"id":"chapter-02-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M01／F02"}]
  $dialogue$::jsonb) as item(value)
  on conflict (node_id, asset_key) do update set
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id, activity.id into node_uuid, activity_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_activities as activity on activity.node_id = node.id
  where module.chapter_id = chapter_uuid
    and node.node_code = 'listen-and-request'
    and activity.activity_key = 'listening-missing-item';

  insert into public.digital_textbook_media_assets (
    node_id, activity_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  ) values
  (
    node_uuid, activity_uuid, 'chapter-02-listening-missing-item-normal', 'audio',
    '私有听力正常语速',
    'korean-level-one/chapter-02/listening/chapter-02-listening-missing-item-normal.mp3',
    'pending',
    '{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"M02／F03","scriptVisibility":"private","speed":"normal"}'::jsonb
  ),
  (
    node_uuid, activity_uuid, 'chapter-02-listening-missing-item-slow', 'audio',
    '私有听力慢速',
    'korean-level-one/chapter-02/listening/chapter-02-listening-missing-item-slow.mp3',
    'pending',
    '{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"M02／F03","scriptVisibility":"private","speed":"slow"}'::jsonb
  )
  on conflict (node_id, asset_key) do update set
    activity_id = excluded.activity_id,
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    alt_text = excluded.alt_text,
    metadata = excluded.metadata,
    updated_at = now();
end;
$seed$;

-- Chapter two requires its validated speaking, writing and self-check submissions
-- for node/chapter completion. They remain unscored NULL evidence; only objective
-- activities can ever be persisted as is_correct=true.

create or replace function public.record_smart_textbook_attempt(
  p_tenant_id uuid,
  p_student_id uuid,
  p_activity_id uuid,
  p_version_id uuid,
  p_response jsonb,
  p_is_correct boolean,
  p_score numeric
)
returns table (
  attempt_number integer,
  node_completed boolean,
  completion_percent integer,
  mastery_score integer,
  node_attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_node_id uuid;
  v_activity_type text;
  v_max_attempts integer;
  v_attempt_number integer;
  v_total_required integer;
  v_completed_required integer;
  v_completion_percent integer;
  v_mastery_score integer;
  v_node_attempt_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SMART_TEXTBOOK_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    raise exception 'SMART_TEXTBOOK_SCORE_OUT_OF_RANGE'
      using errcode = '22023';
  end if;

  select activity.node_id, activity.activity_type, activity.max_attempts
  into v_node_id, v_activity_type, v_max_attempts
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  where activity.id = p_activity_id
    and chapter.version_id = p_version_id;

  if v_node_id is null then
    raise exception 'SMART_TEXTBOOK_ACTIVITY_VERSION_MISMATCH'
      using errcode = '22023';
  end if;

  if v_activity_type in ('speaking', 'writing', 'self_check')
    and not (
      (p_is_correct is null and p_score is null)
      or (p_is_correct is false and p_score = 0)
    ) then
    raise exception 'SMART_TEXTBOOK_OPEN_ACTIVITY_CANNOT_BE_SCORED'
      using errcode = '22023';
  end if;

  -- The transaction-scoped advisory lock makes max-attempt checking and the
  -- next number a single atomic operation for this learner/activity.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_tenant_id::text || ':' || p_student_id::text || ':' || p_activity_id::text,
      0
    )
  );

  select coalesce(max(attempt.attempt_number), 0), count(*)::integer
  into v_attempt_number, v_node_attempt_count
  from public.digital_textbook_attempts as attempt
  where attempt.tenant_id = p_tenant_id
    and attempt.student_id = p_student_id
    and attempt.activity_id = p_activity_id;

  if v_node_attempt_count >= v_max_attempts then
    raise exception 'MAX_ATTEMPTS_REACHED: %', v_max_attempts
      using errcode = 'P0001';
  end if;

  v_attempt_number := v_attempt_number + 1;

  insert into public.digital_textbook_attempts (
    tenant_id, student_id, activity_id, version_id, attempt_number,
    response, is_correct, score
  ) values (
    p_tenant_id, p_student_id, p_activity_id, p_version_id, v_attempt_number,
    coalesce(p_response, 'null'::jsonb), p_is_correct, p_score
  );

  -- Serialize derived progress updates per learner/node as well. Any progress
  -- error aborts this function and rolls back the attempt in the same transaction.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_tenant_id::text || ':' || p_student_id::text || ':' || v_node_id::text,
      1
    )
  );

  select count(*)::integer
  into v_total_required
  from public.digital_textbook_activities as activity
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  select count(distinct activity.id)::integer
  into v_completed_required
  from public.digital_textbook_activities as activity
  join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = p_tenant_id
   and attempt.student_id = p_student_id
   and attempt.version_id = p_version_id
   and (
     attempt.is_correct is true
     or (
       activity.activity_type in ('speaking', 'writing', 'self_check')
       and attempt.is_correct is null
     )
   )
  where activity.node_id = v_node_id
    and activity.counts_toward_completion;

  v_completion_percent := case
    when v_total_required = 0 then 0
    else round(100.0 * v_completed_required / v_total_required)::integer
  end;

  select coalesce(round(avg(best.best_score)), 0)::integer
  into v_mastery_score
  from (
    select max(attempt.score) as best_score
    from public.digital_textbook_activities as activity
    left join public.digital_textbook_attempts as attempt
      on attempt.activity_id = activity.id
     and attempt.tenant_id = p_tenant_id
     and attempt.student_id = p_student_id
     and attempt.version_id = p_version_id
    where activity.node_id = v_node_id
      and activity.counts_toward_completion
    group by activity.id
  ) as best;

  select count(*)::integer
  into v_node_attempt_count
  from public.digital_textbook_attempts as attempt
  join public.digital_textbook_activities as activity
    on activity.id = attempt.activity_id
  where activity.node_id = v_node_id
    and attempt.tenant_id = p_tenant_id
    and attempt.student_id = p_student_id
    and attempt.version_id = p_version_id;

  insert into public.digital_textbook_node_progress (
    tenant_id, student_id, node_id, version_id, status,
    completion_percent, mastery_score, attempt_count,
    last_activity_at, updated_at
  ) values (
    p_tenant_id, p_student_id, v_node_id, p_version_id,
    case
      when v_total_required > 0 and v_completed_required = v_total_required
        then 'completed'
      else 'in_progress'
    end,
    v_completion_percent, v_mastery_score, v_node_attempt_count,
    now(), now()
  )
  on conflict (tenant_id, student_id, node_id, version_id) do update set
    status = excluded.status,
    completion_percent = excluded.completion_percent,
    mastery_score = excluded.mastery_score,
    attempt_count = excluded.attempt_count,
    last_activity_at = excluded.last_activity_at,
    updated_at = excluded.updated_at;

  return query select
    v_attempt_number,
    v_total_required > 0 and v_completed_required = v_total_required,
    v_completion_percent,
    v_mastery_score,
    v_node_attempt_count;
end;
$$;

revoke all on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) to service_role;

comment on function public.record_smart_textbook_attempt(
  uuid, uuid, uuid, uuid, jsonb, boolean, numeric
) is
  'Service-only atomic attempt recorder. Objective completion requires is_correct=true; validated open submissions use NULL/NULL completion evidence, while failed open attempts use false/0 and never count as completion.';

create or replace function private.sync_smart_textbook_chapter_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chapter_id uuid;
  v_test_slug text;
  v_student_app_id uuid;
  v_total_nodes integer;
  v_completed_nodes integer;
  v_total_activities integer;
  v_completed_activities integer;
begin
  if new.status <> 'completed' or new.completion_percent < 100 then
    return new;
  end if;

  select chapter.id, test.slug, test.student_app_id
  into v_chapter_id, v_test_slug, v_student_app_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.chapter_tests as test on test.id = chapter.chapter_test_id
  where node.id = new.node_id
    and chapter.version_id = new.version_id
    and test.status = 'published';

  if v_chapter_id is null then return new; end if;

  select count(*) into v_total_nodes
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id;

  select count(*) into v_completed_nodes
  from public.digital_textbook_node_progress as progress
  join public.digital_textbook_nodes as node on node.id = progress.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id
    and progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.version_id = new.version_id
    and progress.status = 'completed'
    and progress.completion_percent = 100;

  if v_total_nodes <> 8 or v_completed_nodes <> v_total_nodes then
    return new;
  end if;

  select count(*) into v_total_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = v_chapter_id
    and activity.counts_toward_completion;

  select count(distinct activity.id) into v_completed_activities
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_attempts as attempt
    on attempt.activity_id = activity.id
   and attempt.tenant_id = new.tenant_id
   and attempt.student_id = new.student_id
   and attempt.version_id = new.version_id
   and (
     attempt.is_correct is true
     or (
       activity.activity_type in ('speaking', 'writing', 'self_check')
       and attempt.is_correct is null
     )
   )
  where module.chapter_id = v_chapter_id
    and activity.counts_toward_completion;

  if v_total_activities = 0 or v_completed_activities <> v_total_activities then
    return new;
  end if;

  insert into public.course_ebook_progress (
    tenant_id, student_id, student_app_id, test_slug,
    current_page, total_pages, progress_percent, read_pages,
    reading_seconds, completion_source, last_read_at, updated_at
  ) values (
    new.tenant_id, new.student_id, v_student_app_id, v_test_slug,
    0, 32, 0, '{}'::integer[], 0, 'smart_textbook', now(), now()
  )
  on conflict (tenant_id, student_id, test_slug) do nothing;

  update public.course_ebook_progress as progress
  set
    progress_percent = 100,
    completion_source = case
      when progress.completion_source = 'both' then 'both'
      when progress.completion_source = 'ebook'
        and progress.progress_percent >= 100
        and progress.reading_seconds >= 600 then 'both'
      else 'smart_textbook'
    end,
    updated_at = now()
  where progress.tenant_id = new.tenant_id
    and progress.student_id = new.student_id
    and progress.test_slug = v_test_slug;

  return new;
end;
$$;

commit;
