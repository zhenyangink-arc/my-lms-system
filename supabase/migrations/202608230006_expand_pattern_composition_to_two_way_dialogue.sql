do $$
declare
  composition_activity_id uuid;
  pattern_node_id uuid;
  textbook_version_id uuid;
begin
  select activity.id, node.id, version.id
    into composition_activity_id, pattern_node_id, textbook_version_id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and module.module_code = 'patterns'
    and node.node_code = 'introduce-yourself'
    and activity.activity_key = 'pattern-compose'
  order by version.version_number desc
  limit 1;

  if composition_activity_id is null then
    raise exception 'Cannot expand pattern composition: pattern-compose activity is missing';
  end if;

  update public.digital_textbook_activities
  set prompt = '{"zh-CN":"主动提问并回答对方，完成一段双向的初次见面对话。","ko-KR":"상대에게 직접 묻고 대답하며 쌍방향 첫 만남 대화를 완성하세요."}'::jsonb,
      instruction = '{"zh-CN":"学生要完成问候、介绍、三次主动提问、身份回答和礼貌结束。","ko-KR":"학습자가 인사, 소개, 세 번의 질문, 신분 대답과 마무리를 직접 완성합니다."}'::jsonb,
      public_config = '{"composition":{"title":{"zh-CN":"从提问到回答，组合完整对话","ko-KR":"질문부터 대답까지 완전한 대화 조합하기"},"instruction":{"zh-CN":"不仅回答对方，也要主动询问姓名、身份和国籍／地区。","ko-KR":"대답만 하지 않고 이름, 신분과 국적·지역도 직접 물어보세요."},"steps":[
        {"id":"greeting-name","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"안녕하세요?","task":{"zh-CN":"回应问候并介绍姓名","ko-KR":"인사하고 이름을 소개하세요"},"hint":{"zh-CN":"先问候，再使用저는介绍姓名。","ko-KR":"먼저 인사하고 저는으로 이름을 소개하세요."},"tokens":["저는","안녕하세요?","왕밍이에요."]},
        {"id":"ask-name","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"만나서 반가워요.","task":{"zh-CN":"主动询问对方姓名","ko-KR":"상대방의 이름을 직접 물어보세요"},"hint":{"zh-CN":"使用이름은 뭐예요?礼貌询问姓名。","ko-KR":"이름은 뭐예요?로 공손하게 이름을 물어보세요."},"tokens":["뭐예요?","지민 씨의","이름은"]},
        {"id":"ask-identity","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"제 이름은 김지민이에요.","task":{"zh-CN":"主动询问对方身份","ko-KR":"상대방의 신분을 직접 물어보세요"},"hint":{"zh-CN":"用姓名加씨는询问是不是学生。","ko-KR":"이름 뒤에 씨는을 붙여 학생인지 물어보세요."},"tokens":["학생이에요?","지민 씨는"]},
        {"id":"answer-identity","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"네, 학생이에요. 왕밍 씨는 학생이에요?","task":{"zh-CN":"回答自己的身份并补充学习内容","ko-KR":"자신의 신분을 답하고 배우는 내용을 덧붙이세요"},"hint":{"zh-CN":"先肯定身份，再说明学习韩语。","ko-KR":"먼저 신분을 긍정하고 한국어 학습을 말하세요."},"tokens":["한국어를 배워요.","네,","저도 학생이에요."]},
        {"id":"ask-nationality","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"네, 저도 한국어를 배워요.","task":{"zh-CN":"主动询问对方国籍或地区","ko-KR":"상대방의 국적이나 지역을 직접 물어보세요"},"hint":{"zh-CN":"用한국 사람이에요?进行确认提问。","ko-KR":"한국 사람이에요?로 확인 질문을 하세요."},"tokens":["한국 사람이에요?","지민 씨는"]},
        {"id":"closing","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"prompt":"네, 한국 사람이에요.","task":{"zh-CN":"用礼貌结束语完成对话","ko-KR":"공손한 마무리 인사로 대화를 끝내세요"},"hint":{"zh-CN":"称呼对方并表达见面很高兴。","ko-KR":"상대방을 부르고 만나서 반갑다고 말하세요."},"tokens":["반가워요.","만나서","지민 씨,"]}
      ]}}'::jsonb,
      updated_at = now()
  where id = composition_activity_id;

  update public.digital_textbook_activity_secrets
  set answer_key = '{"kind":"text_array","value":["안녕하세요? 저는 왕밍이에요.","지민 씨의 이름은 뭐예요?","지민 씨는 학생이에요?","네, 저도 학생이에요. 한국어를 배워요.","지민 씨는 한국 사람이에요?","지민 씨, 만나서 반가워요."]}'::jsonb,
      explanation = '{"correct":{"zh-CN":"已经主动完成姓名、身份和国籍／地区提问，并自然回答和结束对话。","ko-KR":"이름, 신분과 국적·지역을 직접 묻고 자연스럽게 대답하고 마무리했습니다."},"feedback":[{"zh-CN":"先判断这一轮是主动提问还是回答对方。","ko-KR":"이번 차례가 질문인지 대답인지 먼저 확인하세요."},{"zh-CN":"提问时检查씨는和问号，回答时检查네和完整陈述。","ko-KR":"질문에서는 씨는과 물음표를, 대답에서는 네와 완전한 서술을 확인하세요."},{"zh-CN":"根据左侧当前气泡重新排列全部语块。","ko-KR":"왼쪽 현재 말풍선에 맞게 모든 말덩이를 다시 배열하세요."}]}'::jsonb,
      updated_at = now()
  where activity_id = composition_activity_id;

  delete from public.digital_textbook_attempts
  where activity_id = composition_activity_id;

  update public.digital_textbook_node_progress
  set status = 'in_progress',
      completion_percent = least(completion_percent, 67),
      updated_at = now()
  where node_id = pattern_node_id
    and version_id = textbook_version_id;
end $$;
