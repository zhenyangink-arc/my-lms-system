do $$
declare
  pattern_node_id uuid;
  composition_activity_id uuid;
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
    raise exception 'Cannot create pattern composition: introduce-yourself node is missing';
  end if;

  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order, prompt, instruction,
    options, public_config, max_attempts, counts_toward_completion
  ) values (
    pattern_node_id,
    'pattern-compose',
    'fill_blank',
    3,
    '{"zh-CN":"选择语块组成回答，完成一段初次见面对话。","ko-KR":"말덩이를 골라 대답을 만들고 첫 만남 대화를 완성하세요."}'::jsonb,
    '{"zh-CN":"语块按自然顺序加入右侧回答；回答正确后会进入对话。","ko-KR":"말덩이를 자연스러운 순서로 골라 오른쪽 대답을 만들면 대화에 들어갑니다."}'::jsonb,
    '[]'::jsonb,
    '{"composition":{"title":{"zh-CN":"组合一段完整对话","ko-KR":"완전한 대화 조합하기"},"instruction":{"zh-CN":"依次完成问候、姓名、身份确认和礼貌结束。","ko-KR":"인사, 이름, 신분 확인과 마무리를 차례로 완성하세요."},"steps":[
      {"id":"greeting-name","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"안녕하세요? 저는 김지민이에요.","task":{"zh-CN":"回应问候并介绍姓名","ko-KR":"인사하고 이름을 소개하세요"},"hint":{"zh-CN":"先问候，再使用저는介绍姓名。","ko-KR":"먼저 인사하고 저는으로 이름을 소개하세요."},"tokens":["저는","안녕하세요?","왕밍이에요."]},
      {"id":"identity-answer","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"왕밍 씨는 학생이에요?","task":{"zh-CN":"确认身份并补充学习内容","ko-KR":"신분을 확인하고 배우는 내용을 덧붙이세요"},"hint":{"zh-CN":"先用네回答，再说明身份和学习内容。","ko-KR":"네로 답한 뒤 신분과 배우는 내용을 말하세요."},"tokens":["한국어를 배워요.","네,","학생이에요."]},
      {"id":"ask-back","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"저도 학생이에요.","task":{"zh-CN":"询问对方的姓名","ko-KR":"상대방의 이름을 물어보세요"},"hint":{"zh-CN":"使用이름은 뭐예요?礼貌询问。","ko-KR":"이름은 뭐예요?로 공손하게 물어보세요."},"tokens":["이름은","지민 씨의","뭐예요?"]},
      {"id":"closing","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"제 이름은 김지민이에요.","task":{"zh-CN":"用礼貌结束语完成对话","ko-KR":"공손한 마무리 인사로 대화를 끝내세요"},"hint":{"zh-CN":"表达见到对方很高兴。","ko-KR":"만나서 반갑다는 마음을 표현하세요."},"tokens":["반가워요.","만나서","지민 씨,"]}
    ]}}'::jsonb,
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
  returning id into composition_activity_id;

  insert into public.digital_textbook_activity_secrets (
    activity_id, answer_key, explanation, audio_status
  ) values (
    composition_activity_id,
    '{"kind":"text_array","value":["안녕하세요? 저는 왕밍이에요.","네, 학생이에요. 한국어를 배워요.","지민 씨의 이름은 뭐예요?","지민 씨, 만나서 반가워요."]}'::jsonb,
    '{"correct":{"zh-CN":"已经把问候、姓名、身份确认、反问和结束语组合成完整对话。","ko-KR":"인사, 이름, 신분 확인, 되묻기와 마무리를 완전한 대화로 조합했습니다."},"feedback":[{"zh-CN":"先判断当前回答承担什么交际功能。","ko-KR":"현재 대답의 의사소통 기능을 먼저 확인하세요."},{"zh-CN":"检查语块顺序和句末标点。","ko-KR":"말덩이 순서와 문장 부호를 확인하세요."},{"zh-CN":"根据左侧当前气泡重新排列全部语块。","ko-KR":"왼쪽 현재 말풍선에 맞게 모든 말덩이를 다시 배열하세요."}]}'::jsonb,
    'pending'
  )
  on conflict (activity_id) do update set
    answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    audio_status = excluded.audio_status,
    updated_at = now();
end $$;
