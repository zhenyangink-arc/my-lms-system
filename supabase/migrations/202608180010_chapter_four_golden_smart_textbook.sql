begin;

-- Converted from the read-only UPLY BOOK chapter-four master.
-- source_sha256: 9c250e59a45e3654a1d724d28740a4a628b3ac44dbf90510bf2a1566d9b4e9a6
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
    raise exception 'Cannot convert chapter 04: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 04: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid from public.chapter_tests where slug = 'korean-level-one-04' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 4 limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000004'::uuid, lesson_uuid,
      'korean-level-one-04', 'korean-level-one', 4,
      '第 04 章测试：在哪里？', '제04과 평가: 어디에 있어요?',
      '检查校园地点词汇、存在位置、移动目的地、方位关系以及校园向导理解与组织。',
      12, 60,
      '{"recognition":"地点与方位词识别","structure":"位置与目的地语法","reading":"对话与 안내 理解","assembly":"校园向导组织"}'::jsonb,
      1, 'draft', '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid, slug = 'korean-level-one-04', course_key = 'korean-level-one',
      chapter_number = 4, title = '第 04 章测试：在哪里？',
      korean_title = '제04과 평가: 어디에 있어요?',
      description = '检查校园地点词汇、存在位置、移动目的地、方位关系以及校园向导理解与组织。',
      duration_minutes = 12, passing_score = 60,
      skills = '{"recognition":"地点与方位词识别","structure":"位置与目的地语法","reading":"对话与 안내 理解","assembly":"校园向导组织"}'::jsonb,
      version = 1, status = 'draft',
      student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
      updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id = test_uuid and question_key not in (
    'golden-04-01','golden-04-02','golden-04-03','golden-04-04',
    'golden-04-05','golden-04-06','golden-04-07','golden-04-08',
    'golden-04-09','golden-04-10','golden-04-11','golden-04-12'
  );
  update public.chapter_test_questions set sort_order = sort_order + 100, updated_at = now()
  where test_id = test_uuid;

  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation,
    skill, sort_order, question_type, default_points, difficulty, tags,
    status, version, is_chapter_test_item, ebook_section_step, ebook_page_reference
  ) values
    (test_uuid,'golden-04-01','“뒤”表示哪个方位？','["后面","前面","里面","上面"]',0,'뒤 表示参照物的后面。','recognition',1,'single_choice',10,'foundation','["方位词","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-04-02','哪一句用于询问洗手间的位置？','["화장실이 어디에 있어요?","화장실에서 공부해요.","화장실에 가요.","지금 몇 시예요?"]',0,'어디에 있어요 用于询问存在位置。','recognition',2,'single_choice',10,'foundation','["位置询问","母本§2"]','draft',1,true,'STEP 02','母本 §2'),
    (test_uuid,'golden-04-03','“화장실은 일층___ 있어요.”应填什么？','["에","에서","을","와"]',0,'说明静态存在位置时地点后用 에。','structure',3,'single_choice',10,'foundation','["存在位置","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-04-04','哪一句正确表达“去图书馆”？','["도서관에 가요.","도서관에서 가요.","도서관을 가요.","도서관이 있어요."]',0,'移动目的地后用 에，再接 가요。','structure',4,'single_choice',10,'foundation','["移动目的地","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-04-05','哪一句正确表达“图书馆在主楼后面”？','["도서관은 본관 뒤에 있어요.","도서관은 뒤에 본관 있어요.","도서관은 본관에서 뒤에 있어요.","도서관에 본관 뒤가 있어요."]',0,'顺序是参照物 본관、方位 뒤、助词 에、있어요。','structure',5,'single_choice',10,'foundation','["空间方位","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-04-06','“가요”和“와요”的选择主要依据什么？','["相对说话人或交谈基准点的移动方向","地点有没有收音","地点在几楼","说话人的年龄"]',0,'去和来取决于相对说话人或交谈基准点的移动方向。','structure',6,'single_choice',10,'medium','["去来对比","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-04-07','主场景中，洗手间在哪里？','["一楼办公室旁边","二楼教室旁边","三楼休息室前面","主楼后面"]',0,'主场景第3、5轮给出一楼和办公室旁边。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-04-08','第二场景中，敏浩要去哪里？','["学生食堂","图书馆","办公室","休息室"]',0,'敏浩说 학생 식당에 가요。','reading',8,'single_choice',10,'foundation','["目的地理解","母本§6.2"]','draft',1,true,'STEP 05','母本 §6.2'),
    (test_uuid,'golden-04-09','根据主场景，怎样回答“도서관은 어디에 있어요?”','["본관 뒤에 있어요.","도서관에 가요.","일층에 와요.","공책 주세요."]',0,'图书馆在主楼后面。','reading',9,'single_choice',10,'foundation','["自然回应","母本§6.3"]','draft',1,true,'STEP 05','母本 §6.3'),
    (test_uuid,'golden-04-10','主楼 안내 卡中，学生休息室在几楼？','["三楼","一楼","二楼","主楼外"]',0,'原文是 학생 휴게실은 삼층에 있어요。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-04-11','位置问答的自然顺序是哪一项？','["问位置→答楼层→追问→答具体方位→致谢","致谢→答方位→问位置→追问→答楼层","答楼层→问位置→致谢→追问→答方位","问位置→致谢→答楼层→答方位→追问"]',0,'母本排序任务规定先问大位置，再追问具体方位，最后致谢。','assembly',11,'single_choice',10,'medium','["话轮组织","母本§3.4"]','draft',1,true,'STEP 08','母本 §3.4'),
    (test_uuid,'golden-04-12','课末校园向导录音必须满足哪一项？','["35—50秒、至少8轮、三地点、两种方位和目的地问答","只背诵地点清单","必须获得自动发音分数","只需一个角色说5句"]',0,'母本要求双角色、35—50秒、至少8轮及六类信息，当前不做发音自动评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2')
  on conflict (test_id, question_key) do update set
    prompt=excluded.prompt, options=excluded.options, correct_option=excluded.correct_option,
    explanation=excluded.explanation, skill=excluded.skill, sort_order=excluded.sort_order,
    question_type=excluded.question_type, default_points=excluded.default_points,
    difficulty=excluded.difficulty, tags=excluded.tags, status='draft', version=excluded.version,
    is_chapter_test_item=excluded.is_chapter_test_item,
    ebook_section_step=excluded.ebook_section_step,
    ebook_page_reference=excluded.ebook_page_reference, updated_at=now();

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id = version_uuid and (chapter_number = 4 or slug = 'location')
  order by (slug = 'location') desc limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal,
      status, production_status, editorial_status, native_review_status,
      audio_status, image_status, source_revision
    ) values (
      version_uuid, test_uuid, 'location', 4,
      '{"zh-CN":"在哪里？","ko-KR":"어디에 있어요?"}'::jsonb,
      '{"zh-CN":"新生秀珍在校园主楼向学生志愿者智敏询问洗手间、办公室和图书馆的位置，并决定下一目的地。","ko-KR":"신입생 수진은 본관에서 학생 도우미 지민에게 화장실, 사무실과 도서관 위치를 묻고 다음 목적지를 정합니다."}'::jsonb,
      '{"zh-CN":"询问并说明人物或场所的位置，用至少两种方位词说明空间关系，并以约40秒、至少8轮的双角色校园向导完成目的地问答。","ko-KR":"사람이나 장소의 위치를 묻고 답하며 두 가지 이상의 위치 명사와 목적지 표현을 사용해 약 40초, 8턴 이상의 학교 안내 대화를 완성합니다."}'::jsonb,
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第04课 어디에 있어요.md @ 2026-08-18 / sha256:9c250e59a45e3654a1d724d28740a4a628b3ac44dbf90510bf2a1566d9b4e9a6'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid, slug='location', chapter_number=4,
      title='{"zh-CN":"在哪里？","ko-KR":"어디에 있어요?"}'::jsonb,
      scenario='{"zh-CN":"新生秀珍在校园主楼向学生志愿者智敏询问洗手间、办公室和图书馆的位置，并决定下一目的地。","ko-KR":"신입생 수진은 본관에서 학생 도우미 지민에게 화장실, 사무실과 도서관 위치를 묻고 다음 목적지를 정합니다."}'::jsonb,
      goal='{"zh-CN":"询问并说明人物或场所的位置，用至少两种方位词说明空间关系，并以约40秒、至少8轮的双角色校园向导完成目的地问答。","ko-KR":"사람이나 장소의 위치를 묻고 답하며 두 가지 이상의 위치 명사와 목적지 표현을 사용해 약 40초, 8턴 이상의 학교 안내 대화를 완성합니다."}'::jsonb,
      status='draft', production_status='editorial_review', editorial_status='pending',
      native_review_status='pending', audio_status='pending', image_status='pending',
      source_revision='UPLY BOOK 第04课 어디에 있어요.md @ 2026-08-18 / sha256:9c250e59a45e3654a1d724d28740a4a628b3ac44dbf90510bf2a1566d9b4e9a6',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for module_seed in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"nodeCode":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"description":{"zh-CN":"看清人物所在处、要找的地点与课末任务。","ko-KR":"인물의 현재 위치, 찾을 장소와 단원 과제를 확인합니다."},"nodeTitle":{"zh-CN":"新生要找地方，第一句问什么？","ko-KR":"장소를 찾을 때 먼저 무엇을 물을까요?"},"content":{"lead":{"zh-CN":"先区分“在哪里”和“去哪里”，再进入校园向导任务。","ko-KR":"어디에 있는지와 어디에 가는지를 구별하고 학교 안내 과제를 시작합니다."},"targets":[{"ko":"화장실이 어디에 있어요?","zh":"询问位置"},{"ko":"사무실 옆에 있어요.","zh":"说明方位"},{"ko":"도서관에 가요.","zh":"说明目的地"}],"finalOutput":{"zh-CN":"35—50秒、至少8轮的双角色校园向导，含三地点、两种方位与目的地问答。","ko-KR":"35~50초, 8턴 이상의 두 역할 학교 안내로 세 장소, 두 위치 관계와 목적지 문답을 포함합니다."},"coach":{"zh-CN":"本节点只以答对不计分场景诊断为强制证据。","ko-KR":"점수에 포함되지 않는 장면 진단 정답만 필수 증거입니다."},"nextNode":"campus-and-position"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"nodeCode":"campus-and-position","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"description":{"zh-CN":"把22个校园地点、方位与移动词和搭配一起记。","ko-KR":"학교 장소, 위치와 이동 어휘 22개를 결합과 함께 익힙니다."},"nodeTitle":{"zh-CN":"先认地点，再认参照关系","ko-KR":"장소와 기준 위치를 함께 익히기"},"content":{"lead":{"zh-CN":"按看图认地点、点读原形、跟读搭配、在对话中再认的顺序学习；音频全部待制作。","ko-KR":"그림, 기본형, 결합, 대화 재인 순서로 학습하며 음원은 모두 제작 대기 중입니다."},"vocabulary":[
      {"ko":"본관","zh":"主楼","pos":"场所名词","collocation":"본관에 있어요."},{"ko":"교실","zh":"教室","pos":"场所名词","collocation":"교실은 이층에 있어요."},{"ko":"화장실","zh":"洗手间","pos":"场所名词","collocation":"화장실이 어디에 있어요?"},{"ko":"사무실","zh":"办公室","pos":"场所名词","collocation":"사무실 옆에 있어요."},{"ko":"도서관","zh":"图书馆","pos":"场所名词","collocation":"도서관에 가요."},{"ko":"학생 식당","zh":"学生食堂","pos":"名词短语（场所）","collocation":"학생 식당에 가요."},{"ko":"휴게실","zh":"休息室","pos":"场所名词","collocation":"휴게실은 삼층에 있어요."},{"ko":"건물","zh":"建筑","pos":"名词","collocation":"건물 안에 있어요."},{"ko":"계단","zh":"楼梯","pos":"名词","collocation":"계단 옆에 있어요."},{"ko":"층","zh":"层","pos":"名词（楼层单位）","collocation":"몇 층에 있어요?"},{"ko":"앞","zh":"前面","pos":"方位名词","collocation":"학생 식당 앞에"},{"ko":"뒤","zh":"后面","pos":"方位名词","collocation":"본관 뒤에"},{"ko":"옆","zh":"旁边","pos":"方位名词","collocation":"사무실 옆에"},{"ko":"안","zh":"里面","pos":"方位名词","collocation":"건물 안에"},{"ko":"밖","zh":"外面","pos":"方位名词","collocation":"건물 밖에"},{"ko":"위","zh":"上面","pos":"方位名词","collocation":"책상 위에"},{"ko":"아래","zh":"下面","pos":"方位名词","collocation":"책상 아래에"},{"ko":"어디","zh":"哪里","pos":"代词","collocation":"어디에 있어요?"},{"ko":"있다","zh":"有、在、存在","pos":"形容词（存在）","collocation":"일층에 있어요."},{"ko":"없다","zh":"没有、不在、不存在","pos":"形容词（存在）","collocation":"이 건물에 없어요."},{"ko":"가다","zh":"去","pos":"动词（移动）","collocation":"도서관에 가요."},{"ko":"오다","zh":"来","pos":"动词（移动）","collocation":"학생 식당에 와요."}
    ],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；22词点读和图片快指为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 어휘 듣기와 그림 연습은 자율 활동입니다."},"nextNode":"location-and-destination"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":15,"nodeCode":"location-and-destination","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"description":{"zh-CN":"说清存在位置、移动目的地和参照方位。","ko-KR":"존재 위치, 이동 목적지와 기준 위치를 말합니다."},"nodeTitle":{"zh-CN":"说清“在哪里”和“去哪里”","ko-KR":"어디에 있는지와 어디에 가는지 말하기"},"content":{"lead":{"zh-CN":"先判断静态存在还是移动，再决定是否加入参照物与方位。","ko-KR":"존재인지 이동인지 판단하고 기준 장소와 위치 명사가 필요한지 정합니다."},"grammarCards":[
      {"form":"N이/가 어디에 있어요?；N은/는 장소에 있어요/없어요","function":{"zh-CN":"询问并说明人物或场所的存在位置。","ko-KR":"사람이나 장소의 존재 위치를 묻고 답합니다."},"rules":["对象有收音用이、无收音用가","地点与에连写，和있어요/없어요分写","静态存在位置不用에서","없어요表示不在或不存在"],"examples":[{"ko":"화장실이 어디에 있어요?","zh":"洗手间在哪里？","audioId":"chapter-04-grammar-01-example-01","audioStatus":"pending"},{"ko":"화장실은 일층에 있어요.","zh":"洗手间在一楼。","audioId":"chapter-04-grammar-01-example-02","audioStatus":"pending"},{"ko":"학생 휴게실은 삼층에 있어요.","zh":"学生休息室在三楼。","audioId":"chapter-04-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：화장실은 일층에서 있어요.；静态存在位置用에。","ko-KR":"잘못: 화장실은 일층에서 있어요. 존재 위치에는 에를 씁니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
      {"form":"장소에 가요/와요","function":{"zh-CN":"询问并说明移动目的地。","ko-KR":"이동 목적지를 묻고 답합니다."},"rules":["目的地加에","가요表示离开基准点去别处","와요表示朝说话人或交谈基准点来","回答目的地需保留에 가요/와요"],"examples":[{"ko":"지금 어디에 가요?","zh":"现在去哪里？","audioId":"chapter-04-grammar-02-example-01","audioStatus":"pending"},{"ko":"학생 식당에 가요.","zh":"去学生食堂。","audioId":"chapter-04-grammar-02-example-02","audioStatus":"pending"},{"ko":"민수 씨가 지금 학생 식당에 와요.","zh":"民洙现在来学生食堂。","audioId":"chapter-04-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：도서관에서 가요.；图书馆作为目的地时用에。","ko-KR":"잘못: 도서관에서 가요. 목적지에는 에를 씁니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
      {"form":"N 앞/뒤/옆/안/밖/위/아래에 있어요","function":{"zh-CN":"以已知地点或物体为参照说明方位。","ko-KR":"알고 있는 장소나 물건을 기준으로 위치를 말합니다."},"rules":["顺序为目标—参照物—方位名词—에 있어요","参照物与方位名词分写","方位名词与에连写","可省略已知目标但保留参照物和方位"],"examples":[{"ko":"사무실은 계단 옆에 있어요.","zh":"办公室在楼梯旁边。","audioId":"chapter-04-grammar-03-example-01","audioStatus":"pending"},{"ko":"도서관은 본관 뒤에 있어요.","zh":"图书馆在主楼后面。","audioId":"chapter-04-grammar-03-example-02","audioStatus":"pending"},{"ko":"화장실은 일층 사무실 옆에 있어요.","zh":"洗手间在一楼办公室旁边。","audioId":"chapter-04-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：도서관은 뒤에 본관 있어요.；先说参照物，再说方位。","ko-KR":"잘못: 도서관은 뒤에 본관 있어요. 기준 장소 다음에 위치 명사를 씁니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}
    ],"coach":{"zh-CN":"五项填空全部正确才完成；功能解释和扩展造句为自主展示。","ko-KR":"다섯 빈칸을 모두 맞혀야 하며 기능 설명과 확장 문장은 자율 활동입니다."},"nextNode":"location-exchange-lab"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,"nodeCode":"location-exchange-lab","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"description":{"zh-CN":"把楼层、参照方位和致谢连成真实问答。","ko-KR":"층, 기준 위치와 감사를 실제 문답으로 연결합니다."},"nodeTitle":{"zh-CN":"把位置问答连成真实向导","ko-KR":"위치 문답을 실제 안내로 연결하기"},"content":{"lead":{"zh-CN":"先问大位置，再追问具体方位，最后自然收束。","ko-KR":"큰 위치를 먼저 묻고 구체적 위치를 다시 물은 뒤 자연스럽게 마칩니다."},"substitutionGroups":[["화장실이 어디에 있어요? — 일층에 있어요.","교실이 어디에 있어요? — 이층에 있어요.","휴게실이 어디에 있어요? — 삼층에 있어요."],["사무실 옆에 있어요.","본관 뒤에 있어요.","도서관 앞에 있어요."],["어디에 가요? — 도서관에 가요.","어디에 가요? — 학생 식당에 가요.","도서관에 와요? — 네, 지금 가요."]],"personalOutput":["位置问句","含参照物和方位词的位置句","含目的地的가요/와요句"],"coach":{"zh-CN":"五个完整话轮排序正确即完成；替换、快答和个人表达为自主练习。","ko-KR":"다섯 말차례 순서를 모두 맞히면 완료되며 대치와 개인 표현은 자율 연습입니다."},"nextNode":"campus-guide-dialogue"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":12,"nodeCode":"campus-guide-dialogue","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"description":{"zh-CN":"在主楼大厅与教室门口完成位置和目的地问答。","ko-KR":"본관 로비와 교실 앞에서 위치와 목적지를 묻고 답합니다."},"nodeTitle":{"zh-CN":"让新生听懂并走向目的地","ko-KR":"신입생이 위치를 이해하고 목적지로 가도록 안내하기"},"content":{"lead":{"zh-CN":"主场景9轮确认洗手间、办公室与图书馆；第二场景6轮确认学生食堂并决定同行。全部音频待制作。","ko-KR":"주 장면 9턴은 화장실, 사무실과 도서관을 확인하고 두 번째 장면 6턴은 학생 식당을 확인합니다. 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":"场景1｜校园主楼一楼大厅","context":{"zh-CN":"秀珍向智敏确认地点并决定去图书馆。","ko-KR":"수진은 지민에게 장소를 확인하고 도서관에 가기로 합니다."},"lines":[{"speaker":"지민","ko":"수진 씨, 여기가 본관이에요.","zh":"秀珍，这里是主楼。"},{"speaker":"수진","ko":"화장실이 어디에 있어요?","zh":"洗手间在哪里？"},{"speaker":"지민","ko":"화장실은 일층에 있어요.","zh":"洗手间在一楼。"},{"speaker":"수진","ko":"일층 어디에 있어요?","zh":"在一楼哪里？"},{"speaker":"지민","ko":"사무실 옆에 있어요.","zh":"在办公室旁边。"},{"speaker":"수진","ko":"도서관은 어디에 있어요?","zh":"图书馆在哪里？"},{"speaker":"지민","ko":"도서관은 본관 뒤에 있어요.","zh":"图书馆在主楼后面。"},{"speaker":"지민","ko":"지금 어디에 가요?","zh":"现在去哪里？"},{"speaker":"수진","ko":"도서관에 가요. 고마워요.","zh":"去图书馆。谢谢。"}]},{"title":"场景2｜教室门口","context":{"zh-CN":"有娜确认敏浩的目的地和学生食堂位置。","ko-KR":"유나는 민호의 목적지와 학생 식당 위치를 확인합니다."},"lines":[{"speaker":"유나","ko":"민호 씨, 지금 어디에 가요?","zh":"敏浩，现在去哪里？"},{"speaker":"민호","ko":"학생 식당에 가요.","zh":"去学生食堂。"},{"speaker":"유나","ko":"학생 식당이 어디에 있어요?","zh":"学生食堂在哪里？"},{"speaker":"민호","ko":"도서관 옆에 있어요.","zh":"在图书馆旁边。"},{"speaker":"유나","ko":"저도 학생 식당에 가요.","zh":"我也去学生食堂。"},{"speaker":"민호","ko":"좋아요. 같이 가요.","zh":"好，一起去吧。"}]}],"coach":{"zh-CN":"事实组合题和位置回应题都答对才完成；信息替换与试录为自主练习。","ko-KR":"사실 조합과 위치 응답을 모두 맞혀야 하며 정보 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-guide"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":12,"nodeCode":"listen-and-guide","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"description":{"zh-CN":"听出图书馆方位，再提交双角色校园向导。","ko-KR":"도서관 위치를 듣고 두 역할 학교 안내를 제출합니다."},"nodeTitle":{"zh-CN":"听出方位，再完成40秒向导","ko-KR":"위치를 듣고 40초 안내 완성하기"},"content":{"lead":{"zh-CN":"听力答案只来自私有音频原话；正常速和慢速独立绑定，当前均待制作。","ko-KR":"듣기 답은 비공개 음성 원문에서만 찾으며 보통 속도와 느린 속도 음원은 제작 대기 중입니다."},"listenFor":["학생 식당 앞에 있어요","학생 식당에 와요","도서관에 가요","학생 식당 옆에 있어요"],"speakingFrame":"35—50秒、至少8轮：三地点＋位置问答＋两种方位＋目的地问答＋가요/와요＋自然收束","speakingCriteria":["至少三个校园地点","至少一次位置问答","两种不同方位关系","至少一次目的地问答","目的地回答使用에 가요/와요","双角色自然开启或结束"],"coach":{"zh-CN":"开放录音只保存完成证据，不产生正确性或分数；不显示虚假发音准确率。","ko-KR":"공개형 녹음은 완료 증거만 저장하고 정오나 점수를 만들지 않으며 발음 점수를 표시하지 않습니다."},"nextNode":"building-guide-note"}},
    {"code":"read_write","order":7,"accent":"iris","type":"practice","minutes":12,"nodeCode":"building-guide-note","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"description":{"zh-CN":"读主楼 안내，再写5—6句原创位置说明。","ko-KR":"본관 안내를 읽고 5~6문장의 새로운 위치 안내를 씁니다."},"nodeTitle":{"zh-CN":"读主楼 안내，写自己的位置说明","ko-KR":"본관 안내를 읽고 나의 위치 안내 쓰기"},"content":{"lead":{"zh-CN":"按地点、楼层、参照物找稳定信息，再用安全或虚构信息写作。","ko-KR":"장소, 층과 기준 위치를 찾고 안전한 실제 또는 가상 정보로 씁니다."},"reading":"신입생을 위한 본관 안내\n교실은 본관 이층에 있어요.\n화장실은 일층 사무실 옆에 있어요.\n학생 휴게실은 삼층에 있어요.\n도서관은 본관 뒤에 있어요.\n\n수진 씨의 메시지\n저는 지금 도서관에 가요.","questions":["화장실은 어디에 있어요?","학생 휴게실은 몇 층에 있어요?","수진 씨는 지금 어디에 가요?"],"writingFrame":"여기가 ___이에요/예요. → ___은/는 ___에 있어요. → ___은/는 ___ 앞/뒤/옆/안/밖/위/아래에 있어요. → ___은/는 지금 ___에 가요/와요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"originalExample":"여기가 우리 학교예요. 교실은 본관 이층에 있어요. 사무실은 교실 옆에 있어요. 도서관은 본관 앞에 있어요. 저는 지금 도서관에 가요.","coach":{"zh-CN":"阅读三题全对；写作满足句数、六类信息与量规自查后完成，仍不产生分数。","ko-KR":"읽기 세 문항을 모두 맞히고 쓰기 조건과 자기 점검을 갖추면 완료되지만 점수는 만들지 않습니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"coral","type":"review","minutes":8,"nodeCode":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},"description":{"zh-CN":"完成综合多选、五项Can-do并记录返回节点。","ko-KR":"종합 복수 선택과 다섯 Can-do를 점검하고 복습 위치를 기록합니다."},"nodeTitle":{"zh-CN":"我能让别人找到目标吗？","ko-KR":"다른 사람이 목적지를 찾도록 안내할 수 있나요?"},"content":{"lead":{"zh-CN":"把错误分到词汇、语法、理解、听说或读写，返回最短路径。","ko-KR":"오류를 어휘, 문법, 이해, 듣기·말하기 또는 읽기·쓰기로 나눕니다."},"checklist":[{"ko":"사람이나 장소가 어디에 있는지 묻고 답할 수 있어요.","zh":"我能询问并回答位置"},{"ko":"에 있어요/없어요로 존재 위치를 말할 수 있어요.","zh":"我能说明存在位置"},{"ko":"두 가지 이상의 위치 명사로 공간 관계를 말할 수 있어요.","zh":"我能用至少两种方位说明空间关系"},{"ko":"어디에 가요/와요?로 목적지를 묻고 답할 수 있어요.","zh":"我能询问并回答目的地"},{"ko":"약 40초 동안 8턴 이상의 두 역할 학교 안내를 할 수 있어요.","zh":"我能完成约40秒、8轮以上双角色向导"}],"returnMap":[{"reason":"词汇","node":"campus-and-position"},{"reason":"语法","node":"location-and-destination"},{"reason":"理解","node":"campus-guide-dialogue"},{"reason":"听说","node":"listen-and-guide"},{"reason":"读写","node":"building-guide-note"}],"coach":{"zh-CN":"综合多选正确并提交五项自查后完成；八节点全部完成才解锁章节测试。","ko-KR":"복수 선택 정답과 다섯 점검을 제출하고 여덟 노드를 모두 완료해야 단원 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-04"}}
  ] $modules$::jsonb)
  loop
    insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
    values (chapter_uuid,module_seed->>'code',(module_seed->>'order')::integer,module_seed->>'accent',module_seed->'title',module_seed->'description')
    on conflict (chapter_id,module_code) do update set sort_order=excluded.sort_order,
      accent_role=excluded.accent_role,title=excluded.title,description=excluded.description,updated_at=now()
    returning id into module_uuid;
    insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
    values (module_uuid,module_seed->>'nodeCode',module_seed->>'type',1,(module_seed->>'minutes')::integer,module_seed->'nodeTitle',module_seed->'content')
    on conflict (module_id,node_code) do update set node_type=excluded.node_type,
      estimated_minutes=excluded.estimated_minutes,title=excluded.title,content=excluded.content,updated_at=now();
  end loop;

  for activity_seed in select value from jsonb_array_elements($activities$
  [
    {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"秀珍到了主楼，但不知道洗手间在哪里。最适合先说什么？","ko-KR":"수진은 본관에 왔지만 화장실 위치를 모릅니다. 가장 먼저 할 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合询问地点位置的表达；本题不计分。","ko-KR":"장소의 위치 묻기에 맞는 표현을 고르세요. 점수에는 포함되지 않습니다."},"options":["화장실이 어디에 있어요?","화장실에서 공부해요.","공책하고 연필 주세요.","지금 몇 시예요?"],"config":{"shuffle":false,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"화장실이 어디에 있어요? 用于礼貌询问洗手间的位置。","ko-KR":"화장실이 어디에 있어요?는 화장실 위치를 공손하게 묻습니다."},"feedback":[{"zh-CN":"先找题干中的“洗手间在哪里”。","ko-KR":"화장실이 어디에 있는지 찾는 표현을 보세요."},{"zh-CN":"目标句应包含어디에，不是动作、请求或时间表达。","ko-KR":"어디에가 있는 위치 질문을 고르세요."},{"zh-CN":"正确答案是화장실이 어디에 있어요?。","ko-KR":"정답은 화장실이 어디에 있어요?입니다."}]}},
    {"nodeCode":"campus-and-position","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在도서관은 본관 뒤에 있어요.中，뒤是什么意思？","ko-KR":"도서관은 본관 뒤에 있어요.에서 뒤는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 읽고 확인하세요."},"options":["后面","前面","里面","上面"],"config":{"shuffle":false,"audioPending":true,"readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"뒤表示后面，整句是图书馆在主楼后面。","ko-KR":"뒤는 뒤쪽이며 문장은 도서관이 본관 뒤에 있다는 뜻입니다."},"feedback":[{"zh-CN":"先判断图书馆相对主楼的位置。","ko-KR":"도서관과 본관의 위치를 먼저 보세요."},{"zh-CN":"뒤与앞是相反方位。","ko-KR":"뒤와 앞은 반대 위치입니다."},{"zh-CN":"正确答案是后面；还需确认已朗读整句。","ko-KR":"정답은 뒤이며 문장 낭독도 확인해야 합니다."}]}},
    {"nodeCode":"location-and-destination","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成五小题，检查存在位置、移动目的地和方位结构。","ko-KR":"존재 위치, 이동 목적지와 위치 명사 구조 다섯 문항을 완성하세요."},"instruction":{"zh-CN":"依次填写：일층___ 있어요／본관 뒤___ 있어요／학생 식당___ 가요／도서관___ 와요／사무실은 계단 ___ 있어요。","ko-KR":"차례로 쓰세요. 일층___ 있어요／본관 뒤___ 있어요／학생 식당___ 가요／도서관___ 와요／사무실은 계단 ___ 있어요."},"options":[],"config":{"normalize":"NFC","items":[{"id":"existence_place","placeholder":"助词"},{"id":"position_particle","placeholder":"助词"},{"id":"destination_go","placeholder":"助词"},{"id":"destination_come","placeholder":"助词"},{"id":"relative_position","placeholder":"方位＋助词"}]},"answer":{"kind":"text_array","value":["에","에","에","에","옆에"]},"explanation":{"correct":{"zh-CN":"规范答案依次为에、에、에、에、옆에。","ko-KR":"정답은 차례로 에, 에, 에, 에, 옆에입니다."},"feedback":[{"zh-CN":"先标出存在位置、移动目的地或参照方位。","ko-KR":"존재 위치, 이동 목적지와 기준 위치를 나누세요."},{"zh-CN":"前四空连接地点与谓语；最后一空表达楼梯旁边。","ko-KR":"앞 네 칸은 장소와 서술어를 잇고 마지막은 계단 옆입니다."},{"zh-CN":"答案为에、에、에、에、옆에，须全部正确重做。","ko-KR":"에, 에, 에, 에, 옆에를 모두 맞게 다시 쓰세요."}]}},
    {"nodeCode":"location-exchange-lab","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"把五个完整话轮排成自然的位置询问。","ko-KR":"다섯 말차례를 자연스러운 위치 문답 순서로 배열하세요."},"instruction":{"zh-CN":"按问位置—答楼层—追问—答具体方位—致谢拖动。","ko-KR":"위치 질문—층 대답—추가 질문—구체적 위치—감사 순서로 옮기세요."},"options":["사무실 옆에 있어요.","화장실이 어디에 있어요?","고마워요.","일층에 있어요.","일층 어디에 있어요?"],"config":{"resettable":true,"targetStructure":"问位置—答楼层—追问—答具体方位—致谢"},"answer":{"kind":"order","value":[1,3,4,0,2]},"explanation":{"correct":{"zh-CN":"顺序是询问位置、回答一楼、追问、回答办公室旁边、致谢。","ko-KR":"위치를 묻고 일층, 추가 질문, 사무실 옆, 감사 순서입니다."},"feedback":[{"zh-CN":"先找询问开头和致谢结尾。","ko-KR":"질문 시작과 감사 끝을 먼저 찾으세요."},{"zh-CN":"中间先回答一楼，再追问一楼哪里。","ko-KR":"일층이라고 답한 뒤 일층 어디인지 묻습니다."},{"zh-CN":"正确顺序：화장실 질문→일층→追问→사무실 옆→致谢。","ko-KR":"정답은 화장실 질문→일층→추가 질문→사무실 옆→감사입니다."}]}},
    {"nodeCode":"campus-guide-dialogue","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景的关键信息？","ko-KR":"두 장면의 핵심 장소 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择洗手间楼层／图书馆相对主楼位置／敏浩目的地的正确组合。","ko-KR":"화장실 층／도서관 위치／민호 목적지의 맞는 조합을 고르세요."},"options":["일층／본관 뒤／학생 식당","이층／본관 앞／도서관","일층／사무실 옆／교실","삼층／본관 안／휴게실"],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"洗手间在一楼，图书馆在主楼后面，敏浩去学生食堂。","ko-KR":"화장실은 일층, 도서관은 본관 뒤, 민호의 목적지는 학생 식당입니다."},"feedback":[{"zh-CN":"分别找楼层、含도서관的回答和第二场景目的地。","ko-KR":"층, 도서관 위치와 두 번째 장면 목적지를 찾으세요."},{"zh-CN":"洗手间在一楼；图书馆以主楼为参照；敏浩去吃饭的地方。","ko-KR":"화장실은 일층이고 도서관은 본관 기준이며 민호는 식당에 갑니다."},{"zh-CN":"正确组合是일층／본관 뒤／학생 식당。","ko-KR":"정답은 일층／본관 뒤／학생 식당입니다."}]}},
    {"nodeCode":"campus-guide-dialogue","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据主场景，怎样自然回答도서관은 어디에 있어요?","ko-KR":"주 장면에 따라 도서관은 어디에 있어요?에 어떻게 답해요?"},"instruction":{"zh-CN":"选择含正确参照物与方位的礼貌回答。","ko-KR":"맞는 기준 장소와 위치가 있는 공손한 대답을 고르세요."},"options":["본관 뒤에 있어요.","도서관에 가요.","일층에 와요.","공책 주세요."],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"本관 뒤에 있어요回答静态位置且与主场景一致。","ko-KR":"본관 뒤에 있어요는 주 장면의 존재 위치와 같습니다."},"feedback":[{"zh-CN":"先判断问题问静态位置还是移动目的地。","ko-KR":"존재 위치인지 이동 목적지인지 판단하세요."},{"zh-CN":"回看含“主楼后面”的台词。","ko-KR":"본관 뒤를 말한 대사를 찾으세요."},{"zh-CN":"正确答案是본관 뒤에 있어요.。","ko-KR":"정답은 본관 뒤에 있어요.입니다."}]}},
    {"nodeCode":"listen-and-guide","key":"listening-campus-location","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听校园位置说明，判断图书馆在哪里。","ko-KR":"학교 위치 설명을 듣고 도서관이 어디에 있는지 고르세요."},"instruction":{"zh-CN":"正常语速最多两遍，慢速最多一遍；只依据含도서관的句子作答。","ko-KR":"보통 속도 두 번, 느린 속도 한 번 듣고 도서관 문장에 근거해 답하세요."},"options":["학생 식당 옆","학생 식당 앞","학생 식당 뒤","학생 식당 안"],"config":{"audioId":"chapter-04-listening-campus-location","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":false},"answer":{"kind":"index","value":0},"transcript":"저는 지금 학생 식당 앞에 있어요. 민수 씨가 지금 학생 식당에 와요. 우리는 도서관에 가요. 도서관은 학생 식당 옆에 있어요.","audioObjectKey":"korean-level-one/chapter-04/listening/chapter-04-listening-campus-location.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是학생 식당 옆；末句明确说明图书馆位置。","ko-KR":"정답은 학생 식당 옆이며 마지막 문장에 나옵니다."},"feedback":[{"zh-CN":"再听最后一句，找参照地点和方位词。","ko-KR":"마지막 문장의 기준 장소와 위치 명사를 들으세요."},{"zh-CN":"앞描述说话人的位置；图书馆与学生食堂是相邻关系。","ko-KR":"앞은 화자의 위치이고 도서관은 학생 식당 옆입니다."},{"zh-CN":"答案是학생 식당 옆；原文末句直接给出依据。","ko-KR":"정답은 학생 식당 옆이며 마지막 문장이 근거입니다."}],"privateListening":{"slowScript":"저는 지금 학생 식당 앞에 있어요. / 민수 씨가 지금 학생 식당에 와요. / 우리는 도서관에 가요. / 도서관은 학생 식당 옆에 있어요.","pauseMarks":"저는 지금 학생 식당 앞에 있어요. ⏸ 민수 씨가 지금 학생 식당에 와요. ⏸ 우리는 도서관에 가요. ⏸ 도서관은 학생 식당 옆에 있어요.","distractorReasons":{"1":"앞은 화자의 현재 위치입니다.","2":"원문에 뒤라고 하지 않았습니다.","3":"두 장소는 안팎이 아니라 옆 관계입니다."}}}},
    {"nodeCode":"listen-and-guide","key":"speaking-campus-guide","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成约40秒、至少8轮的双角色校园向导交流。","ko-KR":"두 역할로 약 40초 동안 8턴 이상의 학교 안내 대화를 하세요."},"instruction":{"zh-CN":"加入三地点、位置问答、两种方位、目的地问答和에 가요/와요回答，并自然开启或结束。","ko-KR":"세 장소, 위치 문답, 두 위치 관계, 목적지 문답과 에 가요/와요 대답을 넣으세요."},"options":[],"config":{"minimumSeconds":35,"maximumSeconds":50,"minimumTurns":8,"requiredCriteria":6,"enforceCompletionRequirements":true,"pronunciationScore":false,"criteria":["至少三个校园地点","至少一次位置问答","两种不同方位关系","至少一次目的地问答","目的地回答使用에 가요/와요","双角色自然开启或结束"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与六类自查；不产生正确性或分数，等待人工复核。","ko-KR":"녹음 정보와 여섯 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查两个角色、8轮、三地点和位置问答。","ko-KR":"두 역할, 8턴, 세 장소와 위치 문답을 확인하세요."},{"zh-CN":"再检查两种方位、目的地问答、가요/와요和自然收束。","ko-KR":"두 위치 관계, 목적지 문답, 가요/와요와 마무리를 확인하세요."},{"zh-CN":"对照六类清单补齐后重录；不显示虚假发音准确率。","ko-KR":"여섯 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
    {"nodeCode":"building-guide-note","key":"reading-building-note","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读主楼 안내卡和秀珍消息，完成三道事实题。","ko-KR":"본관 안내와 수진의 메시지를 읽고 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；答案必须来自文字原句。","ko-KR":"문제마다 하나를 고르고 글의 문장에서 근거를 찾으세요."},"options":[],"config":{"reading":"신입생을 위한 본관 안내\n교실은 본관 이층에 있어요.\n화장실은 일층 사무실 옆에 있어요.\n학생 휴게실은 삼층에 있어요.\n도서관은 본관 뒤에 있어요.\n\n수진 씨의 메시지\n저는 지금 도서관에 가요.","items":[{"id":"restroom","question":"화장실은 어디에 있어요?","options":["일층 사무실 옆","이층 교실 옆","삼층 휴게실 앞","본관 뒤"]},{"id":"lounge","question":"학생 휴게실은 몇 층에 있어요?","options":["삼층","일층","이층","본관 밖"]},{"id":"destination","question":"수진 씨는 지금 어디에 가요?","options":["도서관","화장실","학생 휴게실","사무실"]}],"shuffle":false},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是일층 사무실 옆、삼층、도서관。","ko-KR":"정답은 일층 사무실 옆, 삼층, 도서관입니다."},"feedback":[{"zh-CN":"分别找含화장실、학생 휴게실和秀珍消息中的句子。","ko-KR":"화장실, 학생 휴게실과 수진 메시지 문장을 찾으세요."},{"zh-CN":"第一题同时需要楼层与参照物；第三题找가요前的地点。","ko-KR":"첫 문제는 층과 기준 장소, 셋째는 가요 앞 장소가 필요합니다."},{"zh-CN":"答案是일층 사무실 옆、삼층、도서관。","ko-KR":"정답은 일층 사무실 옆, 삼층, 도서관입니다."}]}},
    {"nodeCode":"building-guide-note","key":"writing-location-note","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给第一次来访的同学写5—6句位置说明。","ko-KR":"처음 오는 친구에게 5~6문장의 위치 안내를 쓰세요."},"instruction":{"zh-CN":"写三地点、两种方位和一个目的地，至少各用一次位置에 있어요与目的地에 가요/와요并完成量规自查。","ko-KR":"세 장소, 두 위치 관계와 목적지를 쓰고 에 있어요와 에 가요/와요를 사용해 자기 점검을 하세요."},"options":[],"config":{"minSentences":5,"maxSentences":6,"minimumHangulCharacters":35,"minimumPhraseGroups":3,"minimumInformationKinds":6,"requireCompletionChecklist":true,"requiredPhraseGroups":[["에 있어요"],["에 가요","에 와요"],["앞에","뒤에","옆에","안에","밖에","위에","아래에"]],"informationChecklist":["至少三个地点","第一种方位关系","第二种不同方位关系","一个人的目的地","位置에 있어요","目的地에 가요/와요"],"structureFrame":"여기가 ___이에요/예요. → ___은/는 ___에 있어요. → ___은/는 ___ 앞/뒤/옆/안/밖/위/아래에 있어요. → ___은/는 지금 ___에 가요/와요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足结构与六类信息、完成量规自查的位置说明；不产生正确性或分数。","ko-KR":"구조와 여섯 정보 및 자기 점검을 갖춘 안내를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数5—6句、三地点、两方位和一个目的地。","ko-KR":"5~6문장, 세 장소, 두 위치와 목적지를 세세요."},{"zh-CN":"检查每个에标记位置还是目的地，并看参照物—方位顺序。","ko-KR":"각 에의 기능과 기준 장소—위치 순서를 확인하세요."},{"zh-CN":"按支架补齐具体缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
    {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接完成校园位置向导的表达。","ko-KR":"학교 위치 안내를 직접 완성하는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["화장실은 일층에 있어요.","도서관에 가요.","사무실 옆에 있어요.","공책하고 연필 주세요."],"config":{"selection":"multiple","shuffle":false},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"A说明位置，B说明目的地，C说明方位；D是物品请求。","ko-KR":"A는 위치, B는 목적지, C는 방향이며 D는 물건 요청입니다."},"feedback":[{"zh-CN":"按位置、目的地、方位检查。","ko-KR":"위치, 목적지와 방향을 확인하세요."},{"zh-CN":"有一句属于物品请求。","ko-KR":"한 문장은 물건 요청입니다."},{"zh-CN":"正确集合是A、B、C。","ko-KR":"정답은 A, B, C입니다."}]}},
    {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do并确定复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do와 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"askLocation","label":"我能询问并回答位置／위치를 묻고 답할 수 있어요"},{"id":"existence","label":"我能用에 있어요/없어요说明存在位置／존재 위치를 말할 수 있어요"},{"id":"relative","label":"我能用至少两种方位说明空间关系／두 위치 명사로 공간 관계를 말할 수 있어요"},{"id":"destination","label":"我能询问并回答目的地／목적지를 묻고 답할 수 있어요"},{"id":"guide","label":"我能完成约40秒、8轮以上双角色向导／40초, 8턴 이상 안내할 수 있어요"}],"returnNodes":[{"value":"campus-and-position","label":"词汇"},{"value":"location-and-destination","label":"语法"},{"value":"campus-guide-dialogue","label":"对话理解"},{"value":"listen-and-guide","label":"听说"},{"value":"building-guide-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；自查不替代客观题、录音或写作，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 저장했으며 다른 증거를 대신하지 않고 점수도 만들지 않습니다."},"feedback":[{"zh-CN":"逐项回想位置、方位、目的地、读写与录音。","ko-KR":"위치, 방향, 목적지, 읽기·쓰기와 녹음을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=activity_seed->>'nodeCode';
    if node_uuid is null then
      raise exception 'Cannot convert chapter 04 activity %: node % was not found', activity_seed->>'key', activity_seed->>'nodeCode';
    end if;
    insert into public.digital_textbook_activities (
      node_id,activity_key,activity_type,sort_order,prompt,instruction,options,
      public_config,max_attempts,counts_toward_completion
    ) values (
      node_uuid,activity_seed->>'key',activity_seed->>'type',(activity_seed->>'order')::integer,
      activity_seed->'prompt',activity_seed->'instruction',activity_seed->'options',activity_seed->'config',
      (activity_seed->>'maxAttempts')::integer,(activity_seed->>'counts')::boolean
    ) on conflict (node_id,activity_key) do update set
      activity_type=excluded.activity_type,sort_order=excluded.sort_order,prompt=excluded.prompt,
      instruction=excluded.instruction,options=excluded.options,public_config=excluded.public_config,
      max_attempts=excluded.max_attempts,counts_toward_completion=excluded.counts_toward_completion,updated_at=now()
    returning id into activity_uuid;
    insert into public.digital_textbook_activity_secrets (
      activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status
    ) values (
      activity_uuid,activity_seed->'answer',activity_seed->'explanation',activity_seed->>'transcript',
      activity_seed->>'audioObjectKey',coalesce(activity_seed->>'audioStatus','pending')
    ) on conflict (activity_id) do update set
      answer_key=excluded.answer_key,explanation=excluded.explanation,transcript_ko=excluded.transcript_ko,
      audio_object_key=excluded.audio_object_key,audio_status=excluded.audio_status,updated_at=now();
  end loop;

  delete from public.digital_textbook_activities activity
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where activity.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-campus-location',
      'speaking-campus-guide','reading-building-note','writing-location-note',
      'review-multiple','self-check'
    );

  for media_seed in select value from jsonb_array_elements($images$
  [
    {"nodeCode":"mission-map","key":"chapter-04-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-04/images/chapter-04-01-scene.png","alt":{"zh-CN":"主楼大厅中新生向志愿者询问校园地点。","ko-KR":"본관 로비에서 신입생이 학생 도우미에게 장소를 묻습니다."},"width":1600,"height":900},
    {"nodeCode":"campus-and-position","key":"chapter-04-image-02","purpose":"核心词汇校园与方位卡","objectKey":"korean-level-one/chapter-04/images/chapter-04-02-vocabulary.png","alt":{"zh-CN":"校园场所与七种方位关系。","ko-KR":"학교 장소와 일곱 가지 위치 관계입니다."},"width":1200,"height":900},
    {"nodeCode":"location-and-destination","key":"chapter-04-image-03","purpose":"位置目的地方位语法总图","objectKey":"korean-level-one/chapter-04/images/chapter-04-03-grammar-overview.png","alt":{"zh-CN":"静态位置、移动目的地和方位结构总流程。","ko-KR":"존재 위치, 이동 목적지와 위치 구조 흐름입니다."},"width":1600,"height":900},
    {"nodeCode":"location-and-destination","key":"chapter-04-image-04","purpose":"存在位置结构图","objectKey":"korean-level-one/chapter-04/images/chapter-04-03a-existence.png","alt":{"zh-CN":"对象、地点에与있어요/없어요结构。","ko-KR":"대상, 장소 에와 있어요/없어요 구조입니다."},"width":1200,"height":900},
    {"nodeCode":"location-and-destination","key":"chapter-04-image-05","purpose":"移动目的地结构图","objectKey":"korean-level-one/chapter-04/images/chapter-04-03b-destination.png","alt":{"zh-CN":"以说话人为基准的가요／와요双箭头。","ko-KR":"화자 기준 가요와 와요 화살표입니다."},"width":1200,"height":900},
    {"nodeCode":"location-and-destination","key":"chapter-04-image-06","purpose":"空间方位结构图","objectKey":"korean-level-one/chapter-04/images/chapter-04-03c-relative-position.png","alt":{"zh-CN":"参照物加方位词再接에 있어요。","ko-KR":"기준 장소와 위치 명사 뒤에 에 있어요를 붙입니다."},"width":1200,"height":900},
    {"nodeCode":"location-exchange-lab","key":"chapter-04-image-07","purpose":"位置问答话轮卡","objectKey":"korean-level-one/chapter-04/images/chapter-04-04-pattern-blocks.png","alt":{"zh-CN":"五张完整位置问答话轮卡。","ko-KR":"다섯 장의 완전한 위치 문답 카드입니다."},"width":1200,"height":900},
    {"nodeCode":"campus-guide-dialogue","key":"chapter-04-image-08","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-04/images/chapter-04-05-dialogue.png","alt":{"zh-CN":"主楼大厅与教室门口两个校园场景。","ko-KR":"본관 로비와 교실 앞의 두 학교 장면입니다."},"width":1600,"height":900},
    {"nodeCode":"listen-and-guide","key":"chapter-04-image-09","purpose":"听力校园方位信息图","objectKey":"korean-level-one/chapter-04/images/chapter-04-06-listening-options.png","alt":{"zh-CN":"学生食堂周围四种无文字方位示意。","ko-KR":"학생 식당 주변 네 위치를 글자 없이 보여 줍니다."},"width":1200,"height":900},
    {"nodeCode":"building-guide-note","key":"chapter-04-image-10","purpose":"主楼指南卡","objectKey":"korean-level-one/chapter-04/images/chapter-04-07-building-guide.png","alt":{"zh-CN":"五行主楼位置说明与无答案楼层示意。","ko-KR":"다섯 줄 본관 위치 안내와 답 표시 없는 층 그림입니다."},"width":1200,"height":1600},
    {"nodeCode":"can-do-check","key":"chapter-04-image-11","purpose":"最终校园向导流程图","objectKey":"korean-level-one/chapter-04/images/chapter-04-08-final-task.png","alt":{"zh-CN":"八轮校园向导六类信息流程。","ko-KR":"8턴 학교 안내의 여섯 정보 흐름입니다."},"width":1600,"height":900}
  ] $images$::jsonb)
  loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=media_seed->>'nodeCode';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,media_seed->>'key','image',media_seed->>'purpose',media_seed->>'objectKey','pending',media_seed->'alt',
      jsonb_build_object('width',(media_seed->>'width')::integer,'height',(media_seed->>'height')::integer,'sourceStatus','待制作')
    ) on conflict (node_id,asset_key) do update set purpose=excluded.purpose,object_key=excluded.object_key,
      production_status='pending',alt_text=excluded.alt_text,metadata=excluded.metadata,updated_at=now();
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='campus-and-position';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,'chapter-04-vocabulary-'||lpad(item.ordinality::text,2,'0'),'audio','词汇原形点读',
    'korean-level-one/chapter-04/audio/vocabulary/chapter-04-vocabulary-'||lpad(item.ordinality::text,2,'0')||'.mp3',
    'pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId','chapter-04-vocabulary-'||lpad(item.ordinality::text,2,'0'),'script',item.value->>'word')
  from jsonb_array_elements($vocabulary$
    [{"word":"본관","collocation":"본관에 있어요."},{"word":"교실","collocation":"교실은 이층에 있어요."},{"word":"화장실","collocation":"화장실이 어디에 있어요?"},{"word":"사무실","collocation":"사무실 옆에 있어요."},{"word":"도서관","collocation":"도서관에 가요."},{"word":"학생 식당","collocation":"학생 식당에 가요."},{"word":"휴게실","collocation":"휴게실은 삼층에 있어요."},{"word":"건물","collocation":"건물 안에 있어요."},{"word":"계단","collocation":"계단 옆에 있어요."},{"word":"층","collocation":"몇 층에 있어요?"},{"word":"앞","collocation":"학생 식당 앞에"},{"word":"뒤","collocation":"본관 뒤에"},{"word":"옆","collocation":"사무실 옆에"},{"word":"안","collocation":"건물 안에"},{"word":"밖","collocation":"건물 밖에"},{"word":"위","collocation":"책상 위에"},{"word":"아래","collocation":"책상 아래에"},{"word":"어디","collocation":"어디에 있어요?"},{"word":"있다","collocation":"일층에 있어요."},{"word":"없다","collocation":"이 건물에 없어요."},{"word":"가다","collocation":"도서관에 가요."},{"word":"오다","collocation":"학생 식당에 와요."}]
  $vocabulary$::jsonb) with ordinality item(value,ordinality)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,'chapter-04-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0'),'audio','词汇搭配例句点读',
    'korean-level-one/chapter-04/audio/vocabulary/chapter-04-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0')||'.mp3',
    'pending','{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId','chapter-04-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0'),'script',item.value->>'collocation')
  from jsonb_array_elements($vocabulary$
    [{"word":"본관","collocation":"본관에 있어요."},{"word":"교실","collocation":"교실은 이층에 있어요."},{"word":"화장실","collocation":"화장실이 어디에 있어요?"},{"word":"사무실","collocation":"사무실 옆에 있어요."},{"word":"도서관","collocation":"도서관에 가요."},{"word":"학생 식당","collocation":"학생 식당에 가요."},{"word":"휴게실","collocation":"휴게실은 삼층에 있어요."},{"word":"건물","collocation":"건물 안에 있어요."},{"word":"계단","collocation":"계단 옆에 있어요."},{"word":"층","collocation":"몇 층에 있어요?"},{"word":"앞","collocation":"학생 식당 앞에"},{"word":"뒤","collocation":"본관 뒤에"},{"word":"옆","collocation":"사무실 옆에"},{"word":"안","collocation":"건물 안에"},{"word":"밖","collocation":"건물 밖에"},{"word":"위","collocation":"책상 위에"},{"word":"아래","collocation":"책상 아래에"},{"word":"어디","collocation":"어디에 있어요?"},{"word":"있다","collocation":"일층에 있어요."},{"word":"없다","collocation":"이 건물에 없어요."},{"word":"가다","collocation":"도서관에 가요."},{"word":"오다","collocation":"학생 식당에 와요."}]
  $vocabulary$::jsonb) with ordinality item(value,ordinality)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='location-and-destination';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,item.value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-04/audio/grammar/'||(item.value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId',item.value->>'id','script',item.value->>'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-04-grammar-01-example-01","script":"화장실이 어디에 있어요?"},{"id":"chapter-04-grammar-01-example-02","script":"화장실은 일층에 있어요."},{"id":"chapter-04-grammar-01-example-03","script":"학생 휴게실은 삼층에 있어요."},{"id":"chapter-04-grammar-02-example-01","script":"지금 어디에 가요?"},{"id":"chapter-04-grammar-02-example-02","script":"학생 식당에 가요."},{"id":"chapter-04-grammar-02-example-03","script":"민수 씨가 지금 학생 식당에 와요."},{"id":"chapter-04-grammar-03-example-01","script":"사무실은 계단 옆에 있어요."},{"id":"chapter-04-grammar-03-example-02","script":"도서관은 본관 뒤에 있어요."},{"id":"chapter-04-grammar-03-example-03","script":"화장실은 일층 사무실 옆에 있어요."}]
  $grammar$::jsonb) item(value)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='campus-guide-dialogue';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,item.value->>'id','audio',item.value->>'purpose',
    'korean-level-one/chapter-04/audio/dialogue/'||(item.value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,item.value-'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-04-dialogue-main-line-01","purpose":"主对话逐句","script":"수진 씨, 여기가 본관이에요.","speaker":"F01／지민"},{"id":"chapter-04-dialogue-main-line-02","purpose":"主对话逐句","script":"화장실이 어디에 있어요?","speaker":"F02／수진"},{"id":"chapter-04-dialogue-main-line-03","purpose":"主对话逐句","script":"화장실은 일층에 있어요.","speaker":"F01／지민"},{"id":"chapter-04-dialogue-main-line-04","purpose":"主对话逐句","script":"일층 어디에 있어요?","speaker":"F02／수진"},{"id":"chapter-04-dialogue-main-line-05","purpose":"主对话逐句","script":"사무실 옆에 있어요.","speaker":"F01／지민"},{"id":"chapter-04-dialogue-main-line-06","purpose":"主对话逐句","script":"도서관은 어디에 있어요?","speaker":"F02／수진"},{"id":"chapter-04-dialogue-main-line-07","purpose":"主对话逐句","script":"도서관은 본관 뒤에 있어요.","speaker":"F01／지민"},{"id":"chapter-04-dialogue-main-line-08","purpose":"主对话逐句","script":"지금 어디에 가요?","speaker":"F01／지민"},{"id":"chapter-04-dialogue-main-line-09","purpose":"主对话逐句","script":"도서관에 가요. 고마워요.","speaker":"F02／수진"},{"id":"chapter-04-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／F02"},{"id":"chapter-04-dialogue-alt-line-01","purpose":"第二对话逐句","script":"민호 씨, 지금 어디에 가요?","speaker":"F03／유나"},{"id":"chapter-04-dialogue-alt-line-02","purpose":"第二对话逐句","script":"학생 식당에 가요.","speaker":"M01／민호"},{"id":"chapter-04-dialogue-alt-line-03","purpose":"第二对话逐句","script":"학생 식당이 어디에 있어요?","speaker":"F03／유나"},{"id":"chapter-04-dialogue-alt-line-04","purpose":"第二对话逐句","script":"도서관 옆에 있어요.","speaker":"M01／민호"},{"id":"chapter-04-dialogue-alt-line-05","purpose":"第二对话逐句","script":"저도 학생 식당에 가요.","speaker":"F03／유나"},{"id":"chapter-04-dialogue-alt-line-06","purpose":"第二对话逐句","script":"좋아요. 같이 가요.","speaker":"M01／민호"},{"id":"chapter-04-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F03／M01"}]
  $dialogue$::jsonb) item(value)
  on conflict (node_id,asset_key) do update set purpose=excluded.purpose,object_key=excluded.object_key,
    production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and node.node_code='listen-and-guide'
    and activity.activity_key='listening-campus-location';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-04-listening-campus-location-normal','audio','私有听力正常语速','korean-level-one/chapter-04/listening/chapter-04-listening-campus-location-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F04／지연","scriptVisibility":"private","speed":"normal"}'::jsonb),
    (node_uuid,activity_uuid,'chapter-04-listening-campus-location-slow','audio','私有听力慢速','korean-level-one/chapter-04/listening/chapter-04-listening-campus-location-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F04／지연","scriptVisibility":"private","speed":"slow"}'::jsonb)
  on conflict (node_id,asset_key) do update set activity_id=excluded.activity_id,purpose=excluded.purpose,
    object_key=excluded.object_key,production_status='pending',alt_text=excluded.alt_text,metadata=excluded.metadata,updated_at=now();
end;
$seed$;

commit;
