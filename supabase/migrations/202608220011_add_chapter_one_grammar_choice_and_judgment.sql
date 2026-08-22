do $$
declare
  grammar_node_id uuid;
  choice_activity_id uuid;
  judgment_activity_id uuid;
begin
  select node.id into grammar_node_id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'grammar'
    and node.node_code = 'topic-and-copula'
  order by version.version_number desc
  limit 1;

  if grammar_node_id is null then
    raise exception 'Cannot add chapter-one grammar practice: node is missing';
  end if;

  update public.digital_textbook_activities
  set sort_order = 3,
      public_config = jsonb_set(coalesce(public_config, '{}'::jsonb), '{practiceKind}', '"fill"'::jsonb, true),
      updated_at = now()
  where node_id = grammar_node_id
    and activity_key = 'grammar-fill';

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config, max_attempts,
    counts_toward_completion
  ) values (
    grammar_node_id,
    'grammar-choice',
    'single_choice',
    1,
    '{"zh-CN":"选择合适的词尾或助词，完成六个句子。","ko-KR":"알맞은 어미나 조사를 골라 여섯 문장을 완성하세요."}'::jsonb,
    '{"zh-CN":"先判断前一个词有没有收音，再区分身份说明、话题标记和确认提问。","ko-KR":"앞말의 받침을 확인한 뒤 신분 설명, 화제 표시와 확인 질문을 구별하세요."}'::jsonb,
    '[]'::jsonb,
    '{"practiceKind":"choice","shuffle":false,"shuffleOptions":false,"items":[{"id":"choice-1","group":"page-1","question":"저는 학생___.","options":["이에요","예요","은","는"]},{"id":"choice-2","group":"page-1","question":"저는 리나___.","options":["이에요","예요","은","는"]},{"id":"choice-3","group":"page-1","question":"민준___ 학생이에요.","options":["은","는","이에요","예요"]},{"id":"choice-4","group":"page-2","question":"지민 씨___ 학생이에요?","options":["은","는","이에요","예요"]},{"id":"choice-5","group":"page-2","question":"왕밍 씨는 학생___","options":["이에요?","예요?","은?","는?"]},{"id":"choice-6","group":"page-2","question":"리나 씨는 의사___","options":["이에요?","예요?","은?","는?"]}]}'::jsonb,
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
  returning id into choice_activity_id;

  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    choice_activity_id,
    '{"kind":"index_array","value":[0,1,0,1,0,1]}'::jsonb,
    '{"correct":{"zh-CN":"六题依次使用 이에요、예요、은、는、이에요?、예요?。","ko-KR":"여섯 문항은 차례로 이에요, 예요, 은, 는, 이에요?, 예요?를 씁니다."},"feedback":[{"zh-CN":"先判断是在说明身份、标记话题，还是进行确认提问。","ko-KR":"신분 설명, 화제 표시와 확인 질문 가운데 무엇인지 먼저 판단하세요."},{"zh-CN":"再检查前一个名词最后有没有收音。","ko-KR":"그다음 앞 명사의 받침 유무를 확인하세요."},{"zh-CN":"对照完整句子，把六题全部订正后再提交。","ko-KR":"완전한 문장을 확인하고 여섯 문항을 모두 고쳐 다시 제출하세요."}]}'::jsonb
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order,
    prompt, instruction, options, public_config, max_attempts,
    counts_toward_completion
  ) values (
    grammar_node_id,
    'grammar-judgment',
    'single_choice',
    2,
    '{"zh-CN":"判断六个句子的语法形式是否正确。","ko-KR":"여섯 문장의 문법 형태가 맞는지 판단하세요."}'::jsonb,
    '{"zh-CN":"只判断本课的이에요/예요、은/는和确认疑问句形式。","ko-KR":"이 과의 이에요/예요, 은/는와 확인 질문 형태만 판단하세요."}'::jsonb,
    '[]'::jsonb,
    '{"practiceKind":"judgment","shuffle":false,"shuffleOptions":false,"items":[{"id":"judgment-1","group":"page-1","question":"저는 학생이에요.","options":["正确","错误"]},{"id":"judgment-2","group":"page-1","question":"저는 리나에요.","options":["正确","错误"]},{"id":"judgment-3","group":"page-1","question":"민준은 학생이에요.","options":["正确","错误"]},{"id":"judgment-4","group":"page-2","question":"지민 씨은 학생이에요?","options":["正确","错误"]},{"id":"judgment-5","group":"page-2","question":"학생이에요 까?","options":["正确","错误"]},{"id":"judgment-6","group":"page-2","question":"아니요, 선생님이에요.","options":["正确","错误"]}]}'::jsonb,
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
  returning id into judgment_activity_id;

  insert into public.digital_textbook_activity_secrets (activity_id, answer_key, explanation)
  values (
    judgment_activity_id,
    '{"kind":"index_array","value":[0,1,0,1,1,0]}'::jsonb,
    '{"correct":{"zh-CN":"判断结果依次为正确、错误、正确、错误、错误、正确。","ko-KR":"판단 결과는 차례로 맞음, 틀림, 맞음, 틀림, 틀림, 맞음입니다."},"feedback":[{"zh-CN":"检查名字后的예요、姓名后的은/는以及疑问句是否直接加问号。","ko-KR":"이름 뒤의 예요, 이름 뒤의 은/는와 질문이 바로 물음표로 끝나는지 확인하세요."},{"zh-CN":"리나后应为예요，지민 씨后应为는；确认问句不分写까。","ko-KR":"리나 뒤에는 예요, 지민 씨 뒤에는 는를 쓰고 확인 질문에서 까를 띄어 쓰지 않습니다."},{"zh-CN":"逐句订正后，将六道判断题全部重新提交。","ko-KR":"문장마다 고친 뒤 여섯 판단 문제를 모두 다시 제출하세요."}]}'::jsonb
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();
end $$;
