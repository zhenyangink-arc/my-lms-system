begin;

-- Converted from the read-only UPLY BOOK chapter-fifteen master.
-- source_sha256: 8ae241072beebc3510902fd9c5f2f8b86582ec928fe6ee45982855f53cff7af1
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master as course-overview values pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_fifteen$
declare
  version_uuid uuid;
  lesson_uuid uuid;
  chapter_uuid uuid;
  test_uuid uuid;
  module_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
  item jsonb;
begin
  select version.id into version_uuid
  from public.digital_textbook_versions version
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
  order by version.version_number desc limit 1;
  if version_uuid is null then raise exception 'Cannot convert chapter 15: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 15: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug = 'korean-level-one-15' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id = lesson_uuid and chapter_number = 15 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000015'::uuid,lesson_uuid,
      'korean-level-one-15','korean-level-one',15,
      '第 15 章测试：想去旅行。','제15과 평가: 여행을 가고 싶어요.',
      '检查旅行地点、活动与准备词汇，条件、现在动作定语、本人愿望和有依据的第三人愿望，以及旅行对话、听力、阅读和发表组织。',
      12,60,
      '{"recognition":"旅行地点、活动与准备词汇","structure":"条件、现在动作定语与不同愿望主体","reading":"旅行对话、听力与计划卡理解","assembly":"单人旅行计划发表组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid, slug = 'korean-level-one-15', course_key = 'korean-level-one', chapter_number = 15,
      title = '第 15 章测试：想去旅行。', korean_title = '제15과 평가: 여행을 가고 싶어요.',
      description = '检查旅行地点、活动与准备词汇，条件、现在动作定语、本人愿望和有依据的第三人愿望，以及旅行对话、听力、阅读和发表组织。',
      duration_minutes = 12, passing_score = 60,
      skills = '{"recognition":"旅行地点、活动与准备词汇","structure":"条件、现在动作定语与不同愿望主体","reading":"旅行对话、听力与计划卡理解","assembly":"单人旅行计划发表组织"}'::jsonb,
      version = 1, status = 'draft', student_app_id = '10000000-0000-4000-8000-000000000001'::uuid, updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id = test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-15-01','在“숙소를 예약해요.”中，“숙소”是什么意思？','["住宿处","护照","地图","风景"]',0,'母本词汇表中숙소表示旅行中的住宿处。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-15-02','“먹다”怎样变成本课的条件形式？','["먹으면","먹면","먹어면","먹는"]',0,'有非ㄹ收音的词干接-으면。','structure',2,'single_choice',10,'foundation','["条件","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-15-03','“살다”怎样变成本课的条件形式？','["살면","사면","살으면","사는"]',0,'ㄹ收音在-(으)면前保留ㄹ并直接接-면。','structure',3,'single_choice',10,'foundation','["条件","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-15-04','哪一项正确表示“居住的地方”？','["사는 곳","살는 곳","살은 곳","사은 곳"]',0,'살다的ㄹ在-는的ㄴ前脱落，形成사는 곳。','structure',4,'single_choice',10,'foundation','["现在动作定语","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-15-05','哪一句正确表达说话人本人的愿望？','["저는 제주도에 가고 싶어요.","저는 제주도에 가 싶어요.","저는 제주도에 가고싶어요.","저는 제주도에 가고 싶어 해요."]',0,'本人愿望使用V-고 싶어요并按规范分写。','structure',5,'single_choice',10,'foundation','["本人愿望","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-15-06','已有智敏亲口表达作为依据时，哪一句正确转述她的愿望？','["지민 씨는 사진을 찍고 싶어 해요.","지민 씨는 사진을 찍고 싶어해요.","지민 씨는 사진을 찍어 싶어요.","저는 사진을 찍고 싶어 해요."]',0,'有依据的同龄第三人愿望使用V-고 싶어 해요，싶어与해요分写。','structure',6,'single_choice',10,'foundation','["第三人愿望","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-15-07','主场景中，天气好时王明想做什么？','["在海里游泳","参观博物馆","准备地图","预订住宿"]',0,'主对话第5轮中王明说想在海里游泳。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-15-08','私有听力中，下雨时俊浩想做什么？','["参观博物馆","沿海边散步","登山","预订住宿"]',0,'听力原文中俊浩亲口说비가 오면 박물관을 구경하고 싶어요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-15-09','丽娜的计划卡中，有时间时想去哪里？','["江陵","釜山","济州岛","机场"]',0,'阅读第①句写明시간이 있으면 강릉에 가고 싶어요。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-15-10','丽娜的计划卡中，下雪时丹尼尔想做什么？','["参观博物馆","看风景","游泳","准备地图"]',0,'阅读第⑥句写明丹尼尔下雪时想参观博物馆。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-15-11','单人旅行发表的自然信息链是哪一项？','["时间与条件→目的地与V-는 N信息→本人愿望→有依据的同行人愿望→备选与准备","只说目的地→结束","凭空断定陌生人的愿望→省略条件","改成多人对话→不说明准备"]',0,'母本最终输出要求把十项信息组织成一段有依据的单人发表。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-15-12','课末正式口语必须满足哪一项？','["50—70秒、10—12句、单一发表者并覆盖十项信息","只朗读一条愿望句即可","必须获得自动发音分数","可以凭空描述第三人愿望"]',0,'母本规定50—70秒、10—12句、单一发表者和十项信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id = version_uuid and (chapter_number = 15 or slug = 'travel-wishes')
  order by (slug = 'travel-wishes') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'travel-wishes',15,
      '{"zh-CN":"想去旅行。","ko-KR":"여행을 가고 싶어요."}',
      '{"zh-CN":"王明和智敏在校园咖啡馆商量暑假济州岛旅行，确认晴天与雨天活动；王明再向社团成员素拉转述智敏已亲口说过的愿望。","ko-KR":"왕밍과 지민은 학교 카페에서 제주도 여행의 맑은 날과 비 오는 날 활동을 정하고, 왕밍은 소라에게 지민이 직접 말한 희망을 전합니다."}',
      '{"zh-CN":"用条件和现在动作定语说明旅行信息，区分本人愿望与有依据的第三人愿望，完成50—70秒、10—12句的单人旅行发表。","ko-KR":"조건과 현재 동작 관형형으로 여행 정보를 설명하고 자기 희망과 근거가 있는 제삼자 희망을 구별하여 50~70초, 10~12문장의 발표를 완성합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第15课 여행을 가고 싶어요.md @ 2026-08-18 / sha256:8ae241072beebc3510902fd9c5f2f8b86582ec928fe6ee45982855f53cff7af1'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id = test_uuid, slug = 'travel-wishes', chapter_number = 15,
      title = '{"zh-CN":"想去旅行。","ko-KR":"여행을 가고 싶어요."}',
      scenario = '{"zh-CN":"王明和智敏在校园咖啡馆商量暑假济州岛旅行，确认晴天与雨天活动；王明再向社团成员素拉转述智敏已亲口说过的愿望。","ko-KR":"왕밍과 지민은 학교 카페에서 제주도 여행의 맑은 날과 비 오는 날 활동을 정하고, 왕밍은 소라에게 지민이 직접 말한 희망을 전합니다."}',
      goal = '{"zh-CN":"用条件和现在动作定语说明旅行信息，区分本人愿望与有依据的第三人愿望，完成50—70秒、10—12句的单人旅行发表。","ko-KR":"조건과 현재 동작 관형형으로 여행 정보를 설명하고 자기 희망과 근거가 있는 제삼자 희망을 구별하여 50~70초, 10~12문장의 발표를 완성합니다."}',
      status = 'draft', production_status = 'editorial_review', editorial_status = 'pending',
      native_review_status = 'pending', audio_status = 'pending', image_status = 'pending',
      source_revision = 'UPLY BOOK 第15课 여행을 가고 싶어요.md @ 2026-08-18 / sha256:8ae241072beebc3510902fd9c5f2f8b86582ec928fe6ee45982855f53cff7af1',
      updated_at = now()
    where id = chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"条件变了，旅行愿望怎样说清楚？","ko-KR":"조건이 달라지면 여행 희망을 어떻게 말할까요?"},"content":{"lead":{"zh-CN":"说清旅行时间、天气条件、目的地以及本人和同行人各自想做什么。","ko-KR":"여행 시기, 날씨 조건, 목적지와 나와 동행인이 하고 싶은 일을 말합니다."},"scene":{"people":"王明、智敏；王明、素拉","place":"校园咖啡馆；旅行社团活动室","purpose":"商量济州岛晴雨计划并有依据地转述同行人愿望","imageStatus":"pending"},"targets":[{"ko":"날씨가 좋으면 제주도에 가고 싶어요.","zh":"说明条件与本人愿望"},{"ko":"같이 가는 친구는 지민 씨예요.","zh":"用现在动作定语说明同伴"},{"ko":"지민 씨는 사진을 찍고 싶어 해요.","zh":"有依据地说明第三人愿望"}],"finalOutput":{"zh-CN":"50—70秒、10—12句单人旅行发表，覆盖十项信息。","ko-KR":"열 가지 정보를 담은 50~70초, 10~12문장의 한 사람 여행 발표입니다."},"coach":{"zh-CN":"答对不计分的愿望场景诊断即完成；复述课末任务为自主展示。","ko-KR":"점수 없는 희망 장면 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"travel-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":11,"node":"travel-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"把地点、活动和准备连起来","ko-KR":"장소, 활동과 준비 연결하기"},"content":{"lead":{"zh-CN":"按看图认词、点读原形、跟读搭配、放进条件或愿望句的顺序学习；24词音频全部待制作。","ko-KR":"그림, 기본형, 결합, 조건이나 희망 문장 순서로 익힙니다. 24개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"여행","zh":"旅行","pos":"名词","collocation":"여행을 가다"},{"ko":"여행지","zh":"旅行地","pos":"名词","collocation":"좋아하는 여행지"},{"ko":"방학","zh":"假期","pos":"名词","collocation":"여름 방학"},{"ko":"바다","zh":"海","pos":"名词","collocation":"바다에서 수영하다"},{"ko":"해변","zh":"海滩、海边","pos":"名词","collocation":"해변을 걷다"},{"ko":"산","zh":"山","pos":"名词","collocation":"산을 걷다"},{"ko":"섬","zh":"岛","pos":"名词","collocation":"섬을 구경하다"},{"ko":"박물관","zh":"博物馆","pos":"名词","collocation":"박물관을 구경하다"},{"ko":"공항","zh":"机场","pos":"名词","collocation":"공항에 가다"},{"ko":"여권","zh":"护照","pos":"名词","collocation":"여권을 준비하다"},{"ko":"표","zh":"票","pos":"名词","collocation":"표를 사다"},{"ko":"숙소","zh":"住宿处","pos":"名词","collocation":"숙소를 예약하다"},{"ko":"지도","zh":"地图","pos":"名词","collocation":"지도를 준비하다"},{"ko":"사진","zh":"照片","pos":"名词","collocation":"사진을 찍다"},{"ko":"경치","zh":"风景","pos":"名词","collocation":"경치를 보다"},{"ko":"날씨","zh":"天气","pos":"名词","collocation":"날씨가 좋다"},{"ko":"계획","zh":"计划","pos":"名词","collocation":"여행 계획"},{"ko":"준비하다","zh":"准备","pos":"动词","collocation":"여권을 준비하다"},{"ko":"예약하다","zh":"预订","pos":"动词","collocation":"숙소를 예약하다"},{"ko":"구경하다","zh":"参观、游览","pos":"动词","collocation":"박물관을 구경하다"},{"ko":"수영하다","zh":"游泳","pos":"动词","collocation":"바다에서 수영하다"},{"ko":"찍다","zh":"拍、照","pos":"动词","collocation":"사진을 찍다"},{"ko":"걷다","zh":"走、步行","pos":"动词","collocation":"해변을 걷다"},{"ko":"좋아하다","zh":"喜欢","pos":"动词","collocation":"여행지를 좋아하다"}],"studyFlow":["看图认地点、物品和活动","点读原形","跟读自然搭配","放进条件或愿望句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；点读、图片快说和扩展搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"travel-grammar-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":20,"node":"travel-grammar-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"说条件、补充信息、区分谁想做","ko-KR":"조건과 정보를 말하고 희망 주체 구별하기"},"content":{"lead":{"zh-CN":"四个工具分别负责条件、现在动作定语、本人或对方愿望，以及有依据的第三人愿望。","ko-KR":"네 가지 도구로 조건, 현재 동작 관형형, 나와 상대의 희망, 근거가 있는 제삼자 희망을 익힙니다."},"grammarCards":[{"form":"A/V-(으)면","function":{"zh-CN":"说明天气、时间等条件和条件变化后的安排。","ko-KR":"날씨나 시간 조건과 조건이 달라진 뒤의 계획을 말합니다."},"rules":["非ㄹ收音接-으면","无收音与ㄹ收音接-면","ㄷ/ㅂ/ㅅ/ㅎ按后接环境变化","르在此不触发不规则","되다写되면"],"examples":[{"ko":"시간이 있으면 제주도에 가고 싶어요.","zh":"有时间的话，想去济州岛。","audioId":"chapter-15-grammar-01-example-01","audioStatus":"pending"},{"ko":"날씨가 좋으면 제주도에 가고 싶어요.","zh":"天气好就想去济州岛。","audioId":"chapter-15-grammar-01-example-02","audioStatus":"pending"},{"ko":"눈이 오면 다니엘 씨는 박물관을 구경하고 싶어 해요.","zh":"下雪的话，丹尼尔想参观博物馆。","audioId":"chapter-15-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"좋다有非ㄹ收音，应写좋으면；되다写되면，不写돼면。","ko-KR":"좋다는 좋으면, 되다는 되면으로 씁니다."},"comparison":{"zh-CN":"-아서/어서说明原因；-(으)면提出条件。","ko-KR":"-아서/어서는 이유, -(으)면은 조건을 나타냅니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-는 N","function":{"zh-CN":"用现在或经常发生的动作补充旅行地、日期或同行人信息。","ko-KR":"현재나 자주 하는 동작으로 여행지, 날짜나 동행인 정보를 보충합니다."},"rules":["一般动词词干接-는","ㄹ在ㄴ前脱落","ㄷ/ㅅ/르在辅音前保留","되다写되는","있다/없다写있는/없는"],"examples":[{"ko":"제가 좋아하는 여행지는 부산이에요.","zh":"我喜欢的旅行地是釜山。","audioId":"chapter-15-grammar-02-example-01","audioStatus":"pending"},{"ko":"우리가 가는 날에 비가 오면 무엇을 하고 싶어요?","zh":"我们去的那天下雨的话，想做什么？","audioId":"chapter-15-grammar-02-example-02","audioStatus":"pending"},{"ko":"같이 가는 친구는 다니엘 씨예요.","zh":"同行的朋友是丹尼尔。","audioId":"chapter-15-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"当前稳定喜好写좋아하는 여행지；定语与名词分写。","ko-KR":"현재의 뜻은 좋아하는 여행지로 띄어 씁니다."},"comparison":{"zh-CN":"예쁜 여행地用形容词；좋아하는 여행地用动词动作。","ko-KR":"예쁜 여행지는 형용사, 좋아하는 여행지는 동작을 나타냅니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-고 싶다","function":{"zh-CN":"表达本人愿望或直接询问对方愿望。","ko-KR":"자기 희망을 말하거나 상대의 희망을 직접 묻습니다."},"rules":["动词词干接-고 싶다","-고前不触发元音环境不规则","되다写되고 싶어요","本动词与싶어요分写","陈述以本人愿望为本课重点"],"examples":[{"ko":"제주도에서 바다를 보고 싶어요.","zh":"想在济州岛看海。","audioId":"chapter-15-grammar-03-example-01","audioStatus":"pending"},{"ko":"저는 바다에서 수영하고 싶어요. 지민 씨는요?","zh":"我想在海里游泳。智敏呢？","audioId":"chapter-15-grammar-03-example-02","audioStatus":"pending"},{"ko":"저는 해변을 걷고 싶어요.","zh":"我想沿海边走一走。","audioId":"chapter-15-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"必须写가고 싶어요，不写가 싶어요或가고싶어요。","ko-KR":"가고 싶어요로 쓰며 가 싶어요나 가고싶어요로 쓰지 않습니다."},"comparison":{"zh-CN":"갈 거예요偏未来计划；가고 싶어요强调当前愿望。","ko-KR":"갈 거예요는 계획, 가고 싶어요는 현재 희망입니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-고 싶어 하다","function":{"zh-CN":"有依据地转述第三人已经表达或共同确认的愿望。","ko-KR":"다른 사람이 말했거나 함께 정한 희망을 근거 있게 전합니다."},"rules":["动词词干接-고 싶어 하다","싶어与하다分写","-고前不触发元音环境不规则","되다写되고 싶어 해요","初级输出必须说明信息来源"],"examples":[{"ko":"제 친구는 제주도에서 사진을 찍고 싶어 해요.","zh":"我的朋友想在济州岛拍照。","audioId":"chapter-15-grammar-04-example-01","audioStatus":"pending"},{"ko":"저는 수영하고 싶어요. 지민 씨는 경치를 보고 사진을 찍고 싶어 해요.","zh":"我想游泳。智敏想看风景、拍照。","audioId":"chapter-15-grammar-04-example-02","audioStatus":"pending"},{"ko":"다니엘 씨는 경치를 보고 사진을 찍고 싶어 해요.","zh":"丹尼尔想看风景、拍照。","audioId":"chapter-15-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写찍고 싶어 해요，不写찍고 싶어해요；不得凭空猜测他人内心。","ko-KR":"찍고 싶어 해요로 띄어 쓰고 근거 없이 마음을 추측하지 않습니다."},"comparison":{"zh-CN":"本人说찍고 싶어요；有依据地描述智敏说찍고 싶어 해요。","ko-KR":"자기는 찍고 싶어요, 지민의 알려진 희망은 찍고 싶어 해요입니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"十二个目标空全部正确才完成；规则口述与扩展变形为自主练习。","ko-KR":"열두 칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"travel-plan-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":12,"node":"travel-plan-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让每句话真正回应上一句","ko-KR":"앞말에 맞게 여행 대화 이어 가기"},"content":{"lead":{"zh-CN":"从目的地推进到天气、活动和准备，并通过即时回指保持人物愿望和信息来源清楚。","ko-KR":"목적지에서 날씨, 활동과 준비로 이어 가며 사람별 희망과 근거를 분명히 합니다."},"substitutions":[["날씨가 좋으면 바다에 가고 싶어요.","비가 오면 박물관을 구경하고 싶어요.","시간이 있으면 섬을 구경하고 싶어요."],["제가 좋아하는 여행지","우리가 가는 날","친구가 찍는 사진","제가 사는 곳"],["저는 수영하고 싶어요.","무엇을 하고 싶어요?","지민 씨는 사진을 찍고 싶어 해요."]],"practice":{"quickResponse":"同伴随机给晴天、下雨或有时间，3秒内补条件结果；再按我、你、智敏选择愿望形式。","personalOutput":"用安全虚构信息说一个条件、一个V-는 N信息、本人愿望和一项有依据的第三人愿望。","required":false},"coach":{"zh-CN":"六个完整话轮顺序完全正确才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례의 순서만 필수이며 바꾸기와 개인 표현은 자율 연습입니다."},"nextNode":"travel-plan-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":14,"node":"travel-plan-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"先听本人说，再转述第三人愿望","ko-KR":"본인의 말을 들은 뒤 다른 사람의 희망 전하기"},"content":{"lead":{"zh-CN":"主场景中智敏亲口说明晴天与雨天愿望；第二场景中王明只转述这些已有依据的信息。","ko-KR":"주 장면에서 지민이 직접 희망을 말하고 두 번째 장면에서 왕밍이 그 근거 있는 내용만 전합니다."},"dialogueScenes":[{"title":{"zh-CN":"校园咖啡馆","ko-KR":"학교 카페"},"people":"王明／智敏","place":"济州岛地图和旅行计划本旁","purpose":"确认目的地、晴雨活动与准备分工","lines":[{"role":"지민","ko":"여름 방학에 어디로 여행을 가고 싶어요?","zh":"暑假想去哪里旅行？"},{"role":"왕밍","ko":"저는 제주도 여행을 생각하고 있어요.","zh":"我在考虑济州岛旅行。"},{"role":"왕밍","ko":"날씨가 좋으면 제주도에 가고 싶어요.","zh":"天气好就想去济州岛。"},{"role":"지민","ko":"제주도에서 무엇을 하고 싶어요?","zh":"想在济州岛做什么？"},{"role":"왕밍","ko":"저는 바다에서 수영하고 싶어요. 지민 씨는요?","zh":"我想在海里游泳。智敏呢？"},{"role":"지민","ko":"저는 바다를 보고 사진을 찍고 싶어요.","zh":"我想看海、拍照。"},{"role":"왕밍","ko":"우리가 가는 날에 비가 오면 무엇을 하고 싶어요?","zh":"我们去的那天下雨的话，想做什么？"},{"role":"지민","ko":"비가 오면 박물관을 구경하고 싶어요.","zh":"下雨的话，我想参观博物馆。"},{"role":"왕밍","ko":"좋아요. 저는 표를 사고 숙소를 예약할 거예요. 여권도 준비할 거예요.","zh":"好。我会买票、订住宿，也会准备护照。"},{"role":"지민","ko":"그럼 저는 지도를 준비할 거예요.","zh":"那我会准备地图。"}]},{"title":{"zh-CN":"旅行社团活动室","ko-KR":"여행 동아리 활동실"},"people":"王明／素拉","place":"社团活动室","purpose":"转述与智敏已经商量好的计划","lines":[{"role":"소라","ko":"지민 씨와 어디에 가요?","zh":"你和智敏去哪里？"},{"role":"왕밍","ko":"날씨가 좋으면 제주도에 갈 거예요.","zh":"天气好就去济州岛。"},{"role":"소라","ko":"두 사람은 제주도에서 무엇을 하고 싶어요?","zh":"你们两人在济州岛想做什么？"},{"role":"왕밍","ko":"저는 수영하고 싶어요. 지민 씨는 경치를 보고 사진을 찍고 싶어 해요.","zh":"我想游泳。智敏想看风景、拍照。"},{"role":"소라","ko":"비가 오면 지민 씨는 무엇을 하고 싶어 해요?","zh":"下雨的话，智敏想做什么？"},{"role":"왕밍","ko":"지민 씨는 박물관을 구경하고 싶어 해요.","zh":"智敏想参观博物馆。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换和试录为自主练习。","ko-KR":"사실 조합과 자연스러운 대답을 모두 맞혀야 하며 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-present"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":16,"node":"listen-and-present","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听清雨天愿望，再发表旅行计划","ko-KR":"비 오는 날 희망을 듣고 여행 계획 발표하기"},"content":{"lead":{"zh-CN":"两版听力真实制作并绑定后听清俊浩的雨天愿望，再提交50—70秒、10—12句单人发表。","ko-KR":"두 음원이 제작·연결된 뒤 준호의 비 오는 날 희망을 듣고 50~70초, 10~12문장 발표를 제출합니다."},"speakingFrame":["___ 방학에 여행을 가고 싶어요.","___면 ___에 가고 싶어요／갈 거예요.","제가 좋아하는 여행지는 ___예요.／같이 가는 친구는 ___ 씨예요.","저는 ___고 싶어요. 또 ___고 싶어요.","___ 씨는 ___고 싶어 해요.","___면 저는／___ 씨는 ___고 싶어요／싶어 해요.","저는 ___을/를 준비하고 ___을/를 예약할 거예요."],"requiredInformation":["旅行时间","条件","目的地","一个V-는 N信息","两项本人愿望","同行人身份","有依据的第三人愿望","条件变化后的备选活动","准备事项一","准备事项二"],"coach":{"zh-CN":"听力答对且开放口语达到提交门槛才完成；口语不产生正确性或分数。","ko-KR":"듣기 정답과 말하기 제출 조건이 모두 필요하며 말하기에는 정오나 점수가 없습니다."},"nextNode":"travel-plan-card"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":15,"node":"travel-plan-card","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读旅行计划卡，写给社团负责人","ko-KR":"여행 계획 카드를 읽고 담당자에게 쓰기"},"content":{"lead":{"zh-CN":"从独立的江陵旅行计划卡找条件、本人愿望、同行人愿望与准备，再以单一申请人身份写给固定的社团负责人。","ko-KR":"강릉 여행 계획에서 조건, 자기와 동행인의 희망 및 준비를 찾고 한 신청자가 동아리 담당자에게 씁니다."},"reading":"겨울 방학 여행 계획\n① 시간이 있으면 강릉에 가고 싶어요.\n② 제가 좋아하는 여행지는 강릉이에요.\n③ 저는 해변을 걷고 싶어요.\n④ 같이 가는 친구는 다니엘 씨예요.\n⑤ 다니엘 씨는 경치를 보고 사진을 찍고 싶어 해요.\n⑥ 눈이 오면 다니엘 씨는 박물관을 구경하고 싶어 해요.\n⑦ 저는 표를 사고 숙소를 예약할 거예요.","writing":{"audience":"固定类别受众：旅行社团负责人","sentences":"8—10","required":["旅行时间","条件","目的地","一个V-는 N信息","两项本人愿望","同行人身份","有依据的第三人愿望","备选活动","准备事项一","准备事项二"],"scaffold":"___에 여행을 가고 싶어요. → ___면 ___에 가고 싶어요. → 제가 좋아하는 여행지는 ___예요.／같이 가는 친구는 ___예요. → 저는 ___고 싶어요. → 또 ___고 싶어요. → ___ 씨는 ___고 싶어 해요. → ___면 ___고 싶어요／싶어 해요. → 저는 ___을/를 준비하고 ___을/를 예약할 거예요.","rubric":["信息完整","核心语法","愿望主体与依据","逻辑与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读三题全对，并提交8—10句、十项信息齐全的原创计划卡及来源和量规自查才完成。","ko-KR":"읽기 세 문항 정답과 8~10문장 계획 카드, 근거 및 점검이 모두 필요합니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能清楚发表旅行条件与愿望吗？","ko-KR":"여행 조건과 희망을 분명히 발표할 수 있나요?"},"content":{"lead":{"zh-CN":"综合多选检查形式与功能，再按真实表现回应五项Can-do并记录返回节点。","ko-KR":"복수 선택으로 형태와 기능을 확인하고 실제 수행에 따라 다섯 Can-do와 복습 노드를 기록합니다."},"reviewMap":[{"cause":"词汇","returnNode":"travel-words"},{"cause":"语法","returnNode":"travel-grammar-tools"},{"cause":"理解","returnNode":"travel-plan-talk／listen-and-present"},{"cause":"表达","returnNode":"listen-and-present"},{"cause":"读写","returnNode":"travel-plan-card"}],"coach":{"zh-CN":"综合多选正确，并完成五项自查与返回位置才完成；自主复习展示不计入强制条件。","ko-KR":"복수 선택 정답과 다섯 자기 점검 및 복습 위치 기록이 필요합니다."},"nextNode":"chapter-test:korean-level-one-15"}}
  ] $modules$::jsonb) loop
    insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
    values (chapter_uuid,item->>'code',(item->>'order')::integer,item->>'accent',item->'title',item->'nodeTitle')
    on conflict (chapter_id,module_code) do update set
      sort_order = excluded.sort_order, accent_role = excluded.accent_role, title = excluded.title,
      description = excluded.description, updated_at = now()
    returning id into module_uuid;
    insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
    values (module_uuid,item->>'node',item->>'type',1,(item->>'minutes')::integer,item->'nodeTitle',item->'content')
    on conflict (module_id,node_code) do update set
      node_type = excluded.node_type, sort_order = 1, estimated_minutes = excluded.estimated_minutes,
      title = excluded.title, content = excluded.content, updated_at = now();
  end loop;

  delete from public.digital_textbook_modules
  where chapter_id = chapter_uuid and module_code not in ('orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review');

  for item in select value from jsonb_array_elements($activities$
  [
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"智敏问王明“假期想做什么？”。哪一句最适合回答？","ko-KR":"지민이 왕밍에게 방학에 무엇을 하고 싶어요?라고 물었습니다. 가장 알맞은 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择直接表达说话人假期愿望的一句；本题不显示分数。","ko-KR":"말하는 사람의 방학 희망을 직접 나타내는 문장을 고르세요. 점수는 표시하지 않습니다."},"options":["제주도에 가고 싶어요.","이 옷을 입어 보세요.","서울역으로 가 주세요.","목이 많이 아파요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句直接回答本人假期想去济州岛。","ko-KR":"자기 방학 희망으로 제주도 여행을 직접 말합니다."},"feedback":[{"zh-CN":"先找表示“想做”的愿望功能。","ko-KR":"하고 싶은 일을 나타내는 희망 표현을 찾으세요."},{"zh-CN":"目标句回答假期愿望，不是服饰、交通请求或健康说明。","ko-KR":"옷, 교통이나 건강이 아니라 방학 희망을 답해야 합니다."},{"zh-CN":"应选择제주도에 가고 싶어요.。","ko-KR":"정답은 제주도에 가고 싶어요.입니다."}]}},
    {"node":"travel-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在숙소를 예약해요.中，숙소是什么意思？","ko-KR":"숙소를 예약해요.에서 숙소는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["住宿处","护照","地图","风景"],"config":{"shuffle":true,"example":"숙소를 예약해요.","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true},"audioPending":true},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"숙소是旅行中住宿的地方。","ko-KR":"숙소는 여행할 때 머무는 곳입니다."},"feedback":[{"zh-CN":"观察它和예약해요的搭配，判断是哪类旅行信息。","ko-KR":"예약해요와 함께 쓰이는 여행 정보를 생각하세요."},{"zh-CN":"常用搭配是숙소를 예약하다。","ko-KR":"숙소를 예약하다로 함께 씁니다."},{"zh-CN":"答案是“住宿处”；整句表示“预订住宿”。","ko-KR":"정답은 숙소이며 문장은 숙소를 예약한다는 뜻입니다."}]}},
    {"node":"travel-grammar-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成十二个目标空，检查条件、现在动作定语、本人愿望、第三人愿望与规范空格。","ko-KR":"조건, 현재 동작 관형형, 자기 희망, 제삼자 희망과 띄어쓰기를 확인하는 열두 칸을 완성하세요."},"instruction":{"zh-CN":"按每题指定的本课功能和人物关系写完整目标部分，保留拼写与规范空格。","ko-KR":"각 문항의 기능과 인물 관계에 맞는 목표 형태를 쓰고 철자와 띄어쓰기를 지키세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"먹다（本课条件形式）","placeholder":"답을 입력하세요"},{"id":"item-02","label":"가다（本课条件形式）","placeholder":"답을 입력하세요"},{"id":"item-03","label":"살다（本课条件形式；ㄹ词干）","placeholder":"답을 입력하세요"},{"id":"item-04","label":"하얗다（本课条件形式；规范ㅎ变化）","placeholder":"답을 입력하세요"},{"id":"item-05","label":"짓다（本课条件形式；ㅅ不规则词）","placeholder":"답을 입력하세요"},{"id":"item-06","label":"고르다（本课条件形式；判断르是否触发）","placeholder":"답을 입력하세요"},{"id":"item-07","label":"되다（本课条件形式；判断是否缩约）","placeholder":"답을 입력하세요"},{"id":"item-08","label":"살다（修饰现在居住地点）","placeholder":"답을 입력하세요"},{"id":"item-09","label":"듣다（修饰现在听的音乐）","placeholder":"답을 입력하세요"},{"id":"item-10","label":"되다（修饰成为或定为的日子）","placeholder":"답을 입력하세요"},{"id":"item-11","label":"가다（说话人本人愿望；礼貌体）","placeholder":"답을 입력하세요"},{"id":"item-12","label":"친구가 직접 말함：찍다（同龄第三人愿望；礼貌体）","placeholder":"답을 입력하세요"}]},"answer":{"kind":"text_array","value":["먹으면","가면","살면","하야면","지으면","고르면","되면","사는","듣는","되는","가고 싶어요","찍고 싶어 해요"]},"explanation":{"correct":{"zh-CN":"十二项功能、词形、主体和规范空格全部正确。","ko-KR":"열두 형태의 기능, 활용, 주체와 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先分为条件、现在动作定语、本人愿望和第三人愿望。","ko-KR":"조건, 현재 관형형, 자기 희망과 제삼자 희망으로 나누세요."},{"zh-CN":"条件题检查后接环境；定语题看ㄹ与ㄴ；愿望题检查人物视角和空格。","ko-KR":"조건의 뒤 환경, 관형형의 ㄹ과 ㄴ, 희망의 주체와 띄어쓰기를 확인하세요."},{"zh-CN":"依次为먹으면、가면、살면、하야면、지으면、고르면、되면、사는、듣는、되는、가고 싶어요、찍고 싶어 해요。","ko-KR":"정답은 먹으면부터 찍고 싶어 해요까지 제시된 열두 형태입니다."}]}},
    {"node":"travel-plan-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段语义连贯的旅行商量。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 여행 대화로 배열하세요."},"instruction":{"zh-CN":"根据问题、回答和即时回指自行判断；卡片不标角色、步骤或位置。","ko-KR":"질문, 대답과 앞말 가리킴을 바탕으로 판단하세요. 역할이나 단계는 표시하지 않습니다."},"options":["비가 오면 제주도 박물관을 구경하고 싶어요. 같이 가는 민지 씨는 그 박물관에서 사진을 찍고 싶어 해요.","방학에 어디로 여행을 가고 싶어요?","제주도에 있어요. 제가 방금 말한 그 박물관의 표를 준비할 거예요.","제주도에 가고 싶어요. 날씨가 좋으면 바다에서 수영하고 싶어요.","방금 답에서 말한 제주도에서 비가 오면 무엇을 하고 싶어요?","방금 말한 민지 씨가 사진을 찍는 박물관은 어디에 있어요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[1,3,4,0,5,2]},"explanation":{"correct":{"zh-CN":"问答与三个即时回指形成唯一连续链。","ko-KR":"질문과 대답, 세 가지 즉시 가리킴이 하나의 흐름을 만듭니다."},"feedback":[{"zh-CN":"检查每个问句是否紧邻直接回答，并找没有前文就不能成立的回指。","ko-KR":"각 질문의 직접 답과 앞말이 필요한 가리킴을 찾으세요."},{"zh-CN":"先定位目的地问答，再追踪刚才回答中的济州岛、那座博物馆和刚说的敏智。","ko-KR":"목적지 답, 제주도, 그 박물관과 방금 말한 민지를 따라가세요."},{"zh-CN":"系统依次检查目的地、雨天活动、敏智拍照地点和准备的相邻衔接。","ko-KR":"목적지, 비 오는 날 활동, 민지의 사진 장소와 준비의 연결을 확인하세요."}]}},
    {"node":"travel-plan-talk","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景中，天气好时王明想做什么，雨天智敏想做什么？","ko-KR":"주 장면에서 날씨가 좋을 때 왕밍은 무엇을 하고 싶고 비가 올 때 지민은 무엇을 하고 싶어요?"},"instruction":{"zh-CN":"选择人物、条件和活动都与台词一致的一组。","ko-KR":"사람, 조건과 활동이 모두 대사와 같은 조합을 고르세요."},"options":["바다에서 수영하다／박물관을 구경하다","사진을 찍다／숙소를 예약하다","박물관을 구경하다／바다에서 수영하다","지도를 준비하다／사진을 찍다"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"第5轮是王明的游泳愿望，第7—8轮是智敏的雨天博物馆愿望。","ko-KR":"5턴은 왕밍의 수영, 7~8턴은 지민의 비 오는 날 박물관 희망입니다."},"feedback":[{"zh-CN":"分别找王明说저는的活动和智敏在雨天条件后的回答。","ko-KR":"왕밍의 저는과 지민의 비 오는 날 대답을 찾으세요."},{"zh-CN":"不要把拍照、地图或住宿准备当成题目要求的两项活动。","ko-KR":"사진, 지도나 숙소 준비를 섞지 마세요."},{"zh-CN":"正确组合是바다에서 수영하다／박물관을 구경하다。","ko-KR":"정답은 바다에서 수영하다／박물관을 구경하다입니다."}]}},
    {"node":"travel-plan-talk","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"朋友问제주도에서 무엇을 하고 싶어요?。哪一句最自然地以本人立场回答？","ko-KR":"친구가 제주도에서 무엇을 하고 싶어요?라고 물었습니다. 자기 희망을 가장 자연스럽게 말하는 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择直接回答本人愿望、保持礼貌体且不改变话题的一句。","ko-KR":"자기 희망을 직접 답하고 해요체를 유지하며 화제를 바꾸지 않는 문장을 고르세요."},"options":["바다에서 수영하고 싶어요.","친구는 수영하고 싶어 해요.","서울역으로 가 주세요.","이 옷을 입어 보세요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句直接说本人在济州岛想做的旅行活动。","ko-KR":"제주도에서 자기가 하고 싶은 일을 직접 답합니다."},"feedback":[{"zh-CN":"问题在问“你想做什么”，先找说话人本人的愿望。","ko-KR":"자기가 하고 싶은 일을 말하는 답을 찾으세요."},{"zh-CN":"不要改成第三人愿望、交通请求或服饰建议。","ko-KR":"제삼자 희망, 교통 요청이나 옷 제안으로 바꾸지 마세요."},{"zh-CN":"应选择바다에서 수영하고 싶어요.。","ko-KR":"정답은 바다에서 수영하고 싶어요.입니다."}]}},
    {"node":"listen-and-present","sort":1,"key":"listening-rain-plan","type":"listening","prompt":{"zh-CN":"听正常速或慢速音频，判断下雨时俊浩想做什么。","ko-KR":"보통 속도나 느린 속도 음성을 듣고 비가 오면 준호 씨가 무엇을 하고 싶어 하는지 고르세요."},"instruction":{"zh-CN":"正常速最多两遍、慢速最多一遍；只依据音频中的人物与条件作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번까지 듣고 음성의 인물과 조건에 답하세요."},"options":["박물관을 구경하다","해변을 걷다","산을 걷다","숙소를 예약하다"],"config":{"shuffle":true,"audioStatus":"pending","normalPlays":2,"slowPlays":1,"tracks":[{"id":"track-01","label":"正常语速","audioId":"chapter-15-listening-rain-plan-normal","status":"pending"},{"id":"track-02","label":"慢速","audioId":"chapter-15-listening-rain-plan-slow","status":"pending"}]},"answer":{"kind":"index","value":0},"transcript":"수진: 저는 겨울 방학에 부산에 가고 싶어요. 날씨가 좋으면 해변을 걷고 싶어요. 준호: 저는 경치를 보고 사진을 찍고 싶어요. 하지만 비가 오면 박물관을 구경하고 싶어요. 수진: 좋아요. 저는 표를 사고 숙소를 예약할 거예요.","audioObjectKey":"korean-level-one/chapter-15/listening/chapter-15-listening-rain-plan-normal.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是参观博物馆；俊浩亲口说明了雨天愿望。","ko-KR":"준호가 비가 오면 박물관을 구경하고 싶다고 직접 말합니다."},"feedback":[{"zh-CN":"再听含비가 오면的句子，先确认随后说话的人物。","ko-KR":"비가 오면 뒤의 말과 말하는 사람을 확인하세요."},{"zh-CN":"海边散步与预订住宿属于秀珍的不同信息。","ko-KR":"해변 걷기와 숙소 예약은 수진의 다른 정보입니다."},{"zh-CN":"答案是박물관을 구경하다。","ko-KR":"정답은 박물관을 구경하다입니다."}],"privateListening":{"normalAudioId":"chapter-15-listening-rain-plan-normal","normalAudioObjectKey":"korean-level-one/chapter-15/listening/chapter-15-listening-rain-plan-normal.mp3","normalScript":"수진: 저는 겨울 방학에 부산에 가고 싶어요. 날씨가 좋으면 해변을 걷고 싶어요. / 준호: 저는 경치를 보고 사진을 찍고 싶어요. 하지만 비가 오면 박물관을 구경하고 싶어요. / 수진: 좋아요. 저는 표를 사고 숙소를 예약할 거예요.","slowAudioId":"chapter-15-listening-rain-plan-slow","slowAudioObjectKey":"korean-level-one/chapter-15/listening/chapter-15-listening-rain-plan-slow.mp3","slowScript":"수진: 저는 겨울 방학에 부산에 가고 싶어요. / 날씨가 좋으면 해변을 걷고 싶어요. / 준호: 저는 경치를 보고 사진을 찍고 싶어요. / 하지만 비가 오면 박물관을 구경하고 싶어요. / 수진: 좋아요. / 저는 표를 사고 숙소를 예약할 거예요.","pauseMarks":"수진: 저는 겨울 방학에 부산에 가고 싶어요. ⏸ 날씨가 좋으면 해변을 걷고 싶어요. ⏸ 준호: 저는 경치를 보고 사진을 찍고 싶어요. ⏸ 하지만 비가 오면 박물관을 구경하고 싶어요. ⏸ 수진: 좋아요. ⏸ 저는 표를 사고 숙소를 예약할 거예요.","speaker":"F03／수진；M02／준호","distractorReasons":["海边散步是秀珍在天气好时的愿望。","原文没有登山。","预订住宿是秀珍的准备，不是俊浩的愿望。"]}}},
    {"node":"listen-and-present","sort":2,"key":"speaking-travel-plan","type":"speaking","prompt":{"zh-CN":"完成50—70秒、10—12句的单人理想旅行发表。","ko-KR":"50~70초 동안 10~12문장으로 혼자 이상적인 여행 계획을 발표하세요."},"instruction":{"zh-CN":"按十项检查框加入旅行时间、条件、目的地、现在动作定语信息、两项本人愿望、同行人身份、有依据的第三人愿望、备选活动和两项准备；全程只有一个发表者。","ko-KR":"열 항목에 여행 시기, 조건, 목적지, 현재 관형형 정보, 자기 희망 두 가지, 동행인, 근거 있는 제삼자 희망, 다른 조건의 활동과 준비 두 가지를 넣고 한 명이 발표하세요."},"options":[],"config":{"minimumSeconds":50,"maximumSeconds":70,"minimumTurns":10,"maximumTurns":12,"rolesRequired":1,"requiredCriteria":10,"criteria":["旅行时间","条件","目的地","一个V-는 N信息","两项本人愿望","同行人身份","有依据的第三人愿望及来源确认","条件变化后的备选活动","准备事项一","准备事项二"],"sourceConfirmation":["事先询问","共同确认"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存达到提交条件的原创录音；不产生正确性或分数。","ko-KR":"제출 조건을 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对十项信息、句数、时长和第三人愿望来源。","ko-KR":"열 정보, 문장 수, 시간과 제삼자 희망 근거를 확인하세요."},{"zh-CN":"逐句圈出저는和第三人姓名，再检查两种愿望形式。","ko-KR":"저는과 제삼자 이름을 표시하고 두 희망 표현을 확인하세요."},{"zh-CN":"按句框补齐缺项后重录；开放发表没有唯一文本。","ko-KR":"빠진 내용을 보완해 다시 녹음하세요."}]}},
    {"node":"travel-plan-card","sort":1,"key":"reading-travel-card","type":"single_choice","prompt":{"zh-CN":"阅读丽娜提交的冬假旅行计划卡，完成三道事实题。","ko-KR":"리나가 제출한 겨울 방학 여행 계획 카드를 읽고 사실 확인 세 문항에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，必须从公开计划卡原句直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 계획 카드 문장에서 직접 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"겨울 방학 여행 계획 / ① 시간이 있으면 강릉에 가고 싶어요. / ② 제가 좋아하는 여행지는 강릉이에요. / ③ 저는 해변을 걷고 싶어요. / ④ 같이 가는 친구는 다니엘 씨예요. / ⑤ 다니엘 씨는 경치를 보고 사진을 찍고 싶어 해요. / ⑥ 눈이 오면 다니엘 씨는 박물관을 구경하고 싶어 해요. / ⑦ 저는 표를 사고 숙소를 예약할 거예요.","items":[{"id":"q1","question":"리나는 시간이 있으면 어디에 가고 싶어요?","options":["강릉","부산","박물관","공항"]},{"id":"q2","question":"리나는 해변에서 무엇을 하고 싶어요?","options":["사진을 찍다","걷다","숙소를 예약하다","표를 사다"]},{"id":"q3","question":"눈이 오면 다니엘 씨는 무엇을 하고 싶어 해요?","options":["경치를 보다","수영하다","박물관을 구경하다","지도를 준비하다"]}]},"answer":{"kind":"index_array","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"三题答案依次是江陵、步行、参观博物馆。","ko-KR":"정답은 강릉, 걷다, 박물관을 구경하다입니다."},"feedback":[{"zh-CN":"圈出第①句目的地、第③句丽娜活动和第⑥句丹尼尔下雪天活动。","ko-KR":"①의 장소, ③의 리나 활동과 ⑥의 다니엘 활동을 찾으세요."},{"zh-CN":"不要把其他人物、条件、准备事项或正文外地点混入。","ko-KR":"다른 사람, 조건, 준비나 글 밖 장소를 섞지 마세요."},{"zh-CN":"依次是강릉、걷다、박물관을 구경하다。","ko-KR":"세 답은 강릉, 걷다, 박물관을 구경하다입니다."}]}},
    {"node":"travel-plan-card","sort":2,"key":"write-travel-card","type":"writing","prompt":{"zh-CN":"以申请人身份，给旅行社团负责人写一张8—10句原创旅行计划卡。","ko-KR":"신청자로서 여행 동아리 담당자에게 8~10문장의 새로운 여행 계획 카드를 쓰세요."},"instruction":{"zh-CN":"保持单一作者与固定类别受众，写齐十项信息，确认同行人愿望已询问或共同确认，并完成五维量规自查。","ko-KR":"한 작성자와 동아리 담당자 독자를 유지하고 열 정보를 쓰며 동행인 희망의 근거와 다섯 기준을 확인하세요."},"options":[],"config":{"minSentences":8,"maxSentences":10,"minimumHangulCharacters":80,"minimumInformationKinds":10,"informationChecklist":["旅行时间","条件","目的地","一个V-는 N信息","两项本人愿望","同行人身份","有依据的第三人愿望","条件变化后的备选活动","准备事项一","准备事项二"],"requiredPhraseGroups":[["면 "],["는 여행지","는 날","는 친구","사는 곳"],["고 싶어요"],["고 싶어 해요"],["준비","예약","표를 사"]],"minimumPhraseGroups":5,"sourceConfirmation":["事先询问","共同确认"],"requireCompletionChecklist":true,"scaffold":"___에 여행을 가고 싶어요. → ___면 ___에 가고 싶어요. → 제가 좋아하는 여행지는 ___예요.／같이 가는 친구는 ___예요. → 저는 ___고 싶어요. → 또 ___고 싶어요. → ___ 씨는 ___고 싶어 해요. → ___면 ___고 싶어요／싶어 해요. → 저는 ___을/를 준비하고 ___을/를 예약할 거예요.","rubric":["信息完整","核心语法","愿望主体与依据","逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按五维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、十项信息、来源确认和量规自查的原创计划卡；不产生正确性或分数。","ko-KR":"문장 수, 열 정보, 근거와 점검을 갖춘 계획 카드를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对作者与受众，再数十项信息并确认第三人愿望来源。","ko-KR":"작성자와 독자, 열 정보 및 제삼자 희망 근거를 확인하세요."},{"zh-CN":"检查四项核心语法，特别核对愿望主体与规范空格。","ko-KR":"네 문법, 희망 주체와 띄어쓰기를 확인하세요."},{"zh-CN":"按支架补齐缺项，删除其他角色回应，但不要复制示范。","ko-KR":"다른 역할의 답을 지우고 빠진 내용을 보완하세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的表达。","ko-KR":"형태가 바르고 괄호의 기능을 알맞게 나타내는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成，按本课规范空格判断。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 않으며 이 과의 띄어쓰기로 판단하세요."},"options":["날씨가 좋으면 바다에 가요.（条件）","제가 좋아하는 여행지는 제주도예요.（现在动作定语）","저는 수영하고 싶어요.（本人愿望）","지민 씨는 사진을 찍고 싶어해요.（第三人愿望）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三项正确；第4项应写찍고 싶어 해요。","ko-KR":"앞의 세 표현이 맞고 4번은 찍고 싶어 해요로 띄어 씁니다."},"feedback":[{"zh-CN":"分别检查条件词尾、定语空格和两种愿望表达的空格。","ko-KR":"조건, 관형형과 두 희망 표현의 띄어쓰기를 확인하세요."},{"zh-CN":"只有一项把短语后的싶어 하다错误连写。","ko-KR":"한 항목만 싶어 하다를 잘못 붙여 썼습니다."},{"zh-CN":"正确项是第1、2、3项；第4项改为지민 씨는 사진을 찍고 싶어 해요.。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据刚才的实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"방금 한 실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个非none返回节点，全部能完成时只选none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 none이 아닌 노드를, 모두 가능하면 none만 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"condition","label":"我能按天气或时间条件说明旅行计划／날씨나 시간 조건에 따라 여행 계획을 말할 수 있어요"},{"id":"modifier","label":"我能用V-는 N说明旅行信息／V-는 N으로 여행 정보를 설명할 수 있어요"},{"id":"self-wish","label":"我能表达本人愿望并询问对方／내 희망을 말하고 상대의 희망을 물을 수 있어요"},{"id":"third-wish","label":"我能说明有依据的第三人愿望／근거가 있는 다른 사람의 희망을 말할 수 있어요"},{"id":"travel-task","label":"我能完成50—70秒、10—12句旅行发表／50~70초, 10~12문장으로 발표할 수 있어요"}],"returnNodes":[{"value":"travel-words","label":"词汇"},{"value":"travel-grammar-tools","label":"语法"},{"value":"travel-plan-talk","label":"对话理解"},{"value":"listen-and-present","label":"听说"},{"value":"travel-plan-card","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想旅行词汇、四项语法、晴雨信息、愿望主体和完整发表。","ko-KR":"여행 어휘, 네 문법, 날씨 정보, 희망 주체와 발표를 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 15 node %', item->>'node'; end if;
    insert into public.digital_textbook_activities (
      node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config,max_attempts,counts_toward_completion
    ) values (
      node_uuid,item->>'key',item->>'type',(item->>'sort')::integer,item->'prompt',item->'instruction',item->'options',item->'config',3,true
    )
    on conflict (node_id,activity_key) do update set
      activity_type = excluded.activity_type, sort_order = excluded.sort_order, prompt = excluded.prompt,
      instruction = excluded.instruction, options = excluded.options, public_config = excluded.public_config,
      max_attempts = 3, counts_toward_completion = true, updated_at = now()
    returning id into activity_uuid;
    insert into public.digital_textbook_activity_secrets (
      activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status
    ) values (
      activity_uuid,item->'answer',item->'explanation',item->>'transcript',item->>'audioObjectKey',coalesce(item->>'audioStatus','pending')
    )
    on conflict (activity_id) do update set
      answer_key = excluded.answer_key, explanation = excluded.explanation, transcript_ko = excluded.transcript_ko,
      audio_object_key = excluded.audio_object_key, audio_status = excluded.audio_status, updated_at = now();
  end loop;

  delete from public.digital_textbook_activities activity
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where activity.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-rain-plan',
      'speaking-travel-plan','reading-travel-card','write-travel-card',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where media.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-15-image-01","purpose":"章节情境主图","file":"chapter-15-01-scene.png","path":"../附件/韩国语1级/第15课/第15课-01-章节情境主图.png","alt":"校园咖啡馆里两名成年同龄学生看地图和晴雨图标商量旅行。","width":1600,"height":900},
    {"node":"travel-words","key":"chapter-15-image-02","purpose":"核心词汇旅行地点与活动卡","file":"chapter-15-02-vocabulary.png","path":"../附件/韩国语1级/第15课/第15课-02-核心词汇卡-旅行地点与活动.png","alt":"旅行地点、物品与活动情境卡。","width":1200,"height":900},
    {"node":"travel-grammar-tools","key":"chapter-15-image-03","purpose":"条件定语与愿望语法总图","file":"chapter-15-03-grammar-overview.png","path":"../附件/韩国语1级/第15课/第15课-03-语法总图-条件定语与愿望.png","alt":"条件、现在动作定语、本人愿望和有依据第三人愿望四条结构轨道。","width":1600,"height":900},
    {"node":"travel-grammar-tools","key":"chapter-15-image-04","purpose":"条件形式结构图","file":"chapter-15-03a-conditional.png","path":"../附件/韩国语1级/第15课/第15课-03A-语法结构图-으면.png","alt":"条件形式按收音与不规则变化分流。","width":1200,"height":900},
    {"node":"travel-grammar-tools","key":"chapter-15-image-05","purpose":"现在动作定语结构图","file":"chapter-15-03b-present-modifier.png","path":"../附件/韩国语1级/第15课/第15课-03B-语法结构图-V는N.png","alt":"动词现在时定语及ㄹ在ㄴ前脱落。","width":1200,"height":900},
    {"node":"travel-grammar-tools","key":"chapter-15-image-06","purpose":"本人愿望结构图","file":"chapter-15-03c-self-wish.png","path":"../附件/韩国语1级/第15课/第15课-03C-语法结构图-고싶다.png","alt":"本人愿望和对方问句的视角轨道。","width":1200,"height":900},
    {"node":"travel-grammar-tools","key":"chapter-15-image-07","purpose":"第三人愿望结构图","file":"chapter-15-03d-third-person-wish.png","path":"../附件/韩国语1级/第15课/第15课-03D-语法结构图-고싶어하다.png","alt":"有依据的第三人愿望与信息来源轨道。","width":1200,"height":900},
    {"node":"travel-plan-builder","key":"chapter-15-image-08","purpose":"旅行完整话轮卡","file":"chapter-15-04-pattern-blocks.png","path":"../附件/韩国语1级/第15课/第15课-04-句型旅行话轮卡.png","alt":"六张无角色、步骤、箭头或顺序标记的完整旅行话轮卡。","width":1200,"height":900},
    {"node":"travel-plan-talk","key":"chapter-15-image-09","purpose":"实战对话双场景图","file":"chapter-15-05-dialogue.png","path":"../附件/韩国语1级/第15课/第15课-05-实战对话场景.png","alt":"咖啡馆直接表达与社团活动室第三人转述两个独立场景。","width":1600,"height":900},
    {"node":"listen-and-present","key":"chapter-15-image-10","purpose":"晴雨活动听力信息图","file":"chapter-15-06-listening.png","path":"../附件/韩国语1级/第15课/第15课-06-听力信息图-晴雨活动.png","alt":"海边散步、博物馆参观、登山和住宿四种无文字活动图卡。","width":1200,"height":900},
    {"node":"travel-plan-card","key":"chapter-15-image-11","purpose":"旅行计划卡版式","file":"chapter-15-07-travel-plan-card.png","path":"../附件/韩国语1级/第15课/第15课-07-旅行计划卡.png","alt":"旅行社团计划卡版式和条件、地点、活动、同行人与准备图标。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-15-image-12","purpose":"最终旅行发表任务图","file":"chapter-15-08-final-task.png","path":"../附件/韩国语1级/第15课/第15课-08-最终任务图.png","alt":"旅行发表十项信息的检查图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-15/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'travel-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"여행","collocation":"여행을 가다"},{"word":"여행지","collocation":"좋아하는 여행지"},{"word":"방학","collocation":"여름 방학"},{"word":"바다","collocation":"바다에서 수영하다"},{"word":"해변","collocation":"해변을 걷다"},{"word":"산","collocation":"산을 걷다"},{"word":"섬","collocation":"섬을 구경하다"},{"word":"박물관","collocation":"박물관을 구경하다"},{"word":"공항","collocation":"공항에 가다"},{"word":"여권","collocation":"여권을 준비하다"},{"word":"표","collocation":"표를 사다"},{"word":"숙소","collocation":"숙소를 예약하다"},{"word":"지도","collocation":"지도를 준비하다"},{"word":"사진","collocation":"사진을 찍다"},{"word":"경치","collocation":"경치를 보다"},{"word":"날씨","collocation":"날씨가 좋다"},{"word":"계획","collocation":"여행 계획"},{"word":"준비하다","collocation":"여권을 준비하다"},{"word":"예약하다","collocation":"숙소를 예약하다"},{"word":"구경하다","collocation":"박물관을 구경하다"},{"word":"수영하다","collocation":"바다에서 수영하다"},{"word":"찍다","collocation":"사진을 찍다"},{"word":"걷다","collocation":"해변을 걷다"},{"word":"좋아하다","collocation":"여행지를 좋아하다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-15-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-15/audio/vocabulary/chapter-15-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-15-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-15-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-15/audio/vocabulary/chapter-15-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-15-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'travel-grammar-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-15/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-15-grammar-01-example-01","script":"시간이 있으면 제주도에 가고 싶어요."},{"id":"chapter-15-grammar-01-example-02","script":"날씨가 좋으면 제주도에 가고 싶어요."},{"id":"chapter-15-grammar-01-example-03","script":"눈이 오면 다니엘 씨는 박물관을 구경하고 싶어 해요."},
    {"id":"chapter-15-grammar-02-example-01","script":"제가 좋아하는 여행지는 부산이에요."},{"id":"chapter-15-grammar-02-example-02","script":"우리가 가는 날에 비가 오면 무엇을 하고 싶어요?"},{"id":"chapter-15-grammar-02-example-03","script":"같이 가는 친구는 다니엘 씨예요."},
    {"id":"chapter-15-grammar-03-example-01","script":"제주도에서 바다를 보고 싶어요."},{"id":"chapter-15-grammar-03-example-02","script":"저는 바다에서 수영하고 싶어요. 지민 씨는요?"},{"id":"chapter-15-grammar-03-example-03","script":"저는 해변을 걷고 싶어요."},
    {"id":"chapter-15-grammar-04-example-01","script":"제 친구는 제주도에서 사진을 찍고 싶어 해요."},{"id":"chapter-15-grammar-04-example-02","script":"저는 수영하고 싶어요. 지민 씨는 경치를 보고 사진을 찍고 싶어 해요."},{"id":"chapter-15-grammar-04-example-03","script":"다니엘 씨는 경치를 보고 사진을 찍고 싶어 해요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'travel-plan-talk';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-15/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-15-dialogue-main-line-01","purpose":"主对话逐句","script":"여름 방학에 어디로 여행을 가고 싶어요?","speaker":"F01／지민"},{"id":"chapter-15-dialogue-main-line-02","purpose":"主对话逐句","script":"저는 제주도 여행을 생각하고 있어요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-main-line-03","purpose":"主对话逐句","script":"날씨가 좋으면 제주도에 가고 싶어요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-main-line-04","purpose":"主对话逐句","script":"제주도에서 무엇을 하고 싶어요?","speaker":"F01／지민"},{"id":"chapter-15-dialogue-main-line-05","purpose":"主对话逐句","script":"저는 바다에서 수영하고 싶어요. 지민 씨는요?","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-main-line-06","purpose":"主对话逐句","script":"저는 바다를 보고 사진을 찍고 싶어요.","speaker":"F01／지민"},{"id":"chapter-15-dialogue-main-line-07","purpose":"主对话逐句","script":"우리가 가는 날에 비가 오면 무엇을 하고 싶어요?","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-main-line-08","purpose":"主对话逐句","script":"비가 오면 박물관을 구경하고 싶어요.","speaker":"F01／지민"},{"id":"chapter-15-dialogue-main-line-09","purpose":"主对话逐句","script":"좋아요. 저는 표를 사고 숙소를 예약할 거예요. 여권도 준비할 거예요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-main-line-10","purpose":"主对话逐句","script":"그럼 저는 지도를 준비할 거예요.","speaker":"F01／지민"},{"id":"chapter-15-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-15-dialogue-alt-line-01","purpose":"第二对话逐句","script":"지민 씨와 어디에 가요?","speaker":"F02／소라"},{"id":"chapter-15-dialogue-alt-line-02","purpose":"第二对话逐句","script":"날씨가 좋으면 제주도에 갈 거예요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-alt-line-03","purpose":"第二对话逐句","script":"두 사람은 제주도에서 무엇을 하고 싶어요?","speaker":"F02／소라"},{"id":"chapter-15-dialogue-alt-line-04","purpose":"第二对话逐句","script":"저는 수영하고 싶어요. 지민 씨는 경치를 보고 사진을 찍고 싶어 해요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-alt-line-05","purpose":"第二对话逐句","script":"비가 오면 지민 씨는 무엇을 하고 싶어 해요?","speaker":"F02／소라"},{"id":"chapter-15-dialogue-alt-line-06","purpose":"第二对话逐句","script":"지민 씨는 박물관을 구경하고 싶어 해요.","speaker":"M01／왕밍"},{"id":"chapter-15-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／M01"}
  ] $dialogue$::jsonb);

  select node.id, activity.id into node_uuid, activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_activities activity on activity.node_id = node.id
  where module.chapter_id = chapter_uuid and activity.activity_key = 'listening-rain-plan';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-15-listening-rain-plan-normal','audio','私有听力正常语速','korean-level-one/chapter-15/listening/chapter-15-listening-rain-plan-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F03／수진；M02／준호","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-15-listening-rain-plan-slow','audio','私有听力慢速','korean-level-one/chapter-15/listening/chapter-15-listening-rain-plan-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F03／수진；M02／준호","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_fifteen$;

commit;
