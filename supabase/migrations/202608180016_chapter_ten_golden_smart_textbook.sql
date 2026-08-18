begin;

-- Converted from the read-only UPLY BOOK chapter-ten master.
-- source_sha256: 728b1bc4799854cdb33b0ba2ccdfb3b4b76316c7390473d98f8d5e2649fddfe1
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are historical values explicitly
-- recorded by the master and remain pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_ten$
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
  order by version.version_number desc
  limit 1;
  if version_uuid is null then
    raise exception 'Cannot convert chapter 10: korean-level-one-smart version was not found';
  end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson
  join public.courses course on course.id = lesson.course_id
  where course.slug = 'korean-beginner' and lesson.slug = 'basic-pronunciation'
  limit 1;
  if lesson_uuid is null then
    raise exception 'Cannot convert chapter 10: korean-beginner/basic-pronunciation lesson was not found';
  end if;

  select id into test_uuid
  from public.chapter_tests
  where slug = 'korean-level-one-10'
  limit 1;
  if test_uuid is null then
    select id into test_uuid
    from public.chapter_tests
    where lesson_id = lesson_uuid and chapter_number = 10
    limit 1;
  end if;

  if test_uuid is null then
    insert into public.chapter_tests (
      id, lesson_id, slug, course_key, chapter_number, title, korean_title,
      description, duration_minutes, passing_score, skills, version, status,
      student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000010'::uuid,
      lesson_uuid, 'korean-level-one-10', 'korean-level-one', 10,
      '第 10 章测试：现在几点？', '제10과 평가: 지금 몇 시예요?',
      '检查准确时刻、时间范围、连续动作、未来计划，以及一日日程的听读理解和组织。',
      12, 60,
      '{"recognition":"时间与日程词汇","structure":"时刻、范围、动作链与计划形","reading":"对话、听力与日程消息理解","assembly":"完整一日日程组织"}'::jsonb,
      1, 'draft', '10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id = lesson_uuid,
      slug = 'korean-level-one-10',
      course_key = 'korean-level-one',
      chapter_number = 10,
      title = '第 10 章测试：现在几点？',
      korean_title = '제10과 평가: 지금 몇 시예요?',
      description = '检查准确时刻、时间范围、连续动作、未来计划，以及一日日程的听读理解和组织。',
      duration_minutes = 12,
      passing_score = 60,
      skills = '{"recognition":"时间与日程词汇","structure":"时刻、范围、动作链与计划形","reading":"对话、听力与日程消息理解","assembly":"完整一日日程组织"}'::jsonb,
      version = 1,
      status = 'draft',
      student_app_id = '10000000-0000-4000-8000-000000000001'::uuid,
      updated_at = now()
    where id = test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id = test_uuid;
  insert into public.chapter_test_questions (
    test_id, question_key, prompt, options, correct_option, explanation, skill,
    sort_order, question_type, default_points, difficulty, tags, status, version,
    is_chapter_test_item, ebook_section_step, ebook_page_reference
  ) values
    (test_uuid,'golden-10-01','“쯤”在时间表达中是什么意思？','["左右、大约","从……开始","到……为止","半点"]',0,'쯤表示大约时间，例如한 시 반쯤。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-10-02','“下午3点20分”的正确韩语形式是哪一项？','["오후 세 시 이십 분","오후 삼 시 이십 분","오후 세 분 이십 시","오후 셋 시 이십 분"]',0,'普通钟点小时用固有词세，分钟用汉字词이십。','structure',2,'single_choice',10,'foundation','["时间表达","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-10-03','哪一句正确表示“从9点到11点”？','["아홉 시부터 열한 시까지","아홉 시까지 열한 시부터","아홉 시에서 열한 시부터","아홉 시를 열한 시까지"]',0,'起点后接부터，终点后接까지。','structure',3,'single_choice',10,'foundation','["부터까지","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-10-04','哪一句表示“先去图书馆，再在那里学习”？','["도서관에 가서 공부해요.","도서관에 가아서 공부해요.","도서관을 가서 공부예요.","도서관에 공부해서 가요."]',0,'가다接-아서形成가서，表示到达后紧接下一动作。','structure',4,'single_choice',10,'foundation','["动作链","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-10-05','“먹다”的未来计划形是哪一项？','["먹을 거예요","먹을거예요","먹ㄹ 거예요","먹어서 거예요"]',0,'有收音词干接-을 거예요，并在거예요前空格。','structure',5,'single_choice',10,'foundation','["未来计划","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-10-06','主场景中，智秀课后先做什么？','["去食堂吃午饭","去宿舍休息","去公园运动","去咖啡馆见老师"]',0,'主对话第6轮说식당에 가서 점심을 먹을 거예요。','reading',6,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-10-07','主场景中，民秀晚上有什么计划？','["六点见朋友并一起吃晚饭","两点去图书馆做作业","七点起床","九点到十一点运动"]',0,'主对话第8轮说明六点见朋友并一起吃晚饭。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-10-08','私有听力中，서연几点到几点在图书馆学习？','["下午两点到四点","上午九点到十一点","上午十一点半到下午一点","下午一点到三点"]',0,'听力最后一句直接给出오후 두 시부터 네 시까지。','reading',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-10-09','阅读消息中的韩语课是几点到几点？','["上午九点到十一点","上午七点到九点","下午一点到三点","晚上十点到十一点"]',0,'阅读正文第3行给出오전 아홉 시부터 열한 시까지。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-10-10','阅读消息中，下午一点半要做什么？','["在图书馆做作业","在宿舍休息","和朋友吃午饭","在公园运动"]',0,'阅读正文第5行明确说在图书馆做作业。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-10-11','组织一日日程时，哪一顺序最清楚？','["开始时间→上午→起止范围→动作链→下午→晚间","晚间→范围终点→上午→开始时间","只列活动，不说时间","先说答案，再问现在几点"]',0,'母本最终输出按一天的时间推进，并包含范围和动作链。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-10-12','课末一日日程说明必须满足哪一项？','["45—60秒、6—8句并覆盖七类信息","只说上午安排即可","必须获得自动发音分数","复制阅读范文即可"]',0,'母本要求45—60秒、6—8句、七类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid
  from public.digital_textbook_chapters
  where version_id = version_uuid and (chapter_number = 10 or slug = 'time-schedule')
  order by (slug = 'time-schedule') desc
  limit 1;

  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id, chapter_test_id, slug, chapter_number, title, scenario, goal, status,
      production_status, editorial_status, native_review_status, audio_status, image_status, source_revision
    ) values (
      version_uuid, test_uuid, 'time-schedule', 10,
      '{"zh-CN":"现在几点？","ko-KR":"지금 몇 시예요?"}',
      '{"zh-CN":"智秀和民秀在校园休息区确认当前时刻、课程范围和课后安排；尤娜与丹尼尔在宿舍整理次日日程。","ko-KR":"지수와 민수는 학교 휴게실에서 현재 시각, 수업 시간과 이후 일정을 확인하고 유나와 다니엘은 기숙사에서 다음 날 일정을 정리합니다."}',
      '{"zh-CN":"准确说出时刻与范围，用-아서/어서连接动作，并用-(으)ㄹ 거예요完成45—60秒、6—8句的一日日程说明。","ko-KR":"정확한 시각과 범위를 말하고 -아서/어서와 -(으)ㄹ 거예요를 사용하여 45~60초, 6~8문장으로 하루 일정을 설명합니다."}',
      'draft', 'editorial_review', 'pending', 'pending', 'pending', 'pending',
      'UPLY BOOK 第10课 지금 몇 시예요.md @ 2026-08-18 / sha256:728b1bc4799854cdb33b0ba2ccdfb3b4b76316c7390473d98f8d5e2649fddfe1'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id = test_uuid,
      slug = 'time-schedule',
      chapter_number = 10,
      title = '{"zh-CN":"现在几点？","ko-KR":"지금 몇 시예요?"}',
      scenario = '{"zh-CN":"智秀和民秀在校园休息区确认当前时刻、课程范围和课后安排；尤娜与丹尼尔在宿舍整理次日日程。","ko-KR":"지수와 민수는 학교 휴게실에서 현재 시각, 수업 시간과 이후 일정을 확인하고 유나와 다니엘은 기숙사에서 다음 날 일정을 정리합니다."}',
      goal = '{"zh-CN":"准确说出时刻与范围，用-아서/어서连接动作，并用-(으)ㄹ 거예요完成45—60秒、6—8句的一日日程说明。","ko-KR":"정확한 시각과 범위를 말하고 -아서/어서와 -(으)ㄹ 거예요를 사용하여 45~60초, 6~8문장으로 하루 일정을 설명합니다."}',
      status = 'draft',
      production_status = 'editorial_review',
      editorial_status = 'pending',
      native_review_status = 'pending',
      audio_status = 'pending',
      image_status = 'pending',
      source_revision = 'UPLY BOOK 第10课 지금 몇 시예요.md @ 2026-08-18 / sha256:728b1bc4799854cdb33b0ba2ccdfb3b4b76316c7390473d98f8d5e2649fddfe1',
      updated_at = now()
    where id = chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"时间说清楚，计划才不会错位","ko-KR":"시간을 정확히 말해야 일정이 어긋나지 않아요"},"content":{"lead":{"zh-CN":"从当前时刻、课程范围到课后行动，先建立完整一日日程的交流目标。","ko-KR":"현재 시각과 수업 범위부터 이후 행동까지 하루 일정의 의사소통 목표를 세웁니다."},"scene":{"people":"智秀、民秀","place":"周一上午校园休息区","purpose":"确认十点课程和午后、晚间安排","imageStatus":"pending"},"targets":[{"ko":"지금 몇 시예요?","zh":"询问当前时刻"},{"ko":"몇 시부터 몇 시까지예요?","zh":"询问时间范围"},{"ko":"그 후에는 뭐 할 거예요?","zh":"询问下一项计划"}],"finalOutput":{"zh-CN":"45—60秒、6—8句，覆盖上午、下午、晚间并包含范围、动作链和至少三次计划形。","ko-KR":"오전, 오후와 저녁, 시간 범위, 행동 연결과 계획형 세 번 이상을 포함한 45~60초, 6~8문장입니다."},"coach":{"zh-CN":"答对不计分的场景诊断即完成；复述最终任务为自主展示。","ko-KR":"점수 없는 상황 진단 정답만 필수이며 최종 과제 설명은 자율 활동입니다."},"nextNode":"time-and-schedule-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"node":"time-and-schedule-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"把时段、地点和动作配成日程","ko-KR":"시간대, 장소와 행동을 일정으로 연결하기"},"content":{"lead":{"zh-CN":"按看钟面、听原形、跟读搭配、放入日程的顺序学习；22词音频全部待制作。","ko-KR":"시계를 보고 기본형과 결합을 들은 뒤 일정 문장에 넣습니다. 22개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"지금","zh":"现在","pos":"副词","collocation":"지금 몇 시예요?"},{"ko":"몇","zh":"几、多少","pos":"冠形词","collocation":"몇 시／몇 분"},{"ko":"오전","zh":"上午","pos":"名词","collocation":"오전 아홉 시"},{"ko":"오후","zh":"下午","pos":"名词","collocation":"오후 세 시 이십 분"},{"ko":"아침","zh":"早晨；早饭","pos":"名词","collocation":"아침을 먹다"},{"ko":"점심","zh":"午饭；中午","pos":"名词","collocation":"점심을 먹다"},{"ko":"저녁","zh":"晚上；晚饭","pos":"名词","collocation":"저녁을 먹다"},{"ko":"밤","zh":"夜里","pos":"名词","collocation":"밤 열 시"},{"ko":"시","zh":"点、时","pos":"依存名词","collocation":"아홉 시"},{"ko":"분","zh":"分钟","pos":"依存名词","collocation":"이십 분"},{"ko":"반","zh":"半、半点","pos":"名词","collocation":"아홉 시 반"},{"ko":"쯤","zh":"左右、大约","pos":"辅助词","collocation":"한 시 반쯤"},{"ko":"일정","zh":"日程","pos":"名词","collocation":"내일 일정"},{"ko":"수업","zh":"课、课程","pos":"名词","collocation":"수업이 시작하다／끝나다"},{"ko":"숙제","zh":"作业","pos":"名词","collocation":"숙제를 하다"},{"ko":"도서관","zh":"图书馆","pos":"名词","collocation":"도서관에서 공부하다"},{"ko":"식당","zh":"食堂、餐厅","pos":"名词","collocation":"식당에 가다"},{"ko":"후","zh":"以后、之后","pos":"名词","collocation":"수업 후에"},{"ko":"시작하다","zh":"开始","pos":"动词","collocation":"수업이 시작해요"},{"ko":"끝나다","zh":"结束","pos":"动词","collocation":"수업이 끝나요"},{"ko":"일어나다","zh":"起床","pos":"动词","collocation":"일곱 시에 일어나다"},{"ko":"운동하다","zh":"运动","pos":"动词","collocation":"오전에 운동하다"}],"studyFlow":["看钟面认时刻","听原形","跟读常用搭配","组成三个日程句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；点读、图片快说与另说搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"time-range-and-plan"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":18,"node":"time-range-and-plan","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"从一个时刻扩展到整天计划","ko-KR":"한 시각에서 하루 계획으로 넓히기"},"content":{"lead":{"zh-CN":"四个工具依次表达准确时刻、起止范围、紧密动作链和未来计划。","ko-KR":"정확한 시각, 시작과 끝, 밀접한 행동 연결과 미래 계획을 네 도구로 표현합니다."},"grammarCards":[{"form":"精确时间表达","function":{"zh-CN":"小时用固有词，分钟用汉字词。","ko-KR":"시는 고유어 수, 분은 한자어 수로 말합니다."},"rules":["一至四在시前用한／두／세／네","分钟使用십／이십／삼십等","30分可说반","单位与数字分写"],"examples":[{"ko":"지금 오후 세 시 이십 분이에요.","zh":"现在下午三点二十分。","audioId":"chapter-10-grammar-01-example-01","audioStatus":"pending"},{"ko":"지금 아홉 시 반이에요. 수업은 열 시에 시작해요.","zh":"现在九点半。课十点开始。","audioId":"chapter-10-grammar-01-example-02","audioStatus":"pending"},{"ko":"오전 일곱 시에 일어날 거예요.","zh":"上午七点要起床。","audioId":"chapter-10-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"3点说세 시，不说삼 시。","ko-KR":"보통 시각의 3시는 삼 시가 아니라 세 시입니다."},"comparison":{"zh-CN":"세 시 이십 분是准确时刻；세 시쯤是大约时刻。","ko-KR":"세 시 이십 분은 정확한 시각, 세 시쯤은 대략적인 시각입니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"N부터 N까지","function":{"zh-CN":"说明时间起点与终点。","ko-KR":"시간의 시작과 끝을 말합니다."},"rules":["起点后接부터","终点后接까지","助词紧跟时间表达","本课只训练时间范围"],"examples":[{"ko":"수업은 오전 열 시부터 열두 시까지예요.","zh":"课从上午十点到十二点。","audioId":"chapter-10-grammar-02-example-01","audioStatus":"pending"},{"ko":"오전 열 시부터 열두 시까지예요.","zh":"从上午十点到十二点。","audioId":"chapter-10-grammar-02-example-02","audioStatus":"pending"},{"ko":"오전 아홉 시부터 열한 시까지 한국어 수업이 있어요.","zh":"上午九点到十一点有韩语课。","audioId":"chapter-10-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"不要颠倒부터与까지。","ko-KR":"부터와 까지의 순서를 바꾸지 않습니다."},"comparison":{"zh-CN":"열 시에只指出时点；열 시부터 열두 시까지给出范围。","ko-KR":"열 시에는 한 시점, 열 시부터 열두 시까지는 범위를 나타냅니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-아서/어서","function":{"zh-CN":"连接到达地点或见人后紧接的动作。","ko-KR":"장소에 가거나 사람을 만난 뒤 바로 이어지는 행동을 연결합니다."},"rules":["ㅏ／ㅗ后接-아서","其他元音接-어서","하다变해서","本课不训练原因用法"],"examples":[{"ko":"도서관에 가서 숙제할 거예요.","zh":"要去图书馆做作业。","audioId":"chapter-10-grammar-03-example-01","audioStatus":"pending"},{"ko":"식당에 가서 점심을 먹을 거예요.","zh":"要去食堂吃午饭。","audioId":"chapter-10-grammar-03-example-02","audioStatus":"pending"},{"ko":"수업 후에는 친구를 만나서 학생 식당에서 점심을 먹을 거예요.","zh":"下课后要见朋友并在学生食堂吃午饭。","audioId":"chapter-10-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"가다形成가서，不写가아서。","ko-KR":"가다는 가아서가 아니라 가서가 됩니다."},"comparison":{"zh-CN":"-고罗列动作；-아서/어서强调紧密先后。","ko-KR":"-고는 나열, -아서/어서는 밀접한 순서를 나타냅니다."},"source":{"zh-CN":"母本§5.3；只用动作链，不提前讲第12课原因用法。","ko-KR":"원고 §5.3; 이번 과에서는 행동 연결만 다룹니다."}},{"form":"V-(으)ㄹ 거예요","function":{"zh-CN":"表达说话人的未来计划。","ko-KR":"말하는 사람의 미래 계획을 나타냅니다."},"rules":["有收音接-을 거예요","无收音接-ㄹ 거예요","ㄹ收音直接接거예요","거예요前必须空格"],"examples":[{"ko":"내일 친구를 만날 거예요.","zh":"明天要见朋友。","audioId":"chapter-10-grammar-04-example-01","audioStatus":"pending"},{"ko":"저는 여섯 시에 친구를 만나서 같이 저녁을 먹을 거예요.","zh":"我六点要见朋友并一起吃晚饭。","audioId":"chapter-10-grammar-04-example-02","audioStatus":"pending"},{"ko":"오후 한 시 반에 도서관에서 숙제할 거예요.","zh":"下午一点半要在图书馆做作业。","audioId":"chapter-10-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写만날 거예요，不写만날거예요。","ko-KR":"만날거예요가 아니라 만날 거예요로 띄어 씁니다."},"comparison":{"zh-CN":"课程表事实可用시작해요；个人未来计划用공부할 거예요。","ko-KR":"시간표 사실은 시작해요, 개인 계획은 공부할 거예요로 말할 수 있습니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"六项填空全部正确才完成；规则口述与扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"daily-plan-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":12,"node":"daily-plan-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让问答自然推进到下一项安排","ko-KR":"문답을 다음 일정으로 자연스럽게 잇기"},"content":{"lead":{"zh-CN":"替换准确时刻、时间范围和动作计划，再依问答与回指排列六个完整话轮。","ko-KR":"정확한 시각, 시간 범위와 행동 계획을 바꾼 뒤 문답과 지시 관계에 따라 여섯 말차례를 배열합니다."},"replacementSets":[["지금 아홉 시 반이에요.","오전 여덟 시 십 분이에요.","오후 세 시 이십 분이에요.","밤 열 시예요."],["수업은 열 시부터 열두 시까지예요.","운동은 아홉 시부터 열한 시까지예요.","공부는 두 시부터 네 시까지예요."],["식당에 가서 점심을 먹을 거예요.","도서관에 가서 숙제할 거예요.","친구를 만나서 같이 저녁을 먹을 거예요."]],"orderItems":["도서관에 가서 공부할 거예요.","지금 몇 시예요?","열두 시에 끝나요. 그 후에는 뭐 할 거예요?","아홉 시 반이에요. 그런데 왜요?","그럼 방금 말한 그 수업은 몇 시에 끝나요?","열 시에 수업이 시작해요."],"personalFrames":["一个带分钟或半点的时刻","一个起止范围","一个含动作链和未来计划的句子"],"coach":{"zh-CN":"六个话轮排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례 배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"campus-schedule-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":13,"node":"campus-schedule-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"听懂对方一天在哪里、做什么","ko-KR":"상대가 하루 동안 어디에서 무엇을 하는지 이해하기"},"content":{"lead":{"zh-CN":"主场景确认今天课程与课后安排，第二场景整理明日起床、运动和学习计划；音频全部待制作。","ko-KR":"첫 장면은 오늘 수업과 이후 일정, 두 번째 장면은 내일 기상, 운동과 공부 계획을 확인합니다. 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":{"zh-CN":"校园休息区课前确认日程","ko-KR":"학교 휴게실에서 수업 전 일정 확인"},"people":{"zh-CN":"智秀与民秀，同班同龄朋友","ko-KR":"지수와 민수, 같은 반 또래 친구"},"place":{"zh-CN":"周一上午校园休息区","ko-KR":"월요일 오전 학교 휴게실"},"purpose":{"zh-CN":"确认当前时刻、课程范围和课后／晚间计划。","ko-KR":"현재 시각, 수업 범위와 이후 계획을 확인합니다."},"audioId":"chapter-10-dialogue-main","audioStatus":"pending","lines":[{"speaker":"민수","ko":"지수 씨, 지금 몇 시예요?","zh":"智秀，现在几点？"},{"speaker":"지수","ko":"지금 아홉 시 반이에요. 수업은 열 시에 시작해요.","zh":"现在九点半。课十点开始。"},{"speaker":"민수","ko":"오늘 수업은 몇 시부터 몇 시까지예요?","zh":"今天的课从几点到几点？"},{"speaker":"지수","ko":"오전 열 시부터 열두 시까지예요.","zh":"从上午十点到十二点。"},{"speaker":"민수","ko":"수업 후에 뭐 할 거예요?","zh":"下课后打算做什么？"},{"speaker":"지수","ko":"식당에 가서 점심을 먹을 거예요. 그리고 두 시부터 네 시까지 도서관에서 숙제할 거예요.","zh":"要去食堂吃午饭。然后两点到四点要在图书馆做作业。"},{"speaker":"지수","ko":"민수 씨는 저녁에 뭐 할 거예요?","zh":"敏秀晚上打算做什么？"},{"speaker":"민수","ko":"저는 여섯 시에 친구를 만나서 같이 저녁을 먹을 거예요.","zh":"我六点要见朋友，然后一起吃晚饭。"}]},{"title":{"zh-CN":"学生宿舍查看次日日程","ko-KR":"기숙사에서 다음 날 일정 확인"},"people":{"zh-CN":"尤娜与丹尼尔，同龄室友","ko-KR":"유나와 다니엘, 또래 룸메이트"},"place":{"zh-CN":"晚间学生宿舍公共区","ko-KR":"저녁 기숙사 공용 공간"},"purpose":{"zh-CN":"确认明日起床、运动和下午学习安排。","ko-KR":"내일 기상, 운동과 오후 공부 일정을 확인합니다."},"audioId":"chapter-10-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"유나","ko":"다니엘 씨, 내일 몇 시에 일어날 거예요?","zh":"丹尼尔，明天几点起床？"},{"speaker":"다니엘","ko":"오전 일곱 시에 일어날 거예요.","zh":"上午七点要起床。"},{"speaker":"유나","ko":"오전에는 무슨 일정이 있어요?","zh":"上午有什么安排？"},{"speaker":"다니엘","ko":"아홉 시부터 열한 시까지 운동할 거예요.","zh":"九点到十一点要运动。"},{"speaker":"유나","ko":"오후에는 뭐 할 거예요?","zh":"下午打算做什么？"},{"speaker":"다니엘","ko":"한 시 반쯤 카페에 가서 한국어를 공부할 거예요.","zh":"一点半左右要去咖啡馆学韩语。"}]}],"coach":{"zh-CN":"事实组合题和课后计划回应题都答对才完成；替换与双角色试录为自主练习。","ko-KR":"사실 문제와 수업 후 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-plan-day"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":15,"node":"listen-and-plan-day","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听出时间范围，说出完整的一天","ko-KR":"시간 범위를 듣고 완전한 하루 말하기"},"content":{"lead":{"zh-CN":"学生端只显示待制作音频、问题和选项；脚本、答案、停顿与对象键仅保存在服务端。","ko-KR":"학생 화면에는 제작 대기 음원, 질문과 선택지만 보이며 원고, 정답, 쉼과 객체 키는 서버에만 있습니다."},"listening":{"audioId":"chapter-10-listening-library-time","audioStatus":"pending","question":{"zh-CN":"서연几点到几点在图书馆学习？","ko-KR":"서연은 몇 시부터 몇 시까지 도서관에서 공부할 거예요?"}},"speakingTask":{"duration":"45—60秒","targetSeconds":52,"minimumSentences":6,"maximumSentences":8,"requiredInformation":["起床或开始时间","上午安排","至少一个起止范围","一次紧密动作链","下午安排","晚间安排","至少三次计划形"],"pronunciationScore":false},"coach":{"zh-CN":"音频可播放后听辨正确，并提交满足时长、句数和七类信息的录音才完成；录音不产生分数。","ko-KR":"음원 재생과 듣기 정답, 시간, 문장 수와 일곱 정보의 녹음을 모두 갖추며 녹음에는 점수가 없습니다."},"nextNode":"tomorrow-schedule-note"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":14,"node":"tomorrow-schedule-note","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读日程消息，写自己的明日安排","ko-KR":"일정 메시지를 읽고 나의 내일 계획 쓰기"},"content":{"lead":{"zh-CN":"从生活消息找课程范围、见面对象和下午行动，再按同一信息结构写原创日程。","ko-KR":"생활 메시지에서 수업 범위, 만날 사람과 오후 행동을 찾고 같은 정보 구조로 새로운 일정을 씁니다."},"reading":{"title":"내일 일정","text":"오전 일곱 시에 일어날 거예요.\n아침을 먹고 학교에 갈 거예요.\n오전 아홉 시부터 열한 시까지 한국어 수업이 있어요.\n수업 후에는 친구를 만나서 학생 식당에서 점심을 먹을 거예요.\n오후 한 시 반에 도서관에서 숙제할 거예요.\n밤 열 시에는 기숙사에서 쉴 거예요.","questions":["한국어 수업은 몇 시부터 몇 시까지예요?","수업 후에 누구를 만날 거예요?","오후 한 시 반에 무엇을 할 거예요?"]},"writing":{"audience":"语言交换同伴","requirements":["6—8句","起床或开始时间","上午安排","一个起止范围","一次紧密动作链","下午与晚间安排","至少三次计划形","礼貌体一致"],"scaffold":"내일 ___시에 일어날 거예요. → 오전에는 ___. → ___부터 ___까지 ___. → ___에 가서 ___할 거예요. → 오후에는 ___. → 저녁／밤에는 ___.","rubric":["信息完整","核心语法","时间顺序与可理解度","格式与语气"],"example":"내일 오전 여덟 시 십 분에 일어날 거예요. 아침을 먹고 회사에 갈 거예요. 오전 열 시부터 열두 시까지 회의가 있어요. 회의 후에는 식당에 가서 점심을 먹을 거예요. 오후 세 시 이십 분에 카페에서 공부할 거예요. 저녁 일곱 시에는 친구를 만나서 같이 밥을 먹을 거예요. 밤 열한 시에 잘 거예요."},"coach":{"zh-CN":"阅读三题全对，并提交原创6—8句日程与四维量规自查才完成；开放写作不产生分数。","ko-KR":"읽기 세 문제 정답과 새로운 6~8문장 일정, 네 기준 점검이 필요하며 글쓰기는 점수가 없습니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能把一天说得准确、连贯吗？","ko-KR":"하루를 정확하고 자연스럽게 말할 수 있나요?"},"content":{"lead":{"zh-CN":"把问题归为词汇、时间形式、动作连接、理解或表达，再返回对应节点。","ko-KR":"문제를 어휘, 시간 형태, 행동 연결, 이해와 표현으로 나누고 해당 노드로 돌아갑니다."},"canDo":[{"ko":"시와 분을 구분해서 정확한 시각을 말할 수 있어요.","zh":"我能区分小时和分钟，说出准确时刻。"},{"ko":"부터／까지로 일정의 시작과 끝을 말할 수 있어요.","zh":"我能说明日程起止范围。"},{"ko":"-아서/어서로 이어지는 행동을 연결할 수 있어요.","zh":"我能连接紧密的先后动作。"},{"ko":"-(으)ㄹ 거예요로 계획을 말할 수 있어요.","zh":"我能表达未来计划。"},{"ko":"45~60초, 6~8문장으로 하루 계획을 설명할 수 있어요.","zh":"我能用45—60秒、6—8句说明完整的一天。"}],"returnMap":{"词汇":"time-and-schedule-words","语法":"time-range-and-plan","理解":"campus-schedule-talk／listen-and-plan-day","表达":"listen-and-plan-day","读写":"tomorrow-schedule-note"},"completionRule":{"zh-CN":"综合多选正确，五项自查全部回应并记录返回节点或none；八节点全部完成后才解锁章节测试。","ko-KR":"종합 문제 정답, 다섯 점검과 복습 위치를 기록하고 여덟 노드를 모두 마쳐야 평가가 열립니다."},"nextNode":"chapter-test:korean-level-one-10"}}
  ] $modules$::jsonb) loop
    insert into public.digital_textbook_modules (
      chapter_id, module_code, sort_order, accent_role, title, description
    ) values (
      chapter_uuid, item->>'code', (item->>'order')::integer, item->>'accent',
      item->'title', item->'nodeTitle'
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
      module_uuid, item->>'node', item->>'type', 1, (item->>'minutes')::integer,
      item->'nodeTitle', item->'content'
    )
    on conflict (module_id, node_code) do update set
      node_type = excluded.node_type,
      sort_order = 1,
      estimated_minutes = excluded.estimated_minutes,
      title = excluded.title,
      content = excluded.content,
      updated_at = now();
  end loop;

  delete from public.digital_textbook_modules
  where chapter_id = chapter_uuid
    and module_code not in ('orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review');

  for item in select value from jsonb_array_elements($activities$
  [
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"智秀和民秀在上课前想先确认现在的时刻。哪一句最合适？","ko-KR":"지수와 민수는 수업 전에 현재 시각을 먼저 확인하려고 합니다. 가장 알맞은 문장은 무엇이에요?"},"instruction":{"zh-CN":"选择能够直接询问“现在几点”的一句；本题不计分。","ko-KR":"‘지금 몇 시인지’를 직접 묻는 문장을 하나 고르세요. 점수에는 포함되지 않습니다."},"options":["지금 몇 시예요?","어디에서 공부해요?","날씨가 어때요?","얼마예요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"지금 몇 시예요?直接询问当前时刻；本题不产生章节测试分数。","ko-KR":"지금 몇 시예요?는 현재 시각을 직접 묻습니다."},"feedback":[{"zh-CN":"先找同时出现“现在”和“几点”的句子。","ko-KR":"‘지금’과 ‘몇 시’가 함께 있는 문장을 찾으세요."},{"zh-CN":"排除询问地点、天气和价格的表达。","ko-KR":"장소, 날씨와 가격을 묻는 표현을 빼세요."},{"zh-CN":"应选择지금 몇 시예요?，意思是“现在几点？”","ko-KR":"정답은 지금 몇 시예요?입니다."}]}},
    {"node":"time-and-schedule-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在오후 한 시 반쯤 도서관에 갈 거예요.中，쯤表示什么意思？","ko-KR":"오후 한 시 반쯤 도서관에 갈 거예요.에서 쯤은 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择쯤在句中的意思，再朗读整句并勾选确认。","ko-KR":"쯤의 뜻을 고른 뒤 문장 전체를 읽고 확인하세요."},"options":["准确在一点半","一点半左右","从一点半开始","到一点半为止"],"config":{"shuffle":true,"audioStatus":"pending","readAloudConfirmation":{"label":"已朗读整句","required":true}},"answer":{"kind":"index_confirmation","value":1},"explanation":{"correct":{"zh-CN":"쯤表示大约，整句是“下午一点半左右要去图书馆”。","ko-KR":"쯤은 대략적인 시각을 나타냅니다."},"feedback":[{"zh-CN":"先判断这是精确时刻还是近似时刻。","ko-KR":"정확한 시각인지 대략적인 시각인지 보세요."},{"zh-CN":"부터标开始，까지标结束；쯤不标范围两端。","ko-KR":"부터는 시작, 까지는 끝이며 쯤은 범위의 끝을 표시하지 않습니다."},{"zh-CN":"答案是“一点半左右”。","ko-KR":"정답은 ‘한 시 반 정도’입니다."}]}},
    {"node":"time-range-and-plan","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成六小题，检查准确时刻、时间范围、紧密动作链和未来计划形式。","ko-KR":"정확한 시각, 시간 범위, 행동 연결과 미래 계획 표현을 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"按每题公开功能填写目标形式，保留韩语必要空格。","ko-KR":"각 문항의 기능에 맞는 형태를 쓰고 필요한 띄어쓰기를 지키세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"f1","label":"下午3:20（写韩语时间短语）→ ___","placeholder":"请输入答案"},{"id":"f2","label":"수업은 아홉 시___ 열한 시까지예요.（起点助词）","placeholder":"请输入答案"},{"id":"f3","label":"수업은 아홉 시부터 열한 시___예요.（终点助词）","placeholder":"请输入答案"},{"id":"f4","label":"식당에 가다 → 식당에 ___ 점심을 먹어요.（紧密动作链）","placeholder":"请输入答案"},{"id":"f5","label":"먹다 → ___（未来计划形式）","placeholder":"请输入答案"},{"id":"f6","label":"가다 → ___（未来计划形式）","placeholder":"请输入答案"}]},"answer":{"kind":"text_array","value":["오후 세 시 이십 분","부터","까지","가서","먹을 거예요","갈 거예요"]},"explanation":{"correct":{"zh-CN":"六项形式全部正确，内部拼写与必要空格均保留。","ko-KR":"여섯 형태와 필요한 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先标记时刻、起点、终点、动作链或计划。","ko-KR":"시각, 시작, 끝, 행동 연결이나 계획 기능을 먼저 표시하세요."},{"zh-CN":"检查小时数字、范围两端、가다连接形和거예요前空格。","ko-KR":"시의 수, 범위 양끝, 가다 연결형과 거예요 앞 띄어쓰기를 확인하세요."},{"zh-CN":"依次为오후 세 시 이십 분、부터、까지、가서、먹을 거예요、갈 거예요。","ko-KR":"차례대로 오후 세 시 이십 분, 부터, 까지, 가서, 먹을 거예요, 갈 거예요입니다."}]}},
    {"node":"daily-plan-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成自然的课前日程对话。","ko-KR":"수업 전 일정 대화의 완전한 말차례 여섯 개를 자연스럽게 배열하세요."},"instruction":{"zh-CN":"只根据问答、承接词与前后语义移动；卡片没有角色或步骤提示。","ko-KR":"질문과 대답, 연결 표현과 의미만 보고 옮기세요."},"options":["도서관에 가서 공부할 거예요.","지금 몇 시예요?","열두 시에 끝나요. 그 후에는 뭐 할 거예요?","아홉 시 반이에요. 그런데 왜요?","그럼 방금 말한 그 수업은 몇 시에 끝나요?","열 시에 수업이 시작해요."],"config":{"shuffle":true},"answer":{"kind":"order","value":[1,3,5,4,2,0]},"explanation":{"correct":{"zh-CN":"问当前时间、说明十点开课、追问结束时间，再询问并回答课后安排，衔接完整。","ko-KR":"현재 시각, 수업 시작과 끝, 이후 계획의 문답이 자연스럽게 이어집니다."},"feedback":[{"zh-CN":"先让每个问句紧跟直接回答它的话轮。","ko-KR":"각 질문 뒤에 직접 답하는 말차례를 놓으세요."},{"zh-CN":"왜요?后说明理由；방금 말한 그 수업回指刚提到的课程。","ko-KR":"왜요? 뒤에는 이유, 방금 말한 그 수업은 바로 앞 수업을 가리킵니다."},{"zh-CN":"正确顺序是第2、4、6、5、3、1张卡。","ko-KR":"정답 순서는 2, 4, 6, 5, 3, 1번 카드입니다."}]}},
    {"node":"campus-schedule-talk","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"哪一组同时正确概括智秀的课后安排和民秀的晚间安排？","ko-KR":"지수의 수업 후 일정과 민수의 저녁 일정을 모두 바르게 정리한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择“智秀地点／行动＋民秀见的人／行动”的正确组合。","ko-KR":"‘지수의 장소／행동＋민수가 만날 사람／행동’의 맞는 조합을 고르세요."},"options":["식당／점심 식사＋친구／저녁 식사","도서관／운동＋선생님／수업","카페／한국어 공부＋친구／영화","기숙사／휴식＋학생／점심 식사"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"智秀去食堂吃午饭；民秀见朋友并一起吃晚饭。","ko-KR":"지수는 식당에서 점심을 먹고 민수는 친구와 저녁을 먹습니다."},"feedback":[{"zh-CN":"分别圈出主对话第6轮的地点／行动和第8轮的人物／行动。","ko-KR":"6턴의 장소와 행동, 8턴의 사람과 행동을 찾으세요."},{"zh-CN":"智秀先吃午饭；民秀见的是朋友。","ko-KR":"지수는 점심을 먹고 민수는 친구를 만납니다."},{"zh-CN":"正确组合是“食堂／午饭＋朋友／晚饭”。","ko-KR":"정답은 식당／점심＋친구／저녁입니다."}]}},
    {"node":"campus-schedule-talk","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"同学问수업 후에 뭐 할 거예요?，哪一句能完整回答课后地点与行动？","ko-KR":"수업 후에 뭐 할 거예요?에 장소와 행동을 모두 답하는 문장은 무엇이에요?"},"instruction":{"zh-CN":"选择同时包含课后去向和要做之事的一句。","ko-KR":"수업 후에 갈 곳과 할 일을 모두 포함한 문장을 고르세요."},"options":["식당에 가서 점심을 먹을 거예요.","지금 아홉 시 반이에요.","수업은 열 시부터예요.","몇 시예요?"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句同时给出食堂和吃午饭的课后计划。","ko-KR":"식당이라는 장소와 점심 식사 행동을 함께 답합니다."},"feedback":[{"zh-CN":"先排除只说当前时刻或课程时间的句子。","ko-KR":"현재 시각이나 수업 시간만 말하는 문장을 빼세요."},{"zh-CN":"答案需要同时出现地点与课后动作。","ko-KR":"장소와 수업 후 행동이 모두 필요합니다."},{"zh-CN":"应选择식당에 가서 점심을 먹을 거예요。","ko-KR":"정답은 식당에 가서 점심을 먹을 거예요입니다."}]}},
    {"node":"listen-and-plan-day","sort":1,"key":"listening-library-time","type":"listening","prompt":{"zh-CN":"听个人日程语音，判断서연几点到几点在图书馆学习。","ko-KR":"개인 일정 음성을 듣고 서연이 몇 시부터 몇 시까지 도서관에서 공부하는지 고르세요."},"instruction":{"zh-CN":"正常语速最多两遍，慢速最多一遍；只依据音频中的图书馆学习句作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 도서관 공부 문장에 근거해 답하세요."},"options":["오전 아홉 시부터 열한 시까지","오전 열한 시 반부터 오후 한 시까지","오후 한 시부터 세 시까지","오후 두 시부터 네 시까지"],"config":{"shuffle":true,"audioId":"chapter-10-listening-library-time","audioStatus":"pending","normalPlays":2,"slowPlays":1},"answer":{"kind":"index","value":3},"transcript":"안녕하세요? 저는 서연이에요. 내일 오전 일곱 시 반에 일어날 거예요. 아홉 시부터 열한 시까지 수업이 있어요. 수업 후에는 식당에 가서 점심을 먹을 거예요. 오후 두 시부터 네 시까지 도서관에서 공부할 거예요.","audioObjectKey":"korean-level-one/chapter-10/listening/chapter-10-listening-library-time.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是오후 두 시부터 네 시까지，原文最后一句直接给出该范围。","ko-KR":"정답은 오후 두 시부터 네 시까지이며 마지막 문장에 나옵니다."},"feedback":[{"zh-CN":"再听带도서관에서 공부할 거예요的句子。","ko-KR":"도서관에서 공부할 거예요가 있는 문장을 다시 들으세요."},{"zh-CN":"目标在最后一句，留意오후、부터和까지。","ko-KR":"마지막 문장의 오후, 부터와 까지를 들으세요."},{"zh-CN":"答案是下午两点到四点。","ko-KR":"정답은 오후 두 시부터 네 시까지입니다."}],"privateListening":{"normalAudioId":"chapter-10-listening-library-time-normal","normalAudioObjectKey":"korean-level-one/chapter-10/listening/chapter-10-listening-library-time-normal.mp3","normalScript":"안녕하세요? 저는 서연이에요. 내일 오전 일곱 시 반에 일어날 거예요. 아홉 시부터 열한 시까지 수업이 있어요. 수업 후에는 식당에 가서 점심을 먹을 거예요. 오후 두 시부터 네 시까지 도서관에서 공부할 거예요.","slowAudioId":"chapter-10-listening-library-time-slow","slowAudioObjectKey":"korean-level-one/chapter-10/listening/chapter-10-listening-library-time-slow.mp3","slowScript":"안녕하세요? / 저는 서연이에요. / 내일 오전 일곱 시 반에 일어날 거예요. / 아홉 시부터 열한 시까지 수업이 있어요. / 수업 후에는 식당에 가서 점심을 먹을 거예요. / 오후 두 시부터 네 시까지 도서관에서 공부할 거예요.","pauseMarks":"안녕하세요? ⏸ 저는 서연이에요. ⏸ 내일 오전 일곱 시 반에 일어날 거예요. ⏸ 아홉 시부터 열한 시까지 수업이 있어요. ⏸ 수업 후에는 식당에 가서 점심을 먹을 거예요. ⏸ 오후 두 시부터 네 시까지 도서관에서 공부할 거예요.","speaker":"F03／서연；第一人称日程说明","distractorReasons":["九点到十一点是上课时间。","原文没有十一点半到一点。","原文没有一点到三点。"]}}},
    {"node":"listen-and-plan-day","sort":2,"key":"speaking-daily-plan","type":"speaking","prompt":{"zh-CN":"录制45—60秒、6—8句的一日日程说明。","ko-KR":"45~60초 동안 6~8문장으로 하루 일정을 설명하세요."},"instruction":{"zh-CN":"加入起床／开始时间、上午、一个起止范围、一次紧密动作链、下午、晚间和至少三次计划形。","ko-KR":"기상 시각, 오전, 시간 범위, 행동 연결, 오후, 저녁과 계획형 세 번 이상을 넣으세요."},"options":[],"config":{"minimumSeconds":45,"maximumSeconds":60,"targetSeconds":52,"minimumTurns":6,"maximumTurns":8,"requiredCriteria":7,"criteria":["起床或开始一天的时间","上午安排","至少一个起止范围","一次-아서/어서动作链","下午安排","晚间安排","至少三次-(으)ㄹ 거예요"],"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足时长、句数和七类信息的录音；不产生正确性或分数。","ko-KR":"시간, 문장 수와 일곱 정보를 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先检查6—8句并覆盖上午、下午、晚间。","ko-KR":"6~8문장과 오전, 오후, 저녁을 먼저 확인하세요."},{"zh-CN":"再检查时间范围、动作链和至少三次计划形。","ko-KR":"시간 범위, 행동 연결과 계획형 세 번 이상을 확인하세요."},{"zh-CN":"按句框补齐缺项后重录；系统不显示虚假发音准确率。","ko-KR":"틀에 따라 빠진 부분을 보완해 다시 녹음하며 발음 점수를 표시하지 않습니다."}]}},
    {"node":"tomorrow-schedule-note","sort":1,"key":"reading-schedule-note","type":"single_choice","prompt":{"zh-CN":"阅读明日日程消息，完成课程范围、见面对象和下午行动三题。","ko-KR":"내일 일정 메시지를 읽고 수업 범위, 만날 사람과 오후 행동 세 문제에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；答案均可从公开消息直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 메시지에서 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"내일 일정\n오전 일곱 시에 일어날 거예요.\n아침을 먹고 학교에 갈 거예요.\n오전 아홉 시부터 열한 시까지 한국어 수업이 있어요.\n수업 후에는 친구를 만나서 학생 식당에서 점심을 먹을 거예요.\n오후 한 시 반에 도서관에서 숙제할 거예요.\n밤 열 시에는 기숙사에서 쉴 거예요.","items":[{"id":"q1","question":"한국어 수업은 몇 시부터 몇 시까지예요?","options":["오전 일곱 시부터 아홉 시까지","오전 아홉 시부터 열한 시까지","오후 한 시부터 세 시까지","밤 열 시부터 열한 시까지"]},{"id":"q2","question":"수업 후에 누구를 만날 거예요?","options":["선생님","지수","친구","룸메이트"]},{"id":"q3","question":"오후 한 시 반에 무엇을 할 거예요?","options":["운동할 거예요","친구를 만날 거예요","도서관에서 숙제할 거예요","기숙사에서 쉴 거예요"]}]},"answer":{"kind":"index_array","value":[1,2,2]},"explanation":{"correct":{"zh-CN":"答案依次是上午九点到十一点、朋友、在图书馆做作业。","ko-KR":"정답은 오전 아홉 시부터 열한 시, 친구, 도서관에서 숙제입니다."},"feedback":[{"zh-CN":"分别找带부터／까지的课程句、만나서前的人物和오후 한 시 반所在句。","ko-KR":"부터／까지 수업 문장, 만나서 앞 사람과 오후 한 시 반 문장을 찾으세요."},{"zh-CN":"不要把起床七点、夜间宿舍或其他场景人物带入。","ko-KR":"기상 시각, 밤의 기숙사나 다른 장면 인물을 섞지 마세요."},{"zh-CN":"依据是消息第3、4、5行。","ko-KR":"근거는 메시지 3, 4, 5번째 줄입니다."}]}},
    {"node":"tomorrow-schedule-note","sort":2,"key":"write-daily-plan","type":"writing","prompt":{"zh-CN":"给语言交换同伴写一则6—8句的原创“明日日程”便条。","ko-KR":"언어 교환 친구에게 새로운 내일 일정 메모를 6~8문장으로 쓰세요."},"instruction":{"zh-CN":"写起床／开始时间、上午、起止范围、动作链、下午、晚间和至少三次计划形，并完成量规自查。","ko-KR":"기상 시각, 오전, 시간 범위, 행동 연결, 오후, 저녁과 계획형 세 번 이상을 쓰고 기준을 점검하세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":60,"minimumInformationKinds":7,"informationChecklist":["起床或开始一天的时间","上午安排","至少一个起止范围","一次-아서/어서动作链","下午安排","晚间安排","至少三次-(으)ㄹ 거예요"],"requiredPhraseGroups":[["오전","아침"],["부터"],["까지"],["가서","만나서"],["오후"],["저녁","밤"],["거예요"]],"minimumPhraseGroups":7,"requireCompletionChecklist":true,"scaffold":"내일 ___시에 일어날 거예요. → 오전에는 ___. → ___부터 ___까지 ___. → ___에 가서 ___할 거예요. → 오후에는 ___. → 저녁／밤에는 ___.","rubric":["信息完整","核心语法","时间顺序与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、规定信息与量规自查的原创日程；不产生正确性或分数。","ko-KR":"문장 수, 필수 정보와 자기 점검을 갖춘 일정을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先数句子，再核对上午、下午、晚间和开始时间。","ko-KR":"문장 수와 오전, 오후, 저녁, 시작 시각을 먼저 확인하세요."},{"zh-CN":"圈出时间范围、动作链和计划形，确认时间不冲突。","ko-KR":"시간 범위, 행동 연결과 계획형을 표시하고 시간이 충돌하지 않는지 보세요."},{"zh-CN":"按支架补齐具体缺项，但不要复制示范。","ko-KR":"틀로 빠진 부분을 보완하되 예시를 베끼지 마세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的句子。","ko-KR":"형태가 맞고 괄호 안의 기능을 바르게 수행하는 문장을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["오후 세 시 이십 분이에요.（说下午3:20）","수업은 아홉 시까지 열한 시부터예요.（说9点到11点）","도서관에 가서 숙제할 거예요.（先去图书馆再做作业）","내일 친구를 만날거예요.（说明明天计划）","저녁 여섯 시부터 일곱 시까지 운동할 거예요.（说明范围和计划）","오후 삼 시예요.（说下午3点）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,2,4]},"explanation":{"correct":{"zh-CN":"第1、3、5句正确；其余分别错在范围顺序、必要空格和小时数字。","ko-KR":"1, 3, 5번이 맞고 나머지는 범위 순서, 띄어쓰기나 시의 수가 틀립니다."},"feedback":[{"zh-CN":"分别检查小时数字、范围两端、动作链和거예요前空格。","ko-KR":"시의 수, 범위 양끝, 행동 연결과 거예요 앞 띄어쓰기를 보세요."},{"zh-CN":"六句中三句正确；错误来自范围顺序、空格和数字系统。","ko-KR":"세 문장이 맞고 오류는 범위 순서, 띄어쓰기와 수 체계입니다."},{"zh-CN":"正确项是第1、3、5句。","ko-KR":"정답은 1, 3, 5번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"time","label":"我能区分小时和分钟，说出准确时刻／시와 분을 구분해 정확한 시각을 말할 수 있어요"},{"id":"range","label":"我能用부터／까지说明日程起止／부터／까지로 일정의 시작과 끝을 말할 수 있어요"},{"id":"chain","label":"我能用-아서/어서连接紧密动作／-아서/어서로 이어지는 행동을 연결할 수 있어요"},{"id":"plan","label":"我能用-(으)ㄹ 거예요表达计划／-(으)ㄹ 거예요로 계획을 말할 수 있어요"},{"id":"day","label":"我能用45—60秒、6—8句说明完整一天／45~60초, 6~8문장으로 하루를 설명할 수 있어요"}],"returnNodes":[{"value":"time-and-schedule-words","label":"词汇"},{"value":"time-range-and-plan","label":"语法"},{"value":"campus-schedule-talk","label":"对话理解"},{"value":"listen-and-plan-day","label":"听说"},{"value":"tomorrow-schedule-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想时刻、范围、动作链、计划形和完整日程。","ko-KR":"시각, 범위, 행동 연결, 계획형과 하루 일정을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid
    from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';
    if node_uuid is null then
      raise exception 'Missing chapter 10 node %', item->>'node';
    end if;

    insert into public.digital_textbook_activities (
      node_id, activity_key, activity_type, sort_order, prompt, instruction,
      options, public_config, max_attempts, counts_toward_completion
    ) values (
      node_uuid, item->>'key', item->>'type', (item->>'sort')::integer,
      item->'prompt', item->'instruction', item->'options', item->'config', 3, true
    )
    on conflict (node_id, activity_key) do update set
      activity_type = excluded.activity_type,
      sort_order = excluded.sort_order,
      prompt = excluded.prompt,
      instruction = excluded.instruction,
      options = excluded.options,
      public_config = excluded.public_config,
      max_attempts = 3,
      counts_toward_completion = true,
      updated_at = now()
    returning id into activity_uuid;

    insert into public.digital_textbook_activity_secrets (
      activity_id, answer_key, explanation, transcript_ko, audio_object_key, audio_status
    ) values (
      activity_uuid, item->'answer', item->'explanation', item->>'transcript',
      item->>'audioObjectKey', coalesce(item->>'audioStatus', 'pending')
    )
    on conflict (activity_id) do update set
      answer_key = excluded.answer_key,
      explanation = excluded.explanation,
      transcript_ko = excluded.transcript_ko,
      audio_object_key = excluded.audio_object_key,
      audio_status = excluded.audio_status,
      updated_at = now();
  end loop;

  delete from public.digital_textbook_activities activity
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where activity.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-library-time',
      'speaking-daily-plan','reading-schedule-note','write-daily-plan',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node, public.digital_textbook_modules module
  where media.node_id = node.id and node.module_id = module.id and module.chapter_id = chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-10-image-01","purpose":"章节情境主图","file":"chapter-10-01-scene.png","path":"../附件/韩国语1级/第10课/第10课-01-章节情境主图.png","alt":"校园休息区电子钟显示九点半，两名成年学生查看十点课程表。","width":1600,"height":900},
    {"node":"time-and-schedule-words","key":"chapter-10-image-02","purpose":"核心词汇时间与日程卡","file":"chapter-10-02-vocabulary.png","path":"../附件/韩国语1级/第10课/第10课-02-核心词汇卡-时间与日程.png","alt":"六时段日程与整点、半点、分钟钟面。","width":1200,"height":900},
    {"node":"time-range-and-plan","key":"chapter-10-image-03","purpose":"时间范围动作计划语法总图","file":"chapter-10-03-grammar-overview.png","path":"../附件/韩国语1级/第10课/第10课-03-语法总图-时间范围动作计划.png","alt":"时刻、范围、动作链和未来计划总流程。","width":1600,"height":900},
    {"node":"time-range-and-plan","key":"chapter-10-image-04","purpose":"精确时间结构图","file":"chapter-10-03a-exact-time.png","path":"../附件/韩国语1级/第10课/第10课-03A-语法结构图-精确时间.png","alt":"小时固有词与分钟汉字词分工。","width":1200,"height":900},
    {"node":"time-range-and-plan","key":"chapter-10-image-05","purpose":"时间范围结构图","file":"chapter-10-03b-time-range.png","path":"../附件/韩国语1级/第10课/第10课-03B-语法结构图-时间范围.png","alt":"时间轴两端分别连接부터和까지。","width":1200,"height":900},
    {"node":"time-range-and-plan","key":"chapter-10-image-06","purpose":"动作链结构图","file":"chapter-10-03c-action-chain.png","path":"../附件/韩国语1级/第10课/第10课-03C-语法结构图-动作链.png","alt":"到达地点或见人后紧接下一动作。","width":1200,"height":900},
    {"node":"time-range-and-plan","key":"chapter-10-image-07","purpose":"未来计划结构图","file":"chapter-10-03d-future-plan.png","path":"../附件/韩国语1级/第10课/第10课-03D-语法结构图-未来计划.png","alt":"词干按收音分流到을或ㄹ 거예요并标空格。","width":1200,"height":900},
    {"node":"daily-plan-builder","key":"chapter-10-image-08","purpose":"句型日程话轮卡","file":"chapter-10-04-pattern-blocks.png","path":"../附件/韩国语1级/第10课/第10课-04-句型日程话轮卡.png","alt":"六张无角色、步骤与位置提示的完整韩语话轮卡。","width":1200,"height":900},
    {"node":"campus-schedule-talk","key":"chapter-10-image-09","purpose":"实战对话双场景图","file":"chapter-10-05-dialogue.png","path":"../附件/韩国语1级/第10课/第10课-05-实战对话场景.png","alt":"校园课前与宿舍次日日程两组人物。","width":1600,"height":900},
    {"node":"listen-and-plan-day","key":"chapter-10-image-10","purpose":"听力时间范围信息图","file":"chapter-10-06-listening.png","path":"../附件/韩国语1级/第10课/第10课-06-听力信息图-时间范围.png","alt":"上午课程、午间食堂与下午图书馆的空白时间轴。","width":1200,"height":900},
    {"node":"tomorrow-schedule-note","key":"chapter-10-image-11","purpose":"明日日程便条版式","file":"chapter-10-07-schedule-note.png","path":"../附件/韩国语1级/第10课/第10课-07-明日日程便条.png","alt":"按上午、下午、晚间分区的手机消息式日程页。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-10-image-12","purpose":"最终日程任务图","file":"chapter-10-08-final-task.png","path":"../附件/韩国语1级/第10课/第10课-08-最终任务图.png","alt":"从起床到晚间的日程时间轴与录音提交回查。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid
    from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id = node.module_id
    where module.chapter_id = chapter_uuid and node.node_code = item->>'node';

    insert into public.digital_textbook_media_assets (
      node_id, asset_key, media_type, purpose, object_key, production_status, alt_text, metadata
    ) values (
      node_uuid, item->>'key', 'image', item->>'purpose',
      'korean-level-one/chapter-10/images/' || (item->>'file'), 'pending',
      jsonb_build_object('zh-CN', item->>'alt', 'ko-KR', '제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'time-and-schedule-words';

  for item in
    select jsonb_build_object('ko',value->>'ko','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"ko":"지금","collocation":"지금 몇 시예요?"},{"ko":"몇","collocation":"몇 시／몇 분"},{"ko":"오전","collocation":"오전 아홉 시"},{"ko":"오후","collocation":"오후 세 시 이십 분"},{"ko":"아침","collocation":"아침을 먹다"},{"ko":"점심","collocation":"점심을 먹다"},{"ko":"저녁","collocation":"저녁을 먹다"},{"ko":"밤","collocation":"밤 열 시"},{"ko":"시","collocation":"아홉 시"},{"ko":"분","collocation":"이십 분"},{"ko":"반","collocation":"아홉 시 반"},{"ko":"쯤","collocation":"한 시 반쯤"},{"ko":"일정","collocation":"내일 일정"},{"ko":"수업","collocation":"수업이 시작하다／끝나다"},{"ko":"숙제","collocation":"숙제를 하다"},{"ko":"도서관","collocation":"도서관에서 공부하다"},{"ko":"식당","collocation":"식당에 가다"},{"ko":"후","collocation":"수업 후에"},{"ko":"시작하다","collocation":"수업이 시작해요"},{"ko":"끝나다","collocation":"수업이 끝나요"},{"ko":"일어나다","collocation":"일곱 시에 일어나다"},{"ko":"운동하다","collocation":"오전에 운동하다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-10-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-10/audio/vocabulary/chapter-10-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-10-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'ko')),
      (node_uuid,'chapter-10-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-10/audio/vocabulary/chapter-10-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-10-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'time-range-and-plan';

  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-10/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-10-grammar-01-example-01","script":"지금 오후 세 시 이십 분이에요."},{"id":"chapter-10-grammar-01-example-02","script":"지금 아홉 시 반이에요. 수업은 열 시에 시작해요."},{"id":"chapter-10-grammar-01-example-03","script":"오전 일곱 시에 일어날 거예요."},
    {"id":"chapter-10-grammar-02-example-01","script":"수업은 오전 열 시부터 열두 시까지예요."},{"id":"chapter-10-grammar-02-example-02","script":"오전 열 시부터 열두 시까지예요."},{"id":"chapter-10-grammar-02-example-03","script":"오전 아홉 시부터 열한 시까지 한국어 수업이 있어요."},
    {"id":"chapter-10-grammar-03-example-01","script":"도서관에 가서 숙제할 거예요."},{"id":"chapter-10-grammar-03-example-02","script":"식당에 가서 점심을 먹을 거예요."},{"id":"chapter-10-grammar-03-example-03","script":"수업 후에는 친구를 만나서 학생 식당에서 점심을 먹을 거예요."},
    {"id":"chapter-10-grammar-04-example-01","script":"내일 친구를 만날 거예요."},{"id":"chapter-10-grammar-04-example-02","script":"저는 여섯 시에 친구를 만나서 같이 저녁을 먹을 거예요."},{"id":"chapter-10-grammar-04-example-03","script":"오후 한 시 반에 도서관에서 숙제할 거예요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  where module.chapter_id = chapter_uuid and node.node_code = 'campus-schedule-talk';

  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-10/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-10-dialogue-main-line-01","purpose":"主对话逐句","script":"지수 씨, 지금 몇 시예요?","speaker":"M01／민수"},{"id":"chapter-10-dialogue-main-line-02","purpose":"主对话逐句","script":"지금 아홉 시 반이에요. 수업은 열 시에 시작해요.","speaker":"F01／지수"},{"id":"chapter-10-dialogue-main-line-03","purpose":"主对话逐句","script":"오늘 수업은 몇 시부터 몇 시까지예요?","speaker":"M01／민수"},{"id":"chapter-10-dialogue-main-line-04","purpose":"主对话逐句","script":"오전 열 시부터 열두 시까지예요.","speaker":"F01／지수"},{"id":"chapter-10-dialogue-main-line-05","purpose":"主对话逐句","script":"수업 후에 뭐 할 거예요?","speaker":"M01／민수"},{"id":"chapter-10-dialogue-main-line-06","purpose":"主对话逐句","script":"식당에 가서 점심을 먹을 거예요. 그리고 두 시부터 네 시까지 도서관에서 숙제할 거예요.","speaker":"F01／지수"},{"id":"chapter-10-dialogue-main-line-07","purpose":"主对话逐句","script":"민수 씨는 저녁에 뭐 할 거예요?","speaker":"F01／지수"},{"id":"chapter-10-dialogue-main-line-08","purpose":"主对话逐句","script":"저는 여섯 시에 친구를 만나서 같이 저녁을 먹을 거예요.","speaker":"M01／민수"},{"id":"chapter-10-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"M01／F01"},
    {"id":"chapter-10-dialogue-alt-line-01","purpose":"第二对话逐句","script":"다니엘 씨, 내일 몇 시에 일어날 거예요?","speaker":"F02／유나"},{"id":"chapter-10-dialogue-alt-line-02","purpose":"第二对话逐句","script":"오전 일곱 시에 일어날 거예요.","speaker":"M02／다니엘"},{"id":"chapter-10-dialogue-alt-line-03","purpose":"第二对话逐句","script":"오전에는 무슨 일정이 있어요?","speaker":"F02／유나"},{"id":"chapter-10-dialogue-alt-line-04","purpose":"第二对话逐句","script":"아홉 시부터 열한 시까지 운동할 거예요.","speaker":"M02／다니엘"},{"id":"chapter-10-dialogue-alt-line-05","purpose":"第二对话逐句","script":"오후에는 뭐 할 거예요?","speaker":"F02／유나"},{"id":"chapter-10-dialogue-alt-line-06","purpose":"第二对话逐句","script":"한 시 반쯤 카페에 가서 한국어를 공부할 거예요.","speaker":"M02／다니엘"},{"id":"chapter-10-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／M02"}
  ] $dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_activities activity on activity.node_id = node.id
  where module.chapter_id = chapter_uuid and activity.activity_key = 'listening-library-time';

  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-10-listening-library-time-normal','audio','私有听力正常语速','korean-level-one/chapter-10/listening/chapter-10-listening-library-time-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F03／서연；第一人称日程说明","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-10-listening-library-time-slow','audio','私有听力慢速','korean-level-one/chapter-10/listening/chapter-10-listening-library-time-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F03／서연；第一人称日程说明","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_ten$;

commit;
