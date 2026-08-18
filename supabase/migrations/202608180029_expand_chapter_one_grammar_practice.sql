do $$
declare
  grammar_node_id uuid;
  first_activity_id uuid;
  second_activity_id uuid;
begin
  select node.id into grammar_node_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and module.module_code = 'grammar'
    and node.node_code = 'topic-and-copula'
  limit 1;

  if grammar_node_id is null then
    raise exception 'Cannot expand chapter-one grammar practice: node is missing';
  end if;

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config, max_attempts
  ) values (
    grammar_node_id,
    'grammar-fill',
    'fill_blank',
    1,
    '{"zh-CN":"完成第一轮：分别练习判断词尾、话题助词和确认疑问句。","ko-KR":"첫 번째 연습에서 서술격 어미, 주제 조사와 확인 의문문을 각각 연습하세요."}'::jsonb,
    '{"zh-CN":"三个语法点各填写一题，依次填写缺少的部分。","ko-KR":"세 문법 항목을 한 문제씩 풀고 빠진 부분만 차례로 쓰세요."}'::jsonb,
    '[]'::jsonb,
    '{"focusMode":true,"normalize":"NFC","items":[{"id":"copula","label":"저는 리나___","placeholder":"이에요/예요"},{"id":"topic","label":"민준___ 학생이에요.","placeholder":"은/는"},{"id":"confirmation","label":"지민 씨는 학생___","placeholder":"이에요?/예요?"}]}'::jsonb,
    3
  )
  on conflict (node_id, activity_key) do update set
    activity_type = excluded.activity_type,
    sort_order = excluded.sort_order,
    prompt = excluded.prompt,
    instruction = excluded.instruction,
    options = excluded.options,
    public_config = excluded.public_config,
    max_attempts = excluded.max_attempts,
    updated_at = now()
  returning id into first_activity_id;

  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    first_activity_id,
    '{"kind":"text_array","value":["예요","은","이에요?"]}'::jsonb,
    '{"correct":{"zh-CN":"第一轮答案依次为 예요、은、이에요?。","ko-KR":"첫 번째 연습의 답은 차례로 예요, 은, 이에요?입니다."},"feedback":[{"zh-CN":"先区分身份说明、话题标记和确认提问。","ko-KR":"신분 설명, 화제 표시와 확인 질문을 먼저 구별하세요."},{"zh-CN":"리나无收音、민준有收音、학생有收音。","ko-KR":"리나는 받침이 없고 민준과 학생은 받침이 있습니다."},{"zh-CN":"完整句为저는 리나예요.／민준은 학생이에요.／지민 씨는 학생이에요?。","ko-KR":"완전한 문장은 저는 리나예요.／민준은 학생이에요.／지민 씨는 학생이에요?입니다."}]}'::jsonb
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config, max_attempts
  ) values (
    grammar_node_id,
    'grammar-transfer',
    'fill_blank',
    2,
    '{"zh-CN":"完成第二轮：更换收音条件，再练一次三个语法点。","ko-KR":"두 번째 연습에서 받침 조건을 바꾸어 세 문법 항목을 다시 연습하세요."}'::jsonb,
    '{"zh-CN":"三个语法点各再做一题，依次填写缺少的部分。","ko-KR":"세 문법 항목을 한 문제씩 다시 풀고 빠진 부분만 차례로 쓰세요."}'::jsonb,
    '[]'::jsonb,
    '{"focusMode":true,"normalize":"NFC","items":[{"id":"copula-transfer","label":"저는 왕밍___","placeholder":"이에요/예요"},{"id":"topic-transfer","label":"민지___ 친구예요.","placeholder":"은/는"},{"id":"confirmation-transfer","label":"리나 씨는 의사___","placeholder":"이에요?/예요?"}]}'::jsonb,
    3
  )
  on conflict (node_id, activity_key) do update set
    activity_type = excluded.activity_type,
    sort_order = excluded.sort_order,
    prompt = excluded.prompt,
    instruction = excluded.instruction,
    options = excluded.options,
    public_config = excluded.public_config,
    max_attempts = excluded.max_attempts,
    updated_at = now()
  returning id into second_activity_id;

  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    second_activity_id,
    '{"kind":"text_array","value":["이에요","는","예요?"]}'::jsonb,
    '{"correct":{"zh-CN":"第二轮答案依次为 이에요、는、예요?。","ko-KR":"두 번째 연습의 답은 차례로 이에요, 는, 예요?입니다."},"feedback":[{"zh-CN":"继续区分身份说明、话题标记和确认提问。","ko-KR":"신분 설명, 화제 표시와 확인 질문을 계속 구별하세요."},{"zh-CN":"왕밍有收音，민지和의사无收音。","ko-KR":"왕밍은 받침이 있고 민지와 의사는 받침이 없습니다."},{"zh-CN":"完整句为저는 왕밍이에요.／민지는 친구예요.／리나 씨는 의사예요?。","ko-KR":"완전한 문장은 저는 왕밍이에요.／민지는 친구예요.／리나 씨는 의사예요?입니다."}]}'::jsonb
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();
end $$;
