begin;

-- Converted from the read-only UPLY BOOK chapter-twelve master.
-- source_sha256: 0c7c484ef5a8fdd8c4f7662e31c96e9fa3e5808662d9f2f98596392462383867
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master as historical values pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_twelve$
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
  join public.digital_textbooks textbook on textbook.id=version.textbook_id
  where textbook.slug='korean-level-one-smart'
  order by version.version_number desc limit 1;
  if version_uuid is null then raise exception 'Cannot convert chapter 12: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id=lesson.course_id
  where course.slug='korean-beginner' and lesson.slug='basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 12: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug='korean-level-one-12' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id=lesson_uuid and chapter_number=12 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000012'::uuid,lesson_uuid,
      'korean-level-one-12','korean-level-one',12,
      '第 12 章测试：喂。','제12과 평가: 여보세요.',
      '检查电话与联系词汇、确认、进行、客观不能和原因表达，以及电话邀约、回电听力和短信理解。',
      12,60,
      '{"recognition":"电话与联系词汇","structure":"确认、进行、客观不能与原因形式","reading":"电话对话、听力与短信理解","assembly":"双角色电话邀约与重新联系组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id=lesson_uuid,slug='korean-level-one-12',course_key='korean-level-one',chapter_number=12,
      title='第 12 章测试：喂。',korean_title='제12과 평가: 여보세요.',
      description='检查电话与联系词汇、确认、进行、客观不能和原因表达，以及电话邀约、回电听力和短信理解。',
      duration_minutes=12,passing_score=60,
      skills='{"recognition":"电话与联系词汇","structure":"确认、进行、客观不能与原因形式","reading":"电话对话、听力与短信理解","assembly":"双角色电话邀约与重新联系组织"}'::jsonb,
      version=1,status='draft',student_app_id='10000000-0000-4000-8000-000000000001'::uuid,updated_at=now()
    where id=test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id=test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-12-01','电话开场时，“여보세요”最接近什么意思？','["喂","再见","谢谢","对不起"]',0,'母本词汇表将여보세요标为电话开场使用的感叹词“喂”。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-12-02','“만나다”怎样变成确认既定约定的形式？','["만나지요?","만날까요?","만나고 있어요","못 만나요"]',0,'谓词词干后直接接-지요?，形成만나지요?。','structure',2,'single_choice',10,'foundation','["谓词确认","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-12-03','哪一句正确表示“是学生吧？”','["학생이지요?","학생지요?","학생고 있어요?","학생 못 해요?"]',0,'학생末音节有收音，名词确认使用이지요?。','structure',3,'single_choice',10,'foundation','["名词确认","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-12-04','哪一句正确表示“现在正在上课”？','["지금 수업을 듣고 있어요.","지금 수업을 들어고 있어요.","지금 수업을 듣지요?","지금 수업을 못 있어요."]',0,'-고直接接듣-，并与있어요分写。','structure',4,'single_choice',10,'foundation','["进行状态","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-12-05','哪一句表示因客观条件“现在不能久聊”？','["지금은 오래 통화 못 해요.","지금은 오래 통화 안 해요.","지금은 오래 통화지요?","지금은 오래 통화고 있어요."]',0,'母本用分写的副词못表达客观条件导致做不到。','structure',5,'single_choice',10,'foundation','["客观不能","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-12-06','“因为忙”应写成哪一项？','["바빠서","바쁘어서","바쁘고","바쁘지요"]',0,'바쁘다接原因-아서/어서时ㅡ脱落，形成바빠서。','structure',6,'single_choice',10,'foundation','["原因","母本§5.5"]','draft',1,true,'STEP 03','母本 §5.5'),
    (test_uuid,'golden-12-07','主场景原定几点见面，最后改到几点？','["三点／五点","三点／四点半","四点半／五点","五点／三点"]',0,'主对话第3轮确认三点，第7—8轮改为五点；四点半是打工结束时间。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-12-08','私有听力中，敏智请宥娜什么时候再打电话？','["六点半","六点","五点半","七点"]',0,'听力最后一句明确说여섯 시 반에 다시 전화해 주세요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-12-09','阅读短信中，秀珍为什么不能接电话？','["因为正在上课","因为正在开车","因为正在开会","因为正在打工"]',0,'短信原句说明지금 수업을 듣고 있어서 전화를 못 받아요。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-12-10','阅读短信中，见面和再次打电话分别是什么时间？','["晚上七点／五点半","五点／晚上七点","五点半／五点","六点／七点"]',0,'短信用만나지요确认晚上七点见，并说明五点半再次打电话。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-12-11','双角色电话任务的自然信息顺序是哪一项？','["开场与确认→邀请或约定→当下状态→不能与原因→新时间→确认结束","先挂断→只报时间→省略对象","单人留言朗读→不回应对方","只说不能→不解释原因或下一步"]',0,'母本最终输出要求电话两端依次确认、说明状态与原因、商量新安排并结束。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-12-12','课末正式电话录音必须满足哪一项？','["45—60秒、至少10轮、双角色并覆盖十类信息","只说一个电话开场即可","必须获得自动发音分数","可用单人留言代替对话"]',0,'母本规定45—60秒、至少10轮、双角色和十类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id=version_uuid and (chapter_number=12 or slug='phone-call')
  order by (slug='phone-call') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'phone-call',12,
      '{"zh-CN":"喂。","ko-KR":"여보세요."}',
      '{"zh-CN":"秀雅给敏智打电话确认周六电影约定，因敏智三点要打工改约五点；俊浩邀请正在上课的哈娜周五吃饭，两人改用短信继续商量。","ko-KR":"수아는 민지에게 전화해 토요일 영화 약속을 확인하고 아르바이트 때문에 다섯 시로 바꿉니다. 준호는 수업 중인 하나에게 금요일 저녁을 제안하고 문자로 계속 이야기합니다."}',
      '{"zh-CN":"在电话中确认对方和约定，询问并说明进行状态，用못和原因-아서/어서说明客观不能，完成45—60秒、至少10轮的双角色电话任务。","ko-KR":"전화에서 상대와 약속을 확인하고 진행 중인 일을 묻고 답하며 못과 이유의 -아서/어서를 사용해 45~60초, 10턴 이상의 두 역할 전화 과제를 완성합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第12课 여보세요.md @ 2026-08-18 / sha256:0c7c484ef5a8fdd8c4f7662e31c96e9fa3e5808662d9f2f98596392462383867'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid,slug='phone-call',chapter_number=12,
      title='{"zh-CN":"喂。","ko-KR":"여보세요."}',
      scenario='{"zh-CN":"秀雅给敏智打电话确认周六电影约定，因敏智三点要打工改约五点；俊浩邀请正在上课的哈娜周五吃饭，两人改用短信继续商量。","ko-KR":"수아는 민지에게 전화해 토요일 영화 약속을 확인하고 아르바이트 때문에 다섯 시로 바꿉니다. 준호는 수업 중인 하나에게 금요일 저녁을 제안하고 문자로 계속 이야기합니다."}',
      goal='{"zh-CN":"在电话中确认对方和约定，询问并说明进行状态，用못和原因-아서/어서说明客观不能，完成45—60秒、至少10轮的双角色电话任务。","ko-KR":"전화에서 상대와 약속을 확인하고 진행 중인 일을 묻고 답하며 못과 이유의 -아서/어서를 사용해 45~60초, 10턴 이상의 두 역할 전화 과제를 완성합니다."}',
      status='draft',production_status='editorial_review',editorial_status='pending',
      native_review_status='pending',audio_status='pending',image_status='pending',
      source_revision='UPLY BOOK 第12课 여보세요.md @ 2026-08-18 / sha256:0c7c484ef5a8fdd8c4f7662e31c96e9fa3e5808662d9f2f98596392462383867',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"电话接通后，怎样确认并把事情说完整？","ko-KR":"전화가 연결된 뒤 어떻게 확인하고 용건을 끝까지 말할까요?"},"content":{"lead":{"zh-CN":"电话里看不见对方，要先确认对象，再说明来意、当下状态、不能的原因和新的联系时间。","ko-KR":"전화에서는 상대를 확인한 뒤 용건, 현재 상태, 할 수 없는 이유와 새 연락 시간을 말합니다."},"scene":{"people":"秀雅、敏智","place":"宿舍／去校园图书馆的路上","purpose":"确认电影约定并重新约定","imageStatus":"pending"},"targets":[{"ko":"여보세요. 민지 씨지요?","zh":"电话开场并确认对方"},{"ko":"지금 뭐 하고 있어요?","zh":"询问当下状态"},{"ko":"그럼 다섯 시에 만날까요?","zh":"提出新时间"}],"finalOutput":{"zh-CN":"45—60秒、至少10轮的双角色电话邀约与重新联系对话。","ko-KR":"45~60초, 10턴 이상의 두 역할 전화 초대와 다시 연락하기 대화입니다."},"coach":{"zh-CN":"答对不计分的电话开场诊断即完成；复述课末任务为自主展示。","ko-KR":"점수 없는 전화 인사 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"phone-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"node":"phone-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"认出电话动作、状态和联系时间","ko-KR":"전화 행동, 상태와 연락 시간 알아보기"},"content":{"lead":{"zh-CN":"按看场景、点读原形、跟读搭配、放进电话话轮的顺序学习；20词音频全部待制作。","ko-KR":"장면, 기본형, 결합, 전화 말차례 순서로 익힙니다. 20개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"여보세요","zh":"喂","pos":"感叹词","collocation":"여보세요. 민지 씨지요?"},{"ko":"전화","zh":"电话","pos":"名词","collocation":"전화가 왔어요"},{"ko":"전화하다","zh":"打电话","pos":"动词","collocation":"다시 전화해요"},{"ko":"걸다","zh":"拨、挂","pos":"动词","collocation":"전화를 걸다"},{"ko":"받다","zh":"接、收到","pos":"动词","collocation":"전화를 받다"},{"ko":"통화하다","zh":"通话","pos":"动词","collocation":"오래 통화하다"},{"ko":"휴대폰","zh":"手机","pos":"名词","collocation":"휴대폰이지요?"},{"ko":"전화번호","zh":"电话号码","pos":"名词","collocation":"전화번호가 뭐예요?"},{"ko":"연락하다","zh":"联系","pos":"动词","collocation":"나중에 연락해요"},{"ko":"문자","zh":"短信","pos":"名词","collocation":"문자로 이야기해요"},{"ko":"메시지","zh":"消息、留言","pos":"名词","collocation":"메시지를 남겨요"},{"ko":"부재중 전화","zh":"未接来电","pos":"名词短语","collocation":"부재중 전화를 보다"},{"ko":"회의","zh":"会议","pos":"名词","collocation":"회의하고 있어요"},{"ko":"수업","zh":"课、上课","pos":"名词","collocation":"수업을 듣고 있어요"},{"ko":"약속","zh":"约定","pos":"名词","collocation":"영화 약속"},{"ko":"운전하다","zh":"开车","pos":"动词","collocation":"운전하고 있어요"},{"ko":"바쁘다","zh":"忙","pos":"形容词","collocation":"지금 바빠요"},{"ko":"끝나다","zh":"结束","pos":"动词","collocation":"수업이 끝나요"},{"ko":"나중","zh":"以后、稍后","pos":"名词","collocation":"나중에 연락해요"},{"ko":"오래","zh":"久、长时间","pos":"副词","collocation":"오래 통화 못 해요"}],"studyFlow":["看场景辨认","点读原形／词组","跟读自然搭配","放进电话话轮"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；点读、图片快说和扩展搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"phone-grammar-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":20,"node":"phone-grammar-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"确认、进行、不能与原因","ko-KR":"확인, 진행, 불가능과 이유"},"content":{"lead":{"zh-CN":"五个工具分别确认谓词和名词信息、说明进行状态、客观不能及原因。","ko-KR":"다섯 도구로 용언과 명사 확인, 진행 상태, 객관적 불가능과 이유를 표현합니다."},"grammarCards":[{"form":"A/V-지요?","function":{"zh-CN":"确认已有判断或既定约定。","ko-KR":"이미 알고 있는 판단이나 약속을 확인합니다."},"rules":["谓词词干后直接接-지요?","不按收音分流","词干末ㄹ不脱落","口语常缩略为-죠?"],"examples":[{"ko":"내일 세 시에 만나지요?","zh":"明天三点见，对吧？","audioId":"chapter-12-grammar-01-example-01","audioStatus":"pending"},{"ko":"토요일 세 시에 만나지요?","zh":"周六三点见，对吧？","audioId":"chapter-12-grammar-01-example-02","audioStatus":"pending"},{"ko":"오늘 저녁 일곱 시에 만나지요?","zh":"今天晚上七点见，对吧？","audioId":"chapter-12-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"完全不知道时间时问몇 시에 만나요?，不要假装已有答案。","ko-KR":"시간을 전혀 모르면 몇 시에 만나요?라고 묻습니다."},"comparison":{"zh-CN":"만나지요?核对旧约定；만날까요?提出或重新商量。","ko-KR":"만나지요?는 확인, 만날까요?는 제안입니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"N-(이)지요?","function":{"zh-CN":"确认人、号码或名词信息。","ko-KR":"사람, 번호나 명사 정보를 확인합니다."},"rules":["有收音接이지요?","无收音接지요?","与前面名词连写","口语常缩略为이죠／죠"],"examples":[{"ko":"지훈 씨 휴대폰이지요?","zh":"是志勋的手机吧？","audioId":"chapter-12-grammar-02-example-01","audioStatus":"pending"},{"ko":"민지 씨지요?","zh":"是敏智吧？","audioId":"chapter-12-grammar-02-example-02","audioStatus":"pending"},{"ko":"하나 씨지요?","zh":"是哈娜吧？","audioId":"chapter-12-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"학생有收音，应写학생이지요?。","ko-KR":"학생은 받침이 있어 학생이지요?로 씁니다."},"comparison":{"zh-CN":"민지 씨지요?突出说话人的已有判断。","ko-KR":"민지 씨지요?는 말하는 사람의 예상이 있습니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-고 있어요","function":{"zh-CN":"说明通话当下正在进行的动作。","ko-KR":"통화하는 지금 진행 중인 행동을 말합니다."},"rules":["动词词干后直接接-고 있어요","-고与词干连写","있어요与前面分写","듣다在-고前不发生不规则变化"],"examples":[{"ko":"지금 회의하고 있어요.","zh":"现在正在开会。","audioId":"chapter-12-grammar-03-example-01","audioStatus":"pending"},{"ko":"지금 도서관에 가고 있어요.","zh":"现在正去图书馆。","audioId":"chapter-12-grammar-03-example-02","audioStatus":"pending"},{"ko":"지금 수업을 듣고 있어요.","zh":"现在正在上课。","audioId":"chapter-12-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写듣고 있어요，不写들어고 있어요，也不能漏掉必要空格。","ko-KR":"들어고 있어요가 아니라 듣고 있어요입니다."},"comparison":{"zh-CN":"들어요可表示现在或习惯；듣고 있어요突出此刻正在进行。","ko-KR":"듣고 있어요는 지금 진행 중임을 강조합니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"못 + V","function":{"zh-CN":"说明客观条件导致做不到。","ko-KR":"객관적 조건 때문에 할 수 없음을 말합니다."},"rules":["못放在动词前并分写","하다类常把못放在하다前","못不接形容词","本课不扩展词汇化못하다"],"examples":[{"ko":"지금은 오래 통화 못 해요.","zh":"现在不能久聊。","audioId":"chapter-12-grammar-04-example-01","audioStatus":"pending"},{"ko":"오래 통화 못 해요.","zh":"不能久聊。","audioId":"chapter-12-grammar-04-example-02","audioStatus":"pending"},{"ko":"전화를 못 받아요.","zh":"不能接电话。","audioId":"chapter-12-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"客观条件导致接不了电话用못，不用表示主观不做的안。","ko-KR":"객관적으로 받을 수 없을 때 안이 아니라 못을 씁니다."},"comparison":{"zh-CN":"안 받아요可能是选择不接；못 받아요表示条件所限。","ko-KR":"안 받아요는 선택, 못 받아요는 조건의 제한입니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"A/V-아서/어서","function":{"zh-CN":"说明原因导致的陈述结果。","ko-KR":"이유와 그에 따른 결과를 말합니다."},"rules":["ㅏ／ㅗ接-아서，其他接-어서","하다变해서","常见缩合和已学不规则仍适用","原因连接后的时制与礼貌在最终谓语表达"],"examples":[{"ko":"운전하고 있어서 오래 통화 못 해요.","zh":"因为正在开车，不能久聊。","audioId":"chapter-12-grammar-05-example-01","audioStatus":"pending"},{"ko":"그 시간에는 아르바이트가 있어서 못 만나요.","zh":"那个时间有打工安排，所以不能见面。","audioId":"chapter-12-grammar-05-example-02","audioStatus":"pending"},{"ko":"지금 수업을 듣고 있어서 전화를 못 받아요.","zh":"因为现在正在上课，所以不能接电话。","audioId":"chapter-12-grammar-05-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"바쁘다应变为바빠서，不写바쁘어서。","ko-KR":"바쁘어서가 아니라 바빠서입니다."},"comparison":{"zh-CN":"本课是原因→结果；第10课已学用法是紧密先后动作链。","ko-KR":"이 과는 이유와 결과이며 10과는 이어지는 행동입니다."},"source":{"zh-CN":"母本§5.5；第10课功能边界；旧电子书页码待人工核对。","ko-KR":"원고 §5.5와 10과 기능 경계; 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"七项填空全部正确才完成；规则解释与扩展变形为自主练习。","ko-KR":"일곱 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"phone-call-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":12,"node":"phone-call-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让六个电话话轮只有一种连法","ko-KR":"여섯 전화 말차례를 하나의 흐름으로 잇기"},"content":{"lead":{"zh-CN":"替换电话动作、进行状态和不能原因，再依据问答与回指排列六个完整话轮。","ko-KR":"전화 행동, 진행 상태와 불가능 이유를 바꾸고 문답과 지시 표현으로 여섯 말차례를 배열합니다."},"replacementSets":[["전화를 걸어요.","전화를 받아요.","문자를 보내요.","나중에 연락해요."],["도서관에 가고 있어요.","회의하고 있어요.","수업을 듣고 있어요.","운전하고 있어요."],["수업을 듣고 있어서 오래 통화 못 해요.","운전하고 있어서 전화를 못 받아요.","아르바이트를 해서 세 시에는 못 만나요."]],"orderItems":["네, 다섯 시가 좋아요. 그럼 그 시간에 영화관 앞에서 만나요.","토요일 영화 약속이요. 세 시에 만나지요?","그럼 방금 말한 아르바이트가 끝난 후 다섯 시에 만날까요?","여보세요. 민지 씨지요? 저는 수아예요.","네, 수아 씨. 지금 도서관에 가고 있어요. 무슨 일이에요?","네, 맞아요. 그런데 방금 말한 세 시에는 제가 아르바이트를 하고 있어서 못 만나요."],"personalFrames":["确认对方或既定约定","说明当下正在做的事","说明一项客观不能和原因"],"coach":{"zh-CN":"六个完整话轮排序全对才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례 배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"invitation-call"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":14,"node":"invitation-call","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"在不同电话场景中得体地邀约","ko-KR":"서로 다른 전화 상황에서 자연스럽게 약속하기"},"content":{"lead":{"zh-CN":"主场景确认电影约定并改到五点；第二场景接受晚饭邀请并改用短信商量。音频全部待制作。","ko-KR":"영화 약속을 다섯 시로 바꾸고 저녁 초대는 수업 뒤 문자로 상의합니다. 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":{"zh-CN":"周六电影约定电话","ko-KR":"토요일 영화 약속 전화"},"people":{"zh-CN":"秀雅与敏智，同龄朋友","ko-KR":"수아와 민지, 또래 친구"},"place":{"zh-CN":"学生宿舍／去校园图书馆的路上","ko-KR":"학생 기숙사／도서관으로 가는 길"},"purpose":{"zh-CN":"确认三点电影约定，说明打工冲突并改为五点。","ko-KR":"세 시 영화 약속을 확인하고 아르바이트 때문에 다섯 시로 바꿉니다."},"audioId":"chapter-12-dialogue-main","audioStatus":"pending","lines":[{"speaker":"수아","ko":"여보세요. 민지 씨지요?","zh":"喂，是敏智吧？"},{"speaker":"민지","ko":"네, 수아 씨. 지금 도서관에 가고 있어요. 무슨 일이에요?","zh":"是的，秀雅。我现在正去图书馆。有什么事？"},{"speaker":"수아","ko":"토요일 영화 약속이요. 토요일 세 시에 만나지요?","zh":"是周六电影的约定。周六三点见，对吧？"},{"speaker":"민지","ko":"아, 그런데 그 시간에는 아르바이트가 있어서 못 만나요.","zh":"啊，不过那个时间我有打工安排，所以不能见面。"},{"speaker":"수아","ko":"그래요? 그럼 아르바이트는 언제 끝나요?","zh":"是吗？那打工什么时候结束？"},{"speaker":"민지","ko":"네 시 반에 끝나요.","zh":"四点半结束。"},{"speaker":"수아","ko":"그럼 다섯 시에 만날까요?","zh":"那五点见面好吗？"},{"speaker":"민지","ko":"네, 다섯 시가 좋아요.","zh":"好，五点很好。"},{"speaker":"수아","ko":"좋아요. 영화관 앞에서 만나요.","zh":"好的。我们在电影院前见。"},{"speaker":"민지","ko":"네, 알겠어요. 토요일에 봐요.","zh":"好的，知道了。周六见。"}]},{"title":{"zh-CN":"上课中接到晚饭邀请","ko-KR":"수업 중 받은 저녁 초대"},"people":{"zh-CN":"俊浩与哈娜，韩国语社团同龄成员","ko-KR":"준호와 하나, 한국어 모임 또래 회원"},"place":{"zh-CN":"社团活动室外／教室内","ko-KR":"모임방 밖／교실 안"},"purpose":{"zh-CN":"接受周五晚饭邀请，因上课不能久聊而改用短信。","ko-KR":"금요일 저녁 초대를 받고 수업 때문에 문자로 계속 상의합니다."},"audioId":"chapter-12-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"준호","ko":"여보세요. 하나 씨지요?","zh":"喂，是哈娜吧？"},{"speaker":"하나","ko":"네, 맞아요. 누구세요?","zh":"对，是的。请问是谁？"},{"speaker":"준호","ko":"저 준호예요. 금요일에 같이 저녁을 먹을까요?","zh":"我是俊浩。周五一起吃晚饭好吗？"},{"speaker":"하나","ko":"네, 좋아요. 그런데 지금 수업을 듣고 있어요.","zh":"好啊。不过我现在正在上课。"},{"speaker":"준호","ko":"아, 지금은 오래 통화 못 해요?","zh":"啊，现在不能久聊吗？"},{"speaker":"하나","ko":"네, 수업을 듣고 있어서 오래 통화 못 해요.","zh":"对，因为正在上课，不能久聊。"},{"speaker":"준호","ko":"알겠어요. 그럼 수업 후에 문자로 이야기할까요?","zh":"明白了。那下课后用短信聊好吗？"},{"speaker":"하나","ko":"네, 좋아요. 수업은 다섯 시에 끝나요. 나중에 문자로 연락해요.","zh":"好。五点下课。晚些时候用短信联系吧。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换与试录为自主练习。","ko-KR":"사실 문제와 자연스러운 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-call-back"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":15,"node":"listen-and-call-back","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听出回电时间，再完成十轮电话","ko-KR":"다시 전화할 시간을 듣고 열 말차례 전화 완성하기"},"content":{"lead":{"zh-CN":"区分会议结束时间和再次打电话的时间；脚本、答案、停顿和对象键仅在服务端。","ko-KR":"회의가 끝나는 시간과 다시 전화할 시간을 구별하며 원고와 정답은 서버에만 있습니다."},"listening":{"tracks":[{"id":"track-01","label":"正常语速","status":"pending"},{"id":"track-02","label":"慢速","status":"pending"}],"question":{"zh-CN":"敏智请宥娜什么时候再打电话？","ko-KR":"민지는 유나에게 언제 다시 전화해 달라고 했어요?"}},"speakingTask":{"duration":"45—60秒","minimumTurns":10,"rolesRequired":2,"requiredInformation":["电话开场","确认对方","邀请或既定约定","确认问句","询问当下状态","说明进行动作","客观不能","不能的原因","新的见面或回电时间","确认并结束"],"pronunciationScore":false},"coach":{"zh-CN":"两版音频可播放后听辨正确，并提交符合时长、话轮、双角色和十类信息的录音才完成；录音不产生分数。","ko-KR":"두 음원 재생과 듣기 정답, 시간, 말차례, 두 역할과 열 정보를 모두 갖추며 녹음에는 점수가 없습니다."},"nextNode":"missed-call-message"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":14,"node":"missed-call-message","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读未接电话短信，写清下一步","ko-KR":"부재중 전화 문자를 읽고 다음 연락 쓰기"},"content":{"lead":{"zh-CN":"从一条单一发件人短信中区分原因、约定、结束和回电时间，再以未接电话者身份写原创短信。","ko-KR":"한 발신자의 문자에서 이유와 약속, 끝나는 시간과 다시 연락할 시간을 구별해 새 문자를 씁니다."},"reading":{"title":"부재중 전화 뒤 문자","text":"민지 씨, 수진이에요. 부재중 전화를 봤어요. 지금 수업을 듣고 있어서 전화를 못 받아요. 오늘 저녁 일곱 시에 만나지요? 수업은 다섯 시에 끝나요. 다섯 시 반에 제가 다시 전화해요.","questions":["수진은 왜 전화를 못 받아요?","두 사람은 오늘 몇 시에 만나요?","수진은 언제 다시 전화해요?"]},"writing":{"author":"未能接听电话的人","audience":"刚才来电的同一位朋友","requirements":["7—9句","发件人身份","进行状态","客观不能与原因","邀请或约定","确认形式","新联系时间","同一作者与受众","完成四维量规自查"],"scaffold":"___ 씨, ___이에요/예요. → 부재중 전화를 봤어요. → 지금 ___고 있어요. → ___아서/어서 전화를 못 받아요. → 오늘／내일 ___지요? → ___에 다시 전화해요. → 그때 이야기해요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读三题全对并提交满足句数、信息和量规自查的原创短信才完成；写作不产生分数。","ko-KR":"읽기 세 문제 정답과 문장 수, 필수 정보, 점검을 갖춘 새 문자가 필요하며 쓰기에는 점수가 없습니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":9,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能把一通电话完整收束吗？","ko-KR":"전화 한 통을 끝까지 마무리할 수 있을까요?"},"content":{"lead":{"zh-CN":"检查对象与约定确认、进行状态、客观不能、原因和新的联系安排。","ko-KR":"상대와 약속 확인, 진행 상태, 객관적 불가능, 이유와 새 연락 계획을 점검합니다."},"canDo":["我能在电话中确认对方和既定约定。","我能询问并说明通话当下正在进行的动作。","我能用못和原因-아서/어서说明客观不能及原因。","我能通过电话邀请并商量新的见面或联系时间。","我能轮换两个角色完成45—60秒、至少10轮的电话对话。"],"returnMap":[{"reason":"词汇","node":"phone-words"},{"reason":"语法","node":"phone-grammar-tools"},{"reason":"理解","node":"invitation-call／listen-and-call-back"},{"reason":"表达","node":"listen-and-call-back"},{"reason":"读写","node":"missed-call-message"}],"chapterTest":"korean-level-one-12","unlockRule":"八节点全部完成","coach":{"zh-CN":"综合多选正确并完成五项自查才完成；自主复习展示不计入强制条件。","ko-KR":"종합 선택 정답과 다섯 자기 점검만 필수이며 자율 복습은 완료 조건이 아닙니다."}}}
  ] $modules$::jsonb) loop
    insert into public.digital_textbook_modules (chapter_id,module_code,sort_order,accent_role,title,description)
    values (chapter_uuid,item->>'code',(item->>'order')::integer,item->>'accent',item->'title',item->'nodeTitle')
    on conflict (chapter_id,module_code) do update set
      sort_order=excluded.sort_order,accent_role=excluded.accent_role,title=excluded.title,
      description=excluded.description,updated_at=now()
    returning id into module_uuid;
    insert into public.digital_textbook_nodes (module_id,node_code,node_type,sort_order,estimated_minutes,title,content)
    values (module_uuid,item->>'node',item->>'type',1,(item->>'minutes')::integer,item->'nodeTitle',item->'content')
    on conflict (module_id,node_code) do update set
      node_type=excluded.node_type,sort_order=1,estimated_minutes=excluded.estimated_minutes,
      title=excluded.title,content=excluded.content,updated_at=now();
  end loop;

  delete from public.digital_textbook_modules
  where chapter_id=chapter_uuid and module_code not in ('orientation','vocabulary','grammar','patterns','dialogue','listen_speak','read_write','review');

  for item in select value from jsonb_array_elements($activities$
  [
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"秀雅打通一个号码，想先确认接电话的人是不是敏智。哪一句最合适？","ko-KR":"수아가 전화를 건 뒤 전화를 받은 사람이 민지인지 먼저 확인하려고 합니다. 가장 알맞은 말은 무엇이에요?"},"instruction":{"zh-CN":"选择既能电话开场、又能确认对方的一句；本题不显示分数。","ko-KR":"전화 인사와 상대 확인을 함께 할 수 있는 문장을 하나 고르세요. 점수는 표시하지 않습니다."},"options":["여보세요. 민지 씨지요?","여보세요. 민지 씨가 어디에 있어요?","민지 씨는 얼마예요?","오늘은 운동하지 마세요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"여보세요完成电话开场，민지 씨지요?确认接听者。","ko-KR":"여보세요로 인사하고 민지 씨지요?로 상대를 확인합니다."},"feedback":[{"zh-CN":"先找只在电话开场常用的表达。","ko-KR":"전화에서 먼저 쓰는 인사말을 찾으세요."},{"zh-CN":"目标句还要确认“是敏智吧”，不能只问敏智在哪里。","ko-KR":"민지가 맞는지 확인해야 하며 위치만 묻지 않습니다."},{"zh-CN":"应选择여보세요. 민지 씨지요?，它同时完成电话开场和对象确认。","ko-KR":"정답은 여보세요. 민지 씨지요?입니다."}]}},
    {"node":"phone-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在지금은 오래 통화 못 해요中，통화하다是什么意思？","ko-KR":"지금은 오래 통화 못 해요에서 통화하다는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 하나 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["发短信","开会","通话","开车"],"config":{"shuffle":true,"example":"지금은 오래 통화 못 해요.","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true},"audioPending":true},"answer":{"kind":"index_confirmation","value":2},"explanation":{"correct":{"zh-CN":"통화하다表示两个人通过电话交谈；整句是“现在不能久聊”。","ko-KR":"통화하다는 전화로 이야기한다는 뜻입니다."},"feedback":[{"zh-CN":"先区分通讯动作和现场活动。","ko-KR":"통신 행동과 현장 활동을 구별하세요."},{"zh-CN":"常用搭配오래 통화하다表示电话交谈持续较久。","ko-KR":"오래 통화하다는 전화 대화가 오래 이어지는 뜻입니다."},{"zh-CN":"答案是“通话”；整句表示“现在不能久聊”。","ko-KR":"정답은 통화하다입니다."}]}},
    {"node":"phone-grammar-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成七小题，检查两类确认、进行状态、客观不能和原因表达。","ko-KR":"두 가지 확인, 진행 상태, 객관적인 불가능과 이유 표현을 확인하는 일곱 문항을 완성하세요."},"instruction":{"zh-CN":"根据括号中的功能完成词形；保留问号和必要空格，第5题用不加助词的固定短语。","ko-KR":"기능에 맞게 형태를 쓰고 물음표와 띄어쓰기를 지키며 5번은 조사 없는 고정 표현을 쓰세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"만나다 → 만나___（确认既定约定，保留问号）","placeholder":"답을 입력하세요"},{"id":"item-02","label":"학생 → 학생___（确认‘是学生吧’，保留问号）","placeholder":"답을 입력하세요"},{"id":"item-03","label":"수아 → 수아___（确认‘是秀雅吧’，保留问号）","placeholder":"답을 입력하세요"},{"id":"item-04","label":"가다 → 가___（说明通话当下正在去）","placeholder":"답을 입력하세요"},{"id":"item-05","label":"통화하다 → 통화___（用固定短语表示‘不能通话’，不加助词）","placeholder":"답을 입력하세요"},{"id":"item-06","label":"바쁘다 → ___（说明‘因为忙’）","placeholder":"답을 입력하세요"},{"id":"item-07","label":"회의하고 있다 → 회의하고 ___（说明‘因为正在开会’）","placeholder":"답을 입력하세요"}]},"answer":{"kind":"text_array","value":["지요?","이지요?","지요?","고 있어요","못 해요","바빠서","있어서"]},"explanation":{"correct":{"zh-CN":"七项形式全部正确，内部拼写、问号和必要空格均保留。","ko-KR":"일곱 형태와 물음표, 필요한 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先给每题标记谓词确认、名词确认、进行、客观不能或原因。","ko-KR":"용언 확인, 명사 확인, 진행, 불가능이나 이유를 먼저 표시하세요."},{"zh-CN":"检查名词收音、-고后的空格、못的位置、ㅡ脱落和있다→있어서。","ko-KR":"받침, -고 뒤 띄어쓰기, 못 위치, ㅡ 탈락과 있어서를 확인하세요."},{"zh-CN":"依次为지요?、이지요?、지요?、고 있어요、못 해요、바빠서、있어서。","ko-KR":"차례대로 지요?, 이지요?, 지요?, 고 있어요, 못 해요, 바빠서, 있어서입니다."}]}},
    {"node":"phone-call-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段语义连贯、照应清楚的电话对话。","ko-KR":"여섯 개의 대화 카드를 의미와 가리키는 말이 자연스럽게 이어지도록 배열하세요."},"instruction":{"zh-CN":"依据问答、具体信息和回指表达自行判断并移动；卡片不标角色、步骤或位置。","ko-KR":"질문과 대답, 구체적인 정보와 가리키는 말을 바탕으로 옮기세요. 역할이나 단계는 표시되지 않습니다."},"options":["네, 다섯 시가 좋아요. 그럼 그 시간에 영화관 앞에서 만나요.","토요일 영화 약속이요. 세 시에 만나지요?","그럼 방금 말한 아르바이트가 끝난 후 다섯 시에 만날까요?","여보세요. 민지 씨지요? 저는 수아예요.","네, 수아 씨. 지금 도서관에 가고 있어요. 무슨 일이에요?","네, 맞아요. 그런데 방금 말한 세 시에는 제가 아르바이트를 하고 있어서 못 만나요."],"config":{"shuffle":true},"answer":{"kind":"order","value":[3,4,1,5,2,0]},"explanation":{"correct":{"zh-CN":"身份回应、来意回答、三点回指、打工回指和五点回应形成唯一连续链。","ko-KR":"신원, 용건, 세 시, 아르바이트와 다섯 시의 연결이 한 흐름을 만듭니다."},"feedback":[{"zh-CN":"先检查每个问句是否紧邻能直接回答它的话轮。","ko-KR":"질문 뒤에 직접 답하는 말차례를 놓으세요."},{"zh-CN":"追踪两处방금 말한和一处그 시간各自只能指向哪条紧邻信息。","ko-KR":"방금 말한과 그 시간이 바로 앞의 무엇을 가리키는지 보세요."},{"zh-CN":"系统会依次检查身份、来意、三点、打工和五点五处相邻照应。","ko-KR":"신원, 용건, 세 시, 아르바이트와 다섯 시 연결을 차례로 확인하세요."}]}},
    {"node":"invitation-call","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景原定几点见面，最后改到几点？","ko-KR":"주 장면에서 원래 몇 시에 만나기로 했고, 마지막에는 몇 시로 바꾸었어요?"},"instruction":{"zh-CN":"重读主场景，选择原定时间和改变后的时间都与台词一致的一组。","ko-KR":"주 장면을 다시 읽고 원래 시간과 바꾼 시간이 모두 같은 조합을 고르세요."},"options":["세 시／다섯 시","세 시／네 시 반","네 시 반／다섯 시","다섯 시／세 시"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"第3轮确认三点，第7—8轮改为五点；四点半只是打工结束时间。","ko-KR":"3턴의 세 시 약속을 7~8턴에서 다섯 시로 바꿉니다."},"feedback":[{"zh-CN":"分别圈出带만나지요?和带만날까요?的时间。","ko-KR":"만나지요?와 만날까요? 앞의 시간을 찾으세요."},{"zh-CN":"不要把打工结束与见面混为同一动作。","ko-KR":"아르바이트가 끝나는 시간과 만나는 시간을 구별하세요."},{"zh-CN":"原定三点见，后来改为五点；四点半是打工结束时间。","ko-KR":"원래 세 시, 바꾼 시간은 다섯 시입니다."}]}},
    {"node":"invitation-call","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"哈娜说正在上课、不能久聊。俊浩怎样回应既体谅对方，又继续商量晚饭邀请？","ko-KR":"하나가 수업 중이라 오래 통화하지 못한다고 했습니다. 준호의 알맞은 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择既接受对方暂时不能久聊、又提出合适替代联系方式的一句。","ko-KR":"지금 오래 통화하지 못하는 상황을 받아들이고 다른 연락 방법을 제안하는 문장을 고르세요."},"options":["알겠어요. 그럼 수업 후에 문자로 이야기할까요?","그럼 지금 한 시간 동안 통화해요.","아니요, 수업을 듣지 마세요.","여기는 영화관이지요?"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句接受当前限制，并提出课后改用短信继续商量。","ko-KR":"현재 상황을 이해하고 수업 뒤 문자로 계속 이야기하자고 합니다."},"feedback":[{"zh-CN":"先排除要求继续久聊或否定对方上课的句子。","ko-KR":"오래 통화하라고 하거나 수업을 부정하는 말을 빼세요."},{"zh-CN":"目标回应需要有“课后”和“短信”两个衔接线索。","ko-KR":"수업 후와 문자라는 두 단서를 찾으세요."},{"zh-CN":"应选择알겠어요. 그럼 수업 후에 문자로 이야기할까요?。","ko-KR":"정답은 수업 후에 문자로 이야기하자는 말입니다."}]}},
    {"node":"listen-and-call-back","sort":1,"key":"listening-callback","type":"listening","prompt":{"zh-CN":"听电话，判断敏智请宥娜什么时候再打电话。","ko-KR":"전화 대화를 듣고 민지가 유나에게 언제 다시 전화해 달라고 했는지 고르세요."},"instruction":{"zh-CN":"正常语速可听两遍、慢速可听一遍；区分会议结束时间和请求回电时间。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번 듣고 회의 종료와 다시 전화할 시간을 구별하세요."},"options":["여섯 시","여섯 시 반","다섯 시 반","일곱 시"],"config":{"shuffle":true,"audioStatus":"pending","normalPlays":2,"slowPlays":1,"tracks":[{"id":"track-01","label":"正常语速","status":"pending"},{"id":"track-02","label":"慢速","status":"pending"}]},"answer":{"kind":"index","value":1},"transcript":"유나: 여보세요. 민지 씨지요? 민지: 네, 유나 씨. 무슨 일이에요? 유나: 오늘 저녁에 같이 밥을 먹을까요? 민지: 좋아요. 그런데 지금 회의하고 있어서 오래 통화 못 해요. 유나: 회의는 언제 끝나요? 민지: 여섯 시에 끝나요. 여섯 시 반에 다시 전화해 주세요.","audioObjectKey":"korean-level-one/chapter-12/listening/chapter-12-listening-callback-normal.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是六点半；六点是会议结束时间，六点半才是请求回电时间。","ko-KR":"여섯 시는 회의 종료, 여섯 시 반은 다시 전화할 시간입니다."},"feedback":[{"zh-CN":"再听最后两个时间分别和哪个动作连用。","ko-KR":"마지막 두 시간이 각각 어떤 행동과 이어지는지 들으세요."},{"zh-CN":"前一个时间跟끝나요，后一个时间跟다시 전화해 주세요。","ko-KR":"앞 시간은 끝나요, 뒤 시간은 다시 전화해 주세요와 이어집니다."},{"zh-CN":"答案是여섯 시 반；不要把会议结束时间当成回电时间。","ko-KR":"정답은 여섯 시 반입니다."}],"privateListening":{"normalAudioId":"chapter-12-listening-callback-normal","normalAudioObjectKey":"korean-level-one/chapter-12/listening/chapter-12-listening-callback-normal.mp3","normalScript":"유나: 여보세요. 민지 씨지요? / 민지: 네, 유나 씨. 무슨 일이에요? / 유나: 오늘 저녁에 같이 밥을 먹을까요? / 민지: 좋아요. 그런데 지금 회의하고 있어서 오래 통화 못 해요. / 유나: 회의는 언제 끝나요? / 민지: 여섯 시에 끝나요. 여섯 시 반에 다시 전화해 주세요.","slowAudioId":"chapter-12-listening-callback-slow","slowAudioObjectKey":"korean-level-one/chapter-12/listening/chapter-12-listening-callback-slow.mp3","slowScript":"유나: 여보세요. / 민지 씨지요? / 민지: 네, 유나 씨. / 무슨 일이에요? / 유나: 오늘 저녁에 같이 밥을 먹을까요? / 민지: 좋아요. / 그런데 지금 회의하고 있어서 / 오래 통화 못 해요. / 유나: 회의는 언제 끝나요? / 민지: 여섯 시에 끝나요. / 여섯 시 반에 다시 전화해 주세요.","pauseMarks":"유나: 여보세요. ⏸ 민지 씨지요? ⏸ 민지: 네, 유나 씨. ⏸ 무슨 일이에요? ⏸ 유나: 오늘 저녁에 같이 밥을 먹을까요? ⏸ 민지: 좋아요. ⏸ 그런데 지금 회의하고 있어서 ⏸ 오래 통화 못 해요. ⏸ 유나: 회의는 언제 끝나요? ⏸ 민지: 여섯 시에 끝나요. ⏸ 여섯 시 반에 다시 전화해 주세요.","speaker":"F04／유나；F05／민지","distractorReasons":["六点是会议结束时间。","原文没有五点半。","原文没有七点。"]}}},
    {"node":"listen-and-call-back","sort":2,"key":"speaking-phone-invitation","type":"speaking","prompt":{"zh-CN":"完成45—60秒、至少10轮的双角色电话邀约与重新联系对话。","ko-KR":"두 역할을 번갈아 맡아 45~60초 동안 10턴 이상의 전화 초대 및 다시 연락하기 대화를 완성하세요."},"instruction":{"zh-CN":"加入电话开场、对象确认、邀请或约定、当下状态、客观不能、原因、新时间和结束；两个角色必须交替。","ko-KR":"전화 인사, 상대 확인, 초대·약속, 지금 하는 일, 불가능, 이유, 새 시간과 마무리를 넣으세요."},"options":[],"config":{"minimumSeconds":45,"maximumSeconds":60,"minimumTurns":10,"rolesRequired":2,"requiredCriteria":10,"criteria":["电话开场","确认对方","邀请或既定约定","一次确认问句","询问当下状态","说明正在进行的动作","一项客观不能","说明不能的原因","新的见面或回电时间","确认新安排并结束"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存符合时长、话轮、双角色和十类信息的录音；不产生正确性或分数。","ko-KR":"시간, 말차례, 두 역할과 열 정보를 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对电话两端是否都出现，并检查十类信息是否齐全。","ko-KR":"두 역할과 열 가지 정보가 모두 있는지 확인하세요."},{"zh-CN":"重写“正在做什么—为什么不能—新的时间”三组相邻话轮。","ko-KR":"지금 하는 일, 불가능의 이유와 새 시간을 이어 보세요."},{"zh-CN":"按句框补齐缺项后重录；系统不提供虚假发音准确率。","ko-KR":"빠진 내용을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
    {"node":"missed-call-message","sort":1,"key":"reading-phone-message","type":"single_choice","prompt":{"zh-CN":"阅读未接电话后的短信，完成原因、见面时间和回电时间三道事实题。","ko-KR":"부재중 전화 뒤 문자를 읽고 이유, 만날 시간과 다시 전화할 시간에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案；注意下课、见面和回电是不同动作。","ko-KR":"문제마다 하나를 고르고 수업 종료, 만남과 다시 전화를 구별하세요."},"options":[],"config":{"shuffle":true,"reading":"민지 씨, 수진이에요. 부재중 전화를 봤어요. 지금 수업을 듣고 있어서 전화를 못 받아요. 오늘 저녁 일곱 시에 만나지요? 수업은 다섯 시에 끝나요. 다섯 시 반에 제가 다시 전화해요.","items":[{"id":"q1","question":"수진은 왜 전화를 못 받아요?","options":["운전하고 있어서","회의하고 있어서","수업을 듣고 있어서","아르바이트를 해서"]},{"id":"q2","question":"두 사람은 오늘 몇 시에 만나요?","options":["다섯 시","일곱 시","다섯 시 반","여섯 시"]},{"id":"q3","question":"수진은 언제 다시 전화해요?","options":["일곱 시","다섯 시","여섯 시","다섯 시 반"]}]},"answer":{"kind":"index_array","value":[2,1,3]},"explanation":{"correct":{"zh-CN":"答案依次是因为正在上课、晚上七点见面、五点半回电。","ko-KR":"정답은 수업 중, 일곱 시 만남, 다섯 시 반 전화입니다."},"feedback":[{"zh-CN":"分别圈出带原因连接、만나지요?和다시 전화해요的句子。","ko-KR":"이유, 만나지요?와 다시 전화해요가 있는 문장을 찾으세요."},{"zh-CN":"同一短信有下课、见面、回电三个时间，先把时间连回动作。","ko-KR":"수업 종료, 만남과 다시 전화 시간을 행동에 연결하세요."},{"zh-CN":"三题答案依次是因为正在上课、晚上七点、五点半。","ko-KR":"차례대로 수업 중, 일곱 시, 다섯 시 반입니다."}]}},
    {"node":"missed-call-message","sort":2,"key":"write-phone-message","type":"writing","prompt":{"zh-CN":"作为未能接听电话的一方，给刚才来电的同一位朋友写一条7—9句原创短信。","ko-KR":"전화를 받지 못한 사람이 되어 방금 전화한 한 명의 친구에게 7~9문장의 새 문자를 쓰세요."},"instruction":{"zh-CN":"写明发件人、当前状态、客观不能及原因、邀请或约定、新联系时间和结束；保持单一发件人与收件人并完成量规自查。","ko-KR":"보내는 사람, 지금 하는 일, 불가능과 이유, 약속, 새 연락 시간과 마무리를 쓰고 한 발신자와 수신자를 유지하세요."},"options":[],"config":{"minSentences":7,"maxSentences":9,"minimumHangulCharacters":60,"minimumInformationKinds":7,"informationChecklist":["发件人身份","当前进行状态","客观不能和原因","邀请或既定约定","确认形式","新的回电或联系时间","单一作者／受众并完成量规自查"],"requiredPhraseGroups":[["부재중 전화"],["고 있어요"],["못"],["아서","어서"],["지요?"],["다시 전화해요"]],"minimumPhraseGroups":6,"requireCompletionChecklist":true,"scaffold":"___ 씨, ___이에요/예요. → 부재중 전화를 봤어요. → 지금 ___고 있어요. → ___아서/어서 전화를 못 받아요. → 오늘／내일 ___지요? → ___에 다시 전화해요. → 그때 이야기해요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、规定信息和量规自查的原创短信；不产生正确性或分数。","ko-KR":"문장 수, 필수 정보와 점검을 갖춘 새 문자를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对作者和读者是否始终是同一发件人与同一朋友，再数必要信息。","ko-KR":"같은 발신자와 수신자인지 보고 필수 정보를 세세요."},{"zh-CN":"检查-고 있어요、못、原因-아서/어서和确认形，并区分结束与联系时间。","ko-KR":"-고 있어요, 못, 이유, 확인형과 시간을 확인하세요."},{"zh-CN":"按支架补齐缺项，删除收件人回答或矛盾时间，但不复制示范。","ko-KR":"빠진 내용을 보완하고 상대 답이나 모순된 시간을 지우세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的表达。","ko-KR":"형태가 바르고 괄호의 기능을 알맞게 나타내는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["민지 씨지요?（确认对象）","지금 수업을 듣고 있어요.（进行状态）","수업을 듣고 있어서 전화를 못 받아요.（原因＋客观不能）","바쁘어서 통화 안 해요.（原因＋客观不能）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三项正确；第4项应为바빠서 통화 못 해요。","ko-KR":"앞의 세 문장이 맞고 4번은 바빠서 통화 못 해요로 고칩니다."},"feedback":[{"zh-CN":"检查名词收音、-고 있어요的空格、原因形和못／안的功能。","ko-KR":"받침, 띄어쓰기, 이유 형태와 못／안을 확인하세요."},{"zh-CN":"只有一项同时存在ㅡ变化错误和客观不能功能不符。","ko-KR":"한 항목만 ㅡ 변화와 객관적 불가능 기능이 모두 틀립니다."},{"zh-CN":"正确项是第1、2、3项；第4项应改为바빠서 통화 못 해요。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据刚才的实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"방금 한 실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"confirmation","label":"我能在电话中确认对方和既定约定／상대와 약속을 확인할 수 있어요"},{"id":"progressive","label":"我能询问并说明通话当下的动作／지금 하는 일을 묻고 답할 수 있어요"},{"id":"reason","label":"我能用못和原因表达客观不能／못과 이유로 할 수 없는 일을 말할 수 있어요"},{"id":"arrangement","label":"我能邀请并商量新的见面或联系时间／초대하고 새 연락 시간을 정할 수 있어요"},{"id":"phone-task","label":"我能完成45—60秒、至少10轮双角色电话／45~60초, 10턴 이상의 전화를 할 수 있어요"}],"returnNodes":[{"value":"phone-words","label":"词汇"},{"value":"phone-grammar-tools","label":"语法"},{"value":"invitation-call","label":"对话理解"},{"value":"listen-and-call-back","label":"听说"},{"value":"missed-call-message","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想对象与约定确认、进行状态、客观不能、原因和完整十轮电话。","ko-KR":"확인, 진행, 불가능, 이유와 열 말차례 전화를 돌아보세요."},{"zh-CN":"把“需要复习”对应到词汇、语法、对话理解、听说或读写节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 12 node %',item->>'node'; end if;
    insert into public.digital_textbook_activities (
      node_id,activity_key,activity_type,sort_order,prompt,instruction,options,public_config,max_attempts,counts_toward_completion
    ) values (
      node_uuid,item->>'key',item->>'type',(item->>'sort')::integer,item->'prompt',item->'instruction',item->'options',item->'config',3,true
    )
    on conflict (node_id,activity_key) do update set
      activity_type=excluded.activity_type,sort_order=excluded.sort_order,prompt=excluded.prompt,
      instruction=excluded.instruction,options=excluded.options,public_config=excluded.public_config,
      max_attempts=3,counts_toward_completion=true,updated_at=now()
    returning id into activity_uuid;
    insert into public.digital_textbook_activity_secrets (
      activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status
    ) values (
      activity_uuid,item->'answer',item->'explanation',item->>'transcript',item->>'audioObjectKey',coalesce(item->>'audioStatus','pending')
    )
    on conflict (activity_id) do update set
      answer_key=excluded.answer_key,explanation=excluded.explanation,transcript_ko=excluded.transcript_ko,
      audio_object_key=excluded.audio_object_key,audio_status=excluded.audio_status,updated_at=now();
  end loop;

  delete from public.digital_textbook_activities activity
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where activity.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid
    and activity.activity_key not in (
      'orientation-check','vocabulary-check','grammar-fill','pattern-order',
      'dialogue-fact-check','dialogue-response','listening-callback',
      'speaking-phone-invitation','reading-phone-message','write-phone-message',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where media.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-12-image-01","purpose":"章节情境主图","file":"chapter-12-01-scene.png","path":"../附件/韩国语1级/第12课/第12课-01-章节情境主图.png","alt":"宿舍中的秀雅与走向图书馆的敏智分屏通话。","width":1600,"height":900},
    {"node":"phone-words","key":"chapter-12-image-02","purpose":"核心词汇电话与联系卡","file":"chapter-12-02-vocabulary.png","path":"../附件/韩国语1级/第12课/第12课-02-核心词汇卡-电话与联系.png","alt":"拨打、接听、通话、短信、会议、上课和开车等八格卡。","width":1200,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-03","purpose":"电话确认与原因语法总图","file":"chapter-12-03-grammar-overview.png","path":"../附件/韩国语1级/第12课/第12课-03-语法总图-电话确认与原因.png","alt":"确认、进行、不能和原因五条结构轨道。","width":1600,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-04","purpose":"谓词确认结构图","file":"chapter-12-03a-av-jiyo.png","path":"../附件/韩国语1级/第12课/第12课-03A-语法结构图-AV지요.png","alt":"谓词词干连接지요的确认轨道。","width":1200,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-05","purpose":"名词确认结构图","file":"chapter-12-03b-n-ijiyo.png","path":"../附件/韩国语1级/第12课/第12课-03B-语法结构图-N이지요.png","alt":"名词按收音选择이지요或지요。","width":1200,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-06","purpose":"进行状态结构图","file":"chapter-12-03c-go-isseoyo.png","path":"../附件/韩国语1级/第12课/第12课-03C-语法结构图-고있어요.png","alt":"动词词干接고，空格后接있어요。","width":1200,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-07","purpose":"客观不能结构图","file":"chapter-12-03d-mot-v.png","path":"../附件/韩国语1级/第12课/第12课-03D-语法结构图-못V.png","alt":"못位于一般动词或하다前的两种位置。","width":1200,"height":900},
    {"node":"phone-grammar-tools","key":"chapter-12-image-08","purpose":"原因连接结构图","file":"chapter-12-03e-reason-aseo-eoseo.png","path":"../附件/韩国语1级/第12课/第12课-03E-语法结构图-原因아서어서.png","alt":"元音分流、已学变化和原因结果箭头。","width":1200,"height":900},
    {"node":"phone-call-builder","key":"chapter-12-image-09","purpose":"电话完整话轮卡","file":"chapter-12-04-pattern-blocks.png","path":"../附件/韩国语1级/第12课/第12课-04-句型电话话轮卡.png","alt":"六张无角色、步骤、序号或箭头的完整电话话轮卡。","width":1200,"height":900},
    {"node":"invitation-call","key":"chapter-12-image-10","purpose":"实战电话双场景图","file":"chapter-12-05-dialogue.png","path":"../附件/韩国语1级/第12课/第12课-05-实战对话场景.png","alt":"电影改约电话与上课中晚饭邀请两个独立场景。","width":1600,"height":900},
    {"node":"listen-and-call-back","key":"chapter-12-image-11","purpose":"结束与回电时间信息图","file":"chapter-12-06-listening.png","path":"../附件/韩国语1级/第12课/第12课-06-听力信息图-结束与回电时间.png","alt":"会议结束、电话回拨等无文字图标。","width":1200,"height":900},
    {"node":"missed-call-message","key":"chapter-12-image-12","purpose":"未接电话短信版式","file":"chapter-12-07-message.png","path":"../附件/韩国语1级/第12课/第12课-07-未接电话短信.png","alt":"单一发件人与收件人的手机短信空版式。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-12-image-13","purpose":"最终电话任务图","file":"chapter-12-08-final-task.png","path":"../附件/韩国语1级/第12课/第12课-08-最终任务图.png","alt":"电话对象、状态、不能、原因、联系时间和提交的类别图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-12/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='phone-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"여보세요","collocation":"여보세요. 민지 씨지요?"},{"word":"전화","collocation":"전화가 왔어요"},{"word":"전화하다","collocation":"다시 전화해요"},{"word":"걸다","collocation":"전화를 걸다"},{"word":"받다","collocation":"전화를 받다"},{"word":"통화하다","collocation":"오래 통화하다"},{"word":"휴대폰","collocation":"휴대폰이지요?"},{"word":"전화번호","collocation":"전화번호가 뭐예요?"},{"word":"연락하다","collocation":"나중에 연락해요"},{"word":"문자","collocation":"문자로 이야기해요"},{"word":"메시지","collocation":"메시지를 남겨요"},{"word":"부재중 전화","collocation":"부재중 전화를 보다"},{"word":"회의","collocation":"회의하고 있어요"},{"word":"수업","collocation":"수업을 듣고 있어요"},{"word":"약속","collocation":"영화 약속"},{"word":"운전하다","collocation":"운전하고 있어요"},{"word":"바쁘다","collocation":"지금 바빠요"},{"word":"끝나다","collocation":"수업이 끝나요"},{"word":"나중","collocation":"나중에 연락해요"},{"word":"오래","collocation":"오래 통화 못 해요"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-12-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-12/audio/vocabulary/chapter-12-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-12-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-12-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-12/audio/vocabulary/chapter-12-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-12-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='phone-grammar-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-12/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-12-grammar-01-example-01","script":"내일 세 시에 만나지요?"},{"id":"chapter-12-grammar-01-example-02","script":"토요일 세 시에 만나지요?"},{"id":"chapter-12-grammar-01-example-03","script":"오늘 저녁 일곱 시에 만나지요?"},
    {"id":"chapter-12-grammar-02-example-01","script":"지훈 씨 휴대폰이지요?"},{"id":"chapter-12-grammar-02-example-02","script":"민지 씨지요?"},{"id":"chapter-12-grammar-02-example-03","script":"하나 씨지요?"},
    {"id":"chapter-12-grammar-03-example-01","script":"지금 회의하고 있어요."},{"id":"chapter-12-grammar-03-example-02","script":"지금 도서관에 가고 있어요."},{"id":"chapter-12-grammar-03-example-03","script":"지금 수업을 듣고 있어요."},
    {"id":"chapter-12-grammar-04-example-01","script":"지금은 오래 통화 못 해요."},{"id":"chapter-12-grammar-04-example-02","script":"오래 통화 못 해요."},{"id":"chapter-12-grammar-04-example-03","script":"전화를 못 받아요."},
    {"id":"chapter-12-grammar-05-example-01","script":"운전하고 있어서 오래 통화 못 해요."},{"id":"chapter-12-grammar-05-example-02","script":"그 시간에는 아르바이트가 있어서 못 만나요."},{"id":"chapter-12-grammar-05-example-03","script":"지금 수업을 듣고 있어서 전화를 못 받아요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='invitation-call';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-12/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-12-dialogue-main-line-01","purpose":"主对话逐句","script":"여보세요. 민지 씨지요?","speaker":"F01／수아"},{"id":"chapter-12-dialogue-main-line-02","purpose":"主对话逐句","script":"네, 수아 씨. 지금 도서관에 가고 있어요. 무슨 일이에요?","speaker":"F02／민지"},{"id":"chapter-12-dialogue-main-line-03","purpose":"主对话逐句","script":"토요일 영화 약속이요. 토요일 세 시에 만나지요?","speaker":"F01／수아"},{"id":"chapter-12-dialogue-main-line-04","purpose":"主对话逐句","script":"아, 그런데 그 시간에는 아르바이트가 있어서 못 만나요.","speaker":"F02／민지"},{"id":"chapter-12-dialogue-main-line-05","purpose":"主对话逐句","script":"그래요? 그럼 아르바이트는 언제 끝나요?","speaker":"F01／수아"},{"id":"chapter-12-dialogue-main-line-06","purpose":"主对话逐句","script":"네 시 반에 끝나요.","speaker":"F02／민지"},{"id":"chapter-12-dialogue-main-line-07","purpose":"主对话逐句","script":"그럼 다섯 시에 만날까요?","speaker":"F01／수아"},{"id":"chapter-12-dialogue-main-line-08","purpose":"主对话逐句","script":"네, 다섯 시가 좋아요.","speaker":"F02／민지"},{"id":"chapter-12-dialogue-main-line-09","purpose":"主对话逐句","script":"좋아요. 영화관 앞에서 만나요.","speaker":"F01／수아"},{"id":"chapter-12-dialogue-main-line-10","purpose":"主对话逐句","script":"네, 알겠어요. 토요일에 봐요.","speaker":"F02／민지"},{"id":"chapter-12-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／F02"},
    {"id":"chapter-12-dialogue-alt-line-01","purpose":"第二对话逐句","script":"여보세요. 하나 씨지요?","speaker":"M01／준호"},{"id":"chapter-12-dialogue-alt-line-02","purpose":"第二对话逐句","script":"네, 맞아요. 누구세요?","speaker":"F03／하나"},{"id":"chapter-12-dialogue-alt-line-03","purpose":"第二对话逐句","script":"저 준호예요. 금요일에 같이 저녁을 먹을까요?","speaker":"M01／준호"},{"id":"chapter-12-dialogue-alt-line-04","purpose":"第二对话逐句","script":"네, 좋아요. 그런데 지금 수업을 듣고 있어요.","speaker":"F03／하나"},{"id":"chapter-12-dialogue-alt-line-05","purpose":"第二对话逐句","script":"아, 지금은 오래 통화 못 해요?","speaker":"M01／준호"},{"id":"chapter-12-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네, 수업을 듣고 있어서 오래 통화 못 해요.","speaker":"F03／하나"},{"id":"chapter-12-dialogue-alt-line-07","purpose":"第二对话逐句","script":"알겠어요. 그럼 수업 후에 문자로 이야기할까요?","speaker":"M01／준호"},{"id":"chapter-12-dialogue-alt-line-08","purpose":"第二对话逐句","script":"네, 좋아요. 수업은 다섯 시에 끝나요. 나중에 문자로 연락해요.","speaker":"F03／하나"},{"id":"chapter-12-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M01／F03"}
  ] $dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and activity.activity_key='listening-callback';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-12-listening-callback-normal','audio','私有听力正常语速','korean-level-one/chapter-12/listening/chapter-12-listening-callback-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F04／유나；F05／민지","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-12-listening-callback-slow','audio','私有听力慢速','korean-level-one/chapter-12/listening/chapter-12-listening-callback-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F04／유나；F05／민지","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_twelve$;

commit;
