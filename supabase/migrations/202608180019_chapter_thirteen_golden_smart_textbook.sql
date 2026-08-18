begin;

-- Converted from the read-only UPLY BOOK chapter-thirteen master.
-- source_sha256: b6718120ff84677b96ff98624cc29c74adf73b7cd093323d0b203eb89fd04646
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master as course-overview values pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_thirteen$
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
  if version_uuid is null then raise exception 'Cannot convert chapter 13: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id=lesson.course_id
  where course.slug='korean-beginner' and lesson.slug='basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 13: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug='korean-level-one-13' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id=lesson_uuid and chapter_number=13 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000013'::uuid,lesson_uuid,
      'korean-level-one-13','korean-level-one',13,
      '第 13 章测试：请带我去首尔站。','제13과 평가: 서울역으로 가 주세요.',
      '检查交通与方向词汇、出行意图、地点起终点、礼貌请求、方向与交通手段，以及路线对话、听力和出行备忘录理解。',
      12,60,
      '{"recognition":"交通、地点与方向词汇","structure":"意图、地点起终点、请求与方向手段形式","reading":"出租车对话、路线听力与出行备忘录理解","assembly":"双角色出行与路线交流组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id=lesson_uuid,slug='korean-level-one-13',course_key='korean-level-one',chapter_number=13,
      title='第 13 章测试：请带我去首尔站。',korean_title='제13과 평가: 서울역으로 가 주세요.',
      description='检查交通与方向词汇、出行意图、地点起终点、礼貌请求、方向与交通手段，以及路线对话、听力和出行备忘录理解。',
      duration_minutes=12,passing_score=60,
      skills='{"recognition":"交通、地点与方向词汇","structure":"意图、地点起终点、请求与方向手段形式","reading":"出租车对话、路线听力与出行备忘录理解","assembly":"双角色出行与路线交流组织"}'::jsonb,
      version=1,status='draft',student_app_id='10000000-0000-4000-8000-000000000001'::uuid,updated_at=now()
    where id=test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id=test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-13-01','在乘车场景中，“기사”是什么意思？','["司机","旅客","工作人员","朋友"]',0,'母本词汇表中기사为负责驾驶交通工具的司机。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-13-02','“먹다”怎样变成表示意图的本课形式？','["먹으려고 해요","먹려고 해요","먹어 주세요","먹으로 가요"]',0,'먹-末尾有非ㄹ收音，接-으려고 해요。','structure',2,'single_choice',10,'foundation','["意图","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-13-03','哪一句正确表示“从机场到首尔站”？','["공항에서 서울역까지","공항에 서울역까지","공항부터 서울역으로","공항을 서울역에서"]',0,'地点起点用에서，终点用까지。','structure',3,'single_choice',10,'foundation','["地点起终点","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-13-04','“세우다”怎样变成礼貌停车请求？','["세워 주세요","세우 주세요","세우려고 해요","세워로 가요"]',0,'세우다接-어时缩合为세워，再接주세요。','structure',4,'single_choice',10,'foundation','["礼貌请求","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-13-05','哪一句正确表示“坐地铁去”？','["지하철로 가요.","지하철으로 가요.","지하철을로 가요.","지하철에서 가요."]',0,'지하철末尾是ㄹ收音，按例外接로。','structure',5,'single_choice',10,'foundation','["交通手段","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-13-06','哪一句最适合请司机开往首尔站正门？','["정문으로 가 주세요.","정문에서 타려고 해요.","정문까지 기사예요.","정문을로 가세요."]',0,'정문으로表示方向，가 주세요礼貌请求司机行动。','structure',6,'single_choice',10,'foundation','["方向与请求","母本§5.3-5.4"]','draft',1,true,'STEP 03','母本 §§5.3—5.4'),
    (test_uuid,'golden-13-07','主场景中，从机场到首尔站大约需要多久？','["一小时左右","十分钟左右","两小时左右","三十分钟左右"]',0,'主对话第3轮说한 시간쯤 걸려요。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-13-08','私有听力中，宥娜最后请司机在哪里停车？','["首尔站1号出口前","首尔站正门","机场出租车乘车点","市厅站"]',0,'听力先限定1号出口，最后请求在出口前停车。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-13-09','阅读备忘录中，秀珍从学校到首尔站乘什么？','["出租车","公交车","地铁","火车"]',0,'备忘录原句为학교에서 서울역까지 택시로 가요。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-13-10','阅读备忘录中，秀珍十点准备乘什么？','["开往釜山的火车","机场公交","1号线地铁","出租车"]',0,'最后一行说明十点在首尔站乘开往釜山的火车。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-13-11','双角色路线交流的自然信息链是哪一项？','["说明意图与起终点→交通与方向→两项请求→对方确认→理解并礼貌结束","只报终点→单人持续说明→省略回应","先结束→再问目的地→不说明交通方式","只说交通工具→不提出请求或确认"]',0,'母本最终输出要求两角色围绕意图、路线、请求与确认形成连续交流。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-13-12','课末正式录音必须满足哪一项？','["45—60秒、8—10轮、双角色并覆盖九类信息","只朗读一条路线即可","必须获得自动发音分数","可以单人路线说明代替交流"]',0,'母本规定45—60秒、8—10轮、双角色和九类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id=version_uuid and (chapter_number=13 or slug='transportation')
  order by (slug='transportation') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'transportation',13,
      '{"zh-CN":"请带我去首尔站。","ko-KR":"서울역으로 가 주세요."}',
      '{"zh-CN":"秀珍从机场乘出租车前往首尔站并确认入口与停车位置；民浩在校园交通咨询台询问公交下车点、地铁换乘线和方向。","ko-KR":"수진은 공항에서 택시를 타고 서울역으로 가며 입구와 정차 장소를 확인합니다. 민호는 학교 교통 안내소에서 버스 하차 지점, 지하철 환승 노선과 방향을 묻습니다."}',
      '{"zh-CN":"说明出行意图、地点起终点、交通方式和方向，向司机或咨询人员礼貌请求，完成45—60秒、8—10轮双角色交流。","ko-KR":"이동 의도, 출발지와 도착지, 교통수단과 방향을 말하고 정중하게 부탁하여 45~60초, 8~10턴의 두 역할 대화를 완성합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第13课 서울역으로 가 주세요.md @ 2026-08-18 / sha256:b6718120ff84677b96ff98624cc29c74adf73b7cd093323d0b203eb89fd04646'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid,slug='transportation',chapter_number=13,
      title='{"zh-CN":"请带我去首尔站。","ko-KR":"서울역으로 가 주세요."}',
      scenario='{"zh-CN":"秀珍从机场乘出租车前往首尔站并确认入口与停车位置；民浩在校园交通咨询台询问公交下车点、地铁换乘线和方向。","ko-KR":"수진은 공항에서 택시를 타고 서울역으로 가며 입구와 정차 장소를 확인합니다. 민호는 학교 교통 안내소에서 버스 하차 지점, 지하철 환승 노선과 방향을 묻습니다."}',
      goal='{"zh-CN":"说明出行意图、地点起终点、交通方式和方向，向司机或咨询人员礼貌请求，完成45—60秒、8—10轮双角色交流。","ko-KR":"이동 의도, 출발지와 도착지, 교통수단과 방향을 말하고 정중하게 부탁하여 45~60초, 8~10턴의 두 역할 대화를 완성합니다."}',
      status='draft',production_status='editorial_review',editorial_status='pending',
      native_review_status='pending',audio_status='pending',image_status='pending',
      source_revision='UPLY BOOK 第13课 서울역으로 가 주세요.md @ 2026-08-18 / sha256:b6718120ff84677b96ff98624cc29c74adf73b7cd093323d0b203eb89fd04646',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"上车以后，怎样把目的地说清楚？","ko-KR":"택시를 탄 뒤 목적지를 어떻게 분명히 말할까요?"},"content":{"lead":{"zh-CN":"司机或咨询员需要知道目的地、出发点、路线、入口和停车位置。","ko-KR":"기사나 안내원에게 목적지, 출발점, 경로, 입구와 정차 장소를 말합니다."},"scene":{"people":"秀珍、出租车司机；民浩、交通咨询员","place":"机场出租车乘车点；校园交通咨询台","purpose":"说明计划并确认路线、入口和停车位置","imageStatus":"pending"},"targets":[{"ko":"서울역으로 가 주세요.","zh":"提出目的地请求"},{"ko":"공항에서 서울역까지 한 시간쯤 걸려요.","zh":"说明地点起终点"},{"ko":"역 앞에 세워 주세요.","zh":"请求停车"}],"finalOutput":{"zh-CN":"45—60秒、8—10轮双角色出行与路线交流。","ko-KR":"45~60초, 8~10턴의 두 역할 이동·길 안내 대화입니다."},"coach":{"zh-CN":"答对不计分的场景诊断即完成；复述课末任务为自主展示。","ko-KR":"점수 없는 장면 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"transport-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"node":"transport-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"把交通工具、地点和路线动作连起来","ko-KR":"교통수단, 장소와 이동 행동 연결하기"},"content":{"lead":{"zh-CN":"按看图认词、点读原形、跟读搭配、放进路线句的顺序学习；22词音频全部待制作。","ko-KR":"그림, 기본형, 결합, 경로 문장 순서로 익힙니다. 22개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"서울역","zh":"首尔站","pos":"专有名词","collocation":"서울역으로 가다"},{"ko":"공항","zh":"机场","pos":"名词","collocation":"공항에서 출발하다"},{"ko":"역","zh":"车站","pos":"名词","collocation":"역 앞에 세우다"},{"ko":"정문","zh":"正门","pos":"名词","collocation":"정문으로 가다"},{"ko":"출구","zh":"出口","pos":"名词","collocation":"1번 출구로 가다"},{"ko":"택시","zh":"出租车","pos":"名词","collocation":"택시를 타다"},{"ko":"버스","zh":"公交车","pos":"名词","collocation":"버스를 타다"},{"ko":"지하철","zh":"地铁","pos":"名词","collocation":"지하철로 가다"},{"ko":"기차","zh":"火车","pos":"名词","collocation":"기차를 타다"},{"ko":"호선","zh":"号线","pos":"名词","collocation":"1호선으로 갈아타다"},{"ko":"오른쪽","zh":"右边","pos":"名词","collocation":"오른쪽으로 가다"},{"ko":"왼쪽","zh":"左边","pos":"名词","collocation":"왼쪽으로 가다"},{"ko":"쪽","zh":"方向、边","pos":"名词","collocation":"어느 쪽으로 가다"},{"ko":"기사","zh":"司机","pos":"名词","collocation":"택시 기사님"},{"ko":"타다","zh":"乘坐","pos":"动词","collocation":"기차를 타다"},{"ko":"내리다","zh":"下车","pos":"动词","collocation":"시청역에서 내리다"},{"ko":"갈아타다","zh":"换乘","pos":"动词","collocation":"1호선으로 갈아타다"},{"ko":"출발하다","zh":"出发","pos":"动词","collocation":"학교 앞에서 출발하다"},{"ko":"도착하다","zh":"到达","pos":"动词","collocation":"서울역에 도착하다"},{"ko":"걸리다","zh":"花费时间","pos":"动词","collocation":"한 시간쯤 걸리다"},{"ko":"세우다","zh":"使停下、停车","pos":"动词","collocation":"역 앞에 세우다"},{"ko":"가다","zh":"去、走","pos":"动词","collocation":"서울역으로 가다"}],"studyFlow":["看图认词","点读原形","跟读自然搭配","放进路线句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；点读、图片快说和扩展搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"route-grammar-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":18,"node":"route-grammar-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"把计划、路线和请求说完整","ko-KR":"계획, 경로와 부탁을 완성하기"},"content":{"lead":{"zh-CN":"四个工具分别说明计划、地点起终点、礼貌请求，以及方向或交通手段。","ko-KR":"네 가지 도구로 계획, 장소 범위, 정중한 부탁, 방향과 수단을 말합니다."},"grammarCards":[{"form":"V-(으)려고 하다","function":{"zh-CN":"说明尚未实施的意图或计划。","ko-KR":"아직 하지 않은 의도나 계획을 말합니다."},"rules":["非ㄹ收音接-으려고 하다","无收音或ㄹ收音接-려고 하다","ㄹ收音不脱落","-(으)려고与词干连写，하다分写"],"examples":[{"ko":"서울역에서 부산행 기차를 타려고 해요.","zh":"打算在首尔站乘开往釜山的火车。","audioId":"chapter-13-grammar-01-example-01","audioStatus":"pending"},{"ko":"실례합니다. 서울역에 가려고 해요.","zh":"打扰一下，我打算去首尔站。","audioId":"chapter-13-grammar-01-example-02","audioStatus":"pending"},{"ko":"오전 열 시, 서울역에서 부산행 기차를 타려고 해요.","zh":"上午十点打算在首尔站乘开往釜山的火车。","audioId":"chapter-13-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"먹-有非ㄹ收音，应写먹으려고 해요。","ko-KR":"먹-은 받침이 있어 먹으려고 해요로 씁니다."},"comparison":{"zh-CN":"-려고 해요表示当前意图；-ㄹ 거예요也可说明未来计划。","ko-KR":"-려고 해요는 현재 의도, -ㄹ 거예요는 미래 계획도 나타냅니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"地点 N에서 N까지","function":{"zh-CN":"说明路线起点和终点。","ko-KR":"이동 경로의 출발점과 도착점을 말합니다."},"rules":["起点名词后接에서","终点名词后接까지","都与前面名词连写","本课操练要求两端都写出"],"examples":[{"ko":"공항에서 서울역까지 한 시간쯤 걸려요.","zh":"从机场到首尔站约一小时。","audioId":"chapter-13-grammar-02-example-01","audioStatus":"pending"},{"ko":"공항에서 서울역까지 한 시간쯤 걸려요.","zh":"从机场到首尔站约一小时。","audioId":"chapter-13-grammar-02-example-02","audioStatus":"pending"},{"ko":"학교에서 서울역까지 택시로 가요.","zh":"从学校坐出租车到首尔站。","audioId":"chapter-13-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"地点起点用에서，不用时间范围的부터。","ko-KR":"장소의 출발점에는 시간 범위의 부터가 아니라 에서를 씁니다."},"comparison":{"zh-CN":"地点用에서/까지；时间范围可用부터/까지。","ko-KR":"장소는 에서/까지, 시간은 부터/까지를 쓸 수 있습니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-아/어 주세요","function":{"zh-CN":"礼貌请求对方采取行动。","ko-KR":"상대에게 정중하게 행동을 부탁합니다."},"rules":["末元音ㅏ/ㅗ接-아 주세요","其他元音接-어 주세요","하다变해 주세요","补助用言原则上分写，也允许连写"],"examples":[{"ko":"서울역으로 가 주세요.","zh":"请带我去首尔站。","audioId":"chapter-13-grammar-03-example-01","audioStatus":"pending"},{"ko":"서울역으로 가 주세요.","zh":"请带我去首尔站。","audioId":"chapter-13-grammar-03-example-02","audioStatus":"pending"},{"ko":"출구 앞에 세워 주세요.","zh":"请在出口前停车。","audioId":"chapter-13-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"세우다接-어缩合为세워 주세요。","ko-KR":"세우다는 -어와 결합해 세워 주세요가 됩니다."},"comparison":{"zh-CN":"가 주세요是服务请求；가세요是礼貌指示或建议。","ko-KR":"가 주세요는 부탁, 가세요는 지시나 권유입니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"N-(으)로","function":{"zh-CN":"表示方向或交通手段。","ko-KR":"방향이나 교통수단을 나타냅니다."},"rules":["非ㄹ收音接으로","无收音或ㄹ收音接로","与名词连写","方向和手段由名词与场景判断"],"examples":[{"ko":"정문으로 가 주세요.","zh":"请开往正门。","audioId":"chapter-13-grammar-04-example-01","audioStatus":"pending"},{"ko":"네, 정문으로 가 주세요.","zh":"好的，请开往正门。","audioId":"chapter-13-grammar-04-example-02","audioStatus":"pending"},{"ko":"오른쪽으로 가세요.","zh":"请往右走。","audioId":"chapter-13-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"지하철以ㄹ收音结尾，应写지하철로。","ko-KR":"지하철은 ㄹ 받침이라 지하철로라고 씁니다."},"comparison":{"zh-CN":"서울역에突出目的地；서울역으로突出方向。","ko-KR":"서울역에는 목적지, 서울역으로는 방향을 강조합니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"八个目标空全部正确才完成；规则解释和扩展变形为自主练习。","ko-KR":"여덟 칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"route-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":12,"node":"route-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让上一句话决定下一句话","ko-KR":"앞말에 맞게 다음 말 이어 가기"},"content":{"lead":{"zh-CN":"通过计划、起终点与交通方式、请求与方向三组替换，再排列六个有明确问答和回指的话轮。","ko-KR":"계획, 출발·도착과 수단, 부탁과 방향을 바꾸고 여섯 말차례를 배열합니다."},"substitutions":[["서울역에서 기차를 타려고 해요.","공항에서 비행기를 타려고 해요.","학교 앞에서 버스를 타려고 해요."],["공항에서 서울역까지 택시로 가요.","학교에서 시청역까지 버스로 가요.","시청역에서 서울역까지 지하철로 가요."],["서울역으로 가 주세요.","정문으로 가 주세요.","역 앞에 세워 주세요."]],"practice":{"quickResponse":"同伴随机给计划、起终点、交通方式、方向或请求，3秒内回应。","personalOutput":"使用安全虚构信息说意图、路线和请求三句。","required":false},"coach":{"zh-CN":"六个完整话轮顺序完全正确才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례의 순서만 필수이며 바꾸기와 개인 표현은 자율 연습입니다."},"nextNode":"taxi-and-directions"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":13,"node":"taxi-and-directions","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"在出租车和咨询台完成真实行动","ko-KR":"택시와 안내소에서 실제 행동 완성하기"},"content":{"lead":{"zh-CN":"主场景确认目的地、时间、后续计划、入口和停车点；第二场景确认公交下车点、换乘线与方向。","ko-KR":"주 장면은 목적지, 시간, 다음 계획, 입구와 정차 장소를, 두 번째 장면은 하차, 환승과 방향을 확인합니다."},"dialogueScenes":[{"title":{"zh-CN":"机场出租车至首尔站","ko-KR":"공항 택시에서 서울역까지"},"people":"秀珍／出租车司机","place":"机场出租车乘车点至首尔站途中","purpose":"说明目的地与后续火车计划，确认正门和停车点","lines":[{"role":"기사","ko":"어서 오세요. 어디로 가세요?","zh":"欢迎乘坐。您去哪里？"},{"role":"수진","ko":"서울역으로 가 주세요.","zh":"请带我去首尔站。"},{"role":"기사","ko":"네. 공항에서 서울역까지 한 시간쯤 걸려요.","zh":"好的。从机场到首尔站大约一小时。"},{"role":"수진","ko":"네. 서울역에서 부산행 기차를 타려고 해요.","zh":"我打算在首尔站乘开往釜山的火车。"},{"role":"기사","ko":"그러면 서울역 정문으로 갈까요?","zh":"那么开往首尔站正门好吗？"},{"role":"수진","ko":"네, 정문으로 가 주세요.","zh":"好的，请开往正门。"},{"role":"기사","ko":"역 앞에 세울까요?","zh":"在车站前停车好吗？"},{"role":"수진","ko":"네, 역 앞에 세워 주세요. 감사합니다.","zh":"好的，请在车站前停车。谢谢。"}]},{"title":{"zh-CN":"校园交通咨询台","ko-KR":"학교 교통 안내소"},"people":"民浩／交通咨询员","place":"校园交通咨询台","purpose":"询问公交、下车点、换乘线与方向","lines":[{"role":"민호","ko":"실례합니다. 서울역에 가려고 해요. 여기에서 서울역까지 어떻게 가요?","zh":"打扰一下，我打算去首尔站。从这里怎么走？"},{"role":"안내원","ko":"학교 앞에서 273번 버스를 타세요.","zh":"请在学校前乘273路公交。"},{"role":"민호","ko":"어디에서 내려요?","zh":"在哪里下车？"},{"role":"안내원","ko":"시청역에서 내리세요. 그리고 1호선으로 갈아타세요.","zh":"在市厅站下车，然后换乘1号线。"},{"role":"민호","ko":"1호선 승강장은 어느 쪽이에요?","zh":"1号线站台在哪边？"},{"role":"안내원","ko":"오른쪽으로 가세요.","zh":"请往右走。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换和试录为自主练习。","ko-KR":"사실 조합과 자연스러운 대답을 모두 맞혀야 하며 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-travel"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":14,"node":"listen-and-travel","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听准停车点，再完成自己的路线交流","ko-KR":"정차 장소를 듣고 경로 대화 완성하기"},"content":{"lead":{"zh-CN":"两版听力真实制作并绑定后听出最后停车点，再提交45—60秒、8—10轮双角色录音。","ko-KR":"두 음원이 제작·연결된 뒤 마지막 정차 장소를 듣고 45~60초, 8~10턴 녹음을 제출합니다."},"speakingFrame":["어디로 가세요?／어디에 가려고 해요?","___에 가려고 해요. ___으로 가 주세요.","___에서 ___까지 ___쯤 걸려요.／어떻게 가요?","___에서 ___까지 ___로 가요.","___으로 갈까요?","네, ___으로 가 주세요. ___에 세워 주세요."],"requiredInformation":["出行意图","起点","终点","交通方式","方向","两项请求","确认问答","理解确认","礼貌结束"],"coach":{"zh-CN":"听力答对且开放口语达到提交门槛才完成；口语不产生正确性或分数。","ko-KR":"듣기 정답과 말하기 제출 조건이 모두 필요하며 말하기에는 정오나 점수가 없습니다."},"nextNode":"travel-note"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":13,"node":"travel-note","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读个人出行备忘录，写安全虚构行程","ko-KR":"개인 이동 메모를 읽고 가상 일정 쓰기"},"content":{"lead":{"zh-CN":"按时间找出乘车地点、交通方式、入口请求与后续行程，再以旅客写给自己为固定作者和读者写备忘录。","ko-KR":"시간 순서로 승차 장소, 수단, 입구 부탁과 다음 일정을 찾고 자신을 위한 메모를 씁니다."},"reading":"부산 여행 이동 메모\n09:00 학교 앞에서 택시를 타요.\n학교에서 서울역까지 택시로 가요.\n택시에서 말하기: ‘서울역 1번 출구로 가 주세요. 출구 앞에 세워 주세요.’\n10:00 서울역에서 부산행 기차를 타려고 해요.","writing":{"audience":"旅客本人","sentences":"6—8","required":["意图","起点","终点","交通方式","方向","两项请求","到达或后续行动"],"scaffold":"___에 가려고 해요. → ___에서 ___까지 ___로 가요. → ___에서 ___을/를 타요. → 택시에서 말하기: ‘___으로 가 주세요.’ → ‘___에 세워 주세요.’ → ___에 도착해요.","rubric":["信息完整","核心语法","路线与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读四题全对，并提交6—8句合格原创备忘录及量规自查才完成。","ko-KR":"읽기 네 문항 정답과 6~8문장 메모 및 점검이 모두 필요합니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能把计划、路线和请求连起来吗？","ko-KR":"계획, 경로와 부탁을 연결할 수 있나요?"},"content":{"lead":{"zh-CN":"综合多选检查形式与功能，再按真实表现回应五项Can-do并记录返回节点。","ko-KR":"복수 선택으로 형태와 기능을 확인하고 실제 수행에 따라 다섯 Can-do와 복습 노드를 기록합니다."},"reviewMap":[{"cause":"词汇","returnNode":"transport-words"},{"cause":"语法","returnNode":"route-grammar-tools"},{"cause":"理解","returnNode":"taxi-and-directions／listen-and-travel"},{"cause":"表达","returnNode":"listen-and-travel"},{"cause":"读写","returnNode":"travel-note"}],"coach":{"zh-CN":"综合多选正确，并完成五项自查与返回位置才完成；自主复习展示不计入强制条件。","ko-KR":"복수 선택 정답과 다섯 자기 점검 및 복습 위치 기록이 필요합니다."},"nextNode":"chapter-test:korean-level-one-13"}}
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
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"秀珍坐进出租车，要去首尔站。哪一句最适合先向司机说明目的地？","ko-KR":"수진이 택시를 타고 서울역에 가려고 합니다. 기사에게 목적지를 가장 알맞게 말한 것은 무엇이에요?"},"instruction":{"zh-CN":"选择同时包含目的地方向和礼貌行动请求的一句；本题不显示分数。","ko-KR":"목적지 방향과 정중한 행동 부탁이 함께 있는 문장을 고르세요. 점수는 표시하지 않습니다."},"options":["서울역으로 가 주세요.","감기에 걸렸어요.","이 옷이 얼마예요?","내일 비가 올 거예요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句同时说明首尔站方向并礼貌请求司机前往。","ko-KR":"서울역 방향과 기사에게 하는 정중한 부탁을 함께 말합니다."},"feedback":[{"zh-CN":"先找交通地点名称。","ko-KR":"교통 장소 이름을 먼저 찾으세요."},{"zh-CN":"目标句还要请司机采取行动。","ko-KR":"기사에게 행동을 부탁하는 형태도 필요합니다."},{"zh-CN":"应选择서울역으로 가 주세요.，意思是“请带我去首尔站”。","ko-KR":"정답은 서울역으로 가 주세요.입니다."}]}},
    {"node":"transport-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在기사님, 서울역으로 가 주세요.中，기사是什么意思？","ko-KR":"기사님, 서울역으로 가 주세요.에서 기사는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["旅客","司机","工作人员","朋友"],"config":{"shuffle":true,"example":"기사님, 서울역으로 가 주세요.","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true},"audioPending":true},"answer":{"kind":"index_confirmation","value":1},"explanation":{"correct":{"zh-CN":"交通场景中的기사指负责驾驶的人。","ko-KR":"교통 장면의 기사는 운전하는 사람입니다."},"feedback":[{"zh-CN":"看看乘客正在请谁开往首尔站。","ko-KR":"승객이 누구에게 서울역으로 가 달라고 하는지 보세요."},{"zh-CN":"这个人负责驾驶，不是乘车的人。","ko-KR":"이 사람은 타는 사람이 아니라 운전하는 사람입니다."},{"zh-CN":"答案是“司机”；整句是“司机师傅，请带我去首尔站”。","ko-KR":"정답은 기사입니다."}]}},
    {"node":"route-grammar-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成八个目标空，检查意图、地点起终点、礼貌请求、方向和交通手段。","ko-KR":"의도, 장소 범위, 정중한 부탁, 방향과 교통수단을 확인하는 여덟 칸을 완성하세요."},"instruction":{"zh-CN":"按每题公开指定的本课功能和形式作答，保留必要空格。","ko-KR":"각 문항에 제시된 이 과의 기능과 형태에 맞게 쓰고 필요한 띄어쓰기를 지키세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"먹다 → ___（用本课形式表达意图）","placeholder":"답을 입력하세요"},{"id":"item-02","label":"타다 → ___（用本课形式表达意图）","placeholder":"답을 입력하세요"},{"id":"item-03","label":"공항___ 서울역까지 가요.（地点起点）","placeholder":"답을 입력하세요"},{"id":"item-04","label":"공항에서 서울역___ 가요.（地点终点）","placeholder":"답을 입력하세요"},{"id":"item-05","label":"세우다 → ___（礼貌请求停车）","placeholder":"답을 입력하세요"},{"id":"item-06","label":"서울역___ 가 주세요.（方向）","placeholder":"답을 입력하세요"},{"id":"item-07","label":"지하철___ 가요.（交通手段）","placeholder":"답을 입력하세요"},{"id":"item-08","label":"오른쪽___ 가세요.（方向）","placeholder":"답을 입력하세요"}]},"answer":{"kind":"text_array","value":["먹으려고 해요","타려고 해요","에서","까지","세워 주세요","으로","로","으로"]},"explanation":{"correct":{"zh-CN":"八项形式全部正确；内部拼写和必要空格均保留。","ko-KR":"여덟 형태의 철자와 필요한 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先标记意图、起点、终点、请求、方向或手段。","ko-KR":"의도, 출발점, 도착점, 부탁, 방향이나 수단을 표시하세요."},{"zh-CN":"检查收音、从／到、세우다缩合和ㄹ收音例外。","ko-KR":"받침, 출발·도착, 세우다의 줄임과 ㄹ 예외를 확인하세요."},{"zh-CN":"依次为먹으려고 해요、타려고 해요、에서、까지、세워 주세요、으로、로、으로。","ko-KR":"차례대로 먹으려고 해요, 타려고 해요, 에서, 까지, 세워 주세요, 으로, 로, 으로입니다."}]}},
    {"node":"route-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段连贯的问路交流。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 길 안내 대화로 배열하세요."},"instruction":{"zh-CN":"根据问题、回答、显式回指和地点首次出现自行判断；卡片不标角色、步骤或位置。","ko-KR":"질문, 대답, 앞말 가리킴과 장소의 첫 등장을 바탕으로 판단하세요. 역할이나 단계는 표시하지 않습니다."},"options":["그럼 시청역에서는 몇 호선으로 갈아타요?","학교 앞에서는 273번 버스를 타고 시청역에서 내리세요.","실례합니다. 서울역에 가려고 해요.","시청역에서 1호선으로 갈아타세요.","서울역이 목적지예요? 어디에서 출발해요?","네, 학교 앞이에요. 그곳에서는 무엇을 타요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[2,4,5,1,0,3]},"explanation":{"correct":{"zh-CN":"目的地确认、네／그곳／그럼和逐级问答形成唯一连续链。","ko-KR":"목적지 확인, 네／그곳／그럼과 문답이 한 흐름을 만듭니다."},"feedback":[{"zh-CN":"检查目的地确认、네、그곳和그럼是否有明确先行信息。","ko-KR":"확인과 네, 그곳, 그럼의 앞말을 찾으세요."},{"zh-CN":"每个问题应由紧接的话轮直接回答。","ko-KR":"각 질문 바로 뒤에 직접 답하는 말을 놓으세요."},{"zh-CN":"系统依次检查目的地、出发地、乘车点、下车点和换乘线的相邻衔接。","ko-KR":"목적지, 출발지, 승차, 하차와 환승의 연결을 확인하세요."}]}},
    {"node":"taxi-and-directions","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景中，出租车从哪里到哪里，大约需要多久？","ko-KR":"주 장면에서 택시는 어디에서 어디까지 가고 시간은 얼마나 걸려요?"},"instruction":{"zh-CN":"选择起点、终点和大约时间都与台词一致的一组。","ko-KR":"출발점, 도착점과 대략적인 시간이 모두 같은 조합을 고르세요."},"options":["공항／서울역／한 시간쯤","학교／시청역／삼십 분쯤","서울역／공항／두 시간쯤","시청역／서울역／십 분쯤"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"第3轮原话是공항에서 서울역까지 한 시간쯤 걸려요。","ko-KR":"3턴에서 공항에서 서울역까지 한 시간쯤 걸린다고 합니다."},"feedback":[{"zh-CN":"找司机说明时间的那一轮。","ko-KR":"기사가 시간을 말하는 차례를 찾으세요."},{"zh-CN":"圈出에서前、까지前和쯤前的信息。","ko-KR":"에서, 까지와 쯤 앞의 정보를 찾으세요."},{"zh-CN":"正确组合是공항／서울역／한 시간쯤。","ko-KR":"정답은 공항／서울역／한 시간쯤입니다."}]}},
    {"node":"taxi-and-directions","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"司机问그러면 서울역 정문으로 갈까요?，哪一句最自然地确认方向并礼貌请求？","ko-KR":"기사가 그러면 서울역 정문으로 갈까요?라고 물었습니다. 가장 자연스러운 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择既回应正门方向又请司机按该方向行驶的一句。","ko-KR":"정문 방향에 답하면서 기사에게 그쪽으로 가 달라고 부탁하는 문장을 고르세요."},"options":["네, 정문으로 가 주세요.","아니요, 기차를 먹어요.","네, 공항에서 출발했어요?","오른쪽이 학생이에요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句肯定正门方向并用-아/어 주세요提出请求。","ko-KR":"정문 방향을 확인하고 -아/어 주세요로 부탁합니다."},"feedback":[{"zh-CN":"先找司机刚提到的入口方向。","ko-KR":"기사가 말한 입구 방향을 찾으세요."},{"zh-CN":"目标句还要有-아/어 주세요请求。","ko-KR":"-아/어 주세요 부탁도 필요합니다."},{"zh-CN":"应选择네, 정문으로 가 주세요.。","ko-KR":"정답은 네, 정문으로 가 주세요.입니다."}]}},
    {"node":"listen-and-travel","sort":1,"key":"listening-route","type":"listening","prompt":{"zh-CN":"听正常速或慢速音频，判断宥娜最后请司机在哪里停车。","ko-KR":"보통 속도나 느린 속도 음성을 듣고 유나가 마지막으로 부탁한 정차 장소를 고르세요."},"instruction":{"zh-CN":"正常速最多两遍、慢速最多一遍；依据最后一项停车请求作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번까지 듣고 마지막 정차 부탁에 답하세요."},"options":["서울역 1번 출구 앞","서울역 정문","공항 택시 승강장","시청역"],"config":{"shuffle":true,"audioStatus":"pending","normalPlays":2,"slowPlays":1,"tracks":[{"id":"track-01","label":"正常语速","audioId":"chapter-13-listening-route-normal","status":"pending"},{"id":"track-02","label":"慢速","audioId":"chapter-13-listening-route-slow","status":"pending"}]},"answer":{"kind":"index","value":0},"transcript":"기사: 어디로 가세요? 유나: 서울역으로 가 주세요. 서울역에서 부산행 기차를 타려고 해요. 기사: 네. 공항에서 서울역까지 한 시간쯤 걸려요. 유나: 네. 1번 출구 앞으로 가 주세요. 출구 앞에 세워 주세요.","audioObjectKey":"korean-level-one/chapter-13/listening/chapter-13-listening-route-normal.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是首尔站1号出口前；最后一句的出口由前一句限定。","ko-KR":"정답은 서울역 1번 출구 앞입니다."},"feedback":[{"zh-CN":"再听最后一句带세워 주세요的请求。","ko-KR":"세워 주세요가 있는 마지막 문장을 들으세요."},{"zh-CN":"停车在出口前，再听前一句的出口号码。","ko-KR":"출구 번호를 앞 문장에서 확인하세요."},{"zh-CN":"答案是서울역 1번 출구 앞。","ko-KR":"정답은 서울역 1번 출구 앞입니다."}],"privateListening":{"normalAudioId":"chapter-13-listening-route-normal","normalAudioObjectKey":"korean-level-one/chapter-13/listening/chapter-13-listening-route-normal.mp3","normalScript":"기사: 어디로 가세요? / 유나: 서울역으로 가 주세요. 서울역에서 부산행 기차를 타려고 해요. / 기사: 네. 공항에서 서울역까지 한 시간쯤 걸려요. / 유나: 네. 1번 출구 앞으로 가 주세요. 출구 앞에 세워 주세요.","slowAudioId":"chapter-13-listening-route-slow","slowAudioObjectKey":"korean-level-one/chapter-13/listening/chapter-13-listening-route-slow.mp3","slowScript":"기사: 어디로 가세요? / 유나: 서울역으로 가 주세요. / 서울역에서 부산행 기차를 타려고 해요. / 기사: 네. / 공항에서 서울역까지 한 시간쯤 걸려요. / 유나: 네. / 1번 출구 앞으로 가 주세요. / 출구 앞에 세워 주세요.","pauseMarks":"기사: 어디로 가세요? ⏸ 유나: 서울역으로 가 주세요. ⏸ 서울역에서 부산행 기차를 타려고 해요. ⏸ 기사: 네. ⏸ 공항에서 서울역까지 한 시간쯤 걸려요. ⏸ 유나: 네. ⏸ 1번 출구 앞으로 가 주세요. ⏸ 출구 앞에 세워 주세요.","speaker":"F03／유나；M03／기사","distractorReasons":["正门未在独立听力中出现。","机场是出发地。","市厅站属于第二对话。"]}}},
    {"node":"listen-and-travel","sort":2,"key":"speaking-route","type":"speaking","prompt":{"zh-CN":"完成45—60秒、8—10轮的双角色出行与路线交流。","ko-KR":"두 역할을 번갈아 맡아 45~60초 동안 8~10턴의 이동·길 안내 대화를 완성하세요."},"instruction":{"zh-CN":"加入意图、起点、终点、交通方式、方向、两项请求、确认问答、理解确认和礼貌结束。","ko-KR":"의도, 출발점, 도착점, 교통수단, 방향, 두 부탁, 확인 문답, 이해 확인과 마무리를 넣으세요."},"options":[],"config":{"minimumSeconds":45,"maximumSeconds":60,"minimumTurns":8,"maximumTurns":10,"rolesRequired":2,"requiredCriteria":9,"criteria":["出行意图","起点","终点","交通方式","方向","至少两项请求","一次确认问答","理解确认","礼貌结束"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存达到提交条件的原创录音；不产生正确性或分数。","ko-KR":"제출 조건을 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对九类信息和两个交替角色。","ko-KR":"아홉 정보와 두 역할을 확인하세요."},{"zh-CN":"检查方向确认—请求和停车确认—请求是否衔接。","ko-KR":"방향 확인과 부탁, 정차 확인과 부탁을 이어 보세요."},{"zh-CN":"按句框补齐缺项后重录；开放表达没有唯一台词。","ko-KR":"빠진 내용을 보완해 다시 녹음하세요."}]}},
    {"node":"travel-note","sort":1,"key":"reading-travel-note","type":"single_choice","prompt":{"zh-CN":"阅读秀珍的个人出行备忘录，完成四道事实题。","ko-KR":"수진의 개인 이동 메모를 읽고 사실 확인 네 문항에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，答案都能从公开备忘录直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 메모에서 직접 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"부산 여행 이동 메모 / 09:00 학교 앞에서 택시를 타요. / 학교에서 서울역까지 택시로 가요. / 택시에서 말하기: ‘서울역 1번 출구로 가 주세요. 출구 앞에 세워 주세요.’ / 10:00 서울역에서 부산행 기차를 타려고 해요.","items":[{"id":"q1","question":"어디에서 택시를 타요?","options":["학교 앞","공항","시청역","서울역 정문"]},{"id":"q2","question":"서울역까지 무엇으로 가요?","options":["택시","버스","지하철","기차"]},{"id":"q3","question":"몇 번 출구로 가요?","options":["1번","2번","9번","10번"]},{"id":"q4","question":"열 시에 무엇을 타려고 해요?","options":["부산행 기차","공항버스","1호선","자전거"]}]},"answer":{"kind":"index_array","value":[0,0,0,0]},"explanation":{"correct":{"zh-CN":"答案依次是学校前、出租车、1号、开往釜山的火车。","ko-KR":"정답은 학교 앞, 택시, 1번, 부산행 기차입니다."},"feedback":[{"zh-CN":"按时间圈出乘车地点、交通方式、出口号码和十点行动。","ko-KR":"승차 장소, 수단, 출구 번호와 열 시 행동을 찾으세요."},{"zh-CN":"不要混淆出租车目的地、停车位置和后续交通工具。","ko-KR":"목적지, 정차 장소와 다음 교통수단을 구별하세요."},{"zh-CN":"四题依次为학교 앞、택시、1번、부산행 기차。","ko-KR":"차례대로 학교 앞, 택시, 1번, 부산행 기차입니다."}]}},
    {"node":"travel-note","sort":2,"key":"write-travel-note","type":"writing","prompt":{"zh-CN":"以准备出行的旅客身份，为自己写一份6—8句安全虚构出行备忘录。","ko-KR":"이동을 준비하는 여행자가 되어 자신이 볼 6~8문장의 안전한 가상 이동 메모를 쓰세요."},"instruction":{"zh-CN":"保持旅客写给自己的单一作者与读者，写意图、起终点、交通方式、方向、两项请求和后续行动，并完成量规自查。","ko-KR":"여행자가 자신에게 쓰는 메모로 의도, 출발·도착, 수단, 방향, 두 부탁과 다음 행동을 쓰고 점검하세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":50,"minimumInformationKinds":7,"informationChecklist":["出行意图","起点","终点与交通方式","方向","第一项请求","第二项请求","后续行动并完成量规自查"],"requiredPhraseGroups":[["려고 해요"],["에서"],["까지"],["로 가요","으로 가요"],["가 주세요"],["세워 주세요"]],"minimumPhraseGroups":6,"requireCompletionChecklist":true,"scaffold":"___에 가려고 해요. → ___에서 ___까지 ___로 가요. → ___에서 ___을/를 타요. → 택시에서 말하기: ‘___으로 가 주세요.’ → ‘___에 세워 주세요.’ → ___에 도착해요.","rubric":["信息完整","核心语法","路线与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、规定信息和量规自查的原创备忘录；不产生正确性或分数。","ko-KR":"문장 수, 필수 정보와 점검을 갖춘 메모를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对作者和读者始终是同一名旅客，再数七类信息。","ko-KR":"같은 여행자가 자신에게 쓰는지 보고 정보를 세세요."},{"zh-CN":"检查四项核心语法，删除司机回答或其他角色声音。","ko-KR":"네 문법을 확인하고 다른 역할의 말을 지우세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀을 따라 빠진 내용을 보완하되 예시를 베끼지 마세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的句子。","ko-KR":"형태가 바르고 괄호의 기능을 알맞게 나타내는 문장을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 문장을 모두 고르고 틀린 문장은 고르지 마세요."},"options":["서울역에 가려고 해요.（意图）","공항에서 서울역까지 가요.（地点起终点）","기사님, 서울역으로 가 주세요.（方向＋礼貌请求）","지하철을로 가요.（交通手段）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三项正确；第4项应为지하철로 가요。","ko-KR":"앞의 세 문장이 맞고 4번은 지하철로 가요입니다."},"feedback":[{"zh-CN":"检查意图词尾、起终点助词、请求形式和交通手段助词。","ko-KR":"의도, 장소 범위, 부탁과 수단 조사를 확인하세요."},{"zh-CN":"只有一项把宾格助词和로错误叠加。","ko-KR":"한 항목만 목적격 조사와 로를 겹쳐 썼습니다."},{"zh-CN":"正确项是第1、2、3项；第4项改为지하철로 가요。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据刚才的实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"방금 한 실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"intention","label":"我能说明准备去哪里或乘什么／어디에 가거나 무엇을 탈지 말할 수 있어요"},{"id":"route","label":"我能说明地点起点和终点／장소의 출발점과 도착점을 말할 수 있어요"},{"id":"direction","label":"我能说明方向和交通方式／방향과 교통수단을 말할 수 있어요"},{"id":"request","label":"我能向司机或咨询员礼貌请求／기사나 안내원에게 정중하게 부탁할 수 있어요"},{"id":"route-task","label":"我能完成45—60秒、8—10轮双角色交流／45~60초, 8~10턴의 대화를 할 수 있어요"}],"returnNodes":[{"value":"transport-words","label":"词汇"},{"value":"route-grammar-tools","label":"语法"},{"value":"taxi-and-directions","label":"对话理解"},{"value":"listen-and-travel","label":"听说"},{"value":"travel-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想意图、路线、方向、请求和完整双角色交流。","ko-KR":"의도, 경로, 방향, 부탁과 두 역할 대화를 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 13 node %',item->>'node'; end if;
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
      'dialogue-fact-check','dialogue-response','listening-route',
      'speaking-route','reading-travel-note','write-travel-note',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where media.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-13-image-01","purpose":"章节情境主图","file":"chapter-13-01-scene.png","path":"../附件/韩国语1级/第13课/第13课-01-章节情境主图.png","alt":"机场出租车乘车点，旅客向司机说明目的地。","width":1600,"height":900},
    {"node":"transport-words","key":"chapter-13-image-02","purpose":"核心词汇交通与方向卡","file":"chapter-13-02-vocabulary.png","path":"../附件/韩国语1级/第13课/第13课-02-核心词汇卡-交通与方向.png","alt":"交通工具、地点、入口、方向和停车动作九格卡。","width":1200,"height":900},
    {"node":"route-grammar-tools","key":"chapter-13-image-03","purpose":"计划路线请求语法总图","file":"chapter-13-03-grammar-overview.png","path":"../附件/韩国语1级/第13课/第13课-03-语法总图-计划路线请求.png","alt":"意图、起终点、请求、方向与手段四条结构轨道。","width":1600,"height":900},
    {"node":"route-grammar-tools","key":"chapter-13-image-04","purpose":"意图形式结构图","file":"chapter-13-03a-intention.png","path":"../附件/韩国语1级/第13课/第13课-03A-语法结构图-으려고하다.png","alt":"有无收音和ㄹ收音分流到으려고或려고 하다。","width":1200,"height":900},
    {"node":"route-grammar-tools","key":"chapter-13-image-05","purpose":"地点起终点结构图","file":"chapter-13-03b-from-to.png","path":"../附件/韩国语1级/第13课/第13课-03B-语法结构图-에서까지.png","alt":"地点起点与终点分别连接에서和까지。","width":1200,"height":900},
    {"node":"route-grammar-tools","key":"chapter-13-image-06","purpose":"礼貌请求结构图","file":"chapter-13-03c-request.png","path":"../附件/韩国语1级/第13课/第13课-03C-语法结构图-아어주세요.png","alt":"动词末元音分流并连接주세요。","width":1200,"height":900},
    {"node":"route-grammar-tools","key":"chapter-13-image-07","purpose":"方向与交通手段结构图","file":"chapter-13-03d-euro-ro.png","path":"../附件/韩国语1级/第13课/第13课-03D-语法结构图-으로로.png","alt":"一般收音、无收音和ㄹ收音选择으로或로。","width":1200,"height":900},
    {"node":"route-builder","key":"chapter-13-image-08","purpose":"路线完整话轮卡","file":"chapter-13-04-pattern-blocks.png","path":"../附件/韩国语1级/第13课/第13课-04-句型路线话轮卡.png","alt":"六张无角色、步骤、箭头或顺序标记的完整话轮卡。","width":1200,"height":900},
    {"node":"taxi-and-directions","key":"chapter-13-image-09","purpose":"实战对话双场景图","file":"chapter-13-05-dialogue.png","path":"../附件/韩国语1级/第13课/第13课-05-实战对话场景.png","alt":"机场出租车与校园交通咨询台两个独立场景。","width":1600,"height":900},
    {"node":"listen-and-travel","key":"chapter-13-image-10","purpose":"停车位置听力信息图","file":"chapter-13-06-listening.png","path":"../附件/韩国语1级/第13课/第13课-06-听力信息图-停车位置.png","alt":"正门、1号出口前、机场乘车点和市厅站四张无文字卡。","width":1200,"height":900},
    {"node":"travel-note","key":"chapter-13-image-11","purpose":"个人出行备忘录版式","file":"chapter-13-07-travel-note.png","path":"../附件/韩国语1级/第13课/第13课-07-个人出行备忘录.png","alt":"手机备忘录的标题、时间与请求版式。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-13-image-12","purpose":"最终出行交流任务图","file":"chapter-13-08-final-task.png","path":"../附件/韩国语1级/第13课/第13课-08-最终任务图.png","alt":"出行交流九类信息检查图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-13/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='transport-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"서울역","collocation":"서울역으로 가다"},{"word":"공항","collocation":"공항에서 출발하다"},{"word":"역","collocation":"역 앞에 세우다"},{"word":"정문","collocation":"정문으로 가다"},{"word":"출구","collocation":"1번 출구로 가다"},{"word":"택시","collocation":"택시를 타다"},{"word":"버스","collocation":"버스를 타다"},{"word":"지하철","collocation":"지하철로 가다"},{"word":"기차","collocation":"기차를 타다"},{"word":"호선","collocation":"1호선으로 갈아타다"},{"word":"오른쪽","collocation":"오른쪽으로 가다"},{"word":"왼쪽","collocation":"왼쪽으로 가다"},{"word":"쪽","collocation":"어느 쪽으로 가다"},{"word":"기사","collocation":"택시 기사님"},{"word":"타다","collocation":"기차를 타다"},{"word":"내리다","collocation":"시청역에서 내리다"},{"word":"갈아타다","collocation":"1호선으로 갈아타다"},{"word":"출발하다","collocation":"학교 앞에서 출발하다"},{"word":"도착하다","collocation":"서울역에 도착하다"},{"word":"걸리다","collocation":"한 시간쯤 걸리다"},{"word":"세우다","collocation":"역 앞에 세우다"},{"word":"가다","collocation":"서울역으로 가다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-13-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-13/audio/vocabulary/chapter-13-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-13-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-13-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-13/audio/vocabulary/chapter-13-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-13-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='route-grammar-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-13/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-13-grammar-01-example-01","script":"서울역에서 부산행 기차를 타려고 해요."},{"id":"chapter-13-grammar-01-example-02","script":"실례합니다. 서울역에 가려고 해요."},{"id":"chapter-13-grammar-01-example-03","script":"오전 열 시, 서울역에서 부산행 기차를 타려고 해요."},
    {"id":"chapter-13-grammar-02-example-01","script":"공항에서 서울역까지 한 시간쯤 걸려요."},{"id":"chapter-13-grammar-02-example-02","script":"공항에서 서울역까지 한 시간쯤 걸려요."},{"id":"chapter-13-grammar-02-example-03","script":"학교에서 서울역까지 택시로 가요."},
    {"id":"chapter-13-grammar-03-example-01","script":"서울역으로 가 주세요."},{"id":"chapter-13-grammar-03-example-02","script":"서울역으로 가 주세요."},{"id":"chapter-13-grammar-03-example-03","script":"출구 앞에 세워 주세요."},
    {"id":"chapter-13-grammar-04-example-01","script":"정문으로 가 주세요."},{"id":"chapter-13-grammar-04-example-02","script":"네, 정문으로 가 주세요."},{"id":"chapter-13-grammar-04-example-03","script":"오른쪽으로 가세요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='taxi-and-directions';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-13/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-13-dialogue-main-line-01","purpose":"主对话逐句","script":"어서 오세요. 어디로 가세요?","speaker":"M01／기사"},{"id":"chapter-13-dialogue-main-line-02","purpose":"主对话逐句","script":"서울역으로 가 주세요.","speaker":"F01／수진"},{"id":"chapter-13-dialogue-main-line-03","purpose":"主对话逐句","script":"네. 공항에서 서울역까지 한 시간쯤 걸려요.","speaker":"M01／기사"},{"id":"chapter-13-dialogue-main-line-04","purpose":"主对话逐句","script":"네. 서울역에서 부산행 기차를 타려고 해요.","speaker":"F01／수진"},{"id":"chapter-13-dialogue-main-line-05","purpose":"主对话逐句","script":"그러면 서울역 정문으로 갈까요?","speaker":"M01／기사"},{"id":"chapter-13-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 정문으로 가 주세요.","speaker":"F01／수진"},{"id":"chapter-13-dialogue-main-line-07","purpose":"主对话逐句","script":"역 앞에 세울까요?","speaker":"M01／기사"},{"id":"chapter-13-dialogue-main-line-08","purpose":"主对话逐句","script":"네, 역 앞에 세워 주세요. 감사합니다.","speaker":"F01／수진"},{"id":"chapter-13-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-13-dialogue-alt-line-01","purpose":"第二对话逐句","script":"실례합니다. 서울역에 가려고 해요. 여기에서 서울역까지 어떻게 가요?","speaker":"M02／민호"},{"id":"chapter-13-dialogue-alt-line-02","purpose":"第二对话逐句","script":"학교 앞에서 273번 버스를 타세요.","speaker":"F02／안내원"},{"id":"chapter-13-dialogue-alt-line-03","purpose":"第二对话逐句","script":"어디에서 내려요?","speaker":"M02／민호"},{"id":"chapter-13-dialogue-alt-line-04","purpose":"第二对话逐句","script":"시청역에서 내리세요. 그리고 1호선으로 갈아타세요.","speaker":"F02／안내원"},{"id":"chapter-13-dialogue-alt-line-05","purpose":"第二对话逐句","script":"1호선 승강장은 어느 쪽이에요?","speaker":"M02／민호"},{"id":"chapter-13-dialogue-alt-line-06","purpose":"第二对话逐句","script":"오른쪽으로 가세요.","speaker":"F02／안내원"},{"id":"chapter-13-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"M02／F02"}
  ] $dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and activity.activity_key='listening-route';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-13-listening-route-normal','audio','私有听力正常语速','korean-level-one/chapter-13/listening/chapter-13-listening-route-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F03／유나；M03／기사","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-13-listening-route-slow','audio','私有听力慢速','korean-level-one/chapter-13/listening/chapter-13-listening-route-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F03／유나；M03／기사","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_thirteen$;

commit;
