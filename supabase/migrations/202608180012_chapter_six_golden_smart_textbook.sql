begin;

-- Converted from the read-only UPLY BOOK chapter-six master.
-- source_sha256: bd1345bbe2f291af0cd3854525f94555e7e4aec18302ae4b85bbfe4a60f57bc1
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
begin
  select version.id into version_uuid
  from public.digital_textbook_versions as version
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
  order by version.version_number desc
  limit 1;

  if version_uuid is null then
    raise exception 'Cannot convert chapter 06: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 06: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-06'
  limit 1;

  if test_uuid is null then
    select id into test_uuid
    from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 6
    limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000006'::uuid,
      lesson_uuid, 'korean-level-one-06', 'korean-level-one', 6,
      '第 06 章测试：多少钱？', '제06과 평가: 얼마예요?',
      '检查商品与金额词汇、数量和量词、动作请求、商品评价、追加表达以及购物信息理解。',
      12, 60,
      '{"recognition":"商品、数量与金额词汇","structure":"购物语言工具","reading":"对话与价格卡理解","assembly":"购物交易组织"}'::jsonb,
      1, 'draft', '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid,
      slug = 'korean-level-one-06',
      course_key = 'korean-level-one',
      chapter_number = 6,
      title = '第 06 章测试：多少钱？',
      korean_title = '제06과 평가: 얼마예요?',
      description = '检查商品与金额词汇、数量和量词、动作请求、商品评价、追加表达以及购物信息理解。',
      duration_minutes = 12,
      passing_score = 60,
      skills = '{"recognition":"商品、数量与金额词汇","structure":"购物语言工具","reading":"对话与价格卡理解","assembly":"购物交易组织"}'::jsonb,
      version = 1,
      status = 'draft',
      student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
      updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions
  where test_id = test_uuid and question_key not in (
    'golden-06-01','golden-06-02','golden-06-03','golden-06-04',
    'golden-06-05','golden-06-06','golden-06-07','golden-06-08',
    'golden-06-09','golden-06-10','golden-06-11','golden-06-12'
  );
  update public.chapter_test_questions
  set sort_order = sort_order + 100, updated_at = now()
  where test_id = test_uuid;

  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation, skill,
    sort_order, question_type, default_points, difficulty, tags, status, version,
    is_chapter_test_item, ebook_section_step, ebook_page_reference
  ) values
    (test_uuid,'golden-06-01','“얼마”在本课表示什么？','["价格多少","数量三个","苹果","店员"]',0,'얼마예요?用于询问商品价格。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-06-02','“三个苹果”的规范韩文表达是哪一项？','["사과 세 개","사과 삼 개","사과 두 병","사과 세 원"]',0,'一般商品数量在量词개前使用固有词缩略形세。','recognition',2,'single_choice',10,'foundation','["数量","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-06-03','“먹다”的礼貌动作请求形是哪一项？','["먹으세요","먹세요","먹다세요","먹어요세요"]',0,'有收音词干먹-后接으세요。','structure',3,'single_choice',10,'foundation','["动作请求","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-06-04','“보다”的礼貌动作请求形是哪一项？','["보세요","보으세요","보다세요","봐요세요"]',0,'无收音词干보-后接세요。','structure',4,'single_choice',10,'foundation','["动作请求","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-06-05','“两瓶水”的规范韩文表达是哪一项？','["물 두 병","물 이 병","물 두 개","물 이천 원"]',0,'瓶装商品用固有词缩略形두加量词병。','structure',5,'single_choice',10,'foundation','["数量量词","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-06-06','回答“무엇이 커요?”时，哪一句符合形容词谓语结构？','["가방이 커요.","가방을 커요.","가방이 커요예요.","가방 커다요."]',0,'有收音名词가방后用主格助词이，形容词커요直接作谓语。','structure',6,'single_choice',10,'foundation','["形容词谓语","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-06-07','已经买了苹果，还要追加牛奶，哪一句最自然？','["우유도 한 병 주세요.","우유를도 한 병 주세요.","우유가 한 병도 주세요.","우유 한 원 주세요."]',0,'追加商品时도直接接名词并替代这里的对象助词。','structure',7,'single_choice',10,'foundation','["追加表达","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-06-08','主场景中，三个苹果和两个香蕉一共多少钱？','["5,000韩元","3,000韩元","2,000韩元","7,000韩元"]',0,'主场景第8轮明确说모두 오천 원이에요。','reading',8,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-06-09','第二场景中，俊浩最后选择的雨伞多少钱？','["7,000韩元","10,000韩元","5,000韩元","1,500韩元"]',0,'贤宇说明另一把雨伞7,000韩元后，俊浩选择了它。','reading',9,'single_choice',10,'foundation','["对话事实","母本§6.2"]','draft',1,true,'STEP 05','母本 §6.2'),
    (test_uuid,'golden-06-10','价格卡中，香蕉几个2,000韩元？','["两个","一个","三个","四个"]',0,'价格卡写有바나나 두 개 2,000원。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-06-11','购物交易中，下面哪一组先后关系正确？','["询价→单价→购买→追加→总价问答","购买→总价回答→询价→单价→追加","追加→购买→单价→询价→总价回答","总价回答→追加→询价→购买→单价"]',0,'母本排序任务按信息依存先询价和单价，再购买、追加，最后确认总价。','assembly',11,'single_choice',10,'medium','["话轮排序","母本§3.4"]','draft',1,true,'STEP 08','母本 §3.4'),
    (test_uuid,'golden-06-12','课末双角色购物录音必须满足哪一项？','["35—50秒、至少8轮、双角色交替且九类信息齐全","只说一种商品名称","必须获得自动发音分数","写4句话即可，无需录音"]',0,'母本规定35—50秒、至少8轮、双角色交替和九类信息，当前不做发音自动评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2')
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
  where version_id = version_uuid and (chapter_number = 6 or slug = 'shopping')
  order by (slug = 'shopping') desc
  limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal,
      status, production_status, editorial_status, native_review_status,
      audio_status, image_status, source_revision
    ) values (
      version_uuid, test_uuid, 'shopping', 6,
      '{"zh-CN":"多少钱？","ko-KR":"얼마예요?"}'::jsonb,
      '{"zh-CN":"敏智在社区水果店询问苹果和香蕉的单价、数量和总价后付款；俊浩在便利店比较两把雨伞的价格和大小并选购。","ko-KR":"민지는 동네 과일 가게에서 사과와 바나나의 단가, 수량과 전체 금액을 확인해 계산하고 준호는 편의점에서 우산 두 개의 가격과 크기를 비교해 고릅니다."}'::jsonb,
      '{"zh-CN":"区分商品数量与韩元金额，使用固有词数量＋量词、-(으)세요、形容词谓语和도，完成35—50秒、不少于8轮的双角色购物对话。","ko-KR":"상품 수량과 원 단위 금액을 구별하고 고유어 수와 단위, -(으)세요, 형용사 서술어와 도를 사용하여 35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 합니다."}'::jsonb,
      'draft', 'editorial_review', 'pending', 'pending', 'pending', 'pending',
      'UPLY BOOK 第06课 얼마예요.md @ 2026-08-18 / sha256:bd1345bbe2f291af0cd3854525f94555e7e4aec18302ae4b85bbfe4a60f57bc1'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id = test_uuid,
      slug = 'shopping',
      chapter_number = 6,
      title = '{"zh-CN":"多少钱？","ko-KR":"얼마예요?"}'::jsonb,
      scenario = '{"zh-CN":"敏智在社区水果店询问苹果和香蕉的单价、数量和总价后付款；俊浩在便利店比较两把雨伞的价格和大小并选购。","ko-KR":"민지는 동네 과일 가게에서 사과와 바나나의 단가, 수량과 전체 금액을 확인해 계산하고 준호는 편의점에서 우산 두 개의 가격과 크기를 비교해 고릅니다."}'::jsonb,
      goal = '{"zh-CN":"区分商品数量与韩元金额，使用固有词数量＋量词、-(으)세요、形容词谓语和도，完成35—50秒、不少于8轮的双角色购物对话。","ko-KR":"상품 수량과 원 단위 금액을 구별하고 고유어 수와 단위, -(으)세요, 형용사 서술어와 도를 사용하여 35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 합니다."}'::jsonb,
      status = 'draft',
      production_status = 'editorial_review',
      editorial_status = 'pending',
      native_review_status = 'pending',
      audio_status = 'pending',
      image_status = 'pending',
      source_revision = 'UPLY BOOK 第06课 얼마예요.md @ 2026-08-18 / sha256:bd1345bbe2f291af0cd3854525f94555e7e4aec18302ae4b85bbfe4a60f57bc1',
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
        "content":{"lead":{"zh-CN":"真实购物不只要会问多少钱，还要让店员听清数量、追加商品并确认总价。","ko-KR":"실제 쇼핑에서는 가격뿐 아니라 수량, 추가 상품과 전체 금액도 분명히 확인해야 합니다."},"targets":[{"ko":"사과가 얼마예요?","zh":"询问商品价格"},{"ko":"사과 세 개 주세요.","zh":"说明购买数量"},{"ko":"바나나도 두 개 주세요.","zh":"追加商品"},{"ko":"모두 얼마예요?","zh":"询问总价"}],"finalOutput":{"zh-CN":"35—50秒、不少于8轮的双角色购物交易，包含母本规定的九类信息。","ko-KR":"원고의 아홉 정보를 포함한 35~50초, 8턴 이상의 두 역할 쇼핑 대화입니다."},"coach":{"zh-CN":"本节点只以答对不计分场景诊断为强制证据；交易流程复述为自主展示。","ko-KR":"점수 없는 장면 진단 정답만 필수이며 거래 흐름 설명은 자율 활동입니다."},"nextNode":"shopping-words"}
      },
      {
        "code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,
        "nodeCode":"shopping-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},
        "description":{"zh-CN":"把22个商品、数量、价格和评价词与常用搭配一起记。","ko-KR":"상품, 수량, 가격과 평가 어휘 22개를 결합과 함께 익힙니다."},
        "nodeTitle":{"zh-CN":"把商品、数量、价格和评价配成块","ko-KR":"상품, 수량, 가격과 평가를 말덩이로 익히기"},
        "content":{"lead":{"zh-CN":"按看图认商品、点读原形、跟读数量或价格搭配、按实际位置再认的顺序学习；音频全部待制作。","ko-KR":"그림으로 상품을 확인하고 기본형과 수량·가격 결합을 읽은 뒤 실제 문맥에서 다시 익힙니다. 음원은 모두 제작 대기 중입니다."},"vocabulary":[
          {"ko":"가격","zh":"价格","pos":"名词","collocation":"상품 가격"},{"ko":"얼마","zh":"多少（价格）","pos":"疑问名词","collocation":"얼마예요?"},{"ko":"원","zh":"韩元","pos":"依存名词·货币单位","collocation":"천 원이에요."},{"ko":"모두","zh":"一共、全部","pos":"副词","collocation":"모두 얼마예요?"},{"ko":"사과","zh":"苹果","pos":"名词","collocation":"사과 세 개"},{"ko":"바나나","zh":"香蕉","pos":"名词","collocation":"바나나 두 개"},{"ko":"우유","zh":"牛奶","pos":"名词","collocation":"우유 한 병"},{"ko":"물","zh":"水","pos":"名词","collocation":"물 두 병"},{"ko":"우산","zh":"雨伞","pos":"名词","collocation":"우산이 커요."},{"ko":"가방","zh":"包","pos":"名词","collocation":"가방이 비싸요."},{"ko":"가게","zh":"商店","pos":"名词","collocation":"과일 가게"},{"ko":"손님","zh":"顾客","pos":"名词","collocation":"손님이 물어요."},{"ko":"직원","zh":"店员","pos":"名词","collocation":"가게 직원"},{"ko":"사다","zh":"买","pos":"动词","collocation":"사과를 사요."},{"ko":"고르다","zh":"挑选","pos":"动词","collocation":"여기에서 고르세요."},{"ko":"보다","zh":"看","pos":"动词","collocation":"한번 보세요."},{"ko":"싸다","zh":"便宜","pos":"形容词","collocation":"사과가 싸요."},{"ko":"비싸다","zh":"贵","pos":"形容词","collocation":"우산이 비싸요."},{"ko":"크다","zh":"大","pos":"形容词","collocation":"우산이 커요."},{"ko":"작다","zh":"小","pos":"形容词","collocation":"가방이 작아요."},{"ko":"개","zh":"个","pos":"依存名词·量词","collocation":"세 개"},{"ko":"병","zh":"瓶","pos":"依存名词·量词","collocation":"한 병"}
        ],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；22词点读、图片分量词和另说搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 어휘 듣기와 단위 분류는 자율 연습입니다."},"nextNode":"shopping-language-tools"}
      },
      {
        "code":"grammar","order":3,"accent":"iris","type":"learn","minutes":17,
        "nodeCode":"shopping-language-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},
        "description":{"zh-CN":"用动作请求、固有词数量、形容词谓语和도完成购物。","ko-KR":"동작 요청, 고유어 수, 형용사 서술어와 도로 쇼핑 대화를 만듭니다."},
        "nodeTitle":{"zh-CN":"让数量、评价和追加都自然","ko-KR":"수량, 평가와 추가를 자연스럽게 말하기"},
        "content":{"lead":{"zh-CN":"先区分商品请求与动作请求，再把数量放到量词前，用形容词评价商品，最后用도追加。","ko-KR":"상품 요청과 동작 요청을 구별한 뒤 수량과 단위를 붙이고 형용사로 평가하며 도로 추가합니다."},"grammarCards":[
          {"form":"V-(으)세요","function":{"zh-CN":"礼貌请对方做动作。","ko-KR":"상대에게 동작을 공손하게 요청합니다."},"rules":["有收音且不是ㄹ的词干接으세요","无收音词干接세요","ㄹ收音脱落规则本课只要求辨认","去掉词典形다后连写"],"examples":[{"ko":"이 가방을 보세요.","zh":"请看看这个包。","audioId":"chapter-06-grammar-01-example-01","audioStatus":"pending"},{"ko":"네, 여기에서 고르세요.","zh":"好的，请从这里挑选。","audioId":"chapter-06-grammar-01-example-02","audioStatus":"pending"},{"ko":"한번 보세요.","zh":"请看一下。","audioId":"chapter-06-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：보다세요；应去掉다后写보세요。","ko-KR":"잘못: 보다세요. 다를 빼고 보세요라고 씁니다."},"comparison":{"zh-CN":"보세요要求做“看”的动作；우산 주세요请求得到商品。","ko-KR":"보세요는 보는 동작 요청이고 우산 주세요는 상품 요청입니다."},"source":{"zh-CN":"母本§5.1；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"固有词数量＋量词","function":{"zh-CN":"说清买几个、几瓶，并与韩元金额区分。","ko-KR":"몇 개나 몇 병을 사는지 말하고 원 단위 금액과 구별합니다."},"rules":["量词前用한、두、세、네","顺序为商品名词＋数量＋量词","一般物品用개，瓶装商品用병","金额使用汉字词数字＋원"],"examples":[{"ko":"사과 세 개 주세요.","zh":"请给我三个苹果。","audioId":"chapter-06-grammar-02-example-01","audioStatus":"pending"},{"ko":"사과 세 개 주세요.","zh":"请给我三个苹果。","audioId":"chapter-06-grammar-02-example-02","audioStatus":"pending"},{"ko":"민지는 사과 세 개를 사요.","zh":"敏智买三个苹果。","audioId":"chapter-06-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：사과 삼 개；一般商品数量在개前用세。","ko-KR":"잘못: 사과 삼 개. 개 앞에서는 세를 씁니다."},"comparison":{"zh-CN":"사과 세 개是数量；삼천 원是金额。","ko-KR":"사과 세 개는 수량이고 삼천 원은 금액입니다."},"source":{"zh-CN":"母本§5.2；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N이/가 A-아/어요","function":{"zh-CN":"用形容词在句末评价商品。","ko-KR":"형용사를 문장 끝에 써서 상품을 평가합니다."},"rules":["有收音名词后用이，无收音用가","形容词变礼貌体作谓语","커요本课整词认读","形容词谓语后不再加이에요/예요"],"examples":[{"ko":"이 사과가 싸요.","zh":"这个苹果便宜。","audioId":"chapter-06-grammar-03-example-01","audioStatus":"pending"},{"ko":"사과가 싸요.","zh":"苹果便宜。","audioId":"chapter-06-grammar-03-example-02","audioStatus":"pending"},{"ko":"이 우산이 커요.","zh":"这把雨伞大。","audioId":"chapter-06-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：비싸요예요；비싸요已经是完整谓语。","ko-KR":"잘못: 비싸요예요. 비싸요만으로 서술어가 완성됩니다."},"comparison":{"zh-CN":"가방이 비싸요是完整句；비싼 가방属于后续定语形式。","ko-KR":"가방이 비싸요는 완전한 문장이고 비싼 가방은 뒤 과정의 관형형입니다."},"source":{"zh-CN":"母本§5.3；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},
          {"form":"N도","function":{"zh-CN":"追加商品或同类信息。","ko-KR":"상품이나 같은 종류의 정보를 더합니다."},"rules":["도直接接名词","本课中替代主格或宾格助词","必须有可理解的前项","数量可放在도之后"],"examples":[{"ko":"우유도 한 병 주세요.","zh":"牛奶也请给我一瓶。","audioId":"chapter-06-grammar-04-example-01","audioStatus":"pending"},{"ko":"바나나도 두 개 주세요.","zh":"香蕉也请给我两个。","audioId":"chapter-06-grammar-04-example-02","audioStatus":"pending"},{"ko":"우유도 한 병 사요.","zh":"牛奶也买一瓶。","audioId":"chapter-06-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"错误：우유를도；追加时도直接替代를。","ko-KR":"잘못: 우유를도. 추가할 때 도가 를을 대신합니다."},"comparison":{"zh-CN":"우유 한 병 주세요是首次提出；우유도 한 병 주세요表示追加。","ko-KR":"우유 한 병 주세요는 첫 요청이고 우유도 한 병 주세요는 추가 요청입니다."},"source":{"zh-CN":"母本§5.4；旧电子书精确页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}
        ],"coach":{"zh-CN":"六项填空全部正确才完成；口头规则解释和扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"shopping-flow-lab"}
      },
      {
        "code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,
        "nodeCode":"shopping-flow-lab","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},
        "description":{"zh-CN":"把询价、购买、追加和总价按信息逻辑连成交易。","ko-KR":"가격 질문, 구매, 추가와 전체 금액을 자연스러운 거래로 연결합니다."},
        "nodeTitle":{"zh-CN":"把六个话轮连成交易","ko-KR":"여섯 말차례를 거래로 연결하기"},
        "content":{"lead":{"zh-CN":"先练商品和价格、数量和量词、评价和追加三组替换，再排列六个完整话轮。","ko-KR":"상품과 가격, 수량과 단위, 평가와 추가를 바꿔 말한 뒤 여섯 말차례를 배열합니다."},"replacementSets":[["사과가 얼마예요? 한 개에 천 원이에요.","우유가 얼마예요? 한 병에 천오백 원이에요.","우산이 얼마예요? 칠천 원이에요."],["사과 세 개 주세요.","바나나 두 개 주세요.","우유 한 병 주세요.","물 네 병 주세요."],["사과가 싸요. 바나나도 두 개 주세요.","우산이 커요. 물도 한 병 주세요.","가방이 비싸요. 우유도 주세요."]],"orderItems":["모두 오천 원이에요.","사과 세 개 주세요.","사과가 얼마예요?","바나나도 두 개 주세요.","한 개에 천 원이에요.","모두 얼마예요?"],"personalFrames":["___이/가 얼마예요?","___ ___ 개/병 주세요.","___도 ___ 개/병 주세요."],"coach":{"zh-CN":"排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"fruit-shop-dialogue"}
      },
      {
        "code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":13,
        "nodeCode":"fruit-shop-dialogue","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},
        "description":{"zh-CN":"从两组顾客和店员对话中抓住数量、单价、总价和商品选择。","ko-KR":"두 고객·직원 대화에서 수량, 단가, 전체 금액과 선택을 파악합니다."},
        "nodeTitle":{"zh-CN":"听清单价，也听清顾客追加了什么","ko-KR":"단가와 추가한 상품을 정확히 듣기"},
        "content":{"lead":{"zh-CN":"先整段默读，待音频制作后整段听，再逐句跟读、隐藏中文并切换角色。","ko-KR":"전체를 읽고 음원 제작 후 들은 뒤 문장별로 따라 읽고 역할을 바꿉니다."},"dialogueScenes":[
          {"title":{"zh-CN":"社区水果店","ko-KR":"동네 과일 가게"},"people":{"zh-CN":"敏智（顾客）与秀彬（店员）","ko-KR":"민지(손님)와 수빈(직원)"},"purpose":{"zh-CN":"询问苹果单价、购买和评价、追加香蕉、确认总价并付款。","ko-KR":"사과 단가를 묻고 구매·평가한 뒤 바나나를 더하고 전체 금액을 계산합니다."},"audioId":"chapter-06-dialogue-main","audioStatus":"pending","lines":[{"speaker":"민지","ko":"사과가 얼마예요?","zh":"苹果多少钱？"},{"speaker":"수빈","ko":"한 개에 천 원이에요.","zh":"一个1,000韩元。"},{"speaker":"민지","ko":"사과가 싸요. 사과 세 개 주세요.","zh":"苹果便宜。请给我三个。"},{"speaker":"수빈","ko":"네, 여기에서 고르세요.","zh":"好的，请从这里挑选。"},{"speaker":"민지","ko":"바나나도 두 개 주세요.","zh":"香蕉也请给我两个。"},{"speaker":"수빈","ko":"네, 바나나는 두 개에 이천 원이에요.","zh":"好的，香蕉两个2,000韩元。"},{"speaker":"민지","ko":"모두 얼마예요?","zh":"一共多少钱？"},{"speaker":"수빈","ko":"모두 오천 원이에요.","zh":"一共5,000韩元。"},{"speaker":"민지","ko":"네, 여기요.","zh":"好的，给您。"},{"speaker":"수빈","ko":"감사합니다.","zh":"谢谢。"}]},
          {"title":{"zh-CN":"便利店雨具货架","ko-KR":"편의점 우산 매대"},"people":{"zh-CN":"俊浩（顾客）与贤宇（店员）","ko-KR":"준호(손님)와 현우(직원)"},"purpose":{"zh-CN":"比较两把雨伞的价格和大小并选择7,000韩元的雨伞。","ko-KR":"우산 두 개의 가격과 크기를 비교하고 7천 원 우산을 고릅니다."},"audioId":"chapter-06-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"준호","ko":"이 우산이 얼마예요?","zh":"这把雨伞多少钱？"},{"speaker":"현우","ko":"만 원이에요.","zh":"10,000韩元。"},{"speaker":"준호","ko":"조금 비싸요. 저 우산도 만 원이에요?","zh":"有点贵。那把雨伞也是10,000韩元吗？"},{"speaker":"현우","ko":"아니요, 칠천 원이에요. 이 우산이 커요. 한번 보세요.","zh":"不是，7,000韩元。这把雨伞大。请看一下。"},{"speaker":"준호","ko":"네, 이 우산 주세요.","zh":"好的，请给我这把雨伞。"},{"speaker":"현우","ko":"네, 감사합니다.","zh":"好的，谢谢。"}]}
        ],"coach":{"zh-CN":"两场景价格事实题和付款回应题都答对才完成；替换和试录为自主练习。","ko-KR":"두 장면 가격 사실과 계산 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-shop"}
      },
      {
        "code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":13,
        "nodeCode":"listen-and-shop","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},
        "description":{"zh-CN":"听出购物总价，再提交35—50秒双角色交易录音。","ko-KR":"전체 금액을 듣고 35~50초 두 역할 거래 녹음을 제출합니다."},
        "nodeTitle":{"zh-CN":"听出总价，再完成自己的购物对话","ko-KR":"전체 금액을 듣고 나만의 쇼핑 대화 완성하기"},
        "content":{"lead":{"zh-CN":"听力从数量和单价抓总价；口语按九类信息清单完成两个角色交替的交易。","ko-KR":"듣기에서는 수량과 단가로 전체 금액을 찾고 말하기에서는 아홉 정보로 두 역할 대화를 완성합니다."},"listening":{"audioId":"chapter-06-listening-total","audioStatus":"pending","question":{"zh-CN":"敏智买的东西一共多少钱？","ko-KR":"민지는 모두 얼마를 내요?"}},"speakingFrame":["___이/가 얼마예요?","한 개/병에 ___원이에요.","___이/가 싸요/비싸요/커요/작아요.","___도 ___ 개/병 주세요.","모두 얼마예요?／모두 ___원이에요."],"coach":{"zh-CN":"音频真实制作并可播放后听力才可完成；口语提交只记录完成证据，不产生正确性或分数。","ko-KR":"실제 음원이 재생 가능해야 듣기를 완료할 수 있고 말하기는 정오나 점수 없이 완료 증거만 기록합니다."},"nextNode":"price-card-and-order"}
      },
      {
        "code":"read_write","order":7,"accent":"iris","type":"practice","minutes":12,
        "nodeCode":"price-card-and-order","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},
        "description":{"zh-CN":"读商品—单位—金额价格卡，再写4—5句原创订购消息。","ko-KR":"상품·단위·금액 가격표를 읽고 4~5문장의 새 주문 메시지를 씁니다."},
        "nodeTitle":{"zh-CN":"读价格卡，写一条真实订购消息","ko-KR":"가격표를 읽고 실제 주문 메시지 쓰기"},
        "content":{"lead":{"zh-CN":"从左到右配对商品、数量单位和价格，再按问候、询价、数量、追加和总价组织消息。","ko-KR":"상품, 수량 단위와 가격을 연결하고 인사, 가격 질문, 수량, 추가와 전체 금액 순서로 메시지를 씁니다."},"reading":"우리 동네 가게 · 오늘의 가격\n사과 한 개 1,000원\n바나나 두 개 2,000원\n우유 한 병 1,500원\n물 두 병 2,000원","writingFrame":"안녕하세요? → ___이/가 얼마예요? → ___ ___ 개/병 주세요. → ___도 ___ 개/병 주세요. → 모두 얼마예요?","rubric":["信息完整","核心语法","可理解度","格式与语气"],"example":"안녕하세요? 물이 얼마예요? 물 두 병 주세요. 바나나도 한 개 주세요. 모두 얼마예요?","coach":{"zh-CN":"阅读三题全对，并提交4—5句、五类信息齐全且完成四维自查的原创消息才完成。","ko-KR":"읽기 세 문제와 4~5문장, 다섯 정보, 네 기준 점검을 갖춘 새 메시지를 제출해야 합니다."},"nextNode":"can-do-check"}
      },
      {
        "code":"review","order":8,"accent":"coral","type":"review","minutes":8,
        "nodeCode":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"자기 점검"},
        "description":{"zh-CN":"完成综合多选、五项Can-do并记录返回节点。","ko-KR":"종합 복수 선택과 다섯 Can-do를 마치고 복습 위치를 기록합니다."},
        "nodeTitle":{"zh-CN":"我能把数量和金额说清楚吗？","ko-KR":"수량과 금액을 분명하게 말할 수 있나요?"},
        "content":{"lead":{"zh-CN":"按词汇、语法、理解、表达和读写错因返回对应节点；自主复习展示不作为强制证据。","ko-KR":"어휘, 문법, 이해, 표현과 읽기·쓰기의 원인에 따라 해당 노드로 돌아갑니다."},"canDo":[{"ko":"상품의 단가와 전체 금액을 묻고 들을 수 있어요.","zh":"我能询问并听懂商品单价和总价。"},{"ko":"고유어 수와 개／병을 사용하여 상품 수량을 말할 수 있어요.","zh":"我能用固有词数量和개／병说商品数量。"},{"ko":"-(으)세요로 쇼핑 동작을 공손하게 요청할 수 있어요.","zh":"我能用-(으)세요礼貌请对方做购物相关动作。"},{"ko":"형용사 서술어로 상품을 평가하고 도로 상품을 추가할 수 있어요.","zh":"我能用形容词谓语评价商品，并用도追加商品。"},{"ko":"35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 할 수 있어요.","zh":"我能完成35—50秒、不少于8轮的双角色购物对话。"}],"remediation":[{"reason":"词汇","node":"shopping-words"},{"reason":"语法","node":"shopping-language-tools"},{"reason":"理解","node":"fruit-shop-dialogue／listen-and-shop"},{"reason":"表达","node":"listen-and-shop"},{"reason":"读写","node":"price-card-and-order"}],"chapterTest":"korean-level-one-06","coach":{"zh-CN":"综合多选答对，五项自查全部回应并记录返回节点或none后完成。","ko-KR":"종합 문제 정답과 다섯 점검 및 복습 위치 또는 none 기록이 필요합니다."}}
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

  delete from public.digital_textbook_modules
  where chapter_id = chapter_uuid
    and module_code not in ('orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review');

  for activity_seed in
    select value from jsonb_array_elements($activities$
    [
      {"nodeCode":"mission-map","key":"orientation-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"敏智在水果店看不清苹果价格，最适合先说哪一句？","ko-KR":"민지는 과일 가게에서 사과 가격을 잘 볼 수 없습니다. 가장 먼저 할 말은 무엇이에요?"},"instruction":{"zh-CN":"选择一个能直接询问苹果价格的表达；本题不显示分数。","ko-KR":"사과 가격을 직접 묻는 표현을 하나 고르세요. 점수는 표시하지 않습니다."},"options":["사과가 얼마예요?","사과 세 개 주세요.","사과가 싸요.","주말에 뭐 했어요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"사과가 얼마예요?直接询问苹果价格。","ko-KR":"사과가 얼마예요?는 사과 가격을 직접 묻습니다."},"feedback":[{"zh-CN":"先找表示价格疑问的词。","ko-KR":"가격을 묻는 말을 먼저 찾으세요."},{"zh-CN":"目标句要同时出现사과和얼마예요?。","ko-KR":"사과와 얼마예요?가 함께 있는 문장을 찾으세요."},{"zh-CN":"正确表达是사과가 얼마예요?。","ko-KR":"정답은 사과가 얼마예요?입니다."}]}},
      {"nodeCode":"shopping-words","key":"vocabulary-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"在사과가 얼마예요?中，얼마表示什么？","ko-KR":"사과가 얼마예요?에서 얼마는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["价格多少","数量三个","苹果","店员"],"config":{"shuffle":true,"audioStatus":"pending","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"얼마是“价格多少”；整句表示“苹果多少钱？”","ko-KR":"얼마는 가격을 묻고 문장은 사과 가격이 얼마인지 묻습니다."},"feedback":[{"zh-CN":"先判断整句在问商品、人物、数量还是价格。","ko-KR":"상품, 사람, 수량과 가격 중 무엇을 묻는지 보세요."},{"zh-CN":"얼마예요?常用于不知道金额时询价。","ko-KR":"얼마예요?는 모르는 가격을 물을 때 씁니다."},{"zh-CN":"目标词义是“价格多少”。","ko-KR":"정답은 가격이 얼마인지 묻는 뜻입니다."}]}},
      {"nodeCode":"shopping-language-tools","key":"grammar-fill","type":"fill_blank","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"连续完成六小题，检查动作请求、固有词数量＋量词、形容词谓语和도。","ko-KR":"동작 요청, 고유어 수와 단위, 형용사 서술어와 도를 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"填写먹___、보___、사과 ___ 개、물 ___ 병、가방___ 커요、우유___ 주세요。","ko-KR":"먹___, 보___, 사과 ___ 개, 물 ___ 병, 가방___ 커요, 우유___ 주세요를 완성하세요."},"options":[],"config":{"inputMode":"text","normalize":"NFC","items":[{"id":"blank_01","label":"먹다 → 먹___（请吃）","placeholder":"请填写"},{"id":"blank_02","label":"보다 → 보___（请看）","placeholder":"请填写"},{"id":"blank_03","label":"사과 ___ 개 주세요.（三个）","placeholder":"请填写"},{"id":"blank_04","label":"물 ___ 병 주세요.（两瓶）","placeholder":"请填写"},{"id":"blank_05","label":"가방___ 커요.（主格助词）","placeholder":"请填写"},{"id":"blank_06","label":"우유___ 주세요.（也）","placeholder":"请填写"}]},"answer":{"kind":"text_array","value":["으세요","세요","세","두","이","도"]},"explanation":{"correct":{"zh-CN":"六项依次是으세요、세요、세、두、이、도。","ko-KR":"정답은 으세요, 세요, 세, 두, 이, 도입니다."},"feedback":[{"zh-CN":"先区分动作请求、数量、评价对象和追加。","ko-KR":"동작 요청, 수량, 평가 대상과 추가를 구분하세요."},{"zh-CN":"检查收音、量词前缩略形和助词位置。","ko-KR":"받침, 단위 앞 준말과 조사 위치를 확인하세요."},{"zh-CN":"答案依次为으세요、세요、세、두、이、도。","ko-KR":"여섯 답을 모두 정확히 다시 쓰세요."}]}},
      {"nodeCode":"shopping-flow-lab","key":"pattern-order","type":"ordering","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"把六个完整话轮排成一段自然购物交易。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 쇼핑 대화 순서로 배열하세요."},"instruction":{"zh-CN":"依据问答关系和上下文排列，不拆分话轮。","ko-KR":"문답 관계와 맥락에 맞게 완전한 말차례를 배열하세요."},"options":["모두 오천 원이에요.","사과 세 개 주세요.","사과가 얼마예요?","바나나도 두 개 주세요.","한 개에 천 원이에요.","모두 얼마예요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[2,4,1,3,5,0]},"explanation":{"correct":{"zh-CN":"先询价和单价，再买苹果、追加香蕉，最后问答总价。","ko-KR":"가격 질문과 단가 뒤에 사과 구매, 바나나 추가와 전체 금액 문답이 옵니다."},"feedback":[{"zh-CN":"先找商品价格问答和最后的总价问答。","ko-KR":"상품 가격 문답과 마지막 전체 금액 문답을 찾으세요."},{"zh-CN":"中间先买苹果，再用도追加香蕉。","ko-KR":"중간에는 사과를 사고 도로 바나나를 더합니다."},{"zh-CN":"正确顺序是询价→单价→买苹果→追加香蕉→问总价→报总价。","ko-KR":"가격 질문, 단가, 사과 구매, 바나나 추가, 전체 금액 질문과 답 순서입니다."}]}},
      {"nodeCode":"fruit-shop-dialogue","key":"dialogue-fact-check","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"哪组选项同时正确概括两个场景的价格信息？","ko-KR":"두 장면의 가격 정보를 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“主场景总价／第二场景最后所选雨伞价格”的正确组合。","ko-KR":"주 장면의 전체 금액과 두 번째 장면에서 마지막에 고른 우산 가격의 조합을 고르세요."},"options":["5,000원／7,000원","5,000원／10,000원","3,000원／7,000원","2,000원／10,000원"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"主场景总价5,000韩元，最后所选雨伞7,000韩元。","ko-KR":"주 장면은 5천 원이고 마지막에 고른 우산은 7천 원입니다."},"feedback":[{"zh-CN":"找主场景含모두的台词和第二场景选择前的价格。","ko-KR":"모두가 있는 대사와 선택 직전 가격을 찾으세요."},{"zh-CN":"不要把第一把10,000韩元的雨伞当成最后选择。","ko-KR":"처음 본 만 원 우산을 마지막 선택으로 착각하지 마세요."},{"zh-CN":"正确组合是5,000원／7,000원。","ko-KR":"정답은 5,000원／7,000원입니다."}]}},
      {"nodeCode":"fruit-shop-dialogue","key":"dialogue-response","type":"single_choice","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"秀彬说모두 오천 원이에요.后，敏智要把钱递给店员，哪一句最合适？","ko-KR":"수빈이 모두 오천 원이에요.라고 말한 뒤 민지가 돈을 건넬 때 가장 알맞은 말은 무엇이에요?"},"instruction":{"zh-CN":"选择符合确认金额并递交钱款的礼貌回应。","ko-KR":"금액을 확인하고 돈을 건네는 상황에 맞는 공손한 대답을 고르세요."},"options":["네, 여기요.","사과 세 개 주세요.","얼마예요?","조금 비싸요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"네, 여기요.用于把准备好的钱递给店员。","ko-KR":"네, 여기요.는 준비한 돈을 직원에게 건넬 때 알맞습니다."},"feedback":[{"zh-CN":"总价已知，现在要完成递交钱款。","ko-KR":"전체 금액을 알았으니 이제 돈을 건넵니다."},{"zh-CN":"不要重新询价或下单。","ko-KR":"다시 가격을 묻거나 주문하지 마세요."},{"zh-CN":"最合适的是네, 여기요.。","ko-KR":"정답은 네, 여기요.입니다."}]}},
      {"nodeCode":"listen-and-shop","key":"listening-total","type":"listening","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"听购物信息，判断敏智买的东西一共多少钱。","ko-KR":"쇼핑 정보를 듣고 민지가 모두 얼마를 내는지 고르세요."},"instruction":{"zh-CN":"正常语速最多听两遍，慢速最多听一遍；依据商品、数量、单价和末句总价作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 상품, 수량, 단가와 마지막 전체 금액에 근거해 답하세요."},"options":["4,500원","3,000원","1,500원","5,500원"],"config":{"audioId":"chapter-06-listening-total","audioStatus":"pending","normalReplayLimit":2,"slowReplayLimit":1,"shuffle":true},"answer":{"kind":"index","value":0},"transcript":"민지는 동네 가게에 가요. 사과는 한 개에 천 원이에요. 우유는 한 병에 천오백 원이에요. 민지는 사과 세 개를 사요. 우유도 한 병 사요. 모두 사천오백 원이에요.","audioObjectKey":"korean-level-one/chapter-06/listening/chapter-06-listening-total.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"三个苹果3,000韩元，加一瓶牛奶1,500韩元，共4,500韩元。","ko-KR":"사과 세 개 3천 원과 우유 한 병 1천5백 원으로 모두 4천5백 원입니다."},"feedback":[{"zh-CN":"分别记下苹果数量、苹果单价和牛奶单价。","ko-KR":"사과 수량과 단가, 우유 단가를 적으세요."},{"zh-CN":"3,000韩元还要加一瓶1,500韩元的牛奶。","ko-KR":"3천 원에 우유 한 병 1천5백 원을 더하세요."},{"zh-CN":"答案是4,500원；末句也直接说明总价。","ko-KR":"정답은 4,500원이며 마지막 문장에도 나옵니다."}],"privateListening":{"slowScript":"민지는 동네 가게에 가요. / 사과는 한 개에 천 원이에요. / 우유는 한 병에 천오백 원이에요. / 민지는 사과 세 개를 사요. / 우유도 한 병 사요. / 모두 사천오백 원이에요.","pauseMarks":"민지는 동네 가게에 가요. ⏸ 사과는 한 개에 천 원이에요. ⏸ 우유는 한 병에 천오백 원이에요. ⏸ 민지는 사과 세 개를 사요. ⏸ 우유도 한 병 사요. ⏸ 모두 사천오백 원이에요.","speaker":"F03／第三人称旁白","distractorReasons":{"1":"只计算三个苹果，漏掉牛奶。","2":"只取牛奶单价。","3":"原文不支持此金额。"}}}},
      {"nodeCode":"listen-and-shop","key":"speaking-shopping-dialogue","type":"speaking","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"完成35—50秒、不少于8轮的双角色购物对话。","ko-KR":"35~50초 동안 8턴 이상의 두 역할 쇼핑 대화를 완성하세요."},"instruction":{"zh-CN":"加入商品询价、单价、数量购买、形容词评价、一处-(으)세요、도追加、追加商品价格、总价问答和付款回应。","ko-KR":"상품 가격 질문, 단가, 수량 구매, 형용사 평가, -(으)세요 한 번, 도 추가, 추가 상품 가격, 전체 금액 문답과 계산 응답을 넣으세요."},"options":[],"config":{"minimumSeconds":35,"maximumSeconds":50,"minimumTurns":8,"requiredCriteria":9,"enforceCompletionRequirements":true,"pronunciationScore":false,"turnLabel":{"zh-CN":"双角色交替话轮数","ko-KR":"두 역할 교대 말차례 수"},"criteria":["商品询价","单价","数量购买","形容词评价","使用-(으)세요提出动作请求","使用도追加","追加商品价格","总价问答","付款回应"]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存录音元数据与九类自查；不产生正确性或分数，等待人工复核。","ko-KR":"녹음 정보와 아홉 점검을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查时长、两个角色、至少8轮和九类信息。","ko-KR":"시간, 두 역할, 8턴 이상과 아홉 정보를 확인하세요."},{"zh-CN":"再检查数量量词、形容词、도和一处-(으)세요。","ko-KR":"수량 단위, 형용사, 도와 -(으)세요 한 번을 확인하세요."},{"zh-CN":"按九项清单补齐后重录；不显示虚假发音准确率。","ko-KR":"아홉 항목을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
      {"nodeCode":"price-card-and-order","key":"reading-price-card","type":"single_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"阅读“今日价格”卡，完成苹果单价、香蕉数量和牛奶单价三题。","ko-KR":"오늘의 가격 카드를 읽고 사과 단가, 바나나 수량과 우유 단가 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；从公开价格卡对应商品行直接找依据。","ko-KR":"문제마다 하나를 고르고 공개 가격표의 해당 상품 줄에서 근거를 찾으세요."},"options":[],"config":{"reading":"우리 동네 가게 · 오늘의 가격\n사과 한 개 1,000원\n바나나 두 개 2,000원\n우유 한 병 1,500원\n물 두 병 2,000원","items":[{"id":"question_01","question":"사과 한 개는 얼마예요?","options":["1,000원","1,500원","2,000원","5,000원"]},{"id":"question_02","question":"바나나는 몇 개에 이천 원이에요?","options":["두 개","한 개","세 개","네 개"]},{"id":"question_03","question":"우유 한 병은 얼마예요?","options":["1,500원","1,000원","2,000원","4,500원"]}],"shuffle":true},"answer":{"kind":"index_array","value":[0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是1,000원、두 개、1,500원。","ko-KR":"정답은 1,000원, 두 개, 1,500원입니다."},"feedback":[{"zh-CN":"分别圈出사과、바나나、우유三行。","ko-KR":"사과, 바나나와 우유 줄을 각각 찾으세요."},{"zh-CN":"每行按商品—数量单位—金额读取。","ko-KR":"각 줄을 상품, 수량 단위, 금액 순서로 읽으세요."},{"zh-CN":"答案是1,000원、두 개、1,500원。","ko-KR":"가격표에서 세 답을 다시 확인하세요."}]}},
      {"nodeCode":"price-card-and-order","key":"write-order-message","type":"writing","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"给社区商店写一条4—5句的原创询价订购消息。","ko-KR":"동네 가게에 보낼 새로운 가격 문의와 주문 메시지를 4~5문장으로 쓰세요."},"instruction":{"zh-CN":"写问候、一种商品的价格问题、该商品的数量请求、用도追加另一商品和总价问题，并完成自查。","ko-KR":"인사, 한 상품의 가격 질문과 수량 요청, 도를 사용한 다른 상품 추가, 전체 금액 질문을 쓰고 점검하세요."},"options":[],"config":{"minSentences":4,"maxSentences":5,"minimumHangulCharacters":25,"minimumPhraseGroups":5,"minimumInformationKinds":5,"requireCompletionChecklist":true,"requiredPhraseGroups":[["안녕하세요"],["얼마예요"],["주세요"],["도 "],["모두"]],"informationChecklist":["问候","一种商品的价格问题","该商品的数量请求","使用도追加另一商品","总价问题"],"structureFrame":"안녕하세요? → ___이/가 얼마예요? → ___ ___ 개/병 주세요. → ___도 ___ 개/병 주세요. → 모두 얼마예요?","rubric":["信息完整","核心语法","可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、五类信息与量规自查的原创消息；不产生正确性或分数。","ko-KR":"문장 수, 다섯 정보와 자기 점검을 갖춘 새 메시지를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数4—5句和五类信息。","ko-KR":"4~5문장과 다섯 정보를 먼저 세세요."},{"zh-CN":"检查固有词数量、量词和도的位置。","ko-KR":"고유어 수, 단위와 도의 위치를 확인하세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
      {"nodeCode":"can-do-check","key":"review-multiple","type":"multiple_choice","order":1,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"选择所有能直接帮助完成购物交易的表达。","ko-KR":"쇼핑 대화를 직접 완성하는 데 사용할 수 있는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["사과가 얼마예요?","사과 세 개 주세요.","우유도 한 병 주세요.","주말에 친구를 만났어요."],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三句用于询价、数量购买和追加；周末经历句与购物无关。","ko-KR":"앞 세 문장은 가격 질문, 수량 구매와 추가이고 주말 문장은 쇼핑과 관계없습니다."},"feedback":[{"zh-CN":"按询价、购买和追加检查每一句。","ko-KR":"가격 질문, 구매와 추가 기능을 확인하세요."},{"zh-CN":"有一句属于过去周末经历。","ko-KR":"한 문장은 지난 주말 경험입니다."},{"zh-CN":"选择前三句，不选周末经历句。","ko-KR":"앞 세 문장을 고르고 주말 문장은 고르지 않습니다."}]}},
      {"nodeCode":"can-do-check","key":"self-check","type":"self_check","order":2,"maxAttempts":3,"counts":true,"prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项选至少一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"price","label":"我能询问并听懂商品单价和总价／상품 단가와 전체 금액을 묻고 들을 수 있어요"},{"id":"quantity","label":"我能用固有词数量和개／병说数量／고유어 수와 개／병으로 수량을 말할 수 있어요"},{"id":"request","label":"我能用-(으)세요礼貌请求动作／-(으)세요로 동작을 공손하게 요청할 수 있어요"},{"id":"evaluation","label":"我能用形容词评价并用도追加／형용사로 평가하고 도로 추가할 수 있어요"},{"id":"dialogue","label":"我能完成35—50秒、至少8轮的双角色对话／35~50초, 8턴 이상의 두 역할 대화를 할 수 있어요"}],"returnNodes":[{"value":"shopping-words","label":"词汇"},{"value":"shopping-language-tools","label":"语法"},{"value":"fruit-shop-dialogue","label":"对话理解"},{"value":"listen-and-shop","label":"听说"},{"value":"price-card-and-order","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想价格、数量、动作请求、评价追加和最终录音。","ko-KR":"가격, 수량, 동작 요청, 평가·추가와 마지막 녹음을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"다섯 항목에 답하고 복습 항목이 있으면 none만 고를 수 없습니다."}]}}
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

  delete from public.digital_textbook_activities as activity
  using public.digital_textbook_nodes as node, public.digital_textbook_modules as module
  where activity.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-total',
      'speaking-shopping-dialogue','reading-price-card','write-order-message',
      'review-multiple','self-check'
    );

  for media_seed in
    select value from jsonb_array_elements($images$
    [
      {"nodeCode":"mission-map","key":"chapter-06-image-01","purpose":"章节情境主图","objectKey":"korean-level-one/chapter-06/images/chapter-06-01-scene.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-01-章节情境主图.png","alt":{"zh-CN":"水果店里成年顾客指着苹果向店员询价，价格牌不可读。","ko-KR":"과일 가게에서 성인 손님이 읽을 수 없는 가격표 옆 사과를 가리키며 직원에게 가격을 묻습니다."},"width":1600,"height":900},
      {"nodeCode":"shopping-words","key":"chapter-06-image-02","purpose":"核心词汇商品与单位卡","objectKey":"korean-level-one/chapter-06/images/chapter-06-02-vocabulary.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-02-核心词汇卡-商品与单位.png","alt":{"zh-CN":"五种商品与개、병数量分组。","ko-KR":"다섯 상품과 개, 병 수량 묶음입니다."},"width":1200,"height":900},
      {"nodeCode":"shopping-language-tools","key":"chapter-06-image-03","purpose":"购物语言工具语法总图","objectKey":"korean-level-one/chapter-06/images/chapter-06-03-grammar-overview.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-03-语法总图-购物语言工具.png","alt":{"zh-CN":"动作请求、数量、评价和追加四轨结构。","ko-KR":"동작 요청, 수량, 평가와 추가의 네 갈래 구조입니다."},"width":1600,"height":900},
      {"nodeCode":"shopping-language-tools","key":"chapter-06-image-04","purpose":"-(으)세요结构图","objectKey":"korean-level-one/chapter-06/images/chapter-06-03a-euseyo.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-03A-语法结构图-으세요.png","alt":{"zh-CN":"动词词干按收音分流到으세요或세요。","ko-KR":"동사 어간의 받침에 따라 으세요와 세요로 나뉩니다."},"width":1200,"height":900},
      {"nodeCode":"shopping-language-tools","key":"chapter-06-image-05","purpose":"固有词数量与量词结构图","objectKey":"korean-level-one/chapter-06/images/chapter-06-03b-counters.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-03B-语法结构图-固有词量词.png","alt":{"zh-CN":"一至四缩略形、개和병与金额对比。","ko-KR":"하나부터 넷의 준말, 개와 병, 금액 비교입니다."},"width":1200,"height":900},
      {"nodeCode":"shopping-language-tools","key":"chapter-06-image-06","purpose":"形容词谓语结构图","objectKey":"korean-level-one/chapter-06/images/chapter-06-03c-adjective.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-03C-语法结构图-形容词谓语.png","alt":{"zh-CN":"商品接이或가后连接价格与大小形容词。","ko-KR":"상품 뒤에 이나 가를 붙여 가격과 크기 형용사로 연결합니다."},"width":1200,"height":900},
      {"nodeCode":"shopping-language-tools","key":"chapter-06-image-07","purpose":"名词도追加结构图","objectKey":"korean-level-one/chapter-06/images/chapter-06-03d-do.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-03D-语法结构图-名词도.png","alt":{"zh-CN":"第一件商品到追加商品的도替换关系。","ko-KR":"첫 상품에서 추가 상품으로 이어지는 도의 대체 관계입니다."},"width":1200,"height":900},
      {"nodeCode":"shopping-flow-lab","key":"chapter-06-image-08","purpose":"句型交易语块卡","objectKey":"korean-level-one/chapter-06/images/chapter-06-04-pattern-blocks.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-04-句型交易语块卡.png","alt":{"zh-CN":"六张完整购物话轮卡。","ko-KR":"여섯 장의 완전한 쇼핑 말차례 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"fruit-shop-dialogue","key":"chapter-06-image-09","purpose":"实战对话双场景图","objectKey":"korean-level-one/chapter-06/images/chapter-06-05-dialogue.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-05-实战对话场景.png","alt":{"zh-CN":"水果店和便利店雨具货架的两组顾客与店员。","ko-KR":"과일 가게와 편의점 우산 매대의 두 고객·직원 장면입니다."},"width":1600,"height":900},
      {"nodeCode":"listen-and-shop","key":"chapter-06-image-10","purpose":"听力购物篮信息图","objectKey":"korean-level-one/chapter-06/images/chapter-06-06-listening-basket.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-06-听力信息图-购物篮.png","alt":{"zh-CN":"苹果、牛奶购物篮和随机金额卡，不显示数量答案。","ko-KR":"수량 답을 보여 주지 않는 사과, 우유 장바구니와 금액 카드입니다."},"width":1200,"height":900},
      {"nodeCode":"price-card-and-order","key":"chapter-06-image-11","purpose":"今日价格卡","objectKey":"korean-level-one/chapter-06/images/chapter-06-07-price-card.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-07-今日价格卡.png","alt":{"zh-CN":"按商品、销售单位和金额分成四行的今日价格卡。","ko-KR":"상품, 판매 단위와 금액을 네 줄로 정리한 오늘의 가격표입니다."},"width":1200,"height":1600},
      {"nodeCode":"can-do-check","key":"chapter-06-image-12","purpose":"最终双角色交易流程图","objectKey":"korean-level-one/chapter-06/images/chapter-06-08-final-task.png","plannedSourcePath":"../附件/韩国语1级/第06课/第06课-08-最终任务图.png","alt":{"zh-CN":"从询价到付款的九步双角色流程。","ko-KR":"가격 질문부터 계산까지 아홉 단계 두 역할 흐름입니다."},"width":1600,"height":900}
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
  where module.chapter_id = chapter_uuid and node.node_code = 'shopping-words';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid,
    'chapter-06-vocabulary-' || lpad(item.ordinality::text, 2, '0'),
    'audio', '词汇原形点读',
    'korean-level-one/chapter-06/audio/vocabulary/chapter-06-vocabulary-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-06-vocabulary-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value->>'word')
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
    'chapter-06-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'),
    'audio', '词汇搭配例句点读',
    'korean-level-one/chapter-06/audio/vocabulary/chapter-06-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0') || '.mp3',
    'pending',
    '{"zh-CN":"词汇搭配例句音频待制作","ko-KR":"어휘 결합 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', 'chapter-06-vocabulary-collocation-' || lpad(item.ordinality::text, 2, '0'), 'script', item.value->>'collocation')
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
  where module.chapter_id = chapter_uuid and node.node_code = 'shopping-language-tools';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid, item.value->>'id', 'audio', '语法卡母版与语境复现例句',
    'korean-level-one/chapter-06/audio/grammar/' || (item.value->>'id') || '.mp3',
    'pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}'::jsonb,
    jsonb_build_object('audioId', item.value->>'id', 'script', item.value->>'script')
  from jsonb_array_elements($grammar$
    [{"id":"chapter-06-grammar-01-example-01","script":"이 가방을 보세요."},{"id":"chapter-06-grammar-01-example-02","script":"네, 여기에서 고르세요."},{"id":"chapter-06-grammar-01-example-03","script":"한번 보세요."},{"id":"chapter-06-grammar-02-example-01","script":"사과 세 개 주세요."},{"id":"chapter-06-grammar-02-example-02","script":"사과 세 개 주세요."},{"id":"chapter-06-grammar-02-example-03","script":"민지는 사과 세 개를 사요."},{"id":"chapter-06-grammar-03-example-01","script":"이 사과가 싸요."},{"id":"chapter-06-grammar-03-example-02","script":"사과가 싸요."},{"id":"chapter-06-grammar-03-example-03","script":"이 우산이 커요."},{"id":"chapter-06-grammar-04-example-01","script":"우유도 한 병 주세요."},{"id":"chapter-06-grammar-04-example-02","script":"바나나도 두 개 주세요."},{"id":"chapter-06-grammar-04-example-03","script":"우유도 한 병 사요."}]
  $grammar$::jsonb) item(value)
  on conflict (node_id, asset_key) do update set
    object_key = excluded.object_key,
    production_status = 'pending',
    metadata = excluded.metadata,
    updated_at = now();

  select node.id into node_uuid
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'fruit-shop-dialogue';

  insert into public.digital_textbook_media_assets (
    node_id, asset_key, media_type, purpose, object_key, production_status,
    alt_text, metadata
  )
  select
    node_uuid, item.value->>'id', 'audio', item.value->>'purpose',
    'korean-level-one/chapter-06/audio/dialogue/' || (item.value->>'id') || '.mp3',
    'pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}'::jsonb,
    item.value - 'purpose'
  from jsonb_array_elements($dialogue$
    [{"id":"chapter-06-dialogue-main-line-01","purpose":"主对话逐句","script":"사과가 얼마예요?","speaker":"F01／민지"},{"id":"chapter-06-dialogue-main-line-02","purpose":"主对话逐句","script":"한 개에 천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-06-dialogue-main-line-03","purpose":"主对话逐句","script":"사과가 싸요. 사과 세 개 주세요.","speaker":"F01／민지"},{"id":"chapter-06-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 여기에서 고르세요.","speaker":"F02／수빈"},{"id":"chapter-06-dialogue-main-line-05","purpose":"主对话逐句","script":"바나나도 두 개 주세요.","speaker":"F01／민지"},{"id":"chapter-06-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 바나나는 두 개에 이천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-06-dialogue-main-line-07","purpose":"主对话逐句","script":"모두 얼마예요?","speaker":"F01／민지"},{"id":"chapter-06-dialogue-main-line-08","purpose":"主对话逐句","script":"모두 오천 원이에요.","speaker":"F02／수빈"},{"id":"chapter-06-dialogue-main-line-09","purpose":"主对话逐句","script":"네, 여기요.","speaker":"F01／민지"},{"id":"chapter-06-dialogue-main-line-10","purpose":"主对话逐句","script":"감사합니다.","speaker":"F02／수빈"},{"id":"chapter-06-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／F02"},{"id":"chapter-06-dialogue-alt-line-01","purpose":"第二对话逐句","script":"이 우산이 얼마예요?","speaker":"M01／준호"},{"id":"chapter-06-dialogue-alt-line-02","purpose":"第二对话逐句","script":"만 원이에요.","speaker":"M02／현우"},{"id":"chapter-06-dialogue-alt-line-03","purpose":"第二对话逐句","script":"조금 비싸요. 저 우산도 만 원이에요?","speaker":"M01／준호"},{"id":"chapter-06-dialogue-alt-line-04","purpose":"第二对话逐句","script":"아니요, 칠천 원이에요. 이 우산이 커요. 한번 보세요.","speaker":"M02／현우"},{"id":"chapter-06-dialogue-alt-line-05","purpose":"第二对话逐句","script":"네, 이 우산 주세요.","speaker":"M01／준호"},{"id":"chapter-06-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 감사합니다.","speaker":"M02／현우"},{"id":"chapter-06-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M01／M02"}]
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
    and node.node_code = 'listen-and-shop'
    and activity.activity_key = 'listening-total';

  insert into public.digital_textbook_media_assets (
    node_id, activity_id, asset_key, media_type, purpose, object_key,
    production_status, alt_text, metadata
  ) values
    (node_uuid,activity_uuid,'chapter-06-listening-total-normal','audio','私有听力正常语速','korean-level-one/chapter-06/listening/chapter-06-listening-total-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"normal"}'::jsonb),
    (node_uuid,activity_uuid,'chapter-06-listening-total-slow','audio','私有听力慢速','korean-level-one/chapter-06/listening/chapter-06-listening-total-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}'::jsonb,'{"speaker":"F03／第三人称旁白","scriptVisibility":"private","speed":"slow"}'::jsonb)
  on conflict (node_id, asset_key) do update set
    activity_id = excluded.activity_id,
    purpose = excluded.purpose,
    object_key = excluded.object_key,
    production_status = 'pending',
    alt_text = excluded.alt_text,
    metadata = excluded.metadata,
    updated_at = now();

  delete from public.digital_textbook_media_assets as media
  using public.digital_textbook_nodes as node, public.digital_textbook_modules as module
  where media.node_id = node.id
    and node.module_id = module.id
    and module.chapter_id = chapter_uuid
    and media.asset_key not like 'chapter-06-%';
end;
$seed$;

commit;
