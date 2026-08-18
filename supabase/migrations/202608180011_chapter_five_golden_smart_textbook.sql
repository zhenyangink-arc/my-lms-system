begin;

-- Converted from the read-only UPLY BOOK chapter-five master.
-- source_sha256: 394f3dfd82feb1a08a832885c19ca50402f89b882e4092eaee9845fe6d290b61
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are historical values recorded by
-- the master and remain pending platform verification; they are not invented here.

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
    raise exception 'Cannot convert chapter 05: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 05: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid from public.chapter_tests where slug = 'korean-level-one-05' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 5 limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000005'::uuid, lesson_uuid,
      'korean-level-one-05', 'korean-level-one', 5,
      '第 05 章测试：周末见了朋友。', '제05과 평가: 주말에 친구를 만났어요.',
      '检查日期星期、时间助词、过去时、动作连接以及周末经历的理解与组织。',
      12, 60,
      '{"recognition":"日期与周末词汇","structure":"时间与过去表达","reading":"对话与日记理解","assembly":"周末故事组织"}'::jsonb,
      1, 'draft', '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id=lesson_uuid, slug='korean-level-one-05', course_key='korean-level-one',
      chapter_number=5, title='第 05 章测试：周末见了朋友。',
      korean_title='제05과 평가: 주말에 친구를 만났어요.',
      description='检查日期星期、时间助词、过去时、动作连接以及周末经历的理解与组织。',
      duration_minutes=12, passing_score=60,
      skills='{"recognition":"日期与周末词汇","structure":"时间与过去表达","reading":"对话与日记理解","assembly":"周末故事组织"}'::jsonb,
      version=1, status='draft',
      student_app_id='10000000-0000-4000-8000-000000000001'::uuid,
      updated_at=now()
    where id=test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id=test_uuid and question_key not in (
    'golden-05-01','golden-05-02','golden-05-03','golden-05-04',
    'golden-05-05','golden-05-06','golden-05-07','golden-05-08',
    'golden-05-09','golden-05-10','golden-05-11','golden-05-12'
  );
  update public.chapter_test_questions set sort_order=sort_order+100, updated_at=now()
  where test_id=test_uuid;

  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-05-01','“주말”是什么意思？','["周末","上午","星期一","电影"]',0,'주말 表示周末。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-05-02','“5月3日”的规范韩文读法是哪一项？','["오월 삼일","오월 사일","유월 삼일","오일 삼월"]',0,'月份和日期用汉字词数，5月3日读作 오월 삼일。','recognition',2,'single_choice',10,'foundation','["日期","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-05-03','“토요일___ 친구를 만났어요.”应填什么？','["에","에서","을","고"]',0,'具体星期后用时间助词 에。','structure',3,'single_choice',10,'foundation','["时间助词","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-05-04','“만나다”的自然过去形是哪一项？','["만났어요","만나요","만나고","만나다요"]',0,'만나다 与 았어요 缩约为 만났어요。','structure',4,'single_choice',10,'foundation','["过去时","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-05-05','“보다”的自然过去形是哪一项？','["봤어요","봐었어요","보아요","보고"]',0,'보다 的自然过去缩约形是 봤어요。','structure',5,'single_choice',10,'foundation','["过去时","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-05-06','“공부하다”的过去形是哪一项？','["공부했어요","공부하았어요","공부해요","공부하고"]',0,'하다 的过去形是 했어요。','structure',6,'single_choice',10,'foundation','["하다过去时","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-05-07','“밥을 먹___ 영화를 봤어요.”应填什么？','["고","에","에서","았어요"]',0,'第一个动词词干后接 -고 连接动作。','structure',7,'single_choice',10,'foundation','["动作连接","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-05-08','主场景中，敏秀和朋友在哪里见面？','["学校门口","公园","图书馆","学生休息区"]',0,'主场景第6轮说 학교 앞에서 만났어요。','reading',8,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-05-09','第二场景中，俊浩下午去了哪里？','["公园","电影院","图书馆","学校食堂"]',0,'第二场景第4轮说 오후에 공원에 갔어요。','reading',9,'single_choice',10,'foundation','["对话事实","母本§6.2"]','draft',1,true,'STEP 05','母本 §6.2'),
    (test_uuid,'golden-05-10','周末日记中，谁和写作者一起去了公园？','["家人","朋友","老师","同学"]',0,'日记原文是 가족하고 공원에 갔어요。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-05-11','周末故事的自然信息顺序是哪一项？','["提问→时间人物→地点→动作→感受","感受→提问→地点→动作→时间人物","地点→感受→提问→动作→时间人物","动作→地点→感受→时间人物→提问"]',0,'母本排序任务要求先提问，再依次说明时间人物、地点、动作和感受。','assembly',11,'single_choice',10,'medium','["语块排序","母本§3.4"]','draft',1,true,'STEP 08','母本 §3.4'),
    (test_uuid,'golden-05-12','课末周末经历录音必须满足哪一项？','["40—55秒、6—8句，含时间、人物或地点、三个过去动作、-고和过去感受","只背诵日期和星期","必须获得自动发音分数","只写四句话无需录音"]',0,'母本规定40—55秒、6—8句和五类信息，当前不做发音自动评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2')
  on conflict (test_id,question_key) do update set
    prompt=excluded.prompt,options=excluded.options,correct_option=excluded.correct_option,
    explanation=excluded.explanation,skill=excluded.skill,sort_order=excluded.sort_order,
    question_type=excluded.question_type,default_points=excluded.default_points,
    difficulty=excluded.difficulty,tags=excluded.tags,status='draft',version=excluded.version,
    is_chapter_test_item=excluded.is_chapter_test_item,
    ebook_section_step=excluded.ebook_section_step,
    ebook_page_reference=excluded.ebook_page_reference,updated_at=now();

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id=version_uuid and (chapter_number=5 or slug='weekend')
  order by (slug='weekend') desc limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,
      image_status,source_revision
    ) values (
      version_uuid,test_uuid,'weekend',5,
      '{"zh-CN":"周末见了朋友。","ko-KR":"주말에 친구를 만났어요."}'::jsonb,
      '{"zh-CN":"周一午休，敏秀在学校食堂向智秀讲上周末的日期、见面地点、连续活动和感受；另一组同学交流星期日上午与下午的不同经历。","ko-KR":"월요일 점심시간에 민수는 학교 식당에서 지수에게 지난 주말의 날짜, 만난 곳, 이어진 활동과 느낌을 말하고 다른 두 학생은 일요일 오전과 오후 경험을 나눕니다."}'::jsonb,
      '{"zh-CN":"使用日期、星期、时间助词에、过去时和-고，按时间顺序完成40—55秒、6—8句的个人周末经历叙述。","ko-KR":"날짜, 요일, 시간 조사 에, 과거 표현과 -고를 사용하여 시간 순서에 따라 40~55초, 6~8문장의 주말 경험을 말합니다."}'::jsonb,
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第05课 주말에 친구를 만났어요.md @ 2026-08-18 / sha256:394f3dfd82feb1a08a832885c19ca50402f89b882e4092eaee9845fe6d290b61'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid,slug='weekend',chapter_number=5,
      title='{"zh-CN":"周末见了朋友。","ko-KR":"주말에 친구를 만났어요."}'::jsonb,
      scenario='{"zh-CN":"周一午休，敏秀在学校食堂向智秀讲上周末的日期、见面地点、连续活动和感受；另一组同学交流星期日上午与下午的不同经历。","ko-KR":"월요일 점심시간에 민수는 학교 식당에서 지수에게 지난 주말의 날짜, 만난 곳, 이어진 활동과 느낌을 말하고 다른 두 학생은 일요일 오전과 오후 경험을 나눕니다."}'::jsonb,
      goal='{"zh-CN":"使用日期、星期、时间助词에、过去时和-고，按时间顺序完成40—55秒、6—8句的个人周末经历叙述。","ko-KR":"날짜, 요일, 시간 조사 에, 과거 표현과 -고를 사용하여 시간 순서에 따라 40~55초, 6~8문장의 주말 경험을 말합니다."}'::jsonb,
      status='draft',production_status='editorial_review',editorial_status='pending',
      native_review_status='pending',audio_status='pending',image_status='pending',
      source_revision='UPLY BOOK 第05课 주말에 친구를 만났어요.md @ 2026-08-18 / sha256:394f3dfd82feb1a08a832885c19ca50402f89b882e4092eaee9845fe6d290b61',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for module_seed in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"nodeCode":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"description":{"zh-CN":"确认讲清周末经历需要的五类信息。","ko-KR":"주말 경험에 필요한 다섯 정보를 확인합니다."},"nodeTitle":{"zh-CN":"怎样把周末讲清楚？","ko-KR":"주말 이야기를 어떻게 분명하게 말할까요?"},"content":{"lead":{"zh-CN":"从日期或星期开始，依次说人物或地点、三个过去动作、动作连接和感受。","ko-KR":"날짜나 요일부터 시작해 사람이나 장소, 세 과거 동작, 연결과 느낌을 차례로 말합니다."},"targets":[{"ko":"주말에 뭐 했어요?","zh":"询问过去周末经历"},{"ko":"토요일에 친구를 만났어요.","zh":"交代时间和人物"},{"ko":"같이 밥을 먹고 영화를 봤어요.","zh":"连接过去动作"},{"ko":"정말 재미있었어요.","zh":"表达过去感受"}],"finalOutput":{"zh-CN":"40—55秒、6—8句的单人周末经历叙述，包含母本规定的五类信息。","ko-KR":"원고의 다섯 정보를 포함한 40~55초, 6~8문장의 개인 주말 경험 말하기입니다."},"coach":{"zh-CN":"本节点只以答对不计分场景诊断为强制证据。","ko-KR":"점수 없는 장면 진단 정답만 필수 증거입니다."},"nextNode":"weekend-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"nodeCode":"weekend-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"description":{"zh-CN":"把20个时间、地点、动作和感受词与搭配一起记。","ko-KR":"시간, 장소, 동작과 느낌 어휘 20개를 결합과 함께 익힙니다."},"nodeTitle":{"zh-CN":"把时间、地点、动作和感受配成块","ko-KR":"시간, 장소, 동작과 느낌을 말덩이로 익히기"},"content":{"lead":{"zh-CN":"按看图猜活动、点读原形、跟读搭配、按时间轴复述的顺序学习；音频全部待制作。","ko-KR":"그림으로 활동을 추측하고 기본형과 결합을 들은 뒤 시간 순서로 말합니다. 음원은 모두 제작 대기 중입니다."},"vocabulary":[
      {"ko":"주말","zh":"周末","pos":"名词","collocation":"주말에 뭐 했어요?"},{"ko":"월요일","zh":"星期一","pos":"名词","collocation":"월요일 점심시간"},{"ko":"토요일","zh":"星期六","pos":"名词","collocation":"토요일에 친구를 만났어요."},{"ko":"일요일","zh":"星期日","pos":"名词","collocation":"일요일에 집에서 쉬었어요."},{"ko":"오전","zh":"上午","pos":"名词","collocation":"오전에 공부했어요."},{"ko":"오후","zh":"下午","pos":"名词","collocation":"오후에 공원에 갔어요."},{"ko":"사진","zh":"照片","pos":"名词","collocation":"사진을 찍었어요."},{"ko":"친구","zh":"朋友","pos":"名词","collocation":"친구를 만났어요."},{"ko":"영화","zh":"电影","pos":"名词","collocation":"영화를 봤어요."},{"ko":"공원","zh":"公园","pos":"名词","collocation":"공원에 갔어요."},{"ko":"도서관","zh":"图书馆","pos":"名词","collocation":"도서관에서 공부했어요."},{"ko":"만나다","zh":"见面","pos":"动词","collocation":"친구를 만났어요."},{"ko":"가다","zh":"去","pos":"动词","collocation":"공원에 갔어요."},{"ko":"보다","zh":"看","pos":"动词","collocation":"영화를 봤어요."},{"ko":"먹다","zh":"吃","pos":"动词","collocation":"밥을 먹었어요."},{"ko":"공부하다","zh":"学习","pos":"动词","collocation":"도서관에서 공부했어요."},{"ko":"쉬다","zh":"休息","pos":"动词","collocation":"집에서 쉬었어요."},{"ko":"산책하다","zh":"散步","pos":"动词","collocation":"공원에서 산책했어요."},{"ko":"찍다","zh":"拍摄","pos":"动词","collocation":"사진을 찍었어요."},{"ko":"재미있다","zh":"有趣","pos":"形容词","collocation":"정말 재미있었어요."}
    ],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；20词点读、图片快说和另说搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 어휘 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"past-time-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":17,"nodeCode":"past-time-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"description":{"zh-CN":"用日期星期、时间에、过去时和-고建立时间线。","ko-KR":"날짜와 요일, 시간 에, 과거형과 -고로 시간선을 만듭니다."},"nodeTitle":{"zh-CN":"给过去的故事加上时间和顺序","ko-KR":"지난 이야기에 시간과 순서 넣기"},"content":{"lead":{"zh-CN":"先读日期和星期，再判断时间词是否加에，然后把动作变成过去时，最后用-고连接。","ko-KR":"날짜와 요일을 읽고 시간 에를 판단한 뒤 동작을 과거형으로 바꾸고 -고로 연결합니다."},"grammarCards":[
      {"form":"汉字词数字 + 월/일；요일","function":{"zh-CN":"说清数字日期和星期。","ko-KR":"숫자 날짜와 요일을 분명하게 말합니다."},"rules":["月份用汉字词数字加월，日期用汉字词数字加일","6月固定读유월，10月固定读시월","数字日期回答며칠，星期回答무슨 요일","阿拉伯数字写5월 3일，朗读脚本写오월 삼일"],"examples":[{"ko":"오월 삼일은 토요일이에요.","zh":"5月3日是星期六。","audioId":"chapter-05-grammar-01-example-01","audioStatus":"pending"},{"ko":"네, 맞아요. 오월 삼일은 토요일이었어요.","zh":"对，没错。5月3日是星期六。","audioId":"chapter-05-grammar-01-example-02","audioStatus":"pending"},{"ko":"오월 사일은 일요일이었어요.","zh":"5月4日是星期日。","audioId":"chapter-05-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：육월 삼일；6月按固定读法说유월。","ko-KR":"잘못: 육월 삼일. 6월은 유월로 읽습니다."},"comparison":{"zh-CN":"오월 삼일是日期，토요일是星期；两者回答不同问题。","ko-KR":"오월 삼일은 날짜이고 토요일은 요일이라 서로 다른 질문에 답합니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
      {"form":"时间名词 + 에","function":{"zh-CN":"说明动作发生的具体时间。","ko-KR":"동작이 일어난 구체적인 시간을 말합니다."},"rules":["具体日期、星期和时段后加에","에与前面的时间名词连写","오늘、내일、어제、언제通常不加에","动作场所用에서，时间用에"],"examples":[{"ko":"토요일에 친구를 만났어요.","zh":"星期六见了朋友。","audioId":"chapter-05-grammar-02-example-01","audioStatus":"pending"},{"ko":"일요일에 집에서 쉬었어요.","zh":"星期日在家休息了。","audioId":"chapter-05-grammar-02-example-02","audioStatus":"pending"},{"ko":"오후에 친구를 만나고 영화를 봤어요.","zh":"下午见了朋友，还看了电影。","audioId":"chapter-05-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：어제에 친구를 만났어요.；어제通常不再加에。","ko-KR":"잘못: 어제에 친구를 만났어요. 어제에는 보통 에를 붙이지 않습니다."},"comparison":{"zh-CN":"토요일에说明时间，학교에서说明动作场所。","ko-KR":"토요일에는 시간, 학교에서는 동작 장소를 나타냅니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
      {"form":"V/A-았/었어요","function":{"zh-CN":"表达已结束的动作和过去状态或感受。","ko-KR":"끝난 동작과 과거 상태나 느낌을 말합니다."},"rules":["词干末元音ㅏ/ㅗ通常接았어요","其他元音通常接었어요","하다变했어요","识别만났어요、봤어요等常见缩约"],"examples":[{"ko":"영화를 봤어요.","zh":"看了电影。","audioId":"chapter-05-grammar-03-example-01","audioStatus":"pending"},{"ko":"토요일에 친구를 만났어요.","zh":"星期六见了朋友。","audioId":"chapter-05-grammar-03-example-02","audioStatus":"pending"},{"ko":"날씨가 좋았어요.","zh":"天气很好。","audioId":"chapter-05-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：영화를 봐었어요.；自然缩约形是봤어요。","ko-KR":"잘못: 영화를 봐었어요. 자연스러운 줄임말은 봤어요입니다."},"comparison":{"zh-CN":"봐요表示现在或一般情况，봤어요表示已经发生。","ko-KR":"봐요는 현재나 일반 상황, 봤어요는 이미 일어난 일을 나타냅니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
      {"form":"V-고","function":{"zh-CN":"连接两个相关动作。","ko-KR":"관련된 두 동작을 연결합니다."},"rules":["动词去다后直接加고","有无收音都不改变-고","初级过去叙述通常在最后谓语标过去","-고表示连接，具体先后由语境与说话顺序判断"],"examples":[{"ko":"밥을 먹고 영화를 봤어요.","zh":"吃了饭，还看了电影。","audioId":"chapter-05-grammar-04-example-01","audioStatus":"pending"},{"ko":"같이 밥을 먹고 영화를 봤어요.","zh":"一起吃了饭，还看了电影。","audioId":"chapter-05-grammar-04-example-02","audioStatus":"pending"},{"ko":"공원에서 점심을 먹고 사진을 찍었어요.","zh":"在公园吃了午饭，还拍了照片。","audioId":"chapter-05-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：밥을 먹다고 영화를 봤어요.；连接词尾接词干먹-。","ko-KR":"잘못: 밥을 먹다고 영화를 봤어요. 연결 어미는 어간 먹-에 붙입니다."},"comparison":{"zh-CN":"N하고 N连接名词，V-고连接谓语。","ko-KR":"N하고 N은 명사, V-고는 서술어를 연결합니다."},"source":{"zh-CN":"母本§5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}
    ],"coach":{"zh-CN":"六项填空全部正确才完成；口头规则解释和扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"weekend-story-lab"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,"nodeCode":"weekend-story-lab","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"description":{"zh-CN":"把时间、地点、动作和感受排成周末小故事。","ko-KR":"시간, 장소, 동작과 느낌을 주말 이야기로 배열합니다."},"nodeTitle":{"zh-CN":"从单句变成有顺序的小故事","ko-KR":"한 문장을 순서 있는 이야기로 바꾸기"},"content":{"lead":{"zh-CN":"按提问、时间人物、地点、动作和感受组织信息。","ko-KR":"질문, 시간과 사람, 장소, 동작과 느낌 순서로 정보를 구성합니다."},"substitutionGroups":[["토요일에 친구를 만났어요.","일요일에 가족을 만났어요.","오후에 친구를 만났어요."],["영화를 봤어요.","밥을 먹었어요.","공원에서 산책했어요.","도서관에서 공부했어요."],["밥을 먹고 영화를 봤어요.","공부하고 집에서 쉬었어요.","산책하고 사진을 찍었어요."]],"orderBlocks":["정말 재미있었어요.","학교 앞에서 만났어요.","주말에 뭐 했어요?","같이 밥을 먹고 영화를 봤어요.","토요일에 친구를 만났어요."],"personalOutput":["人物或目的地句","至少一个-고动作链","过去感受句"],"coach":{"zh-CN":"五个完整语块排序正确即完成；替换、快答和个人表达为自主练习。","ko-KR":"다섯 말덩이 순서를 맞히면 완료되며 대치와 개인 표현은 자율 연습입니다."},"nextNode":"monday-weekend-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":12,"nodeCode":"monday-weekend-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"description":{"zh-CN":"听懂时间、地点、动作和感受的追问。","ko-KR":"시간, 장소, 동작과 느낌을 묻는 질문을 이해합니다."},"nodeTitle":{"zh-CN":"听追问，把周末说完整","ko-KR":"추가 질문을 듣고 주말 이야기 완성하기"},"content":{"lead":{"zh-CN":"主场景8轮讲见朋友、吃饭、看电影；第二场景6轮讲星期日上午与下午的活动。全部音频待制作。","ko-KR":"주 장면 8턴은 친구, 식사와 영화 이야기이고 두 번째 장면 6턴은 일요일 오전과 오후 활동입니다. 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":"场景1｜周一学校食堂","context":{"zh-CN":"敏秀向智秀讲上周六见朋友的经历。","ko-KR":"민수는 지수에게 지난 토요일 친구를 만난 경험을 말합니다."},"lines":[{"speaker":"지수","ko":"주말에 뭐 했어요?","zh":"周末做什么了？"},{"speaker":"민수","ko":"토요일에 친구를 만났어요.","zh":"星期六见了朋友。"},{"speaker":"지수","ko":"아, 오월 삼일에 만났어요?","zh":"啊，是5月3日见的吗？"},{"speaker":"민수","ko":"네, 맞아요. 오월 삼일은 토요일이었어요.","zh":"对，没错。5月3日是星期六。"},{"speaker":"지수","ko":"어디에서 만났어요?","zh":"在哪里见的？"},{"speaker":"민수","ko":"학교 앞에서 만났어요. 같이 밥을 먹고 영화를 봤어요.","zh":"在学校门口见的。一起吃了饭，还看了电影。"},{"speaker":"지수","ko":"영화가 어땠어요?","zh":"电影怎么样？"},{"speaker":"민수","ko":"정말 재미있었어요.","zh":"真的很有趣。"}]},{"title":"场景2｜学生休息区","context":{"zh-CN":"素拉追问俊浩星期日上午和下午做了什么。","ko-KR":"소라는 준호에게 일요일 오전과 오후 활동을 묻습니다."},"lines":[{"speaker":"소라","ko":"일요일에 뭐 했어요?","zh":"星期日做什么了？"},{"speaker":"준호","ko":"일요일에 집에서 쉬었어요.","zh":"星期日在家休息了。"},{"speaker":"소라","ko":"하루 종일 집에 있었어요?","zh":"一整天都在家吗？"},{"speaker":"준호","ko":"아니요. 오후에 공원에 갔어요.","zh":"没有。下午去了公园。"},{"speaker":"소라","ko":"공원에서 뭐 했어요?","zh":"在公园做什么了？"},{"speaker":"준호","ko":"산책하고 사진을 찍었어요.","zh":"散了步，还拍了照片。"}]}],"coach":{"zh-CN":"事实组合题和电影感受回应题都答对才完成；信息替换与试录为自主练习。","ko-KR":"사실 조합과 영화 느낌 응답을 모두 맞혀야 하며 정보 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-tell"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":13,"nodeCode":"listen-and-tell","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"description":{"zh-CN":"听出下午活动，再提交45秒个人周末故事。","ko-KR":"오후 활동을 듣고 45초 개인 주말 이야기를 제출합니다."},"nodeTitle":{"zh-CN":"听出下午活动，再讲自己的故事","ko-KR":"오후 활동을 듣고 나의 이야기 말하기"},"content":{"lead":{"zh-CN":"听力答案只来自私有音频；正常速和慢速独立绑定且待制作。","ko-KR":"듣기 답은 비공개 음성에만 근거하며 보통 속도와 느린 속도 음원은 제작 대기 중입니다."},"listenFor":["오전과오후的分界","오후에后的两个动作","친구를 만나고 영화를 봤어요"],"speakingFrame":"40—55秒、6—8句：日期或星期＋人物或地点＋三个过去动作＋至少一次-고＋过去感受","speakingCriteria":["一个数字日期或星期","见了谁或去了哪里","至少三个过去动作","至少一次-고","一个过去感受"],"coach":{"zh-CN":"开放录音只保存完成证据，不产生正确性或分数；不显示虚假发音准确率。","ko-KR":"녹음은 완료 증거만 저장하고 정오나 점수를 만들지 않으며 발음 점수를 표시하지 않습니다."},"nextNode":"weekend-diary"}},
    {"code":"read_write","order":7,"accent":"iris","type":"practice","minutes":12,"nodeCode":"weekend-diary","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"description":{"zh-CN":"读周末日记，再写4—5句原创日记。","ko-KR":"주말 일기를 읽고 4~5문장의 새로운 일기를 씁니다."},"nodeTitle":{"zh-CN":"读周末日记，写新的四格日记","ko-KR":"주말 일기를 읽고 새로운 네 칸 일기 쓰기"},"content":{"lead":{"zh-CN":"按时间、人物地点、动作和感受找信息，再用安全真实或虚构经历写作。","ko-KR":"시간, 사람과 장소, 동작과 느낌을 찾고 안전한 실제 또는 가상 경험을 씁니다."},"reading":"오월 사일은 일요일이었어요.\n가족하고 공원에 갔어요.\n공원에서 점심을 먹고 사진을 찍었어요.\n날씨가 좋았어요. 정말 즐거웠어요.","questions":["오월 사일은 무슨 요일이었어요?","누구하고 공원에 갔어요?","공원에서 무엇을 했어요?"],"writingFrame":"___월 ___일은 ___요일이었어요.／___요일에 ___에 갔어요. → ___하고/와/과 함께 ___했어요. → ___고 ___았/었어요. → 정말 ___았/었어요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"originalExample":"토요일에 동생하고 도서관에 갔어요. 오전에 같이 공부했어요. 점심을 먹고 공원에서 산책했어요. 정말 즐거웠어요.","coach":{"zh-CN":"阅读三题全对；写作满足句数、五类信息与量规自查后完成，仍不产生分数。","ko-KR":"읽기 세 문항을 맞히고 쓰기 조건과 자기 점검을 갖추면 완료되지만 점수는 만들지 않습니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"coral","type":"review","minutes":8,"nodeCode":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},"description":{"zh-CN":"完成综合多选、五项Can-do并记录返回节点。","ko-KR":"종합 복수 선택과 다섯 Can-do를 점검하고 복습 위치를 기록합니다."},"nodeTitle":{"zh-CN":"我能让别人听懂周末时间线吗？","ko-KR":"다른 사람이 주말 시간선을 이해할 수 있나요?"},"content":{"lead":{"zh-CN":"把错误分到词汇、日期语法、理解、表达或读写，返回最短路径。","ko-KR":"오류를 어휘, 날짜와 문법, 이해, 표현 또는 읽기·쓰기로 나눕니다."},"checklist":[{"ko":"날짜와 요일을 구별하여 말할 수 있어요.","zh":"我能区分并说出日期和星期"},{"ko":"구체적인 시간 뒤에 에를 사용하여 과거 행동을 말할 수 있어요.","zh":"我能用时间에说过去动作"},{"ko":"동사와 형용사를 자연스러운 과거형으로 바꿀 수 있어요.","zh":"我能变成自然过去形"},{"ko":"-고로 동작을 연결하여 4~5문장의 주말 일기를 쓸 수 있어요.","zh":"我能用-고写4—5句日记"},{"ko":"시간, 세 가지 동작과 느낌을 넣어 약 45초 동안 주말 경험을 말할 수 있어요.","zh":"我能完成约45秒的周末叙述"}],"returnMap":[{"reason":"词汇","node":"weekend-words"},{"reason":"日期／语法","node":"past-time-tools"},{"reason":"理解","node":"monday-weekend-talk"},{"reason":"表达","node":"listen-and-tell"},{"reason":"读写","node":"weekend-diary"}],"coach":{"zh-CN":"综合多选正确并提交五项自查后完成；八节点全部完成才解锁章节测试。","ko-KR":"복수 선택 정답과 다섯 점검을 제출하고 여덟 노드를 모두 완료해야 단원 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-05"}}
  ] $modules$::jsonb)
  loop
    insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
    values (chapter_uuid,module_seed->>'code',(module_seed->>'order')::integer,module_seed->>'accent',module_seed->'title',module_seed->'description')
    on conflict (chapter_id,module_code) do update set sort_order=excluded.sort_order,
      accent_role=excluded.accent_role,title=excluded.title,description=excluded.description,updated_at=now()
    returning id into module_uuid;
    insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
    values (module_uuid,module_seed->>'nodeCode',module_seed->>'type',1,(module_seed->>'minutes')::integer,module_seed->'nodeTitle',module_seed->'content')
    on conflict (module_id,node_code) do update set node_type=excluded.node_type,sort_order=excluded.sort_order,
      estimated_minutes=excluded.estimated_minutes,title=excluded.title,content=excluded.content,updated_at=now()
    returning id into node_uuid;
  end loop;

  for activity_seed in select value from jsonb_array_elements($activities$
  [
    {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"周一，智秀想问敏秀上周末做了什么。哪一句最适合？","ko-KR":"월요일에 지수는 민수에게 지난 주말에 무엇을 했는지 묻고 싶어 합니다. 가장 알맞은 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合“询问过去周末经历”的一句；本题不计分。","ko-KR":"지난 주말 경험을 묻는 표현을 고르세요. 점수에는 포함되지 않습니다."},"options":["주말에 뭐 했어요?","이거는 뭐예요?","얼마예요?","어디에 있어요?"],"config":{"shuffle":false,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"주말에 뭐 했어요?直接询问过去周末活动，本题不显示分数。","ko-KR":"주말에 뭐 했어요?는 지난 주말 활동을 직접 묻고 점수는 표시하지 않습니다."},"feedback":[{"zh-CN":"先找表示“周末”的词。","ko-KR":"주말을 뜻하는 말을 먼저 찾으세요."},{"zh-CN":"目标句需要同时含주말和过去问法뭐 했어요?。","ko-KR":"주말과 과거 질문 뭐 했어요?가 함께 필요합니다."},{"zh-CN":"正确答案是주말에 뭐 했어요?。","ko-KR":"정답은 주말에 뭐 했어요?입니다."}]}},
    {"nodeCode":"weekend-words","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在주말에 친구를 만났어요.中，주말是什么意思？","ko-KR":"주말에 친구를 만났어요.에서 주말은 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 읽고 확인하세요."},"options":["周末","星期一","上午","电影"],"config":{"shuffle":false,"audioStatus":"pending","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"주말是“周末”；整句表示“周末见了朋友”。","ko-KR":"주말은 한 주의 끝이며 문장은 주말에 친구를 만났다는 뜻입니다."},"feedback":[{"zh-CN":"看주말后的时间助词에。","ko-KR":"주말 뒤의 시간 조사 에를 보세요."},{"zh-CN":"它指一周末尾的休息日。","ko-KR":"한 주 끝의 쉬는 날을 뜻합니다."},{"zh-CN":"正确答案是“周末”。","ko-KR":"정답은 주말입니다."}]}},
    {"nodeCode":"past-time-tools","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成六小题，检查日期读法、时间助词、过去形和动作连接。","ko-KR":"날짜 읽기, 시간 조사, 과거형과 동작 연결을 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"填写5月3日的韩文读法、时间助词、三个过去形和连接词尾。","ko-KR":"5월 3일의 한글 읽기, 시간 조사, 세 과거형과 연결 어미를 쓰세요."},"options":[],"config":{"inputMode":"text","normalize":"NFC","items":[{"id":"date_reading","label":"5월 3일 →","placeholder":"한글로 쓰세요"},{"id":"time_particle","label":"토요일___ 친구를 만났어요.","placeholder":"조사"},{"id":"meet_past","label":"만나다 →","placeholder":"과거형"},{"id":"see_past","label":"보다 →","placeholder":"과거형"},{"id":"study_past","label":"공부하다 →","placeholder":"과거형"},{"id":"connector","label":"밥을 먹___ 영화를 봤어요.","placeholder":"연결 표현"}]},"answer":{"kind":"text_array","value":["오월 삼일","에","만났어요","봤어요","공부했어요","고"]},"explanation":{"correct":{"zh-CN":"六项依次是오월 삼일、에、만났어요、봤어요、공부했어요、고。","ko-KR":"정답은 오월 삼일, 에, 만났어요, 봤어요, 공부했어요, 고입니다."},"feedback":[{"zh-CN":"先判断每空属于日期、助词、过去形还是连接。","ko-KR":"날짜, 조사, 과거형과 연결을 먼저 구분하세요."},{"zh-CN":"检查数字读法、时间에、缩约、하다和词干加고。","ko-KR":"숫자 읽기, 시간 에, 줄임말, 하다와 어간+고를 확인하세요."},{"zh-CN":"答案依次为오월 삼일、에、만났어요、봤어요、공부했어요、고。","ko-KR":"정답을 모두 다시 쓰세요."}]}},
    {"nodeCode":"weekend-story-lab","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"把五个完整语块排成自然的周末问答与叙述。","ko-KR":"다섯 개의 완전한 말덩이를 자연스러운 주말 문답과 이야기 순서로 배열하세요."},"instruction":{"zh-CN":"按“提问—时间人物—地点—动作—感受”排序。","ko-KR":"질문—시간과 사람—장소—동작—느낌 순서로 옮기세요."},"options":["정말 재미있었어요.","학교 앞에서 만났어요.","주말에 뭐 했어요?","같이 밥을 먹고 영화를 봤어요.","토요일에 친구를 만났어요."],"config":{"shuffle":false},"answer":{"kind":"order","value":[2,4,1,3,0]},"explanation":{"correct":{"zh-CN":"自然顺序是提问、时间人物、地点、动作、感受。","ko-KR":"자연스러운 순서는 질문, 시간과 사람, 장소, 동작, 느낌입니다."},"feedback":[{"zh-CN":"先找唯一问句和感受结束句。","ko-KR":"유일한 질문과 느낌 마무리를 찾으세요."},{"zh-CN":"中间先说何时见谁，再说地点和两个动作。","ko-KR":"중간에는 시간과 사람, 장소, 두 동작을 놓으세요."},{"zh-CN":"正确顺序是주말에 뭐 했어요?到정말 재미있었어요.。","ko-KR":"질문으로 시작해 정말 재미있었어요로 마칩니다."}]}},
    {"nodeCode":"monday-weekend-talk","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景的地点信息？","ko-KR":"두 장면의 장소 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“主场景见朋友的地点／第二场景下午去的地点”的正确组合。","ko-KR":"주 장면에서 만난 곳과 두 번째 장면에서 오후에 간 곳의 조합을 고르세요."},"options":["학교 앞／공원","식당／도서관","영화관／집","공원／학교 앞"],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"主场景在学校门口见面，第二场景下午去公园。","ko-KR":"주 장면은 학교 앞, 두 번째 장면의 오후 장소는 공원입니다."},"feedback":[{"zh-CN":"分别找含만났어요和오후에 ... 갔어요的台词。","ko-KR":"만났어요와 오후에 ... 갔어요가 있는 대사를 찾으세요."},{"zh-CN":"主场景是学校门口，第二场景离开家去了公园。","ko-KR":"주 장면은 학교 앞이고 두 번째 장면은 공원입니다."},{"zh-CN":"正确组合是학교 앞／공원。","ko-KR":"정답은 학교 앞／공원입니다."}]}},
    {"nodeCode":"monday-weekend-talk","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"对方问영화가 어땠어요?，根据主场景怎样回答最自然？","ko-KR":"상대가 영화가 어땠어요?라고 물었습니다. 주 장면에 맞는 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择回答电影感受并使用礼貌体过去表达的一句。","ko-KR":"영화 느낌을 과거의 공손한 표현으로 답한 문장을 고르세요."},"options":["정말 재미있었어요.","토요일에 만났어요.","공원에 갔어요.","영화를 봐요."],"config":{"shuffle":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"정말 재미있었어요.直接回答过去的电影感受。","ko-KR":"정말 재미있었어요.는 영화의 과거 느낌을 답합니다."},"feedback":[{"zh-CN":"先判断问题是在问感受。","ko-KR":"질문이 느낌을 묻는지 확인하세요."},{"zh-CN":"寻找带过去词尾的有趣评价。","ko-KR":"과거형으로 재미를 말한 문장을 찾으세요."},{"zh-CN":"正确答案是정말 재미있었어요.。","ko-KR":"정답은 정말 재미있었어요.입니다."}]}},
    {"nodeCode":"listen-and-tell","key":"listening-afternoon","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听周末经历，判断秀珍下午做了什么。","ko-KR":"주말 경험을 듣고 수진이 오후에 무엇을 했는지 고르세요."},"instruction":{"zh-CN":"正常语速最多听两遍，慢速最多听一遍；只依据오후에后的音频原话作答。","ko-KR":"보통 속도 두 번, 느린 속도 한 번 듣고 오후에 뒤의 음성에 근거해 답하세요."},"options":["친구를 만나고 영화를 봤어요.","도서관에서 공부했어요.","집에서 쉬었어요.","공원에서 산책했어요."],"config":{"audioId":"chapter-05-listening-afternoon","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":false},"answer":{"kind":"index","value":0},"transcript":"수진은 지난 토요일에 바빴어요. 오전에 도서관에서 공부했어요. 오후에 친구를 만나고 영화를 봤어요. 영화가 재미있었어요.","audioObjectKey":"korean-level-one/chapter-05/listening/chapter-05-listening-afternoon.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"下午见了朋友并看了电影。","ko-KR":"오후에는 친구를 만나고 영화를 봤습니다."},"feedback":[{"zh-CN":"先找오전和오후的分界。","ko-KR":"오전과 오후의 경계를 찾으세요."},{"zh-CN":"图书馆学习在上午；下午有两个用-고连接的动作。","ko-KR":"도서관 공부는 오전이고 오후에는 -고로 연결된 두 동작이 있습니다."},{"zh-CN":"答案是친구를 만나고 영화를 봤어요.。","ko-KR":"정답은 친구를 만나고 영화를 봤어요.입니다."}],"privateListening":{"slowScript":"수진은 지난 토요일에 바빴어요. / 오전에 도서관에서 공부했어요. / 오후에 친구를 만나고 영화를 봤어요. / 영화가 재미있었어요.","pauseMarks":"수진은 지난 토요일에 바빴어요. ⏸ 오전에 도서관에서 공부했어요. ⏸ 오후에 친구를 만나고 영화를 봤어요. ⏸ 영화가 재미있었어요.","distractorReasons":{"1":"도서관 공부는 오전 활동입니다.","2":"원문에는 집에서 쉬었다는 말이 없습니다.","3":"원문에는 공원이나 산책이 없습니다."}}}},
    {"nodeCode":"listen-and-tell","key":"speaking-weekend-story","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成约45秒、6—8句的单人周末经历叙述。","ko-KR":"주말 경험을 약 45초 동안 6~8문장으로 이야기하세요."},"instruction":{"zh-CN":"加入日期或星期、人物或地点、三个过去动作、一次-고和一个过去感受。","ko-KR":"날짜나 요일, 사람이나 장소, 세 과거 동작, 한 번 이상의 -고와 과거 느낌을 넣으세요."},"options":[],"config":{"minimumSeconds":40,"maximumSeconds":55,"minimumTurns":6,"maximumTurns":8,"requiredCriteria":5,"enforceCompletionRequirements":true,"pronunciationScore":false,"turnLabel":{"zh-CN":"句数","ko-KR":"문장 수"},"criteria":["一个数字日期或星期","见了谁或去了哪里","至少三个过去动作","至少一次-고","一个过去感受"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与五类自查；不产生正确性或分数，等待人工复核。","ko-KR":"녹음 정보와 다섯 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查6—8句、时间、人物或地点和三个动作。","ko-KR":"6~8문장, 시간, 사람이나 장소와 세 동작을 확인하세요."},{"zh-CN":"再检查过去词尾、至少一次-고和过去感受。","ko-KR":"과거형, -고와 과거 느낌을 확인하세요."},{"zh-CN":"按五项清单补齐后重录；不显示虚假发音准确率。","ko-KR":"다섯 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
    {"nodeCode":"weekend-diary","key":"reading-weekend-diary","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读周末日记，完成星期、同行者和公园活动三题。","ko-KR":"주말 일기를 읽고 요일, 함께 간 사람과 공원 활동 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；依据日记原句作答。","ko-KR":"문제마다 하나를 고르고 일기 문장에서 근거를 찾으세요."},"options":[],"config":{"reading":"오월 사일은 일요일이었어요.\n가족하고 공원에 갔어요.\n공원에서 점심을 먹고 사진을 찍었어요.\n날씨가 좋았어요. 정말 즐거웠어요.","items":[{"id":"weekday","question":"오월 사일은 무슨 요일이었어요?","options":["일요일","토요일","월요일","금요일"]},{"id":"companion","question":"누구하고 공원에 갔어요?","options":["가족","친구","선생님","혼자"]},{"id":"activities","question":"공원에서 무엇을 했어요?","options":["점심을 먹고 사진을 찍었어요.","공부하고 영화를 봤어요.","친구를 만나고 쉬었어요.","산책하고 집에 갔어요."]}],"shuffle":false},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是일요일、가족、점심을 먹고 사진을 찍었어요.。","ko-KR":"정답은 일요일, 가족, 점심을 먹고 사진을 찍었어요.입니다."},"feedback":[{"zh-CN":"圈出日期星期、하고 공원에和连续动作的句子。","ko-KR":"날짜와 요일, 하고 공원에와 연속 동작 문장을 찾으세요."},{"zh-CN":"不要把其他对话或听力信息带入日记。","ko-KR":"다른 대화나 듣기 정보를 일기에 섞지 마세요."},{"zh-CN":"答案是일요일、가족、점심을 먹고 사진을 찍었어요.。","ko-KR":"일기 원문에서 세 답을 다시 확인하세요."}]}},
    {"nodeCode":"weekend-diary","key":"write-weekend-diary","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给同班同学写一篇4—5句的原创周末四格日记。","ko-KR":"같은 반 친구에게 보여 줄 새로운 주말 네 칸 일기를 4~5문장으로 쓰세요."},"instruction":{"zh-CN":"写日期或星期、人物或地点、三个过去动作、一次-고和一个过去感受，并完成量规自查。","ko-KR":"날짜나 요일, 사람이나 장소, 세 과거 동작, -고와 과거 느낌을 쓰고 자기 점검을 하세요."},"options":[],"config":{"minSentences":4,"maxSentences":5,"minimumHangulCharacters":30,"minimumPhraseGroups":2,"minimumInformationKinds":5,"requireCompletionChecklist":true,"requiredPhraseGroups":[["었어요","았어요","했어요","봤어요","갔어요","만났어요"],["고 "]],"informationChecklist":["一个数字日期或星期","人物或地点","至少三个过去动作","至少一次-고","一个过去感受"],"structureFrame":"___월 ___일은 ___요일이었어요.／___요일에 ___에 갔어요. → ___하고/와/과 함께 ___했어요. → ___고 ___았/었어요. → 정말 ___았/었어요.","rubric":["信息完整","核心语法","可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、五类信息与量规自查的日记；不产生正确性或分数。","ko-KR":"문장 수, 다섯 정보와 자기 점검을 갖춘 일기를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数五类信息和4—5句。","ko-KR":"다섯 정보와 4~5문장을 먼저 세세요."},{"zh-CN":"检查过去词尾、时间에和动作连接。","ko-KR":"과거형, 시간 에와 동작 연결을 확인하세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
    {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接帮助讲述过去周末经历的表达。","ko-KR":"지난 주말 경험을 이야기할 때 직접 사용할 수 있는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["토요일에 친구를 만났어요.","밥을 먹고 영화를 봤어요.","정말 재미있었어요.","연필 주세요."],"config":{"selection":"multiple","shuffle":false},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"A说明时间动作，B连接动作，C表达过去感受；D是物品请求。","ko-KR":"A는 시간과 동작, B는 동작 연결, C는 과거 느낌이며 D는 물건 요청입니다."},"feedback":[{"zh-CN":"按时间动作、动作连接和感受检查。","ko-KR":"시간과 동작, 연결과 느낌을 확인하세요."},{"zh-CN":"有一句属于物品请求。","ko-KR":"한 문장은 물건 요청입니다."},{"zh-CN":"正确集合是A、B、C。","ko-KR":"정답은 A, B, C입니다."}]}},
    {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do并确定复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do와 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"dateWeekday","label":"我能区分并说出日期和星期／날짜와 요일을 구별해 말할 수 있어요"},{"id":"timePast","label":"我能用时间에说过去动作／시간 에로 과거 행동을 말할 수 있어요"},{"id":"pastForms","label":"我能使用自然过去形／자연스러운 과거형을 쓸 수 있어요"},{"id":"diary","label":"我能用-고写4—5句日记／-고로 4~5문장 일기를 쓸 수 있어요"},{"id":"story","label":"我能完成约45秒的周末叙述／약 45초 주말 경험을 말할 수 있어요"}],"returnNodes":[{"value":"weekend-words","label":"词汇"},{"value":"past-time-tools","label":"日期／语法"},{"value":"monday-weekend-talk","label":"对话理解"},{"value":"listen-and-tell","label":"听说"},{"value":"weekend-diary","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 저장했으며 다른 증거를 대신하지 않고 점수도 만들지 않습니다."},"feedback":[{"zh-CN":"逐项回想日期星期、时间、过去形、读写和录音。","ko-KR":"날짜와 요일, 시간, 과거형, 읽기·쓰기와 녹음을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=activity_seed->>'nodeCode';
    if node_uuid is null then
      raise exception 'Cannot convert chapter 05 activity %: node % was not found', activity_seed->>'key', activity_seed->>'nodeCode';
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
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where activity.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-afternoon',
      'speaking-weekend-story','reading-weekend-diary','write-weekend-diary',
      'review-multiple','self-check'
    );

  for media_seed in select value from jsonb_array_elements($images$
  [
    {"nodeCode":"mission-map","key":"chapter-05-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-05/images/chapter-05-01-scene.png","alt":{"zh-CN":"学校食堂里两名成年学生看周末照片交谈。","ko-KR":"학교 식당에서 두 성인 학생이 주말 사진을 보며 이야기합니다."},"width":1600,"height":900},
    {"nodeCode":"weekend-words","key":"chapter-05-image-02","purpose":"核心词汇周末活动卡","objectKey":"korean-level-one/chapter-05/images/chapter-05-02-vocabulary.png","alt":{"zh-CN":"七种周末活动与地点情境卡。","ko-KR":"일곱 가지 주말 활동과 장소 카드입니다."},"width":1200,"height":900},
    {"nodeCode":"past-time-tools","key":"chapter-05-image-03","purpose":"日期时间过去连接语法总图","objectKey":"korean-level-one/chapter-05/images/chapter-05-03-grammar-overview.png","alt":{"zh-CN":"日期、时间助词、过去词尾与动作连接总流程。","ko-KR":"날짜, 시간 조사, 과거 어미와 동작 연결 흐름입니다."},"width":1600,"height":900},
    {"nodeCode":"past-time-tools","key":"chapter-05-image-04","purpose":"日期星期结构图","objectKey":"korean-level-one/chapter-05/images/chapter-05-03a-date-weekday.png","alt":{"zh-CN":"月日读法与星期对照日历。","ko-KR":"월일 읽기와 요일을 비교하는 달력입니다."},"width":1200,"height":900},
    {"nodeCode":"past-time-tools","key":"chapter-05-image-05","purpose":"时间에结构图","objectKey":"korean-level-one/chapter-05/images/chapter-05-03b-time-e.png","alt":{"zh-CN":"时间词加에与常见例外分流。","ko-KR":"시간 말 뒤의 에와 예외를 나눈 그림입니다."},"width":1200,"height":900},
    {"nodeCode":"past-time-tools","key":"chapter-05-image-06","purpose":"过去时结构图","objectKey":"korean-level-one/chapter-05/images/chapter-05-03c-past.png","alt":{"zh-CN":"词干元音分流到았어요、었어요与했어요。","ko-KR":"어간 모음에 따라 았어요, 었어요와 했어요로 나뉩니다."},"width":1200,"height":900},
    {"nodeCode":"past-time-tools","key":"chapter-05-image-07","purpose":"动词고结构图","objectKey":"korean-level-one/chapter-05/images/chapter-05-03d-verb-go.png","alt":{"zh-CN":"第一个动词词干加고后连接末句过去形。","ko-KR":"첫 동사 어간에 고를 붙여 마지막 과거형과 연결합니다."},"width":1200,"height":900},
    {"nodeCode":"weekend-story-lab","key":"chapter-05-image-08","purpose":"句型故事语块卡","objectKey":"korean-level-one/chapter-05/images/chapter-05-04-pattern-blocks.png","alt":{"zh-CN":"五张完整周末故事语块卡。","ko-KR":"다섯 장의 완전한 주말 이야기 카드입니다."},"width":1200,"height":900},
    {"nodeCode":"monday-weekend-talk","key":"chapter-05-image-09","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-05/images/chapter-05-05-dialogue.png","alt":{"zh-CN":"学校食堂与学生休息区两组周末对话人物。","ko-KR":"학교 식당과 학생 휴게실의 두 주말 대화 장면입니다."},"width":1600,"height":900},
    {"nodeCode":"listen-and-tell","key":"chapter-05-image-10","purpose":"听力上午下午信息图","objectKey":"korean-level-one/chapter-05/images/chapter-05-06-listening-timeline.png","alt":{"zh-CN":"上午与下午时间线和四张无文字活动卡。","ko-KR":"오전과 오후 시간선 및 글자 없는 네 활동 카드입니다."},"width":1200,"height":900},
    {"nodeCode":"weekend-diary","key":"chapter-05-image-11","purpose":"周末四格日记版式","objectKey":"korean-level-one/chapter-05/images/chapter-05-07-diary.png","alt":{"zh-CN":"预留日期、人物地点、动作与感受的四格日记。","ko-KR":"날짜, 사람과 장소, 동작과 느낌 칸이 있는 일기입니다."},"width":1200,"height":1600},
    {"nodeCode":"can-do-check","key":"chapter-05-image-12","purpose":"最终周末故事流程图","objectKey":"korean-level-one/chapter-05/images/chapter-05-08-final-task.png","alt":{"zh-CN":"45秒周末故事的五类信息与提交检查流程。","ko-KR":"45초 주말 이야기의 다섯 정보와 제출 점검 흐름입니다."},"width":1600,"height":900}
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
  where module.chapter_id=chapter_uuid and node.node_code='weekend-words';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,'chapter-05-vocabulary-'||lpad(item.ordinality::text,2,'0'),'audio','词汇原形点读',
    'korean-level-one/chapter-05/audio/vocabulary/chapter-05-vocabulary-'||lpad(item.ordinality::text,2,'0')||'.mp3',
    'pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId','chapter-05-vocabulary-'||lpad(item.ordinality::text,2,'0'),'script',item.value->>'word')
  from jsonb_array_elements($vocabulary$
    [{"word":"주말","collocation":"주말에 뭐 했어요?"},{"word":"월요일","collocation":"월요일 점심시간"},{"word":"토요일","collocation":"토요일에 친구를 만났어요."},{"word":"일요일","collocation":"일요일에 집에서 쉬었어요."},{"word":"오전","collocation":"오전에 공부했어요."},{"word":"오후","collocation":"오후에 공원에 갔어요."},{"word":"사진","collocation":"사진을 찍었어요."},{"word":"친구","collocation":"친구를 만났어요."},{"word":"영화","collocation":"영화를 봤어요."},{"word":"공원","collocation":"공원에 갔어요."},{"word":"도서관","collocation":"도서관에서 공부했어요."},{"word":"만나다","collocation":"친구를 만났어요."},{"word":"가다","collocation":"공원에 갔어요."},{"word":"보다","collocation":"영화를 봤어요."},{"word":"먹다","collocation":"밥을 먹었어요."},{"word":"공부하다","collocation":"도서관에서 공부했어요."},{"word":"쉬다","collocation":"집에서 쉬었어요."},{"word":"산책하다","collocation":"공원에서 산책했어요."},{"word":"찍다","collocation":"사진을 찍었어요."},{"word":"재미있다","collocation":"정말 재미있었어요."}]
  $vocabulary$::jsonb) with ordinality item(value,ordinality)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,'chapter-05-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0'),'audio','词汇搭配例句点读',
    'korean-level-one/chapter-05/audio/vocabulary/chapter-05-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0')||'.mp3',
    'pending','{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId','chapter-05-vocabulary-collocation-'||lpad(item.ordinality::text,2,'0'),'script',item.value->>'collocation')
  from jsonb_array_elements($vocabulary$
    [{"word":"주말","collocation":"주말에 뭐 했어요?"},{"word":"월요일","collocation":"월요일 점심시간"},{"word":"토요일","collocation":"토요일에 친구를 만났어요."},{"word":"일요일","collocation":"일요일에 집에서 쉬었어요."},{"word":"오전","collocation":"오전에 공부했어요."},{"word":"오후","collocation":"오후에 공원에 갔어요."},{"word":"사진","collocation":"사진을 찍었어요."},{"word":"친구","collocation":"친구를 만났어요."},{"word":"영화","collocation":"영화를 봤어요."},{"word":"공원","collocation":"공원에 갔어요."},{"word":"도서관","collocation":"도서관에서 공부했어요."},{"word":"만나다","collocation":"친구를 만났어요."},{"word":"가다","collocation":"공원에 갔어요."},{"word":"보다","collocation":"영화를 봤어요."},{"word":"먹다","collocation":"밥을 먹었어요."},{"word":"공부하다","collocation":"도서관에서 공부했어요."},{"word":"쉬다","collocation":"집에서 쉬었어요."},{"word":"산책하다","collocation":"공원에서 산책했어요."},{"word":"찍다","collocation":"사진을 찍었어요."},{"word":"재미있다","collocation":"정말 재미있었어요."}]
  $vocabulary$::jsonb) with ordinality item(value,ordinality)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='past-time-tools';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,item.value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-05/audio/grammar/'||(item.value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId',item.value->>'id','script',item.value->>'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-05-grammar-01-example-01","script":"오월 삼일은 토요일이에요."},{"id":"chapter-05-grammar-01-example-02","script":"네, 맞아요. 오월 삼일은 토요일이었어요."},{"id":"chapter-05-grammar-01-example-03","script":"오월 사일은 일요일이었어요."},{"id":"chapter-05-grammar-02-example-01","script":"토요일에 친구를 만났어요."},{"id":"chapter-05-grammar-02-example-02","script":"일요일에 집에서 쉬었어요."},{"id":"chapter-05-grammar-02-example-03","script":"오후에 친구를 만나고 영화를 봤어요."},{"id":"chapter-05-grammar-03-example-01","script":"영화를 봤어요."},{"id":"chapter-05-grammar-03-example-02","script":"토요일에 친구를 만났어요."},{"id":"chapter-05-grammar-03-example-03","script":"날씨가 좋았어요."},{"id":"chapter-05-grammar-04-example-01","script":"밥을 먹고 영화를 봤어요."},{"id":"chapter-05-grammar-04-example-02","script":"같이 밥을 먹고 영화를 봤어요."},{"id":"chapter-05-grammar-04-example-03","script":"공원에서 점심을 먹고 사진을 찍었어요."}]
  $grammar$::jsonb) item(value)
  on conflict (node_id,asset_key) do update set object_key=excluded.object_key,production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='monday-weekend-talk';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,item.value->>'id','audio',item.value->>'purpose',
    'korean-level-one/chapter-05/audio/dialogue/'||(item.value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,item.value-'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-05-dialogue-main-line-01","purpose":"主对话逐句","script":"주말에 뭐 했어요?","speaker":"F01／지수"},{"id":"chapter-05-dialogue-main-line-02","purpose":"主对话逐句","script":"토요일에 친구를 만났어요.","speaker":"M01／민수"},{"id":"chapter-05-dialogue-main-line-03","purpose":"主对话逐句","script":"아, 오월 삼일에 만났어요?","speaker":"F01／지수"},{"id":"chapter-05-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 맞아요. 오월 삼일은 토요일이었어요.","speaker":"M01／민수"},{"id":"chapter-05-dialogue-main-line-05","purpose":"主对话逐句","script":"어디에서 만났어요?","speaker":"F01／지수"},{"id":"chapter-05-dialogue-main-line-06","purpose":"主对话逐句","script":"학교 앞에서 만났어요. 같이 밥을 먹고 영화를 봤어요.","speaker":"M01／민수"},{"id":"chapter-05-dialogue-main-line-07","purpose":"主对话逐句","script":"영화가 어땠어요?","speaker":"F01／지수"},{"id":"chapter-05-dialogue-main-line-08","purpose":"主对话逐句","script":"정말 재미있었어요.","speaker":"M01／민수"},{"id":"chapter-05-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},{"id":"chapter-05-dialogue-alt-line-01","purpose":"第二对话逐句","script":"일요일에 뭐 했어요?","speaker":"F02／소라"},{"id":"chapter-05-dialogue-alt-line-02","purpose":"第二对话逐句","script":"일요일에 집에서 쉬었어요.","speaker":"M02／준호"},{"id":"chapter-05-dialogue-alt-line-03","purpose":"第二对话逐句","script":"하루 종일 집에 있었어요?","speaker":"F02／소라"},{"id":"chapter-05-dialogue-alt-line-04","purpose":"第二对话逐句","script":"아니요. 오후에 공원에 갔어요.","speaker":"M02／준호"},{"id":"chapter-05-dialogue-alt-line-05","purpose":"第二对话逐句","script":"공원에서 뭐 했어요?","speaker":"F02／소라"},{"id":"chapter-05-dialogue-alt-line-06","purpose":"第二对话逐句","script":"산책하고 사진을 찍었어요.","speaker":"M02／준호"},{"id":"chapter-05-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／M02"}]
  $dialogue$::jsonb) item(value)
  on conflict (node_id,asset_key) do update set purpose=excluded.purpose,object_key=excluded.object_key,
    production_status='pending',metadata=excluded.metadata,updated_at=now();

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and node.node_code='listen-and-tell'
    and activity.activity_key='listening-afternoon';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-05-listening-afternoon-normal','audio','私有听力正常语速','korean-level-one/chapter-05/listening/chapter-05-listening-afternoon-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"normal"}'::jsonb),
    (node_uuid,activity_uuid,'chapter-05-listening-afternoon-slow','audio','私有听力慢速','korean-level-one/chapter-05/listening/chapter-05-listening-afternoon-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"slow"}'::jsonb)
  on conflict (node_id,asset_key) do update set activity_id=excluded.activity_id,purpose=excluded.purpose,
    object_key=excluded.object_key,production_status='pending',alt_text=excluded.alt_text,metadata=excluded.metadata,updated_at=now();
end;
$seed$;

commit;
