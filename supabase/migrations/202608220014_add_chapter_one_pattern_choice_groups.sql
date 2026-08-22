do $$
declare
  pattern_node_id uuid;
  pattern_choice_id uuid;
begin
  select node.id into pattern_node_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
  order by version.version_number desc
  limit 1;

  if pattern_node_id is null then
    raise exception 'Cannot add chapter-one pattern choices: node is missing';
  end if;

  update public.digital_textbook_activities
  set sort_order = 2, updated_at = now()
  where node_id = pattern_node_id and activity_key = 'pattern-order';

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config, max_attempts,
    counts_toward_completion
  ) values (
    pattern_node_id,
    'pattern-choice',
    'single_choice',
    1,
    '{"zh-CN":"完成姓名、身份和询问确认三组替换选择题。","ko-KR":"이름, 신분과 확인 질문의 세 대치 선택 연습을 완성하세요."}'::jsonb,
    '{"zh-CN":"每题选择一个语法形式；句末标点已经显示在题干中。","ko-KR":"각 문항에서 문법 형태를 하나 고르며 문장 부호는 문제에 표시됩니다."}'::jsonb,
    '[]'::jsonb,
    '{"practiceKind":"pattern_choice","groups":[
      {"id":"name","title":{"zh-CN":"姓名替换","ko-KR":"이름 대치"},"instruction":{"zh-CN":"根据姓名最后一个音节有无收音，选择이에요或예요。","ko-KR":"이름의 마지막 음절 받침에 따라 이에요나 예요를 고르세요."},"items":[
        {"id":"name-1","question":"저는 왕밍___.","options":["이에요","예요","은","는"]},
        {"id":"name-2","question":"저는 리나___.","options":["이에요","예요","은","는"]},
        {"id":"name-3","question":"저는 김지민___.","options":["이에요","예요","은","는"]}
      ]},
      {"id":"identity","title":{"zh-CN":"身份替换","ko-KR":"신분 대치"},"instruction":{"zh-CN":"根据身份名词有无收音，完成陈述句。","ko-KR":"신분 명사의 받침에 따라 서술문을 완성하세요."},"items":[
        {"id":"identity-1","question":"저는 학생___.","options":["이에요","예요","은","는"]},
        {"id":"identity-2","question":"저는 의사___.","options":["이에요","예요","은","는"]},
        {"id":"identity-3","question":"저는 중국 사람___.","options":["이에요","예요","은","는"]}
      ]},
      {"id":"confirm","title":{"zh-CN":"询问确认","ko-KR":"확인 질문"},"instruction":{"zh-CN":"完成礼貌确认问句；问号不属于答案。","ko-KR":"공손한 확인 질문을 완성하며 물음표는 답에 포함하지 않습니다."},"items":[
        {"id":"confirm-1","question":"지민 씨는 학생___?","options":["이에요","예요","은","는"]},
        {"id":"confirm-2","question":"리나 씨는 의사___?","options":["이에요","예요","은","는"]},
        {"id":"confirm-3","question":"왕밍 씨는 선생님___?","options":["이에요","예요","은","는"]}
      ]}
    ]}'::jsonb,
    3,
    true
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
  returning id into pattern_choice_id;

  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    pattern_choice_id,
    '{"kind":"index_array","value":[0,1,0,0,1,0,0,1,0]}'::jsonb,
    '{"correct":{"zh-CN":"三组九题均已正确完成。","ko-KR":"세 묶음의 아홉 문항을 모두 맞혔습니다."},"feedback":[{"zh-CN":"先判断空格前名词最后一个音节有无收音。","ko-KR":"빈칸 앞 명사의 마지막 음절에 받침이 있는지 확인하세요."},{"zh-CN":"有收音使用이에요，无收音使用예요。","ko-KR":"받침이 있으면 이에요, 없으면 예요를 씁니다."},{"zh-CN":"疑问句的问号已显示，不要把标点加入答案。","ko-KR":"질문의 물음표는 이미 표시되어 답에 넣지 않습니다."}]}'::jsonb
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();
end $$;
