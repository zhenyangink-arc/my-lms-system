begin;

-- Converted from the read-only UPLY BOOK chapter-sixteen master.
-- source_sha256: 64d99b045ba9aadaba7426ca7af901758cc812e0b6d9c7cc4ae046c4665d515f
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master as course-overview values pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_sixteen$
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
  if version_uuid is null then raise exception 'Cannot convert chapter 16: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 16: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug = 'korean-level-one-16' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id = lesson_uuid and chapter_number = 16 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000016'::uuid,lesson_uuid,
      'korean-level-one-16','korean-level-one',16,
      '第 16 章测试：能来我家吗？','제16과 평가: 우리 집에 올 수 있어요?',
      '检查邀请与准备词汇，能力、承诺、移动目的和同时动作，以及邀请对话、听力、阅读和双角色交流组织。',
      12,60,
      '{"recognition":"邀请信息、物品与准备动作","structure":"能力、承诺、移动目的与同时动作","reading":"邀请对话、听力与消息理解","assembly":"双角色邀请与分工交流组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid, slug = 'korean-level-one-16', course_key = 'korean-level-one', chapter_number = 16,
      title = '第 16 章测试：能来我家吗？', korean_title = '제16과 평가: 우리 집에 올 수 있어요?',
      description = '检查邀请与准备词汇，能力、承诺、移动目的和同时动作，以及邀请对话、听力、阅读和双角色交流组织。',
      duration_minutes = 12, passing_score = 60,
      skills = '{"recognition":"邀请信息、物品与准备动作","structure":"能力、承诺、移动目的与同时动作","reading":"邀请对话、听力与消息理解","assembly":"双角色邀请与分工交流组织"}'::jsonb,
      version = 1, status = 'draft', student_app_id = '10000000-0000-4000-8000-000000000001'::uuid, updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id = test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-16-01','在“제가 미리 연락할게요.”中，“미리”是什么意思？','["提前","一起","慢慢地","下次"]',0,'母本词汇表中미리表示在预定时间以前先做。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-16-02','“오다”怎样变成本课的能力疑问形式？','["올 수 있어요?","오을 수 있어요?","올수 있어요?","오러 가요?"]',0,'无收音词干接-ㄹ 수 있다，并在依存名词수前后分写。','structure',2,'single_choice',10,'foundation','["能力","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-16-03','“돕다”怎样变成“能帮忙”？','["도울 수 있어요","돕을 수 있어요","도와 수 있어요","도울수 있어요"]',0,'돕다在元音开始的连接部分前发生ㅂ→우变化，并保留标准空格。','structure',3,'single_choice',10,'foundation','["能力","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-16-04','“듣다”怎样变成第一人称当场承诺“我会听”？','["들을게요","듣을게요","들게요","들을 거예요"]',0,'듣다发生ㄷ→ㄹ变化后接-을게요。','structure',4,'single_choice',10,'foundation','["承诺","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-16-05','哪一句正确表达“去买蛋糕”这一移动目的？','["케이크를 사러 가요.","케이크를 사러 준비해요.","케이크를 사면서 가요.","케이크를 살게 가요."]',0,'사다接-러，后项使用移动动词가다。','structure',5,'single_choice',10,'foundation','["移动目的","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-16-06','哪一句正确表达同一主体“边听音乐边做饭”？','["음악을 들으면서 요리해요.","음악을 들으러 요리해요.","음악을 듣면서 요리해요.","음악을 들을게요 요리해요."]',0,'듣다发生ㄷ→ㄹ变化后接-으면서，连接同一主体的同时动作。','structure',6,'single_choice',10,'foundation','["同时动作","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-16-07','主场景几点开始，民秀承担哪两样物品？','["下午五点／蛋糕和饮料","下午四点半／食物和礼物","下午五点／清扫和食物","下午三点／蛋糕和水果"]',0,'主对话第1轮明确五点开始，第4—6、9轮明确民秀负责蛋糕和饮料。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-16-08','私有听力中，东贤承诺做什么？','["买水果","做饭","打扫房子","联系其他朋友"]',0,'听力原文中东贤说제가 과일을 사러 갈게요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-16-09','宥娜的生日聚会何时、在哪里举行？','["周日下午四点／汉江公园","周六下午四点／宥娜家","周日下午五点／学校","下周六下午三点／咖啡馆"]',0,'阅读消息第二行直接给出周日下午四点和汉江公园。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-16-10','宥娜承诺做什么？','["做紫菜包饭","买饮料","买蛋糕","准备水果"]',0,'消息由宥娜发出，其中저는 김밥을 만들게요表示她的承诺。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-16-11','秀珍因家庭约定不能参加时，哪一句既接受婉拒又提出明确再约？','["괜찮아요. 그럼 다음 토요일 오후 세 시에 올 수 있어요?","왜 꼭 못 와요?","서울역으로 가 주세요.","그 코트를 입어 보세요."]',0,'母本第二场景用没关系、具体新时间和再次邀请自然推进。','assembly',11,'single_choice',10,'medium','["回应组织","母本§6.2"]','draft',1,true,'STEP 08','母本 §6.2'),
    (test_uuid,'golden-16-12','课末正式口语必须满足哪一项？','["55—75秒、12—14轮、双角色并覆盖规定信息","只朗读一条邀请句即可","必须获得自动发音分数","可以用单人口头通知代替交流"]',0,'母本规定55—75秒、12—14轮、双角色和十类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id = version_uuid and (chapter_number = 16 or slug = 'invitation')
  order by (slug = 'invitation') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'invitation',16,
      '{"zh-CN":"能来我家吗？","ko-KR":"우리 집에 올 수 있어요?"}',
      '{"zh-CN":"智秀邀请民秀参加周六温居并分配准备任务；另一场景中秀珍因家庭约定婉拒周日邀请，两人改约下周六。","ko-KR":"지수는 민수를 토요일 집들이에 초대하고 준비를 나눕니다. 수진은 가족 약속 때문에 일요일 초대를 거절하고 다음 토요일로 다시 약속합니다."}',
      '{"zh-CN":"发出或回复邀请，确认时间地点并分配任务，使用能力、承诺、移动目的和同时动作完成55—75秒、12—14轮双角色交流。","ko-KR":"초대하고 답하며 시간과 장소, 준비를 확인하고 능력, 약속, 이동 목적과 동시 행동으로 55~75초, 12~14턴의 두 역할 대화를 완성합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第16课 우리 집에 올 수 있어요.md @ 2026-08-18 / sha256:64d99b045ba9aadaba7426ca7af901758cc812e0b6d9c7cc4ae046c4665d515f'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id = test_uuid, slug = 'invitation', chapter_number = 16,
      title = '{"zh-CN":"能来我家吗？","ko-KR":"우리 집에 올 수 있어요?"}',
      scenario = '{"zh-CN":"智秀邀请民秀参加周六温居并分配准备任务；另一场景中秀珍因家庭约定婉拒周日邀请，两人改约下周六。","ko-KR":"지수는 민수를 토요일 집들이에 초대하고 준비를 나눕니다. 수진은 가족 약속 때문에 일요일 초대를 거절하고 다음 토요일로 다시 약속합니다."}',
      goal = '{"zh-CN":"发出或回复邀请，确认时间地点并分配任务，使用能力、承诺、移动目的和同时动作完成55—75秒、12—14轮双角色交流。","ko-KR":"초대하고 답하며 시간과 장소, 준비를 확인하고 능력, 약속, 이동 목적과 동시 행동으로 55~75초, 12~14턴의 두 역할 대화를 완성합니다."}',
      status = 'draft', production_status = 'editorial_review', editorial_status = 'pending',
      native_review_status = 'pending', audio_status = 'pending', image_status = 'pending',
      source_revision = 'UPLY BOOK 第16课 우리 집에 올 수 있어요.md @ 2026-08-18 / sha256:64d99b045ba9aadaba7426ca7af901758cc812e0b6d9c7cc4ae046c4665d515f',
      updated_at = now()
    where id = chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"怎样把邀请说完整？","ko-KR":"초대를 어떻게 완성할까요?"},"content":{"lead":{"zh-CN":"一句邀请要让对方知道活动、时间、地点，以及参加后各自准备什么。","ko-KR":"모임, 시간, 장소와 각자 준비할 일을 함께 알려야 합니다."},"scene":{"people":"智秀、民秀；智秀、秀珍","place":"校园休息区；电话","purpose":"发出邀请、确认参加并分配任务；婉拒时另约","imageStatus":"pending"},"targets":[{"ko":"우리 집에 올 수 있어요?","zh":"确认能否参加"},{"ko":"제가 케이크를 사러 갈게요.","zh":"说明移动目的并承诺"},{"ko":"음악을 들으면서 요리할게요.","zh":"表达同一主体同时动作"}],"finalOutput":{"zh-CN":"55—75秒、12—14轮双角色邀请与分工交流。","ko-KR":"55~75초, 12~14턴의 두 역할 초대와 준비 대화입니다."},"coach":{"zh-CN":"答对不计分场景诊断即完成；任务复述为自主展示。","ko-KR":"점수 없는 장면 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"invitation-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":11,"node":"invitation-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"认出聚会信息和准备任务","ko-KR":"모임 정보와 준비 알아보기"},"content":{"lead":{"zh-CN":"按类别、原形、搭配和邀请句学习24词；全部点读音频待制作。","ko-KR":"분류, 기본형, 결합과 초대 문장 순서로 24개 어휘를 익힙니다. 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"모임","zh":"聚会","pos":"名词","collocation":"모임을 해요"},{"ko":"집들이","zh":"温居、乔迁宴","pos":"名词","collocation":"집들이를 해요"},{"ko":"초대하다","zh":"邀请","pos":"动词","collocation":"친구를 모임에 초대하다"},{"ko":"손님","zh":"客人","pos":"名词","collocation":"손님이 여섯 명 와요"},{"ko":"약속","zh":"约定","pos":"名词","collocation":"가족과 약속이 있어요"},{"ko":"준비","zh":"准备","pos":"名词","collocation":"준비를 도와줘요"},{"ko":"음식","zh":"食物","pos":"名词","collocation":"음식을 만들어요"},{"ko":"케이크","zh":"蛋糕","pos":"名词","collocation":"케이크를 사요"},{"ko":"음료수","zh":"饮料","pos":"名词","collocation":"음료수를 가져와요"},{"ko":"선물","zh":"礼物","pos":"名词","collocation":"집들이 선물"},{"ko":"김밥","zh":"紫菜包饭","pos":"名词","collocation":"김밥을 만들다"},{"ko":"답장","zh":"回复","pos":"名词","collocation":"답장해 주세요"},{"ko":"과일","zh":"水果","pos":"名词","collocation":"과일을 사다"},{"ko":"집","zh":"家、房子","pos":"名词","collocation":"우리 집에서"},{"ko":"오다","zh":"来","pos":"动词","collocation":"집에 오다"},{"ko":"가다","zh":"去","pos":"动词","collocation":"모임에 가다"},{"ko":"준비하다","zh":"准备","pos":"动词","collocation":"음식을 준비하다"},{"ko":"돕다","zh":"帮忙","pos":"动词","collocation":"준비를 돕다"},{"ko":"만들다","zh":"制作、做","pos":"动词","collocation":"음식을 만들다"},{"ko":"사다","zh":"买","pos":"动词","collocation":"케이크를 사다"},{"ko":"가져오다","zh":"带来","pos":"动词","collocation":"음료수를 가져오다"},{"ko":"연락하다","zh":"联系","pos":"动词","collocation":"친구에게 연락하다"},{"ko":"답장하다","zh":"回复","pos":"动词","collocation":"토요일까지 답장하다"},{"ko":"미리","zh":"提前","pos":"副词","collocation":"미리 연락하다"}],"studyFlow":["看图判断类别","点读原形","跟读自然搭配","放入邀请或分工句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；24词点读和图片快说为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 24개 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"invitation-grammar-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":19,"node":"invitation-grammar-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"从能不能走到我来做","ko-KR":"가능 여부에서 약속까지"},"content":{"lead":{"zh-CN":"四个工具分别确认条件、作出承诺、说明移动目的和连接同一主体的同时动作。","ko-KR":"네 가지 도구로 가능, 약속, 이동 목적과 같은 주체의 동시 행동을 말합니다."},"grammarCards":[{"form":"V-(으)ㄹ 수 있다/없다","function":{"zh-CN":"确认能力或客观条件是否允许。","ko-KR":"능력이나 객관적인 가능 여부를 확인합니다."},"rules":["无收音接-ㄹ 수 있다/없다","非ㄹ收音接-을 수 있다/없다","ㄹ词干不重复ㄹ","ㄷ/ㅂ/ㅅ按元音环境变化","수前后分写"],"examples":[{"ko":"토요일 오후 다섯 시에 올 수 있어요?","zh":"星期六下午五点能来吗？","audioId":"chapter-16-grammar-01-example-01","audioStatus":"pending"},{"ko":"미안하지만 일요일에는 가족과 약속이 있어요. 가족을 만나러 가요. 그래서 갈 수 없어요.","zh":"对不起，周日和家人有约，所以不能去。","audioId":"chapter-16-grammar-01-example-02","audioStatus":"pending"},{"ko":"모임에 올 수 있어요?","zh":"能来参加聚会吗？","audioId":"chapter-16-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写올 수 있어요，不写올수 있어요。","ko-KR":"올 수 있어요로 띄어 씁니다."},"comparison":{"zh-CN":"갈 수 없어요明确说明客观条件；못 가요是较简短表达。","ko-KR":"갈 수 없어요는 객관적 조건을 분명히 나타냅니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-(으)ㄹ게요","function":{"zh-CN":"第一人称向听话人作出当场决定或承诺。","ko-KR":"말하는 사람이 듣는 사람에게 결정이나 약속을 합니다."},"rules":["无收音接-ㄹ게요","非ㄹ收音接-을게요","ㄹ词干不重复ㄹ","ㄷ/ㅂ/ㅅ按元音环境变化","写게요，不写께요"],"examples":[{"ko":"제가 음식을 준비할게요.","zh":"食物我来准备。","audioId":"chapter-16-grammar-02-example-01","audioStatus":"pending"},{"ko":"좋아요. 저는 집을 청소할게요.","zh":"好。我来打扫房子。","audioId":"chapter-16-grammar-02-example-02","audioStatus":"pending"},{"ko":"저는 김밥을 만들게요.","zh":"我来做紫菜包饭。","audioId":"chapter-16-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"天气预测不用第一人称承诺形式。","ko-KR":"날씨 예측에는 약속 표현을 쓰지 않습니다."},"comparison":{"zh-CN":"청소할게요是当场承担；청소할 거예요主要陈述计划。","ko-KR":"청소할게요는 약속, 청소할 거예요는 계획입니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-(으)러 가다/오다","function":{"zh-CN":"说明为了做某事而去或来。","ko-KR":"어떤 일을 하려고 가거나 오는 목적을 말합니다."},"rules":["无收音接-러","非ㄹ收音接-으러","ㄹ词干接-러并保留ㄹ","ㄷ/ㅂ/ㅅ按元音环境变化","后项须为移动动词"],"examples":[{"ko":"케이크를 사러 갈게요.","zh":"我去买蛋糕。","audioId":"chapter-16-grammar-03-example-01","audioStatus":"pending"},{"ko":"네. 제가 케이크를 사러 갈게요.","zh":"好。我去买蛋糕。","audioId":"chapter-16-grammar-03-example-02","audioStatus":"pending"},{"ko":"수진 씨는 음료수를 사러 갈 거예요.","zh":"秀珍要去买饮料。","audioId":"chapter-16-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"-러后使用가다/오다，不能接준비해요。","ko-KR":"-러 뒤에는 가다나 오다를 씁니다."},"comparison":{"zh-CN":"사러 가요强调移动目的；사고 가요表示动作顺序或并列。","ko-KR":"사러 가요는 목적, 사고 가요는 순서나 나열입니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-(으)면서","function":{"zh-CN":"连接同一主体在时间上重叠的两个动作。","ko-KR":"같은 주체가 동시에 하는 두 행동을 연결합니다."},"rules":["无收音接-면서","非ㄹ收音接-으면서","ㄹ词干接-면서并保留ㄹ","ㄷ/ㅂ/ㅅ按元音环境变化","初级输出检查同一主体"],"examples":[{"ko":"음악을 들으면서 요리해요.","zh":"边听音乐边做饭。","audioId":"chapter-16-grammar-04-example-01","audioStatus":"pending"},{"ko":"그럼 저는 음악을 들으면서 요리할게요.","zh":"那我边听音乐边做饭。","audioId":"chapter-16-grammar-04-example-02","audioStatus":"pending"},{"ko":"같이 음악을 들으면서 이야기해요.","zh":"一起边听音乐边聊天吧。","audioId":"chapter-16-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"本课强制输出限定前后同一主体。","ko-KR":"이 과의 필수 출력은 앞뒤 주체가 같습니다."},"comparison":{"zh-CN":"들으면서表示动作重叠；듣고未必同时。","ko-KR":"들으면서는 동시 행동, 듣고는 순서나 나열일 수 있습니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"八个目标空全部正确才完成；规则口述和扩展变形为自主练习。","ko-KR":"여덟 칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"invitation-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":13,"node":"invitation-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让邀请、回应和分工连续发生","ko-KR":"초대, 대답과 준비 이어 가기"},"content":{"lead":{"zh-CN":"用问答、即时回指、重复物品和时间照应把完整话轮连接起来。","ko-KR":"질문과 대답, 즉시 가리킴, 반복된 물건과 시간으로 말차례를 연결합니다."},"substitutions":[["우리 집에 올 수 있어요?","생일 모임에 올 수 있어요?","미안하지만 갈 수 없어요."],["제가 집을 청소할게요.","제가 음식을 만들게요.","제가 친구에게 연락할게요."],["케이크를 사러 갈게요.","친구를 도우러 올게요.","음악을 들으면서 요리해요."]],"practice":{"quickResponse":"同伴随机给一天和活动，3秒内邀请并回复，再抽准备任务表达承担方式。","personalOutput":"说一条含时间地点的邀请、一项承诺和一组同一主体同时动作。","required":false},"coach":{"zh-CN":"六个完整话轮顺序完全正确才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례의 순서만 필수이며 바꾸기와 개인 표현은 자율 연습입니다."},"nextNode":"housewarming-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":15,"node":"housewarming-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"能来就分工，不能来就再约","ko-KR":"올 수 있으면 준비하고 없으면 다시 약속하기"},"content":{"lead":{"zh-CN":"主场景确认参加并分工；第二场景礼貌接受婉拒并提出具体再约。","ko-KR":"주 장면은 참석과 준비를 정하고 두 번째 장면은 거절을 받아들여 다시 약속합니다."},"dialogueScenes":[{"title":{"zh-CN":"校园休息区","ko-KR":"학교 휴게 공간"},"people":"智秀／民秀","place":"当面讨论周六在智秀家的温居","purpose":"确认参加并分配清扫、做饭、蛋糕、饮料和联系任务","lines":[{"role":"지수","ko":"이번 토요일 오후 다섯 시에 우리 집에서 집들이를 해요. 올 수 있어요?","zh":"这周六下午五点在我家办温居。能来吗？"},{"role":"민수","ko":"네, 갈 수 있어요. 조금 일찍 갈게요. 저도 준비를 도울 수 있어요.","zh":"能去。我会早点到。我也能帮忙准备。"},{"role":"지수","ko":"고마워요. 손님이 여섯 명 와요. 같이 음식을 준비할 수 있어요?","zh":"谢谢。会来六位客人。能一起准备食物吗？"},{"role":"민수","ko":"네. 제가 케이크를 사러 갈게요.","zh":"好。我去买蛋糕。"},{"role":"지수","ko":"좋아요. 저는 집을 청소할게요. 음료수도 가져올 수 있어요?","zh":"好。我来打扫房子。也能带饮料来吗？"},{"role":"민수","ko":"네, 음료수도 가져올게요.","zh":"好，我也会带饮料来。"},{"role":"지수","ko":"그럼 저는 음악을 들으면서 요리할게요.","zh":"那我边听音乐边做饭。"},{"role":"민수","ko":"제가 다른 친구에게도 미리 연락할까요?","zh":"我也提前联系其他朋友吗？"},{"role":"지수","ko":"네, 부탁해요. 민수 씨, 케이크와 음료수를 준비해 주세요.","zh":"好，拜托了。民秀，请准备蛋糕和饮料。"},{"role":"민수","ko":"알겠어요. 토요일 오후 네 시 반에 갈게요. 그때 봐요.","zh":"知道了。我周六下午四点半到。到时见。"}]},{"title":{"zh-CN":"电话中婉拒并再约","ko-KR":"전화로 거절하고 다시 약속하기"},"people":"智秀／秀珍","place":"电话","purpose":"说明不能参加的原因并改约下周六","lines":[{"role":"지수","ko":"수진 씨, 이번 일요일에 우리 집에 올 수 있어요?","zh":"秀珍，这周日能来我家吗？"},{"role":"수진","ko":"미안하지만 일요일에는 가족과 약속이 있어요. 가족을 만나러 가요. 그래서 갈 수 없어요.","zh":"对不起，周日和家人有约，所以不能去。"},{"role":"지수","ko":"괜찮아요. 그럼 다음 토요일 오후 세 시에 올 수 있어요?","zh":"没关系。那下周六下午三点能来吗？"},{"role":"수진","ko":"네, 다음 토요일에는 갈 수 있어요. 집들이 선물도 가져갈게요.","zh":"能去。我也会带温居礼物。"},{"role":"지수","ko":"좋아요. 차를 마시면서 같이 이야기해요.","zh":"好。我们边喝茶边聊天吧。"},{"role":"수진","ko":"네, 다음 토요일 오후 세 시에 갈게요. 그때 봐요.","zh":"好，我下周六下午三点去。到时见。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；替换与试录为自主练习。","ko-KR":"사실 조합과 자연스러운 대답을 모두 맞혀야 하며 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-invite"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":16,"node":"listen-and-invite","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听清承诺，再完成结业交流","ko-KR":"약속을 듣고 초대 대화 완성하기"},"content":{"lead":{"zh-CN":"两版听力真实制作并绑定后听清东贤的承诺，再提交55—75秒、12—14轮双角色交流。","ko-KR":"두 음원이 제작·연결된 뒤 동현의 약속을 듣고 55~75초, 12~14턴의 두 역할 대화를 제출합니다."},"speakingFrame":["이번 ___에 ___에서 ___을/를 해요. 올 수 있어요?","네, 갈 수 있어요.／미안하지만 ___아서/어서 갈 수 없어요.","제가 ___할게요.","___을/를 사러 갈게요.","___면서 ___할게요.","그때 봐요."],"requiredInformation":["活动","日期／星期与时间","地点","邀请问句","参加回复","至少两项准备分工","第一人称承诺","移动目的","同一主体同时动作","自然告别"],"coach":{"zh-CN":"听力答对且开放口语达到提交门槛才完成；口语不产生正确性或分数。","ko-KR":"듣기 정답과 말하기 제출 조건이 모두 필요하며 말하기에는 정오나 점수가 없습니다."},"nextNode":"invitation-message"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":14,"node":"invitation-message","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读生日邀请，写一条明确回复","ko-KR":"생일 초대를 읽고 분명하게 답장하기"},"content":{"lead":{"zh-CN":"从宥娜给敏智的消息中找活动、时间地点、准备与期限，再以敏智的身份回复宥娜。","ko-KR":"유나가 민지에게 보낸 메시지에서 모임, 시간과 장소, 준비와 답장 기한을 찾고 민지가 유나에게 답합니다."},"reading":"민지 씨, 안녕하세요?\n이번 일요일 오후 네 시에 한강공원에서 생일 모임을 해요.\n모임에 올 수 있어요?\n저는 김밥을 만들게요.\n수진 씨는 음료수를 사러 갈 거예요.\n같이 음악을 들으면서 이야기해요.\n토요일까지 답장해 주세요.","writing":{"author":"敏智","recipient":"宥娜","sentences":"6—8","required":["感谢邀请","参加回复","时间确认或再约","一项承诺","移动目的","同一主体同时动作","告别","婉拒时的原因与具体再约"],"scaffold":"유나 씨, 초대해 줘서 고마워요. → 모임에 갈 수 있어요／갈 수 없어요. → 시간 확인／이유와 다시 만날 시간 → 제가 ___할게요. → ___을/를 사러 갈게요. → ___면서 ___할게요. → 그때 봐요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读三题全对，并提交6—8句固定作者和收件人的原创回复及量规自查才完成。","ko-KR":"읽기 세 문항 정답과 6~8문장의 민지에서 유나로 보내는 답장 및 점검이 모두 필요합니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能独立完成邀请协作吗？","ko-KR":"초대와 준비를 혼자 완성할 수 있나요?"},"content":{"lead":{"zh-CN":"综合多选检查形式与功能，再按真实表现回应五项Can-do并记录返回节点。","ko-KR":"복수 선택으로 형태와 기능을 확인하고 실제 수행에 따라 다섯 Can-do와 복습 노드를 기록합니다."},"reviewMap":[{"cause":"词汇","returnNode":"invitation-words"},{"cause":"语法","returnNode":"invitation-grammar-tools"},{"cause":"理解","returnNode":"housewarming-talk／listen-and-invite／invitation-message"},{"cause":"表达","returnNode":"listen-and-invite"},{"cause":"读写","returnNode":"invitation-message"}],"coach":{"zh-CN":"综合多选正确，并完成五项自查与返回位置才完成；自主复习展示不计入强制条件。","ko-KR":"복수 선택 정답과 다섯 자기 점검 및 복습 위치 기록이 필요합니다."},"nextNode":"chapter-test:korean-level-one-16"}}
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
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"智秀准备邀请朋友参加周六温居。哪一句能够同时说明活动并发出邀请？","ko-KR":"지수가 친구를 토요일 집들이에 초대하려고 합니다. 모임을 알리고 초대하는 말은 무엇이에요?"},"instruction":{"zh-CN":"选择同时包含聚会信息和邀请功能的一句；本题不计分。","ko-KR":"모임 정보와 초대 기능이 모두 있는 문장을 하나 고르세요. 점수에는 포함되지 않습니다."},"options":["이번 토요일에 우리 집에서 집들이를 해요. 올 수 있어요?","서울역으로 가 주세요.","목이 아파서 약을 먹었어요.","이 코트를 입어 보세요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句同时说明周六在家办温居并询问能否参加；本题不计分。","ko-KR":"토요일 집들이 정보와 참석 가능 질문을 함께 말합니다. 점수에는 포함되지 않습니다."},"feedback":[{"zh-CN":"先找表示活动的名词和询问能否参加的问句。","ko-KR":"모임을 나타내는 말과 참석 가능 질문을 찾으세요."},{"zh-CN":"目标句要同时回答什么活动和能否来。","ko-KR":"어떤 모임인지와 올 수 있는지를 모두 말해야 합니다."},{"zh-CN":"应选择包含집들이를 해요和올 수 있어요?的一项。","ko-KR":"집들이를 해요와 올 수 있어요?가 함께 있는 문장입니다."}]}},
    {"node":"invitation-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在제가 미리 연락할게요.中，미리是什么意思？","ko-KR":"제가 미리 연락할게요.에서 미리는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인란을 선택하세요."},"options":["提前","一起","慢慢地","下次"],"config":{"shuffle":true,"example":"제가 미리 연락할게요.","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true},"audioPending":true},"answer":{"kind":"index_confirmation","value":0},"explanation":{"correct":{"zh-CN":"미리表示在预定时间以前先做；朗读确认已记录。","ko-KR":"미리는 정한 시간보다 앞서 한다는 뜻이며 낭독 확인을 기록했습니다."},"feedback":[{"zh-CN":"观察它是否在说明联系动作发生的先后。","ko-KR":"연락하는 때의 순서를 나타내는지 보세요."},{"zh-CN":"邀请前先联系，就是在预定时间以前做。","ko-KR":"정한 시간보다 앞서 연락하는 뜻입니다."},{"zh-CN":"答案是“提前”；整句表示“我会提前联系”。","ko-KR":"미리는 미리, 사전에라는 뜻입니다."}]}},
    {"node":"invitation-grammar-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成八小题，检查能力、承诺、移动目的和同一主体同时动作。","ko-KR":"가능, 약속, 이동 목적과 같은 주체의 동시 행동을 확인하는 여덟 문항을 완성하세요."},"instruction":{"zh-CN":"每题只按指定功能填写；第1题用礼貌疑问结尾，第5—8题只填连接部分。保留标准空格和拼写差异。","ko-KR":"지정된 기능에 맞게 쓰고 1번은 높임말 질문, 5~8번은 연결 부분만 쓰세요. 띄어쓰기와 철자를 지키세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"오다 → ___（客观条件允许来吗；礼貌疑问）","placeholder":"답을 입력하세요"},{"id":"item-02","label":"돕다 → ___（客观条件允许帮忙）","placeholder":"답을 입력하세요"},{"id":"item-03","label":"준비하다 → ___（第一人称当场承诺）","placeholder":"답을 입력하세요"},{"id":"item-04","label":"듣다 → ___（第一人称当场承诺）","placeholder":"답을 입력하세요"},{"id":"item-05","label":"사다 → ___ 가요（去买的移动目的，只填连接部分）","placeholder":"답을 입력하세요"},{"id":"item-06","label":"돕다 → ___ 와요（来帮忙的移动目的，只填连接部分）","placeholder":"답을 입력하세요"},{"id":"item-07","label":"듣다 → ___ 요리해요（同一人边听边做饭）","placeholder":"답을 입력하세요"},{"id":"item-08","label":"만들다 → ___ 이야기해요（同一人边做边聊）","placeholder":"답을 입력하세요"}]},"answer":{"kind":"text_array","value":["올 수 있어요?","도울 수 있어요","준비할게요","들을게요","사러","도우러","들으면서","만들면서"]},"explanation":{"correct":{"zh-CN":"八项功能、词形和标准空格全部正确。","ko-KR":"여덟 형태의 기능, 활용과 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先分成能力、承诺、目的和同时动作，再处理词干。","ko-KR":"가능, 약속, 목적과 동시 행동으로 먼저 나누세요."},{"zh-CN":"注意수前后空格、ㅂ与ㄷ不规则，以及ㄹ词干保留。","ko-KR":"수의 띄어쓰기, ㅂ과 ㄷ 불규칙 및 ㄹ 보존을 확인하세요."},{"zh-CN":"依次为올 수 있어요?、도울 수 있어요、준비할게요、들을게요、사러、도우러、들으면서、만들면서。","ko-KR":"제시된 여덟 형태로 모두 고쳐 쓰세요."}]}},
    {"node":"invitation-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段语义连贯的温居邀请与分工交流。","ko-KR":"여섯 개의 완전한 대화 차례를 자연스러운 집들이 초대와 준비 대화로 배열하세요."},"instruction":{"zh-CN":"根据问题与回答、방금回指、重复物品和具体时间判断；卡片不标角色、步骤或顺序。","ko-KR":"질문과 대답, 방금 가리킴, 반복된 물건과 시간을 바탕으로 판단하세요."},"options":["네, 방금 말한 케이크와 음료수를 준비해 주세요. 저는 그동안 음악을 들으면서 음식을 만들게요.","네, 토요일 오후 다섯 시에 갈 수 있어요. 조금 일찍 갈게요. 저도 준비를 도울 수 있어요.","알겠어요. 케이크와 음료수를 준비할게요. 이번 토요일 오후 다섯 시 전에 봐요.","이번 토요일 오후 다섯 시에 우리 집에서 집들이를 해요. 올 수 있어요?","네, 케이크를 사러 갈게요. 음료수도 가져올 수 있어요.","고마워요. 방금 말한 것처럼 조금 일찍 와 주세요. 케이크를 사러 갈 수 있어요?"],"config":{"shuffle":true,"resetBeforeSubmit":true},"answer":{"kind":"order","value":[3,1,5,4,0,2]},"explanation":{"correct":{"zh-CN":"邀请、直接回应、两次即时回指、物品分工和告别顺序连贯。","ko-KR":"초대, 직접 대답, 두 번의 즉시 가리킴, 준비와 인사가 자연스럽습니다."},"feedback":[{"zh-CN":"检查问句是否紧邻直接回答，并找没有前文就无法成立的방금。","ko-KR":"질문 바로 뒤의 대답과 방금의 앞말을 찾으세요."},{"zh-CN":"先定位邀请和参加回复，再追踪早点来及蛋糕和饮料。","ko-KR":"초대와 참석 대답 뒤에 일찍 오기, 케이크와 음료수를 따라가세요."},{"zh-CN":"系统依次检查邀请→参加回复→早点来回指→买蛋糕回应→物品回指→接受分工。","ko-KR":"초대부터 분담 수락까지 여섯 연결을 다시 확인하세요."}]}},
    {"node":"housewarming-talk","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景几点开始，民秀承担哪两样物品？","ko-KR":"주 장면의 시작 시간은 언제이고, 민수는 어떤 물건 두 가지를 준비해요?"},"instruction":{"zh-CN":"选择开始时间和民秀的两样物品都与台词一致的一组。","ko-KR":"시작 시간과 민수의 두 물건이 모두 대사와 같은 조합을 고르세요."},"options":["오후 다섯 시／케이크와 음료수","오후 네 시 반／음식과 선물","오후 다섯 시／청소와 음식","오후 세 시／케이크와 과일"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"五点是活动开始；民秀负责蛋糕和饮料。","ko-KR":"다섯 시에 시작하고 민수는 케이크와 음료수를 준비합니다."},"feedback":[{"zh-CN":"分别找邀请中的开始时间和第9轮汇总的分工。","ko-KR":"초대의 시작 시간과 9턴의 준비를 찾으세요."},{"zh-CN":"不要把四点半到达误作开始，也不要把智秀的任务算给民秀。","ko-KR":"네 시 반 도착과 지수의 일을 섞지 마세요."},{"zh-CN":"正确组合是오후 다섯 시／케이크와 음료수。","ko-KR":"정답은 오후 다섯 시／케이크와 음료수입니다."}]}},
    {"node":"housewarming-talk","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"秀珍说周日和家人有约，所以不能来。哪一句既接受婉拒又提出明确再约？","ko-KR":"수진이 가족 약속 때문에 올 수 없다고 했습니다. 거절을 받아들이고 구체적으로 다시 약속하는 말은 무엇이에요?"},"instruction":{"zh-CN":"选择不责备对方、包含具体新时间并继续邀请的一句。","ko-KR":"상대를 탓하지 않고 새로운 구체적인 시간으로 다시 초대하는 문장을 고르세요."},"options":["괜찮아요. 그럼 다음 토요일 오후 세 시에 올 수 있어요?","왜 꼭 못 와요?","서울역으로 가 주세요.","그 코트를 입어 보세요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句接受婉拒，并给出下周六下午三点这一明确再约。","ko-KR":"거절을 받아들이고 다음 토요일 오후 세 시로 다시 초대합니다."},"feedback":[{"zh-CN":"先找“没关系”，再看是否有具体新时间。","ko-KR":"괜찮아요와 구체적인 새 시간을 찾으세요."},{"zh-CN":"自然再约需要接受婉拒、具体时间和再次询问。","ko-KR":"거절 수용, 구체적인 시간과 다시 묻기가 필요합니다."},{"zh-CN":"应选择괜찮아요. 그럼 다음 토요일 오후 세 시에 올 수 있어요?。","ko-KR":"다음 토요일 오후 세 시로 다시 묻는 문장입니다."}]}},
    {"node":"listen-and-invite","sort":1,"key":"listening-preparation","type":"listening","prompt":{"zh-CN":"听正常速或慢速音频，判断东贤承诺做什么。","ko-KR":"보통 속도나 느린 속도 음성을 듣고 동현이 무엇을 하겠다고 약속하는지 고르세요."},"instruction":{"zh-CN":"正常速可听两遍、慢速可听一遍；同时听人物和承诺内容。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 사람과 약속을 함께 확인하세요."},"options":["과일을 사요","음식을 만들어요","집을 청소해요","다른 친구에게 연락해요"],"config":{"shuffle":true,"audioStatus":"pending","normalPlays":2,"slowPlays":1,"tracks":[{"id":"track-01","label":"正常语速","audioId":"chapter-16-listening-preparation-normal","status":"pending"},{"id":"track-02","label":"慢速","audioId":"chapter-16-listening-preparation-slow","status":"pending"}]},"answer":{"kind":"index","value":0},"transcript":"지수: 이번 토요일 오후 다섯 시에 집들이를 해요. 올 수 있어요? 동현: 네, 갈 수 있어요. 제가 과일을 사러 갈게요. 지수: 고마워요. 저는 음악을 들으면서 음식을 만들게요. 동현: 네, 오후 네 시 반에 갈게요.","audioObjectKey":"korean-level-one/chapter-16/listening/chapter-16-listening-preparation-normal.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"东贤承诺去买水果。","ko-KR":"동현은 과일을 사러 가겠다고 약속합니다."},"feedback":[{"zh-CN":"再听东贤说제가后面的承诺。","ko-KR":"동현의 제가 뒤 약속을 다시 들으세요."},{"zh-CN":"目标句使用移动目的和承诺，宾语是一种食物。","ko-KR":"이동 목적과 약속이 함께 있고 목적어는 음식입니다."},{"zh-CN":"答案是과일을 사요；原话为제가 과일을 사러 갈게요。","ko-KR":"정답은 과일을 사요입니다."}],"privateListening":{"normalAudioId":"chapter-16-listening-preparation-normal","normalAudioObjectKey":"korean-level-one/chapter-16/listening/chapter-16-listening-preparation-normal.mp3","normalScript":"지수: 이번 토요일 오후 다섯 시에 집들이를 해요. 올 수 있어요? / 동현: 네, 갈 수 있어요. 제가 과일을 사러 갈게요. / 지수: 고마워요. 저는 음악을 들으면서 음식을 만들게요. / 동현: 네, 오후 네 시 반에 갈게요.","slowAudioId":"chapter-16-listening-preparation-slow","slowAudioObjectKey":"korean-level-one/chapter-16/listening/chapter-16-listening-preparation-slow.mp3","slowScript":"지수: 이번 토요일 오후 다섯 시에 집들이를 해요. / 올 수 있어요? / 동현: 네, 갈 수 있어요. / 제가 과일을 사러 갈게요. / 지수: 고마워요. / 저는 음악을 들으면서 음식을 만들게요. / 동현: 네, 오후 네 시 반에 갈게요.","pauseMarks":"지수: 이번 토요일 오후 다섯 시에 집들이를 해요. ⏸ 올 수 있어요? ⏸ 동현: 네, 갈 수 있어요. ⏸ 제가 과일을 사러 갈게요. ⏸ 지수: 고마워요. ⏸ 저는 음악을 들으면서 음식을 만들게요. ⏸ 동현: 네, 오후 네 시 반에 갈게요.","speaker":"F03／지수；M02／동현","distractorReasons":["做饭是智秀的承诺。","原文没有清扫任务。","原文没有联系其他朋友。"]}}},
    {"node":"listen-and-invite","sort":2,"key":"speaking-invitation","type":"speaking","prompt":{"zh-CN":"完成55—75秒、12—14轮的双角色邀请与分工交流。","ko-KR":"두 역할을 번갈아 맡아 55~75초 동안 12~14턴의 초대와 준비 대화를 완성하세요."},"instruction":{"zh-CN":"加入活动、日期时间、地点、邀请回复、两项分工、承诺、移动目的、同一主体同时动作和告别；婉拒时加入原因和明确再约。","ko-KR":"모임, 날짜와 시간, 장소, 초대와 대답, 준비 두 가지, 약속, 이동 목적, 같은 주체의 동시 행동과 인사를 넣으세요."},"options":[],"config":{"minimumSeconds":55,"maximumSeconds":75,"minimumTurns":12,"maximumTurns":14,"rolesRequired":2,"requiredCriteria":10,"criteria":["活动","日期／星期与时间","地点","邀请问句","参加回复","至少两项准备分工","第一人称承诺","移动目的","同一主体同时动作","自然告别；婉拒时另含原因与再约"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存达到提交条件的原创双角色录音；不产生正确性或分数。","ko-KR":"제출 조건을 갖춘 두 역할 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对十类信息、两个角色、话轮和时长。","ko-KR":"열 정보, 두 역할, 말차례와 시간을 확인하세요."},{"zh-CN":"重排邀请—参加回复—分工—承诺／目的／同时动作—告别。","ko-KR":"초대, 대답, 준비, 약속과 목적, 동시 행동, 인사 순서를 확인하세요."},{"zh-CN":"按句框补齐缺项后重录；开放交流没有唯一台词。","ko-KR":"빠진 내용을 보완해 다시 녹음하세요."}]}},
    {"node":"invitation-message","sort":1,"key":"reading-invitation","type":"single_choice","prompt":{"zh-CN":"阅读宥娜发给敏智的生日邀请消息，完成三道事实题。","ko-KR":"유나가 민지에게 보낸 생일 초대 메시지를 읽고 사실 확인 세 문항에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，必须从公开消息原句直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 메시지에서 직접 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"민지 씨, 안녕하세요? / 이번 일요일 오후 네 시에 한강공원에서 생일 모임을 해요. / 모임에 올 수 있어요? / 저는 김밥을 만들게요. / 수진 씨는 음료수를 사러 갈 거예요. / 같이 음악을 들으면서 이야기해요. / 토요일까지 답장해 주세요.","items":[{"id":"q1","question":"생일 모임은 언제, 어디에서 해요?","options":["일요일 오후 네 시／한강공원","토요일 오후 네 시／유나의 집","일요일 오후 다섯 시／학교","다음 토요일 오후 세 시／카페"]},{"id":"q2","question":"유나는 무엇을 만들게요?","options":["음료수","김밥","케이크","과일"]},{"id":"q3","question":"민지는 언제까지 답장해야 돼요?","options":["금요일까지","토요일까지","일요일까지","다음 주까지"]}]},"answer":{"kind":"index_array","value":[0,1,1]},"explanation":{"correct":{"zh-CN":"三题答案依次是周日下午四点／汉江公园、紫菜包饭、周六以前。","ko-KR":"정답은 일요일 오후 네 시／한강공원, 김밥, 토요일까지입니다."},"feedback":[{"zh-CN":"圈出活动行的时间地点、发件人的承诺和末句期限。","ko-KR":"시간과 장소, 보낸 사람의 약속과 마지막 기한을 찾으세요."},{"zh-CN":"不要把秀珍买饮料当成宥娜的承诺，也不要把活动日误作回复期限。","ko-KR":"수진의 음료수와 모임 날짜를 섞지 마세요."},{"zh-CN":"依次是일요일 오후 네 시／한강공원、김밥、토요일까지。","ko-KR":"세 답을 공개 메시지에서 다시 확인하세요."}]}},
    {"node":"invitation-message","sort":2,"key":"write-reply","type":"writing","prompt":{"zh-CN":"固定以敏智的身份，给宥娜写一条6—8句生日邀请回复。","ko-KR":"민지의 입장에서 유나에게 6~8문장의 생일 초대 답장을 쓰세요."},"instruction":{"zh-CN":"保持敏智→宥娜的单一作者和收件人，写感谢、参加回复、时间、承诺、移动目的、同时动作和告别；婉拒时补原因与再约，并完成量规自查。","ko-KR":"민지가 유나에게 보내는 한 메시지로 감사, 참석, 시간, 약속, 이동 목적, 동시 행동과 인사를 쓰고 점검하세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":55,"minimumInformationKinds":7,"informationChecklist":["感谢邀请","参加回复","时间确认或具体再约","一项承诺","移动目的","同一主体同时动作","自然告别；婉拒时另含原因"],"requiredPhraseGroups":[["유나 씨"],["초대"],["갈 수 있어요","갈 수 없어요"],["할게요","을게요","ㄹ게요"],["러 갈게요","으러 갈게요","러 올게요","으러 올게요"],["면서"]],"minimumPhraseGroups":6,"requireCompletionChecklist":true,"scaffold":"유나 씨, 초대해 줘서 고마워요. → 갈 수 있어요／갈 수 없어요. → 시간／이유와 다시 만날 시간 → 제가 ___할게요. → ___을/를 사러 갈게요. → ___면서 ___할게요. → 그때 봐요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、固定作者收件人、信息和量规自查的原创回复；不产生正确性或分数。","ko-KR":"문장 수, 작성자와 받는 사람, 정보와 점검을 갖춘 답장을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先固定敏智为作者、宥娜为收件人，再检查参加路径。","ko-KR":"민지가 유나에게 쓰는 흐름과 참석 선택을 확인하세요."},{"zh-CN":"核对四项核心形式、移动后项和同时动作主体。","ko-KR":"네 문법, 이동 동사와 동시 행동 주체를 확인하세요."},{"zh-CN":"按支架补齐缺项，删除其他人物的回应，但不要复制示范。","ko-KR":"다른 역할의 답을 지우고 빠진 내용을 보완하세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的表达。","ko-KR":"형태가 바르고 괄호의 기능을 알맞게 나타내는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["토요일에 올 수 있어요?（确认参加条件）","제가 케이크를 살게요.（第一人称当场承诺）","음료수를 사러 가요.（移动目的）","음악을 들으러 요리해요.（同一主体同时动作）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三项正确；第4项应使用들으면서表达同时动作。","ko-KR":"앞의 세 표현이 맞고 4번은 들으면서로 고쳐야 합니다."},"feedback":[{"zh-CN":"分别检查能力、承诺、移动目的和同时动作。","ko-KR":"가능, 약속, 이동 목적과 동시 행동을 확인하세요."},{"zh-CN":"只有一项把移动目的形式放在非移动后项前。","ko-KR":"한 항목만 이동 목적을 이동 동사 없이 썼습니다."},{"zh-CN":"正确项是第1、2、3项；第4项改为음악을 들으면서 요리해요。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据刚才的实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"방금 한 실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个非none返回节点，全部能完成时只选none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 none이 아닌 노드를, 모두 가능하면 none만 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"invite","label":"我能说明活动时间地点并发出邀请／모임의 시간과 장소를 말하고 초대할 수 있어요"},{"id":"reply","label":"我能确认参加条件并肯定或婉拒／참석 가능 여부를 묻고 답할 수 있어요"},{"id":"promise","label":"我能分配任务并作出承诺／준비를 나누고 약속할 수 있어요"},{"id":"purpose-simultaneous","label":"我能说明移动目的和同时动作／이동 목적과 동시 행동을 말할 수 있어요"},{"id":"invitation-task","label":"我能完成55—75秒、12—14轮双角色交流／55~75초, 12~14턴의 두 역할 대화를 할 수 있어요"}],"returnNodes":[{"value":"invitation-words","label":"词汇"},{"value":"invitation-grammar-tools","label":"语法"},{"value":"housewarming-talk","label":"对话理解"},{"value":"listen-and-invite","label":"听说"},{"value":"invitation-message","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想邀请回复、四项语法、时间地点、分工和双角色录音。","ko-KR":"초대와 대답, 네 문법, 시간과 장소, 준비와 녹음을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 16 node %', item->>'node'; end if;
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
      'dialogue-fact-check','dialogue-response','listening-preparation',
      'speaking-invitation','reading-invitation','write-reply',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where media.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-16-image-01","purpose":"章节情境主图","file":"chapter-16-01-scene.png","path":"../附件/韩国语1级/第16课/第16课-01-章节情境主图.png","alt":"校园休息区两位朋友讨论周六温居。","width":1600,"height":900},
    {"node":"invitation-words","key":"chapter-16-image-02","purpose":"核心词汇邀请与准备卡","file":"chapter-16-02-vocabulary.png","path":"../附件/韩国语1级/第16课/第16课-02-核心词汇卡-邀请与准备.png","alt":"邀请、客人、食物、回复等生活情境卡。","width":1200,"height":900},
    {"node":"invitation-grammar-tools","key":"chapter-16-image-03","purpose":"能力承诺目的同时语法总图","file":"chapter-16-03-grammar-overview.png","path":"../附件/韩国语1级/第16课/第16课-03-语法总图-能力承诺目的同时.png","alt":"能力、第一人称承诺、移动目的和同时动作四条结构轨道。","width":1600,"height":900},
    {"node":"invitation-grammar-tools","key":"chapter-16-image-04","purpose":"能力形式结构图","file":"chapter-16-03a-ability.png","path":"../附件/韩国语1级/第16课/第16课-03A-语法结构图-能力.png","alt":"能力形式、空格和不规则分流。","width":1600,"height":900},
    {"node":"invitation-grammar-tools","key":"chapter-16-image-05","purpose":"第一人称承诺结构图","file":"chapter-16-03b-promise.png","path":"../附件/韩国语1级/第16课/第16课-03B-语法结构图-承诺.png","alt":"第一人称承诺与词干分流。","width":1600,"height":900},
    {"node":"invitation-grammar-tools","key":"chapter-16-image-06","purpose":"移动目的结构图","file":"chapter-16-03c-movement-purpose.png","path":"../附件/韩国语1级/第16课/第16课-03C-语法结构图-移动目的.png","alt":"目的动作连接移动动词。","width":1600,"height":900},
    {"node":"invitation-grammar-tools","key":"chapter-16-image-07","purpose":"同时动作结构图","file":"chapter-16-03d-simultaneous.png","path":"../附件/韩国语1级/第16课/第16课-03D-语法结构图-同时动作.png","alt":"同一主体两个重叠动作。","width":1600,"height":900},
    {"node":"invitation-builder","key":"chapter-16-image-08","purpose":"邀请完整话轮卡","file":"chapter-16-04-pattern-blocks.png","path":"../附件/韩国语1级/第16课/第16课-04-邀请话轮卡.png","alt":"六张无角色、步骤、箭头或顺序标记的完整邀请话轮卡。","width":1200,"height":900},
    {"node":"housewarming-talk","key":"chapter-16-image-09","purpose":"实战对话双场景图","file":"chapter-16-05-dialogue.png","path":"../附件/韩国语1级/第16课/第16课-05-实战对话场景.png","alt":"当面分工与电话婉拒再约两个独立场景。","width":1600,"height":900},
    {"node":"listen-and-invite","key":"chapter-16-image-10","purpose":"准备任务听力信息图","file":"chapter-16-06-listening.png","path":"../附件/韩国语1级/第16课/第16课-06-听力信息图-准备任务.png","alt":"水果、做饭、清扫和联系朋友四种无文字任务卡。","width":1200,"height":900},
    {"node":"invitation-message","key":"chapter-16-image-11","purpose":"生日邀请消息版式","file":"chapter-16-07-invitation-message.png","path":"../附件/韩国语1级/第16课/第16课-07-生日邀请消息.png","alt":"手机生日邀请消息版式。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-16-image-12","purpose":"最终邀请协作任务图","file":"chapter-16-08-final-task.png","path":"../附件/韩国语1级/第16课/第16课-08-最终任务图.png","alt":"邀请协作十类信息的检查图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-16/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'invitation-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"모임","collocation":"모임을 해요"},{"word":"집들이","collocation":"집들이를 해요"},{"word":"초대하다","collocation":"친구를 모임에 초대하다"},{"word":"손님","collocation":"손님이 여섯 명 와요"},{"word":"약속","collocation":"가족과 약속이 있어요"},{"word":"준비","collocation":"준비를 도와줘요"},{"word":"음식","collocation":"음식을 만들어요"},{"word":"케이크","collocation":"케이크를 사요"},{"word":"음료수","collocation":"음료수를 가져와요"},{"word":"선물","collocation":"집들이 선물"},{"word":"김밥","collocation":"김밥을 만들다"},{"word":"답장","collocation":"답장해 주세요"},{"word":"과일","collocation":"과일을 사다"},{"word":"집","collocation":"우리 집에서"},{"word":"오다","collocation":"집에 오다"},{"word":"가다","collocation":"모임에 가다"},{"word":"준비하다","collocation":"음식을 준비하다"},{"word":"돕다","collocation":"준비를 돕다"},{"word":"만들다","collocation":"음식을 만들다"},{"word":"사다","collocation":"케이크를 사다"},{"word":"가져오다","collocation":"음료수를 가져오다"},{"word":"연락하다","collocation":"친구에게 연락하다"},{"word":"답장하다","collocation":"토요일까지 답장하다"},{"word":"미리","collocation":"미리 연락하다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-16-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-16/audio/vocabulary/chapter-16-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-16-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-16-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-16/audio/vocabulary/chapter-16-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-16-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'invitation-grammar-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-16/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-16-grammar-01-example-01","script":"토요일 오후 다섯 시에 올 수 있어요?"},{"id":"chapter-16-grammar-01-example-02","script":"미안하지만 일요일에는 가족과 약속이 있어요. 가족을 만나러 가요. 그래서 갈 수 없어요."},{"id":"chapter-16-grammar-01-example-03","script":"모임에 올 수 있어요?"},
    {"id":"chapter-16-grammar-02-example-01","script":"제가 음식을 준비할게요."},{"id":"chapter-16-grammar-02-example-02","script":"좋아요. 저는 집을 청소할게요."},{"id":"chapter-16-grammar-02-example-03","script":"저는 김밥을 만들게요."},
    {"id":"chapter-16-grammar-03-example-01","script":"케이크를 사러 갈게요."},{"id":"chapter-16-grammar-03-example-02","script":"네. 제가 케이크를 사러 갈게요."},{"id":"chapter-16-grammar-03-example-03","script":"수진 씨는 음료수를 사러 갈 거예요."},
    {"id":"chapter-16-grammar-04-example-01","script":"음악을 들으면서 요리해요."},{"id":"chapter-16-grammar-04-example-02","script":"그럼 저는 음악을 들으면서 요리할게요."},{"id":"chapter-16-grammar-04-example-03","script":"같이 음악을 들으면서 이야기해요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'housewarming-talk';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-16/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-16-dialogue-main-line-01","purpose":"主对话逐句","script":"이번 토요일 오후 다섯 시에 우리 집에서 집들이를 해요. 올 수 있어요?","speaker":"F01／지수"},{"id":"chapter-16-dialogue-main-line-02","purpose":"主对话逐句","script":"네, 갈 수 있어요. 조금 일찍 갈게요. 저도 준비를 도울 수 있어요.","speaker":"M01／민수"},{"id":"chapter-16-dialogue-main-line-03","purpose":"主对话逐句","script":"고마워요. 손님이 여섯 명 와요. 같이 음식을 준비할 수 있어요?","speaker":"F01／지수"},{"id":"chapter-16-dialogue-main-line-04","purpose":"主对话逐句","script":"네. 제가 케이크를 사러 갈게요.","speaker":"M01／민수"},{"id":"chapter-16-dialogue-main-line-05","purpose":"主对话逐句","script":"좋아요. 저는 집을 청소할게요. 음료수도 가져올 수 있어요?","speaker":"F01／지수"},{"id":"chapter-16-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 음료수도 가져올게요.","speaker":"M01／민수"},{"id":"chapter-16-dialogue-main-line-07","purpose":"主对话逐句","script":"그럼 저는 음악을 들으면서 요리할게요.","speaker":"F01／지수"},{"id":"chapter-16-dialogue-main-line-08","purpose":"主对话逐句","script":"제가 다른 친구에게도 미리 연락할까요?","speaker":"M01／민수"},{"id":"chapter-16-dialogue-main-line-09","purpose":"主对话逐句","script":"네, 부탁해요. 민수 씨, 케이크와 음료수를 준비해 주세요.","speaker":"F01／지수"},{"id":"chapter-16-dialogue-main-line-10","purpose":"主对话逐句","script":"알겠어요. 토요일 오후 네 시 반에 갈게요. 그때 봐요.","speaker":"M01／민수"},{"id":"chapter-16-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-16-dialogue-alt-line-01","purpose":"第二对话逐句","script":"수진 씨, 이번 일요일에 우리 집에 올 수 있어요?","speaker":"F01／지수"},{"id":"chapter-16-dialogue-alt-line-02","purpose":"第二对话逐句","script":"미안하지만 일요일에는 가족과 약속이 있어요. 가족을 만나러 가요. 그래서 갈 수 없어요.","speaker":"F02／수진"},{"id":"chapter-16-dialogue-alt-line-03","purpose":"第二对话逐句","script":"괜찮아요. 그럼 다음 토요일 오후 세 시에 올 수 있어요?","speaker":"F01／지수"},{"id":"chapter-16-dialogue-alt-line-04","purpose":"第二对话逐句","script":"네, 다음 토요일에는 갈 수 있어요. 집들이 선물도 가져갈게요.","speaker":"F02／수진"},{"id":"chapter-16-dialogue-alt-line-05","purpose":"第二对话逐句","script":"좋아요. 차를 마시면서 같이 이야기해요.","speaker":"F01／지수"},{"id":"chapter-16-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 다음 토요일 오후 세 시에 갈게요. 그때 봐요.","speaker":"F02／수진"},{"id":"chapter-16-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F01／F02"}
  ] $dialogue$::jsonb);

  select node.id, activity.id into node_uuid, activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_activities activity on activity.node_id = node.id
  where module.chapter_id = chapter_uuid and activity.activity_key = 'listening-preparation';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-16-listening-preparation-normal','audio','私有听力正常语速','korean-level-one/chapter-16/listening/chapter-16-listening-preparation-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F03／지수；M02／동현","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-16-listening-preparation-slow','audio','私有听力慢速','korean-level-one/chapter-16/listening/chapter-16-listening-preparation-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F03／지수；M02／동현","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_sixteen$;

commit;
