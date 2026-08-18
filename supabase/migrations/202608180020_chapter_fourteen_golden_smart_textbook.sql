begin;

-- Converted from the read-only UPLY BOOK chapter-fourteen master.
-- source_sha256: b5f719645a32359b71595c6278a4d44201e515823ce645708708d5c49919e4c0
-- Chapter, assessment, images and audio remain draft/pending until human review.
-- The 12-minute duration and passing_score=60 are explicitly recorded by the
-- master as course-overview values pending platform verification.

select set_config('app.platform_content_migration', 'on', true);

do $chapter_fourteen$
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
  if version_uuid is null then raise exception 'Cannot convert chapter 14: korean-level-one-smart version was not found'; end if;

  select lesson.id into lesson_uuid
  from public.lessons lesson join public.courses course on course.id=lesson.course_id
  where course.slug='korean-beginner' and lesson.slug='basic-pronunciation' limit 1;
  if lesson_uuid is null then raise exception 'Cannot convert chapter 14: korean-beginner/basic-pronunciation lesson was not found'; end if;

  select id into test_uuid from public.chapter_tests where slug='korean-level-one-14' limit 1;
  if test_uuid is null then
    select id into test_uuid from public.chapter_tests where lesson_id=lesson_uuid and chapter_number=14 limit 1;
  end if;
  if test_uuid is null then
    insert into public.chapter_tests (
      id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,student_app_id
    ) values (
      'a3400000-0000-4000-8000-000000000014'::uuid,lesson_uuid,
      'korean-level-one-14','korean-level-one',14,
      '第 14 章测试：请试穿这件衣服。','제14과 평가: 이 옷을 입어 보세요.',
      '检查服饰与特征词汇、形容词定语、ㄹ脱落、试穿建议、一般与尊敬接受者，以及购物对话、听力和新品告知理解。',
      12,60,
      '{"recognition":"服饰、特征与穿戴动作词汇","structure":"形容词定语、ㄹ脱落、试穿建议与接受者形式","reading":"服饰购物对话、听力与新品告知理解","assembly":"双角色服饰购物交流组织"}'::jsonb,
      1,'draft','10000000-0000-4000-8000-000000000001'::uuid
    ) returning id into test_uuid;
  else
    update public.chapter_tests set
      lesson_id=lesson_uuid,slug='korean-level-one-14',course_key='korean-level-one',chapter_number=14,
      title='第 14 章测试：请试穿这件衣服。',korean_title='제14과 평가: 이 옷을 입어 보세요.',
      description='检查服饰与特征词汇、形容词定语、ㄹ脱落、试穿建议、一般与尊敬接受者，以及购物对话、听力和新品告知理解。',
      duration_minutes=12,passing_score=60,
      skills='{"recognition":"服饰、特征与穿戴动作词汇","structure":"形容词定语、ㄹ脱落、试穿建议与接受者形式","reading":"服饰购物对话、听力与新品告知理解","assembly":"双角色服饰购物交流组织"}'::jsonb,
      version=1,status='draft',student_app_id='10000000-0000-4000-8000-000000000001'::uuid,updated_at=now()
    where id=test_uuid;
  end if;

  delete from public.chapter_test_questions where test_id=test_uuid;
  insert into public.chapter_test_questions (
    test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order,
    question_type,default_points,difficulty,tags,status,version,is_chapter_test_item,
    ebook_section_step,ebook_page_reference
  ) values
    (test_uuid,'golden-14-01','在“이 코트는 가벼워요.”中，“가볍다”是什么意思？','["轻","长","小","漂亮"]',0,'母本词汇表中가볍다表示重量轻。','recognition',1,'single_choice',10,'foundation','["词汇","母本§4"]','draft',1,true,'STEP 02','母本 §4'),
    (test_uuid,'golden-14-02','“예쁘다”怎样变成修饰“원피스”的本课形式？','["예쁜 원피스","예쁘는 원피스","예쁘은 원피스","예뻐 원피스"]',0,'无收音形容词词干接-ㄴ，并与名词分写。','structure',2,'single_choice',10,'foundation','["形容词定语","母本§5.1"]','draft',1,true,'STEP 03','母本 §5.1'),
    (test_uuid,'golden-14-03','“길다”修饰“코트”时哪一项正确？','["긴 코트","길은 코트","길ㄴ 코트","길는 코트"]',0,'길다的ㄹ在ㄴ前脱落，形成긴 코트。','structure',3,'single_choice',10,'foundation','["ㄹ脱落","母本§5.2"]','draft',1,true,'STEP 03','母本 §5.2'),
    (test_uuid,'golden-14-04','哪一句正确建议顾客试穿外套？','["이 코트를 입어 보세요.","이 코트를 입 보세요.","이 코트를 신어 보세요.","이 코트를 써 보세요."]',0,'衣服用입다，接-어 보세요并按本课标准分写。','structure',4,'single_choice',10,'foundation','["试穿建议","母本§5.3"]','draft',1,true,'STEP 03','母本 §5.3'),
    (test_uuid,'golden-14-05','哪一句按本课设定尊敬地表示“送给母亲”？','["어머니께 드릴 거예요.","어머니한테 줄 거예요.","어머니께서 드릴 거예요.","어머니에 드릴 거예요."]',0,'尊敬接受者用께，给与动词使用드리다。','structure',5,'single_choice',10,'foundation','["接受者","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-14-06','给同龄朋友发送照片时，哪一句符合本课目标形式？','["친구한테 사진을 보낼 거예요.","친구께 사진을 드릴 거예요.","친구에서 사진을 보낼 거예요.","친구가 사진한테 보낼 거예요."]',0,'一般同龄接受者在本课用口语助词한테。','structure',6,'single_choice',10,'foundation','["接受者","母本§5.4"]','draft',1,true,'STEP 03','母本 §5.4'),
    (test_uuid,'golden-14-07','主场景中，王明最后选择了哪件商品？','["较小的米色外套","长黑色外套","米色帽子","黑色帽子"]',0,'主对话第5、8—10轮表明王明试穿并购买较小的米色外套。','reading',7,'single_choice',10,'foundation','["对话事实","母本§6.1"]','draft',1,true,'STEP 05','母本 §6.1'),
    (test_uuid,'golden-14-08','私有听力中，顾客要把外套送给谁？','["母亲","同龄朋友","弟弟或妹妹","老师"]',0,'听力原文直接说어머니께 드릴 거예요。','listening',8,'single_choice',10,'foundation','["听力","母本§7.1"]','draft',1,true,'STEP 06','母本 §7.1'),
    (test_uuid,'golden-14-09','新品告知中的新外套有什么特点？','["轻而暖和","重而凉","小而不舒服","长而昂贵"]',0,'阅读第一句说明가볍고 따뜻한 코트。','reading',9,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-14-10','新品告知中有哪些长度与颜色组合？','["米色长外套和黑色短外套","黑色长外套和米色短外套","白色长外套和蓝色短外套","只有一件黑色长外套"]',0,'阅读原句为긴 베이지색 코트와 짧은 검은색 코트가 있어요。','reading',10,'single_choice',10,'foundation','["阅读","母本§8.1"]','draft',1,true,'STEP 07','母本 §8.1'),
    (test_uuid,'golden-14-11','双角色服饰购物交流的自然信息链是哪一项？','["说明需求与接受者→比较两件商品→建议尝试→试穿后评价→选择并购买","只朗读服饰词→不回应店员→直接结束","先购买→再说明需求→省略商品比较","单人介绍一件商品→不提出或接受建议"]',0,'母本最终输出要求两角色围绕需求、比较、试穿、接受者和购买形成连续交流。','assembly',11,'single_choice',10,'medium','["表达组织","母本§1"]','draft',1,true,'STEP 08','母本 §1'),
    (test_uuid,'golden-14-12','课末正式录音必须满足哪一项？','["50—70秒、10—12轮、双角色并覆盖十类信息","只朗读一条服饰建议即可","必须获得自动发音分数","可以单人商品介绍代替交流"]',0,'母本规定50—70秒、10—12轮、双角色和十类信息；当前不做自动发音评分。','assembly',12,'single_choice',10,'medium','["任务合同","母本§7.2"]','draft',1,true,'STEP 08','母本 §7.2');

  select id into chapter_uuid from public.digital_textbook_chapters
  where version_id=version_uuid and (chapter_number=14 or slug='clothing')
  order by (slug='clothing') desc limit 1;
  if chapter_uuid is null then
    insert into public.digital_textbook_chapters (
      version_id,chapter_test_id,slug,chapter_number,title,scenario,goal,status,
      production_status,editorial_status,native_review_status,audio_status,image_status,source_revision
    ) values (
      version_uuid,test_uuid,'clothing',14,
      '{"zh-CN":"请试穿这件衣服。","ko-KR":"이 옷을 입어 보세요."}',
      '{"zh-CN":"王明在服装店为母亲比较两件外套并以自己试穿参考长度和版型；敏智和宥娜在配饰区比较两顶帽子。","ko-KR":"왕밍은 옷가게에서 어머니께 드릴 코트 두 벌을 비교하고 직접 입어 길이와 모양을 참고합니다. 민지와 유나는 잡화 코너에서 모자 두 개를 비교합니다."}',
      '{"zh-CN":"描述并比较两件服饰，按对象建议试穿或试戴，区分一般与尊敬接受者，完成50—70秒、10—12轮双角色购物交流。","ko-KR":"옷 두 벌을 묘사하고 비교하며 대상에 맞게 착용을 제안하고 받는 사람 높임을 구별하여 50~70초, 10~12턴의 두 역할 쇼핑 대화를 완성합니다."}',
      'draft','editorial_review','pending','pending','pending','pending',
      'UPLY BOOK 第14课 이 옷을 입어 보세요.md @ 2026-08-18 / sha256:b5f719645a32359b71595c6278a4d44201e515823ce645708708d5c49919e4c0'
    ) returning id into chapter_uuid;
  else
    update public.digital_textbook_chapters set
      chapter_test_id=test_uuid,slug='clothing',chapter_number=14,
      title='{"zh-CN":"请试穿这件衣服。","ko-KR":"이 옷을 입어 보세요."}',
      scenario='{"zh-CN":"王明在服装店为母亲比较两件外套并以自己试穿参考长度和版型；敏智和宥娜在配饰区比较两顶帽子。","ko-KR":"왕밍은 옷가게에서 어머니께 드릴 코트 두 벌을 비교하고 직접 입어 길이와 모양을 참고합니다. 민지와 유나는 잡화 코너에서 모자 두 개를 비교합니다."}',
      goal='{"zh-CN":"描述并比较两件服饰，按对象建议试穿或试戴，区分一般与尊敬接受者，完成50—70秒、10—12轮双角色购物交流。","ko-KR":"옷 두 벌을 묘사하고 비교하며 대상에 맞게 착용을 제안하고 받는 사람 높임을 구별하여 50~70초, 10~12턴의 두 역할 쇼핑 대화를 완성합니다."}',
      status='draft',production_status='editorial_review',editorial_status='pending',
      native_review_status='pending',audio_status='pending',image_status='pending',
      source_revision='UPLY BOOK 第14课 이 옷을 입어 보세요.md @ 2026-08-18 / sha256:b5f719645a32359b71595c6278a4d44201e515823ce645708708d5c49919e4c0',
      updated_at=now()
    where id=chapter_uuid;
  end if;

  for item in select value from jsonb_array_elements($modules$
  [
    {"code":"orientation","order":1,"accent":"sky","type":"mission","minutes":5,"node":"mission-map","title":{"zh-CN":"课前导航","ko-KR":"학습 안내"},"nodeTitle":{"zh-CN":"在服装店怎样说清需要？","ko-KR":"옷가게에서 필요한 옷을 어떻게 말할까요?"},"content":{"lead":{"zh-CN":"说清服饰种类、特征、使用者或送礼对象，店员才能给出合适建议。","ko-KR":"옷 종류, 특징과 받는 사람을 말해야 알맞은 제안을 받을 수 있습니다."},"scene":{"people":"王明、秀珍；敏智、宥娜","place":"商场服装店外套区与配饰区","purpose":"说明需求、比较商品、试穿或试戴并完成购买","imageStatus":"pending"},"targets":[{"ko":"긴 코트를 찾고 있어요.","zh":"说明服饰需求"},{"ko":"저 코트가 더 편해요.","zh":"明确比较"},{"ko":"어머니께 드릴 거예요.","zh":"说明尊敬接受者"}],"finalOutput":{"zh-CN":"50—70秒、10—12轮双角色服饰购物交流。","ko-KR":"50~70초, 10~12턴의 두 역할 옷 쇼핑 대화입니다."},"coach":{"zh-CN":"答对不计分的购物场景诊断即完成；复述课末任务为自主展示。","ko-KR":"점수 없는 쇼핑 장면 진단 정답만 필수이며 과제 설명은 자율 활동입니다."},"nextNode":"clothing-words"}},
    {"code":"vocabulary","order":2,"accent":"jade","type":"learn","minutes":11,"node":"clothing-words","title":{"zh-CN":"核心词汇","ko-KR":"핵심 어휘"},"nodeTitle":{"zh-CN":"把服饰、特征和穿戴动作配起来","ko-KR":"옷, 특징과 착용 동사 연결하기"},"content":{"lead":{"zh-CN":"按看图认服饰、点读原形、跟读搭配、用特征与动作说整句的顺序学习；28词音频全部待制作。","ko-KR":"그림, 기본형, 결합, 특징과 동작 문장 순서로 익힙니다. 28개 음원은 제작 대기 중입니다."},"vocabulary":[{"ko":"옷","zh":"衣服","pos":"名词","collocation":"옷을 찾다"},{"ko":"코트","zh":"外套、大衣","pos":"名词","collocation":"긴 코트"},{"ko":"셔츠","zh":"衬衫","pos":"名词","collocation":"작은 셔츠"},{"ko":"치마","zh":"裙子","pos":"名词","collocation":"짧은 치마"},{"ko":"바지","zh":"裤子","pos":"名词","collocation":"짧은 바지"},{"ko":"원피스","zh":"连衣裙","pos":"名词","collocation":"예쁜 원피스"},{"ko":"구두","zh":"皮鞋","pos":"名词","collocation":"구두를 신다"},{"ko":"운동화","zh":"运动鞋","pos":"名词","collocation":"편한 운동화"},{"ko":"모자","zh":"帽子","pos":"名词","collocation":"모자를 쓰다"},{"ko":"가방","zh":"包","pos":"名词","collocation":"가벼운 가방"},{"ko":"색깔","zh":"颜色","pos":"名词","collocation":"색깔이 좋아요"},{"ko":"사이즈","zh":"尺码","pos":"名词","collocation":"사이즈가 맞다"},{"ko":"선물","zh":"礼物","pos":"名词","collocation":"선물 포장"},{"ko":"사진","zh":"照片","pos":"名词","collocation":"사진을 보내다"},{"ko":"손님","zh":"顾客","pos":"名词","collocation":"손님이 고르다"},{"ko":"직원","zh":"店员","pos":"名词","collocation":"직원이 추천하다"},{"ko":"길다","zh":"长","pos":"形容词","collocation":"긴 코트"},{"ko":"짧다","zh":"短","pos":"形容词","collocation":"짧은 치마"},{"ko":"크다","zh":"大","pos":"形容词","collocation":"큰 사이즈"},{"ko":"작다","zh":"小","pos":"形容词","collocation":"작은 코트"},{"ko":"예쁘다","zh":"漂亮","pos":"形容词","collocation":"예쁜 원피스"},{"ko":"가볍다","zh":"轻","pos":"形容词","collocation":"가벼운 코트"},{"ko":"편하다","zh":"舒服","pos":"形容词","collocation":"편한 운동화"},{"ko":"입다","zh":"穿衣服","pos":"动词","collocation":"코트를 입다"},{"ko":"신다","zh":"穿鞋袜","pos":"动词","collocation":"구두를 신다"},{"ko":"쓰다","zh":"戴帽子、眼镜","pos":"动词","collocation":"모자를 쓰다"},{"ko":"찾다","zh":"找、寻找","pos":"动词","collocation":"코트를 찾다"},{"ko":"드리다","zh":"给、送（谦敬）","pos":"动词","collocation":"어머니께 드리다"}],"studyFlow":["看图认服饰","点读原形","跟读自然搭配","用特征与动作说整句"],"coach":{"zh-CN":"词义选对并确认朗读整句才完成；点读、图片快说和扩展搭配为自主练习。","ko-KR":"뜻 정답과 문장 낭독 확인이 필요하며 듣기와 그림 말하기는 자율 연습입니다."},"nextNode":"clothing-grammar-tools"}},
    {"code":"grammar","order":3,"accent":"iris","type":"learn","minutes":18,"node":"clothing-grammar-tools","title":{"zh-CN":"语法讲解","ko-KR":"문법 이해"},"nodeTitle":{"zh-CN":"描述服饰、建议试穿并说清送给谁","ko-KR":"옷을 묘사하고 착용을 제안하며 받는 사람 말하기"},"content":{"lead":{"zh-CN":"四个工具分别负责形容词定语、ㄹ脱落、礼貌建议尝试，以及一般与尊敬接受者。","ko-KR":"네 가지 도구로 형용사 관형형, ㄹ 탈락, 착용 제안과 받는 사람 높임을 익힙니다."},"grammarCards":[{"form":"A-(으)ㄴ N","function":{"zh-CN":"把长短、大小、外观、重量和穿着感放到服饰名词前。","ko-KR":"옷의 길이, 크기, 모양, 무게와 느낌을 명사 앞에서 설명합니다."},"rules":["无收音接-ㄴ","有非ㄹ收音接-은","ㄹ在ㄴ前脱落","已学ㅂ不规则变우后接ㄴ","定语与名词分写"],"examples":[{"ko":"예쁜 원피스를 찾고 있어요.","zh":"正在找漂亮的连衣裙。","audioId":"chapter-14-grammar-01-example-01","audioStatus":"pending"},{"ko":"이 긴 검은 코트는 어떠세요? 가볍고 따뜻해요.","zh":"这件黑色长外套怎么样？又轻又暖和。","audioId":"chapter-14-grammar-01-example-02","audioStatus":"pending"},{"ko":"긴 베이지색 코트와 짧은 검은색 코트가 있어요.","zh":"有米色长外套和黑色短外套。","audioId":"chapter-14-grammar-01-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"形容词现在时定语写예쁜 원피스，不写예쁘는 원피스。","ko-KR":"형용사 관형형은 예쁜 원피스이며 예쁘는 원피스가 아닙니다."},"comparison":{"zh-CN":"코트가 길어요在句末评价；긴 코트在名词前指明商品。","ko-KR":"코트가 길어요는 서술, 긴 코트는 명사 앞 수식입니다."},"source":{"zh-CN":"母本§5.1；旧电子书页码待人工核对。","ko-KR":"원고 §5.1; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"ㄹ脱落","function":{"zh-CN":"让길다等ㄹ收音形容词正确修饰服饰。","ko-KR":"길다 같은 ㄹ 받침 형용사가 옷 명사를 바르게 꾸밉니다."},"rules":["ㄹ遇ㄴ、ㅂ、ㅅ开头词尾时通常脱落","本课重点是ㄹ＋ㄴ","去掉ㄹ后接ㄴ，不加으","길어요、길고中保留ㄹ","定语与名词分写"],"examples":[{"ko":"긴 치마를 찾고 있어요.","zh":"正在找长裙。","audioId":"chapter-14-grammar-02-example-01","audioStatus":"pending"},{"ko":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요.","zh":"要送给母亲。正在找长外套。","audioId":"chapter-14-grammar-02-example-02","audioStatus":"pending"},{"ko":"긴 베이지색 코트와 짧은 검은색 코트가 있어요.","zh":"有米色长外套和黑色短外套。","audioId":"chapter-14-grammar-02-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"길다的ㄹ在ㄴ前脱落，应写긴 코트，不写길은 코트。","ko-KR":"길다의 ㄹ이 ㄴ 앞에서 탈락해 긴 코트가 됩니다."},"comparison":{"zh-CN":"긴 코트发生ㄹ脱落；작은 코트保留非ㄹ收音并接은。","ko-KR":"긴 코트는 ㄹ 탈락, 작은 코트는 받침 뒤 은 결합입니다."},"source":{"zh-CN":"母本§5.2；旧电子书页码待人工核对。","ko-KR":"원고 §5.2; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"V-아/어 보세요","function":{"zh-CN":"按商品种类礼貌建议试穿衣服、鞋子或试戴帽子。","ko-KR":"상품에 맞는 동사로 입거나 신거나 써 보라고 정중하게 제안합니다."},"rules":["末元音ㅏ/ㅗ接-아 보세요","其他元音接-어 보세요","하다变해 보세요","쓰다变써 보세요","本课按辅助动词原则分写"],"examples":[{"ko":"이 구두를 신어 보세요.","zh":"请试穿这双皮鞋。","audioId":"chapter-14-grammar-03-example-01","audioStatus":"pending"},{"ko":"네. 이 작은 베이지색 코트를 입어 보세요.","zh":"有。请试穿这件小一点的米色外套。","audioId":"chapter-14-grammar-03-example-02","audioStatus":"pending"},{"ko":"어머니께 드릴 선물을 찾으세요? 매장에서 직접 입어 보세요.","zh":"在找送给母亲的礼物吗？请在店里直接试穿。","audioId":"chapter-14-grammar-03-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"先把입다变成입어，再分写보세요；不写입 보세요。","ko-KR":"입다를 입어로 바꾼 뒤 보세요를 띄어 씁니다."},"comparison":{"zh-CN":"입어 보세요强调尝试；입으세요是一般的请穿。","ko-KR":"입어 보세요는 시도, 입으세요는 일반적인 권유입니다."},"source":{"zh-CN":"母本§5.3；旧电子书页码待人工核对。","ko-KR":"원고 §5.3; 기존 전자책 쪽수는 수동 확인이 필요합니다."}},{"form":"N한테/께","function":{"zh-CN":"按关系说明礼物、照片或物品的接受者。","ko-KR":"관계에 따라 선물, 사진이나 물건을 받는 사람을 말합니다."},"rules":["一般或同龄接受者用한테","尊敬接受者用께","两者均直接接人物名词","尊敬对象核对드리다等动词","께与主体助词께서不同"],"examples":[{"ko":"친구한테 사진을 보낼 거예요.","zh":"要把照片发给朋友。","audioId":"chapter-14-grammar-04-example-01","audioStatus":"pending"},{"ko":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요.","zh":"要送给母亲。正在找长外套。","audioId":"chapter-14-grammar-04-example-02","audioStatus":"pending"},{"ko":"베이지색이 더 좋아요. 친구한테 사진을 보낼 거예요.","zh":"米色更好。我要把照片发给朋友。","audioId":"chapter-14-grammar-04-example-03","audioStatus":"pending"}],"caution":{"zh-CN":"本课尊敬母亲时用어머니께并配合드리다。","ko-KR":"어머니를 높일 때 어머니께와 드리다를 함께 씁니다."},"comparison":{"zh-CN":"친구한테中的朋友是接受者；친구가中的朋友是动作主体。","ko-KR":"친구한테는 받는 사람, 친구가는 행동 주체입니다."},"source":{"zh-CN":"母本§5.4；旧电子书页码待人工核对。","ko-KR":"원고 §5.4; 기존 전자책 쪽수는 수동 확인이 필요합니다."}}],"coach":{"zh-CN":"八个目标空全部正确才完成；规则解释和扩展变形为自主练习。","ko-KR":"여덟 칸을 모두 맞혀야 하며 규칙 설명과 확장 활용은 자율 연습입니다."},"nextNode":"shopping-builder"}},
    {"code":"patterns","order":4,"accent":"coral","type":"practice","minutes":12,"node":"shopping-builder","title":{"zh-CN":"句型操练","ko-KR":"문형 연습"},"nodeTitle":{"zh-CN":"让需求、比较和试穿建议一环接一环","ko-KR":"필요, 비교와 착용 제안 이어 가기"},"content":{"lead":{"zh-CN":"通过服饰特征、评价比较、穿戴动作与接受者三组替换，再排列六个有明确问答和即时回指的话轮。","ko-KR":"옷 특징, 평가와 비교, 착용 동사와 받는 사람을 바꾸고 여섯 말차례를 배열합니다."},"substitutions":[["긴 코트를 찾고 있어요.","짧은 치마를 찾고 있어요.","작은 셔츠를 찾고 있어요.","편한 운동화를 찾고 있어요."],["이 코트는 조금 커요.","이 치마는 조금 길어요.","저 코트가 더 편해요.","저 운동화가 더 가벼워요."],["이 코트를 입어 보세요.","이 구두를 신어 보세요.","이 모자를 써 보세요.","친구한테 선물할 거예요.","어머니께 드릴 거예요."]],"practice":{"quickResponse":"同伴随机给服饰与尝试类型，3秒内补自然特征和正确穿戴动词。","personalOutput":"用安全虚构信息说需求、两件商品评价和送礼对象三句。","required":false},"coach":{"zh-CN":"六个完整话轮顺序完全正确才完成；替换、快答和个人表达为自主练习。","ko-KR":"여섯 말차례의 순서만 필수이며 바꾸기와 개인 표현은 자율 연습입니다."},"nextNode":"clothing-store-talk"}},
    {"code":"dialogue","order":5,"accent":"sky","type":"mission","minutes":14,"node":"clothing-store-talk","title":{"zh-CN":"实战对话","ko-KR":"실전 대화"},"nodeTitle":{"zh-CN":"比较之后再作出选择","ko-KR":"비교한 뒤 선택하기"},"content":{"lead":{"zh-CN":"主场景完成送礼需求、推荐、比较、代试参考、母亲复试与购买；第二场景比较两顶帽子并向朋友发照片。","ko-KR":"주 장면은 선물, 추천, 비교, 참고 착용, 어머니의 재착용과 구매를, 두 번째 장면은 모자 비교와 사진 전송을 다룹니다."},"dialogueScenes":[{"title":{"zh-CN":"商场服装店外套区","ko-KR":"백화점 옷가게 코트 코너"},"people":"王明／秀珍店员","place":"外套区与试衣间前","purpose":"为母亲选择外套，以自己试穿仅参考长度、版型和穿着感","lines":[{"role":"직원","ko":"어서 오세요. 무엇을 찾으세요?","zh":"欢迎光临。您在找什么？"},{"role":"왕밍","ko":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요.","zh":"要送给母亲。我在找长外套。"},{"role":"직원","ko":"이 긴 검은 코트는 어떠세요? 가볍고 따뜻해요.","zh":"这件黑色长外套怎么样？又轻又暖和。"},{"role":"왕밍","ko":"예쁘지만 저한테는 조금 커요. 어머니와 키가 비슷해요. 더 작은 코트도 있어요?","zh":"很漂亮，但对我有点大。我和母亲身高相近。还有更小的吗？"},{"role":"직원","ko":"네. 이 작은 베이지색 코트를 입어 보세요.","zh":"有。请试穿这件小一点的米色外套。"},{"role":"왕밍","ko":"네, 감사합니다.","zh":"好的，谢谢。"},{"role":"직원","ko":"사이즈가 어때요? 길이와 모양도 보세요.","zh":"尺码怎么样？也请看看长度和版型。"},{"role":"왕밍","ko":"저한테는 잘 맞고 편해요. 검은 코트는 컸어요. 이 코트의 길이와 모양이 더 좋아요. 집에서 어머니도 다시 입어 볼 거예요.","zh":"对我合身也舒服。黑色款大了。这件长度和版型更好。母亲回家会再试穿。"},{"role":"직원","ko":"그럼 이 코트로 드릴까요?","zh":"那就给您这件吗？"},{"role":"왕밍","ko":"네, 이거 주세요. 선물 포장도 해 주세요.","zh":"好，请给我这个。也请做礼物包装。"}]},{"title":{"zh-CN":"服装店配饰区","ko-KR":"옷가게 잡화 코너"},"people":"敏智／宥娜","place":"帽子配饰区","purpose":"比较帽子的大小、颜色和穿戴感，试戴后征求另一位朋友意见","lines":[{"role":"민지","ko":"이 검은 모자는 어때요?","zh":"这顶黑帽子怎么样？"},{"role":"유나","ko":"예쁘지만 조금 커요.","zh":"很漂亮，但有点大。"},{"role":"민지","ko":"그럼 저 작은 베이지색 모자를 써 보세요.","zh":"那请试戴那顶小一点的米色帽子。"},{"role":"유나","ko":"네. 이 모자는 잘 맞고 가벼워요.","zh":"好。这顶很合适，也很轻。"},{"role":"민지","ko":"두 모자 중에서 어떤 색깔이 더 좋아요?","zh":"两顶帽子中更喜欢哪种颜色？"},{"role":"유나","ko":"베이지색이 더 좋아요. 친구한테 사진을 보낼 거예요.","zh":"米色更好。我要把照片发给朋友。"}]}],"coach":{"zh-CN":"事实组合题和自然回应题都答对才完成；信息替换和试录为自主练习。","ko-KR":"사실 조합과 자연스러운 대답을 모두 맞혀야 하며 바꾸기와 시험 녹음은 자율 연습입니다."},"nextNode":"listen-and-shop"}},
    {"code":"listen_speak","order":6,"accent":"jade","type":"practice","minutes":15,"node":"listen-and-shop","title":{"zh-CN":"听说任务","ko-KR":"듣기·말하기"},"nodeTitle":{"zh-CN":"听清送礼对象，再完成自己的购物交流","ko-KR":"받는 사람을 듣고 쇼핑 대화 완성하기"},"content":{"lead":{"zh-CN":"两版听力真实制作并绑定后听出送礼对象，再提交50—70秒、10—12轮双角色录音。","ko-KR":"두 음원이 제작·연결된 뒤 받는 사람을 듣고 50~70초, 10~12턴 녹음을 제출합니다."},"speakingFrame":["어서 오세요. 무엇을 찾으세요?","___한테 선물할 거예요.／___께 드릴 거예요.","___ A-(으)ㄴ N을/를 찾고 있어요.","이 ___은/는 어때요? ___고 ___.","조금 ___. 더 ___ A-(으)ㄴ N도 있어요?","그럼 이 ___을/를 입어／신어／써 보세요.","네, 이거 주세요. 포장도 해 주세요."],"requiredInformation":["问候与需求","送礼对象或使用者","一件形容词定语服饰","两件商品及各自特征","明确比较","尝试建议","试穿后评价","한테／께接受者表达","最终选择","购买请求"],"coach":{"zh-CN":"听力答对且开放口语达到提交门槛才完成；口语不产生正确性或分数。","ko-KR":"듣기 정답과 말하기 제출 조건이 모두 필요하며 말하기에는 정오나 점수가 없습니다."},"nextNode":"store-message"}},
    {"code":"read_write","order":7,"accent":"coral","type":"practice","minutes":14,"node":"store-message","title":{"zh-CN":"读写拓展","ko-KR":"읽기·쓰기"},"nodeTitle":{"zh-CN":"读新品告知，写一条服饰推荐消息","ko-KR":"신상품 안내를 읽고 옷 추천 메시지 쓰기"},"content":{"lead":{"zh-CN":"从新品告知中找商品特点、两种款式、尺码和到店行动，再以单一作者写给固定同龄朋友智敏。","ko-KR":"신상품 안내에서 특징, 두 스타일, 사이즈와 매장 행동을 찾고 한 작성자가 친구 지민에게 씁니다."},"reading":"가을 코트 선물 안내\n가볍고 따뜻한 코트가 들어왔어요.\n긴 베이지색 코트와 짧은 검은색 코트가 있어요.\n큰 사이즈와 작은 사이즈가 모두 있어요.\n어머니와 키가 비슷한 분만 아래 방법을 참고하세요.\n어머니께 드릴 선물을 찾으세요? 매장에서 직접 입어 보세요.\n길이와 모양만 참고하고, 집에서 어머니도 다시 입어 보세요.","writing":{"audience":"固定同龄朋友智敏","sentences":"6—8","required":["送礼对象","两件商品","至少三项特征","一次比较","推荐与匹配穿戴动作","代试仅参考长度版型","收礼者复试","量规自查"],"scaffold":"지민 씨, ___한테 선물할 거예요?／___께 드릴 거예요? → 이/저 ___은/는 ___ A-(으)ㄴ N이에요. → 다른 ___은/는 ___. → 저는 ___이/가 더 좋아요. → 한번 입어 보고 길이와 모양만 참고하세요. → 집에서 ___도 다시 입어 보세요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"]},"coach":{"zh-CN":"阅读三题全对，并提交6—8句合格原创推荐消息及量规自查才完成。","ko-KR":"읽기 세 문항 정답과 6~8문장 추천 메시지 및 점검이 모두 필요합니다."},"nextNode":"can-do-check"}},
    {"code":"review","order":8,"accent":"iris","type":"review","minutes":8,"node":"can-do-check","title":{"zh-CN":"自测与复盘","ko-KR":"점검과 복습"},"nodeTitle":{"zh-CN":"我能比较并完成试穿购物吗？","ko-KR":"비교하고 착용 쇼핑을 완성할 수 있나요?"},"content":{"lead":{"zh-CN":"综合多选检查形式与功能，再按真实表现回应五项Can-do并记录返回节点。","ko-KR":"복수 선택으로 형태와 기능을 확인하고 실제 수행에 따라 다섯 Can-do와 복습 노드를 기록합니다."},"reviewMap":[{"cause":"词汇","returnNode":"clothing-words"},{"cause":"语法","returnNode":"clothing-grammar-tools"},{"cause":"理解","returnNode":"clothing-store-talk／listen-and-shop"},{"cause":"表达","returnNode":"listen-and-shop"},{"cause":"读写","returnNode":"store-message"}],"coach":{"zh-CN":"综合多选正确，并完成五项自查与返回位置才完成；自主复习展示不计入强制条件。","ko-KR":"복수 선택 정답과 다섯 자기 점검 및 복습 위치 기록이 필요합니다."},"nextNode":"chapter-test:korean-level-one-14"}}
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
    {"node":"mission-map","sort":1,"key":"orientation-check","type":"single_choice","prompt":{"zh-CN":"服装店店员问王明“您在找什么？”。哪一句最适合回答？","ko-KR":"옷가게 직원이 왕밍에게 무엇을 찾으세요?라고 물었습니다. 가장 알맞은 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择能够直接说明服饰购物需求的一句；本题不显示分数。","ko-KR":"사고 싶은 옷을 직접 말하는 문장을 고르세요. 점수는 표시하지 않습니다."},"options":["긴 코트를 찾고 있어요.","서울역으로 가 주세요.","목이 많이 아파요.","지금 통화할 수 없어요."],"config":{"shuffle":true,"showScore":false},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"该句直接说明正在找长外套。","ko-KR":"긴 코트를 찾는다는 쇼핑 목적을 직접 말합니다."},"feedback":[{"zh-CN":"先找服饰名词和表示寻找的谓语。","ko-KR":"옷 이름과 찾는다는 동사를 먼저 찾으세요."},{"zh-CN":"目标句必须回答想买什么，不是谈交通、健康或电话。","ko-KR":"교통, 건강이나 전화가 아니라 사고 싶은 옷을 말해야 합니다."},{"zh-CN":"应选择긴 코트를 찾고 있어요.，意思是“正在找长外套”。","ko-KR":"정답은 긴 코트를 찾고 있어요.입니다."}]}},
    {"node":"clothing-words","sort":1,"key":"vocabulary-check","type":"single_choice","prompt":{"zh-CN":"在이 코트는 가벼워요.中，가볍다是什么意思？","ko-KR":"이 코트는 가벼워요.에서 가볍다는 무슨 뜻이에요?"},"instruction":{"zh-CN":"选择词义，再朗读整句一次并勾选确认。","ko-KR":"뜻을 고른 뒤 문장 전체를 한 번 읽고 확인하세요."},"options":["长","轻","小","漂亮"],"config":{"shuffle":true,"example":"이 코트는 가벼워요.","readAloudConfirmation":{"type":"checkbox","label":"已朗读整句","required":true},"audioPending":true},"answer":{"kind":"index_confirmation","value":1},"explanation":{"correct":{"zh-CN":"가볍다描述重量轻。","ko-KR":"가볍다는 무게가 가볍다는 뜻입니다."},"feedback":[{"zh-CN":"先判断是在说长度、重量、大小还是外观。","ko-KR":"길이, 무게, 크기나 모양 중 무엇인지 생각하세요."},{"zh-CN":"常用定语搭配是가벼운 코트。","ko-KR":"관형형 결합은 가벼운 코트입니다."},{"zh-CN":"答案是“轻”；整句表示“这件外套很轻”。","ko-KR":"정답은 가볍다입니다."}]}},
    {"node":"clothing-grammar-tools","sort":1,"key":"grammar-fill","type":"fill_blank","prompt":{"zh-CN":"完成八个目标空，检查形容词定语、ㄹ脱落、试穿建议和接受者助词。","ko-KR":"형용사 관형형, ㄹ 탈락, 착용 제안과 받는 사람 조사를 확인하는 여덟 칸을 완성하세요."},"instruction":{"zh-CN":"按每题公开指定的本课功能和形式作答，保留标准空格。","ko-KR":"각 문항에 제시된 이 과의 기능과 형태에 맞게 쓰고 표준 띄어쓰기를 지키세요."},"options":[],"config":{"shuffle":true,"normalization":"NFC","items":[{"id":"item-01","label":"예쁘다 → ___ 원피스（本课形容词定语）","placeholder":"답을 입력하세요"},{"id":"item-02","label":"작다 → ___ 코트（本课形容词定语）","placeholder":"답을 입력하세요"},{"id":"item-03","label":"길다 → ___ 치마（本课ㄹ脱落定语）","placeholder":"답을 입력하세요"},{"id":"item-04","label":"가볍다 → ___ 가방（复现ㅂ不规则＋本课定语）","placeholder":"답을 입력하세요"},{"id":"item-05","label":"입다 → ___（礼貌建议试穿；标准分写）","placeholder":"답을 입력하세요"},{"id":"item-06","label":"신다 → ___（礼貌建议试鞋；标准分写）","placeholder":"답을 입력하세요"},{"id":"item-07","label":"친한 동갑 친구___ 사진을 보낼 거예요.（本课一般口语接受者）","placeholder":"답을 입력하세요"},{"id":"item-08","label":"어머니___ 선물을 드릴 거예요.（本课尊敬接受者）","placeholder":"답을 입력하세요"}]},"answer":{"kind":"text_array","value":["예쁜","작은","긴","가벼운","입어 보세요","신어 보세요","한테","께"]},"explanation":{"correct":{"zh-CN":"八项形式全部正确；内部拼写和标准空格均保留。","ko-KR":"여덟 형태의 철자와 표준 띄어쓰기가 모두 맞습니다."},"feedback":[{"zh-CN":"先分为定语、ㄹ脱落、尝试建议和接受者，再处理词干与关系。","ko-KR":"관형형, ㄹ 탈락, 제안과 받는 사람으로 나누세요."},{"zh-CN":"前四题检查词干；中间两题先做-아/어再分写보세요；最后区分同龄朋友与母亲。","ko-KR":"어간, -아/어 보세요 띄어쓰기와 사람 관계를 확인하세요."},{"zh-CN":"依次为예쁜、작은、긴、가벼운、입어 보세요、신어 보세요、한테、께。","ko-KR":"차례대로 예쁜, 작은, 긴, 가벼운, 입어 보세요, 신어 보세요, 한테, 께입니다."}]}},
    {"node":"shopping-builder","sort":1,"key":"pattern-order","type":"ordering","prompt":{"zh-CN":"把六个完整话轮排成一段语义连贯的服装店交流。","ko-KR":"여섯 개의 완전한 말차례를 자연스러운 옷가게 대화로 배열하세요."},"instruction":{"zh-CN":"根据问题、回答和即时回指自行判断；卡片不标角色、步骤或位置。","ko-KR":"질문, 대답과 앞말 가리킴을 바탕으로 판단하세요. 역할이나 단계는 표시하지 않습니다."},"options":["네. 방금 보신 검은 코트보다 작은 이 베이지색 코트를 입어 보고 길이와 모양만 참고하세요.","어머니께 드릴 코트를 찾고 있어요. 어머니와 키가 비슷해요. 제가 입어 볼 거예요. 길이와 모양만 참고할 거예요. 긴 코트가 좋아요.","네, 길이와 모양만 참고할 거예요. 어머니가 집에서 다시 입어 보고 사이즈를 확인할 거예요. 이거 주세요.","어떤 옷을 찾으세요?","그럼 방금 말씀하신 긴 코트 중에서 이 검은 코트는 어떠세요?","검은 코트는 조금 커요. 그 코트보다 작은 코트도 있어요?"],"config":{"shuffle":true},"answer":{"kind":"order","value":[3,1,4,5,0,2]},"explanation":{"correct":{"zh-CN":"需求问答和방금 말씀하신／방금 보신／그 코트回指形成唯一连续链。","ko-KR":"질문과 답, 방금 말씀하신／방금 보신／그 코트가 한 흐름을 만듭니다."},"feedback":[{"zh-CN":"检查每个问句是否紧邻直接回答，并找没有前文就不能成立的回指。","ko-KR":"각 질문의 직접 답과 앞말이 필요한 가리킴을 찾으세요."},{"zh-CN":"先定位需求，再追踪刚说的长外套、那件黑色外套和这件米色外套。","ko-KR":"필요를 먼저 찾고 긴 코트, 검은 코트와 베이지색 코트를 따라가세요."},{"zh-CN":"系统依次检查需求问答、黑色款推荐与评价、米色款建议、母亲复试与购买的相邻衔接。","ko-KR":"필요, 검은 코트, 베이지색 코트, 재착용과 구매의 연결을 확인하세요."}]}},
    {"node":"clothing-store-talk","sort":1,"key":"dialogue-fact-check","type":"single_choice","prompt":{"zh-CN":"主场景中，礼物送给谁，王明最后选了哪件商品？","ko-KR":"주 장면에서 선물은 누구에게 주고 왕밍은 마지막에 어떤 상품을 골랐어요?"},"instruction":{"zh-CN":"选择接受者和最终商品都与台词一致的一组。","ko-KR":"받는 사람과 마지막 상품이 모두 대사와 같은 조합을 고르세요."},"options":["어머니／작은 베이지색 코트","친구／긴 검은 코트","어머니／긴 검은 코트","선생님／작은 베이지색 코트"],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"第2轮说明送给母亲，第5、8—10轮表明最后选择较小的米色外套。","ko-KR":"2턴에서 어머니께 드리고 5, 8~10턴에서 작은 베이지색 코트를 고릅니다."},"feedback":[{"zh-CN":"先找第2轮的接受者。","ko-KR":"2턴에서 받는 사람을 찾으세요."},{"zh-CN":"再区分最先看的黑色款与试穿后购买的米色款。","ko-KR":"처음 본 검은 코트와 산 베이지색 코트를 구별하세요."},{"zh-CN":"正确组合是어머니／작은 베이지색 코트。","ko-KR":"정답은 어머니／작은 베이지색 코트입니다."}]}},
    {"node":"clothing-store-talk","sort":2,"key":"dialogue-response","type":"single_choice","prompt":{"zh-CN":"店员说이 작은 코트를 입어 보세요.后，哪一句最自然地礼貌接受建议？","ko-KR":"직원이 이 작은 코트를 입어 보세요.라고 했습니다. 가장 자연스러운 대답은 무엇이에요?"},"instruction":{"zh-CN":"选择既接受试穿建议又符合店内礼貌交流的一句。","ko-KR":"착용 제안을 받아들이고 매장 예절에 맞는 대답을 고르세요."},"options":["네, 감사합니다.","아니요, 서울역으로 가 주세요.","네, 코트를 먹어요.","친구가 사진한테 보내요."],"config":{"shuffle":true},"answer":{"kind":"index","value":0},"explanation":{"correct":{"zh-CN":"네, 감사합니다.直接且礼貌地接受试穿建议。","ko-KR":"네, 감사합니다.가 착용 제안을 정중하게 받아들입니다."},"feedback":[{"zh-CN":"先找能够回应建议的肯定表达。","ko-KR":"제안에 답하는 긍정 표현을 찾으세요."},{"zh-CN":"回应还应保持店内礼貌，不要换到交通或无关动作。","ko-KR":"교통이나 관계없는 행동으로 화제를 바꾸지 마세요."},{"zh-CN":"应选择네, 감사합니다.。","ko-KR":"정답은 네, 감사합니다.입니다."}]}},
    {"node":"listen-and-shop","sort":1,"key":"listening-recipient","type":"listening","prompt":{"zh-CN":"听正常速或慢速音频，判断顾客要把外套送给谁。","ko-KR":"보통 속도나 느린 속도 음성을 듣고 손님이 코트를 누구에게 드릴지 고르세요."},"instruction":{"zh-CN":"正常速最多两遍、慢速最多一遍；只依据音频中的人物关系作答。","ko-KR":"보통 속도는 두 번, 느린 속도는 한 번까지 듣고 음성의 사람 관계에 답하세요."},"options":["어머니","친구","동생","선생님"],"config":{"shuffle":true,"audioStatus":"pending","normalPlays":2,"slowPlays":1,"tracks":[{"id":"track-01","label":"正常语速","audioId":"chapter-14-listening-recipient-normal","status":"pending"},{"id":"track-02","label":"慢速","audioId":"chapter-14-listening-recipient-slow","status":"pending"}]},"answer":{"kind":"index","value":0},"transcript":"직원: 어서 오세요. 어떤 옷을 찾으세요? 손님: 어머니께 드릴 거예요. 어머니와 키가 비슷해요. 작고 가벼운 코트를 찾고 있어요. 직원: 이 베이지색 코트는 어때요? 직접 입어 보고 길이와 모양을 확인하세요. 집에서 어머니도 다시 입어 보세요. 손님: 네, 감사합니다.","audioObjectKey":"korean-level-one/chapter-14/listening/chapter-14-listening-recipient-normal.mp3","audioStatus":"pending","explanation":{"correct":{"zh-CN":"答案是母亲；原文直接说어머니께 드릴 거예요。","ko-KR":"정답은 어머니이며 원문에 어머니께 드릴 거예요가 있습니다."},"feedback":[{"zh-CN":"再听顾客说明送礼对象的句子，注意人物名词。","ko-KR":"손님이 받는 사람을 말하는 문장을 다시 들으세요."},{"zh-CN":"接受者后使用께，后面的动词是드리다；再听具体是哪位长辈。","ko-KR":"께와 드리다 앞의 사람을 확인하세요."},{"zh-CN":"答案是어머니；其他人物均未出现。","ko-KR":"정답은 어머니이며 다른 사람은 나오지 않습니다."}],"privateListening":{"normalAudioId":"chapter-14-listening-recipient-normal","normalAudioObjectKey":"korean-level-one/chapter-14/listening/chapter-14-listening-recipient-normal.mp3","normalScript":"직원: 어서 오세요. 어떤 옷을 찾으세요? / 손님: 어머니께 드릴 거예요. 어머니와 키가 비슷해요. 작고 가벼운 코트를 찾고 있어요. / 직원: 이 베이지색 코트는 어때요? 직접 입어 보고 길이와 모양을 확인하세요. 집에서 어머니도 다시 입어 보세요. / 손님: 네, 감사합니다.","slowAudioId":"chapter-14-listening-recipient-slow","slowAudioObjectKey":"korean-level-one/chapter-14/listening/chapter-14-listening-recipient-slow.mp3","slowScript":"직원: 어서 오세요. / 어떤 옷을 찾으세요? / 손님: 어머니께 드릴 거예요. / 어머니와 키가 비슷해요. / 작고 가벼운 코트를 찾고 있어요. / 직원: 이 베이지색 코트는 어때요? / 직접 입어 보고 길이와 모양을 확인하세요. / 집에서 어머니도 다시 입어 보세요. / 손님: 네, 감사합니다.","pauseMarks":"직원: 어서 오세요. ⏸ 어떤 옷을 찾으세요? ⏸ 손님: 어머니께 드릴 거예요. ⏸ 어머니와 키가 비슷해요. ⏸ 작고 가벼운 코트를 찾고 있어요. ⏸ 직원: 이 베이지색 코트는 어때요? ⏸ 직접 입어 보고 길이와 모양을 확인하세요. ⏸ 집에서 어머니도 다시 입어 보세요. ⏸ 손님: 네, 감사합니다.","speaker":"F04／직원；M02／손님","distractorReasons":["朋友只出现在独立第二场景。","原文没有弟弟或妹妹。","께不能单独证明接受者一定是老师。"]}}},
    {"node":"listen-and-shop","sort":2,"key":"speaking-shopping","type":"speaking","prompt":{"zh-CN":"完成50—70秒、10—12轮的双角色服饰购物交流。","ko-KR":"두 역할을 번갈아 맡아 50~70초 동안 10~12턴의 옷 쇼핑 대화를 완성하세요."},"instruction":{"zh-CN":"加入问候与需求、接受者、形容词定语、两件商品及特征、比较、尝试建议、试穿评价和最终购买；代试只能参考长度与版型，并说明收礼者须再试穿。","ko-KR":"인사와 필요, 받는 사람, 형용사 관형형, 두 상품과 특징, 비교, 착용 제안, 평가와 구매를 넣으세요. 대신 입어 보면 길이와 모양만 참고하고 받는 사람도 다시 입는다고 말하세요."},"options":[],"config":{"minimumSeconds":50,"maximumSeconds":70,"minimumTurns":10,"maximumTurns":12,"rolesRequired":2,"requiredCriteria":10,"criteria":["问候与需求","送礼对象或使用者","一件形容词定语服饰","两件商品及各自特征","一次明确比较","一次尝试建议","试穿后评价","한테／께接受者表达","最终选择","购买请求"],"recordingRequired":true,"playbackAvailable":true,"pronunciationScore":false,"enforceCompletionRequirements":true},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存达到提交条件的原创录音；不产生正确性或分数。","ko-KR":"제출 조건을 갖춘 녹음을 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对十类信息和两个交替角色。","ko-KR":"열 가지 정보와 두 역할을 확인하세요."},{"zh-CN":"检查第一件评价、换一件请求、试穿建议和试穿后比较是否衔接。","ko-KR":"첫 평가, 다른 상품 요청, 착용 제안과 비교를 이어 보세요."},{"zh-CN":"按句框补齐缺项后重录；开放表达没有唯一台词。","ko-KR":"빠진 내용을 보완해 다시 녹음하세요."}]}},
    {"node":"store-message","sort":1,"key":"reading-store-notice","type":"single_choice","prompt":{"zh-CN":"阅读服装店秋季外套礼品告知，完成三道事实题。","ko-KR":"옷가게의 가을 코트 선물 안내를 읽고 사실 확인 세 문항에 답하세요."},"instruction":{"zh-CN":"每题只选一个答案，答案都能从公开告知直接找到。","ko-KR":"문제마다 하나를 고르고 공개된 안내에서 직접 답을 찾으세요."},"options":[],"config":{"shuffle":true,"reading":"가을 코트 선물 안내 / 가볍고 따뜻한 코트가 들어왔어요. / 긴 베이지색 코트와 짧은 검은색 코트가 있어요. / 큰 사이즈와 작은 사이즈가 모두 있어요. / 어머니와 키가 비슷한 분만 아래 방법을 참고하세요. / 어머니께 드릴 선물을 찾으세요? 매장에서 직접 입어 보세요. / 길이와 모양만 참고하고, 집에서 어머니도 다시 입어 보세요.","items":[{"id":"q1","question":"새 코트는 어떤 특징이 있어요?","options":["가볍고 따뜻해요","무겁고 차가워요","작고 불편해요","길고 비싸요"]},{"id":"q2","question":"어떤 길이와 색깔의 코트가 있어요?","options":["짧은 베이지색／긴 검은색","긴 흰색／짧은 파란색","긴 베이지색／짧은 검은색","긴 검은색 한 가지"]},{"id":"q3","question":"매장에서 직접 입어 보세요. 무엇을 입어요?","options":["모자","코트","구두","가방"]}]},"answer":{"kind":"index_array","value":[0,2,1]},"explanation":{"correct":{"zh-CN":"答案依次是轻而暖和、米色长外套与黑色短外套、外套。","ko-KR":"정답은 가볍고 따뜻해요, 긴 베이지색／짧은 검은색, 코트입니다."},"feedback":[{"zh-CN":"圈出第一句的两个特征、第二句的长短与颜色、末段建议试穿的商品。","ko-KR":"첫 특징, 두 스타일과 마지막 착용 상품을 찾으세요."},{"zh-CN":"不要把大小尺码误当成长度，也不要补入正文没有的商品。","ko-KR":"사이즈와 길이를 섞거나 글에 없는 상품을 더하지 마세요."},{"zh-CN":"三题依次为가볍고 따뜻해요、긴 베이지색／짧은 검은색、코트。","ko-KR":"세 답은 가볍고 따뜻해요, 긴 베이지색／짧은 검은색, 코트입니다."}]}},
    {"node":"store-message","sort":2,"key":"write-recommendation","type":"writing","prompt":{"zh-CN":"给固定的同龄朋友“智敏”写一条6—8句服饰推荐消息。","ko-KR":"또래 친구 지민 씨에게 6~8문장의 옷 추천 메시지를 쓰세요."},"instruction":{"zh-CN":"保持你写给智敏的单一作者与收件人，写送礼对象、两件商品、至少三项特征、比较、推荐与匹配穿戴动作；代试时写明仅参考长度版型且收礼者复试，并完成量规自查。","ko-KR":"한 작성자가 지민에게 받는 사람, 두 상품, 세 특징, 비교, 추천과 착용 동사를 쓰세요. 대신 입어 보면 길이와 모양만 참고하고 받는 사람이 다시 입는다고 쓰고 점검하세요."},"options":[],"config":{"minSentences":6,"maxSentences":8,"minimumHangulCharacters":60,"minimumInformationKinds":10,"informationChecklist":["固定收件人智敏","送礼对象","两件商品","至少三项特征","一次比较","推荐一件商品","匹配穿戴动作","代试仅参考长度版型","收礼者复试","四维量规自查"],"requiredPhraseGroups":[["긴 ","짧은 ","작은 ","예쁜 ","가벼운 ","편한 "],["더 "],["입어 보세요","신어 보세요","써 보세요"],["한테","께"],["다시 입어 보세요","다시 신어 보세요","다시 써 보세요"]],"minimumPhraseGroups":5,"requireCompletionChecklist":true,"scaffold":"지민 씨, ___한테 선물할 거예요?／___께 드릴 거예요? → 이 ___은/는 ___ A-(으)ㄴ N이에요. → 다른 ___은/는 ___. → 저는 ___이/가 더 좋아요. → 한번 입어 보고 길이와 모양만 참고하세요. → 집에서 ___도 다시 입어 보세요.","rubric":["信息完整","核心语法","逻辑与可理解度","格式与语气"],"rubricConfirmation":"我已按四维量规完成自查"},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"已保存满足句数、规定信息和量规自查的原创推荐消息；不产生正确性或分数。","ko-KR":"문장 수, 필수 정보와 점검을 갖춘 메시지를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"先核对作者与收件人始终是你到智敏，再数规定信息。","ko-KR":"한 작성자가 지민에게 쓰는지 보고 정보를 세세요."},{"zh-CN":"检查四项核心语法、穿戴动词和代试边界。","ko-KR":"네 문법, 착용 동사와 대신 입어 보는 범위를 확인하세요."},{"zh-CN":"按支架补齐缺项，删去其他角色回应，但不要复制示范。","ko-KR":"다른 역할의 답을 지우고 빠진 내용을 보완하세요."}]}},
    {"node":"can-do-check","sort":1,"key":"review-multiple","type":"multiple_choice","prompt":{"zh-CN":"选择所有形式正确且实现括号中功能的表达。","ko-KR":"형태가 바르고 괄호의 기능을 알맞게 나타내는 표현을 모두 고르세요."},"instruction":{"zh-CN":"正确项全部选中且不多选才算完成。","ko-KR":"맞는 표현을 모두 고르고 틀린 표현은 고르지 마세요."},"options":["긴 코트（长外套；形容词定语＋ㄹ脱落）","이 옷을 입어 보세요.（试穿建议）","어머니께 선물을 드려요.（尊敬接受者）","길은 코트（长外套；形容词定语）"],"config":{"selection":"multiple","shuffle":true},"answer":{"kind":"indices","value":[0,1,2]},"explanation":{"correct":{"zh-CN":"前三项正确；第4项应为긴 코트。","ko-KR":"앞의 세 표현이 맞고 4번은 긴 코트입니다."},"feedback":[{"zh-CN":"检查ㄹ是否在ㄴ前脱落、尝试建议是否完整、助词与给与动词是否对应。","ko-KR":"ㄹ 탈락, 착용 제안과 높임 표현을 확인하세요."},{"zh-CN":"只有一项把길다错误变成保留ㄹ再接은。","ko-KR":"한 항목만 길다의 ㄹ을 남기고 은을 붙였습니다."},{"zh-CN":"正确项是第1、2、3项；第4项改为긴 코트。","ko-KR":"정답은 1, 2, 3번입니다."}]}},
    {"node":"can-do-check","sort":2,"key":"self-check","type":"self_check","prompt":{"zh-CN":"根据刚才的实际表现完成五项Can-do自查，并确定下一步复习位置。","ko-KR":"방금 한 실제 수행을 바탕으로 다섯 Can-do를 점검하고 다음 복습 위치를 정하세요."},"instruction":{"zh-CN":"五项都要回应；有复习项至少选一个返回节点，全部能完成时选择none。","ko-KR":"다섯 항목에 답하고 복습이 필요하면 노드를, 모두 가능하면 none을 고르세요."},"options":[],"config":{"requiredChecks":5,"items":[{"id":"compare","label":"我能说明并比较两件服饰／옷 두 벌을 설명하고 비교할 수 있어요"},{"id":"modifier","label":"我能用形容词定语和ㄹ脱落／형용사 관형형과 ㄹ 탈락을 사용할 수 있어요"},{"id":"wear","label":"我能按商品建议试穿或试戴／상품에 맞게 착용을 제안할 수 있어요"},{"id":"recipient","label":"我能区分한테与께并匹配敬语／한테와 께를 구별할 수 있어요"},{"id":"shopping-task","label":"我能完成50—70秒、10—12轮双角色交流／50~70초, 10~12턴의 대화를 할 수 있어요"}],"returnNodes":[{"value":"clothing-words","label":"词汇"},{"value":"clothing-grammar-tools","label":"语法"},{"value":"clothing-store-talk","label":"对话理解"},{"value":"listen-and-shop","label":"听说"},{"value":"store-message","label":"读写"},{"value":"none","label":"无错／保持练习"}]},"answer":{"kind":"open"},"explanation":{"correct":{"zh-CN":"五项自查与返回位置已保存；不替代其他证据，也不产生分数。","ko-KR":"다섯 점검과 복습 위치를 정오나 점수 없이 저장했습니다."},"feedback":[{"zh-CN":"逐项回想服饰比较、四项语法、接受者和完整双角色购物。","ko-KR":"옷 비교, 네 문법, 받는 사람과 두 역할 대화를 돌아보세요."},{"zh-CN":"把需要复习对应到具体节点。","ko-KR":"복습 필요를 구체적인 노드에 연결하세요."},{"zh-CN":"五项均须作答；有复习项时不能只选none。","ko-KR":"복습 항목이 있으면 none만 고를 수 없습니다."}]}}
  ] $activities$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    if node_uuid is null then raise exception 'Missing chapter 14 node %',item->>'node'; end if;
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
      'dialogue-fact-check','dialogue-response','listening-recipient',
      'speaking-shopping','reading-store-notice','write-recommendation',
      'review-multiple','self-check'
    );

  delete from public.digital_textbook_media_assets media
  using public.digital_textbook_nodes node,public.digital_textbook_modules module
  where media.node_id=node.id and node.module_id=module.id and module.chapter_id=chapter_uuid;

  for item in select value from jsonb_array_elements($images$
  [
    {"node":"mission-map","key":"chapter-14-image-01","purpose":"章节情境主图","file":"chapter-14-01-scene.png","path":"../附件/韩国语1级/第14课/第14课-01-章节情境主图.png","alt":"服装店外套区内顾客与店员比较两件外套。","width":1600,"height":900},
    {"node":"clothing-words","key":"chapter-14-image-02","purpose":"核心词汇服饰与特征卡","file":"chapter-14-02-vocabulary.png","path":"../附件/韩国语1级/第14课/第14课-02-核心词汇卡-服饰与特征.png","alt":"十类服饰和长短、大小、轻重对照卡。","width":1200,"height":900},
    {"node":"clothing-grammar-tools","key":"chapter-14-image-03","purpose":"服饰购物语法总图","file":"chapter-14-03-grammar-overview.png","path":"../附件/韩国语1级/第14课/第14课-03-语法总图-服饰购物.png","alt":"形容词定语、ㄹ脱落、尝试建议和接受者四条结构轨道。","width":1600,"height":900},
    {"node":"clothing-grammar-tools","key":"chapter-14-image-04","purpose":"形容词定语结构图","file":"chapter-14-03a-adjective-modifier.png","path":"../附件/韩国语1级/第14课/第14课-03A-语法结构图-A으ㄴN.png","alt":"形容词词干按收音与特殊变化连接定语。","width":1200,"height":900},
    {"node":"clothing-grammar-tools","key":"chapter-14-image-05","purpose":"ㄹ脱落结构图","file":"chapter-14-03b-rieul-drop.png","path":"../附件/韩国语1级/第14课/第14课-03B-语法结构图-ㄹ脱落.png","alt":"ㄹ在ㄴ、ㅂ、ㅅ前脱落及保留环境对照。","width":1200,"height":900},
    {"node":"clothing-grammar-tools","key":"chapter-14-image-06","purpose":"尝试建议结构图","file":"chapter-14-03c-try-wearing.png","path":"../附件/韩国语1级/第14课/第14课-03C-语法结构图-아어보세요.png","alt":"穿衣、穿鞋、戴帽动作连接尝试建议。","width":1200,"height":900},
    {"node":"clothing-grammar-tools","key":"chapter-14-image-07","purpose":"接受者关系结构图","file":"chapter-14-03d-recipient.png","path":"../附件/韩国语1级/第14课/第14课-03D-语法结构图-한테께.png","alt":"一般接受者与尊敬接受者关系分流。","width":1200,"height":900},
    {"node":"shopping-builder","key":"chapter-14-image-08","purpose":"购物完整话轮卡","file":"chapter-14-04-pattern-blocks.png","path":"../附件/韩国语1级/第14课/第14课-04-句型购物话轮卡.png","alt":"六张无角色、步骤、箭头或顺序标记的完整购物话轮卡。","width":1200,"height":900},
    {"node":"clothing-store-talk","key":"chapter-14-image-09","purpose":"实战对话双场景图","file":"chapter-14-05-dialogue.png","path":"../附件/韩国语1级/第14课/第14课-05-实战对话场景.png","alt":"外套区顾客店员与配饰区两位朋友两个独立场景。","width":1600,"height":900},
    {"node":"listen-and-shop","key":"chapter-14-image-10","purpose":"送礼对象听力信息图","file":"chapter-14-06-listening.png","path":"../附件/韩国语1级/第14课/第14课-06-听力信息图-送礼对象.png","alt":"母亲、同龄朋友、弟妹和老师四类无文字关系卡。","width":1200,"height":900},
    {"node":"store-message","key":"chapter-14-image-11","purpose":"服装店新品告知版式","file":"chapter-14-07-store-notice.png","path":"../附件/韩国语1级/第14课/第14课-07-服装店新品告知.png","alt":"秋季外套礼品告知、两款外套、尺码与试衣图标。","width":1200,"height":1600},
    {"node":"can-do-check","key":"chapter-14-image-12","purpose":"最终服饰购物任务图","file":"chapter-14-08-final-task.png","path":"../附件/韩国语1级/第14课/第14课-08-最终任务图.png","alt":"服饰购物十类信息检查图标。","width":1600,"height":900}
  ] $images$::jsonb) loop
    select node.id into node_uuid from public.digital_textbook_nodes node
    join public.digital_textbook_modules module on module.id=node.module_id
    where module.chapter_id=chapter_uuid and node.node_code=item->>'node';
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values (
      node_uuid,item->>'key','image',item->>'purpose',
      'korean-level-one/chapter-14/images/'||(item->>'file'),'pending',
      jsonb_build_object('zh-CN',item->>'alt','ko-KR','제작 대기 중인 수업 이미지'),
      jsonb_build_object('width',(item->>'width')::integer,'height',(item->>'height')::integer,
        'plannedSourcePath',item->>'path','sourceStatus','待制作')
    );
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='clothing-words';
  for item in
    select jsonb_build_object('word',value->>'word','collocation',value->>'collocation','n',ordinality)
    from jsonb_array_elements($vocab$
    [
      {"word":"옷","collocation":"옷을 찾다"},{"word":"코트","collocation":"긴 코트"},{"word":"셔츠","collocation":"작은 셔츠"},{"word":"치마","collocation":"짧은 치마"},{"word":"바지","collocation":"짧은 바지"},{"word":"원피스","collocation":"예쁜 원피스"},{"word":"구두","collocation":"구두를 신다"},{"word":"운동화","collocation":"편한 운동화"},{"word":"모자","collocation":"모자를 쓰다"},{"word":"가방","collocation":"가벼운 가방"},{"word":"색깔","collocation":"색깔이 좋아요"},{"word":"사이즈","collocation":"사이즈가 맞다"},{"word":"선물","collocation":"선물 포장"},{"word":"사진","collocation":"사진을 보내다"},{"word":"손님","collocation":"손님이 고르다"},{"word":"직원","collocation":"직원이 추천하다"},{"word":"길다","collocation":"긴 코트"},{"word":"짧다","collocation":"짧은 치마"},{"word":"크다","collocation":"큰 사이즈"},{"word":"작다","collocation":"작은 코트"},{"word":"예쁘다","collocation":"예쁜 원피스"},{"word":"가볍다","collocation":"가벼운 코트"},{"word":"편하다","collocation":"편한 운동화"},{"word":"입다","collocation":"코트를 입다"},{"word":"신다","collocation":"구두를 신다"},{"word":"쓰다","collocation":"모자를 쓰다"},{"word":"찾다","collocation":"코트를 찾다"},{"word":"드리다","collocation":"어머니께 드리다"}
    ] $vocab$::jsonb) with ordinality
  loop
    insert into public.digital_textbook_media_assets (
      node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
    ) values
      (node_uuid,'chapter-14-vocabulary-'||lpad(item->>'n',2,'0'),'audio','词汇原形点读','korean-level-one/chapter-14/audio/vocabulary/chapter-14-vocabulary-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇原形音频待制作","ko-KR":"어휘 기본형 음원 제작 대기"}',jsonb_build_object('audioId','chapter-14-vocabulary-'||lpad(item->>'n',2,'0'),'script',item->>'word')),
      (node_uuid,'chapter-14-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'audio','词汇搭配点读','korean-level-one/chapter-14/audio/vocabulary/chapter-14-vocabulary-collocation-'||lpad(item->>'n',2,'0')||'.mp3','pending','{"zh-CN":"词汇搭配音频待制作","ko-KR":"어휘 결합 음원 제작 대기"}',jsonb_build_object('audioId','chapter-14-vocabulary-collocation-'||lpad(item->>'n',2,'0'),'script',item->>'collocation'));
  end loop;

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='clothing-grammar-tools';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio','语法卡母版与语境复现例句',
    'korean-level-one/chapter-14/audio/grammar/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"语法例句音频待制作","ko-KR":"문법 예문 음원 제작 대기"}',
    jsonb_build_object('audioId',value->>'id','script',value->>'script')
  from jsonb_array_elements($grammar$
  [
    {"id":"chapter-14-grammar-01-example-01","script":"예쁜 원피스를 찾고 있어요."},{"id":"chapter-14-grammar-01-example-02","script":"이 긴 검은 코트는 어떠세요? 가볍고 따뜻해요."},{"id":"chapter-14-grammar-01-example-03","script":"긴 베이지색 코트와 짧은 검은색 코트가 있어요."},
    {"id":"chapter-14-grammar-02-example-01","script":"긴 치마를 찾고 있어요."},{"id":"chapter-14-grammar-02-example-02","script":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요."},{"id":"chapter-14-grammar-02-example-03","script":"긴 베이지색 코트와 짧은 검은색 코트가 있어요."},
    {"id":"chapter-14-grammar-03-example-01","script":"이 구두를 신어 보세요."},{"id":"chapter-14-grammar-03-example-02","script":"네. 이 작은 베이지색 코트를 입어 보세요."},{"id":"chapter-14-grammar-03-example-03","script":"어머니께 드릴 선물을 찾으세요? 매장에서 직접 입어 보세요."},
    {"id":"chapter-14-grammar-04-example-01","script":"친구한테 사진을 보낼 거예요."},{"id":"chapter-14-grammar-04-example-02","script":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요."},{"id":"chapter-14-grammar-04-example-03","script":"베이지색이 더 좋아요. 친구한테 사진을 보낼 거예요."}
  ] $grammar$::jsonb);

  select node.id into node_uuid from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  where module.chapter_id=chapter_uuid and node.node_code='clothing-store-talk';
  insert into public.digital_textbook_media_assets (
    node_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  )
  select node_uuid,value->>'id','audio',value->>'purpose',
    'korean-level-one/chapter-14/audio/dialogue/'||(value->>'id')||'.mp3','pending',
    '{"zh-CN":"对话音频待制作","ko-KR":"대화 음원 제작 대기"}',value-'purpose'
  from jsonb_array_elements($dialogue$
  [
    {"id":"chapter-14-dialogue-main-line-01","purpose":"主对话逐句","script":"어서 오세요. 무엇을 찾으세요?","speaker":"F01／수진"},{"id":"chapter-14-dialogue-main-line-02","purpose":"主对话逐句","script":"어머니께 드릴 거예요. 긴 코트를 찾고 있어요.","speaker":"M01／왕밍"},{"id":"chapter-14-dialogue-main-line-03","purpose":"主对话逐句","script":"이 긴 검은 코트는 어떠세요? 가볍고 따뜻해요.","speaker":"F01／수진"},{"id":"chapter-14-dialogue-main-line-04","purpose":"主对话逐句","script":"예쁘지만 저한테는 조금 커요. 어머니와 키가 비슷해요. 더 작은 코트도 있어요?","speaker":"M01／왕밍"},{"id":"chapter-14-dialogue-main-line-05","purpose":"主对话逐句","script":"네. 이 작은 베이지색 코트를 입어 보세요.","speaker":"F01／수진"},{"id":"chapter-14-dialogue-main-line-06","purpose":"主对话逐句","script":"네, 감사합니다.","speaker":"M01／왕밍"},{"id":"chapter-14-dialogue-main-line-07","purpose":"主对话逐句","script":"사이즈가 어때요? 길이와 모양도 보세요.","speaker":"F01／수진"},{"id":"chapter-14-dialogue-main-line-08","purpose":"主对话逐句","script":"저한테는 잘 맞고 편해요. 검은 코트는 컸어요. 이 코트의 길이와 모양이 더 좋아요. 집에서 어머니도 다시 입어 볼 거예요.","speaker":"M01／왕밍"},{"id":"chapter-14-dialogue-main-line-09","purpose":"主对话逐句","script":"그럼 이 코트로 드릴까요?","speaker":"F01／수진"},{"id":"chapter-14-dialogue-main-line-10","purpose":"主对话逐句","script":"네, 이거 주세요. 선물 포장도 해 주세요.","speaker":"M01／왕밍"},{"id":"chapter-14-dialogue-main","purpose":"主对话整段","script":"母本第6.1节完整双角色脚本","speaker":"F01／M01"},
    {"id":"chapter-14-dialogue-alt-line-01","purpose":"第二对话逐句","script":"이 검은 모자는 어때요?","speaker":"F02／민지"},{"id":"chapter-14-dialogue-alt-line-02","purpose":"第二对话逐句","script":"예쁘지만 조금 커요.","speaker":"F03／유나"},{"id":"chapter-14-dialogue-alt-line-03","purpose":"第二对话逐句","script":"그럼 저 작은 베이지색 모자를 써 보세요.","speaker":"F02／민지"},{"id":"chapter-14-dialogue-alt-line-04","purpose":"第二对话逐句","script":"네. 이 모자는 잘 맞고 가벼워요.","speaker":"F03／유나"},{"id":"chapter-14-dialogue-alt-line-05","purpose":"第二对话逐句","script":"두 모자 중에서 어떤 색깔이 더 좋아요?","speaker":"F02／민지"},{"id":"chapter-14-dialogue-alt-line-06","purpose":"第二对话逐句","script":"베이지색이 더 좋아요. 친구한테 사진을 보낼 거예요.","speaker":"F03／유나"},{"id":"chapter-14-dialogue-alt","purpose":"第二对话整段","script":"母本第6.2节完整双角色脚本","speaker":"F02／F03"}
  ] $dialogue$::jsonb);

  select node.id,activity.id into node_uuid,activity_uuid
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id=node.module_id
  join public.digital_textbook_activities activity on activity.node_id=node.id
  where module.chapter_id=chapter_uuid and activity.activity_key='listening-recipient';
  insert into public.digital_textbook_media_assets (
    node_id,activity_id,asset_key,media_type,purpose,object_key,production_status,alt_text,metadata
  ) values
    (node_uuid,activity_uuid,'chapter-14-listening-recipient-normal','audio','私有听力正常语速','korean-level-one/chapter-14/listening/chapter-14-listening-recipient-normal.mp3','pending','{"zh-CN":"正常语速听力待制作","ko-KR":"보통 속도 듣기 음원 제작 대기"}','{"speaker":"F04／직원；M02／손님","scriptVisibility":"private","speed":"normal"}'),
    (node_uuid,activity_uuid,'chapter-14-listening-recipient-slow','audio','私有听力慢速','korean-level-one/chapter-14/listening/chapter-14-listening-recipient-slow.mp3','pending','{"zh-CN":"慢速听力待制作","ko-KR":"느린 속도 듣기 음원 제작 대기"}','{"speaker":"F04／직원；M02／손님","scriptVisibility":"private","speed":"slow"}');
end;
$chapter_fourteen$;

commit;
