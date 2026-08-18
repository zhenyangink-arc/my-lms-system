begin;

-- Converted from the read-only UPLY BOOK chapter-eight master.
-- source_sha256: b3fbbc639b8aa8880301f59e53ede19983364abf2ceec83595aac6898aeb44c0
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are historical values explicitly
-- recorded by the master and remain pending platform verification.

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
  vocabulary_seed record;
begin
  select version.id into version_uuid
  from public.digital_textbook_versions as version
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
  order by version.version_number desc
  limit 1;

  if version_uuid is null then
    raise exception 'Cannot convert chapter 08: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 08: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-08'
  limit 1;

  if test_uuid is null then
    select id into test_uuid
    from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 8
    limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000008'::uuid,
      lesson_uuid, 'korean-level-one-08', 'korean-level-one', 8,
      '第 08 章测试：天气怎么样？', '제08과 평가: 날씨가 어때요?',
      '检查季节与天气词汇、ㅂ不规则、-고/-지만、正式体以及天气播报信息理解。',
      12, 60,
      '{"recognition":"季节、时段与天气词汇","structure":"天气语法工具","reading":"对话与天气公告理解","assembly":"城市天气播报组织"}'::jsonb,
      1, 'draft', '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid,
      slug = 'korean-level-one-08',
      course_key = 'korean-level-one',
      chapter_number = 8,
      title = '第 08 章测试：天气怎么样？',
      korean_title = '제08과 평가: 날씨가 어때요?',
      description = '检查季节与天气词汇、ㅂ不规则、-고/-지만、正式体以及天气播报信息理解。',
      duration_minutes = 12,
      passing_score = 60,
      skills = '{"recognition":"季节、时段与天气词汇","structure":"天气语法工具","reading":"对话与天气公告理解","assembly":"城市天气播报组织"}'::jsonb,
      version = 1,
      status = 'draft',
      student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
      updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id = test_uuid and question_key not in (
    'golden-07-01','golden-07-02','golden-07-03','golden-07-04',
    'golden-07-05','golden-07-06','golden-07-07','golden-07-08',
    'golden-07-09','golden-07-10','golden-07-11','golden-07-12'
  );
  update public.chapter_test_questions
  set sort_order = sort_order + 100, updated_at = now()
  where test_id = test_uuid;

  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation, skill,
    sort_order, question_type, default_points, difficulty, tags, status, version,
    is_chapter_test_item, ebook_section_step, ebook_page_reference
  ) values
    (test_uuid,'golden-07-01','“우산”是什么意思？','["雨伞","外套","风","雪"]',0,'우산是雨伞，母本搭配为우산을 준비하세요。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-07-02','“덥다”的日常礼貌体是哪一项？','["더워요","덥어요","더우요","덥습니다"]',0,'덥다在元音起始词尾前ㅂ脱落并形成더워요。','structure',2,'single_choice',10,'foundation','["ㅂ不规则","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-07-03','哪一句正确使用“-지만”表达昼夜反差？','["낮에는 덥지만 밤에는 시원해요.","낮에는 더워지만 밤에는 시원해요.","낮에는 덥고지만 밤에는 시원해요.","낮에는 덥지만고 밤에는 시원해요."]',0,'-지만直接接词干덥-，辅音词尾前保留ㅂ。','structure',3,'single_choice',10,'foundation','["转折","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-07-04','“오다”的正式播报体是哪一项？','["옵니다","오습니다","와요","오ㅂ니다"]',0,'오-无收音，接-ㅂ니다写作옵니다。','structure',4,'single_choice',10,'foundation','["正式体","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-07-05','把“晴朗”和“温暖”作为相加信息连接时，哪一句正确？','["맑고 따뜻해요.","맑지만 따뜻해요.","맑아고 따뜻해요.","맑습니다고 따뜻해요."]',0,'相加天气状态用词干加-고。','structure',5,'single_choice',10,'foundation','["天气-고","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-07-06','主场景中夜间天气怎样？','["凉快但下雨","炎热并刮风","阴天但温暖","下雪并寒冷"]',0,'主场景第6轮说밤에는 시원하지만 비가 와요。','reading',6,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-07-07','第二场景中为什么要带外套？','["夜间寒冷","上午下雨","下午下雪","白天刮大风"]',0,'第二场景明确说明밤에는 추워요并据此建议带外套。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.2"]','draft',1,true,'STEP 05','母本 §6.2'),
    (test_uuid,'golden-07-08','私有听力播报中，明天下午天气怎样？','["下雨","晴朗","下雪","炎热"]',0,'听力第四句明确播报明天下午有雨。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-07-09','周末天气公告中，星期六釜山天气怎样？','["晴朗而温暖","阴冷","下雨","下雪"]',0,'公告第二行写明토요일 부산은 맑고 따뜻합니다。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-07-10','周末天气公告建议准备什么？','["雨伞","外套","帽子","手套"]',0,'公告末句明确写우산을 준비하세요。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-07-11','城市天气播报的自然顺序是哪一项？','["城市季节→今天总体→时段反差→明天预报→准备建议","准备建议→明天预报→城市季节→今天总体→时段反差","明天预报→准备建议→时段反差→城市季节→今天总体","时段反差→城市季节→准备建议→今天总体→明天预报"]',0,'母本最终输出按季节、今天、时段变化、明天和建议推进。','assembly',11,'single_choice',10,'medium','["播报组织","母本§3.4"]','draft',1,true,'STEP 08','母本 §3.4'),
    (test_uuid,'golden-07-12','课末城市天气播报必须满足哪一项？','["50—70秒、7—9句、五类信息齐全且主体用正式体","只说一个天气词","必须获得自动发音分数","写4句话即可，无需录音"]',0,'母本规定50—70秒、7—9句、五类信息和主体正式体，当前不做发音自动评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2')
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
  where version_id = version_uuid and (chapter_number = 8 or slug = 'movie-plan')
  order by (slug = 'movie-plan') desc
  limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal,
      status, production_status, editorial_status, native_review_status,
      audio_status, image_status, source_revision
    ) values (
      version_uuid, test_uuid, 'movie-plan', 8,
      '{"zh-CN":"天气怎么样？","ko-KR":"날씨가 어때요?"}'::jsonb,
      '{"zh-CN":"智敏和俊浩查看当天分时天气决定是否带伞；素拉和敏秀查看次日预报决定是否带外套。","ko-KR":"지민과 준호는 오늘의 시간대별 날씨를 보고 우산을 준비할지 정하고 소라와 민수는 내일 예보를 보고 겉옷을 준비할지 정합니다."}'::jsonb,
      '{"zh-CN":"使用ㅂ不规则、天气状态-고、转折-지만和正式体，完成50—70秒、7—9句的城市天气播报。","ko-KR":"ㅂ 불규칙, 날씨 상태 -고, 대조 -지만과 격식체를 사용하여 50~70초, 7~9문장의 도시 날씨 안내를 합니다."}'::jsonb,
      'draft', 'editorial_review', 'pending', 'pending', 'pending', 'pending',
      'UPLY BOOK 第08课 영화 볼까요.md @ 2026-08-18 / sha256:4104c3438ebb9b4f892396002a5c91965a8a9b09f7bf504aba6c4a92b670a52c'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id = test_uuid,
      slug = 'movie-plan',
      chapter_number = 8,
      title = '{"zh-CN":"天气怎么样？","ko-KR":"날씨가 어때요?"}'::jsonb,
      scenario = '{"zh-CN":"智敏和俊浩查看当天分时天气决定是否带伞；素拉和敏秀查看次日预报决定是否带外套。","ko-KR":"지민과 준호는 오늘의 시간대별 날씨를 보고 우산을 준비할지 정하고 소라와 민수는 내일 예보를 보고 겉옷을 준비할지 정합니다."}'::jsonb,
      goal = '{"zh-CN":"使用ㅂ不规则、天气状态-고、转折-지만和正式体，完成50—70秒、7—9句的城市天气播报。","ko-KR":"ㅂ 불규칙, 날씨 상태 -고, 대조 -지만과 격식체를 사용하여 50~70초, 7~9문장의 도시 날씨 안내를 합니다."}'::jsonb,
      status = 'draft',
      production_status = 'editorial_review',
      editorial_status = 'pending',
      native_review_status = 'pending',
      audio_status = 'pending',
      image_status = 'pending',
      source_revision = 'UPLY BOOK 第08课 영화 볼까요.md @ 2026-08-18 / sha256:4104c3438ebb9b4f892396002a5c91965a8a9b09f7bf504aba6c4a92b670a52c',
      updated_at = now()
    where id = chapter_uuid;
  end if;

  for module_seed in
    select value from jsonb_array_elements($modules$
    [
      {
        "code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,
        "nodeCode":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},
        "description":{"zh-CN":"先确认购物交易中询价、数量、追加、总价和付款的顺序。","ko-KR":"쇼핑에서 가격, 수량, 추가, 전체 금액과 계산 순서를 확인합니다."},
        "nodeTitle":{"zh-CN":"买东西时要问清什么？","ko-KR":"물건을 살 때 무엇을 확인해야 할까요?"},
        "content":{"lead":{"zh-CN":"真实购物不只要会问多少钱，还要让店员听清数量、追加商品并确认总价。","ko-KR":"실제 쇼핑에서는 가격뿐 아니라 수량, 추가 상품과 전체 금액도 분명히 확인해야 합니다."},"targets":[{"ko":"사과가 얼마예요?","zh":"询问商品价格"},{"ko":"사과 세 개 주세요.","zh":"说明购买数量"},{"ko":"바나나도 두 개 주세요.","zh":"追加商品"},{"ko":"모두 얼마예요?","zh":"询问总价"}],"finalOutput":{"zh-CN":"35—50秒、不少于8轮的双角色购物交易，包含母本规定的九类信息。","ko-KR":"원고의 아홉 정보를 포함한 35~50초, 8턴 이상의 두 역할 쇼핑 대화입니다."},"coach":{"zh-CN":"本节点只以答对不计分场景诊断为强制证据；交易流程复述为自主展示。","ko-KR":"점수 없는 장면 진단 정답만 필수이며 거래 흐름 설명은 자율 활동입니다."},"nextNode":"activity-words"}
      },
      {
        "code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,
        "nodeCode":"activity-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},
        "description":{"zh-CN":"把22个商品、数量、价格和评价词与常用搭配一起记。","ko-KR":"상품, 수량, 가격과 평가 어휘 22개를 결합과 함께 익힙니다."},
        "nodeTitle":{"zh-CN":"把商品、数量、价格和评价配成块","ko-KR":"상품, 수량, 가격과 평가를 말덩이로 익히기"},
        "content":{"lead":{"zh-CN":"按看图认商品、点读原形、跟读数量或价格搭配、按实际位置再认的顺序学习；音频全部待制作。","ko-KR":"그림으로 상품을 확인하고 기본형과 수량·가격 결합을 읽은 뒤 실제 문맥에서 다시 익힙니다. 음원은 모두 제작 대기 중입니다."},"vocabulary":[
          {"ko":"가격","zh":"价格","pos":"名词","collocation":"상품 가격"},{"ko":"얼마","zh":"多少（价格）","pos":"疑问名词","collocation":"얼마예요?"},{"ko":"원","zh":"韩元","pos":"依存名词·货币单位","collocation":"천 원이에요."},{"ko":"모두","zh":"一共、全部","pos":"副词","collocation":"모두 얼마예요?"},{"ko":"사과","zh":"苹果","pos":"名词","collocation":"사과 세 개"},{"ko":"바나나","zh":"香蕉","pos":"名词","collocation":"바나나 두 개"},{"ko":"우유","zh":"牛奶","pos":"名词","collocation":"우유 한 병"},{"ko":"물","zh":"水","pos":"名词","collocation":"물 두 병"},{"ko":"우산","zh":"雨伞","pos":"名词","collocation":"우산이 커요."},{"ko":"가방","zh":"包","pos":"名词","collocation":"가방이 비싸요."},{"ko":"가게","zh":"商店","pos":"名词","collocation":"과일 가게"},{"ko":"손님","zh":"顾客","pos":"名词","collocation":"손님이 물어요."},{"ko":"직원","zh":"店员","pos":"名词","collocation":"가게 직원"},{"ko":"사다","zh":"买","pos":"动词","collocation":"사과를 사요."},{"ko":"고르다","zh":"挑选","pos":"动词","collocation":"여기에서 고르세요."},{"ko":"보다","zh":"看","pos":"动词","collocation":"한번 보세요."},{"ko":"싸다","zh":"便宜","pos":"形容词","collocation":"사과가 싸요."},{"ko":"비싸다","zh":"贵","pos":"形容词","collocation":"우산이 비싸요."},{"ko":"크다","zh":"大","pos":"形容词","collocation":"우산이 커요."},{"ko":"작다","zh":"小","pos":"形容词","collocation":"가방이 작아요."},{"ko":"개","zh":"个","pos":"依存名词·量词","collocation":"세 개"},{"ko":"병","zh":"瓶","pos":"依存名词·量词","collocation":"한 병"}
        ],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；22词点读、图片分量词和另说搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 어휘 듣기와 단위 분류는 자율 연습입니다."},"nextNode":"suggest-and-react"}
      },
      {
        "code":"grammar","order":3,"accent":"iris","type":"learn","minutes":17,
        "nodeCode":"suggest-and-react","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},
        "description":{"zh-CN":"用动作请求、固有词数量、形容词谓语和도完成购物。","ko-KR":"동작 요청, 고유어 수, 형용사 서술어와 도로 쇼핑 대화를 만듭니다."},
        "nodeTitle":{"zh-CN":"让数量、评价和追加都自然","ko-KR":"수량, 평가와 추가를 자연스럽게 말하기"},
        "content":{"lead":{"zh-CN":"先区分商品请求与动作请求，再把数量放到量词前，用形容词评价商品，最后用도追加。","ko-KR":"상품 요청과 동작 요청을 구별한 뒤 수량과 단위를 붙이고 형용사로 평가하며 도로 추가합니다."},"grammarCards":[
          {"form":"V-(으)세요","function":{"zh-CN":"礼貌请对方做动作。","ko-KR":"상대에게 동작을 공손하게 요청합니다."},"rules":["有收音且不是ㄹ的词干接으세요","无收音词干接세요","ㄹ收音脱落规则本课只要求辨认","去掉词典形다后连写"],"examples":[{"ko":"이 가방을 보세요.","zh":"请看看这个包。","audioId":"chapter-08-grammar-01-example-01","audioStatus":"pending"},{"ko":"네, 여기에서 고르세요.","zh":"好的，请从这里挑选。","audioId":"chapter-08-grammar-01-example-02","audioStatus":"pending"},{"ko":"한번 보세요.","zh":"请看一下。","audioId":"chapter-08-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：보다세요；应去掉다后写보세요。","ko-KR":"잘못: 보다세요. 다를 빼고 보세요라고 씁니다."},"comparison":{"zh-CN":"보세요要求做“看”的动作；우산 주세요请求得到商品。","ko-KR":"보세요는 보는 동작 요청이고 우산 주세요는 상품 요청입니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"固有词数量＋量词","function":{"zh-CN":"说清买几个、几瓶，并与韩元金额区分。","ko-KR":"몇 개나 몇 병을 사는지 말하고 원 단위 금액과 구별합니다."},"rules":["量词前用한、두、세、네","顺序为商品名词＋数量＋量词","一般物品用개，瓶装商品用병","金额使用汉字词数字＋원"],"examples":[{"ko":"사과 세 개 주세요.","zh":"请给我三个苹果。","audioId":"chapter-08-grammar-02-example-01","audioStatus":"pending"},{"ko":"사과 세 개 주세요.","zh":"请给我三个苹果。","audioId":"chapter-08-grammar-02-example-02","audioStatus":"pending"},{"ko":"민지는 사과 세 개를 사요.","zh":"敏智买三个苹果。","audioId":"chapter-08-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：사과 삼 개；一般商品数量在개前用세。","ko-KR":"잘못: 사과 삼 개. 개 앞에서는 세를 씁니다."},"comparison":{"zh-CN":"사과 세 개是数量；삼천 원是金额。","ko-KR":"사과 세 개는 수량이고 삼천 원은 금액입니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N이/가 A-아/어요","function":{"zh-CN":"用形容词在句末评价商品。","ko-KR":"형용사를 문장 끝에 써서 상품을 평가합니다."},"rules":["有收音名词后用이，无收音用가","形容词变礼貌体作谓语","커요本课整词认读","形容词谓语后不再加이에요/예요"],"examples":[{"ko":"이 사과가 싸요.","zh":"这个苹果便宜。","audioId":"chapter-08-grammar-03-example-01","audioStatus":"pending"},{"ko":"사과가 싸요.","zh":"苹果便宜。","audioId":"chapter-08-grammar-03-example-02","audioStatus":"pending"},{"ko":"이 우산이 커요.","zh":"这把雨伞大。","audioId":"chapter-08-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：비싸요예요；비싸요已经是完整谓语。","ko-KR":"잘못: 비싸요예요. 비싸요만으로 서술어가 완성됩니다."},"comparison":{"zh-CN":"가방이 비싸요是完整句；비싼 가방属于后续定语形式。","ko-KR":"가방이 비싸요는 완전한 문장이고 비싼 가방은 뒤 과정의 관형형입니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N도","function":{"zh-CN":"追加商品或同类信息。","ko-KR":"상품이나 같은 종류의 정보를 더합니다."},"rules":["도直接接名词","本课中替代主格或宾格助词","必须有可理解的前项","数量可放在도之后"],"examples":[{"ko":"우유도 한 병 주세요.","zh":"牛奶也请给我一瓶。","audioId":"chapter-08-grammar-04-example-01","audioStatus":"pending"},{"ko":"바나나도 두 개 주세요.","zh":"香蕉也请给我两个。","audioId":"chapter-08-grammar-04-example-02","audioStatus":"pending"},{"ko":"우유도 한 병 사요.","zh":"牛奶也买一瓶。","audioId":"chapter-08-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：우유를도；追加时도直接替代를。","ko-KR":"잘못: 우유를도. 추가할 때 도가 를을 대신합니다."},"comparison":{"zh-CN":"우유 한 병 주세요是首次提出；우유도 한 병 주세요表示追加。","ko-KR":"우유 한 병 주세요는 첫 요청이고 우유도 한 병 주세요는 추가 요청입니다."},"source":{"zh-CN":"母本§5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}
        ],"coach":{"zh-CN":"六项填空全部正确才完成；口头规则解释和扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"plan-builder"}
      },
      {
        "code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,
        "nodeCode":"plan-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},
        "description":{"zh-CN":"把询价、购买、追加和总价按信息逻辑连成交易。","ko-KR":"가격 질문, 구매, 추가와 전체 금액을 자연스러운 거래로 연결합니다."},
        "nodeTitle":{"zh-CN":"把六个话轮连成交易","ko-KR":"여섯 말차례를 거래로 연결하기"},
        "content":{"lead":{"zh-CN":"先练商品和价格、数量和量词、评价和追加三组替换，再排列六个完整话轮。","ko-KR":"상품과 가격, 수량과 단위, 평가와 추가를 바꿔 말한 뒤 여섯 말차례를 배열합니다."},"replacementSets":[["사과가 얼마예요? 한 개에 천 원이에요.","우유가 얼마예요? 한 병에 천오백 원이에요.","우산이 얼마예요? 칠천 원이에요."],["사과 세 개 주세요.","바나나 두 개 주세요.","우유 한 병 주세요.","물 네 병 주세요."],["사과가 싸요. 바나나도 두 개 주세요.","우산이 커요. 물도 한 병 주세요.","가방이 비싸요. 우유도 주세요."]],"orderItems":["모두 오천 원이에요.","사과 세 개 주세요.","사과가 얼마예요?","바나나도 두 개 주세요.","한 개에 천 원이에요.","모두 얼마예요?"],"personalFrames":["___이/가 얼마예요?","___ ___ 개/병 주세요.","___도 ___ 개/병 주세요."],"coach":{"zh-CN":"排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"weekend-plan-talk"}
      },
      {
        "code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":13,
        "nodeCode":"weekend-plan-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},
        "description":{"zh-CN":"从两组顾客和店员对话中抓住数量、单价、总价和商品选择。","ko-KR":"두 고객·직원 대화에서 수량, 단가, 전체 금액과 선택을 파악합니다."},
        "nodeTitle":{"zh-CN":"听清单价，也听清顾客追加了什么","ko-KR":"단가와 추가한 상품을 정확히 듣기"},
        "content":{"lead":{"zh-CN":"先整段默读，待音频制作后整段听，再逐句跟读、隐藏中文并切换角色。","ko-KR":"전체를 읽고 음원 제작 후 들은 뒤 문장별로 따라 읽고 역할을 바꿉니다."},"dialogueScenes":[
          {"title":{"zh-CN":"社区水果店","ko-KR":"동네 과일 가게"},"people":{"zh-CN":"敏智（顾客）与秀彬（店员）","ko-KR":"민지(손님)와 수빈(직원)"},"purpose":{"zh-CN":"询问苹果单价、购买和评价、追加香蕉、确认总价并付款。","ko-KR":"사과 단가를 묻고 구매·평가한 뒤 바나나를 더하고 전체 금액을 계산합니다."},"audioId":"chapter-08-dialogue-main","audioStatus":"pending","lines":[{"speaker":"민지","ko":"사과가 얼마예요?","zh":"苹果多少钱？"},{"speaker":"수빈","ko":"한 개에 천 원이에요.","zh":"一个1,000韩元。"},{"speaker":"민지","ko":"사과가 싸요. 사과 세 개 주세요.","zh":"苹果便宜。请给我三个。"},{"speaker":"수빈","ko":"네, 여기에서 고르세요.","zh":"好的，请从这里挑选。"},{"speaker":"민지","ko":"바나나도 두 개 주세요.","zh":"香蕉也请给我两个。"},{"speaker":"수빈","ko":"네, 바나나는 두 개에 이천 원이에요.","zh":"好的，香蕉两个2,000韩元。"},{"speaker":"민지","ko":"모두 얼마예요?","zh":"一共多少钱？"},{"speaker":"수빈","ko":"모두 오천 원이에요.","zh":"一共5,000韩元。"},{"speaker":"민지","ko":"네, 여기요.","zh":"好的，给您。"},{"speaker":"수빈","ko":"감사합니다.","zh":"谢谢。"}]},
          {"title":{"zh-CN":"便利店雨具货架","ko-KR":"편의점 우산 매대"},"people":{"zh-CN":"俊浩（顾客）与贤宇（店员）","ko-KR":"준호(손님)와 현우(직원)"},"purpose":{"zh-CN":"比较两把雨伞的价格和大小并选择7,000韩元的雨伞。","ko-KR":"우산 두 개의 가격과 크기를 비교하고 7천 원 우산을 고릅니다."},"audioId":"chapter-08-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"준호","ko":"이 우산이 얼마예요?","zh":"这把雨伞多少钱？"},{"speaker":"현우","ko":"만 원이에요.","zh":"10,000韩元。"},{"speaker":"준호","ko":"조금 비싸요. 저 우산도 만 원이에요?","zh":"有点贵。那把雨伞也是10,000韩元吗？"},{"speaker":"현우","ko":"아니요, 칠천 원이에요. 이 우산이 커요. 한번 보세요.","zh":"不是，7,000韩元。这把雨伞大。请看一下。"},{"speaker":"준호","ko":"네, 이 우산 주세요.","zh":"好的，请给我这把雨伞。"},{"speaker":"현우","ko":"네, 감사합니다.","zh":"好的，谢谢。"}]}
        ],"coach":{"zh-CN":"两场景价格事实题和付款回应题都答对才完成；替换和试录为自主练习。","ko-KR":"두 장면 가격 사실과 계산 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-invite"}
      },
      {
        "code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":13,
        "nodeCode":"listen-and-invite","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},
        "description":{"zh-CN":"听出购物总价，再提交35—50秒双角色交易录音。","ko-KR":"전체 금액을 듣고 35~50초 두 역할 거래 녹음을 제출합니다."},
        "nodeTitle":{"zh-CN":"听出总价，再完成自己的购物对话","ko-KR":"전체 금액을 듣고 나만의 쇼핑 대화 완성하기"},
        "content":{"lead":{"zh-CN":"听力从数量和单价抓总价；口语按九类信息清单完成两个角色交替的交易。","ko-KR":"듣기에서는 수량과 단가로 전체 금액을 찾고 말하기에서는 아홉 정보로 두 역할 대화를 완성합니다."},"listening":{"audioId":"chapter-08-listening-plan-place","audioStatus":"pending","question":{"zh-CN":"敏智买的东西一共多少钱？","ko-KR":"민지는 모두 얼마를 내요?"}},"speakingFrame":["___이/가 얼마예요?","한 개/병에 ___원이에요.","___이/가 싸요/비싸요/커요/작아요.","___도 ___ 개/병 주세요.","모두 얼마예요?／모두 ___원이에요."],"coach":{"zh-CN":"音频真实制作并可播放后听力才可完成；口语提交只记录完成证据，不产生正确性或分数。","ko-KR":"실제 음원이 재생 가능해야 듣기를 완료할 수 있고 말하기는 정오나 점수 없이 완료 증거만 기록합니다."},"nextNode":"weekend-chat"}
      },
      {
        "code":"read_write","order":7,"accent":"iris","type":"practice","minutes":12,
        "nodeCode":"weekend-chat","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},
        "description":{"zh-CN":"读商品—单位—金额价格卡，再写4—5句原创订购消息。","ko-KR":"상품·단위·금액 가격표를 읽고 4~5문장의 새 주문 메시지를 씁니다."},
        "nodeTitle":{"zh-CN":"读价格卡，写一条真实订购消息","ko-KR":"가격표를 읽고 실제 주문 메시지 쓰기"},
        "content":{"lead":{"zh-CN":"从左到右配对商品、数量单位和价格，再按问候、询价、数量、追加和总价组织消息。","ko-KR":"상품, 수량 단위와 가격을 연결하고 인사, 가격 질문, 수량, 추가와 전체 금액 순서로 메시지를 씁니다."},"reading":"우리 동네 가게 · 오늘의 가격\n사과 한 개 1,000원\n바나나 두 개 2,000원\n우유 한 병 1,500원\n물 두 병 2,000원","writingFrame":"안녕하세요? → ___이/가 얼마예요? → ___ ___ 개/병 주세요. → ___도 ___ 개/병 주세요. → 모두 얼마예요?","rubric":["信息完整","核心语法","可理解度","格式与语气"],"example":"안녕하세요? 물이 얼마예요? 물 두 병 주세요. 바나나도 한 개 주세요. 모두 얼마예요?","coach":{"zh-CN":"阅读三题全对，并提交4—5句、五类信息齐全且完成四维自查的原创消息才完成。","ko-KR":"읽기 세 문제와 4~5문장, 다섯 정보, 네 기준 점검을 갖춘 새 메시지를 제출해야 합니다."},"nextNode":"can-do-check"}
      },
      {
        "code":"review","order":8,"accent":"coral","type":"review","minutes":8,
        "nodeCode":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},
        "description":{"zh-CN":"完成综合多选、五项Can-do并记录返回节点。","ko-KR":"종합 복수 선택과 다섯 Can-do를 마치고 복습 위치를 기록합니다."},
        "nodeTitle":{"zh-CN":"我能把数量和金额说清楚吗？","ko-KR":"수량과 금액을 분명하게 말할 수 있나요?"},
        "content":{"lead":{"zh-CN":"按词汇、语法、理解、表达和读写错因返回对应节点；自主复习展示不作为强制证据。","ko-KR":"어휘, 문법, 이해, 표현과 읽기·쓰기의 원인에 따라 해당 노드로 돌아갑니다."},"canDo":[{"ko":"상품의 단가와 전체 금액을 묻고 들을 수 있어요.","zh":"我能询问并听懂商品单价和总价。"},{"ko":"고유어 수와 개／병을 사용하여 상품 수량을 말할 수 있어요.","zh":"我能用固有词数量和개／병说商品数量。"},{"ko":"-(으)세요로 쇼핑 동작을 공손하게 요청할 수 있어요.","zh":"我能用-(으)세요礼貌请对方做购物相关动作。"},{"ko":"형용사 서술어로 상품을 평가하고 도로 상품을 추가할 수 있어요.","zh":"我能用形容词谓语评价商品，并用도追加商品。"},{"ko":"35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 할 수 있어요.","zh":"我能完成35—50秒、不少于8轮的双角色购物对话。"}],"remediation":[{"reason":"词汇","node":"activity-words"},{"reason":"语法","node":"suggest-and-react"},{"reason":"理解","node":"weekend-plan-talk／listen-and-invite"},{"reason":"表达","node":"listen-and-invite"},{"reason":"读写","node":"weekend-chat"}],"chapterTest":"korean-level-one-08","coach":{"zh-CN":"综合多选答对，五项自查全部回应并记录返回节点或none后完成。","ko-KR":"종합 문제 정답과 다섯 점검 및 복습 위치 또는 none 기록이 필요합니다."}}
      }
    ] $modules$::jsonb)
  loop
    insert into public.digital_textbook_modules (
      chapter_id, module_code, sort_order, accent_role, title, description
    ) values (
      chapter_uuid, module_seed->>'code', (module_seed->>'order')::integer,
      module_seed->>'accent', module_seed->'title', module_seed->'description'
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
      module_uuid, module_seed->>'nodeCode', module_seed->>'type', 1,
      (module_seed->>'minutes')::integer, module_seed->'nodeTitle', module_seed->'content'
    )
    on conflict (module_id, node_code) do update set
      node_type = excluded.node_type,
      sort_order = excluded.sort_order,
      estimated_minutes = excluded.estimated_minutes,
      title = excluded.title,
      content = excluded.content,
      updated_at = now()
    returning id into node_uuid;
  end loop;

  -- Replace the mechanical chapter-six scaffold above with the chapter-eight
  -- master content before any activity or media row can be observed.
  for module_seed in
    select value from jsonb_array_elements($chapter_eight_modules$
    [
      {"code":"orientation","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"description":{"zh-CN":"确认出门前需要听清时段、变化和准备建议。","ko-KR":"외출 전에 시간대, 변화와 준비 안내를 확인합니다."},"nodeCode":"mission-map","nodeTitle":{"zh-CN":"出门前要先听懂什么？","ko-KR":"외출 전에 무엇을 먼저 들어야 할까요?"},"content":{"lead":{"zh-CN":"只知道天气不错还不能决定带什么；要听清时段、变化和准备建议。","ko-KR":"날씨가 좋다는 말만으로는 준비물을 정할 수 없어 시간대와 변화를 들어야 합니다."},"targets":[{"ko":"오늘 날씨가 어때요?","zh":"询问天气"},{"ko":"오늘은 맑고 따뜻합니다.","zh":"播报今天"},{"ko":"내일 오후에는 비가 옵니다.","zh":"播报明天"},{"ko":"우산을 준비하세요.","zh":"给出建议"}],"finalOutput":{"zh-CN":"50—70秒、7—9句的城市天气播报，包含季节、今天、时段反差、明天和准备建议。","ko-KR":"계절, 오늘, 시간대 대조, 내일과 준비 안내를 포함한 50~70초, 7~9문장의 도시 날씨 안내입니다."},"coach":{"zh-CN":"答对不计分场景诊断即完成；复述任务为自主展示。","ko-KR":"점수 없는 장면 진단 정답만 필수이며 마지막 과제 설명은 자율 활동입니다."},"nextNode":"activity-words"}},
      {"code":"vocabulary","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"description":{"zh-CN":"把22个季节、时段、天气和准备物词与搭配一起记。","ko-KR":"계절, 시간대, 날씨와 준비물 어휘 22개를 결합과 함께 익힙니다."},"nodeCode":"activity-words","nodeTitle":{"zh-CN":"把季节、时段、天气和准备物配成块","ko-KR":"계절, 시간대, 날씨와 준비물을 말덩이로 익히기"},"content":{"lead":{"zh-CN":"按看图辨认、点读原形、跟读搭配、放进时段句学习；全部音频待制作。","ko-KR":"그림 확인, 기본형 듣기, 결합 따라 읽기와 시간대 문장 순서로 익힙니다. 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"계절","zh":"季节","pos":"名词","collocation":"무슨 계절이에요?"},{"ko":"봄","zh":"春天","pos":"名词","collocation":"봄에는 따뜻해요."},{"ko":"여름","zh":"夏天","pos":"名词","collocation":"여름에는 더워요."},{"ko":"가을","zh":"秋天","pos":"名词","collocation":"가을에는 시원해요."},{"ko":"겨울","zh":"冬天","pos":"名词","collocation":"겨울에는 추워요."},{"ko":"날씨","zh":"天气","pos":"名词","collocation":"날씨가 어때요?"},{"ko":"기온","zh":"气温","pos":"名词","collocation":"낮 기온"},{"ko":"아침","zh":"早晨","pos":"名词","collocation":"아침에는 맑아요."},{"ko":"낮","zh":"白天","pos":"名词","collocation":"낮에는 더워요."},{"ko":"밤","zh":"夜晚","pos":"名词","collocation":"밤에는 시원해요."},{"ko":"맑다","zh":"晴朗","pos":"形容词","collocation":"날씨가 맑아요."},{"ko":"흐리다","zh":"阴、阴沉","pos":"形容词","collocation":"날씨가 흐려요."},{"ko":"덥다","zh":"热","pos":"形容词","collocation":"낮에는 더워요."},{"ko":"춥다","zh":"冷","pos":"形容词","collocation":"밤에는 추워요."},{"ko":"따뜻하다","zh":"温暖","pos":"形容词","collocation":"맑고 따뜻해요."},{"ko":"시원하다","zh":"凉爽","pos":"形容词","collocation":"밤에는 시원해요."},{"ko":"비","zh":"雨","pos":"名词","collocation":"비가 와요."},{"ko":"눈","zh":"雪","pos":"名词","collocation":"눈이 와요."},{"ko":"바람","zh":"风","pos":"名词","collocation":"바람이 불어요."},{"ko":"우산","zh":"雨伞","pos":"名词","collocation":"우산을 준비하세요."},{"ko":"겉옷","zh":"外套","pos":"名词","collocation":"겉옷을 가져가세요."},{"ko":"준비하다","zh":"准备","pos":"动词","collocation":"우산을 준비하세요."}],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；22词点读和看图快说为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"suggest-and-react"}},
      {"code":"grammar","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"description":{"zh-CN":"用ㅂ不规则、-지만、正式体和天气状态-고说明天气。","ko-KR":"ㅂ 불규칙, -지만, 격식체와 날씨 상태 -고로 날씨를 설명합니다."},"nodeCode":"suggest-and-react","nodeTitle":{"zh-CN":"把天气变化说得自然、清楚、正式","ko-KR":"날씨 변화를 자연스럽고 분명하며 격식 있게 말하기"},"content":{"lead":{"zh-CN":"先处理덥다/춥다，再区分相加与反差，最后切换正式播报体。","ko-KR":"덥다와 춥다를 활용하고 첨가와 대조를 구별한 뒤 격식체로 바꿉니다."},"grammarCards":[{"form":"ㅂ 불규칙","function":{"zh-CN":"描述冷热时自然变化덥다/춥다。","ko-KR":"더위와 추위를 자연스럽게 활용합니다."},"rules":["元音起始词尾前ㅂ脱落并加우","더우+어요缩约为더워요","辅音词尾前保留ㅂ：덥지만、춥습니다","입다、잡다等规则动词不套用"],"examples":[{"ko":"여름에는 날씨가 더워요.","zh":"夏天天气很热。","audioId":"chapter-08-grammar-01-example-01","audioStatus":"pending"},{"ko":"낮에는 더워요. 바람도 불어요.","zh":"白天很热，也会刮风。","audioId":"chapter-08-grammar-01-example-02","audioStatus":"pending"},{"ko":"낮에는 따뜻하지만 밤에는 추워요.","zh":"白天暖和，但晚上很冷。","audioId":"chapter-08-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：덥어요；元音词尾前应写더워요。","ko-KR":"잘못: 덥어요. 모음 어미 앞에서는 더워요입니다."},"comparison":{"zh-CN":"더워요/추워요用于日常对话；덥습니다/춥습니다用于正式播报。","ko-KR":"더워요와 추워요는 대화체, 덥습니다와 춥습니다는 격식체입니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"A/V-지만","function":{"zh-CN":"连接有反差的天气信息。","ko-KR":"대조되는 날씨 정보를 연결합니다."},"rules":["词干后直接加지만","有无收音不改变-지만","ㅂ不规则词在辅音词尾前保留ㅂ","后项放更需注意的变化"],"examples":[{"ko":"낮에는 덥지만 밤에는 시원해요.","zh":"白天热，但晚上凉快。","audioId":"chapter-08-grammar-02-example-01","audioStatus":"pending"},{"ko":"밤에는 시원하지만 비가 와요.","zh":"晚上凉快，但是会下雨。","audioId":"chapter-08-grammar-02-example-02","audioStatus":"pending"},{"ko":"낮에는 덥지만 밤에는 시원합니다.","zh":"白天热，但晚上凉快。","audioId":"chapter-08-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：더워지만；-지만直接接덥-。","ko-KR":"잘못: 더워지만. -지만은 덥-에 직접 붙습니다."},"comparison":{"zh-CN":"-고表示相加；-지만表示反差。","ko-KR":"-고는 첨가, -지만은 대조를 나타냅니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"A/V-습니다/ㅂ니다","function":{"zh-CN":"面向听众正式播报天气。","ko-KR":"청중에게 날씨를 격식 있게 안내합니다."},"rules":["无收音词干加-ㅂ니다","有收音词干加-습니다","ㄹ收音脱落后加-ㅂ니다","ㅂ不规则词在辅音词尾前保留ㅂ"],"examples":[{"ko":"오늘 서울은 맑습니다.","zh":"今天首尔晴朗。","audioId":"chapter-08-grammar-03-example-01","audioStatus":"pending"},{"ko":"내일 오전에는 흐리고 오후에는 비가 옵니다.","zh":"明天上午阴，下午有雨。","audioId":"chapter-08-grammar-03-example-02","audioStatus":"pending"},{"ko":"토요일 부산은 맑고 따뜻합니다.","zh":"星期六釜山晴朗而温暖。","audioId":"chapter-08-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：오습니다；无收音词干오-接-ㅂ니다写作옵니다。","ko-KR":"잘못: 오습니다. 오- 뒤에는 -ㅂ니다를 붙여 옵니다입니다."},"comparison":{"zh-CN":"비가 와요是同学间礼貌体；비가 옵니다是正式播报体。","ko-KR":"비가 와요는 대화체이고 비가 옵니다는 격식체입니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"A/V-고","function":{"zh-CN":"并列同一时段的两项天气。","ko-KR":"같은 시간대의 두 날씨 정보를 나열합니다."},"rules":["词干后直接加고","有无收音都不改变-고","ㅂ不规则词在辅音词尾前保留ㅂ","本课聚焦天气状态相加"],"examples":[{"ko":"오늘은 맑고 따뜻해요.","zh":"今天晴朗而温暖。","audioId":"chapter-08-grammar-04-example-01","audioStatus":"pending"},{"ko":"오전에는 흐리고 오후에는 맑아요.","zh":"上午阴，下午晴。","audioId":"chapter-08-grammar-04-example-02","audioStatus":"pending"},{"ko":"일요일 오전에는 흐리고 오후에는 비가 옵니다.","zh":"星期日上午阴，下午有雨。","audioId":"chapter-08-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：맑아고；应取词干맑-加고。","ko-KR":"잘못: 맑아고. 맑-에 고를 붙여 맑고라고 씁니다."},"comparison":{"zh-CN":"-고相加天气，-지만突出反差。","ko-KR":"-고는 날씨를 더하고 -지만은 대조를 강조합니다."},"source":{"zh-CN":"母本§5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"六项填空全部正确才完成；口头规则解释与扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"plan-builder"}},
      {"code":"patterns","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"description":{"zh-CN":"把天气单句组织成有顺序的播报。","ko-KR":"날씨 문장을 순서가 있는 안내로 조직합니다."},"nodeCode":"plan-builder","nodeTitle":{"zh-CN":"从天气单句变成有顺序的播报","ko-KR":"날씨 문장을 순서 있는 안내로 만들기"},"content":{"lead":{"zh-CN":"先练季节、并列天气和时段反差，再排列五个完整播报语块。","ko-KR":"계절, 날씨 나열과 시간대 대조를 연습한 뒤 다섯 안내 문장을 배열합니다."},"replacementSets":[["여름에는 더워요.","겨울에는 추워요.","봄에는 따뜻해요.","가을에는 시원해요."],["맑고 따뜻해요.","흐리고 시원해요.","비가 오고 바람이 불어요."],["낮에는 덥지만 밤에는 시원해요.","아침에는 흐리지만 오후에는 맑아요.","내일은 흐리지만 따뜻합니다."]],"orderItems":["낮에는 덥지만 밤에는 시원합니다.","오늘은 맑고 따뜻합니다.","우산을 준비하세요.","서울 날씨입니다.","내일 오후에는 비가 옵니다."],"personalFrames":["___에는 더워요/추워요/따뜻해요/시원해요.","오늘은 ___고 ___어요.","___에는 ___지만 ___에는 ___어요."],"coach":{"zh-CN":"五语块排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"다섯 문장 배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"weekend-plan-talk"}},
      {"code":"dialogue","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"description":{"zh-CN":"从两组对话抓住今天、明天、时段变化和准备物。","ko-KR":"두 대화에서 오늘, 내일, 시간대 변화와 준비물을 파악합니다."},"nodeCode":"weekend-plan-talk","nodeTitle":{"zh-CN":"先听变化，再决定带什么","ko-KR":"변화를 듣고 준비물 정하기"},"content":{"lead":{"zh-CN":"先整段默读，待音频制作后整段听，再逐句跟读、隐藏中文和切换角色。","ko-KR":"전체를 읽고 음원 제작 후 들은 뒤 문장별로 따라 읽고 역할을 바꿉니다."},"dialogueScenes":[{"title":{"zh-CN":"周五放学前的学校大厅","ko-KR":"금요일 방과 전 학교 로비"},"people":{"zh-CN":"智敏与俊浩，同班同学","ko-KR":"지민과 준호, 같은 반 친구"},"purpose":{"zh-CN":"确认今天早晨、白天和夜间天气并决定是否带伞。","ko-KR":"오늘 아침, 낮과 밤 날씨를 확인하고 우산을 준비할지 정합니다."},"audioId":"chapter-08-dialogue-main","audioStatus":"pending","lines":[{"speaker":"지민","ko":"오늘 날씨가 어때요?","zh":"今天天气怎么样？"},{"speaker":"준호","ko":"아침에는 맑고 따뜻해요.","zh":"早上晴朗又温暖。"},{"speaker":"지민","ko":"낮에도 따뜻해요?","zh":"白天也暖和吗？"},{"speaker":"준호","ko":"아니요. 낮에는 더워요. 바람도 불어요.","zh":"不。白天很热，也会刮风。"},{"speaker":"지민","ko":"밤에는 어때요?","zh":"晚上怎么样？"},{"speaker":"준호","ko":"밤에는 시원하지만 비가 와요.","zh":"晚上凉快，但是会下雨。"},{"speaker":"지민","ko":"그럼 우산이 필요해요?","zh":"那需要雨伞吗？"},{"speaker":"준호","ko":"네, 우산을 가져가세요.","zh":"是的，请带上雨伞。"}]},{"title":{"zh-CN":"周五下午的教室窗边","ko-KR":"금요일 오후 교실 창가"},"people":{"zh-CN":"素拉与敏秀，同班同学","ko-KR":"소라와 민수, 같은 반 친구"},"purpose":{"zh-CN":"确认明天上午下午天气和昼夜温差并决定是否带外套。","ko-KR":"내일 오전과 오후 날씨, 낮과 밤 기온을 확인하고 겉옷을 준비할지 정합니다."},"audioId":"chapter-08-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"소라","ko":"내일 날씨가 어때요?","zh":"明天天气怎么样？"},{"speaker":"민수","ko":"오전에는 흐리고 오후에는 맑아요.","zh":"上午阴，下午晴。"},{"speaker":"소라","ko":"기온은 어때요?","zh":"气温怎么样？"},{"speaker":"민수","ko":"낮에는 따뜻하지만 밤에는 추워요.","zh":"白天暖和，但是晚上很冷。"},{"speaker":"소라","ko":"그럼 겉옷이 필요해요?","zh":"那需要外套吗？"},{"speaker":"민수","ko":"네, 겉옷을 가져가세요.","zh":"是的，请带上外套。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换和双角色试录为自主练习。","ko-KR":"날씨 사실과 자연스러운 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-invite"}},
      {"code":"listen_speak","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"description":{"zh-CN":"听出明天下午天气，再完成一分钟城市天气播报。","ko-KR":"내일 오후 날씨를 듣고 1분 도시 날씨 안내를 합니다."},"nodeCode":"listen-and-invite","nodeTitle":{"zh-CN":"听出明天下午，再完成一分钟播报","ko-KR":"내일 오후를 듣고 1분 안내 완성하기"},"content":{"lead":{"zh-CN":"私有听力只显示待制作音频控件和问题；脚本、答案、停顿与对象键只在服务端。","ko-KR":"듣기 원고, 정답, 쉼과 객체 키는 서버에서만 관리합니다."},"speakingTask":{"duration":"50—70秒","targetSeconds":60,"minimumSentences":7,"maximumSentences":9,"requiredInformation":["城市与季节","今天两项-고天气","一次-지만时段反差","明天正式预报","有依据的准备建议"],"formalStyle":true,"pronunciationScore":false},"coach":{"zh-CN":"音频制作并可播放后听力答对，同时提交满足时长、句数、五类信息与语体要求的录音才完成。","ko-KR":"음원이 제작되어 재생 가능하고 듣기 정답과 말하기 조건을 모두 충족해야 합니다."},"nextNode":"weekend-chat"}},
      {"code":"read_write","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"description":{"zh-CN":"读周末天气公告，再写原创城市天气卡。","ko-KR":"주말 날씨 안내문을 읽고 새로운 도시 날씨 카드를 씁니다."},"nodeCode":"weekend-chat","nodeTitle":{"zh-CN":"读简短天气公告，写新的城市预报","ko-KR":"짧은 날씨 안내문을 읽고 새로운 도시 예보 쓰기"},"content":{"lead":{"zh-CN":"按星期和时段读取信息，让准备建议能回到正文天气依据。","ko-KR":"요일과 시간대에 따라 읽고 준비 안내가 날씨 근거와 연결되게 씁니다."},"reading":{"title":"부산 주말 날씨","lines":["토요일 부산은 맑고 따뜻합니다.","낮에는 덥지만 밤에는 시원합니다.","일요일 오전에는 흐리고 오후에는 비가 옵니다.","바람도 붑니다.","우산을 준비하세요."]},"writing":{"audience":{"zh-CN":"同班同学","ko-KR":"같은 반 친구"},"sentences":"5—6","requirements":["城市与季节特征","今天两项天气","时段反差","明天正式预报","有依据的准备建议"],"frame":"___ 날씨입니다. → ___에는 ___습니다. → 오늘은 ___고 ___습니다. → ___에는 ___지만 ___에는 ___습니다. → 내일 ___에는 ___습니다. → ___을/를 준비하세요.","rubric":["信息完整","核心语法","建议依据","可理解度","格式与语气"],"example":"서울 날씨입니다. 겨울에는 춥습니다. 오늘은 맑고 시원합니다. 낮에는 맑지만 밤에는 눈이 옵니다. 내일 아침에도 춥습니다. 겉옷을 준비하세요."},"coach":{"zh-CN":"三道阅读题全对，提交5—6句、五类信息齐全、主体正式体并完成五维量规自查。","ko-KR":"읽기 세 문제와 5~6문장, 다섯 정보, 격식체 및 자기 점검을 모두 완성합니다."},"nextNode":"can-do-check"}},
      {"code":"review","title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},"description":{"zh-CN":"按五类错因返回最短复习路径。","ko-KR":"다섯 원인에 따라 가장 짧은 복습 경로로 돌아갑니다."},"nodeCode":"can-do-check","nodeTitle":{"zh-CN":"我能让别人根据播报做好准备吗？","ko-KR":"다른 사람이 안내를 듣고 준비할 수 있을까요?"},"content":{"lead":{"zh-CN":"自主复习展示不作为强制证据；综合多选与五项自查由合同记录。","ko-KR":"자율 복습은 필수 증거가 아니며 종합 문제와 다섯 점검을 기록합니다."},"canDo":[{"ko":"계절과 시간대에 맞는 날씨 표현을 사용할 수 있어요.","zh":"我能用合适词汇描述季节和时段天气。"},{"ko":"덥다와 춥다를 해요체와 격식체로 바르게 바꿀 수 있어요.","zh":"我能正确使用덥다/춥다的日常体和正式体。"},{"ko":"날씨 정보를 더할 때 -고, 대조할 때 -지만을 사용할 수 있어요.","zh":"我能用-고相加天气，用-지만表达反差。"},{"ko":"생활 날씨 안내문을 읽고 5~6문장의 새로운 예보를 쓸 수 있어요.","zh":"我能读懂天气公告并写5—6句新预报。"},{"ko":"오늘과 내일, 시간대 변화와 준비 안내를 넣어 50~70초 동안 날씨를 안내할 수 있어요.","zh":"我能加入今天、明天、时段变化和准备建议，完成50—70秒天气播报。"}],"remediation":[{"reason":"词汇","node":"activity-words"},{"reason":"语法","node":"suggest-and-react"},{"reason":"理解","node":"weekend-plan-talk／listen-and-invite"},{"reason":"表达","node":"listen-and-invite"},{"reason":"读写","node":"weekend-chat"}],"chapterTest":"korean-level-one-08","coach":{"zh-CN":"综合多选答对，五项自查全部回应并记录返回节点或none后完成。","ko-KR":"종합 문제 정답과 다섯 점검 및 복습 위치 또는 none 기록이 필요합니다."}}}
    ] $chapter_eight_modules$::jsonb)
  loop
    update public.digital_textbook_modules
    set title = module_seed->'title', description = module_seed->'description', updated_at = now()
    where chapter_id = chapter_uuid and module_code = module_seed->>'code';

    update public.digital_textbook_nodes as node
    set title = module_seed->'nodeTitle', content = module_seed->'content', updated_at = now()
    from public.digital_textbook_modules as module
    where node.module_id = module.id
      and module.chapter_id = chapter_uuid
      and node.node_code = module_seed->>'nodeCode';
  end loop;

  update public.digital_textbook_nodes as node
  set estimated_minutes = case node.node_code
        when 'mission-map' then 5
        when 'activity-words' then 10
        when 'suggest-and-react' then 18
        when 'plan-builder' then 12
        when 'weekend-plan-talk' then 12
        when 'listen-and-invite' then 15
        when 'weekend-chat' then 13
        when 'can-do-check' then 8
      end,
      updated_at = now()
  from public.digital_textbook_modules as module
  where node.module_id = module.id and module.chapter_id = chapter_uuid;

  delete from public.digital_textbook_modules
  where chapter_id = chapter_uuid
    and module_code not in ('orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review');

  for activity_seed in
    select value from jsonb_array_elements($activities$
    [
      {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"敏智在水果店看不清苹果价格，最适合先说哪一句？","ko-KR":"민지는 과일 가게에서 사과 가격을 잘 볼 수 없습니다. 가장 먼저 할 말은 무엇이에요?"},"instruction":{"zh-CN":"选择一个能直接询问苹果价格的表达；本题不显示分数。","ko-KR":"사과 가격을 직접 묻는 표현을 하나 고르세요. 점수는 표시하지 않습니다."},"options":["사과가 얼마예요?","사과 세 개 주세요.","사과가 싸요.","주말에 뭐 했어요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"사과가 얼마예요?直接询问苹果价格。","ko-KR":"사과가 얼마예요?는 사과 가격을 직접 묻습니다."},"feedback":[{"zh-CN":"先找表示价格疑问的词。","ko-KR":"가격을 묻는 말을 먼저 찾으세요."},{"zh-CN":"目标句要同时出现사과和얼마예요?。","ko-KR":"사과와 얼마예요?가 함께 있는 문장을 찾으세요."},{"zh-CN":"正确表达是사과가 얼마예요?。","ko-KR":"정답은 사과가 얼마예요?입니다."}]}},
      {"nodeCode":"activity-words","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在사과가 얼마예요?中，얼마表示什么？","ko-KR":"사과가 얼마예요?에서 얼마는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["价格多少","数量三个","苹果","店员"],"config":{"shuffle":true,"audioStatus":"pending","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"얼마是“价格多少”；整句表示“苹果多少钱？”","ko-KR":"얼마는 가격을 묻고 문장은 사과 가격이 얼마인지 묻습니다."},"feedback":[{"zh-CN":"先判断整句在问商品、人物、数量还是价格。","ko-KR":"상품, 사람, 수량과 가격 중 무엇을 묻는지 보세요."},{"zh-CN":"얼마예요?常用于不知道金额时询价。","ko-KR":"얼마예요?는 모르는 가격을 물을 때 씁니다."},{"zh-CN":"目标词义是“价格多少”。","ko-KR":"정답은 가격이 얼마인지 묻는 뜻입니다."}]}},
      {"nodeCode":"suggest-and-react","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成六小题，检查动作请求、固有词数量＋量词、形容词谓语和도。","ko-KR":"동작 요청, 고유어 수와 단위, 형용사 서술어와 도를 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"填写먹___、보___、사과 ___ 개、물 ___ 병、가방___ 커요、우유___ 주세요。","ko-KR":"먹___, 보___, 사과 ___ 개, 물 ___ 병, 가방___ 커요, 우유___ 주세요를 완성하세요."},"options":[],"config":{"inputMode":"text","normalize":"NFC","items":[{"id":"blank_01","label":"먹다 → 먹___（请吃）","placeholder":"请填写"},{"id":"blank_02","label":"보다 → 보___（请看）","placeholder":"请填写"},{"id":"blank_03","label":"사과 ___ 개 주세요.（三个）","placeholder":"请填写"},{"id":"blank_04","label":"물 ___ 병 주세요.（两瓶）","placeholder":"请填写"},{"id":"blank_05","label":"가방___ 커요.（主格助词）","placeholder":"请填写"},{"id":"blank_06","label":"우유___ 주세요.（也）","placeholder":"请填写"}]},"answer":{"kind":"text_array","value":["으세요","세요","세","두","이","도"]},"explanation":{"correct":{"zh-CN":"六项依次是으세요、세요、세、두、이、도。","ko-KR":"정답은 으세요, 세요, 세, 두, 이, 도입니다."},"feedback":[{"zh-CN":"先区分动作请求、数量、评价对象和追加。","ko-KR":"동작 요청, 수량, 평가 대상과 추가를 구분하세요."},{"zh-CN":"检查收音、量词前缩略形和助词位置。","ko-KR":"받침, 단위 앞 준말과 조사 위치를 확인하세요."},{"zh-CN":"答案依次为으세요、세요、세、두、이、도。","ko-KR":"여섯 답을 모두 정확히 다시 쓰세요."}]}},
      {"nodeCode":"plan-builder","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"把六个完整话轮排成一段自然购物交易。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 쇼핑 대화 순서로 배열하세요."},"instruction":{"zh-CN":"依据问答关系和上下文排列，不拆分话轮。","ko-KR":"문답 관계와 맥락에 맞게 완전한 말차례를 배열하세요."},"options":["모두 오천 원이에요.","사과 세 개 주세요.","사과가 얼마예요?","바나나도 두 개 주세요.","한 개에 천 원이에요.","모두 얼마예요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[2,4,1,3,5,0]},"explanation":{"correct":{"zh-CN":"先询价和单价，再买苹果、追加香蕉，最后问答总价。","ko-KR":"가격 질문과 단가 뒤에 사과 구매, 바나나 추가와 전체 금액 문답이 옵니다."},"feedback":[{"zh-CN":"先找商品价格问答和最后的总价问答。","ko-KR":"상품 가격 문답과 마지막 전체 금액 문답을 찾으세요."},{"zh-CN":"中间先买苹果，再用도追加香蕉。","ko-KR":"중간에는 사과를 사고 도로 바나나를 더합니다."},{"zh-CN":"正确顺序是询价→单价→买苹果→追加香蕉→问总价→报总价。","ko-KR":"가격 질문, 단가, 사과 구매, 바나나 추가, 전체 금액 질문과 답 순서입니다."}]}},
      {"nodeCode":"weekend-plan-talk","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景的价格信息？","ko-KR":"두 장면의 가격 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“主场景总价／第二场景最后所选雨伞价格”的正确组合。","ko-KR":"주 장면의 전체 금액과 두 번째 장면에서 마지막에 고른 우산 가격의 조합을 고르세요."},"options":["5,000원／7,000원","5,000원／10,000원","3,000원／7,000원","2,000원／10,000원"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"主场景总价5,000韩元，最后所选雨伞7,000韩元。","ko-KR":"주 장면은 5천 원이고 마지막에 고른 우산은 7천 원입니다."},"feedback":[{"zh-CN":"找主场景含모두的台词和第二场景选择前的价格。","ko-KR":"모두가 있는 대사와 선택 직전 가격을 찾으세요."},{"zh-CN":"不要把第一把10,000韩元的雨伞当成最后选择。","ko-KR":"처음 본 만 원 우산을 마지막 선택으로 착각하지 마세요."},{"zh-CN":"正确组合是5,000원／7,000원。","ko-KR":"정답은 5,000원／7,000원입니다."}]}},
      {"nodeCode":"weekend-plan-talk","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"秀彬说모두 오천 원이에요.后，敏智要把钱递给店员，哪一句最合适？","ko-KR":"수빈이 모두 오천 원이에요.라고 말한 뒤 민지가 돈을 건넬 때 가장 알맞은 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合确认金额并递交钱款的礼貌回应。","ko-KR":"금액을 확인하고 돈을 건네는 상황에 맞는 공손한 대답을 고르세요."},"options":["네, 여기요.","사과 세 개 주세요.","얼마예요?","조금 비싸요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"네, 여기요.用于把准备好的钱递给店员。","ko-KR":"네, 여기요.는 준비한 돈을 직원에게 건넬 때 알맞습니다."},"feedback":[{"zh-CN":"总价已知，现在要完成递交钱款。","ko-KR":"전체 금액을 알았으니 이제 돈을 건넵니다."},{"zh-CN":"不要重新询价或下单。","ko-KR":"다시 가격을 묻거나 주문하지 마세요."},{"zh-CN":"最合适的是네, 여기요.。","ko-KR":"정답은 네, 여기요.입니다."}]}},
      {"nodeCode":"listen-and-invite","key":"listening-plan-place","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听购物信息，判断敏智买的东西一共多少钱。","ko-KR":"쇼핑 정보를 듣고 민지가 모두 얼마를 내는지 고르세요."},"instruction":{"zh-CN":"正常语速最多听两遍，慢速最多听一遍；依据商品、数量、单价和末句总价作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 상품, 수량, 단가와 마지막 전체 금액에 근거해 답하세요."},"options":["4,500원","3,000원","1,500원","5,500원"],"config":{"audioId":"chapter-08-listening-plan-place","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":true},"answer":{"kind":"index","value":0},"transcript":"민지는 동네 가게에 가요. 사과는 한 개에 천 원이에요. 우유는 한 병에 천오백 원이에요. 민지는 사과 세 개를 사요. 우유도 한 병 사요. 모두 사천오백 원이에요.","audioObjectKey":"korean-level-one/chapter-08/listening/chapter-08-listening-plan-place.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"三个苹果3,000韩元，加一瓶牛奶1,500韩元，共4,500韩元。","ko-KR":"사과 세 개 3천 원과 우유 한 병 1천5백 원으로 모두 4천5백 원입니다."},"feedback":[{"zh-CN":"分别记下苹果数量、苹果单价和牛奶单价。","ko-KR":"사과 수량과 단가, 우유 단가를 적으세요."},{"zh-CN":"3,000韩元还要加一瓶1,500韩元的牛奶。","ko-KR":"3천 원에 우유 한 병 1천5백 원을 더하세요."},{"zh-CN":"答案是4,500원；末句也直接说明总价。","ko-KR":"정답은 4,500원이며 마지막 문장에도 나옵니다."}],"privateListening":{"slowScript":"민지는 동네 가게에 가요. / 사과는 한 개에 천 원이에요. / 우유는 한 병에 천오백 원이에요. / 민지는 사과 세 개를 사요. / 우유도 한 병 사요. / 모두 사천오백 원이에요.","pauseMarks":"민지는 동네 가게에 가요. ⏸ 사과는 한 개에 천 원이에요. ⏸ 우유는 한 병에 천오백 원이에요. ⏸ 민지는 사과 세 개를 사요. ⏸ 우유도 한 병 사요. ⏸ 모두 사천오백 원이에요.","speaker":"F03／第三人称旁白","distractorReasons":{"1":"只计算三个苹果，漏掉牛奶。","2":"只取牛奶单价。","3":"原文不支持此金额。"}}}},
      {"nodeCode":"listen-and-invite","key":"speaking-invitation","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成35—50秒、不少于8轮的双角色购物对话。","ko-KR":"35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 완성하세요."},"instruction":{"zh-CN":"加入商品询价、单价、数量购买、形容词评价、一处-(으)세요、도追加、追加商品价格、总价问答和付款回应。","ko-KR":"상품 가격 질문, 단가, 수량 구매, 형용사 평가, -(으)세요 한 번, 도 추가, 추가 상품 가격, 전체 금액 문답과 계산 응답을 넣으세요."},"options":[],"config":{"minimumSeconds":35,"maximumSeconds":50,"minimumTurns":8,"requiredCriteria":9,"enforceCompletionRequirements":true,"pronunciationScore":false,"turnLabel":{"zh-CN":"双角色交替话轮数","ko-KR":"두 역할 교대 말차례 수"},"criteria":["商品询价","单价","数量购买","形容词评价","使用-(으)세요提出动作请求","使用도追加","追加商品价格","总价问答","付款回应"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与九类自查；不产生正确性或分数，等待人工复核。","ko-KR":"녹음 정보와 아홉 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查时长、两个角色、至少8轮和九类信息。","ko-KR":"시간, 두 역할, 8턴 이상과 아홉 정보를 확인하세요."},{"zh-CN":"再检查数量量词、形容词、도和一处-(으)세요。","ko-KR":"수량 단위, 형용사, 도와 -(으)세요 한 번을 확인하세요."},{"zh-CN":"按九项清单补齐后重录；不显示虚假发音准确率。","ko-KR":"아홉 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
      {"nodeCode":"weekend-chat","key":"reading-weekend-chat","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读“今日价格”卡，完成苹果单价、香蕉数量和牛奶单价三题。","ko-KR":"오늘의 가격 카드를 읽고 사과 단가, 바나나 수량과 우유 단가 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；从公开价格卡对应商品行直接找依据。","ko-KR":"문제마다 하나를 고르고 공개 가격표의 해당 상품 줄에서 근거를 찾으세요."},"options":[],"config":{"reading":"우리 동네 가게 · 오늘의 가격\n사과 한 개 1,000원\n바나나 두 개 2,000원\n우유 한 병 1,500원\n물 두 병 2,000원","items":[{"id":"question_01","question":"사과 한 개는 얼마예요?","options":["1,000원","1,500원","2,000원","5,000원"]},{"id":"question_02","question":"바나나는 몇 개에 이천 원이에요?","options":["두 개","한 개","세 개","네 개"]},{"id":"question_03","question":"우유 한 병은 얼마예요?","options":["1,500원","1,000원","2,000원","4,500원"]}],"shuffle":true},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是1,000원、두 개、1,500원。","ko-KR":"정답은 1,000원, 두 개, 1,500원입니다."},"feedback":[{"zh-CN":"分别圈出사과、바나나、우유三行。","ko-KR":"사과, 바나나와 우유 줄을 각각 찾으세요."},{"zh-CN":"每行按商品—数量单位—金额读取。","ko-KR":"각 줄을 상품, 수량 단위, 금액 순서로 읽으세요."},{"zh-CN":"答案是1,000원、두 개、1,500원。","ko-KR":"가격표에서 세 답을 다시 확인하세요."}]}},
      {"nodeCode":"weekend-chat","key":"write-weekend-invitation","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给社区商店写一条4—5句的原创询价订购消息。","ko-KR":"동네 가게에 보낼 새로운 가격 문의와 주문 메시지를 4~5문장으로 쓰세요."},"instruction":{"zh-CN":"写问候、一种商品的价格问题、该商品的数量请求、用도追加另一商品和总价问题，并完成自查。","ko-KR":"인사, 한 상품의 가격 질문과 수량 요청, 도를 사용한 다른 상품 추가, 전체 금액 질문을 쓰고 점검하세요."},"options":[],"config":{"minSentences":4,"maxSentences":5,"minimumHangulCharacters":25,"minimumPhraseGroups":5,"minimumInformationKinds":5,"requireCompletionChecklist":true,"requiredPhraseGroups":[["안녕하세요"],["얼마예요"],["주세요"],["도 "],["모두"]],"informationChecklist":["问候","一种商品的价格问题","该商品的数量请求","使用도追加另一商品","总价问题"],"structureFrame":"안녕하세요? → ___이/가 얼마예요? → ___ ___ 개/병 주세요. → ___도 ___ 개/병 주세요. → 모두 얼마예요?","rubric":["信息完整","核心语法","可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、五类信息与量规自查的原创消息；不产生正确性或分数。","ko-KR":"문장 수, 다섯 정보와 자기 점검을 갖춘 새 메시지를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数4—5句和五类信息。","ko-KR":"4~5문장과 다섯 정보를 먼저 세세요."},{"zh-CN":"检查固有词数量、量词和도的位置。","ko-KR":"고유어 수, 단위와 도의 위치를 확인하세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
      {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接帮助完成购物交易的表达。","ko-KR":"쇼핑 대화를 직접 완성하는 데 사용할 수 있는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["사과가 얼마예요?","사과 세 개 주세요.","우유도 한 병 주세요.","주말에 친구를 만났어요."],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三句用于询价、数量购买和追加；周末经历句与购物无关。","ko-KR":"앞 세 문장은 가격 질문, 수량 구매와 추가이고 주말 문장은 쇼핑과 관계없습니다."},"feedback":[{"zh-CN":"按询价、购买和追加检查每一句。","ko-KR":"가격 질문, 구매와 추가 기능을 확인하세요."},{"zh-CN":"有一句属于过去周末经历。","ko-KR":"한 문장은 지난 주말 경험입니다."},{"zh-CN":"选择前三句，不选周末经历句。","ko-KR":"앞 세 문장을 고르고 주말 문장은 고르지 않습니다."}]}},
      {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"price","label":"我能询问并听懂商品单价和总价／상품 단가와 전체 금액을 묻고 들을 수 있어요"},{"id":"quantity","label":"我能用固有词数量和개／병说数量／고유어 수와 개／병으로 수량을 말할 수 있어요"},{"id":"request","label":"我能用-(으)세요礼貌请求动作／-(으)세요로 동작을 공손하게 요청할 수 있어요"},{"id":"evaluation","label":"我能用形容词评价并用도追加／형용사로 평가하고 도로 추가할 수 있어요"},{"id":"dialogue","label":"我能完成35—50秒、至少8轮的双角色对话／35~50초, 8턴 이상의 두 역할 대화를 할 수 있어요"}],"returnNodes":[{"value":"activity-words","label":"词汇"},{"value":"suggest-and-react","label":"语法"},{"value":"weekend-plan-talk","label":"对话理解"},{"value":"listen-and-invite","label":"听说"},{"value":"weekend-chat","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想价格、数量、动作请求、评价追加和最终录音。","ko-KR":"가격, 수량, 동작 요청, 평가·추가와 마지막 녹음을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
    ] $activities$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = activity_seed->>'nodeCode';

    if node_uuid is null then
      raise exception 'Cannot convert chapter 06 activity %: node % was not found',
        activity_seed->>'key', activity_seed->>'nodeCode';
    end if;

    insert into public.digital_textbook_activities (
      node_id, activity_key, activity_type, sort_order, prompt, instruction,
      options, public_config, max_attempts, counts_toward_completion
    ) values (
      node_uuid, activity_seed->>'key', activity_seed->>'type',
      (activity_seed->>'order')::integer, activity_seed->'prompt',
      activity_seed->'instruction', activity_seed->'options', activity_seed->'config',
      (activity_seed->>'maxAttempts')::integer, (activity_seed->>'counts')::boolean
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
      activity_id, answer_key, explanation, transcript_ko, audio_object_key, audio_status
    ) values (
      activity_uuid, activity_seed->'answer', activity_seed->'explanation',
      activity_seed->>'transcript', activity_seed->>'audioObjectKey',
      coalesce(activity_seed->>'audioStatus', 'pending')
    )
    on conflict (activity_id) do update set
      answer_key = excluded.answer_key,
      explanation = excluded.explanation,
      transcript_ko = excluded.transcript_ko,
      audio_object_key = excluded.audio_object_key,
      audio_status = excluded.audio_status,
      updated_at = now();
  end loop;

  for activity_seed in
    select value from jsonb_array_elements($chapter_eight_activities$
    [
      {"key":"orientation-check","prompt":{"zh-CN":"智敏出门前想先问俊浩今天天气怎样。哪一句最合适？","ko-KR":"지민은 외출하기 전에 준호에게 오늘 날씨를 먼저 묻습니다. 가장 알맞은 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合询问今天天气的一句；本题不计分。","ko-KR":"오늘 날씨 묻기에 맞는 표현을 고르세요. 점수에는 포함되지 않습니다."},"options":["얼마예요?","오늘 날씨가 어때요?","주말에 뭐 했어요?","이분은 누구세요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":1},"explanation":{"correct":{"zh-CN":"오늘 날씨가 어때요?用于询问今天天气。","ko-KR":"오늘 날씨가 어때요?는 오늘 날씨를 묻습니다."},"feedback":[{"zh-CN":"先找表示今天和天气的词。","ko-KR":"오늘과 날씨를 나타내는 말을 찾으세요."},{"zh-CN":"目标句不是问价格、经历或身份。","ko-KR":"가격, 경험이나 사람을 묻는 문장이 아닙니다."},{"zh-CN":"规范答案是오늘 날씨가 어때요?。","ko-KR":"정답은 오늘 날씨가 어때요?입니다."}]}},
      {"key":"vocabulary-check","prompt":{"zh-CN":"우산是什么意思？","ko-KR":"우산은 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读우산을 준비하세요.并勾选确认。","ko-KR":"뜻을 고른 뒤 우산을 준비하세요.를 읽고 확인하세요."},"options":["外套","风","雨伞","雪"],"config":{"shuffle":true,"audioStatus":"pending","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":2},"explanation":{"correct":{"zh-CN":"우산是雨伞，整句表示请准备雨伞。","ko-KR":"우산은 비 올 때 쓰는 물건이며 문장은 우산을 준비하라는 뜻입니다."},"feedback":[{"zh-CN":"先区分天气现象和携带物。","ko-KR":"날씨 현상과 준비물을 구별하세요."},{"zh-CN":"这是下雨时常准备的物品。","ko-KR":"비가 올 때 준비하는 물건입니다."},{"zh-CN":"规范答案是雨伞。","ko-KR":"정답은 우산입니다."}]}},
      {"key":"grammar-fill","prompt":{"zh-CN":"完成六小题，检查ㅂ不规则、转折、正式体和并列连接。","ko-KR":"ㅂ 불규칙, 대조, 격식체와 나열 연결 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"依次填写덥다、춥다、转折词尾、맑다正式体、오다正式体和并列词尾。","ko-KR":"덥다, 춥다, 대조 어미, 맑다와 오다의 격식체, 나열 어미를 쓰세요."},"options":[],"config":{"inputMode":"text","normalize":"NFC","shuffle":true,"items":[{"id":"f1","questionRef":"①","label":"덥다 → ___（日常礼貌体）","placeholder":"请输入答案"},{"id":"f2","questionRef":"②","label":"춥다 → ___（日常礼貌体）","placeholder":"请输入答案"},{"id":"f3","questionRef":"③","label":"낮에는 덥___ 밤에는 시원해요.（反差）","placeholder":"请输入答案"},{"id":"f4","questionRef":"④","label":"맑다 → ___（正式体）","placeholder":"请输入答案"},{"id":"f5","questionRef":"⑤","label":"오다 → ___（正式体）","placeholder":"请输入答案"},{"id":"f6","questionRef":"⑥","label":"아침에는 맑___ 따뜻해요.（相加）","placeholder":"请输入答案"}]},"answer":{"kind":"text_array","value":["더워요","추워요","지만","맑습니다","옵니다","고"]},"explanation":{"correct":{"zh-CN":"答案依次为더워요、추워요、지만、맑습니다、옵니다、고。","ko-KR":"정답은 더워요, 추워요, 지만, 맑습니다, 옵니다, 고입니다."},"feedback":[{"zh-CN":"先判断每空属于不规则、反差、正式体或相加。","ko-KR":"불규칙, 대조, 격식체와 첨가를 먼저 구별하세요."},{"zh-CN":"检查元音词尾前ㅂ变化、词干收音和信息关系。","ko-KR":"ㅂ 변화, 받침과 정보 관계를 확인하세요."},{"zh-CN":"对照四张语法卡将六题全部正确重做。","ko-KR":"네 문법 카드를 보고 여섯 답을 모두 다시 쓰세요."}]}},
      {"key":"pattern-order","prompt":{"zh-CN":"把五个完整句子排成自然的城市天气播报。","ko-KR":"다섯 문장을 자연스러운 도시 날씨 안내 순서로 배열하세요."},"instruction":{"zh-CN":"依据时间推进和建议依据排列五张完整句卡。","ko-KR":"시간 흐름과 준비 안내의 근거에 따라 배열하세요."},"options":["낮에는 덥지만 밤에는 시원합니다.","오늘은 맑고 따뜻합니다.","우산을 준비하세요.","서울 날씨입니다.","내일 오후에는 비가 옵니다."],"config":{"shuffle":true},"answer":{"kind":"order","value":[3,1,0,4,2]},"explanation":{"correct":{"zh-CN":"先城市与今天，再昼夜变化、明天预报和准备建议。","ko-KR":"도시와 오늘, 시간대 변화, 내일 예보와 준비 안내 순서입니다."},"feedback":[{"zh-CN":"先找播报开场和准备建议。","ko-KR":"안내 시작과 준비 문장을 먼저 찾으세요."},{"zh-CN":"中间先今天总体，再昼夜反差，最后进入明天。","ko-KR":"오늘 전체, 낮과 밤 대조, 내일 순서로 놓으세요."},{"zh-CN":"正确顺序是城市→今天→昼夜→明天→雨伞建议。","ko-KR":"도시, 오늘, 낮과 밤, 내일, 우산 안내 순서입니다."}]}},
      {"key":"dialogue-fact-check","prompt":{"zh-CN":"哪组选项同时正确概括两个对话场景的天气？","ko-KR":"두 대화 장면의 날씨를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择主场景夜间天气／第二场景上午天气的正确组合。","ko-KR":"주 장면 밤 날씨와 두 번째 장면 오전 날씨 조합을 고르세요."},"options":["바람／눈","맑음／비","비／흐림","눈／맑음"],"config":{"shuffle":true},"answer":{"kind":"index","value":2},"explanation":{"correct":{"zh-CN":"主场景夜间下雨，第二场景上午阴。","ko-KR":"주 장면 밤에는 비가 오고 두 번째 장면 오전에는 흐립니다."},"feedback":[{"zh-CN":"分别找含밤에는和오전에는的台词。","ko-KR":"밤에는과 오전에는이 있는 대사를 찾으세요."},{"zh-CN":"不要把白天热或下午晴带入指定时段。","ko-KR":"낮의 더위나 오후의 맑음을 섞지 마세요."},{"zh-CN":"规范组合是비／흐림。","ko-KR":"정답은 비／흐림입니다."}]}},
      {"key":"dialogue-response","prompt":{"zh-CN":"俊浩说밤에는 시원하지만 비가 와요.后，准备晚间外出的智敏怎样回应最自然？","ko-KR":"준호가 밤에는 시원하지만 비가 와요.라고 말한 뒤 지민의 가장 자연스러운 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择承接夜间有雨并推动准备行动的一句。","ko-KR":"밤의 비를 받고 준비 행동으로 이어지는 문장을 고르세요."},"options":["낮에는 더워요.","봄에는 따뜻해요.","주말에 뭐 했어요?","그럼 우산이 필요해요?"],"config":{"shuffle":true},"answer":{"kind":"index","value":3},"explanation":{"correct":{"zh-CN":"그럼 우산이 필요해요?承接下雨并引出带伞建议。","ko-KR":"그럼 우산이 필요해요?는 비 소식을 받고 준비물로 이어집니다."},"feedback":[{"zh-CN":"先找影响晚间外出的天气。","ko-KR":"저녁 외출에 영향을 주는 날씨를 찾으세요."},{"zh-CN":"回应要把下雨连接到准备什么。","ko-KR":"비와 준비물을 연결하세요."},{"zh-CN":"规范答案是그럼 우산이 필요해요?。","ko-KR":"정답은 그럼 우산이 필요해요?입니다."}]}},
      {"key":"listening-plan-place","prompt":{"zh-CN":"听城市天气播报，判断明天下午天气怎样。","ko-KR":"도시 날씨 안내를 듣고 내일 오후 날씨를 고르세요."},"instruction":{"zh-CN":"正常语速最多两遍，慢速最多一遍；只依据音频原话作答。","ko-KR":"보통 속도 두 번, 느린 속도 한 번 듣고 음성에 근거해 답하세요."},"options":["맑습니다.","비가 옵니다.","눈이 옵니다.","덥습니다."],"config":{"audioId":"chapter-08-listening-plan-place","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":true},"answer":{"kind":"index","value":1},"transcript":"오늘 서울은 맑고 따뜻합니다. 낮 기온은 이십이 도입니다. 저녁에는 시원하지만 바람이 붑니다. 내일 오전에는 흐리고 오후에는 비가 옵니다. 우산을 준비하세요.","audioObjectKey":"korean-level-one/chapter-08/listening/chapter-08-listening-plan-place.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"原文明确说明明天下午有雨。","ko-KR":"원고는 내일 오후에 비가 온다고 말합니다."},"feedback":[{"zh-CN":"先找今天和明天的分界。","ko-KR":"오늘과 내일의 경계를 찾으세요."},{"zh-CN":"目标信息在내일 오전에는 흐리고之后。","ko-KR":"내일 오전에는 흐리고 뒤를 들으세요."},{"zh-CN":"答案是비가 옵니다.。","ko-KR":"정답은 비가 옵니다.입니다."}],"privateListening":{"slowScript":"오늘 서울은 맑고 따뜻합니다. / 낮 기온은 이십이 도입니다. / 저녁에는 시원하지만 바람이 붑니다. / 내일 오전에는 흐리고 오후에는 비가 옵니다. / 우산을 준비하세요.","pauseMarks":"오늘 서울은 맑고 따뜻합니다. ⏸ 낮 기온은 이십이 도입니다. ⏸ 저녁에는 시원하지만 바람이 붑니다. ⏸ 내일 오전에는 흐리고 오후에는 비가 옵니다. ⏸ 우산을 준비하세요.","speaker":"F03／校园天气播报员","distractorReasons":{"0":"晴朗温暖是今天总体天气。","2":"原文没有雪。","3":"今天白天气温不代表明天下午。"}}}},
      {"key":"speaking-invitation","prompt":{"zh-CN":"以校园天气播报员身份，完成约60秒、7—9句的城市天气播报。","ko-KR":"교내 날씨 안내자 역할로 약 60초, 7~9문장의 도시 날씨 안내를 하세요."},"instruction":{"zh-CN":"加入城市季节、今天-고天气、-지만时段反差、明天正式预报和有依据的建议。","ko-KR":"도시와 계절, 오늘 -고 날씨, -지만 대조, 내일 격식체 예보와 준비 안내를 넣으세요."},"options":[],"config":{"minimumSeconds":50,"maximumSeconds":70,"minimumTurns":7,"requiredCriteria":5,"enforceCompletionRequirements":true,"pronunciationScore":false,"turnLabel":{"zh-CN":"句数","ko-KR":"문장 수"},"criteria":["城市与季节特征","今天两项-고天气","一次-지만时段反差","明天正式预报","有依据的准备建议"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与五类自查；不产生正确性或分数。","ko-KR":"녹음 정보와 다섯 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查7—9句、城市季节、今天和明天。","ko-KR":"7~9문장, 도시와 계절, 오늘과 내일을 확인하세요."},{"zh-CN":"再检查-고、-지만、主体正式体和建议依据。","ko-KR":"-고, -지만, 격식체와 준비 근거를 확인하세요."},{"zh-CN":"按五项清单补齐后重录；不显示虚假发音分数。","ko-KR":"다섯 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
      {"key":"reading-weekend-chat","prompt":{"zh-CN":"阅读釜山周末天气公告，完成三道事实题。","ko-KR":"부산 주말 날씨 안내문을 읽고 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，依据公开公告原句作答。","ko-KR":"문제마다 하나를 고르고 공개된 안내문에서 근거를 찾으세요."},"options":[],"config":{"reading":"부산 주말 날씨\n토요일 부산은 맑고 따뜻합니다.\n낮에는 덥지만 밤에는 시원합니다.\n일요일 오전에는 흐리고 오후에는 비가 옵니다.\n바람도 붑니다.\n우산을 준비하세요.","items":[{"id":"q1","question":"토요일 부산 날씨는 어때요?","options":["눈이 옵니다.","흐리고 춥습니다.","맑고 따뜻합니다.","비가 옵니다."]},{"id":"q2","question":"일요일 오후에는 날씨가 어때요?","options":["비가 옵니다.","맑습니다.","눈이 옵니다.","덥습니다."]},{"id":"q3","question":"무엇을 준비해요?","options":["겉옷","장갑","모자","우산"]}],"shuffle":true,"shuffleOptions":true},"answer":{"kind":"index_array","value":[2,0,3]},"explanation":{"correct":{"zh-CN":"答案依次是맑고 따뜻합니다、비가 옵니다、우산。","ko-KR":"정답은 맑고 따뜻합니다, 비가 옵니다, 우산입니다."},"feedback":[{"zh-CN":"圈出周六、周日下午和最后建议句。","ko-KR":"토요일, 일요일 오후와 마지막 안내를 찾으세요."},{"zh-CN":"不要把夜间凉爽或其他场景外套带入。","ko-KR":"밤의 시원함이나 다른 장면의 겉옷을 섞지 마세요."},{"zh-CN":"依据公告将三题全部正确重做。","ko-KR":"안내문을 근거로 세 문제를 다시 푸세요."}]}},
      {"key":"write-weekend-invitation","prompt":{"zh-CN":"给同班同学写一张5—6句的原创城市天气卡。","ko-KR":"같은 반 친구에게 보여 줄 도시 날씨 카드를 5~6문장으로 쓰세요."},"instruction":{"zh-CN":"包含城市季节、今天两项天气、时段反差、明天正式预报和有依据的建议，并完成量规自查。","ko-KR":"도시와 계절, 오늘 날씨, 시간대 대조, 내일 격식체 예보와 준비 안내를 쓰고 점검하세요."},"options":[],"config":{"minSentences":5,"maxSentences":6,"minimumInformationKinds":5,"requireCompletionChecklist":true,"informationChecklist":["城市与季节特征","今天两项天气","时段反差","明天正式预报","有依据的准备建议"],"structureFrame":"___ 날씨입니다. → ___에는 ___습니다. → 오늘은 ___고 ___습니다. → ___에는 ___지만 ___에는 ___습니다. → 내일 ___에는 ___습니다. → ___을/를 준비하세요.","rubric":["信息完整","核心语法","建议依据","可理解度","格式与语气"],"rubricConfirmation":"我已按五维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、五类信息和量规自查的原创天气卡；不产生正确性或分数。","ko-KR":"문장 수, 다섯 정보와 자기 점검을 갖춘 날씨 카드를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数5—6句和五类信息。","ko-KR":"5~6문장과 다섯 정보를 먼저 세세요."},{"zh-CN":"检查ㅂ变化、-고/-지만、正式体和建议依据。","ko-KR":"ㅂ 변화, -고/-지만, 격식체와 준비 근거를 확인하세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
      {"key":"review-multiple","prompt":{"zh-CN":"选择所有能直接帮助完成城市天气播报的表达。","ko-KR":"도시 날씨 안내에 직접 사용할 수 있는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["오늘은 맑고 따뜻합니다.","얼마예요?","낮에는 덥지만 밤에는 시원합니다.","내일 오후에는 비가 옵니다."],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,2,3]},"explanation":{"correct":{"zh-CN":"第一、三、四项用于天气播报；얼마예요?用于询价。","ko-KR":"첫째, 셋째와 넷째는 날씨 안내이고 얼마예요?는 가격 질문입니다."},"feedback":[{"zh-CN":"按今天、时段变化和明天预报检查。","ko-KR":"오늘, 시간대 변화와 내일 예보를 확인하세요."},{"zh-CN":"有一句属于询价场景。","ko-KR":"한 문장은 가격을 묻습니다."},{"zh-CN":"选择三条天气表达，不选择얼마예요?。","ko-KR":"날씨 표현 세 개를 고르고 얼마예요?는 고르지 않습니다."}]}},
      {"key":"self-check","prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"vocabulary","label":"我能描述季节和时段天气／계절과 시간대 날씨를 말할 수 있어요"},{"id":"irregular","label":"我能正确变化덥다/춥다／덥다와 춥다를 바르게 활용할 수 있어요"},{"id":"connections","label":"我能使用-고和-지만／-고와 -지만을 사용할 수 있어요"},{"id":"readWrite","label":"我能读公告并写5—6句预报／안내문을 읽고 5~6문장을 쓸 수 있어요"},{"id":"speaking","label":"我能完成50—70秒天气播报／50~70초 날씨 안내를 할 수 있어요"}],"returnNodes":[{"value":"activity-words","label":"词汇"},{"value":"suggest-and-react","label":"语法"},{"value":"weekend-plan-talk","label":"对话理解"},{"value":"listen-and-invite","label":"听说"},{"value":"weekend-chat","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想词汇、语法、连接、读写和播报。","ko-KR":"어휘, 문법, 연결, 읽기·쓰기와 안내를 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
    ] $chapter_eight_activities$::jsonb)
  loop
    select activity.id into activity_uuid
    from public.digital_textbook_activities as activity
    join public.digital_textbook_nodes as node on node.id = activity.node_id
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and activity.activity_key = activity_seed->>'key';

    if activity_uuid is null then
      raise exception 'Cannot finalize chapter 08 activity %', activity_seed->>'key';
    end if;

    update public.digital_textbook_activities
    set prompt = activity_seed->'prompt', instruction = activity_seed->'instruction',
        options = activity_seed->'options', public_config = activity_seed->'config',
        updated_at = now()
    where id = activity_uuid;

    update public.digital_textbook_activity_secrets
    set answer_key = activity_seed->'answer', explanation = activity_seed->'explanation',
        transcript_ko = activity_seed->>'transcript',
        audio_object_key = activity_seed->>'audioObjectKey',
        audio_status = coalesce(activity_seed->>'audioStatus', 'pending'), updated_at = now()
    where activity_id = activity_uuid;
  end loop;

  delete from public.digital_textbook_activities as activity
  using public.digital_textbook_nodes as node, public.digital_textbook_modules as module
  where activity.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-plan-place',
      'speaking-invitation','reading-weekend-chat','write-weekend-invitation',
      'review-multiple','self-check'
    );

  for media_seed in
    select value from jsonb_array_elements($images$
    [
      {"nodeCode":"mission-map","key":"chapter-08-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-08/images/chapter-08-01-scene.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-01-章节情境主图.png","alt":{"zh-CN":"水果店里成年顾客指着苹果向店员询价，价格牌不可读。","ko-KR":"과일 가게에서 성인 손님이 읽을 수 없는 가격표 옆 사과를 가리키며 직원에게 가격을 묻습니다."},"width":1600,"height":900},
      {"nodeCode":"activity-words","key":"chapter-08-image-02","purpose":"核心词汇商品与单位卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-02-vocabulary.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-02-核心词汇卡-商品与单位.png","alt":{"zh-CN":"五种商品与개、병数量分组。","ko-KR":"다섯 상품과 개, 병 수량 묶음입니다."},"width":1200,"height":900},
      {"nodeCode":"suggest-and-react","key":"chapter-08-image-03","purpose":"购物语言工具语法总图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03-grammar-overview.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03-语法总图-购物语言工具.png","alt":{"zh-CN":"动作请求、数量、评价和追加四轨结构。","ko-KR":"동작 요청, 수량, 평가와 추가의 네 갈래 구조입니다."},"width":1600,"height":900},
      {"nodeCode":"suggest-and-react","key":"chapter-08-image-04","purpose":"-(으)세요结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03a-euseyo.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03A-语法结构图-으세요.png","alt":{"zh-CN":"动词词干按收音分流到으세요或세요。","ko-KR":"동사 어간의 받침에 따라 으세요와 세요로 나뉩니다."},"width":1200,"height":900},
      {"nodeCode":"suggest-and-react","key":"chapter-08-image-05","purpose":"固有词数量与量词结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03b-counters.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03B-语法结构图-固有词量词.png","alt":{"zh-CN":"一至四缩略形、개和병与金额对比。","ko-KR":"하나부터 넷의 준말, 개와 병, 금액 비교입니다."},"width":1200,"height":900},
      {"nodeCode":"suggest-and-react","key":"chapter-08-image-06","purpose":"形容词谓语结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03c-adjective.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03C-语法结构图-形容词谓语.png","alt":{"zh-CN":"商品接이或가后连接价格与大小形容词。","ko-KR":"상품 뒤에 이나 가를 붙여 가격과 크기 형용사로 연결합니다."},"width":1200,"height":900},
      {"nodeCode":"suggest-and-react","key":"chapter-08-image-07","purpose":"名词도追加结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03d-do.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03D-语法结构图-名词도.png","alt":{"zh-CN":"第一件商品到追加商品的도替换关系。","ko-KR":"첫 상품에서 추가 상품으로 이어지는 도의 대체 관계입니다."},"width":1200,"height":900},
      {"nodeCode":"plan-builder","key":"chapter-08-image-08","purpose":"句型交易语块卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-04-pattern-blocks.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-04-句型交易语块卡.png","alt":{"zh-CN":"六张完整购物话轮卡。","ko-KR":"여섯 장의 완전한 쇼핑 말차례 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"weekend-plan-talk","key":"chapter-08-image-09","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-08/images/chapter-08-05-dialogue.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-05-实战对话场景.png","alt":{"zh-CN":"水果店和便利店雨具货架的两组顾客与店员。","ko-KR":"과일 가게와 편의점 우산 매대의 두 고객·직원 장면입니다."},"width":1600,"height":900},
      {"nodeCode":"listen-and-invite","key":"chapter-08-image-10","purpose":"听力购物篮信息图","objectKey":"korean-level-one/chapter-08/images/chapter-08-06-listening-basket.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-06-听力信息图-购物篮.png","alt":{"zh-CN":"苹果、牛奶购物篮和随机金额卡，不显示数量答案。","ko-KR":"수량 답을 보여 주지 않는 사과, 우유 장바구니와 금액 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"weekend-chat","key":"chapter-08-image-11","purpose":"今日价格卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-07-price-card.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-07-今日价格卡.png","alt":{"zh-CN":"按商品、销售单位和金额分成四行的今日价格卡。","ko-KR":"상품, 판매 단위와 금액을 네 줄로 정리한 오늘의 가격표입니다."},"width":1200,"height":1600},
      {"nodeCode":"can-do-check","key":"chapter-08-image-12","purpose":"最终双角色交易流程图","objectKey":"korean-level-one/chapter-08/images/chapter-08-08-final-task.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-08-最终任务图.png","alt":{"zh-CN":"从询价到付款的九步双角色流程。","ko-KR":"가격 질문부터 계산까지 아홉 단계 두 역할 흐름입니다."},"width":1600,"height":900}
    ] $images$::jsonb)
  loop
    select node.id into node_uuid
    from public.digital_textbook_nodes as node
    join public.digital_textbook_modules as module on module.id = node.module_id
    where module.chapter_id = chapter_uuid
      and node.node_code = media_seed->>'nodeCode';

    insert into public.digital_textbook_media_assets (
      node_id, asset_key, media_type, purpose, object_key, production_status,
      alt_text, metadata
    ) values (
      node_uuid, media_seed->>'key', 'image', media_seed->>'purpose',
      media_seed->>'objectKey', 'pending', media_seed->'alt',
      jsonb_build_object(
        'width', (media_seed->>'width')::integer,
        'height', (media_seed->>'height')::integer,
        'plannedSourcePath', media_seed->>'plannedSourcePath',
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
  where module.chapter_id = chapter_uuid and node.node_code = 'activity-words';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid,
    'chapter-08-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
    'audio', '词汇原形点读',
    'korean-level-one/chapter-08/audio/vocabulary/chapter-08-vocabulary-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-08-vocabulary-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value->>'word')
  from jsonb_array_elements($vocabulary$
    [{"word":"가격","collocation":"상품 가격"},{"word":"얼마","collocation":"얼마예요?"},{"word":"원","collocation":"천 원이에요."},{"word":"모두","collocation":"모두 얼마예요?"},{"word":"사과","collocation":"사과 세 개"},{"word":"바나나","collocation":"바나나 두 개"},{"word":"우유","collocation":"우유 한 병"},{"word":"물","collocation":"물 두 병"},{"word":"우산","collocation":"우산이 커요."},{"word":"가방","collocation":"가방이 비싸요."},{"word":"가게","collocation":"과일 가게"},{"word":"손님","collocation":"손님이 물어요."},{"word":"직원","collocation":"가게 직원"},{"word":"사다","collocation":"사과를 사요."},{"word":"고르다","collocation":"여기에서 고르세요."},{"word":"보다","collocation":"한번 보세요."},{"word":"싸다","collocation":"사과가 싸요."},{"word":"비싸다","collocation":"우산이 비싸요."},{"word":"크다","collocation":"우산이 커요."},{"word":"작다","collocation":"가방이 작아요."},{"word":"개","collocation":"세 개"},{"word":"병","collocation":"한 병"}]
  $vocabulary$::jsonb) with ordinality item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid,
    'chapter-08-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
    'audio', '词汇搭配例句点读',
    'korean-level-one/chapter-08/audio/vocabulary/chapter-08-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-08-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value->>'collocation')
  from jsonb_array_elements($vocabulary$
    [{"word":"가격","collocation":"상품 가격"},{"word":"얼마","collocation":"얼마예요?"},{"word":"원","collocation":"천 원이에요."},{"word":"모두","collocation":"모두 얼마예요?"},{"word":"사과","collocation":"사과 세 개"},{"word":"바나나","collocation":"바나나 두 개"},{"word":"우유","collocation":"우유 한 병"},{"word":"물","collocation":"물 두 병"},{"word":"우산","collocation":"우산이 커요."},{"word":"가방","collocation":"가방이 비싸요."},{"word":"가게","collocation":"과일 가게"},{"word":"손님","collocation":"손님이 물어요."},{"word":"직원","collocation":"가게 직원"},{"word":"사다","collocation":"사과를 사요."},{"word":"고르다","collocation":"여기에서 고르세요."},{"word":"보다","collocation":"한번 보세요."},{"word":"싸다","collocation":"사과가 싸요."},{"word":"비싸다","collocation":"우산이 비싸요."},{"word":"크다","collocation":"우산이 커요."},{"word":"작다","collocation":"가방이 작아요."},{"word":"개","collocation":"세 개"},{"word":"병","collocation":"한 병"}]
  $vocabulary$::jsonb) with ordinality item(value, ordinality)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'suggest-and-react';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid, item.value->>'id', 'audio', '语法卡母版与语境复现例句',
    'korean-level-one/chapter-08/audio/grammar/' || (item.value->>'id') || '.mp3',
    'pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', item.value->>'id', 'script', item.value->>'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-08-grammar-01-example-01","script":"이 가방을 보세요."},{"id":"chapter-08-grammar-01-example-02","script":"네, 여기에서 고르세요."},{"id":"chapter-08-grammar-01-example-03","script":"한번 보세요."},{"id":"chapter-08-grammar-02-example-01","script":"사과 세 개 주세요."},{"id":"chapter-08-grammar-02-example-02","script":"사과 세 개 주세요."},{"id":"chapter-08-grammar-02-example-03","script":"민지는 사과 세 개를 사요."},{"id":"chapter-08-grammar-03-example-01","script":"이 사과가 싸요."},{"id":"chapter-08-grammar-03-example-02","script":"사과가 싸요."},{"id":"chapter-08-grammar-03-example-03","script":"이 우산이 커요."},{"id":"chapter-08-grammar-04-example-01","script":"우유도 한 병 주세요."},{"id":"chapter-08-grammar-04-example-02","script":"바나나도 두 개 주세요."},{"id":"chapter-08-grammar-04-example-03","script":"우유도 한 병 사요."}]
  $grammar$::jsonb) item(value)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'weekend-plan-talk';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid, item.value->>'id', 'audio', item.value->>'purpose',
    'korean-level-one/chapter-08/audio/dialogue/' || (item.value->>'id') || '.mp3',
    'pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,
    item.value - 'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-08-dialogue-main-line-01","purpose":"主对话逐句","script":"사과가 얼마예요?","speaker":"F01／민지"},{"id":"chapter-08-dialogue-main-line-02","purpose":"主对话逐句","script":"한 개에 천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-08-dialogue-main-line-03","purpose":"主对话逐句","script":"사과가 싸요. 사과 세 개 주세요.","speaker":"F01／민지"},{"id":"chapter-08-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 여기에서 고르세요.","speaker":"F02／수빈"},{"id":"chapter-08-dialogue-main-line-05","purpose":"主对话逐句","script":"바나나도 두 개 주세요.","speaker":"F01／민지"},{"id":"chapter-08-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 바나나는 두 개에 이천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-08-dialogue-main-line-07","purpose":"主对话逐句","script":"모두 얼마예요?","speaker":"F01／민지"},{"id":"chapter-08-dialogue-main-line-08","purpose":"主对话逐句","script":"모두 오천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-08-dialogue-main-line-09","purpose":"主对话逐句","script":"네, 여기요.","speaker":"F01／민지"},{"id":"chapter-08-dialogue-main-line-10","purpose":"主对话逐句","script":"감사합니다.","speaker":"F02／수빈"},{"id":"chapter-08-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／F02"},{"id":"chapter-08-dialogue-alt-line-01","purpose":"第二对话逐句","script":"이 우산이 얼마예요?","speaker":"M01／준호"},{"id":"chapter-08-dialogue-alt-line-02","purpose":"第二对话逐句","script":"만 원이에요.","speaker":"M02／현우"},{"id":"chapter-08-dialogue-alt-line-03","purpose":"第二对话逐句","script":"조금 비싸요. 저 우산도 만 원이에요?","speaker":"M01／준호"},{"id":"chapter-08-dialogue-alt-line-04","purpose":"第二对话逐句","script":"아니요, 칠천 원이에요. 이 우산이 커요. 한번 보세요.","speaker":"M02／현우"},{"id":"chapter-08-dialogue-alt-line-05","purpose":"第二对话逐句","script":"네, 이 우산 주세요.","speaker":"M01／준호"},{"id":"chapter-08-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 감사합니다.","speaker":"M02／현우"},{"id":"chapter-08-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M01／M02"}]
  $dialogue$::jsonb) item(value)
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
    and node.node_code = 'listen-and-invite'
    and activity.activity_key = 'listening-plan-place';

  insert into public.digital_textbook_media_assets (
    node_id, activity_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  ) values
    (node_uuid,activity_uuid,'chapter-08-listening-plan-place-normal','audio','私有听力正常语速','korean-level-one/chapter-08/listening/chapter-08-listening-plan-place-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"normal"}'::jsonb),
    (node_uuid,activity_uuid,'chapter-08-listening-plan-place-slow','audio','私有听力慢速','korean-level-one/chapter-08/listening/chapter-08-listening-plan-place-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"slow"}'::jsonb)
  on conflict (node_id, asset_key) do update set
    activity_id = excluded.activity_id,
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    alt_text = excluded.alt_text,
    metadata = excluded.metadata,
    updated_at = now();

  for media_seed in
    select value from jsonb_array_elements($chapter_eight_images$
    [
      {"key":"chapter-08-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-08/images/chapter-08-01-scene.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-01-章节情境主图.png","alt":{"zh-CN":"学校大厅天气显示屏前，两名成年学生准备晚间外出。","ko-KR":"학교 로비 날씨 화면 앞에서 성인 학생 두 명이 저녁 외출을 준비합니다."},"width":1600,"height":900},
      {"key":"chapter-08-image-02","purpose":"核心词汇季节与天气卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-02-vocabulary.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-02-核心词汇卡-季节与天气.png","alt":{"zh-CN":"四季、五种天气、三个时段和两件准备物。","ko-KR":"사계절, 다섯 날씨, 세 시간대와 두 준비물입니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-03","purpose":"天气描述与播报语法总图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03-grammar-overview.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03-语法总图-天气描述与播报.png","alt":{"zh-CN":"不规则、相加、转折与正式体总流程。","ko-KR":"불규칙, 첨가, 대조와 격식체의 전체 흐름입니다."},"width":1600,"height":900},
      {"key":"chapter-08-image-04","purpose":"ㅂ不规则结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03a-b-irregular.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03A-语法结构图-ㅂ不规则.png","alt":{"zh-CN":"덥다和춥다按词尾起始音分流。","ko-KR":"덥다와 춥다가 어미 첫소리에 따라 나뉩니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-05","purpose":"-지만结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03b-jiman.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03B-语法结构图-지만.png","alt":{"zh-CN":"两项天气的反差箭头。","ko-KR":"두 날씨 정보의 대조 화살표입니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-06","purpose":"正式体结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03c-formal.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03C-语法结构图-正式体.png","alt":{"zh-CN":"词干收音分流到습니다或ㅂ니다。","ko-KR":"어간 받침에 따라 습니다와 ㅂ니다로 나뉩니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-07","purpose":"天气-고结构图","objectKey":"korean-level-one/chapter-08/images/chapter-08-03d-weather-go.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-03D-语法结构图-天气고.png","alt":{"zh-CN":"两项相加天气连接图。","ko-KR":"두 날씨 정보를 더하는 연결 그림입니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-08","purpose":"句型播报语块卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-04-pattern-blocks.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-04-句型播报语块卡.png","alt":{"zh-CN":"五张完整天气播报句卡。","ko-KR":"다섯 장의 완전한 날씨 안내 문장 카드입니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-09","purpose":"实战对话场景图","objectKey":"korean-level-one/chapter-08/images/chapter-08-05-dialogue.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-05-实战对话场景.png","alt":{"zh-CN":"大厅与教室窗边两组天气对话人物。","ko-KR":"로비와 교실 창가의 두 날씨 대화 장면입니다."},"width":1600,"height":900},
      {"key":"chapter-08-image-10","purpose":"听力今天明天时间线","objectKey":"korean-level-one/chapter-08/images/chapter-08-06-listening-timeline.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-06-听力信息图-今天明天.png","alt":{"zh-CN":"今天明天时间线和四种天气图标。","ko-KR":"오늘과 내일 시간선과 네 날씨 아이콘입니다."},"width":1200,"height":900},
      {"key":"chapter-08-image-11","purpose":"城市周末天气卡","objectKey":"korean-level-one/chapter-08/images/chapter-08-07-city-weekend.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-07-城市周末天气卡.png","alt":{"zh-CN":"手机天气公告栏风格的双日生活天气公告。","ko-KR":"휴대전화 날씨 앱 형식의 이틀 생활 날씨 안내입니다."},"width":1200,"height":1600},
      {"key":"chapter-08-image-12","purpose":"最终天气播报流程图","objectKey":"korean-level-one/chapter-08/images/chapter-08-08-final-task.png","plannedSourcePath":"../附件/韩国语1级/第07课/第07课-08-最终任务图.png","alt":{"zh-CN":"从城市季节到准备建议的一分钟播报流程。","ko-KR":"도시와 계절부터 준비 안내까지 이어지는 1분 안내 흐름입니다."},"width":1600,"height":900}
    ] $chapter_eight_images$::jsonb)
  loop
    update public.digital_textbook_media_assets
    set purpose = media_seed->>'purpose', object_key = media_seed->>'objectKey',
        production_status = 'pending', alt_text = media_seed->'alt',
        metadata = jsonb_build_object('width',(media_seed->>'width')::integer,'height',(media_seed->>'height')::integer,'plannedSourcePath',media_seed->>'plannedSourcePath','sourceStatus','待制作'),
        updated_at = now()
    where asset_key = media_seed->>'key'
      and node_id in (select node.id from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id = node.module_id where module.chapter_id = chapter_uuid);
  end loop;

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'activity-words';

  for vocabulary_seed in
    select value, ordinality from jsonb_array_elements($chapter_eight_vocabulary$
    [{"word":"계절","collocation":"무슨 계절이에요?"},{"word":"봄","collocation":"봄에는 따뜻해요."},{"word":"여름","collocation":"여름에는 더워요."},{"word":"가을","collocation":"가을에는 시원해요."},{"word":"겨울","collocation":"겨울에는 추워요."},{"word":"날씨","collocation":"날씨가 어때요?"},{"word":"기온","collocation":"낮 기온"},{"word":"아침","collocation":"아침에는 맑아요."},{"word":"낮","collocation":"낮에는 더워요."},{"word":"밤","collocation":"밤에는 시원해요."},{"word":"맑다","collocation":"날씨가 맑아요."},{"word":"흐리다","collocation":"날씨가 흐려요."},{"word":"덥다","collocation":"낮에는 더워요."},{"word":"춥다","collocation":"밤에는 추워요."},{"word":"따뜻하다","collocation":"맑고 따뜻해요."},{"word":"시원하다","collocation":"밤에는 시원해요."},{"word":"비","collocation":"비가 와요."},{"word":"눈","collocation":"눈이 와요."},{"word":"바람","collocation":"바람이 불어요."},{"word":"우산","collocation":"우산을 준비하세요."},{"word":"겉옷","collocation":"겉옷을 가져가세요."},{"word":"준비하다","collocation":"우산을 준비하세요."}]
    $chapter_eight_vocabulary$::jsonb) with ordinality item(value, ordinality)
  loop
    update public.digital_textbook_media_assets
    set metadata = jsonb_build_object('audioId','chapter-08-vocabulary-' || lpad(vocabulary_seed.ordinality::text,2,'0'),'script',vocabulary_seed.value->>'word'), updated_at = now()
    where node_id = node_uuid and asset_key = 'chapter-08-vocabulary-' || lpad(vocabulary_seed.ordinality::text,2,'0');
    update public.digital_textbook_media_assets
    set metadata = jsonb_build_object('audioId','chapter-08-vocabulary-collocation-' || lpad(vocabulary_seed.ordinality::text,2,'0'),'script',vocabulary_seed.value->>'collocation'), updated_at = now()
    where node_id = node_uuid and asset_key = 'chapter-08-vocabulary-collocation-' || lpad(vocabulary_seed.ordinality::text,2,'0');
  end loop;

  update public.digital_textbook_media_assets as media
  set metadata = jsonb_build_object('audioId', grammar.value->>'id', 'script', grammar.value->>'script'), updated_at = now()
  from jsonb_array_elements($chapter_eight_grammar_audio$
    [{"id":"chapter-08-grammar-01-example-01","script":"여름에는 날씨가 더워요."},{"id":"chapter-08-grammar-01-example-02","script":"낮에는 더워요. 바람도 불어요."},{"id":"chapter-08-grammar-01-example-03","script":"낮에는 따뜻하지만 밤에는 추워요."},{"id":"chapter-08-grammar-02-example-01","script":"낮에는 덥지만 밤에는 시원해요."},{"id":"chapter-08-grammar-02-example-02","script":"밤에는 시원하지만 비가 와요."},{"id":"chapter-08-grammar-02-example-03","script":"낮에는 덥지만 밤에는 시원합니다."},{"id":"chapter-08-grammar-03-example-01","script":"오늘 서울은 맑습니다."},{"id":"chapter-08-grammar-03-example-02","script":"내일 오전에는 흐리고 오후에는 비가 옵니다."},{"id":"chapter-08-grammar-03-example-03","script":"토요일 부산은 맑고 따뜻합니다."},{"id":"chapter-08-grammar-04-example-01","script":"오늘은 맑고 따뜻해요."},{"id":"chapter-08-grammar-04-example-02","script":"오전에는 흐리고 오후에는 맑아요."},{"id":"chapter-08-grammar-04-example-03","script":"일요일 오전에는 흐리고 오후에는 비가 옵니다."}]
  $chapter_eight_grammar_audio$::jsonb) grammar(value)
  where media.asset_key = grammar.value->>'id'
    and media.node_id in (select node.id from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid);

  delete from public.digital_textbook_media_assets
  where asset_key in ('chapter-08-dialogue-main-line-09','chapter-08-dialogue-main-line-10')
    and node_id in (select node.id from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid);

  update public.digital_textbook_media_assets as media
  set metadata = dialogue.value - 'purpose', purpose = dialogue.value->>'purpose', updated_at = now()
  from jsonb_array_elements($chapter_eight_dialogue_audio$
    [{"id":"chapter-08-dialogue-main-line-01","purpose":"主对话逐句","script":"오늘 날씨가 어때요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-02","purpose":"主对话逐句","script":"아침에는 맑고 따뜻해요.","speaker":"M01／준호"},{"id":"chapter-08-dialogue-main-line-03","purpose":"主对话逐句","script":"낮에도 따뜻해요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-04","purpose":"主对话逐句","script":"아니요. 낮에는 더워요. 바람도 불어요.","speaker":"M01／준호"},{"id":"chapter-08-dialogue-main-line-05","purpose":"主对话逐句","script":"밤에는 어때요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-06","purpose":"主对话逐句","script":"밤에는 시원하지만 비가 와요.","speaker":"M01／준호"},{"id":"chapter-08-dialogue-main-line-07","purpose":"主对话逐句","script":"그럼 우산이 필요해요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-08","purpose":"主对话逐句","script":"네, 우산을 가져가세요.","speaker":"M01／준호"},{"id":"chapter-08-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},{"id":"chapter-08-dialogue-alt-line-01","purpose":"第二对话逐句","script":"내일 날씨가 어때요?","speaker":"F02／소라"},{"id":"chapter-08-dialogue-alt-line-02","purpose":"第二对话逐句","script":"오전에는 흐리고 오후에는 맑아요.","speaker":"M02／민수"},{"id":"chapter-08-dialogue-alt-line-03","purpose":"第二对话逐句","script":"기온은 어때요?","speaker":"F02／소라"},{"id":"chapter-08-dialogue-alt-line-04","purpose":"第二对话逐句","script":"낮에는 따뜻하지만 밤에는 추워요.","speaker":"M02／민수"},{"id":"chapter-08-dialogue-alt-line-05","purpose":"第二对话逐句","script":"그럼 겉옷이 필요해요?","speaker":"F02／소라"},{"id":"chapter-08-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 겉옷을 가져가세요.","speaker":"M02／민수"},{"id":"chapter-08-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／M02"}]
  $chapter_eight_dialogue_audio$::jsonb) dialogue(value)
  where media.asset_key = dialogue.value->>'id'
    and media.node_id in (select node.id from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid);

  delete from public.digital_textbook_media_assets as media
  using public.digital_textbook_nodes as node, public.digital_textbook_modules as module
  where media.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and media.asset_key not like 'chapter-08-%';
end;
$seed$;

-- Finalize the copied, already-accepted seeding scaffold with chapter-eight
-- master data. This block deliberately contains no new grading or completion
-- mechanism: it only supplies this chapter's content and private answer data.
do $chapter_eight$
declare
  chapter_uuid uuid;
  test_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
  item jsonb;
begin
  select chapter.id, chapter.chapter_test_id into chapter_uuid, test_uuid
  from public.digital_textbook_chapters chapter
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 8
  order by version.version_number desc
  limit 1;

  if chapter_uuid is null or test_uuid is null then
    raise exception 'Cannot finalize chapter 08 master content';
  end if;

  update public.digital_textbook_chapters set
    slug = 'movie-plan',
    title = '{"zh-CN":"一起看电影好吗？","ko-KR":"영화 볼까요?"}'::jsonb,
    scenario = '{"zh-CN":"智敏和敏秀在校园海报栏旁商量周末活动，在电影无票后改约展览；秀珍和丹尼尔看完电影后表达现场感受并提议散步。","ko-KR":"지민과 민수는 학교 행사 게시판 앞에서 주말 활동을 의논하고 영화 표가 없어 전시회로 바꿉니다. 수진과 다니엘은 영화를 본 뒤 느낌을 말하고 산책을 제안합니다."}'::jsonb,
    goal = '{"zh-CN":"使用-(으)ㄹ까요?、ㄷ不规则、指示冠形词和-네요，完成40—55秒、8—10轮且含备选方案的双角色邀约。","ko-KR":"-(으)ㄹ까요?, ㄷ 불규칙, 지시 관형사와 -네요를 사용해 대안을 포함한 40~55초, 8~10턴의 두 역할 약속 대화를 합니다."}'::jsonb,
    status = 'draft', production_status = 'editorial_review',
    editorial_status = 'pending', native_review_status = 'pending',
    audio_status = 'pending', image_status = 'pending',
    source_revision = 'UPLY BOOK 第08课 영화 볼까요.md @ 2026-08-18 / sha256:b3fbbc639b8aa8880301f59e53ede19983364abf2ceec83595aac6898aeb44c0',
    updated_at = now()
  where id = chapter_uuid;

  update public.chapter_tests set
    slug = 'korean-level-one-08', course_key = 'korean-level-one', chapter_number = 8,
    title = '第 08 章测试：一起看电影好吗？', korean_title = '제08과 평가: 영화 볼까요?',
    description = '检查周末活动词汇、-(으)ㄹ까요?、ㄷ不规则、指示冠形词、-네요及含备选方案的邀约理解。',
    duration_minutes = 12, passing_score = 60,
    skills = '{"recognition":"周末活动、地点与回应词汇","structure":"建议形、ㄷ不规则、指示冠形词与-네요","reading":"邀约对话与聊天事实理解","assembly":"含备选方案的双角色邀约组织"}'::jsonb,
    version = 1, status = 'draft', updated_at = now()
  where id = test_uuid;

  delete from public.chapter_test_questions where test_id = test_uuid;
  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation, skill,
    sort_order, question_type, default_points, difficulty, tags, status, version,
    is_chapter_test_item, ebook_section_step, ebook_page_reference
  ) values
    (test_uuid,'golden-08-01','“극장”是什么意思？','["电影院","美术馆","公园","展览"]',0,'극장是放映电影的场所。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-08-02','“보다”的共同建议形是哪一项？','["볼까요?","보을까요?","봤어요?","보세요."]',0,'보-无收音，接-ㄹ까요写作볼까요。','structure',2,'single_choice',10,'foundation','["建议形","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-08-03','“걷다”的共同建议形是哪一项？','["걸을까요?","걷을까요?","걸까요?","걷까요?"]',0,'걷다在元音起始词尾前ㄷ变ㄹ，形成걸을까요。','structure',3,'single_choice',10,'foundation','["ㄷ不规则","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-08-04','说话人拿着电影海报时，哪一句最合适？','["이 영화를 볼까요?","그 영화를 볼까요?","저 영화를 볼까요?","이 볼까요?"]',0,'靠近说话人的具体名词前使用이。','structure',4,'single_choice',10,'foundation','["指示冠形词","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-08-05','刚看完电影表达新发现，哪一句最自然？','["영화가 정말 재미있네요!","영화가 재미있을까요?","영화를 볼까요?","영화가 재미있어요?"]',0,'刚体验后的发现感使用-네요。','structure',5,'single_choice',10,'foundation','["-네요","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-08-06','主场景最终决定参加什么活动？','["看展览","看电影","看演出","拍照"]',0,'电影周六无票后改为去看展览。','reading',6,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-08-07','主场景在哪里见面？','["美术馆前","电影院前","公园入口","学校门口"]',0,'第6轮与第8轮确认美术馆前。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-08-08','私有听力中两人在哪里见面？','["电影院前","公园入口","美术馆前","学校门口"]',0,'听力末句明确说극장 앞에서 만나요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-08-09','阅读聊天中为什么改变计划？','["星期六没票","美术馆太远","没有时间","演出不好看"]',0,'第二个气泡明确说明토요일 표가 없어요。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-08-10','阅读聊天中最终何时何地见面？','["下午两点／美术馆前","下午三点／电影院前","下午四点／公园入口","上午两点／学校前"]',0,'最后两条信息确定下午两点在美术馆前。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-08-11','第一个方案不可行后，最自然的下一步是哪一项？','["承接原因并提出不同备选","重复原方案","直接结束对话","只说地点"]',0,'母本邀约链要求承接调整线索并提出备选活动。','assembly',11,'single_choice',10,'medium','["邀约组织","母本§3.4"]','draft',1,true,'STEP 08','母本 §3.4'),
    (test_uuid,'golden-08-12','课末双角色邀约必须满足哪一项？','["40—55秒、8—10轮并含八类信息","单人独白即可","必须显示自动发音分数","只要提出第一方案"]',0,'母本规定40—55秒、8—10轮、双角色和八类信息，且不做虚假发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","node":"mission-map","minutes":5,"title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"第一个方案不行时，怎样继续约？","ko-KR":"첫 계획이 어려우면 어떻게 약속을 이어 갈까요?"},"content":{"lead":{"zh-CN":"真实邀约要听懂调整线索，提出备选，并确认时间地点。","ko-KR":"실제 약속에서는 조정 이유를 듣고 대안을 제시한 뒤 시간과 장소를 확인합니다."},"targets":[{"ko":"이번 주말에 같이 영화 볼까요?","zh":"发起邀约"},{"ko":"그럼 전시회에 갈까요?","zh":"提出备选"},{"ko":"토요일 세 시에 만날까요?","zh":"商量时间"},{"ko":"미술관 앞에서 만나요.","zh":"确认地点"}],"finalOutput":{"zh-CN":"40—55秒、8—10轮，包含八类信息的双角色邀约。","ko-KR":"여덟 정보를 포함한 40~55초, 8~10턴의 두 역할 약속 대화입니다."},"coach":{"zh-CN":"答对不计分诊断即完成；课末流程复述为自主展示。","ko-KR":"점수 없는 진단 정답만 필수이며 마지막 과제 설명은 자율 활동입니다."},"nextNode":"activity-words"}},
    {"code":"vocabulary","node":"activity-words","minutes":10,"title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"先把活动、地点和回应配成块","ko-KR":"활동, 장소와 응답을 말덩이로 익히기"},"content":{"lead":{"zh-CN":"按活动／地点识别、原形点读、搭配跟读和建议句替换学习；全部音频待制作。","ko-KR":"활동과 장소를 확인하고 기본형, 결합과 제안 문장으로 익힙니다. 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"영화","zh":"电影","pos":"名词","collocation":"영화를 보다"},{"ko":"공연","zh":"演出","pos":"名词","collocation":"공연을 보다"},{"ko":"전시회","zh":"展览","pos":"名词","collocation":"전시회에 가다"},{"ko":"음악","zh":"音乐","pos":"名词","collocation":"음악을 듣다"},{"ko":"산책","zh":"散步","pos":"名词","collocation":"산책을 하다"},{"ko":"사진","zh":"照片","pos":"名词","collocation":"사진을 찍다"},{"ko":"표","zh":"票","pos":"名词","collocation":"토요일 표가 없다"},{"ko":"주말","zh":"周末","pos":"名词","collocation":"이번 주말에"},{"ko":"시간","zh":"时间","pos":"名词","collocation":"시간이 괜찮다"},{"ko":"극장","zh":"电影院","pos":"名词","collocation":"극장 앞에서 만나다"},{"ko":"미술관","zh":"美术馆","pos":"名词","collocation":"미술관 앞에서 만나다"},{"ko":"공원","zh":"公园","pos":"名词","collocation":"공원에서 걷다"},{"ko":"앞","zh":"前面","pos":"名词","collocation":"극장 앞／미술관 앞"},{"ko":"보다","zh":"看","pos":"动词","collocation":"영화를 보다"},{"ko":"가다","zh":"去","pos":"动词","collocation":"전시회에 가다"},{"ko":"걷다","zh":"走、步行","pos":"动词","collocation":"공원에서 걷다"},{"ko":"듣다","zh":"听","pos":"动词","collocation":"음악을 듣다"},{"ko":"찍다","zh":"拍摄","pos":"动词","collocation":"사진을 찍다"},{"ko":"재미있다","zh":"有趣","pos":"形容词","collocation":"영화가 재미있다"},{"ko":"괜찮다","zh":"不错、可以","pos":"形容词","collocation":"시간이 괜찮다"},{"ko":"같이","zh":"一起","pos":"副词","collocation":"같이 영화 볼까요?"}],"coach":{"zh-CN":"词义正确并确认朗读整句才完成；21词点读与图片快说为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"suggest-and-react"}},
    {"code":"grammar","node":"suggest-and-react","minutes":18,"title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"提议、指明、变形，再说出新发现","ko-KR":"제안하고 가리키며 활용한 뒤 새 발견 말하기"},"content":{"lead":{"zh-CN":"四个工具分别负责共同建议、ㄷ词干变化、具体对象和现场发现。","ko-KR":"네 도구로 공동 제안, ㄷ 활용, 구체적 대상과 현장 발견을 표현합니다."},"grammarCards":[{"form":"V-(으)ㄹ까요?","function":{"zh-CN":"提出共同建议或商量。","ko-KR":"함께 할 일을 제안하거나 의논합니다."},"rules":["无收音接-ㄹ까요","有收音接-을까요","ㄹ收音不重复ㄹ","本课用于共同建议"],"examples":[{"ko":"주말에 영화 볼까요?","zh":"周末一起看电影好吗？","audioId":"chapter-08-grammar-01-example-01","audioStatus":"pending"},{"ko":"민수 씨, 이번 주말에 같이 영화 볼까요?","zh":"敏秀，这周末一起看电影好吗？","audioId":"chapter-08-grammar-01-example-02","audioStatus":"pending"},{"ko":"이번 토요일에 이 공연을 볼까요?","zh":"这周六看这场演出好吗？","audioId":"chapter-08-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：볼을까요；보-无收音，直接接-ㄹ까요。","ko-KR":"잘못: 볼을까요. 보-에 -ㄹ까요를 붙입니다."},"comparison":{"zh-CN":"볼까요等待共同决定；봐요是一般礼貌体陈述。","ko-KR":"볼까요는 함께 정하고 봐요는 일반 해요체입니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"ㄷ不规则","function":{"zh-CN":"自然变化걷다和듣다。","ko-KR":"걷다와 듣다를 자연스럽게 활용합니다."},"rules":["元音起始词尾前ㄷ变ㄹ","걷다→걸을까요","듣다→들을까요","닫다等规则词不套用"],"examples":[{"ko":"공원에서 걸을까요?","zh":"在公园走走好吗？","audioId":"chapter-08-grammar-02-example-01","audioStatus":"pending"},{"ko":"전시회를 보고 공원에서 걸을까요?","zh":"看完展览后去公园走走好吗？","audioId":"chapter-08-grammar-02-example-02","audioStatus":"pending"},{"ko":"공연 후에 공원에서 걸을까요?","zh":"演出后去公园走走好吗？","audioId":"chapter-08-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：걷을까요；应写걸을까요。","ko-KR":"잘못: 걷을까요. 걸을까요라고 씁니다."},"comparison":{"zh-CN":"걷다→걸을까요是不规则；찍다→찍을까요是规则。","ko-KR":"걷다는 불규칙이고 찍다는 규칙 활용입니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"이／그／저 + N","function":{"zh-CN":"指明具体对象。","ko-KR":"구체적인 대상을 가리킵니다."},"rules":["靠近说话人用이","靠近听话人或已提到用그","双方都远用저","必须放在名词前并分写"],"examples":[{"ko":"이 영화를 볼까요?","zh":"看这部电影好吗？","audioId":"chapter-08-grammar-03-example-01","audioStatus":"pending"},{"ko":"그 영화는 토요일 표가 없어요.","zh":"那部电影周六没票。","audioId":"chapter-08-grammar-03-example-02","audioStatus":"pending"},{"ko":"그럼 이 전시회에 갈까요?","zh":"那么去看这个展览好吗？","audioId":"chapter-08-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：이 볼까요；이后必须跟名词。","ko-KR":"잘못: 이 볼까요. 이 뒤에는 명사가 필요합니다."},"comparison":{"zh-CN":"이 영화保留类别；이거单独指物。","ko-KR":"이 영화는 종류를 밝히고 이거는 홀로 대상을 가리킵니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"A/V-네요","function":{"zh-CN":"表达刚发现或亲身感受。","ko-KR":"새로 알거나 직접 느낀 것을 말합니다."},"rules":["本课谓词词干直接接-네요","与词干连写","可用句号或感叹号","不等于所有普通陈述"],"examples":[{"ko":"영화가 정말 재미있네요!","zh":"电影真的很有趣啊！","audioId":"chapter-08-grammar-04-example-01","audioStatus":"pending"},{"ko":"영화가 정말 재미있네요!","zh":"电影真的很有趣啊！","audioId":"chapter-08-grammar-04-example-02","audioStatus":"pending"},{"ko":"오후 두 시가 괜찮네요.","zh":"下午两点挺合适啊。","audioId":"chapter-08-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"没有新信息时不要机械用-네요。","ko-KR":"새 정보가 없을 때 -네요를 기계적으로 쓰지 않습니다."},"comparison":{"zh-CN":"재미있어요中性说明；재미있네요强调刚体验后的发现。","ko-KR":"재미있어요는 중립 설명이고 재미있네요는 새 느낌입니다."},"source":{"zh-CN":"母本§5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"六题全部正确才完成；规则解释与扩展变形为自主练习。","ko-KR":"여섯 문제를 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"plan-builder"}},
    {"code":"patterns","node":"plan-builder","minutes":11,"title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"把“提议”推进成“约定”","ko-KR":"제안을 약속으로 이어 가기"},"content":{"lead":{"zh-CN":"把建议、调整、备选、时间和地点按真实话轮连接。","ko-KR":"제안, 조정, 대안, 시간과 장소를 실제 말차례로 연결합니다."},"replacementSets":[["영화 볼까요?","공연을 볼까요?","전시회에 갈까요?","사진을 찍을까요?"],["공원에서 걸을까요?","같이 음악을 들을까요?","사진을 찍을까요?"],["이 영화를 볼까요?","그 공연을 볼까요?","저 전시회에 갈까요?"]],"orderItems":["그럼 전시회에 갈까요?","네, 미술관 앞에서 만나요.","좋은 생각이에요. 그런데 토요일 표가 없어요.","이번 주말에 같이 영화 볼까요?","좋아요. 토요일 세 시에 만날까요?"],"personalFrames":["___을/를 할까요?／___에 갈까요?","이/그/저 ___","___이/가 괜찮네요."],"coach":{"zh-CN":"五个完整话轮排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"다섯 말차례 배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"weekend-plan-talk"}},
    {"code":"dialogue","node":"weekend-plan-talk","minutes":13,"title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"方案变了，也能把约定继续完成","ko-KR":"계획이 바뀌어도 약속을 끝까지 정하기"},"content":{"lead":{"zh-CN":"主场景从电影无票推进到展览、时间地点与散步；第二场景练现场发现与临时提议。","ko-KR":"첫 장면은 영화 표가 없어 전시회, 시간, 장소와 산책으로 이어지고 두 번째 장면은 현장 발견과 제안을 연습합니다."},"dialogueScenes":[{"title":{"zh-CN":"校园休息区活动海报栏","ko-KR":"학교 휴게실 행사 게시판"},"people":{"zh-CN":"智敏与敏秀，同班朋友","ko-KR":"지민과 민수, 같은 반 친구"},"purpose":{"zh-CN":"电影无票后改选展览，并确认时间、地点和散步。","ko-KR":"영화 표가 없어 전시회를 고르고 시간, 장소와 산책을 정합니다."},"audioId":"chapter-08-dialogue-main","audioStatus":"pending","lines":[{"speaker":"지민","ko":"민수 씨, 이번 주말에 같이 영화 볼까요?","zh":"敏秀，这周末一起看电影好吗？"},{"speaker":"민수","ko":"좋아요. 어떤 영화를 볼까요?","zh":"好啊，看什么电影呢？"},{"speaker":"지민","ko":"이 영화를 볼까요? 재미있어요.","zh":"看这部电影好吗？很有趣。"},{"speaker":"민수","ko":"미안해요. 그 영화는 토요일 표가 없어요. 전시회에 갈까요?","zh":"不好意思，那部电影周六没票。去看展览好吗？"},{"speaker":"지민","ko":"좋아요. 토요일 세 시에 만날까요?","zh":"好啊，星期六三点见好吗？"},{"speaker":"민수","ko":"네, 미술관 앞에서 만나요.","zh":"好，在美术馆前见。"},{"speaker":"지민","ko":"전시회를 보고 공원에서 걸을까요?","zh":"看完展览后去公园走走好吗？"},{"speaker":"민수","ko":"좋아요. 토요일 세 시, 미술관 앞이에요.","zh":"好。星期六三点，美术馆前。"}]},{"title":{"zh-CN":"电影院出口","ko-KR":"극장 출구"},"people":{"zh-CN":"秀珍与丹尼尔，同龄朋友","ko-KR":"수진과 다니엘, 또래 친구"},"purpose":{"zh-CN":"交流观影感受并提议去远处公园散步。","ko-KR":"영화 느낌을 말하고 보이는 공원에서 걷자고 제안합니다."},"audioId":"chapter-08-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"수진","ko":"영화가 정말 재미있네요!","zh":"电影真的很有趣啊！"},{"speaker":"다니엘","ko":"네, 음악도 좋네요.","zh":"是啊，音乐也很好听呢。"},{"speaker":"수진","ko":"지금 공원에 갈까요?","zh":"现在去公园好吗？"},{"speaker":"다니엘","ko":"좋아요. 저 공원은 어때요?","zh":"好啊，那个公园怎么样？"},{"speaker":"수진","ko":"괜찮아요. 같이 걸을까요?","zh":"可以啊。一起走走好吗？"},{"speaker":"다니엘","ko":"네, 같이 걸어요.","zh":"好，一起走吧。"}]}],"coach":{"zh-CN":"事实组合题和备选回应题都答对才完成；替换与试录为自主练习。","ko-KR":"사실 문제와 대안 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-invite"}},
    {"code":"listen_speak","node":"listen-and-invite","minutes":14,"title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听见见面地点，再完成自己的邀约","ko-KR":"만나는 장소를 듣고 나의 약속 대화 완성하기"},"content":{"lead":{"zh-CN":"学生端只显示待制作音频和题面；脚本、答案、停顿与对象键只在服务端。","ko-KR":"학생 화면에는 제작 대기 음원과 문제만 보이며 원고, 정답, 쉼과 객체 키는 서버에만 있습니다."},"speakingTask":{"duration":"40—55秒","targetSeconds":48,"minimumTurns":8,"maximumTurns":10,"requiredInformation":["第一项活动建议","接受或调整回应","不同备选活动","指示对象","具体时间地点","ㄷ不规则建议","-네요新发现","最终确认"],"pronunciationScore":false},"coach":{"zh-CN":"音频制作并可播放后听力答对，同时提交满足时长、话轮和八类信息的录音才完成；录音不产生分数。","ko-KR":"음원이 재생 가능하고 듣기 정답과 말하기 조건을 모두 충족해야 하며 녹음에는 점수가 없습니다."},"nextNode":"weekend-chat"}},
    {"code":"read_write","node":"weekend-chat","minutes":13,"title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读周末约定聊天，写一段新的邀约","ko-KR":"주말 약속 대화를 읽고 새 초대 쓰기"},"content":{"lead":{"zh-CN":"按第一提议、调整理由、备选、新发现和最终时间地点读取。","ko-KR":"첫 제안, 조정 이유, 대안, 새 발견과 최종 시간·장소 순서로 읽습니다."},"reading":{"title":"주말 약속 채팅","lines":["[유나 님이 공연 포스터와 전시회 일정을 보냈습니다.]","유나: 이번 토요일에 이 공연을 볼까요?","준호: 좋은 생각이에요. 그런데 토요일 표가 없어요.","유나: 그럼 이 전시회에 갈까요?","준호: 좋아요. 방금 일정을 봤어요. 오후 두 시가 괜찮네요.","유나: 네, 미술관 앞에서 만나요."]},"writing":{"turns":"6—8","requirements":["第一项活动建议","回应或调整理由","不同备选活动","指示对象","具体时间地点","ㄷ不规则建议","-네요新发现","最终确认"],"frame":"이번 주말에 ___(으)ㄹ까요? → 좋아요.／미안해요. ___ → 그럼 ___(으)ㄹ까요? → 이/그/저 ___은/는 어때요? → ___시가 괜찮네요. → ___에서 만나요.","rubric":["信息完整","核心语法","回应逻辑与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读三题全对，提交6—8轮、八类信息齐全的原创双角色聊天并完成量规自查。","ko-KR":"읽기 세 문제와 6~8턴, 여덟 정보 및 자기 점검을 모두 완성합니다."},"nextNode":"can-do-check"}},
    {"code":"review","node":"can-do-check","minutes":8,"title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},"nodeTitle":{"zh-CN":"我能把备选方案变成明确约定吗？","ko-KR":"대안을 분명한 약속으로 만들 수 있을까요?"},"content":{"lead":{"zh-CN":"自主复习展示不作为强制证据；综合多选与五项自查由合同记录。","ko-KR":"자율 복습은 필수 증거가 아니며 종합 문제와 다섯 점검을 기록합니다."},"canDo":[{"ko":"-(으)ㄹ까요?로 활동과 시간을 제안할 수 있어요.","zh":"我能提议共同活动和时间。"},{"ko":"걷다와 듣다를 바르게 활용할 수 있어요.","zh":"我能正确处理两个ㄷ不规则动词。"},{"ko":"이／그／저 + 명사로 대상을 가리킬 수 있어요.","zh":"我能根据现场关系指明对象。"},{"ko":"새 정보나 경험을 -네요로 말할 수 있어요.","zh":"我能表达刚发现或体验的内容。"},{"ko":"대안, 시간과 장소를 넣어 40~55초, 8~10턴의 약속 대화를 할 수 있어요.","zh":"我能完成含备选、时间地点的双角色邀约。"}],"remediation":[{"reason":"词汇","node":"activity-words"},{"reason":"语法","node":"suggest-and-react"},{"reason":"理解","node":"weekend-plan-talk／listen-and-invite"},{"reason":"表达","node":"listen-and-invite"},{"reason":"读写","node":"weekend-chat"}],"chapterTest":"korean-level-one-08","coach":{"zh-CN":"综合多选答对，五项自查全部回应并记录返回节点或none后完成。","ko-KR":"종합 문제 정답과 다섯 점검 및 복습 위치 또는 none 기록이 필요합니다."}}}
  ] $modules$::jsonb) loop
    update public.digital_textbook_modules set
      title = item->'title', description = jsonb_build_object('zh-CN', item->'nodeTitle'->>'zh-CN', 'ko-KR', item->'nodeTitle'->>'ko-KR'), updated_at = now()
    where chapter_id = chapter_uuid and module_code = item->>'code';
    update public.digital_textbook_nodes node set
      estimated_minutes = (item->>'minutes')::integer, title = item->'nodeTitle', content = item->'content', updated_at = now()
    from public.digital_textbook_modules module
    where node.module_id = module.id and module.chapter_id = chapter_uuid and node.node_code = item->>'node';
  end loop;

  for item in select value from jsonb_array_elements($activities$
  [
    {"node":"mission-map","key":"orientation-check","prompt":{"zh-CN":"智敏想邀请朋友这周末一起参加活动。哪一句最适合先说？","ko-KR":"지민은 친구에게 이번 주말 활동을 제안합니다. 가장 알맞은 첫 문장은 무엇이에요?"},"instruction":{"zh-CN":"选择能够直接发起共同活动邀约的一句；本题不计分。","ko-KR":"함께 할 활동을 직접 제안하는 문장을 하나 고르세요. 점수에는 포함되지 않습니다."},"options":["영화가 정말 재미있네요!","미술관 앞에서 만나요.","이번 주말에 같이 영화 볼까요?","토요일 표가 없어요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":2},"explanation":{"correct":{"zh-CN":"이번 주말에 같이 영화 볼까요?直接发起共同活动邀约。","ko-KR":"이번 주말에 같이 영화 볼까요?는 함께 할 활동을 직접 제안합니다."},"feedback":[{"zh-CN":"先找同时包含周末和共同活动的句子。","ko-KR":"주말과 함께 할 활동이 있는 문장을 찾으세요."},{"zh-CN":"目标句要用问句给对方接受或调整的空间。","ko-KR":"상대가 수락하거나 조정할 수 있는 질문이어야 합니다."},{"zh-CN":"答案是이번 주말에 같이 영화 볼까요?。","ko-KR":"정답은 이번 주말에 같이 영화 볼까요?입니다."}]}},
    {"node":"activity-words","key":"vocabulary-check","prompt":{"zh-CN":"在극장 앞에서 만나요.中，극장是什么意思？","ko-KR":"극장 앞에서 만나요.에서 극장은 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["公园","美术馆","电影院","展览"],"config":{"shuffle":true,"audioStatus":"pending","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":2},"explanation":{"correct":{"zh-CN":"극장是电影院；整句表示在电影院前见。","ko-KR":"극장은 영화를 보는 장소이며 문장은 극장 앞에서 만나자는 뜻입니다."},"feedback":[{"zh-CN":"先判断극장是活动名还是地点名。","ko-KR":"극장이 활동인지 장소인지 구별하세요."},{"zh-CN":"它是通常观看电影的场所。","ko-KR":"보통 영화를 보는 장소입니다."},{"zh-CN":"答案是电影院。","ko-KR":"정답은 극장입니다."}]}},
    {"node":"suggest-and-react","key":"grammar-fill","prompt":{"zh-CN":"完成六小题，检查建议形、ㄷ不规则、指示冠形词和发现感叹。","ko-KR":"제안형, ㄷ 불규칙, 지시 관형사와 새롭게 느낀 표현 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"①—③、⑥写共同提议形；④根据海报在说话人手中填写；⑤只补表示刚发现的词尾。","ko-KR":"①~③과 ⑥은 제안형, ④는 말하는 사람 손의 포스터에 맞는 말, ⑤는 새 발견 어미를 쓰세요."},"options":[],"config":{"inputMode":"text","normalize":"NFC","shuffle":true,"items":[{"id":"f1","label":"보다 → ___（共同提议形）","placeholder":"请输入答案"},{"id":"f2","label":"찍다 → ___（共同提议形）","placeholder":"请输入答案"},{"id":"f3","label":"걷다 → ___（共同提议形）","placeholder":"请输入答案"},{"id":"f4","label":"智敏手里拿着海报：___ 영화를 볼까요?","placeholder":"请输入答案"},{"id":"f5","label":"재미있다 → 재미있___!（刚发现）","placeholder":"请输入答案"},{"id":"f6","label":"듣다 → ___（共同提议形）","placeholder":"请输入答案"}]},"answer":{"kind":"text_array","value":["볼까요","찍을까요","걸을까요","이","네요","들을까요"]},"explanation":{"correct":{"zh-CN":"答案依次为볼까요、찍을까요、걸을까요、이、네요、들을까요。","ko-KR":"정답은 볼까요, 찍을까요, 걸을까요, 이, 네요, 들을까요입니다."},"feedback":[{"zh-CN":"先给每题标记建议、指示或新发现。","ko-KR":"제안, 지시와 새 발견 기능을 먼저 구별하세요."},{"zh-CN":"检查收音、ㄷ→ㄹ和海报在谁手里。","ko-KR":"받침, ㄷ→ㄹ과 포스터 위치를 확인하세요."},{"zh-CN":"对照四张语法卡将六题全部正确重做。","ko-KR":"네 문법 카드를 보고 여섯 답을 모두 다시 쓰세요."}]}},
    {"node":"plan-builder","key":"pattern-order","prompt":{"zh-CN":"把五个完整话轮排成从第一提议到时间地点确认的自然邀约。","ko-KR":"첫 제안부터 시간과 장소 확인까지 다섯 말차례를 배열하세요."},"instruction":{"zh-CN":"根据提议、转折、承接和确认关系拖动；每张卡都是完整话轮。","ko-KR":"제안, 전환, 연결과 확인 관계에 따라 배열하세요."},"options":["그럼 전시회에 갈까요?","네, 미술관 앞에서 만나요.","좋은 생각이에요. 그런데 토요일 표가 없어요.","이번 주말에 같이 영화 볼까요?","좋아요. 토요일 세 시에 만날까요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[3,2,0,4,1]},"explanation":{"correct":{"zh-CN":"先提电影，没票后改提展览，再商量时间并确认地点。","ko-KR":"영화를 제안하고 표가 없어 전시회로 바꾼 뒤 시간과 장소를 정합니다."},"feedback":[{"zh-CN":"先找邀约开场和最终地点确认。","ko-KR":"초대 시작과 마지막 장소 확인을 찾으세요."},{"zh-CN":"没票必须在电影提议后、展览备选前。","ko-KR":"표가 없다는 말은 영화 뒤, 전시회 앞에 옵니다."},{"zh-CN":"正确流程是电影→无票→展览→时间→地点。","ko-KR":"영화, 표 없음, 전시회, 시간, 장소 순서입니다."}]}},
    {"node":"weekend-plan-talk","key":"dialogue-fact-check","prompt":{"zh-CN":"主场景最终决定参加什么活动、在哪里见面？","ko-KR":"주 장면에서 두 사람은 결국 무엇을 하고 어디에서 만나요?"},"instruction":{"zh-CN":"重读第4、6、8轮，选择最终活动／见面地点组合。","ko-KR":"4, 6, 8턴을 읽고 최종 활동과 장소를 고르세요."},"options":["영화／극장 앞","공원 산책／학교 앞","공연／공원 입구","전시회／미술관 앞"],"config":{"shuffle":true},"answer":{"kind":"index","value":3},"explanation":{"correct":{"zh-CN":"最终活动是展览，见面地点是美术馆前。","ko-KR":"최종 활동은 전시회이고 만나는 곳은 미술관 앞입니다."},"feedback":[{"zh-CN":"先找电影无票后的新活动。","ko-KR":"영화 표가 없는 뒤 새 활동을 찾으세요."},{"zh-CN":"地点在第6轮并在最后复述。","ko-KR":"장소는 6턴과 마지막 확인에 나옵니다."},{"zh-CN":"答案是전시회／미술관 앞。","ko-KR":"정답은 전시회／미술관 앞입니다."}]}},
    {"node":"weekend-plan-talk","key":"dialogue-response","prompt":{"zh-CN":"朋友说그 영화는 토요일 표가 없어요.，哪一句能承接并提出不同备选？","ko-KR":"친구가 그 영화는 토요일 표가 없어요.라고 했을 때 다른 활동을 제안하는 말은 무엇이에요?"},"instruction":{"zh-CN":"只选同时满足换活动和建议问句的一句。","ko-KR":"다른 활동과 제안 질문을 모두 만족하는 문장을 고르세요."},"options":["영화가 정말 재미있네요!","네, 토요일 표가 있어요.","세 시에 만나요.","그럼 전시회에 갈까요?"],"config":{"shuffle":true},"answer":{"kind":"index","value":3},"explanation":{"correct":{"zh-CN":"그럼承接调整，展览是不同活动，갈까요提出建议。","ko-KR":"그럼으로 이어 받고 전시회를 갈까요로 제안합니다."},"feedback":[{"zh-CN":"先排除没有改变活动的句子。","ko-KR":"활동을 바꾸지 않는 문장을 빼세요."},{"zh-CN":"答案要有承接和新活动建议。","ko-KR":"연결과 새 활동 제안이 모두 필요합니다."},{"zh-CN":"答案是그럼 전시회에 갈까요?。","ko-KR":"정답은 그럼 전시회에 갈까요?입니다."}]}},
    {"node":"listen-and-invite","key":"listening-plan-place","prompt":{"zh-CN":"听语音邀约，判断서연想和준호在哪里见面。","ko-KR":"음성 초대를 듣고 서연과 준호가 어디에서 만나는지 고르세요."},"instruction":{"zh-CN":"正常语速最多两遍，慢速最多一遍；只依据音频见面句作答。","ko-KR":"보통 속도 두 번, 느린 속도 한 번 듣고 만나는 문장에 근거해 답하세요."},"options":["공원 입구","극장 앞","미술관 앞","학교 앞"],"config":{"audioId":"chapter-08-listening-plan-place","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":true},"answer":{"kind":"index","value":1},"transcript":"준호 씨, 이번 토요일에 같이 공연을 볼까요? 오후 네 시 공연이에요. 공연 후에 공원에서 걸을까요? 극장 앞에서 세 시 반에 만나요.","audioObjectKey":"korean-level-one/chapter-08/listening/chapter-08-listening-plan-place.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"原文最后一句明确说在剧场前见。","ko-KR":"마지막 문장에서 극장 앞에서 만난다고 말합니다."},"feedback":[{"zh-CN":"再听带에서 만나요的句子。","ko-KR":"에서 만나요가 있는 문장을 다시 들으세요."},{"zh-CN":"目标地点在最后一句、三点半之前。","ko-KR":"장소는 마지막 문장의 세 시 반 앞에 있습니다."},{"zh-CN":"答案是극장 앞。","ko-KR":"정답은 극장 앞입니다."}],"privateListening":{"slowScript":"준호 씨, 이번 토요일에 같이 공연을 볼까요? / 오후 네 시 공연이에요. / 공연 후에 공원에서 걸을까요? / 극장 앞에서 세 시 반에 만나요.","pauseMarks":"준호 씨, 이번 토요일에 같이 공연을 볼까요? ⏸ 오후 네 시 공연이에요. ⏸ 공연 후에 공원에서 걸을까요? ⏸ 극장 앞에서 세 시 반에 만나요.","speaker":"F03／서연；第一人称语音留言","distractorReasons":{"0":"公园是演出后的活动地点，不是见面地点。","2":"独立听力没有美术馆。","3":"原文没有学校。"}}}},
    {"node":"listen-and-invite","key":"speaking-invitation","prompt":{"zh-CN":"完成含备选方案的40—55秒、8—10轮双角色周末邀约。","ko-KR":"대안을 포함해 두 역할로 40~55초, 8~10턴의 주말 약속 대화를 하세요."},"instruction":{"zh-CN":"加入第一建议、回应／调整、不同备选、指示对象、时间地点、ㄷ不规则建议、-네요新发现和最终确认。","ko-KR":"첫 제안, 응답·조정, 대안, 지시 대상, 시간·장소, ㄷ 불규칙, -네요와 마지막 확인을 넣으세요."},"options":[],"config":{"minimumSeconds":40,"maximumSeconds":55,"minimumTurns":8,"maximumTurns":10,"requiredCriteria":8,"enforceCompletionRequirements":true,"pronunciationScore":false,"turnLabel":{"zh-CN":"双角色交替话轮数","ko-KR":"두 역할 교대 말차례 수"},"criteria":["第一项活动建议","接受或调整回应","不同备选活动","指示对象","具体时间地点","ㄷ不规则建议","-네요新发现","最终确认"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与八类自查；不产生正确性或分数。","ko-KR":"녹음 정보와 여덟 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查两个角色、8—10轮、第一方案和备选。","ko-KR":"두 역할, 8~10턴, 첫 계획과 대안을 확인하세요."},{"zh-CN":"再检查对象、时间地点、ㄷ不规则、-네요和确认。","ko-KR":"대상, 시간·장소, ㄷ 불규칙, -네요와 확인을 점검하세요."},{"zh-CN":"按八项清单补齐后重录；不显示虚假发音分数。","ko-KR":"여덟 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
    {"node":"weekend-chat","key":"reading-weekend-chat","prompt":{"zh-CN":"阅读周末约定聊天，完成第一方案、改变原因和最终时间地点三题。","ko-KR":"주말 약속 대화를 읽고 첫 계획, 바꾼 이유와 최종 시간·장소 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；全部依据公开聊天原句。","ko-KR":"문제마다 하나를 고르고 공개된 대화에서 근거를 찾으세요."},"options":[],"config":{"reading":"[유나 님이 공연 포스터와 전시회 일정을 보냈습니다.]\n유나: 이번 토요일에 이 공연을 볼까요?\n준호: 좋은 생각이에요. 그런데 토요일 표가 없어요.\n유나: 그럼 이 전시회에 갈까요?\n준호: 좋아요. 방금 일정을 봤어요. 오후 두 시가 괜찮네요.\n유나: 네, 미술관 앞에서 만나요.","items":[{"id":"q1","question":"유나는 처음에 무엇을 제안했어요?","options":["영화를 봐요","공원에서 걸어요","공연을 봐요","사진을 찍어요"]},{"id":"q2","question":"왜 계획을 바꿨어요?","options":["미술관이 멀어요","토요일 표가 없어요","시간이 없어요","공연이 재미없어요"]},{"id":"q3","question":"두 사람은 언제 어디에서 만나요?","options":["오후 두 시／미술관 앞","오후 세 시／극장 앞","오후 네 시／공원 입구","오전 두 시／학교 앞"]}],"shuffle":true,"shuffleOptions":true},"answer":{"kind":"index_array","value":[2,1,0]},"explanation":{"correct":{"zh-CN":"答案依次是看演出、周六没票、下午两点／美术馆前。","ko-KR":"정답은 공연, 토요일 표 없음, 오후 두 시／미술관 앞입니다."},"feedback":[{"zh-CN":"圈出第一句活动、第二句事实和最后两句时间地点。","ko-KR":"첫 활동, 두 번째 사실과 마지막 시간·장소를 찾으세요."},{"zh-CN":"不要把主对话或听力信息带入。","ko-KR":"다른 대화나 듣기 정보를 섞지 마세요."},{"zh-CN":"依据聊天将三题全部正确重做。","ko-KR":"대화를 근거로 세 문제를 다시 푸세요."}]}},
    {"node":"weekend-chat","key":"write-weekend-invitation","prompt":{"zh-CN":"给同龄朋友写一段6—8轮、含备选方案的原创周末邀约聊天。","ko-KR":"친구에게 대안을 포함한 새로운 주말 약속 대화를 6~8턴으로 쓰세요."},"instruction":{"zh-CN":"写八类信息并完成四维量规自查；不复制示范。","ko-KR":"여덟 정보를 쓰고 네 기준을 점검하세요. 예시를 베끼지 마세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":40,"minimumInformationKinds":8,"requireCompletionChecklist":true,"informationChecklist":["第一项活动建议","回应或调整理由","不同备选活动","指示对象","具体时间地点","ㄷ不规则建议","-네요新发现","最终确认"],"structureFrame":"이번 주말에 ___(으)ㄹ까요? → 좋아요.／미안해요. ___ → 그럼 ___(으)ㄹ까요? → 이/그/저 ___은/는 어때요? → ___시가 괜찮네요. → ___에서 만나요.","rubric":["信息完整","核心语法","回应逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足6—8轮、八类信息与量规自查的原创聊天；不产生正确性或分数。","ko-KR":"6~8턴, 여덟 정보와 자기 점검을 갖춘 대화를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数角色、6—8轮和第一方案与备选。","ko-KR":"역할, 6~8턴, 첫 계획과 대안을 확인하세요."},{"zh-CN":"圈出指示对象、时间地点、ㄷ不规则和-네요。","ko-KR":"지시 대상, 시간·장소, ㄷ 불규칙과 -네요를 확인하세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
    {"node":"can-do-check","key":"review-multiple","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的句子。","ko-KR":"형태가 맞고 괄호 안의 기능을 바르게 수행하는 문장을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["공원에서 걸을까요?（用걷다提议）","음악을 듣을까요?（用듣다提议）","영화가 재미있네요!（刚看完后的感叹）","저 전시회에 갈까요?（指远处对象并提议）","이 공연을 볼까요?（指明对象并提议）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,2,3,4]},"explanation":{"correct":{"zh-CN":"除듣을까요外其余四句形式与功能正确；듣다应为들을까요。","ko-KR":"듣을까요를 제외한 네 문장이 맞고 듣다는 들을까요입니다."},"feedback":[{"zh-CN":"检查建议词尾、ㄷ不规则、指示词后的名词和-네요情境。","ko-KR":"제안형, ㄷ 불규칙, 지시어 뒤 명사와 -네요 상황을 확인하세요."},{"zh-CN":"有一句机械保留了ㄷ。","ko-KR":"한 문장은 ㄷ을 그대로 두었습니다."},{"zh-CN":"正确项是第1、3、4、5句。","ko-KR":"정답은 1, 3, 4, 5번입니다."}]}},
    {"node":"can-do-check","key":"self-check","prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"suggestion","label":"我能用-(으)ㄹ까요?提议活动和时间／-(으)ㄹ까요?로 활동과 시간을 제안할 수 있어요"},{"id":"irregular","label":"我能正确变化걷다和듣다／걷다와 듣다를 바르게 활용할 수 있어요"},{"id":"demonstrative","label":"我能用이／그／저+名词指对象／이／그／저 + 명사로 대상을 가리킬 수 있어요"},{"id":"discovery","label":"我能用-네요表达新发现／-네요로 새 발견을 말할 수 있어요"},{"id":"dialogue","label":"我能完成40—55秒、8—10轮邀约／40~55초, 8~10턴의 약속 대화를 할 수 있어요"}],"returnNodes":[{"value":"activity-words","label":"词汇"},{"value":"suggest-and-react","label":"语法"},{"value":"weekend-plan-talk","label":"对话理解"},{"value":"listen-and-invite","label":"听说"},{"value":"weekend-chat","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代客观题、录音或写作证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했으며 다른 증거를 대신하지 않습니다."},"feedback":[{"zh-CN":"逐项回想建议、备选、ㄷ不规则、对象指示和现场发现。","ko-KR":"제안, 대안, ㄷ 불규칙, 지시와 새 발견을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select activity.id into activity_uuid
    from public.digital_textbook_activities activity
    join public.digital_textbook_nodes node on node.id = activity.node_id
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and activity.activity_key = item->>'key';
    if activity_uuid is null then raise exception 'Missing chapter 08 activity %', item->>'key'; end if;
    update public.digital_textbook_activities set
      prompt = item->'prompt', instruction = item->'instruction', options = item->'options', public_config = item->'config',
      max_attempts = 3, counts_toward_completion = true, updated_at = now()
    where id = activity_uuid;
    update public.digital_textbook_activity_secrets set
      answer_key = item->'answer', explanation = item->'explanation', transcript_ko = item->>'transcript',
      audio_object_key = item->>'audioObjectKey', audio_status = coalesce(item->>'audioStatus','pending'), updated_at = now()
    where activity_id = activity_uuid;
  end loop;

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where media.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-08-image-01","purpose":"章节情境主图","file":"chapter-08-01-scene.png","path":"../附件/韩国语1级/第08课/第08课-01-章节情境主图.png","alt":"校园海报栏前商量电影、展览和公园活动的两名成年学生。","width":1600,"height":900},
    {"node":"activity-words","key":"chapter-08-image-02","purpose":"核心词汇活动与地点卡","file":"chapter-08-02-vocabulary.png","path":"../附件/韩国语1级/第08课/第08课-02-核心词汇卡-周末活动与地点.png","alt":"电影、演出、展览、听音乐、散步、拍照、电影院、美术馆和公园九格卡。","width":1200,"height":900},
    {"node":"suggest-and-react","key":"chapter-08-image-03","purpose":"提议指示感叹语法总图","file":"chapter-08-03-grammar-overview.png","path":"../附件/韩国语1级/第08课/第08课-03-语法总图-提议指示感叹.png","alt":"建议词尾、ㄷ变化、对象指示与现场发现总流程。","width":1600,"height":900},
    {"node":"suggest-and-react","key":"chapter-08-image-04","purpose":"建议形结构图","file":"chapter-08-03a-suggestion.png","path":"../附件/韩国语1级/第08课/第08课-03A-语法结构图-建议形.png","alt":"词干收音分流到ㄹ까요或을까요。","width":1200,"height":900},
    {"node":"suggest-and-react","key":"chapter-08-image-05","purpose":"ㄷ不规则结构图","file":"chapter-08-03b-d-irregular.png","path":"../附件/韩国语1级/第08课/第08课-03B-语法结构图-ㄷ不规则.png","alt":"걷다和듣다的ㄷ变ㄹ与规则词对比。","width":1200,"height":900},
    {"node":"suggest-and-react","key":"chapter-08-image-06","purpose":"指示冠形词结构图","file":"chapter-08-03c-demonstratives.png","path":"../附件/韩国语1级/第08课/第08课-03C-语法结构图-指示冠形词.png","alt":"说话人、听话人与远处对象的이、그、저指向。","width":1200,"height":900},
    {"node":"suggest-and-react","key":"chapter-08-image-07","purpose":"-네요结构图","file":"chapter-08-03d-neyo.png","path":"../附件/韩国语1级/第08课/第08课-03D-语法结构图-네요.png","alt":"现场新信息进入感叹气泡。","width":1200,"height":900},
    {"node":"plan-builder","key":"chapter-08-image-08","purpose":"句型邀约语块卡","file":"chapter-08-04-pattern-blocks.png","path":"../附件/韩国语1级/第08课/第08课-04-句型邀约语块卡.png","alt":"五张涉及提议、调整与确认的完整邀约话轮卡。","width":1200,"height":900},
    {"node":"weekend-plan-talk","key":"chapter-08-image-09","purpose":"实战对话场景图","file":"chapter-08-05-dialogue.png","path":"../附件/韩国语1级/第08课/第08课-05-实战对话场景.png","alt":"校园海报栏与电影院出口的两组朋友。","width":1600,"height":900},
    {"node":"listen-and-invite","key":"chapter-08-image-10","purpose":"听力活动时间地点信息图","file":"chapter-08-06-listening.png","path":"../附件/韩国语1级/第08课/第08课-06-听力信息图-活动时间地点.png","alt":"演出、散步、时间及四个候选见面地点的无答案计划卡。","width":1200,"height":900},
    {"node":"weekend-chat","key":"chapter-08-image-11","purpose":"周末约定聊天版式","file":"chapter-08-07-chat.png","path":"../附件/韩国语1级/第08课/第08课-07-周末约定聊天.png","alt":"双人聊天界面与活动海报缩略占位。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-08-image-12","purpose":"最终邀约任务图","file":"chapter-08-08-final-task.png","path":"../附件/韩国语1级/第08课/第08课-08-最终任务图.png","alt":"从第一建议到最终确认和录音提交的八步邀约信息链。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
    values (node_uuid,item->>'key','image',item->>'purpose','korean-level-one/chapter-08/images/'||(item->>'file'),'pending',jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,'plannedSourcePath',item->>'path','sourceStatus','待制作'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid and node.node_code='activity-words';
  for item in select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality) from jsonb_array_elements($vocab$
    [{"word":"영화","collocation":"영화를 보다"},{"word":"공연","collocation":"공연을 보다"},{"word":"전시회","collocation":"전시회에 가다"},{"word":"음악","collocation":"음악을 듣다"},{"word":"산책","collocation":"산책을 하다"},{"word":"사진","collocation":"사진을 찍다"},{"word":"표","collocation":"토요일 표가 없다"},{"word":"주말","collocation":"이번 주말에"},{"word":"시간","collocation":"시간이 괜찮다"},{"word":"극장","collocation":"극장 앞에서 만나다"},{"word":"미술관","collocation":"미술관 앞에서 만나다"},{"word":"공원","collocation":"공원에서 걷다"},{"word":"앞","collocation":"극장 앞／미술관 앞"},{"word":"보다","collocation":"영화를 보다"},{"word":"가다","collocation":"전시회에 가다"},{"word":"걷다","collocation":"공원에서 걷다"},{"word":"듣다","collocation":"음악을 듣다"},{"word":"찍다","collocation":"사진을 찍다"},{"word":"재미있다","collocation":"영화가 재미있다"},{"word":"괜찮다","collocation":"시간이 괜찮다"},{"word":"같이","collocation":"같이 영화 볼까요?"}]
  $vocab$::jsonb) with ordinality loop
    insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata) values
      (node_uuid,'chapter-08-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-08/audio/vocabulary/chapter-08-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-08-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-08-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-08/audio/vocabulary/chapter-08-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-08-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid and node.node_code='suggest-and-react';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句','korean-level-one/chapter-08/audio/grammar/'||(value->>'id')||'.mp3','pending','{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$[{"id":"chapter-08-grammar-01-example-01","script":"주말에 영화 볼까요?"},{"id":"chapter-08-grammar-01-example-02","script":"민수 씨, 이번 주말에 같이 영화 볼까요?"},{"id":"chapter-08-grammar-01-example-03","script":"이번 토요일에 이 공연을 볼까요?"},{"id":"chapter-08-grammar-02-example-01","script":"공원에서 걸을까요?"},{"id":"chapter-08-grammar-02-example-02","script":"전시회를 보고 공원에서 걸을까요?"},{"id":"chapter-08-grammar-02-example-03","script":"공연 후에 공원에서 걸을까요?"},{"id":"chapter-08-grammar-03-example-01","script":"이 영화를 볼까요?"},{"id":"chapter-08-grammar-03-example-02","script":"그 영화는 토요일 표가 없어요."},{"id":"chapter-08-grammar-03-example-03","script":"그럼 이 전시회에 갈까요?"},{"id":"chapter-08-grammar-04-example-01","script":"영화가 정말 재미있네요!"},{"id":"chapter-08-grammar-04-example-02","script":"영화가 정말 재미있네요!"},{"id":"chapter-08-grammar-04-example-03","script":"오후 두 시가 괜찮네요."}]$grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id where module.chapter_id=chapter_uuid and node.node_code='weekend-plan-talk';
  insert into public.digital_textbook_media_assets (node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata)
  select node_uuid,value->>'id','audio',value->>'purpose','korean-level-one/chapter-08/audio/dialogue/'||(value->>'id')||'.mp3','pending','{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$[{"id":"chapter-08-dialogue-main-line-01","purpose":"主对话逐句","script":"민수 씨, 이번 주말에 같이 영화 볼까요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-02","purpose":"主对话逐句","script":"좋아요. 어떤 영화를 볼까요?","speaker":"M01／민수"},{"id":"chapter-08-dialogue-main-line-03","purpose":"主对话逐句","script":"이 영화를 볼까요? 재미있어요.","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-04","purpose":"主对话逐句","script":"미안해요. 그 영화는 토요일 표가 없어요. 전시회에 갈까요?","speaker":"M01／민수"},{"id":"chapter-08-dialogue-main-line-05","purpose":"主对话逐句","script":"좋아요. 토요일 세 시에 만날까요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 미술관 앞에서 만나요.","speaker":"M01／민수"},{"id":"chapter-08-dialogue-main-line-07","purpose":"主对话逐句","script":"전시회를 보고 공원에서 걸을까요?","speaker":"F01／지민"},{"id":"chapter-08-dialogue-main-line-08","purpose":"主对话逐句","script":"좋아요. 토요일 세 시, 미술관 앞이에요.","speaker":"M01／민수"},{"id":"chapter-08-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},{"id":"chapter-08-dialogue-alt-line-01","purpose":"第二对话逐句","script":"영화가 정말 재미있네요!","speaker":"F02／수진"},{"id":"chapter-08-dialogue-alt-line-02","purpose":"第二对话逐句","script":"네, 음악도 좋네요.","speaker":"M02／다니엘"},{"id":"chapter-08-dialogue-alt-line-03","purpose":"第二对话逐句","script":"지금 공원에 갈까요?","speaker":"F02／수진"},{"id":"chapter-08-dialogue-alt-line-04","purpose":"第二对话逐句","script":"좋아요. 저 공원은 어때요?","speaker":"M02／다니엘"},{"id":"chapter-08-dialogue-alt-line-05","purpose":"第二对话逐句","script":"괜찮아요. 같이 걸을까요?","speaker":"F02／수진"},{"id":"chapter-08-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 같이 걸어요.","speaker":"M02／다니엘"},{"id":"chapter-08-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／M02"}]$dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid from public.digital_textbook_nodes node join public.digital_textbook_modules module on module.id=node.module_id join public.digital_textbook_activities activity on activity.node_id=node.id where module.chapter_id=chapter_uuid and activity.activity_key='listening-plan-place';
  insert into public.digital_textbook_media_assets (node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata) values
    (node_uuid,activity_uuid,'chapter-08-listening-plan-place-normal','audio','私有听力正常语速','korean-level-one/chapter-08/listening/chapter-08-listening-plan-place-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F03／서연；第一人称语音留言","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-08-listening-plan-place-slow','audio','私有听力慢速','korean-level-one/chapter-08/listening/chapter-08-listening-plan-place-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F03／서연；第一人称语音留言","scriptVisibility":"private","speed":"slow"}');

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where media.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid and media.asset_key not like 'chapter-08-%';
end;
$chapter_eight$;

commit;
