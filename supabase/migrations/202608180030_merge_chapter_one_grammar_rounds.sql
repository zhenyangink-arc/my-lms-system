do $$
declare
  grammar_node_id uuid;
  merged_activity_id uuid;
  transfer_activity_id uuid;
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

  select id into merged_activity_id
  from public.digital_textbook_activities
  where node_id = grammar_node_id and activity_key = 'grammar-fill';

  select id into transfer_activity_id
  from public.digital_textbook_activities
  where node_id = grammar_node_id and activity_key = 'grammar-transfer';

  update public.digital_textbook_activities
  set prompt = '{"zh-CN":"连续完成两轮六小题，练习判断词尾、话题助词和确认疑问句。","ko-KR":"두 번의 연습, 여섯 문항으로 서술격 어미, 주제 조사와 확인 의문문을 연습하세요."}'::jsonb,
      instruction = '{"zh-CN":"每个语法点练习两遍；第3、6空须包含问号。","ko-KR":"각 문법 항목을 두 번씩 연습하고 3번과 6번 답에는 물음표도 쓰세요."}'::jsonb,
      public_config = '{"focusMode":true,"normalize":"NFC","items":[{"id":"copula","group":"第一轮","groupKo":"첫 번째 연습","label":"저는 리나___","placeholder":"이에요/예요"},{"id":"topic","group":"第一轮","groupKo":"첫 번째 연습","label":"민준___ 학생이에요.","placeholder":"은/는"},{"id":"confirmation","group":"第一轮","groupKo":"첫 번째 연습","label":"지민 씨는 학생___","placeholder":"이에요?/예요?"},{"id":"copula-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"저는 왕밍___","placeholder":"이에요/예요"},{"id":"topic-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"민지___ 친구예요.","placeholder":"은/는"},{"id":"confirmation-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"리나 씨는 의사___","placeholder":"이에요?/예요?"}]}'::jsonb,
      updated_at = now()
  where id = merged_activity_id;

  update public.digital_textbook_activity_secrets
  set answer_key = '{"kind":"text_array","value":["예요","은","이에요?","이에요","는","예요?"]}'::jsonb,
      explanation = '{"correct":{"zh-CN":"两轮六题依次为 예요、은、이에요?、이에요、는、예요?。","ko-KR":"두 번의 연습 답은 차례로 예요, 은, 이에요?, 이에요, 는, 예요?입니다."},"feedback":[{"zh-CN":"先区分身份说明、话题标记和确认提问，再判断有无收音。","ko-KR":"신분 설명, 화제 표시와 확인 질문을 구별한 뒤 받침을 확인하세요."},{"zh-CN":"第一轮和第二轮使用相反的收音条件。","ko-KR":"첫 번째와 두 번째 연습은 서로 다른 받침 조건을 사용합니다."},{"zh-CN":"对照两轮完整句，将六题全部正确重做。","ko-KR":"두 번의 완전한 문장을 확인하고 여섯 문항을 모두 다시 풀어 보세요."}]}'::jsonb,
      updated_at = now()
  where activity_id = merged_activity_id;

  if transfer_activity_id is not null then
    delete from public.digital_textbook_attempts where activity_id = transfer_activity_id;
    delete from public.digital_textbook_activity_secrets where activity_id = transfer_activity_id;
    delete from public.digital_textbook_activities where id = transfer_activity_id;
  end if;
end $$;
