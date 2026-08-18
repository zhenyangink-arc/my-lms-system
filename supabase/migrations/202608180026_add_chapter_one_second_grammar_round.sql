-- Every chapter-one grammar point must be practised twice.
do $$
declare
  grammar_node_id uuid;
  transfer_activity_id uuid;
begin
  select node.id
  into grammar_node_id
  from public.digital_textbook_nodes node
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'topic-and-copula'
  limit 1;

  if grammar_node_id is null then
    raise exception 'Cannot add chapter-one grammar practice: topic-and-copula node is missing';
  end if;

  update public.digital_textbook_nodes
  set content = jsonb_set(
        content,
        '{coach}',
        '{"zh-CN":"两轮六项填空必须全部正确；三个语法点均在不同收音条件下练习两遍。","ko-KR":"두 차례의 여섯 빈칸을 모두 맞혀야 하며 세 문법 항목을 서로 다른 받침 조건에서 두 번씩 연습합니다."}'::jsonb,
        true
      ),
      updated_at = now()
  where id = grammar_node_id;

  insert into public.digital_textbook_activities (
    node_id,
    activity_key,
    activity_type,
    sort_order,
    prompt,
    instruction,
    options,
    public_config,
    max_attempts
  ) values (
    grammar_node_id,
    'grammar-transfer',
    'fill_blank',
    2,
    '{"zh-CN":"再完成一轮，换用相反的收音条件练习三个语法点。","ko-KR":"받침 조건을 바꾸어 세 문법 항목을 한 번 더 연습하세요."}'::jsonb,
    '{"zh-CN":"依次填写三个空；第三空须包含问号。","ko-KR":"세 빈칸을 차례로 쓰고 세 번째 답에는 물음표도 쓰세요."}'::jsonb,
    '[]'::jsonb,
    '{"normalize":"NFC","items":[{"id":"copula-transfer","label":"저는 왕밍___","placeholder":"이에요/예요"},{"id":"topic-transfer","label":"왕밍 씨___ 학생이에요.","placeholder":"은/는"},{"id":"confirmation-transfer","label":"리나 씨는 의사___","placeholder":"이에요?/예요?"}]}'::jsonb,
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
  returning id into transfer_activity_id;

  insert into public.digital_textbook_activity_secrets (
    activity_id,
    answer_key,
    explanation,
    transcript_ko,
    audio_object_key,
    audio_status
  ) values (
    transfer_activity_id,
    '{"kind":"text_array","value":["이에요","는","예요?"]}'::jsonb,
    '{"correct":{"zh-CN":"第二轮答案依次为 이에요、는、예요?。","ko-KR":"두 번째 연습의 답은 차례로 이에요, 는, 예요?입니다."},"feedback":[{"zh-CN":"仍然先判断身份说明、话题标记和身份确认三种功能。","ko-KR":"신분 설명, 화제 표시와 신분 확인 기능을 먼저 구별하세요."},{"zh-CN":"① 왕밍 有收音；② 씨 无收音；③ 의사 无收音且是问句。","ko-KR":"① 왕밍은 받침이 있고 ② 씨는 받침이 없으며 ③ 의사는 받침이 없는 질문입니다."},{"zh-CN":"完整句是 저는 왕밍이에요.／왕밍 씨는 학생이에요.／리나 씨는 의사예요?，请全部正确重做。","ko-KR":"완전한 문장은 저는 왕밍이에요.／왕밍 씨는 학생이에요.／리나 씨는 의사예요?입니다. 모두 다시 맞히세요."}]}'::jsonb,
    null,
    null,
    'pending'
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    transcript_ko = excluded.transcript_ko,
    audio_object_key = excluded.audio_object_key,
    audio_status = excluded.audio_status,
    updated_at = now();
end $$;
