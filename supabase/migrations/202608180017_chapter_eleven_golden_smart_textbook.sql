begin;

-- Converted from the read-only UPLY BOOK chapter-eleven master.
-- source_sha256: e4fac0bc66c428709148500df1bce24bc16458bd576806850be0f8cd305ee207
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master and remain pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_eleven$
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
  if version_uuid is null then raise exception 'Cannot convert chapter 11: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id=lesson.course_id
  where course.slug='korean-beginner' and lesson.slug='basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 11: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug='korean-level-one-11' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id=lesson_uuid and chapter_number=11 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000011'::uuid,lesson_uuid,
      'korean-level-one-11','korean-level-one',11,
      '第 11 章测试：感冒了。','제11과 평가: 감기에 걸렸어요.',
      '检查身体部位、症状与照护词汇，ㅡ脱落、禁止、限定和义务表达，以及健康咨询、听力和健康卡理解。',
      12,60,
      '{"recognition":"身体部位、症状与照护词汇","structure":"ㅡ脱落、禁止、限定与义务形式","reading":"健康咨询、听力与健康卡理解","assembly":"双角色健康咨询组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id=lesson_uuid,slug='korean-level-one-11',course_key='korean-level-one',chapter_number=11,
      title='第 11 章测试：感冒了。',korean_title='제11과 평가: 감기에 걸렸어요.',
      description='检查身体部位、症状与照护词汇，ㅡ脱落、禁止、限定和义务表达，以及健康咨询、听力和健康卡理解。',
      duration_minutes=12,passing_score=60,
      skills='{"recognition":"身体部位、症状与照护词汇","structure":"ㅡ脱落、禁止、限定与义务形式","reading":"健康咨询、听力与健康卡理解","assembly":"双角色健康咨询组织"}'::jsonb,
      version=1,status='draft',student_app_id='10000000-0000-4000-8000-000000000001'::uuid,updated_at=now()
    where id=test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id=test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-11-01','“열”在健康场景中是什么意思？','["发热","咳嗽","药","喉咙"]',0,'母本词汇表中열表示发热，常用搭配是열이 나다。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-11-02','“아프다”的日常礼貌体是哪一项？','["아파요","아프어요","아프요","아파어요"]',0,'아프다接-아/어요时ㅡ脱落，形成아파요。','structure',2,'single_choice',10,'foundation','["ㅡ脱落","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-11-03','“쓰다”的日常礼貌体是哪一项？','["써요","쓰어요","쓰요","싸요"]',0,'单音节ㅡ词干没有前一音节时去ㅡ后接어요，形成써요。','structure',3,'single_choice',10,'foundation','["ㅡ脱落","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-11-04','哪一句正确表示“今天请不要运动”？','["오늘은 운동하지 마세요.","오늘은 운동 안 하세요.","오늘은 운동지 마세요.","오늘은 운동하지 먹어요."]',0,'动词词干后直接接-지 마세요，形成운동하지 마세요。','structure',4,'single_choice',10,'foundation','["禁止","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-11-05','哪一句正确表示“只吃粥”？','["죽만 먹어요.","죽을만 먹어요.","죽도만 먹어요.","죽를 먹어요."]',0,'만在宾语位置通常替代을/를，写作죽만。','structure',5,'single_choice',10,'foundation','["限定","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-11-06','哪一句正确表示“必须吃药”？','["약을 먹어야 돼요.","약을 먹어야 되요.","약을 먹지 마세요.","약만 안 먹어요."]',0,'먹다接-어야 돼요，标准拼写为먹어야 돼요。','structure',6,'single_choice',10,'foundation','["义务","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-11-07','主场景中，王明的症状何时开始，发热程度怎样？','["昨天开始／有一点发热","今天开始／发热很多","早晨开始／咳嗽一点","夜里开始／喉咙很疼"]',0,'主对话第2轮说어제부터，第4轮说열이 조금 나고。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-11-08','私有听力中，保健老师让智秀不要做什么？','["吃冷食","吃药","休息","喝温水"]',0,'听力最后一句明确说찬 음식을 먹지 마세요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-11-09','健康卡中的俊浩哪里不舒服？','["肚子","头","喉咙","鼻子"]',0,'健康卡症状栏写有아침부터 배가 아파요。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-11-10','健康卡建议俊浩午饭只吃什么？','["温热的粥","辛辣食物","冷食","药"]',0,'健康卡明确写점심에는 따뜻한 죽만 먹으세요。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-11-11','双角色健康咨询的自然信息顺序是哪一项？','["询问不适→说明开始时间和症状→确认程度→义务与禁止建议→限定行动→理解并结束","先结束→再问症状→只列药名","只做单人症状独白","先给无关建议→不确认理解"]',0,'母本最终输出要求问症状、确认、建议、限定、理解和礼貌结束自然衔接。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-11-12','课末健康咨询必须满足哪一项？','["40—55秒、8—10轮、双角色并覆盖九类信息","只说一个症状即可","必须获得自动发音分数","复制主对话即可"]',0,'母本规定40—55秒、8—10轮、双角色和九类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id=version_uuid and (chapter_number=11 or slug='health')
  order by (slug='health') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'health',11,
      '{"zh-CN":"感冒了。","ko-KR":"감기에 걸렸어요."}',
      '{"zh-CN":"王明在校园保健室说明感冒症状并确认照护建议；敏智在宿舍提醒肚子不舒服的宥娜避开辛辣食物并吃温热的粥。","ko-KR":"왕밍은 학교 보건실에서 감기 증상을 설명하고 건강 안내를 확인하며 민지는 기숙사에서 배가 아픈 유나에게 매운 음식을 피하고 따뜻한 죽을 먹으라고 말합니다."}',
      '{"zh-CN":"说明开始时间、至少三项症状和程度，使用禁止、限定与义务表达，完成40—55秒、8—10轮双角色健康咨询。","ko-KR":"아프기 시작한 때와 세 가지 이상의 증상, 정도를 말하고 금지, 한정과 의무 표현으로 40~55초, 8~10턴의 두 역할 건강 상담을 합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第11课 감기에 걸렸어요.md @ 2026-08-18 / sha256:e4fac0bc66c428709148500df1bce24bc16458bd576806850be0f8cd305ee207'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid,slug='health',chapter_number=11,
      title='{"zh-CN":"感冒了。","ko-KR":"감기에 걸렸어요."}',
      scenario='{"zh-CN":"王明在校园保健室说明感冒症状并确认照护建议；敏智在宿舍提醒肚子不舒服的宥娜避开辛辣食物并吃温热的粥。","ko-KR":"왕밍은 학교 보건실에서 감기 증상을 설명하고 건강 안내를 확인하며 민지는 기숙사에서 배가 아픈 유나에게 매운 음식을 피하고 따뜻한 죽을 먹으라고 말합니다."}',
      goal='{"zh-CN":"说明开始时间、至少三项症状和程度，使用禁止、限定与义务表达，完成40—55秒、8—10轮双角色健康咨询。","ko-KR":"아프기 시작한 때와 세 가지 이상의 증상, 정도를 말하고 금지, 한정과 의무 표현으로 40~55초, 8~10턴의 두 역할 건강 상담을 합니다."}',
      status='draft',production_status='editorial_review',editorial_status='pending',
      native_review_status='pending',audio_status='pending',image_status='pending',
      source_revision='UPLY BOOK 第11课 감기에 걸렸어요.md @ 2026-08-18 / sha256:e4fac0bc66c428709148500df1bce24bc16458bd576806850be0f8cd305ee207',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"不舒服时，怎样把情况说清楚？","ko-KR":"아플 때 상황을 어떻게 분명히 말할까요?"},"content":{"lead":{"zh-CN":"只说“病了”还不够，需要说明开始时间、症状与程度，才能听懂对应建议。","ko-KR":"아프다는 말만 하지 않고 시작한 때, 증상과 정도를 말해 알맞은 안내를 이해합니다."},"scene":{"people":"王明、保健老师","place":"校园保健室","purpose":"说明症状并确认必须、禁止和限定行动","imageStatus":"pending"},"targets":[{"ko":"어제부터 머리가 아파요.","zh":"说明开始时间和症状"},{"ko":"열이 조금 나요.","zh":"说明程度"},{"ko":"약을 먹어야 돼요.","zh":"听懂义务建议"}],"finalOutput":{"zh-CN":"40—55秒、8—10轮双角色健康咨询，包含九类规定信息。","ko-KR":"아홉 가지 필수 정보를 포함한 40~55초, 8~10턴의 두 역할 건강 상담입니다."},"coach":{"zh-CN":"答对不计分的场景诊断即完成；复述课末任务为自主展示。","ko-KR":"점수 없는 상황 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"symptom-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":10,"node":"symptom-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"把身体部位、症状和照护动作配起来","ko-KR":"신체 부위, 증상과 돌봄 행동 연결하기"},"content":{"lead":{"zh-CN":"按看图认词、点读原形、跟读搭配、放进症状或医嘱句的顺序学习；20词音频全部待制作。","ko-KR":"그림, 기본형, 결합, 증상·안내 문장 순서로 익힙니다. 20개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"머리","zh":"头","pos":"名词","collocation":"머리가 아프다"},{"ko":"목","zh":"喉咙、脖子","pos":"名词","collocation":"목이 아프다"},{"ko":"배","zh":"肚子","pos":"名词","collocation":"배가 아프다"},{"ko":"코","zh":"鼻子","pos":"名词","collocation":"코가 막히다"},{"ko":"열","zh":"发热、热度","pos":"名词","collocation":"열이 나다"},{"ko":"기침","zh":"咳嗽","pos":"名词","collocation":"기침을 하다"},{"ko":"감기","zh":"感冒","pos":"名词","collocation":"감기에 걸리다"},{"ko":"증상","zh":"症状","pos":"名词","collocation":"증상을 말하다"},{"ko":"약","zh":"药","pos":"名词","collocation":"약을 먹다"},{"ko":"보건실","zh":"保健室","pos":"名词","collocation":"보건실에 가다"},{"ko":"병원","zh":"医院","pos":"名词","collocation":"병원에 가다"},{"ko":"아프다","zh":"疼、不舒服","pos":"形容词","collocation":"머리가 아프다"},{"ko":"나다","zh":"出现、发（热）","pos":"动词","collocation":"열이 나다"},{"ko":"막히다","zh":"堵、鼻塞","pos":"动词","collocation":"코가 막히다"},{"ko":"걸리다","zh":"患上、染上","pos":"动词","collocation":"감기에 걸리다"},{"ko":"먹다","zh":"吃、服用","pos":"动词","collocation":"약을 먹다"},{"ko":"마시다","zh":"喝","pos":"动词","collocation":"물을 마시다"},{"ko":"쉬다","zh":"休息","pos":"动词","collocation":"푹 쉬다"},{"ko":"운동하다","zh":"运动","pos":"动词","collocation":"운동하지 마세요"},{"ko":"푹","zh":"好好地、充分地","pos":"副词","collocation":"푹 쉬다"}],"studyFlow":["看图认词","点读原形","跟读自然搭配","放入症状或医嘱句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；20词点读、图片快说和另说搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"health-advice-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":18,"node":"health-advice-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"说明疼痛，听懂必须、禁止和“只”","ko-KR":"통증, 의무, 금지와 한정 이해하기"},"content":{"lead":{"zh-CN":"四个工具分别处理ㅡ词干、礼貌禁止、范围限定和必须采取的行动。","ko-KR":"네 도구로 ㅡ 어간, 금지, 한정과 꼭 해야 할 행동을 표현합니다."},"grammarCards":[{"form":"ㅡ脱落","function":{"zh-CN":"把ㅡ结尾词干变成自然日常礼貌体。","ko-KR":"ㅡ로 끝나는 어간을 자연스러운 해요체로 바꿉니다."},"rules":["接-아/어요前去掉ㅡ","看前一个音节元音","ㅏ／ㅗ接아요，其他接어요","单音节无前一音节时接어요"],"examples":[{"ko":"머리가 아파요.","zh":"头疼。","audioId":"chapter-11-grammar-01-example-01","audioStatus":"pending"},{"ko":"어제부터 머리가 아프고 목도 아파요.","zh":"从昨天开始头疼，喉咙也疼。","audioId":"chapter-11-grammar-01-example-02","audioStatus":"pending"},{"ko":"아침부터 배가 아파요.","zh":"从早上开始肚子疼。","audioId":"chapter-11-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写아파요，不写아프어요。","ko-KR":"아프어요가 아니라 아파요입니다."},"comparison":{"zh-CN":"具体部位疼痛用아파요；몸이 안 좋아요只笼统说明状态。","ko-KR":"아파요는 구체적 통증, 몸이 안 좋아요는 전반적 상태입니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-지 마세요","function":{"zh-CN":"礼貌禁止或劝阻听话人。","ko-KR":"상대에게 어떤 행동을 하지 말라고 정중히 말합니다."},"rules":["动词词干后直接接-지 마세요","不按收音分流","-지与词干连写","마세요与前项分写"],"examples":[{"ko":"오늘은 운동하지 마세요.","zh":"今天请不要运动。","audioId":"chapter-11-grammar-02-example-01","audioStatus":"pending"},{"ko":"오늘은 운동하지 마세요.","zh":"今天请不要运动。","audioId":"chapter-11-grammar-02-example-02","audioStatus":"pending"},{"ko":"매운 음식을 먹지 마세요.","zh":"请不要吃辛辣食物。","audioId":"chapter-11-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"普通否定안 하세요不能稳定表达本课的礼貌禁止。","ko-KR":"안 하세요는 이 과의 정중한 금지 표현을 대신하지 않습니다."},"comparison":{"zh-CN":"운동하지 마세요是劝阻；운동을 안 해요是陈述不运动。","ko-KR":"운동하지 마세요는 금지, 운동을 안 해요는 사실 진술입니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"N만","function":{"zh-CN":"限定食物、时间或地点为“只、仅”。","ko-KR":"음식, 시간이나 장소의 범위를 한정합니다."},"rules":["만直接接名词","宾语位置通常替代을/를","地点助词后可再接만","核对现实建议是否自然"],"examples":[{"ko":"점심에는 따뜻한 죽만 먹으세요.","zh":"午饭请只吃温热的粥。","audioId":"chapter-11-grammar-03-example-01","audioStatus":"pending"},{"ko":"네. 점심에는 죽만 먹고 푹 쉴 거예요.","zh":"好的。午饭我只吃粥，然后好好休息。","audioId":"chapter-11-grammar-03-example-02","audioStatus":"pending"},{"ko":"점심에는 따뜻한 죽만 먹으세요.","zh":"午饭请只吃温热的粥。","audioId":"chapter-11-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"写죽만，不写죽을만。","ko-KR":"죽을만이 아니라 죽만입니다."},"comparison":{"zh-CN":"죽만排除其他食物；죽도包含粥和其他食物。","ko-KR":"죽만은 한정, 죽도는 추가입니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-아야/어야 돼요","function":{"zh-CN":"表达必须或有必要做。","ko-KR":"꼭 해야 하거나 필요한 행동을 말합니다."},"rules":["ㅏ／ㅗ接-아야 돼요","其他元音接-어야 돼요","하다变해야 돼요","标准拼写是돼요"],"examples":[{"ko":"약을 먹어야 돼요.","zh":"必须吃药。","audioId":"chapter-11-grammar-04-example-01","audioStatus":"pending"},{"ko":"약을 먹어야 돼요.","zh":"必须吃药。","audioId":"chapter-11-grammar-04-example-02","audioStatus":"pending"},{"ko":"오늘은 약을 먹고 푹 쉬어야 돼요.","zh":"今天要吃药并好好休息。","audioId":"chapter-11-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"标准拼写是돼요，不写되요。","ko-KR":"되요가 아니라 돼요로 씁니다."},"comparison":{"zh-CN":"먹어야 돼요强调必要；먹으세요是礼貌建议或指示。","ko-KR":"먹어야 돼요는 필요, 먹으세요는 권유나 지시입니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"六项填空全部正确才完成；规则解释与扩展变形为自主练习。","ko-KR":"여섯 빈칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"consultation-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":11,"node":"consultation-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让问句、症状和医嘱真正接得起来","ko-KR":"질문, 증상과 안내를 자연스럽게 잇기"},"content":{"lead":{"zh-CN":"替换症状、开始时间、禁止、义务和限定，再依问答与回指排列六个完整话轮。","ko-KR":"증상, 시작 시점, 금지, 의무와 한정을 바꾸고 문답 관계에 따라 여섯 말차례를 배열합니다."},"replacementSets":[["머리가 아파요.","목이 아파요.","배가 아파요."],["운동하지 마세요.","찬 음식을 먹지 마세요.","밖에 나가지 마세요."],["약을 먹어야 돼요.","물을 마셔야 돼요.","푹 쉬어야 돼요.","죽만 먹으세요."]],"orderItems":["네, 조금 나요. 어떻게 해야 돼요?","약을 먹고 푹 쉬어야 돼요.","아침부터 목이 아프고 기침을 해요.","네, 알겠어요.","열도 나요?","어디가 아파요?"],"personalFrames":["开始时间＋一项症状","一项禁止提醒","一项义务或限定建议"],"coach":{"zh-CN":"六个完整话轮排序全对才完成；替换、快答与个人表达为自主练习。","ko-KR":"여섯 말차례 배열 정답만 필수이며 바꿔 말하기와 개인 표현은 자율 연습입니다."},"nextNode":"health-center-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":13,"node":"health-center-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"先听症状，再给清楚的生活建议","ko-KR":"증상을 듣고 분명한 생활 안내 주기"},"content":{"lead":{"zh-CN":"主场景在保健室完成症状说明、确认与医嘱；第二场景在宿舍完成朋友间的生活提醒。音频全部待制作。","ko-KR":"보건실에서는 증상과 안내를 확인하고 기숙사에서는 친구가 생활 조언을 합니다. 음원은 제작 대기 중입니다."},"dialogueScenes":[{"title":{"zh-CN":"校园保健室","ko-KR":"학교 보건실"},"people":{"zh-CN":"王明与保健老师","ko-KR":"왕밍과 보건 선생님"},"place":{"zh-CN":"校园保健室咨询桌前","ko-KR":"학교 보건실 상담 자리"},"purpose":{"zh-CN":"说明感冒症状，听懂服药、休息和禁止运动。","ko-KR":"감기 증상을 말하고 복약, 휴식과 운동 금지를 이해합니다."},"audioId":"chapter-11-dialogue-main","audioStatus":"pending","lines":[{"speaker":"보건 선생님","ko":"어디가 아파요?","zh":"哪里不舒服？"},{"speaker":"왕밍","ko":"감기에 걸렸어요. 어제부터 머리가 아프고 목도 아파요.","zh":"我感冒了。从昨天开始头疼，喉咙也疼。"},{"speaker":"보건 선생님","ko":"열도 나요? 기침도 해요?","zh":"也发热吗？也咳嗽吗？"},{"speaker":"왕밍","ko":"네, 열이 조금 나고 기침을 많이 해요.","zh":"是的，有一点发热，咳嗽得很多。"},{"speaker":"보건 선생님","ko":"약을 먹어야 돼요.","zh":"必须吃药。"},{"speaker":"왕밍","ko":"다른 주의 사항도 있어요?","zh":"还有其他注意事项吗？"},{"speaker":"보건 선생님","ko":"오늘은 운동하지 마세요. 집에서 푹 쉬세요.","zh":"今天请不要运动。在家好好休息。"},{"speaker":"왕밍","ko":"네, 알겠어요. 감사합니다.","zh":"好的，我明白了。谢谢。"}]},{"title":{"zh-CN":"学生宿舍房间","ko-KR":"학생 기숙사 방"},"people":{"zh-CN":"敏智与宥娜，同龄室友","ko-KR":"민지와 유나, 또래 룸메이트"},"place":{"zh-CN":"周六上午的宿舍房间","ko-KR":"토요일 오전 기숙사 방"},"purpose":{"zh-CN":"确认肚子不适并提醒避开辛辣食物、吃温热的粥。","ko-KR":"배가 아픈지 확인하고 매운 음식을 피하며 따뜻한 죽을 먹도록 말합니다."},"audioId":"chapter-11-dialogue-alt","audioStatus":"pending","lines":[{"speaker":"민지","ko":"유나 씨, 괜찮아요? 어디가 아파요?","zh":"宥娜，你还好吗？哪里不舒服？"},{"speaker":"유나","ko":"아침부터 배가 아파요.","zh":"从早上开始肚子疼。"},{"speaker":"민지","ko":"약은 있어요?","zh":"有药吗？"},{"speaker":"유나","ko":"네, 약은 있어요.","zh":"有，有药。"},{"speaker":"민지","ko":"오늘은 매운 음식을 먹지 마세요. 따뜻한 죽을 먹어야 돼요.","zh":"今天请不要吃辛辣食物。要吃温热的粥。"},{"speaker":"유나","ko":"네. 점심에는 죽만 먹고 푹 쉴 거예요.","zh":"好的。午饭我只吃粥，然后好好休息。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换与试录为自主练习。","ko-KR":"사실 문제와 자연스러운 응답을 모두 맞혀야 하며 바꿔 말하기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-consult"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":14,"node":"listen-and-consult","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听懂一项禁忌，再完成自己的健康咨询","ko-KR":"금지 안내를 듣고 건강 상담 완성하기"},"content":{"lead":{"zh-CN":"学生端只显示待制作音频、问题和选项；脚本、答案、停顿与对象键仅在服务端。","ko-KR":"학생 화면에는 제작 대기 음원, 질문과 선택지만 보이며 원고, 정답, 쉼과 객체 키는 서버에만 있습니다."},"listening":{"audioId":"chapter-11-listening-advice","audioStatus":"pending","question":{"zh-CN":"保健老师让智秀不要做什么？","ko-KR":"보건 선생님은 지수에게 무엇을 하지 말라고 했어요?"}},"speakingTask":{"duration":"40—55秒","minimumTurns":8,"maximumTurns":10,"rolesRequired":2,"requiredInformation":["开始时间","至少三项症状","程度","症状确认问答","义务建议","禁止提醒","限定行动","理解确认","礼貌结束"],"pronunciationScore":false},"coach":{"zh-CN":"音频可播放后听辨正确，并提交符合时长、话轮、双角色与九类信息的录音才完成；录音不产生分数。","ko-KR":"음원 재생과 듣기 정답, 시간, 말차례, 두 역할과 아홉 정보를 모두 갖추며 녹음에는 점수가 없습니다."},"nextNode":"health-care-note"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":13,"node":"health-care-note","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读保健室健康卡，写健康提醒卡","ko-KR":"보건실 건강 카드를 읽고 안내 카드 쓰기"},"content":{"lead":{"zh-CN":"从健康卡区分症状、必须做、只做与不能做的行动，再以保健老师身份写原创提醒卡。","ko-KR":"건강 카드에서 증상, 의무, 한정과 금지를 구분하고 보건 선생님 관점의 새 안내를 씁니다."},"reading":{"title":"보건실 건강 카드","text":"이름: 박준호\n증상: 아침부터 배가 아파요.\n오늘의 안내: 약을 먹어야 돼요. 점심에는 따뜻한 죽만 먹으세요. 매운 음식을 먹지 마세요. 집에서 푹 쉬어야 돼요.","questions":["준호는 어디가 아파요?","점심에는 무엇만 먹어요?","매운 음식에 대한 안내는 무엇이에요?"]},"writing":{"author":"保健老师","audience":"卡片上写明的安全虚构学生","requirements":["6—8句","开始时间","至少三项症状","一项程度","一项义务","一项禁止","一项限定行动","礼貌语气一致","完成四维量规自查"],"scaffold":"___ 씨는 ___부터 ___이/가 아파요. → ___도 해요. → ___을/를 조금／많이 해요. → ___아야/어야 돼요. → ___지 마세요. → ___만 ___으세요. → 푹 쉬세요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"],"example":"민수 씨는 어젯밤부터 목이 아파요. 코도 막혔어요. 기침을 많이 해요. 따뜻한 물을 마셔야 돼요. 오늘은 운동하지 마세요. 저녁에는 죽만 먹으세요. 집에서 푹 쉬세요."},"coach":{"zh-CN":"阅读三题全对，并提交原创6—8句健康提醒卡与四维量规自查才完成；开放写作不产生分数。","ko-KR":"읽기 세 문제 정답과 새로운 6~8문장 건강 안내, 네 기준 점검이 필요하며 글쓰기는 점수가 없습니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能把症状和建议说清楚吗？","ko-KR":"증상과 안내를 분명히 말할 수 있나요?"},"content":{"lead":{"zh-CN":"把问题归为词汇、语法、理解、表达或读写，再返回对应节点。","ko-KR":"문제를 어휘, 문법, 이해, 표현이나 읽기·쓰기로 나누고 해당 노드로 돌아갑니다."},"canDo":["说明开始时间、至少三项症状和程度","正确处理ㅡ脱落","表达禁止、限定与义务","区分必须做与不能做","完成40—55秒、8—10轮双角色健康咨询"],"returnMap":{"词汇":"symptom-words","语法":"health-advice-tools","理解":"health-center-talk／listen-and-consult","表达":"listen-and-consult","读写":"health-care-note"},"coach":{"zh-CN":"综合多选正确，并完成五项自查和返回位置记录才完成；自查不产生分数。","ko-KR":"종합 문제 정답과 다섯 점검, 복습 위치 기록이 필요하며 자기 점검에는 점수가 없습니다."},"nextNode":"chapter-test:korean-level-one-11"}}
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
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"王明走进校园保健室，保健老师问他哪里不舒服。哪一句最适合回答？","ko-KR":"왕밍이 학교 보건실에 왔습니다. 어디가 아픈지 물었을 때 가장 알맞은 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择能够直接说明一项身体症状的句子；本题不显示分数。","ko-KR":"몸의 증상 한 가지를 직접 말하는 문장을 고르세요. 점수는 표시하지 않습니다."},"options":["머리가 아파요.","영화 볼까요?","세 시에 만나요.","이거 얼마예요?"],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句直接说明头疼，符合保健室询问。","ko-KR":"머리가 아프다는 증상을 직접 말합니다."},"feedback":[{"zh-CN":"先找身体部位和表示疼痛的谓语。","ko-KR":"신체 부위와 통증 표현을 찾으세요."},{"zh-CN":"目标句回答“哪里不舒服”，不是活动、时间或价格。","ko-KR":"활동, 시간이나 가격이 아니라 아픈 곳을 답해야 합니다."},{"zh-CN":"应选择머리가 아파요，意思是“头疼”。","ko-KR":"정답은 머리가 아파요입니다."}]}},
    {"node":"symptom-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在열이 조금 나요中，열是什么意思？","ko-KR":"열이 조금 나요에서 열은 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고르고 문장 전체를 한 번 읽은 뒤 확인하세요."},"options":["咳嗽","药","发热","喉咙"],"config":{"shuffle":true,"example":"열이 조금 나요.","readAloudConfirmation":true,"audioPending":true},"answer":{"kind":"index_confirmation","value":2},"explanation":{"correct":{"zh-CN":"열在健康场景表示发热；整句是“有一点发热”。","ko-KR":"열은 발열이며 문장은 열이 조금 난다는 뜻입니다."},"feedback":[{"zh-CN":"先判断它是身体部位、物品还是症状。","ko-KR":"신체 부위, 물건이나 증상인지 먼저 구분하세요."},{"zh-CN":"常用搭配是열이 나다，表示体温升高。","ko-KR":"열이 나다는 체온이 오르는 증상입니다."},{"zh-CN":"答案是“发热”；整句表示“有一点发热”。","ko-KR":"정답은 발열입니다."}]}},
    {"node":"health-advice-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成六小题，检查ㅡ脱落、禁止、限定和义务表达。","ko-KR":"ㅡ 탈락, 금지, 한정과 의무 표현을 확인하는 여섯 문항을 완성하세요."},"instruction":{"zh-CN":"按每题公开功能填写目标形式；第5、6题使用本课-아야/어야 돼요并以돼요结尾。","ko-KR":"기능에 맞는 형태를 쓰고 5, 6번은 -아야/어야 돼요를 사용하세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"아프다 → ___（日常礼貌体）","placeholder":"请输入答案"},{"id":"item-02","label":"약이 ___（쓰다的日常礼貌体）","placeholder":"请输入答案"},{"id":"item-03","label":"운동하다 → 운동___（礼貌禁止）","placeholder":"请输入答案"},{"id":"item-04","label":"따뜻한 죽___ 먹어요.（只吃温热的粥）","placeholder":"请输入答案"},{"id":"item-05","label":"먹다 → ___（必须做；以돼요结尾）","placeholder":"请输入答案"},{"id":"item-06","label":"쉬다 → ___（必须做；以돼요结尾）","placeholder":"请输入答案"}]},"answer":{"kind":"text_array","value":["아파요","써요","하지 마세요","만","먹어야 돼요","쉬어야 돼요"]},"explanation":{"correct":{"zh-CN":"六项形式全部正确，内部拼写和必要空格均保留。","ko-KR":"여섯 형태와 필요한 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先标记礼貌体、禁止、限定或义务，再处理词干。","ko-KR":"해요체, 금지, 한정이나 의무 기능을 먼저 표시하세요."},{"zh-CN":"前两题去ㅡ；禁止接-지 마세요；만替代宾格；义务形以돼요结尾。","ko-KR":"ㅡ를 빼고 금지, 만과 돼요 형태를 확인하세요."},{"zh-CN":"依次为아파요、써요、하지 마세요、만、먹어야 돼요、쉬어야 돼요。","ko-KR":"차례대로 아파요, 써요, 하지 마세요, 만, 먹어야 돼요, 쉬어야 돼요입니다."}]}},
    {"node":"consultation-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段连贯的健康咨询。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 건강 상담으로 배열하세요."},"instruction":{"zh-CN":"根据问答、前后指代和语义衔接移动；卡片没有角色或步骤提示。","ko-KR":"질문과 대답, 앞뒤 의미를 보고 옮기세요. 역할이나 단계 표시는 없습니다."},"options":["네, 조금 나요. 어떻게 해야 돼요?","약을 먹고 푹 쉬어야 돼요.","아침부터 목이 아프고 기침을 해요.","네, 알겠어요.","열도 나요?","어디가 아파요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[5,2,4,0,1,3]},"explanation":{"correct":{"zh-CN":"询问症状、说明症状、确认发热、求助、给建议、确认理解，衔接完整。","ko-KR":"증상 질문, 설명, 열 확인, 조언 요청, 안내와 이해 확인이 이어집니다."},"feedback":[{"zh-CN":"检查每个问句是否紧邻能直接回答它的内容。","ko-KR":"질문 뒤에 직접 답하는 말을 놓으세요."},{"zh-CN":"两个네回应不同问题；어떻게 해야 돼요后应接义务建议。","ko-KR":"두 네의 앞말과 어떻게 해야 돼요의 답을 찾으세요."},{"zh-CN":"正确顺序是第6、3、5、1、2、4张卡。","ko-KR":"정답 순서는 6, 3, 5, 1, 2, 4번 카드입니다."}]}},
    {"node":"health-center-talk","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景中，症状从什么时候开始，程度信息是什么？","ko-KR":"주 장면에서 증상은 언제 시작했고 정도는 어땠어요?"},"instruction":{"zh-CN":"选择开始时间和程度都与台词一致的一组。","ko-KR":"시작한 때와 정도가 모두 대사와 같은 조합을 고르세요."},"options":["어제부터／열이 조금 나요","오늘부터／열이 많이 나요","아침부터／기침을 조금 해요","밤부터／목이 많이 아파요"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"第2轮说어제부터，第4轮说열이 조금 나고。","ko-KR":"2턴의 어제부터와 4턴의 열이 조금 나고가 근거입니다."},"feedback":[{"zh-CN":"开始时间在学生第一次回答中，程度在下一次回答中。","ko-KR":"학생의 첫 답과 다음 답에서 찾으세요."},{"zh-CN":"找-부터前的时间词和조금／많이修饰的症状。","ko-KR":"-부터 앞 시간과 정도 부사를 찾으세요."},{"zh-CN":"正确组合是어제부터／열이 조금 나요。","ko-KR":"정답은 어제부터／열이 조금 나요입니다."}]}},
    {"node":"health-center-talk","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"保健老师说“必须吃药，今天不要运动”。哪一句回应最自然且不矛盾？","ko-KR":"약을 먹고 오늘 운동하지 말라는 안내에 가장 자연스러운 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择既确认理解、又说明会采取合适行动的一句。","ko-KR":"이해 확인과 알맞은 행동이 함께 있는 문장을 고르세요."},"options":["네, 알겠어요. 오늘은 집에서 푹 쉴 거예요.","네, 지금 운동해요.","아니요, 약은 안 먹어요.","영화가 재미있네요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句确认理解并选择休息，不违反两项医嘱。","ko-KR":"안내를 이해하고 쉬겠다고 답해 두 안내와 맞습니다."},"feedback":[{"zh-CN":"先排除违反吃药和禁止运动的回应。","ko-KR":"약과 운동 안내에 어긋나는 답을 빼세요."},{"zh-CN":"目标句还需要明确表示已经理解。","ko-KR":"안내를 이해했다는 표현도 필요합니다."},{"zh-CN":"应选择네, 알겠어요. 오늘은 집에서 푹 쉴 거예요。","ko-KR":"정답은 네, 알겠어요. 오늘은 집에서 푹 쉴 거예요입니다."}]}},
    {"node":"listen-and-consult","sort":1,"key":"listening-advice","type":"listening","prompt":{"zh-CN":"听音频，判断保健老师让智秀不要做什么。","ko-KR":"음성을 듣고 보건 선생님이 지수에게 하지 말라고 한 일을 고르세요."},"instruction":{"zh-CN":"正常语速两遍、慢速一遍；只依据音频中的禁止表达作答。","ko-KR":"보통 속도 두 번, 느린 속도 한 번 듣고 금지 표현에 근거해 답하세요."},"options":["찬 음식을 먹어요","약을 먹어요","푹 쉬어요","따뜻한 물을 마셔요"],"config":{"shuffle":true,"audioId":"chapter-11-listening-advice","audioStatus":"pending","normalPlays":2,"slowPlays":1},"answer":{"kind":"index","value":0},"transcript":"지수: 선생님, 감기에 걸렸어요. 어젯밤부터 목이 아프고 기침을 해요. 보건 선생님: 열도 나요? 지수: 네, 조금 나요. 보건 선생님: 오늘은 약을 먹고 푹 쉬어야 돼요. 찬 음식을 먹지 마세요.","audioObjectKey":"korean-level-one/chapter-11/listening/chapter-11-listening-advice.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是吃冷食；原文说찬 음식을 먹지 마세요。","ko-KR":"정답은 찬 음식이며 원문에서 먹지 마세요라고 했습니다."},"feedback":[{"zh-CN":"再听保健老师最后的禁止句，注意-지 마세요。","ko-KR":"마지막 금지 문장의 -지 마세요를 들으세요."},{"zh-CN":"目标行动是먹다，再听它前面的食物名称。","ko-KR":"먹다 앞의 음식 이름을 들으세요."},{"zh-CN":"答案是찬 음식을 먹어요；其余行动不是禁止事项。","ko-KR":"정답은 찬 음식을 먹어요입니다."}],"privateListening":{"normalAudioId":"chapter-11-listening-advice-normal","normalAudioObjectKey":"korean-level-one/chapter-11/listening/chapter-11-listening-advice-normal.mp3","normalScript":"지수: 선생님, 감기에 걸렸어요. 어젯밤부터 목이 아프고 기침을 해요. / 보건 선생님: 열도 나요? / 지수: 네, 조금 나요. / 보건 선생님: 오늘은 약을 먹고 푹 쉬어야 돼요. 찬 음식을 먹지 마세요.","slowAudioId":"chapter-11-listening-advice-slow","slowAudioObjectKey":"korean-level-one/chapter-11/listening/chapter-11-listening-advice-slow.mp3","slowScript":"지수: 선생님, 감기에 걸렸어요. / 어젯밤부터 목이 아프고 기침을 해요. / 보건 선생님: 열도 나요? / 지수: 네, 조금 나요. / 보건 선생님: 오늘은 약을 먹고 푹 쉬어야 돼요. / 찬 음식을 먹지 마세요.","pauseMarks":"지수: 선생님, 감기에 걸렸어요. ⏸ 어젯밤부터 목이 아프고 기침을 해요. ⏸ 보건 선생님: 열도 나요? ⏸ 지수: 네, 조금 나요. ⏸ 보건 선생님: 오늘은 약을 먹고 푹 쉬어야 돼요. ⏸ 찬 음식을 먹지 마세요.","speaker":"F04／지수；F05／보건 선생님","distractorReasons":["吃药是要求做的事。","休息是要求做的事。","原文没有提到温水。"]}}},
    {"node":"listen-and-consult","sort":2,"key":"speaking-consultation","type":"speaking","prompt":{"zh-CN":"完成40—55秒、8—10轮的双角色基础健康咨询。","ko-KR":"두 역할을 번갈아 맡아 40~55초, 8~10턴의 건강 상담을 완성하세요."},"instruction":{"zh-CN":"录入开始时间、三项症状、程度、确认问答、义务、禁止、限定、理解确认和礼貌结束。","ko-KR":"시작한 때, 세 증상, 정도, 확인 문답, 의무, 금지, 한정, 이해 확인과 마무리를 넣으세요."},"options":[],"config":{"minimumSeconds":40,"maximumSeconds":55,"minimumTurns":8,"maximumTurns":10,"rolesRequired":2,"requiredCriteria":9,"criteria":["开始时间","至少三项症状","一项程度","症状确认问答","一项义务建议","一项禁止提醒","一项限定行动","理解确认","礼貌结束"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存符合时长、话轮、双角色和九类信息的录音；不产生正确性或分数。","ko-KR":"시간, 말차례, 두 역할과 아홉 정보를 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对九类信息和两个角色。","ko-KR":"아홉 정보와 두 역할을 먼저 확인하세요."},{"zh-CN":"检查症状确认与义务、禁止建议是否衔接。","ko-KR":"증상 확인과 의무·금지 안내가 이어지는지 보세요."},{"zh-CN":"按句框补齐缺项后重录；系统不显示虚假发音准确率。","ko-KR":"빠진 내용을 보완해 다시 녹음하며 발음 점수는 표시하지 않습니다."}]}},
    {"node":"health-care-note","sort":1,"key":"reading-health-note","type":"single_choice","prompt":{"zh-CN":"阅读保健室健康卡，完成三道事实题。","ko-KR":"보건실 건강 카드를 읽고 사실 확인 세 문항에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，答案均可从公开卡片原句直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 카드 문장에서 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"보건실 건강 카드\n이름: 박준호\n증상: 아침부터 배가 아파요.\n오늘의 안내: 약을 먹어야 돼요. 점심에는 따뜻한 죽만 먹으세요. 매운 음식을 먹지 마세요. 집에서 푹 쉬어야 돼요.","items":[{"id":"q1","question":"준호는 어디가 아파요?","options":["머리","목","배","코"]},{"id":"q2","question":"점심에는 무엇만 먹어요?","options":["약","따뜻한 죽","매운 음식","찬 음식"]},{"id":"q3","question":"매운 음식에 대한 안내는 무엇이에요?","options":["먹지 마세요","먹으세요","많이 먹어요","죽만 먹어요"]}]},"answer":{"kind":"index_array","value":[2,1,0]},"explanation":{"correct":{"zh-CN":"答案依次是肚子、温热的粥、不要吃。","ko-KR":"정답은 배, 따뜻한 죽, 먹지 마세요입니다."},"feedback":[{"zh-CN":"分别找症状栏、带만的食物和带-지 마세요的食物。","ko-KR":"증상, 만이 있는 음식과 -지 마세요가 있는 음식을 찾으세요."},{"zh-CN":"不要把必须吃药和只吃温热的粥混为同一行动。","ko-KR":"약 복용과 죽 한정을 섞지 마세요."},{"zh-CN":"三题答案依次为배、따뜻한 죽、먹지 마세요。","ko-KR":"정답은 배, 따뜻한 죽, 먹지 마세요입니다."}]}},
    {"node":"health-care-note","sort":2,"key":"write-health-note","type":"writing","prompt":{"zh-CN":"假设你是保健老师，为一名安全虚构的学生写6—8句健康提醒卡。","ko-KR":"보건 선생님이 되어 가상 학생에게 6~8문장의 건강 안내 카드를 쓰세요."},"instruction":{"zh-CN":"记录开始时间、三项症状和程度，再写义务、禁止、限定与结束提醒；保持单一作者／受众并完成量规自查。","ko-KR":"시작한 때, 세 증상, 정도, 의무, 금지, 한정과 마무리를 쓰고 한 작성자 관점과 기준 점검을 지키세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":55,"minimumInformationKinds":7,"informationChecklist":["开始时间和三项症状","一项程度","ㅡ脱落形式","一项义务","一项禁止","一项限定行动","保健老师写给同一学生并完成量规自查"],"requiredPhraseGroups":[["부터"],["조금","많이"],["아파요"],["야 돼요"],["지 마세요"],["만"]],"minimumPhraseGroups":6,"requireCompletionChecklist":true,"scaffold":"___ 씨는 ___부터 ___이/가 아파요. → ___도 해요. → ___을/를 조금／많이 해요. → ___아야/어야 돼요. → ___지 마세요. → ___만 ___으세요. → 푹 쉬세요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、规定信息和量规自查的原创提醒卡；不产生正确性或分数。","ko-KR":"문장 수, 필수 정보와 점검을 갖춘 안내를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对作者与读者，再数开始时间、症状、程度、义务、禁止和限定。","ko-KR":"작성자와 독자, 시작, 증상, 정도, 의무, 금지와 한정을 확인하세요."},{"zh-CN":"检查아파요、-지 마세요、만、-아야/어야 돼요与建议逻辑。","ko-KR":"아파요, -지 마세요, 만, -아야/어야 돼요와 논리를 보세요."},{"zh-CN":"按支架补齐缺项，但不要复制示范。","ko-KR":"틀로 빠진 내용을 보완하되 예시를 베끼지 마세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的句子。","ko-KR":"형태가 맞고 괄호의 기능을 바르게 나타내는 문장을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 문장을 모두 고르고 틀린 문장은 고르지 마세요."},"options":["머리가 아파요.（症状）","오늘은 운동하지 마세요.（禁止）","약을 먹어야 돼요.（义务）","물을만 마셔요.（限定）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三句正确；第4句应写물만 마셔요。","ko-KR":"앞의 세 문장이 맞고 4번은 물만 마셔요로 고칩니다."},"feedback":[{"zh-CN":"检查ㅡ脱落、禁止和义务词尾，以及만前是否保留宾格。","ko-KR":"ㅡ 탈락, 금지, 의무와 만 앞 조사를 확인하세요."},{"zh-CN":"只有一项把을/를和만错误叠加。","ko-KR":"한 문장만 목적격 조사와 만을 겹쳐 썼습니다."},{"zh-CN":"正确项是第1、2、3句；第4句应为물만 마셔요。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"symptoms","label":"我能说明开始时间、三项症状和程度／시작한 때, 세 증상과 정도를 말할 수 있어요"},{"id":"eu","label":"我能正确处理ㅡ脱落／ㅡ 탈락 형태를 바르게 만들 수 있어요"},{"id":"advice","label":"我能表达禁止、限定和义务／금지, 한정과 의무를 말할 수 있어요"},{"id":"listening","label":"我能区分必须做与不能做／해야 할 일과 하지 말아야 할 일을 구별할 수 있어요"},{"id":"consultation","label":"我能完成40—55秒、8—10轮双角色健康咨询／40~55초, 8~10턴의 건강 상담을 할 수 있어요"}],"returnNodes":[{"value":"symptom-words","label":"词汇"},{"value":"health-advice-tools","label":"语法"},{"value":"health-center-talk","label":"对话理解"},{"value":"listen-and-consult","label":"听说"},{"value":"health-care-note","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想症状、ㅡ脱落、三类建议、听辨和完整咨询。","ko-KR":"증상, ㅡ 탈락, 세 안내, 듣기와 상담을 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 11 node %',item->>'node'; end if;
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
      'dialogue-fact-check','dialogue-response','listening-advice',
      'speaking-consultation','reading-health-note','write-health-note',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where media.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-11-image-01","purpose":"章节情境主图","file":"chapter-11-01-scene.png","path":"../附件/韩国语1级/第11课/第11课-01-章节情境主图.png","alt":"校园保健室内学生向保健老师说明不适。","width":1600,"height":900},
    {"node":"symptom-words","key":"chapter-11-image-02","purpose":"核心词汇症状与照护卡","file":"chapter-11-02-vocabulary.png","path":"../附件/韩国语1级/第11课/第11课-02-核心词汇卡-症状与照护.png","alt":"身体部位、症状与照护动作九格卡。","width":1200,"height":900},
    {"node":"health-advice-tools","key":"chapter-11-image-03","purpose":"症状与医嘱语法总图","file":"chapter-11-03-grammar-overview.png","path":"../附件/韩国语1级/第11课/第11课-03-语法总图-症状与医嘱.png","alt":"ㅡ脱落、禁止、限定、义务四条结构轨道。","width":1600,"height":900},
    {"node":"health-advice-tools","key":"chapter-11-image-04","purpose":"ㅡ脱落结构图","file":"chapter-11-03a-eu-drop.png","path":"../附件/韩国语1级/第11课/第11课-03A-语法结构图-ㅡ脱落.png","alt":"ㅡ去除与아요／어요选择。","width":1200,"height":900},
    {"node":"health-advice-tools","key":"chapter-11-image-05","purpose":"礼貌禁止结构图","file":"chapter-11-03b-jimaseyo.png","path":"../附件/韩国语1级/第11课/第11课-03B-语法结构图-지마세요.png","alt":"动词词干连接지 마세요。","width":1200,"height":900},
    {"node":"health-advice-tools","key":"chapter-11-image-06","purpose":"限定助词结构图","file":"chapter-11-03c-man.png","path":"../附件/韩国语1级/第11课/第11课-03C-语法结构图-만.png","alt":"名词、格助词和地点助词与만的关系。","width":1200,"height":900},
    {"node":"health-advice-tools","key":"chapter-11-image-07","purpose":"义务表达结构图","file":"chapter-11-03d-aya-eoya-dwaeyo.png","path":"../附件/韩国语1级/第11课/第11课-03D-语法结构图-아야어야돼요.png","alt":"词干元音分流到아야／어야 돼요。","width":1200,"height":900},
    {"node":"consultation-builder","key":"chapter-11-image-08","purpose":"健康咨询完整话轮卡","file":"chapter-11-04-pattern-blocks.png","path":"../附件/韩国语1级/第11课/第11课-04-句型健康咨询语块卡.png","alt":"六张无角色、步骤或位置提示的完整韩语话轮卡。","width":1200,"height":900},
    {"node":"health-center-talk","key":"chapter-11-image-09","purpose":"实战对话双场景图","file":"chapter-11-05-dialogue.png","path":"../附件/韩国语1级/第11课/第11课-05-实战对话场景.png","alt":"保健室与宿舍两个独立健康场景。","width":1600,"height":900},
    {"node":"listen-and-consult","key":"chapter-11-image-10","purpose":"听力健康建议信息图","file":"chapter-11-06-listening.png","path":"../附件/韩国语1级/第11课/第11课-06-听力信息图-健康建议.png","alt":"药、休息、温水、冷食和运动情境卡。","width":1200,"height":900},
    {"node":"health-care-note","key":"chapter-11-image-11","purpose":"保健室健康卡版式","file":"chapter-11-07-health-card.png","path":"../附件/韩国语1级/第11课/第11课-07-保健室健康卡.png","alt":"姓名、症状和今日建议三栏健康卡版式。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-11-image-12","purpose":"最终健康咨询任务图","file":"chapter-11-08-final-task.png","path":"../附件/韩国语1级/第11课/第11课-08-最终任务图.png","alt":"症状、询问、建议、回应和录音提交的类别图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-11/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='symptom-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"머리","collocation":"머리가 아프다"},{"word":"목","collocation":"목이 아프다"},{"word":"배","collocation":"배가 아프다"},{"word":"코","collocation":"코가 막히다"},{"word":"열","collocation":"열이 나다"},{"word":"기침","collocation":"기침을 하다"},{"word":"감기","collocation":"감기에 걸리다"},{"word":"증상","collocation":"증상을 말하다"},{"word":"약","collocation":"약을 먹다"},{"word":"보건실","collocation":"보건실에 가다"},{"word":"병원","collocation":"병원에 가다"},{"word":"아프다","collocation":"머리가 아프다"},{"word":"나다","collocation":"열이 나다"},{"word":"막히다","collocation":"코가 막히다"},{"word":"걸리다","collocation":"감기에 걸리다"},{"word":"먹다","collocation":"약을 먹다"},{"word":"마시다","collocation":"물을 마시다"},{"word":"쉬다","collocation":"푹 쉬다"},{"word":"운동하다","collocation":"운동하지 마세요"},{"word":"푹","collocation":"푹 쉬다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-11-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-11/audio/vocabulary/chapter-11-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-11-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-11-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-11/audio/vocabulary/chapter-11-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-11-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='health-advice-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-11/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-11-grammar-01-example-01","script":"머리가 아파요."},{"id":"chapter-11-grammar-01-example-02","script":"어제부터 머리가 아프고 목도 아파요."},{"id":"chapter-11-grammar-01-example-03","script":"아침부터 배가 아파요."},
    {"id":"chapter-11-grammar-02-example-01","script":"오늘은 운동하지 마세요."},{"id":"chapter-11-grammar-02-example-02","script":"오늘은 운동하지 마세요."},{"id":"chapter-11-grammar-02-example-03","script":"매운 음식을 먹지 마세요."},
    {"id":"chapter-11-grammar-03-example-01","script":"점심에는 따뜻한 죽만 먹으세요."},{"id":"chapter-11-grammar-03-example-02","script":"네. 점심에는 죽만 먹고 푹 쉴 거예요."},{"id":"chapter-11-grammar-03-example-03","script":"점심에는 따뜻한 죽만 먹으세요."},
    {"id":"chapter-11-grammar-04-example-01","script":"약을 먹어야 돼요."},{"id":"chapter-11-grammar-04-example-02","script":"약을 먹어야 돼요."},{"id":"chapter-11-grammar-04-example-03","script":"오늘은 약을 먹고 푹 쉬어야 돼요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='health-center-talk';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-11/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-11-dialogue-main-line-01","purpose":"主对话逐句","script":"어디가 아파요?","speaker":"F01／보건 선생님"},{"id":"chapter-11-dialogue-main-line-02","purpose":"主对话逐句","script":"감기에 걸렸어요. 어제부터 머리가 아프고 목도 아파요.","speaker":"M01／왕밍"},{"id":"chapter-11-dialogue-main-line-03","purpose":"主对话逐句","script":"열도 나요? 기침도 해요?","speaker":"F01／보건 선생님"},{"id":"chapter-11-dialogue-main-line-04","purpose":"主对话逐句","script":"네, 열이 조금 나고 기침을 많이 해요.","speaker":"M01／왕밍"},{"id":"chapter-11-dialogue-main-line-05","purpose":"主对话逐句","script":"약을 먹어야 돼요.","speaker":"F01／보건 선생님"},{"id":"chapter-11-dialogue-main-line-06","purpose":"主对话逐句","script":"다른 주의 사항도 있어요?","speaker":"M01／왕밍"},{"id":"chapter-11-dialogue-main-line-07","purpose":"主对话逐句","script":"오늘은 운동하지 마세요. 집에서 푹 쉬세요.","speaker":"F01／보건 선생님"},{"id":"chapter-11-dialogue-main-line-08","purpose":"主对话逐句","script":"네, 알겠어요. 감사합니다.","speaker":"M01／왕밍"},{"id":"chapter-11-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-11-dialogue-alt-line-01","purpose":"第二对话逐句","script":"유나 씨, 괜찮아요? 어디가 아파요?","speaker":"F02／민지"},{"id":"chapter-11-dialogue-alt-line-02","purpose":"第二对话逐句","script":"아침부터 배가 아파요.","speaker":"F03／유나"},{"id":"chapter-11-dialogue-alt-line-03","purpose":"第二对话逐句","script":"약은 있어요?","speaker":"F02／민지"},{"id":"chapter-11-dialogue-alt-line-04","purpose":"第二对话逐句","script":"네, 약은 있어요.","speaker":"F03／유나"},{"id":"chapter-11-dialogue-alt-line-05","purpose":"第二对话逐句","script":"오늘은 매운 음식을 먹지 마세요. 따뜻한 죽을 먹어야 돼요.","speaker":"F02／민지"},{"id":"chapter-11-dialogue-alt-line-06","purpose":"第二对话逐句","script":"네. 점심에는 죽만 먹고 푹 쉴 거예요.","speaker":"F03／유나"},{"id":"chapter-11-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／F03"}
  ] $dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and activity.activity_key='listening-advice';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-11-listening-advice-normal','audio','私有听力正常语速','korean-level-one/chapter-11/listening/chapter-11-listening-advice-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F04／지수；F05／보건 선생님","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-11-listening-advice-slow','audio','私有听力慢速','korean-level-one/chapter-11/listening/chapter-11-listening-advice-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F04／지수；F05／보건 선생님","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_eleven$;

commit;
