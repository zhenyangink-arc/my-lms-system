begin;

-- Converted from the read-only UPLY BOOK chapter-three master.
-- source_sha256: 6b4b35769af5d68d429fcd471a448ea0447f53cab3c040ccabdd8503550c6f72
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are the master's recorded values.

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
    raise exception 'Cannot convert chapter 03: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner'
    and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 03: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-03'
  limit 1;

  if test_uuid is null then
    select id into test_uuid
    from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 3
    limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3300000-0000-4000-8000-000000000003'::uuid,
      lesson_uuid,
      'korean-level-one-03',
      'korean-level-one',
      3,
      '第 03 章测试：学习韩语',
      '제03과 평가: 한국어를 공부해요',
      '检查日常动作词汇、日常礼貌体、动作对象、动作场所、频率与否定表达。',
      12,
      60,
      '{"recognition":"词汇识别","structure":"语法形态","reading":"对话与日记理解","assembly":"日常介绍组织"}'::jsonb,
      1,
      'draft',
      '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests
    set lesson_id = lesson_uuid,
        slug = 'korean-level-one-03',
        course_key = 'korean-level-one',
        chapter_number = 3,
        title = '第 03 章测试：学习韩语',
        korean_title = '제03과 평가: 한국어를 공부해요',
        description = '检查日常动作词汇、日常礼貌体、动作对象、动作场所、频率与否定表达。',
        duration_minutes = 12,
        passing_score = 60,
        skills = '{"recognition":"词汇识别","structure":"语法形态","reading":"对话与日记理解","assembly":"日常介绍组织"}'::jsonb,
        version = 1,
        status = 'draft',
        student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
        updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id = test_uuid
    and question_key not in (
      'golden-03-01', 'golden-03-02', 'golden-03-03', 'golden-03-04',
      'golden-03-05', 'golden-03-06', 'golden-03-07', 'golden-03-08',
      'golden-03-09', 'golden-03-10', 'golden-03-11', 'golden-03-12'
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
    (test_uuid, 'golden-03-01', '“읽어요”表示哪一项动作？', '["读","吃","喝","休息"]', 0, '읽다 的日常礼貌体是 읽어요，表示“读”。', 'recognition', 1, 'single_choice', 10, 'foundation', '["动作词汇","母本§4"]', 'draft', 1, true, 'STEP 02', '母本 §4'),
    (test_uuid, 'golden-03-02', '哪一句表示“每天学习韩语”？', '["매일 한국어를 공부해요.","자주 친구를 만나요.","오늘은 운동을 안 해요.","집에서 쉬어요."]', 0, '매일 表示“每天”，한국어를 공부해요 表示“学习韩语”。', 'recognition', 2, 'single_choice', 10, 'foundation', '["频率","母本§2"]', 'draft', 1, true, 'STEP 02', '母本 §2'),
    (test_uuid, 'golden-03-03', '“공부하다”变为本课日常礼貌体，应选择哪一项？', '["공부해요","공부어요","공부하다요","공부아요"]', 0, '하다 去掉 다 后变为 해요。', 'structure', 3, 'single_choice', 10, 'foundation', '["아어요","母本§5.1"]', 'draft', 1, true, 'STEP 03', '母本 §5.1'),
    (test_uuid, 'golden-03-04', '“책___ 읽어요.”应填入哪一项？', '["를","을","에서","안"]', 1, '책 有收音，用动作对象助词 을。', 'structure', 4, 'single_choice', 10, 'foundation', '["을를","母本§5.2"]', 'draft', 1, true, 'STEP 03', '母本 §5.2'),
    (test_uuid, 'golden-03-05', '“한국어___ 공부해요.”应填入哪一项？', '["를","을","에서","이"]', 0, '한국어 无收音，用动作对象助词 를。', 'structure', 5, 'single_choice', 10, 'foundation', '["을를","母本§5.2"]', 'draft', 1, true, 'STEP 03', '母本 §5.2'),
    (test_uuid, 'golden-03-06', '哪一句正确表达“在图书馆读书”？', '["도서관에 책을 읽어요.","도서관에서 책을 읽어요.","도서관을 책에서 읽어요.","도서관에서 책이 읽어요."]', 1, '动作发生的地点用 에서，动作对象 책 用 을。', 'structure', 6, 'single_choice', 10, 'foundation', '["에서","母本§5.3"]', 'draft', 1, true, 'STEP 03', '母本 §5.3'),
    (test_uuid, 'golden-03-07', '哪一句正确表达“今天不运动”？', '["오늘은 안 운동해요.","오늘은 운동을 안 해요.","오늘은 운동을 못 안 해요.","오늘은 운동에서 안 해요."]', 1, '本课自然形式为 운동을 안 해요，안 放在 해요 前。', 'structure', 7, 'single_choice', 10, 'medium', '["否定","母本§5.4"]', 'draft', 1, true, 'STEP 03', '母本 §5.4'),
    (test_uuid, 'golden-03-08', '主场景中，丽娜在食堂做什么？', '["只读书","见朋友并吃饭","运动并喝咖啡","学习韩语并看电影"]', 1, '丽娜说“식당에서 친구를 만나요. 밥을 먹어요.”。', 'reading', 8, 'single_choice', 10, 'foundation', '["对话事实","母本§6.1"]', 'draft', 1, true, 'STEP 05', '母本 §6.1'),
    (test_uuid, 'golden-03-09', '秀珍说今天不运动后，志勋怎样自然继续确认？', '["그럼 집에서 쉬어요?","네, 운동해요.","이거는 뭐예요?","얼마예요?"]', 0, '그럼 承接否定信息，并询问替代活动。', 'reading', 9, 'single_choice', 10, 'medium', '["自然回应","母本§6.2"]', 'draft', 1, true, 'STEP 05', '母本 §6.2'),
    (test_uuid, 'golden-03-10', '“我的一天”阅读卡中，在家做什么？', '["看电影","读书","吃饭","见朋友"]', 0, '阅读卡原句是“집에서 영화를 봐요.”。', 'reading', 10, 'single_choice', 10, 'foundation', '["阅读","母本§8.1"]', 'draft', 1, true, 'STEP 07', '母本 §8.1'),
    (test_uuid, 'golden-03-11', '按本课指定结构，哪一顺序最合适？', '["动作→对象→地点→频率→话题","话题→频率→地点→对象→动作","地点→话题→动作→对象→频率","对象→动作→话题→地点→频率"]', 1, '本课排序活动指定“话题—频率—动作场所—动作对象—动作”。', 'assembly', 11, 'single_choice', 10, 'medium', '["信息结构","母本§3.4"]', 'draft', 1, true, 'STEP 08', '母本 §3.4'),
    (test_uuid, 'golden-03-12', '课末“我的一天”口头介绍必须满足哪一项？', '["只说一个动作","35—50秒、5—6句，并包含三场所、三动作、两对象、频率和否定","必须逐字背诵阅读卡","必须获得自动发音分数"]', 1, '母本明确要求35—50秒、5—6句以及五类信息；当前不做发音精确自动评分。', 'assembly', 12, 'single_choice', 10, 'medium', '["任务合同","母本§7.2"]', 'draft', 1, true, 'STEP 08', '母本 §7.2')
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
    and (chapter_number = 3 or slug = 'daily-actions')
  order by (slug = 'daily-actions') desc
  limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal,
      status, production_status, editorial_status, native_review_status,
      audio_status, image_status, source_revision
    ) values (
      version_uuid,
      test_uuid,
      'daily-actions',
      3,
      '{"zh-CN":"学习韩语","ko-KR":"한국어를 공부해요"}'::jsonb,
      '{"zh-CN":"丽娜和敏智在校园休息区交流平常在学校、图书馆、食堂和家里做什么，并整理一段“我的一天”介绍。","ko-KR":"리나와 민지는 교내 휴게 공간에서 학교, 도서관, 식당과 집에서 평소 무엇을 하는지 이야기하고 나의 하루 소개를 준비합니다."}'::jsonb,
      '{"zh-CN":"使用日常礼貌体、을/를、动作场所에서、频率副词和안，完成35—50秒、5—6句的“我的一天”介绍。","ko-KR":"해요체, 을/를, 행동 장소 에서, 빈도 부사와 안을 사용하여 35~50초 동안 5~6문장으로 나의 하루를 소개합니다."}'::jsonb,
      'draft', 'editorial_review', 'pending', 'pending', 'pending', 'pending',
      'UPLY BOOK 第03课 한국어를 공부해요.md @ 2026-08-18 / sha256:6b4b35769af5d68d429fcd471a448ea0447f53cab3c040ccabdd8503550c6f72'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters
    set chapter_test_id = test_uuid,
        slug = 'daily-actions',
        chapter_number = 3,
        title = '{"zh-CN":"学习韩语","ko-KR":"한국어를 공부해요"}'::jsonb,
        scenario = '{"zh-CN":"丽娜和敏智在校园休息区交流平常在学校、图书馆、食堂和家里做什么，并整理一段“我的一天”介绍。","ko-KR":"리나와 민지는 교내 휴게 공간에서 학교, 도서관, 식당과 집에서 평소 무엇을 하는지 이야기하고 나의 하루 소개를 준비합니다."}'::jsonb,
        goal = '{"zh-CN":"使用日常礼貌体、을/를、动作场所에서、频率副词和안，完成35—50秒、5—6句的“我的一天”介绍。","ko-KR":"해요체, 을/를, 행동 장소 에서, 빈도 부사와 안을 사용하여 35~50초 동안 5~6문장으로 나의 하루를 소개합니다."}'::jsonb,
        status = 'draft',
        production_status = 'editorial_review',
        editorial_status = 'pending',
        native_review_status = 'pending',
        audio_status = 'pending',
        image_status = 'pending',
        source_revision = 'UPLY BOOK 第03课 한국어를 공부해요.md @ 2026-08-18 / sha256:6b4b35769af5d68d429fcd471a448ea0447f53cab3c040ccabdd8503550c6f72',
        updated_at = now()
    where id = chapter_uuid;
  end if;

  for module_seed in
    select value from jsonb_array_elements($modules$
    [
      {
        "code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"nodeCode":"mission-map",
        "title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},
        "description":{"zh-CN":"看清人物、日常场所和课末介绍任务。","ko-KR":"인물, 일상 장소와 단원 소개 과제를 확인합니다."},
        "nodeTitle":{"zh-CN":"怎样把“一天做什么”说清楚？","ko-KR":"하루에 무엇을 하는지 어떻게 말할까요?"},
        "content":{"lead":{"zh-CN":"丽娜要说明动作、对象和场所，加入一次频率，并说清今天不做的事。","ko-KR":"리나는 행동, 대상과 장소를 말하고 빈도 한 번과 오늘 하지 않는 일을 덧붙입니다."},"targets":[{"ko":"어디에서 뭐 해요?","zh":"询问地点和活动"},{"ko":"매일 한국어를 공부해요.","zh":"说明频率和动作"},{"ko":"오늘은 운동을 안 해요.","zh":"说明今天不做的事"}],"finalOutput":{"zh-CN":"35—50秒、5—6句；至少三个场所、三项不同动作、两句动作对象、一次频率和一个안否定句。","ko-KR":"35~50초, 5~6문장으로 세 장소, 서로 다른 세 행동, 목적어 문장 두 개, 빈도와 안 부정을 포함합니다."},"coach":{"zh-CN":"本节点只以答对不计分场景诊断为强制证据。","ko-KR":"이 노드는 점수에 포함되지 않는 장면 진단 정답만 필수 증거로 사용합니다."},"nextNode":"daily-actions"}
      },
      {
        "code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"nodeCode":"daily-actions",
        "title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},
        "description":{"zh-CN":"把21个动作、对象、场所和频率词与自然搭配一起记。","ko-KR":"행동, 대상, 장소와 빈도 어휘 21개를 자연스러운 결합으로 익힙니다."},
        "nodeTitle":{"zh-CN":"把动作和自然搭配一起记","ko-KR":"행동과 자연스러운 결합을 함께 익히기"},
        "content":{"lead":{"zh-CN":"按“看图猜动作—点读词典形—跟读常用搭配—加入地点和对象”学习；全部正式音频待制作。","ko-KR":"그림으로 행동을 짐작하고 기본형, 자주 쓰는 결합, 장소와 대상을 차례로 익힙니다. 정식 음원은 모두 제작 대기 중입니다."},"vocabulary":[
          {"ko":"한국어","zh":"韩语","pos":"名词","collocation":"한국어를 공부해요."},{"ko":"공부하다","zh":"学习","pos":"动词","collocation":"학교에서 공부해요."},{"ko":"쉬다","zh":"休息","pos":"动词","collocation":"집에서 쉬어요."},{"ko":"운동하다","zh":"运动","pos":"动词","collocation":"공원에서 운동해요."},{"ko":"먹다","zh":"吃","pos":"动词","collocation":"밥을 먹어요."},{"ko":"마시다","zh":"喝","pos":"动词","collocation":"커피를 마셔요."},{"ko":"읽다","zh":"读","pos":"动词","collocation":"책을 읽어요."},{"ko":"보다","zh":"看","pos":"动词","collocation":"영화를 봐요."},{"ko":"만나다","zh":"见","pos":"动词","collocation":"친구를 만나요."},{"ko":"책","zh":"书","pos":"名词","collocation":"책을 읽어요."},{"ko":"밥","zh":"饭","pos":"名词","collocation":"밥을 먹어요."},{"ko":"영화","zh":"电影","pos":"名词","collocation":"영화를 봐요."},{"ko":"커피","zh":"咖啡","pos":"名词","collocation":"커피를 안 마셔요."},{"ko":"학교","zh":"学校","pos":"名词","collocation":"학교에서 공부해요."},{"ko":"도서관","zh":"图书馆","pos":"名词","collocation":"도서관에서 읽어요."},{"ko":"식당","zh":"食堂、餐厅","pos":"名词","collocation":"식당에서 먹어요."},{"ko":"집","zh":"家","pos":"名词","collocation":"집에서 쉬어요."},{"ko":"공원","zh":"公园","pos":"名词","collocation":"공원에서 운동해요."},{"ko":"오늘","zh":"今天","pos":"名词","collocation":"오늘은 운동을 안 해요."},{"ko":"매일","zh":"每天","pos":"副词","collocation":"매일 한국어를 공부해요."},{"ko":"자주","zh":"经常","pos":"副词","collocation":"자주 친구를 만나요."}
        ],"coach":{"zh-CN":"词义题答对并确认已朗读整句才完成；21词点读与图片快说为自主练习。","ko-KR":"뜻 문항 정답과 문장 낭독 확인이 필요하며 21개 어휘 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"polite-action-tools"}
      },
      {
        "code":"grammar","order":3,"accent":"iris","type":"learn","minutes":17,"nodeCode":"polite-action-tools",
        "title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},
        "description":{"zh-CN":"用四张语法卡说明动作、对象、动作场所和否定。","ko-KR":"네 장의 문법 카드로 행동, 대상, 행동 장소와 부정을 표현합니다."},
        "nodeTitle":{"zh-CN":"把“哪里—什么—做不做”放进句子","ko-KR":"어디에서 무엇을 하는지, 하지 않는지 문장에 담기"},
        "content":{"lead":{"zh-CN":"先把词典形变成-아/어요，再判断对象与动作场所；需要否定时把안放在谓语前。","ko-KR":"기본형을 -아/어요로 바꾸고 대상과 행동 장소를 정한 뒤 부정할 때 안을 서술어 앞에 둡니다."},"grammarCards":[
          {"form":"V/A-아/어요","function":{"zh-CN":"自然礼貌地说明现在或平常做的动作。","ko-KR":"현재나 평소 행동을 자연스럽고 공손하게 말합니다."},"rules":["词干末元音ㅏ/ㅗ通常接-아요，其余接-어요","하다→해요","보다→봐요，마시다→마셔요，쉬다→쉬어요","不能在词典形后直接加요"],"examples":[{"ko":"한국어를 공부해요.","zh":"学习韩语。","audioId":"chapter-03-grammar-01-example-01","audioStatus":"pending"},{"ko":"학교에서 한국어를 공부해요.","zh":"在学校学习韩语。","audioId":"chapter-03-grammar-01-example-02","audioStatus":"pending"},{"ko":"집에서 영화를 봐요.","zh":"在家看电影。","audioId":"chapter-03-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：한국어를 공부하다요. 正确：한국어를 공부해요.；本课不扩展过去或未来时态。","ko-KR":"잘못: 한국어를 공부하다요. 바른 표현: 한국어를 공부해요. 이 단원에서는 과거나 미래 시제로 확장하지 않습니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책의 정확한 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N을/를","function":{"zh-CN":"标记学习、阅读、吃、见等动作直接作用的对象。","ko-KR":"공부, 읽기, 먹기, 만남 같은 행동의 대상을 표시합니다."},"rules":["有收音名词后用을","无收音名词后用를","助词与名词连写，和谓语分写","쉬다等本课用法不需要直接对象"],"examples":[{"ko":"책을 읽어요.","zh":"读书。","audioId":"chapter-03-grammar-02-example-01","audioStatus":"pending"},{"ko":"도서관에서 책을 읽어요.","zh":"在图书馆读书。","audioId":"chapter-03-grammar-02-example-02","audioStatus":"pending"},{"ko":"식당에서 친구를 만나요.","zh":"在食堂见朋友。","audioId":"chapter-03-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：책를 읽어요. 正确：책을 읽어요.；不要给每个动作机械添加对象助词。","ko-KR":"잘못: 책를 읽어요. 바른 표현: 책을 읽어요. 모든 행동에 목적격 조사를 기계적으로 붙이지 않습니다."},"source":{"zh-CN":"母本§5.2；与第02课이/가存在表达区分。","ko-KR":"원고 §5.2; 제02과의 존재 표현 이/가와 구별합니다."}},
          {"form":"场所 N에서","function":{"zh-CN":"说明学习、吃饭、休息等动作发生的地点。","ko-KR":"공부, 식사, 휴식 같은 행동이 일어나는 장소를 말합니다."},"rules":["地点名词+에서+动作","에서不受收音影响","本课句末必须是动作","存在位置N에 있어요属于第04课"],"examples":[{"ko":"도서관에서 공부해요.","zh":"在图书馆学习。","audioId":"chapter-03-grammar-03-example-01","audioStatus":"pending"},{"ko":"네, 집에서 쉬어요.","zh":"是的，在家休息。","audioId":"chapter-03-grammar-03-example-02","audioStatus":"pending"},{"ko":"식당에서 밥을 먹어요.","zh":"在食堂吃饭。","audioId":"chapter-03-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：도서관에 책을 읽어요. 正确：도서관에서 책을 읽어요.；不要提前混入存在位置。","ko-KR":"잘못: 도서관에 책을 읽어요. 바른 표현: 도서관에서 책을 읽어요. 존재 위치 표현과 섞지 않습니다."},"source":{"zh-CN":"母本§5.3；存在位置에留到第04课。","ko-KR":"원고 §5.3; 존재 위치 에는 제04과에서 학습합니다."}},
          {"form":"안 + V/A","function":{"zh-CN":"说明今天或平常选择不做的事情。","ko-KR":"오늘이나 평소 하지 않는 일을 말합니다."},"rules":["안放在谓语前并分写","N하다动作常用N을/를 안 해요","안不改变后面的-아/어요形态","客观不能못留到第12课"],"examples":[{"ko":"오늘은 운동을 안 해요.","zh":"今天不运动。","audioId":"chapter-03-grammar-04-example-01","audioStatus":"pending"},{"ko":"아니요, 오늘은 운동을 안 해요.","zh":"不，今天不运动。","audioId":"chapter-03-grammar-04-example-02","audioStatus":"pending"},{"ko":"오늘은 커피를 안 마셔요.","zh":"今天不喝咖啡。","audioId":"chapter-03-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：운동안 해요. 正确：운동을 안 해요.；本课不把안和못混用。","ko-KR":"잘못: 운동안 해요. 바른 표현: 운동을 안 해요. 이 단원에서는 안과 못을 섞지 않습니다."},"source":{"zh-CN":"母本§5.4；못留到第12课。","ko-KR":"원고 §5.4; 못은 제12과에서 학습합니다."}}
        ],"coach":{"zh-CN":"六项填空全部正确才完成；功能解释和扩展变形为自主展示。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 기능 설명과 확장 활용은 자율 활동입니다."},"nextNode":"my-day-lab"}
      },
      {
        "code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,"nodeCode":"my-day-lab",
        "title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},
        "description":{"zh-CN":"按稳定信息结构组合自己的日常句。","ko-KR":"안정된 정보 구조로 자신의 일상 문장을 만듭니다."},
        "nodeTitle":{"zh-CN":"从语块到自己的日常句","ko-KR":"말덩이에서 나의 일상 문장으로"},
        "content":{"lead":{"zh-CN":"先按“话题—频率—地点—对象—动作”排序，再替换动作、对象、场所与否定。","ko-KR":"주제—빈도—장소—대상—행동 순서로 배열한 뒤 행동, 대상, 장소와 부정을 바꿉니다."},"pattern":"저는 → 매일 → 학교에서 → 한국어를 → 공부해요.","substitutionGroups":[["공부해요","먹어요","봐요","쉬어요"],["한국어를 공부해요","책을 읽어요","밥을 먹어요","영화를 봐요"],["학교에서 공부해요","도서관에서 읽어요","집에서 쉬어요","운동을 안 해요"]],"quickResponse":["어디에서 뭐 해요?","오늘 운동해요?"],"personalOutput":["频率＋场所＋对象＋动作句","另一个场所动作句","안否定句"],"coach":{"zh-CN":"五个有意义语块按指定结构完全排序正确即完成；替换、快答和个人句为自主练习。","ko-KR":"다섯 말덩이를 지정 구조로 완전히 맞히면 완료되며 대치, 빠른 응답과 개인 문장은 자율 연습입니다."},"nextNode":"daily-dialogue"}
      },
      {
        "code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":12,"nodeCode":"daily-dialogue",
        "title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},
        "description":{"zh-CN":"在校园休息区和公园入口听懂对方在哪里做什么。","ko-KR":"교내 휴게 공간과 공원 입구에서 상대가 어디에서 무엇을 하는지 이해합니다."},
        "nodeTitle":{"zh-CN":"听到地点和动作后继续交流","ko-KR":"장소와 행동을 듣고 대화 이어 가기"},
        "content":{"lead":{"zh-CN":"主场景8轮串联学校、图书馆、食堂和家；第二场景6轮练习频率与안否定。整段和逐句音频均待制作。","ko-KR":"주 장면 8턴은 학교, 도서관, 식당과 집을 연결하고 두 번째 장면 6턴은 빈도와 안 부정을 연습합니다. 음원은 모두 제작 대기 중입니다."},"dialogueScenes":[{"title":"场景1｜校园休息区","context":{"zh-CN":"敏智了解丽娜平常在不同场所做什么。","ko-KR":"민지는 리나가 여러 장소에서 평소 무엇을 하는지 알아봅니다."},"lines":[{"speaker":"민지","ko":"리나 씨, 학교에서 뭐 해요?","zh":"丽娜，你在学校做什么？"},{"speaker":"리나","ko":"학교에서 한국어를 공부해요.","zh":"在学校学习韩语。"},{"speaker":"민지","ko":"도서관에서 뭐 해요?","zh":"在图书馆做什么？"},{"speaker":"리나","ko":"도서관에서 책을 읽어요.","zh":"在图书馆读书。"},{"speaker":"민지","ko":"식당에서 뭐 해요?","zh":"在食堂做什么？"},{"speaker":"리나","ko":"식당에서 친구를 만나요. 밥을 먹어요.","zh":"在食堂见朋友、吃饭。"},{"speaker":"민지","ko":"집에서 운동해요?","zh":"在家运动吗？"},{"speaker":"리나","ko":"아니요, 운동을 안 해요. 집에서 영화를 봐요.","zh":"不，不运动。在家看电影。"}]},{"title":"场景2｜公园入口","context":{"zh-CN":"志勋确认秀珍今天不运动后的替代安排。","ko-KR":"지훈은 수진이 오늘 운동하지 않은 뒤의 다른 계획을 확인합니다."},"lines":[{"speaker":"지훈","ko":"수진 씨, 오늘 공원에서 운동해요?","zh":"秀珍，今天在公园运动吗？"},{"speaker":"수진","ko":"아니요, 오늘은 운동을 안 해요.","zh":"不，今天不运动。"},{"speaker":"지훈","ko":"그럼 집에서 쉬어요?","zh":"那么在家休息吗？"},{"speaker":"수진","ko":"네, 집에서 쉬어요.","zh":"是的，在家休息。"},{"speaker":"지훈","ko":"집에서 커피를 마셔요?","zh":"在家喝咖啡吗？"},{"speaker":"수진","ko":"아니요, 커피를 안 마셔요.","zh":"不，不喝咖啡。"}]}],"coach":{"zh-CN":"两场景事实组合题和自然回应题都答对才完成；信息替换与双角色试录为自主练习。","ko-KR":"두 장면 사실 조합과 자연스러운 응답 문항을 모두 맞혀야 하며 정보 바꾸기와 역할 녹음은 자율 연습입니다."},"nextNode":"listen-and-report"}
      },
      {
        "code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":12,"nodeCode":"listen-and-report",
        "title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},
        "description":{"zh-CN":"听出读书地点，再提交“我的一天”个人介绍。","ko-KR":"책을 읽는 장소를 듣고 나의 하루 소개를 제출합니다."},
        "nodeTitle":{"zh-CN":"听出地点，再介绍我的一天","ko-KR":"장소를 듣고 나의 하루 소개하기"},
        "content":{"lead":{"zh-CN":"听力答案只来自私有音频原话；正常速和慢速独立绑定，当前均待母语审校、录制与文件核验。","ko-KR":"듣기 답은 비공개 음성 원문에서만 찾습니다. 보통 속도와 느린 속도는 별도 연결되며 검수와 녹음 대기 중입니다."},"listenFor":["학교에서 한국어를 공부해요","도서관에서 책을 읽어요","식당에서 친구를 만나요","오늘은 커피를 안 마셔요"],"speakingFrame":"5—6句：至少三个场所＋三项不同动作＋两句动作对象＋一次频率＋一个안否定句","speakingCriteria":["至少三个场所","三项不同动作","至少两句含动作对象","一个매일或자주","一个안否定句"],"coach":{"zh-CN":"开放录音只保存完成证据与待复核提交，不产生正确性或分数；当前不显示发音准确率。","ko-KR":"공개형 녹음은 완료 증거와 검토 전 제출만 저장하며 정오나 점수를 만들지 않습니다."},"nextNode":"daily-note"}
      },
      {
        "code":"read_write","order":7,"accent":"iris","type":"practice","minutes":12,"nodeCode":"daily-note",
        "title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},
        "description":{"zh-CN":"读日常介绍，再写5—6句原创行动日记。","ko-KR":"일상 소개를 읽고 5~6문장의 새로운 활동 일기를 씁니다."},
        "nodeTitle":{"zh-CN":"读清地点和动作，写完整一天","ko-KR":"장소와 행동을 읽고 하루를 완성해 쓰기"},
        "content":{"lead":{"zh-CN":"逐句圈出地点、对象、频率和否定，再用真实或安全虚构信息写自己的日记。","ko-KR":"문장마다 장소, 대상, 빈도와 부정을 찾은 뒤 실제 또는 안전한 가상 정보로 일기를 씁니다."},"reading":"나의 하루\n저는 매일 학교에서 한국어를 공부해요.\n도서관에서 책을 읽어요.\n식당에서 밥을 먹어요.\n집에서 영화를 봐요.\n오늘은 운동을 안 해요.","questions":["어디에서 한국어를 공부해요?","집에서 무엇을 해요?","오늘 무엇을 안 해요?"],"writingFrame":"저는 매일／자주 ___에서 ___을/를 ___어요. → ___에서 ___을/를 ___어요. → ___에서 ___어요. → 오늘은 ___을/를 안 ___어요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"originalExample":"저는 자주 공원에서 운동해요. 학교에서 친구를 만나요. 식당에서 밥을 먹어요. 집에서 책을 읽어요. 오늘은 커피를 안 마셔요.","coach":{"zh-CN":"阅读三题全部答对；开放写作结构合格并完成五类信息与量规自查后记完成，仍不产生分数。","ko-KR":"읽기 세 문항을 모두 맞히고 쓰기는 구조, 다섯 정보와 자기 점검을 갖추면 완료되지만 점수는 만들지 않습니다."},"nextNode":"can-do-check"}
      },
      {
        "code":"review","order":8,"accent":"coral","type":"review","minutes":8,"nodeCode":"can-do-check",
        "title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},
        "description":{"zh-CN":"完成综合多选、五项Can-do自查并记录返回节点。","ko-KR":"종합 복수 선택과 다섯 가지 Can-do를 점검하고 복습 위치를 기록합니다."},
        "nodeTitle":{"zh-CN":"我能独立介绍一天的动作吗？","ko-KR":"하루의 행동을 혼자 소개할 수 있나요?"},
        "content":{"lead":{"zh-CN":"把错误分到词汇、语法、理解、听说或读写，再返回最短复习路径。","ko-KR":"오류를 어휘, 문법, 이해, 듣기·말하기 또는 읽기·쓰기로 나누어 가장 짧은 복습 위치로 돌아갑니다."},"checklist":[{"ko":"동사를 해요체로 바꾸어 일상 행동을 말할 수 있어요.","zh":"我能用日常礼貌体说明动作"},{"ko":"을/를을 사용하여 행동의 대상을 말할 수 있어요.","zh":"我能用을/를说明动作对象"},{"ko":"에서를 사용하여 행동 장소를 말할 수 있어요.","zh":"我能用에서说明动作场所"},{"ko":"빈도 부사와 안으로 하는 일과 하지 않는 일을 말할 수 있어요.","zh":"我能表达频率和不做的事"},{"ko":"35~50초 동안 5~6문장으로 나의 하루를 소개할 수 있어요.","zh":"我能完成35—50秒、5—6句介绍"}],"returnMap":[{"reason":"词汇","node":"daily-actions"},{"reason":"语法","node":"polite-action-tools"},{"reason":"理解","node":"daily-dialogue"},{"reason":"听说","node":"listen-and-report"},{"reason":"读写","node":"daily-note"}],"coach":{"zh-CN":"综合多选正确并提交五项自查后完成；八节点全部完成才解锁章节测试。","ko-KR":"종합 복수 선택 정답과 다섯 점검 제출 후 완료되며 여덟 노드를 모두 완료해야 단원 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-03"}
      }
    ]
    $modules$::jsonb)
  loop
    insert into public.digital_textbook_modules (
      chapter_id, module_code, sort_order, accent_role, title, description
    ) values (
      chapter_uuid, module_seed ->> 'code',
      (module_seed ->> 'order')::integer, module_seed ->> 'accent',
      module_seed -> 'title', module_seed -> 'description'
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
      module_uuid, module_seed ->> 'nodeCode', module_seed ->> 'type', 1,
      (module_seed ->> 'minutes')::integer,
      module_seed -> 'nodeTitle', module_seed -> 'content'
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
      {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"敏智想知道丽娜平常在哪里做什么，最合适先问哪一句？","ko-KR":"민지는 리나가 평소 어디에서 무엇을 하는지 알고 싶습니다. 가장 알맞은 첫 질문은 무엇이에요?"},"instruction":{"zh-CN":"选择一个同时询问动作地点和活动的表达；本题不显示分数。","ko-KR":"행동 장소와 활동을 함께 묻는 표현을 하나 고르세요. 점수를 표시하지 않습니다."},"options":["어디에서 뭐 해요?","이거는 뭐예요?","얼마예요?","어디에 있어요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"어디에서 뭐 해요? 同时询问动作地点和活动。","ko-KR":"어디에서 뭐 해요?는 행동 장소와 활동을 함께 묻습니다."},"feedback":[{"zh-CN":"先找句末表示“做”的해요。","ko-KR":"먼저 행동을 나타내는 해요를 찾으세요."},{"zh-CN":"题目同时需要“哪里”和“做什么”，动作地点用에서。","ko-KR":"어디와 무엇을 하는지를 함께 묻고 행동 장소에는 에서를 씁니다."},{"zh-CN":"答案是어디에서 뭐 해요?；其余分别询问物品、价格或存在位置。","ko-KR":"정답은 어디에서 뭐 해요?이며 나머지는 물건, 가격 또는 존재 위치를 묻습니다."}]}},
      {"nodeCode":"daily-actions","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在도서관에서 책을 읽어요.中，읽어요表示什么？","ko-KR":"도서관에서 책을 읽어요.에서 읽어요는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인란을 선택하세요."},"options":["读","吃","喝","休息"],"config":{"shuffle":true,"audioPending":true,"readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"읽어요表示“读”，整句表示“在图书馆读书”。","ko-KR":"읽어요는 읽는 행동이며 문장은 도서관에서 책을 읽는다는 뜻입니다."},"feedback":[{"zh-CN":"先看动作对象책。","ko-KR":"행동의 대상인 책을 먼저 보세요."},{"zh-CN":"책을 읽어요是“读书”，밥을 먹어요才是“吃饭”。","ko-KR":"책을 읽어요는 독서이고 밥을 먹어요는 식사입니다."},{"zh-CN":"正确答案是“读”；还需确认已朗读整句。","ko-KR":"정답은 읽기이며 문장 전체 낭독도 확인해야 합니다."}]}},
      {"nodeCode":"polite-action-tools","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成六小题，检查礼貌体、动作对象、动作场所和안否定。","ko-KR":"해요체, 목적격 조사, 행동 장소 조사와 안 부정을 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"依次填写：공부하다→공부___／먹다→먹___／책___ 읽어요／한국어___ 공부해요／학교___ 한국어를 공부해요／운동을 ___ 해요。","ko-KR":"차례로 쓰세요. 공부하다→공부___／먹다→먹___／책___ 읽어요／한국어___ 공부해요／학교___ 한국어를 공부해요／운동을 ___ 해요."},"options":[],"config":{"normalize":"NFC","items":[{"id":"polite_hada","label":"공부하다 → 공부___","placeholder":"请填入正确形态"},{"id":"polite_meokda","label":"먹다 → 먹___","placeholder":"请填入正确形态"},{"id":"object_batchim","label":"책___ 읽어요","placeholder":"请填入答案"},{"id":"object_no_batchim","label":"한국어___ 공부해요","placeholder":"请填入答案"},{"id":"action_place","label":"학교___ 한국어를 공부해요","placeholder":"请填入答案"},{"id":"negation","label":"운동을 ___ 해요","placeholder":"请填入答案"}]},"answer":{"kind":"text_array","value":["해요","어요","을","를","에서","안"]},"explanation":{"correct":{"zh-CN":"六项规范答案依次为해요、어요、을、를、에서、안。","ko-KR":"여섯 답은 차례로 해요, 어요, 을, 를, 에서, 안입니다."},"feedback":[{"zh-CN":"先给六空标上“词尾／对象／场所／否定”功能。","ko-KR":"각 빈칸을 어미, 대상, 장소, 부정 기능으로 나누세요."},{"zh-CN":"看하다、词干末元音、收音、动作场所和否定位置。","ko-KR":"하다, 어간 끝 모음, 받침, 행동 장소와 부정 위치를 확인하세요."},{"zh-CN":"答案依次为해요、어요、을、를、에서、안，须全部正确重做。","ko-KR":"정답은 해요, 어요, 을, 를, 에서, 안이며 모두 맞게 다시 쓰세요."}]}},
      {"nodeCode":"my-day-lab","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"按“话题—频率—动作场所—动作对象—动作”排列五个语块。","ko-KR":"주제—빈도—행동 장소—행동 대상—행동 순서로 다섯 말덩이를 배열하세요."},"instruction":{"zh-CN":"拖动五张有意义、可替换的语块卡。","ko-KR":"의미가 있고 바꿀 수 있는 다섯 말덩이 카드를 옮기세요."},"options":["한국어를","저는","공부해요.","매일","학교에서"],"config":{"resettable":true,"targetStructure":"话题—频率—动作场所—动作对象—动作"},"answer":{"kind":"order","value":[1,3,4,0,2]},"explanation":{"correct":{"zh-CN":"指定顺序为저는→매일→학교에서→한국어를→공부해요.。","ko-KR":"지정 순서는 저는→매일→학교에서→한국어를→공부해요.입니다."},"feedback":[{"zh-CN":"先找话题开头和动作结尾。","ko-KR":"주제의 시작과 행동의 끝을 먼저 찾으세요."},{"zh-CN":"中间按“多久—哪里—什么”排列。","ko-KR":"가운데는 얼마나 자주—어디에서—무엇을 순서입니다."},{"zh-CN":"正确顺序：저는→매일→학교에서→한국어를→공부해요.。","ko-KR":"정답은 저는→매일→학교에서→한국어를→공부해요.입니다."}]}},
      {"nodeCode":"daily-dialogue","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景？","ko-KR":"두 장면의 활동 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“丽娜在图书馆做的事／秀珍今天不做的事”的正确组合。","ko-KR":"리나가 도서관에서 하는 일／수진이 오늘 하지 않는 일의 맞는 조합을 고르세요."},"options":["책을 읽어요／운동을 안 해요","한국어를 공부해요／커피를 마셔요","밥을 먹어요／집에서 쉬어요","영화를 봐요／친구를 안 만나요"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"丽娜在图书馆读书，秀珍今天不运动。","ko-KR":"리나는 도서관에서 책을 읽고 수진은 오늘 운동하지 않습니다."},"feedback":[{"zh-CN":"分别找到含도서관에서和안 해요的回答。","ko-KR":"도서관에서와 안 해요가 있는 대답을 각각 찾으세요."},{"zh-CN":"图书馆的对象是书；今天被否定的动作是运动。","ko-KR":"도서관의 대상은 책이고 오늘 부정한 행동은 운동입니다."},{"zh-CN":"正确组合是책을 읽어요／운동을 안 해요。","ko-KR":"정답은 책을 읽어요／운동을 안 해요입니다."}]}},
      {"nodeCode":"daily-dialogue","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"秀珍说아니요, 오늘은 운동을 안 해요.，志勋怎样自然继续确认她的安排？","ko-KR":"수진이 아니요, 오늘은 운동을 안 해요.라고 말했습니다. 지훈은 계획을 어떻게 자연스럽게 확인할 수 있어요?"},"instruction":{"zh-CN":"选择承接“不运动”并询问替代活动的一句。","ko-KR":"운동하지 않음을 받아서 다른 활동을 묻는 문장을 고르세요."},"options":["그럼 집에서 쉬어요?","네, 운동해요.","이거는 뭐예요?","얼마예요?"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"그럼承接前一句否定，并确认是否在家休息。","ko-KR":"그럼은 앞의 부정을 받아 집에서 쉬는지 확인합니다."},"feedback":[{"zh-CN":"先找能承接前一句否定信息的表达。","ko-KR":"앞 문장의 부정 정보를 이어 받는 표현을 찾으세요."},{"zh-CN":"答案应询问另一项日常活动。","ko-KR":"다른 일상 활동을 묻는 답이어야 합니다."},{"zh-CN":"正确答案是그럼 집에서 쉬어요?。","ko-KR":"정답은 그럼 집에서 쉬어요?입니다."}]}},
      {"nodeCode":"listen-and-report","key":"listening-daily-routine","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听日常介绍，判断尤娜在哪里读书。","ko-KR":"일상 소개를 듣고 유나가 어디에서 책을 읽는지 고르세요."},"instruction":{"zh-CN":"正常语速最多听两遍，慢速最多听一遍；只依据音频作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 음성에 근거해 답하세요."},"options":["도서관","학교","식당","공원"],"config":{"audioId":"chapter-03-listening-daily-routine","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":true},"answer":{"kind":"index","value":0},"transcript":"저는 매일 학교에서 한국어를 공부해요. 도서관에서 책을 읽어요. 식당에서 친구를 만나요. 집에서 영화를 봐요. 오늘은 커피를 안 마셔요.","audioObjectKey":"korean-level-one/chapter-03/listening/chapter-03-listening-daily-routine.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是도서관；原文明确说도서관에서 책을 읽어요.。","ko-KR":"정답은 도서관이며 원문에서 도서관에서 책을 읽어요.라고 말합니다."},"feedback":[{"zh-CN":"再听含책을 읽어요的句子，找前面的地点。","ko-KR":"책을 읽어요가 있는 문장 앞의 장소를 다시 들으세요."},{"zh-CN":"学校对应学习韩语；读书出现在第二条活动信息。","ko-KR":"학교에서는 한국어를 공부하고 독서는 두 번째 활동 정보입니다."},{"zh-CN":"答案是도서관；不能依据图片或常识猜。","ko-KR":"정답은 도서관이며 그림이나 상식으로 추측하면 안 됩니다."}],"privateListening":{"slowScript":"저는 매일 학교에서 한국어를 공부해요. / 도서관에서 책을 읽어요. / 식당에서 친구를 만나요. / 집에서 영화를 봐요. / 오늘은 커피를 안 마셔요.","pauseMarks":"저는 매일 학교에서 한국어를 공부해요. ⏸ 도서관에서 책을 읽어요. ⏸ 식당에서 친구를 만나요. ⏸ 집에서 영화를 봐요. ⏸ 오늘은 커피를 안 마셔요.","distractorReasons":{"1":"学校对应学习韩语，不是读书。","2":"食堂对应见朋友，不是读书。","3":"原文没有公园活动。"}}}},
      {"nodeCode":"listen-and-report","key":"speaking-my-day","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成35—50秒、5—6句的“我的一天”个人介绍。","ko-KR":"35~50초 동안 5~6문장으로 나의 하루를 소개하세요."},"instruction":{"zh-CN":"加入至少三个场所、三项不同动作、至少两句动作对象、一个频率副词和一个안否定句。","ko-KR":"세 곳 이상, 서로 다른 행동 세 가지, 목적어 문장 두 개 이상, 빈도 부사 한 개와 안 부정문 한 개를 넣으세요."},"options":[],"config":{"minimumSeconds":35,"maximumSeconds":50,"minimumTurns":5,"maximumTurns":6,"requiredCriteria":5,"enforceCompletionRequirements":true,"pronunciationScore":false,"criteria":["至少三个场所且共5—6句","三项不同动作","至少两句含动作对象","一个매일或자주","一个안否定句"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据和五类自查；记录不含正确性或分数，等待人工复核。","ko-KR":"녹음 정보와 다섯 항목 점검을 저장했으며 정오나 점수 없이 검토를 기다립니다."},"feedback":[{"zh-CN":"先检查35—50秒、5—6句、三个场所和三项动作。","ko-KR":"35~50초, 5~6문장, 세 장소와 세 행동을 확인하세요."},{"zh-CN":"再检查至少两个动作对象、频率副词和안否定句。","ko-KR":"목적어 문장 두 개, 빈도 부사와 안 부정을 확인하세요."},{"zh-CN":"对照五类清单补齐后重录；系统不显示虚假发音准确率。","ko-KR":"다섯 항목을 보완해 다시 녹음하세요. 시스템은 부정확한 발음 점수를 표시하지 않습니다."}]}},
      {"nodeCode":"daily-note","key":"reading-daily-note","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读“我的一天”卡片，完成学习地点、在家活动和今天不做的事三题。","ko-KR":"나의 하루 카드를 읽고 공부 장소, 집에서 하는 일, 오늘 하지 않는 일 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；依据必须来自卡片原句。","ko-KR":"문제마다 답을 하나 고르고 카드 문장에서 근거를 찾으세요."},"options":[],"config":{"reading":"나의 하루\n저는 매일 학교에서 한국어를 공부해요.\n도서관에서 책을 읽어요.\n식당에서 밥을 먹어요.\n집에서 영화를 봐요.\n오늘은 운동을 안 해요.","items":[{"id":"study_place","question":"어디에서 한국어를 공부해요?","options":["학교","도서관","식당","집"]},{"id":"home_action","question":"집에서 무엇을 해요?","options":["영화를 봐요","책을 읽어요","밥을 먹어요","친구를 만나요"]},{"id":"negative_action","question":"오늘 무엇을 안 해요?","options":["운동","공부","독서","식사"]}],"shuffle":true},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是학교、영화를 봐요、운동。","ko-KR":"정답은 차례로 학교, 영화를 봐요, 운동입니다."},"feedback":[{"zh-CN":"分别圈出含한국어를 공부해요、집에서和안 해요的句子。","ko-KR":"한국어를 공부해요, 집에서와 안 해요가 있는 문장을 찾으세요."},{"zh-CN":"不要把图书馆的读书移到家，也不要把肯定动作当成否定。","ko-KR":"도서관 독서를 집의 활동으로 옮기거나 긍정 행동을 부정으로 보지 마세요."},{"zh-CN":"依据是학교에서 한국어를 공부해요／집에서 영화를 봐요／운동을 안 해요。","ko-KR":"근거는 학교에서 한국어를 공부해요／집에서 영화를 봐요／운동을 안 해요입니다."}]}},
      {"nodeCode":"daily-note","key":"write-daily-note","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给同班同学写一篇5—6句原创“我的一天”行动日记。","ko-KR":"같은 반 친구에게 5~6문장의 새로운 나의 하루 활동 일기를 쓰세요."},"instruction":{"zh-CN":"写至少三个场所、三项不同动作、至少两句动作对象、一个频率副词和一个안否定句；完成量规自查。","ko-KR":"세 곳, 서로 다른 행동 세 가지, 목적어 문장 두 개, 빈도 부사와 안 부정문을 쓰고 자기 점검을 완료하세요."},"options":[],"config":{"minSentences":5,"maxSentences":6,"minimumHangulCharacters":40,"minimumPhraseGroups":4,"minimumInformationKinds":5,"requireCompletionChecklist":true,"requiredPhraseGroups":[["에서"],["을","를"],["매일","자주"],["안"]],"informationChecklist":["至少三个场所","三项不同动作","至少两句动作对象","一个频率副词","一个안否定句"],"structureFrame":"저는 매일／자주 ___에서 ___을/를 ___어요. → ___에서 ___을/를 ___어요. → ___에서 ___어요. → 오늘은 ___을/를 안 ___어요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存5—6句、含核心语块并完成五类信息和量规自查的日记；不产生正确性或分数。","ko-KR":"5~6문장, 핵심 표현, 다섯 정보와 자기 점검을 갖춘 일기를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数五类信息和5—6句是否齐全。","ko-KR":"다섯 정보와 5~6문장이 모두 있는지 세어 보세요."},{"zh-CN":"检查을/를、에서、频率副词和안的位置。","ko-KR":"을/를, 에서, 빈도 부사와 안의 위치를 확인하세요."},{"zh-CN":"按结构支架补齐具体缺项，但不复制示范。","ko-KR":"구조 틀로 빠진 부분을 보완하되 예시를 그대로 베끼지 마세요."}]}},
      {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接帮助完成“我的一天”介绍的表达。","ko-KR":"나의 하루 소개를 직접 완성하는 데 도움이 되는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 않아야 합니다."},"options":["학교에서 한국어를 공부해요.","도서관에서 책을 읽어요.","오늘은 운동을 안 해요.","이거는 뭐예요?"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"A、B说明地点与动作，C说明不做的事，均直接服务日常介绍。","ko-KR":"A와 B는 장소와 행동, C는 하지 않는 일을 말해 일상 소개에 직접 필요합니다."},"feedback":[{"zh-CN":"按“地点＋动作”和“否定活动”检查每项。","ko-KR":"장소＋행동과 부정 활동 기준으로 확인하세요."},{"zh-CN":"有一句属于物品辨认场景。","ko-KR":"한 문장은 물건 확인 상황의 표현입니다."},{"zh-CN":"正确集合是A、B、C；D属于第02课物品表达。","ko-KR":"정답은 A, B, C이며 D는 제02과 물건 표현입니다."}]}},
      {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 가지 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项时至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 모두 답하고 복습이 필요하면 돌아갈 위치를 하나 이상, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"polite","label":"我能用日常礼貌体说明动作／동사를 해요체로 바꾸어 말할 수 있어요"},{"id":"object","label":"我能用을/를说明动作对象／을/를로 행동 대상을 말할 수 있어요"},{"id":"place","label":"我能用에서说明动作场所／에서로 행동 장소를 말할 수 있어요"},{"id":"frequencyNegation","label":"我能表达频率和不做的事／빈도와 하지 않는 일을 말할 수 있어요"},{"id":"presentation","label":"我能完成35—50秒、5—6句介绍／35~50초, 5~6문장으로 소개할 수 있어요"}],"returnNodes":[{"value":"daily-actions","label":"词汇"},{"value":"polite-action-tools","label":"语法"},{"value":"daily-dialogue","label":"对话理解"},{"value":"listen-and-report","label":"听说"},{"value":"daily-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；主观自查不替代客观题、录音或写作证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 저장했으며 자기 점검은 객관 문항, 녹음이나 쓰기 증거를 대신하지 않고 점수도 만들지 않습니다."},"feedback":[{"zh-CN":"逐项回想礼貌体、对象、场所、频率否定和最终介绍。","ko-KR":"해요체, 대상, 장소, 빈도·부정과 최종 소개를 떠올리세요."},{"zh-CN":"把“需要复习”对应到具体节点。","ko-KR":"복습 필요를 구체적인 학습 위치와 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 모두 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
    ]
    $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = activity_seed ->> 'nodeCode';

    if node_uuid is null then
      raise exception 'Cannot convert chapter 03 activity %: node % was not found',
        activity_seed ->> 'key', activity_seed ->> 'nodeCode';
    end if;

    insert into public.digital_textbook_activities (
      node_id, activity_key, activity_type, sort_order,
      prompt, instruction, options, public_config, max_attempts,
      counts_toward_completion
    ) values (
      node_uuid, activity_seed ->> 'key', activity_seed ->> 'type',
      (activity_seed ->> 'order')::integer, activity_seed -> 'prompt',
      activity_seed -> 'instruction', activity_seed -> 'options',
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
      activity_uuid, activity_seed -> 'answer', activity_seed -> 'explanation',
      activity_seed ->> 'transcript', activity_seed ->> 'audioObjectKey',
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
      'dialogue-fact-check', 'dialogue-response', 'listening-daily-routine',
      'speaking-my-day', 'reading-daily-note', 'write-daily-note',
      'review-multiple', 'self-check'
    );

  for media_seed in
    select value from jsonb_array_elements($images$
    [
      {"nodeCode":"mission-map","key":"chapter-03-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-03/images/chapter-03-01-scene.png","alt":{"zh-CN":"校园休息区两名学生交谈，旁侧呈现学校学习、图书馆读书、食堂吃饭和家中看电影。","ko-KR":"교내 휴게 공간에서 두 학생이 이야기하고 학교 공부, 도서관 독서, 식당 식사와 집에서 영화 보는 장면이 보입니다."},"width":1600,"height":900},
      {"nodeCode":"daily-actions","key":"chapter-03-image-02","purpose":"核心词汇日常动作卡","objectKey":"korean-level-one/chapter-03/images/chapter-03-02-vocabulary.png","alt":{"zh-CN":"学习、工作、休息、运动、吃饭、喝咖啡、读书、看电影和见朋友九格动作情境卡。","ko-KR":"공부, 일, 휴식, 운동, 식사, 커피, 독서, 영화 보기와 친구 만나기 아홉 장면 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"polite-action-tools","key":"chapter-03-image-03","purpose":"日常动作句语法总图","objectKey":"korean-level-one/chapter-03/images/chapter-03-03-grammar-overview.png","alt":{"zh-CN":"频率、动作场所、动作对象、礼貌体动作和否定的句子总流程。","ko-KR":"빈도, 행동 장소, 행동 대상, 해요체 행동과 부정의 전체 문장 흐름입니다."},"width":1600,"height":900},
      {"nodeCode":"polite-action-tools","key":"chapter-03-image-04","purpose":"아/어요形态结构图","objectKey":"korean-level-one/chapter-03/images/chapter-03-03a-polite-form.png","alt":{"zh-CN":"按词干末元音与하다分流到日常礼貌体。","ko-KR":"어간 끝 모음과 하다에 따라 해요체로 나누는 구조입니다."},"width":1200,"height":900},
      {"nodeCode":"polite-action-tools","key":"chapter-03-image-05","purpose":"을/를动作对象结构图","objectKey":"korean-level-one/chapter-03/images/chapter-03-03b-object-marker.png","alt":{"zh-CN":"按名词有无收音选择을或를并连接自然动作。","ko-KR":"명사 받침에 따라 을 또는 를을 고르고 자연스러운 행동으로 연결합니다."},"width":1200,"height":900},
      {"nodeCode":"polite-action-tools","key":"chapter-03-image-06","purpose":"动作场所에서结构图","objectKey":"korean-level-one/chapter-03/images/chapter-03-03c-action-place.png","alt":{"zh-CN":"地点加에서后连接学习、阅读、吃饭或休息动作。","ko-KR":"장소에 에서를 붙이고 공부, 독서, 식사나 휴식 행동을 연결합니다."},"width":1200,"height":900},
      {"nodeCode":"polite-action-tools","key":"chapter-03-image-07","purpose":"안否定结构图","objectKey":"korean-level-one/chapter-03/images/chapter-03-03d-negation.png","alt":{"zh-CN":"把肯定动作句转换为谓语前放안的否定句。","ko-KR":"긍정 행동 문장을 서술어 앞에 안을 둔 부정문으로 바꿉니다."},"width":1200,"height":900},
      {"nodeCode":"my-day-lab","key":"chapter-03-image-08","purpose":"句型语块卡","objectKey":"korean-level-one/chapter-03/images/chapter-03-04-pattern-blocks.png","alt":{"zh-CN":"话题、频率、动作场所、动作对象和礼貌体动作五张可移动语块卡。","ko-KR":"주제, 빈도, 행동 장소, 행동 대상과 해요체 행동의 다섯 이동 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"daily-dialogue","key":"chapter-03-image-09","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-03/images/chapter-03-05-dialogue.png","alt":{"zh-CN":"校园休息区的丽娜与敏智，以及公园入口的秀珍与志勋两个对话场景。","ko-KR":"교내 휴게 공간의 리나와 민지, 공원 입구의 수진과 지훈 두 대화 장면입니다."},"width":1600,"height":900},
      {"nodeCode":"listen-and-report","key":"chapter-03-image-10","purpose":"听力动作地点选项图","objectKey":"korean-level-one/chapter-03/images/chapter-03-06-listening-options.png","alt":{"zh-CN":"学校、图书馆、食堂和公园四张无文字场所卡。","ko-KR":"글자 없는 학교, 도서관, 식당과 공원 네 장소 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"daily-note","key":"chapter-03-image-11","purpose":"我的一天卡片版式","objectKey":"korean-level-one/chapter-03/images/chapter-03-07-daily-note.png","alt":{"zh-CN":"包含五行正文区和地点占位的简洁“我的一天”卡片，不用图标泄露答案。","ko-KR":"다섯 줄 본문과 장소 자리로 구성되고 정답을 드러내는 아이콘이 없는 나의 하루 카드입니다."},"width":1200,"height":1600},
      {"nodeCode":"can-do-check","key":"chapter-03-image-12","purpose":"最终个人介绍流程图","objectKey":"korean-level-one/chapter-03/images/chapter-03-08-final-task.png","alt":{"zh-CN":"三场所、三动作、两对象、频率、否定、35—50秒和提交的个人录音流程。","ko-KR":"세 장소, 세 행동, 두 대상, 빈도, 부정, 35~50초와 제출의 개인 녹음 흐름입니다."},"width":1600,"height":900}
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
      node_uuid, media_seed ->> 'key', 'image', media_seed ->> 'purpose',
      media_seed ->> 'objectKey', 'pending', media_seed -> 'alt',
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
  where module.chapter_id = chapter_uuid and node.node_code = 'daily-actions';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select
    node_uuid,
    'chapter-03-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇原形点读',
    'korean-level-one/chapter-03/audio/vocabulary/chapter-03-vocabulary-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object(
      'audioId', 'chapter-03-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
      'script', item.value ->> 'word'
    )
  from jsonb_array_elements($vocabulary$
    [{"word":"한국어","collocation":"한국어를 공부해요."},{"word":"공부하다","collocation":"학교에서 공부해요."},{"word":"쉬다","collocation":"집에서 쉬어요."},{"word":"운동하다","collocation":"공원에서 운동해요."},{"word":"먹다","collocation":"밥을 먹어요."},{"word":"마시다","collocation":"커피를 마셔요."},{"word":"읽다","collocation":"책을 읽어요."},{"word":"보다","collocation":"영화를 봐요."},{"word":"만나다","collocation":"친구를 만나요."},{"word":"책","collocation":"책을 읽어요."},{"word":"밥","collocation":"밥을 먹어요."},{"word":"영화","collocation":"영화를 봐요."},{"word":"커피","collocation":"커피를 안 마셔요."},{"word":"학교","collocation":"학교에서 공부해요."},{"word":"도서관","collocation":"도서관에서 읽어요."},{"word":"식당","collocation":"식당에서 먹어요."},{"word":"집","collocation":"집에서 쉬어요."},{"word":"공원","collocation":"공원에서 운동해요."},{"word":"오늘","collocation":"오늘은 운동을 안 해요."},{"word":"매일","collocation":"매일 한국어를 공부해요."},{"word":"자주","collocation":"자주 친구를 만나요."}]
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
    'chapter-03-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
    'audio',
    '词汇搭配例句点读',
    'korean-level-one/chapter-03/audio/vocabulary/chapter-03-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object(
      'audioId', 'chapter-03-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
      'script', item.value ->> 'collocation'
    )
  from jsonb_array_elements($vocabulary$
    [{"word":"한국어","collocation":"한국어를 공부해요."},{"word":"공부하다","collocation":"학교에서 공부해요."},{"word":"쉬다","collocation":"집에서 쉬어요."},{"word":"운동하다","collocation":"공원에서 운동해요."},{"word":"먹다","collocation":"밥을 먹어요."},{"word":"마시다","collocation":"커피를 마셔요."},{"word":"읽다","collocation":"책을 읽어요."},{"word":"보다","collocation":"영화를 봐요."},{"word":"만나다","collocation":"친구를 만나요."},{"word":"책","collocation":"책을 읽어요."},{"word":"밥","collocation":"밥을 먹어요."},{"word":"영화","collocation":"영화를 봐요."},{"word":"커피","collocation":"커피를 안 마셔요."},{"word":"학교","collocation":"학교에서 공부해요."},{"word":"도서관","collocation":"도서관에서 읽어요."},{"word":"식당","collocation":"식당에서 먹어요."},{"word":"집","collocation":"집에서 쉬어요."},{"word":"공원","collocation":"공원에서 운동해요."},{"word":"오늘","collocation":"오늘은 운동을 안 해요."},{"word":"매일","collocation":"매일 한국어를 공부해요."},{"word":"자주","collocation":"자주 친구를 만나요."}]
  $vocabulary$::jsonb) with ordinality as item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'polite-action-tools';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select node_uuid, item.value ->> 'id', 'audio',
    '语法卡母版与语境复现例句',
    'korean-level-one/chapter-03/audio/grammar/' || (item.value ->> 'id') || '.mp3',
    'pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', item.value ->> 'id', 'script', item.value ->> 'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-03-grammar-01-example-01","script":"한국어를 공부해요."},{"id":"chapter-03-grammar-01-example-02","script":"학교에서 한국어를 공부해요."},{"id":"chapter-03-grammar-01-example-03","script":"집에서 영화를 봐요."},{"id":"chapter-03-grammar-02-example-01","script":"책을 읽어요."},{"id":"chapter-03-grammar-02-example-02","script":"도서관에서 책을 읽어요."},{"id":"chapter-03-grammar-02-example-03","script":"식당에서 친구를 만나요."},{"id":"chapter-03-grammar-03-example-01","script":"도서관에서 공부해요."},{"id":"chapter-03-grammar-03-example-02","script":"네, 집에서 쉬어요."},{"id":"chapter-03-grammar-03-example-03","script":"식당에서 밥을 먹어요."},{"id":"chapter-03-grammar-04-example-01","script":"오늘은 운동을 안 해요."},{"id":"chapter-03-grammar-04-example-02","script":"아니요, 오늘은 운동을 안 해요."},{"id":"chapter-03-grammar-04-example-03","script":"오늘은 커피를 안 마셔요."}]
  $grammar$::jsonb) as item(value)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'daily-dialogue';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  )
  select node_uuid, item.value ->> 'id', 'audio', item.value ->> 'purpose',
    'korean-level-one/chapter-03/audio/dialogue/' || (item.value ->> 'id') || '.mp3',
    'pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,
    item.value - 'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-03-dialogue-main-line-01","purpose":"主对话逐句","script":"리나 씨, 학교에서 뭐 해요?","speaker":"F01／민지"},{"id":"chapter-03-dialogue-main-line-02","purpose":"主对话逐句","script":"학교에서 한국어를 공부해요.","speaker":"F02／리나"},{"id":"chapter-03-dialogue-main-line-03","purpose":"主对话逐句","script":"도서관에서 뭐 해요?","speaker":"F01／민지"},{"id":"chapter-03-dialogue-main-line-04","purpose":"主对话逐句","script":"도서관에서 책을 읽어요.","speaker":"F02／리나"},{"id":"chapter-03-dialogue-main-line-05","purpose":"主对话逐句","script":"식당에서 뭐 해요?","speaker":"F01／민지"},{"id":"chapter-03-dialogue-main-line-06","purpose":"主对话逐句","script":"식당에서 친구를 만나요. 밥을 먹어요.","speaker":"F02／리나"},{"id":"chapter-03-dialogue-main-line-07","purpose":"主对话逐句","script":"집에서 운동해요?","speaker":"F01／민지"},{"id":"chapter-03-dialogue-main-line-08","purpose":"主对话逐句","script":"아니요, 운동을 안 해요. 집에서 영화를 봐요.","speaker":"F02／리나"},{"id":"chapter-03-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／F02"},{"id":"chapter-03-dialogue-alt-line-01","purpose":"第二对话逐句","script":"수진 씨, 오늘 공원에서 운동해요?","speaker":"M01／지훈"},{"id":"chapter-03-dialogue-alt-line-02","purpose":"第二对话逐句","script":"아니요, 오늘은 운동을 안 해요.","speaker":"F03／수진"},{"id":"chapter-03-dialogue-alt-line-03","purpose":"第二对话逐句","script":"그럼 집에서 쉬어요?","speaker":"M01／지훈"},{"id":"chapter-03-dialogue-alt-line-04","purpose":"第二对话逐句","script":"네, 집에서 쉬어요.","speaker":"F03／수진"},{"id":"chapter-03-dialogue-alt-line-05","purpose":"第二对话逐句","script":"집에서 커피를 마셔요?","speaker":"M01／지훈"},{"id":"chapter-03-dialogue-alt-line-06","purpose":"第二对话逐句","script":"아니요, 커피를 안 마셔요.","speaker":"F03／수진"},{"id":"chapter-03-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M01／F03"}]
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
    and node.node_code = 'listen-and-report'
    and activity.activity_key = 'listening-daily-routine';

  insert into public.digital_textbook_media_assets (
    node_id, activity_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  ) values
  (
    node_uuid, activity_uuid, 'chapter-03-listening-daily-routine-normal',
    'audio', '私有听力正常语速',
    'korean-level-one/chapter-03/listening/chapter-03-listening-daily-routine-normal.mp3',
    'pending',
    '{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"F04／유나","scriptVisibility":"private","speed":"normal"}'::jsonb
  ),
  (
    node_uuid, activity_uuid, 'chapter-03-listening-daily-routine-slow',
    'audio', '私有听力慢速',
    'korean-level-one/chapter-03/listening/chapter-03-listening-daily-routine-slow.mp3',
    'pending',
    '{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,
    '{"speaker":"F04／유나","scriptVisibility":"private","speed":"slow"}'::jsonb
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

commit;
