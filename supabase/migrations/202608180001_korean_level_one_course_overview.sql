begin;

-- 智能教材允许使用第 00 章作为课程总览；正式教学章节仍从 01 开始。
alter table public.digital_textbook_chapters
  drop constraint if exists digital_textbook_chapters_chapter_number_check;
alter table public.digital_textbook_chapters
  add constraint digital_textbook_chapters_chapter_number_check
  check (chapter_number >= 0);

select set_config('app.platform_content_migration', 'on', true);
alter table public.course_chapters disable trigger user;

do $$
declare
  lesson_uuid uuid;
  version_uuid uuid;
  chapter_uuid uuid;
  module_uuid uuid;
  node_uuid uuid;
  activity_uuid uuid;
begin
  select lesson.id into lesson_uuid
  from public.lessons as lesson
  join public.courses as course on course.id = lesson.course_id
  where course.slug = 'korean-beginner'
    and lesson.slug = 'basic-pronunciation'
  limit 1;

  if lesson_uuid is null then
    raise exception 'Cannot seed Korean level one overview: lesson was not found';
  end if;

  insert into public.course_chapters (
    lesson_id, chapter_test_id, slug, title, description, duration_minutes,
    is_published, sort_order, completion_rule, unlock_mode,
    prerequisite_chapter_id, required_score, available_from,
    is_manually_locked, tenant_id, content_scope
  ) values (
    lesson_uuid, null, 'korean-level-one-00', '课程总览',
    '了解韩国语 1 级的学习目标、16 章路线、智能教材工具与完成方式。',
    60, true, 0, 'content_viewed', 'immediate',
    null, null, null, false, null, 'platform'
  )
  on conflict (lesson_id, slug) do update set
    title = excluded.title,
    description = excluded.description,
    duration_minutes = excluded.duration_minutes,
    is_published = excluded.is_published,
    sort_order = excluded.sort_order,
    completion_rule = excluded.completion_rule,
    unlock_mode = excluded.unlock_mode,
    prerequisite_chapter_id = null,
    is_manually_locked = false,
    tenant_id = null,
    content_scope = 'platform',
    updated_at = now();

  select version.id into version_uuid
  from public.digital_textbook_versions as version
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and textbook.status = 'published'
    and version.status = 'published'
  order by version.version_number desc
  limit 1;

  if version_uuid is null then
    raise exception 'Cannot seed Korean level one overview: published textbook version was not found';
  end if;

  insert into public.digital_textbook_chapters (
    version_id, chapter_test_id, slug, chapter_number, title, scenario, goal, status
  ) values (
    version_uuid,
    null,
    'course-overview',
    0,
    jsonb_build_object('zh-CN', '课程总览', 'ko-KR', '과정 안내'),
    jsonb_build_object(
      'zh-CN', '开始韩国语 1 级之前，先认识整门课程的学习路线和智能教材工具。',
      'ko-KR', '한국어 1급을 시작하기 전에 전체 학습 경로와 스마트 교재 도구를 살펴봅니다.'
    ),
    jsonb_build_object(
      'zh-CN', '明确 16 章学习目标，掌握每章一小时的学习流程，并准备进入第 1 章。',
      'ko-KR', '16개 단원의 목표와 단원별 1시간 학습 흐름을 이해하고 제1장을 시작할 준비를 합니다.'
    ),
    'published'
  )
  on conflict (version_id, slug) do update set
    chapter_number = excluded.chapter_number,
    title = excluded.title,
    scenario = excluded.scenario,
    goal = excluded.goal,
    status = excluded.status,
    updated_at = now()
  returning id into chapter_uuid;

  -- 01 课程地图
  insert into public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title, description)
  values (
    chapter_uuid, 'orientation', 1, 'sky',
    jsonb_build_object('zh-CN', '课程地图', 'ko-KR', '과정 지도'),
    jsonb_build_object('zh-CN', '先看清 16 章路线以及完成整门课程后的能力目标。', 'ko-KR', '16개 단원의 흐름과 과정 수료 후의 목표를 확인합니다.')
  )
  on conflict (chapter_id, module_code) do update set
    sort_order = excluded.sort_order, accent_role = excluded.accent_role,
    title = excluded.title, description = excluded.description, updated_at = now()
  returning id into module_uuid;

  insert into public.digital_textbook_nodes (module_id, node_code, node_type, sort_order, estimated_minutes, title, content)
  values (
    module_uuid, 'course-map', 'learn', 1, 15,
    jsonb_build_object('zh-CN', '从问候走向完整生活表达', 'ko-KR', '인사에서 생활 표현까지'),
    jsonb_build_object(
      'lead', jsonb_build_object('zh-CN', '课程共 16 章，每章围绕一个真实生活场景推进。', 'ko-KR', '과정은 16개 단원으로 구성되며 각 단원은 실제 생활 장면을 중심으로 진행됩니다.'),
      'targets', jsonb_build_array(
        jsonb_build_object('ko', '01–04', 'zh', '问候、自我介绍、事物与地点'),
        jsonb_build_object('ko', '05–08', 'zh', '过去经历、购物、天气与约会'),
        jsonb_build_object('ko', '09–12', 'zh', '人物、时间、健康与电话'),
        jsonb_build_object('ko', '13–16', 'zh', '交通、服装、旅行与邀请')
      ),
      'coach', jsonb_build_object('zh-CN', '先理解路线，不需要在总览里记住所有语法。', 'ko-KR', '전체 흐름을 이해하는 것이 먼저이며 모든 문법을 미리 외울 필요는 없습니다.')
    )
  )
  on conflict (module_id, node_code) do update set
    estimated_minutes = excluded.estimated_minutes, title = excluded.title,
    content = excluded.content, updated_at = now()
  returning id into node_uuid;

  insert into public.digital_textbook_activities (node_id, activity_key, activity_type, sort_order, prompt, instruction, options, public_config)
  values (
    node_uuid, 'course-map-check', 'single_choice', 1,
    jsonb_build_object('zh-CN', '韩国语 1 级一共包含多少个正式学习章节？', 'ko-KR', '한국어 1급은 몇 개의 정규 학습 단원으로 구성되어 있습니까?'),
    jsonb_build_object('zh-CN', '选择正确答案。', 'ko-KR', '알맞은 답을 고르세요.'),
    jsonb_build_array('4 章', '8 章', '16 章', '20 章'), '{}'::jsonb
  )
  on conflict (node_id, activity_key) do update set
    prompt = excluded.prompt, instruction = excluded.instruction,
    options = excluded.options, public_config = excluded.public_config, updated_at = now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    activity_uuid, '{"kind":"index","value":2}'::jsonb,
    jsonb_build_object('zh-CN', '韩国语 1 级包含 16 个正式学习章节，另设第 00 章课程总览。', 'ko-KR', '한국어 1급은 16개 정규 단원과 제00장 과정 안내로 구성됩니다.')
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key, explanation = excluded.explanation, updated_at = now();

  -- 02 每章学习方法
  insert into public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title, description)
  values (
    chapter_uuid, 'patterns', 2, 'iris',
    jsonb_build_object('zh-CN', '每章学习方法', 'ko-KR', '단원 학습 방법'),
    jsonb_build_object('zh-CN', '每章按理解、输入、练习、输出、测试的顺序完成。', 'ko-KR', '이해, 입력, 연습, 출력, 평가의 순서로 각 단원을 학습합니다.')
  )
  on conflict (chapter_id, module_code) do update set
    sort_order = excluded.sort_order, accent_role = excluded.accent_role,
    title = excluded.title, description = excluded.description, updated_at = now()
  returning id into module_uuid;

  insert into public.digital_textbook_nodes (module_id, node_code, node_type, sort_order, estimated_minutes, title, content)
  values (
    module_uuid, 'chapter-rhythm', 'learn', 1, 15,
    jsonb_build_object('zh-CN', '一小时学习节奏', 'ko-KR', '한 시간 학습 리듬'),
    jsonb_build_object(
      'lead', jsonb_build_object('zh-CN', '建议一次完成一章，也可以在系统自动保存后分段继续。', 'ko-KR', '한 번에 한 단원을 끝내는 것을 권장하지만 자동 저장 후 나누어 학습할 수도 있습니다.'),
      'checklist', jsonb_build_array(
        jsonb_build_object('ko', '이해', 'zh', '先理解场景与目标'),
        jsonb_build_object('ko', '입력', 'zh', '学习词汇、语法与关键句型'),
        jsonb_build_object('ko', '연습', 'zh', '完成听说读写互动'),
        jsonb_build_object('ko', '평가', 'zh', '通过章节测试后解锁下一章')
      ),
      'coach', jsonb_build_object('zh-CN', '页面会自动记录活动与进度，退出后可以继续。', 'ko-KR', '활동과 진도는 자동으로 저장되며 나중에 이어서 학습할 수 있습니다.')
    )
  )
  on conflict (module_id, node_code) do update set
    estimated_minutes = excluded.estimated_minutes, title = excluded.title,
    content = excluded.content, updated_at = now()
  returning id into node_uuid;

  insert into public.digital_textbook_activities (node_id, activity_key, activity_type, sort_order, prompt, instruction, options, public_config)
  values (
    node_uuid, 'chapter-rhythm-check', 'single_choice', 1,
    jsonb_build_object('zh-CN', '完成一章后，下一章怎样解锁？', 'ko-KR', '한 단원을 마친 후 다음 단원은 어떻게 열립니까?'),
    jsonb_build_object('zh-CN', '选择符合课程规则的答案。', 'ko-KR', '과정 규칙에 맞는 답을 고르세요.'),
    jsonb_build_array('只阅读标题', '通过本章测试', '等待老师手动开启', '重新登录'), '{}'::jsonb
  )
  on conflict (node_id, activity_key) do update set
    prompt = excluded.prompt, instruction = excluded.instruction,
    options = excluded.options, public_config = excluded.public_config, updated_at = now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    activity_uuid, '{"kind":"index","value":1}'::jsonb,
    jsonb_build_object('zh-CN', '完成学习并通过本章测试后，下一章会按顺序解锁。', 'ko-KR', '학습을 마치고 단원 평가에 합격하면 다음 단원이 순서대로 열립니다.')
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key, explanation = excluded.explanation, updated_at = now();

  -- 03 智能教材工具
  insert into public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title, description)
  values (
    chapter_uuid, 'listen_speak', 3, 'coral',
    jsonb_build_object('zh-CN', '智能教材工具', 'ko-KR', '스마트 교재 도구'),
    jsonb_build_object('zh-CN', '认识顶部栏、学习路径、语言辅助、全屏和学习助手。', 'ko-KR', '상단 바, 학습 경로, 언어 도움, 전체 화면과 학습 도우미를 확인합니다.')
  )
  on conflict (chapter_id, module_code) do update set
    sort_order = excluded.sort_order, accent_role = excluded.accent_role,
    title = excluded.title, description = excluded.description, updated_at = now()
  returning id into module_uuid;

  insert into public.digital_textbook_nodes (module_id, node_code, node_type, sort_order, estimated_minutes, title, content)
  values (
    module_uuid, 'tool-tour', 'learn', 1, 15,
    jsonb_build_object('zh-CN', '用好顶部栏与学习助手', 'ko-KR', '상단 바와 학습 도우미 활용'),
    jsonb_build_object(
      'lead', jsonb_build_object('zh-CN', '所有章节共用同一套操作方式，熟悉一次后即可贯穿整门课程。', 'ko-KR', '모든 단원이 같은 조작 방식을 사용하므로 한 번 익히면 전체 과정에서 활용할 수 있습니다.'),
      'checklist', jsonb_build_array(
        jsonb_build_object('ko', '학습 경로', 'zh', '左侧查看当前步骤'),
        jsonb_build_object('ko', '학습 도우미', 'zh', '顶部按钮展开学习助手'),
        jsonb_build_object('ko', '중 / 한', 'zh', '切换中文辅助、双语与韩语沉浸'),
        jsonb_build_object('ko', '전체 화면', 'zh', '进入或退出全屏学习')
      ),
      'coach', jsonb_build_object('zh-CN', '遇到不懂的内容时，先使用顶部的学习助手按钮。', 'ko-KR', '이해하기 어려운 내용이 있으면 상단의 학습 도우미 버튼을 먼저 사용하세요.')
    )
  )
  on conflict (module_id, node_code) do update set
    estimated_minutes = excluded.estimated_minutes, title = excluded.title,
    content = excluded.content, updated_at = now()
  returning id into node_uuid;

  insert into public.digital_textbook_activities (node_id, activity_key, activity_type, sort_order, prompt, instruction, options, public_config)
  values (
    node_uuid, 'tool-tour-check', 'single_choice', 1,
    jsonb_build_object('zh-CN', '不理解当前内容时，可以从哪里打开学习助手？', 'ko-KR', '현재 내용이 어려울 때 학습 도우미는 어디에서 열 수 있습니까?'),
    jsonb_build_object('zh-CN', '选择正确入口。', 'ko-KR', '올바른 위치를 고르세요.'),
    jsonb_build_array('浏览器地址栏', '顶部栏的学习助手按钮', '返回课程后', '章节测试结果页'), '{}'::jsonb
  )
  on conflict (node_id, activity_key) do update set
    prompt = excluded.prompt, instruction = excluded.instruction,
    options = excluded.options, public_config = excluded.public_config, updated_at = now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    activity_uuid, '{"kind":"index","value":1}'::jsonb,
    jsonb_build_object('zh-CN', '学习助手已经放在智能教材顶部栏中。', 'ko-KR', '학습 도우미는 스마트 교재 상단 바에서 열 수 있습니다.')
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key, explanation = excluded.explanation, updated_at = now();

  -- 04 开课准备
  insert into public.digital_textbook_modules (chapter_id, module_code, sort_order, accent_role, title, description)
  values (
    chapter_uuid, 'review', 4, 'jade',
    jsonb_build_object('zh-CN', '开课准备', 'ko-KR', '학습 준비'),
    jsonb_build_object('zh-CN', '确认学习节奏与工具已经准备好，然后进入第 1 章。', 'ko-KR', '학습 리듬과 도구를 확인한 뒤 제1장을 시작합니다.')
  )
  on conflict (chapter_id, module_code) do update set
    sort_order = excluded.sort_order, accent_role = excluded.accent_role,
    title = excluded.title, description = excluded.description, updated_at = now()
  returning id into module_uuid;

  insert into public.digital_textbook_nodes (module_id, node_code, node_type, sort_order, estimated_minutes, title, content)
  values (
    module_uuid, 'ready-check', 'review', 1, 15,
    jsonb_build_object('zh-CN', '准备进入第 1 章', 'ko-KR', '제1장 시작 준비'),
    jsonb_build_object(
      'lead', jsonb_build_object('zh-CN', '从第 1 章“你好？”开始，把总览里的方法用于真实学习。', 'ko-KR', '제1장 “안녕하세요?”부터 과정 안내에서 익힌 방법으로 실제 학습을 시작합니다.'),
      'checklist', jsonb_build_array(
        jsonb_build_object('ko', '60분', 'zh', '为每章预留约一小时'),
        jsonb_build_object('ko', '자동 저장', 'zh', '学习记录自动保存'),
        jsonb_build_object('ko', '순서 학습', 'zh', '按章节顺序学习与测试')
      ),
      'coach', jsonb_build_object('zh-CN', '完成下面的准备确认后，点击“开始第 1 章”。', 'ko-KR', '아래 준비 확인을 마친 뒤 “제1장 시작”을 누르세요.')
    )
  )
  on conflict (module_id, node_code) do update set
    estimated_minutes = excluded.estimated_minutes, title = excluded.title,
    content = excluded.content, updated_at = now()
  returning id into node_uuid;

  insert into public.digital_textbook_activities (node_id, activity_key, activity_type, sort_order, prompt, instruction, options, public_config)
  values (
    node_uuid, 'ready-check-question', 'single_choice', 1,
    jsonb_build_object('zh-CN', '你准备怎样完成韩国语 1 级？', 'ko-KR', '한국어 1급을 어떻게 학습할 계획입니까?'),
    jsonb_build_object('zh-CN', '选择推荐的学习方式。', 'ko-KR', '권장 학습 방법을 고르세요.'),
    jsonb_build_array('跳过所有练习', '只看测试答案', '按章节学习、练习并通过测试', '一次打开全部页面'), '{}'::jsonb
  )
  on conflict (node_id, activity_key) do update set
    prompt = excluded.prompt, instruction = excluded.instruction,
    options = excluded.options, public_config = excluded.public_config, updated_at = now()
  returning id into activity_uuid;
  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    activity_uuid, '{"kind":"index","value":2}'::jsonb,
    jsonb_build_object('zh-CN', '按顺序完成学习、互动练习与章节测试，才能形成连贯的能力。', 'ko-KR', '학습, 상호작용 연습, 단원 평가를 순서대로 완료해야 실력이 연결됩니다.')
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key, explanation = excluded.explanation, updated_at = now();
end;
$$;

alter table public.course_chapters enable trigger user;

commit;
