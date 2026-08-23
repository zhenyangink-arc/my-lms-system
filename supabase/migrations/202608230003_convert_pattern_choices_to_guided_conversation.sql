do $$
declare
  pattern_choice_id uuid;
begin
  select activity.id into pattern_choice_id
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
    and activity.activity_key = 'pattern-choice'
  order by version.version_number desc
  limit 1;

  if pattern_choice_id is null then
    raise exception 'Cannot create guided conversation: pattern-choice activity is missing';
  end if;

  update public.digital_textbook_activities
  set
    prompt = '{"zh-CN":"在连续对话中选择合适的回答，让王明和智敏完成初次见面交流。","ko-KR":"이어지는 대화에서 알맞은 말을 골라 왕밍과 지민의 첫 만남 대화를 완성하세요."}'::jsonb,
    instruction = '{"zh-CN":"每次只处理当前一句；答对后回答会逐字进入气泡，并自动出现下一句。","ko-KR":"현재 한 문장씩 답하며 맞히면 대답이 글자별로 말풍선에 나타난 뒤 다음 말이 이어집니다."}'::jsonb,
    public_config = '{"practiceKind":"guided_conversation","conversation":{"title":{"zh-CN":"完成初次见面对话","ko-KR":"첫 만남 대화 완성"},"instruction":{"zh-CN":"选择合适的回答，让对话逐句继续。","ko-KR":"알맞은 대답을 골라 대화를 한 문장씩 이어 가세요."},"steps":[
      {"id":"jimin-intro","kind":"line","side":"left","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"line":"안녕하세요? 저는 김지민이에요.","typingSpeedMs":52,"afterMs":420},
      {"id":"wangming-intro","kind":"choice","side":"right","speaker":{"zh-CN":"王明","ko-KR":"왕밍"},"choiceIndex":0,"prompt":{"zh-CN":"王明怎样回应并介绍姓名？","ko-KR":"왕밍은 어떻게 인사하고 이름을 소개할까요?"},"options":["안녕하세요? 저는 왕밍이에요.","저는 학생이에요.","지민 씨는 학생이에요?","만나서 반가워요."],"typingSpeedMs":52,"afterMs":420},
      {"id":"jimin-asks-identity","kind":"line","side":"left","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"line":"왕밍 씨는 학생이에요?","typingSpeedMs":52,"afterMs":420},
      {"id":"wangming-identity","kind":"choice","side":"right","speaker":{"zh-CN":"王明","ko-KR":"왕밍"},"choiceIndex":1,"prompt":{"zh-CN":"王明怎样回答自己的身份？","ko-KR":"왕밍은 자신의 신분을 어떻게 대답할까요?"},"options":["아니요, 선생님이에요.","네, 학생이에요. 한국어를 배워요.","저는 왕밍이에요.","지민 씨는 학생이에요?"],"typingSpeedMs":52,"afterMs":420},
      {"id":"wangming-asks-identity","kind":"choice","side":"right","speaker":{"zh-CN":"王明","ko-KR":"왕밍"},"choiceIndex":2,"prompt":{"zh-CN":"王明接着怎样询问智敏？","ko-KR":"왕밍은 이어서 지민에게 어떻게 물을까요?"},"options":["저는 학생이에요.","만나서 반가워요.","지민 씨는 학생이에요?","왕밍 씨는 학생이에요?"],"typingSpeedMs":52,"afterMs":420},
      {"id":"jimin-identity","kind":"line","side":"left","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"line":"네, 저도 학생이에요.","typingSpeedMs":52,"afterMs":420},
      {"id":"wangming-closing","kind":"choice","side":"right","speaker":{"zh-CN":"王明","ko-KR":"왕밍"},"choiceIndex":3,"prompt":{"zh-CN":"王明怎样礼貌结束初次见面对话？","ko-KR":"왕밍은 첫 만남 대화를 어떻게 공손히 마칠까요?"},"options":["안녕하세요?","저는 왕밍이에요.","네, 학생이에요.","만나서 반가워요."],"typingSpeedMs":52,"afterMs":420},
      {"id":"jimin-closing","kind":"line","side":"left","speaker":{"zh-CN":"智敏","ko-KR":"지민"},"line":"저도 만나서 반가워요.","typingSpeedMs":52,"afterMs":420}
    ]}}'::jsonb,
    max_attempts = 3,
    updated_at = now()
  where id = pattern_choice_id;

  update public.digital_textbook_activity_secrets
  set
    answer_key = '{"kind":"index_array","value":[0,1,2,3]}'::jsonb,
    explanation = '{"correct":{"zh-CN":"已经完成姓名、身份确认和礼貌结束组成的连续对话。","ko-KR":"이름 소개, 신분 확인과 인사 마무리가 이어지는 대화를 완성했습니다."},"feedback":[{"zh-CN":"先回应智敏刚刚说的内容，不要提前跳到后面的功能。","ko-KR":"지민이 방금 한 말에 먼저 응답하고 뒤의 기능을 앞당기지 마세요."},{"zh-CN":"按照问候、姓名、身份、反问和结束语的顺序推进。","ko-KR":"인사, 이름, 신분, 되묻기와 마무리 순서로 이어 가세요."},{"zh-CN":"根据当前气泡重新选择能直接接上的完整句子。","ko-KR":"현재 말풍선에 바로 이어지는 완전한 문장을 다시 고르세요."}]}'::jsonb,
    updated_at = now()
  where activity_id = pattern_choice_id;
end $$;
