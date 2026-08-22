do $$
declare
  grammar_node_id uuid;
  choice_activity_id uuid;
  fill_activity_id uuid;
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
    raise exception 'Cannot normalize chapter-one grammar punctuation: node is missing';
  end if;

  select id into choice_activity_id
  from public.digital_textbook_activities
  where node_id = grammar_node_id and activity_key = 'grammar-choice';

  update public.digital_textbook_activities
  set public_config = jsonb_set(
        coalesce(public_config, '{}'::jsonb),
        '{items}',
        '[{"id":"choice-1","group":"page-1","question":"저는 학생___.","options":["이에요","예요","은","는"]},{"id":"choice-2","group":"page-1","question":"저는 리나___.","options":["이에요","예요","은","는"]},{"id":"choice-3","group":"page-1","question":"민준___ 학생이에요.","options":["은","는","이에요","예요"]},{"id":"choice-4","group":"page-2","question":"지민 씨___ 학생이에요?","options":["은","는","이에요","예요"]},{"id":"choice-5","group":"page-2","question":"왕밍 씨는 학생___?","options":["이에요","예요","은","는"]},{"id":"choice-6","group":"page-2","question":"리나 씨는 의사___?","options":["이에요","예요","은","는"]}]'::jsonb,
        true
      ),
      updated_at = now()
  where id = choice_activity_id;

  update public.digital_textbook_activity_secrets
  set explanation = '{"correct":{"zh-CN":"六题依次使用 이에요、예요、은、는、이에요、예요；句末标点已显示在题干中。","ko-KR":"여섯 문항은 차례로 이에요, 예요, 은, 는, 이에요, 예요를 쓰며 문장 부호는 문제에 표시됩니다."},"feedback":[{"zh-CN":"先判断是在说明身份、标记话题，还是进行确认提问。","ko-KR":"신분 설명, 화제 표시와 확인 질문 가운데 무엇인지 먼저 판단하세요."},{"zh-CN":"再检查前一个名词最后有没有收音；不要在答案中重复标点。","ko-KR":"앞 명사의 받침 유무를 확인하고 답에 문장 부호를 다시 쓰지 마세요."},{"zh-CN":"对照完整句子，把六题全部订正后再提交。","ko-KR":"완전한 문장을 확인하고 여섯 문항을 모두 고쳐 다시 제출하세요."}]}'::jsonb,
      updated_at = now()
  where activity_id = choice_activity_id;

  select id into fill_activity_id
  from public.digital_textbook_activities
  where node_id = grammar_node_id and activity_key = 'grammar-fill';

  update public.digital_textbook_activities
  set instruction = '{"zh-CN":"每个语法点练习两遍；句末标点已经显示，只填写空缺的语法形式。","ko-KR":"각 문법 항목을 두 번씩 연습하며 문장 부호는 이미 표시되어 있으므로 빈칸의 문법 형태만 쓰세요."}'::jsonb,
      public_config = jsonb_set(
        coalesce(public_config, '{}'::jsonb),
        '{items}',
        '[{"id":"copula","group":"第一轮","groupKo":"첫 번째 연습","label":"저는 리나___.","placeholder":"이에요/예요"},{"id":"topic","group":"第一轮","groupKo":"첫 번째 연습","label":"민준___ 학생이에요.","placeholder":"은/는"},{"id":"confirmation","group":"第一轮","groupKo":"첫 번째 연습","label":"지민 씨는 학생___?","placeholder":"이에요/예요"},{"id":"copula-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"저는 왕밍___.","placeholder":"이에요/예요"},{"id":"topic-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"민지___ 친구예요.","placeholder":"은/는"},{"id":"confirmation-transfer","group":"第二轮","groupKo":"두 번째 연습","label":"리나 씨는 의사___?","placeholder":"이에요/예요"}]'::jsonb,
        true
      ),
      updated_at = now()
  where id = fill_activity_id;

  update public.digital_textbook_activity_secrets
  set answer_key = '{"kind":"text_array","value":["예요","은","이에요","이에요","는","예요"]}'::jsonb,
      explanation = '{"correct":{"zh-CN":"六题依次填写 예요、은、이에요、이에요、는、예요；句号和问号不属于答案。","ko-KR":"여섯 빈칸에는 차례로 예요, 은, 이에요, 이에요, 는, 예요를 쓰며 마침표와 물음표는 답에 포함하지 않습니다."},"feedback":[{"zh-CN":"先区分身份说明、话题标记和确认提问，再判断有无收音。","ko-KR":"신분 설명, 화제 표시와 확인 질문을 구별한 뒤 받침을 확인하세요."},{"zh-CN":"只填写横线处缺少的语法形式，不要输入题干已有的标点。","ko-KR":"밑줄에 빠진 문법 형태만 쓰고 문제에 표시된 문장 부호는 입력하지 마세요."},{"zh-CN":"对照两页完整句子，将六题全部订正后再提交。","ko-KR":"두 페이지의 완전한 문장을 확인하고 여섯 문항을 모두 다시 풀어 보세요."}]}'::jsonb,
      updated_at = now()
  where activity_id = fill_activity_id;
end $$;
