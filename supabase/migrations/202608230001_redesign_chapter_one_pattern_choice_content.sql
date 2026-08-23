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
    raise exception 'Cannot redesign chapter-one pattern choices: activity is missing';
  end if;

  update public.digital_textbook_activities
  set
    prompt = '{"zh-CN":"根据人物、身份和对话线索，选择能够直接说出口的完整句子。","ko-KR":"인물, 신분과 대화 단서를 보고 바로 말할 수 있는 완전한 문장을 고르세요."}'::jsonb,
    instruction = '{"zh-CN":"重点是替换句型中的姓名和身份信息，不单独判断语法词尾。","ko-KR":"문법 어미만 고르는 것이 아니라 문형 속 이름과 신분 정보를 바꾸는 연습입니다."}'::jsonb,
    public_config = '{"practiceKind":"pattern_choice","groups":[
      {"id":"name","title":{"zh-CN":"姓名替换","ko-KR":"이름 대치"},"instruction":{"zh-CN":"阅读姓名卡和提问，选择与人物对应的完整回答。","ko-KR":"이름 카드와 질문을 보고 인물에 맞는 완전한 대답을 고르세요."},"items":[
        {"id":"name-1","question":{"zh-CN":"姓名卡：王明｜别人问“이름이 뭐예요?”，王明怎么回答？","ko-KR":"이름 카드: 왕밍｜‘이름이 뭐예요?’에 어떻게 대답할까요?"},"options":["저는 왕밍이에요.","저는 리나예요.","왕밍 씨는 학생이에요?","저는 학생이에요."]},
        {"id":"name-2","question":{"zh-CN":"姓名卡：莉娜｜请选择莉娜的自我介绍。","ko-KR":"이름 카드: 리나｜리나의 자기소개를 고르세요."},"options":["저는 지민이에요.","저는 리나예요.","리나 씨는 의사예요?","저는 의사예요."]},
        {"id":"name-3","question":{"zh-CN":"姓名卡：金智敏｜初次见面时，智敏怎样介绍姓名？","ko-KR":"이름 카드: 김지민｜처음 만났을 때 이름을 어떻게 소개할까요?"},"options":["저는 왕밍이에요.","지민 씨는 학생이에요?","저는 김지민이에요.","저는 선생님이에요."]}
      ]},
      {"id":"identity","title":{"zh-CN":"身份替换","ko-KR":"신분 대치"},"instruction":{"zh-CN":"根据身份卡替换句型中的身份信息，选择完整陈述句。","ko-KR":"신분 카드를 보고 문형 속 신분 정보를 바꾼 완전한 문장을 고르세요."},"items":[
        {"id":"identity-1","question":{"zh-CN":"王明的身份卡：学生｜请选择王明接着说的句子。","ko-KR":"왕밍의 신분 카드: 학생｜왕밍이 이어서 할 말을 고르세요."},"options":["저는 왕밍이에요.","저는 학생이에요.","저는 의사예요.","왕밍 씨는 학생이에요?"]},
        {"id":"identity-2","question":{"zh-CN":"莉娜的身份卡：医生｜请选择正确的身份介绍。","ko-KR":"리나의 신분 카드: 의사｜알맞은 신분 소개를 고르세요."},"options":["저는 학생이에요.","리나 씨는 의사예요?","저는 의사예요.","저는 리나예요."]},
        {"id":"identity-3","question":{"zh-CN":"智敏的身份卡：老师｜请选择智敏介绍职业的句子。","ko-KR":"지민의 신분 카드: 선생님｜직업을 소개하는 문장을 고르세요."},"options":["저는 선생님이에요.","저는 김지민이에요.","저는 학생이에요.","지민 씨는 선생님이에요?"]}
      ]},
      {"id":"confirm","title":{"zh-CN":"询问确认","ko-KR":"확인 질문"},"instruction":{"zh-CN":"根据对方的信息，选择用于礼貌确认的完整问句。","ko-KR":"상대방의 정보를 보고 공손하게 확인하는 완전한 질문을 고르세요."},"items":[
        {"id":"confirm-1","question":{"zh-CN":"你听说智敏是学生，想向她本人确认。应该怎么问？","ko-KR":"지민이 학생이라고 들었습니다. 본인에게 어떻게 확인할까요?"},"options":["저는 학생이에요.","지민 씨는 선생님이에요?","지민 씨는 학생이에요?","저는 김지민이에요."]},
        {"id":"confirm-2","question":{"zh-CN":"你想确认莉娜是不是医生。应该怎么问？","ko-KR":"리나가 의사인지 확인하려면 어떻게 물을까요?"},"options":["리나 씨는 의사예요?","저는 리나예요.","리나 씨는 학생이에요?","저는 의사예요."]},
        {"id":"confirm-3","question":{"zh-CN":"你想确认王明是不是老师。应该怎么问？","ko-KR":"왕밍이 선생님인지 확인하려면 어떻게 물을까요?"},"options":["저는 선생님이에요.","왕밍 씨는 선생님이에요?","왕밍 씨는 학생이에요?","저는 왕밍이에요."]}
      ]}
    ]}'::jsonb,
    updated_at = now()
  where id = pattern_choice_id;

  update public.digital_textbook_activity_secrets
  set
    answer_key = '{"kind":"index_array","value":[0,1,2,1,2,0,2,0,1]}'::jsonb,
    explanation = '{"correct":{"zh-CN":"已能根据人物和场景选择完整句型。","ko-KR":"인물과 상황에 맞는 완전한 문형을 골랐습니다."},"feedback":[{"zh-CN":"先看题干中的人物姓名，再匹配自我介绍。","ko-KR":"문제의 인물 이름을 먼저 보고 자기소개와 연결하세요."},{"zh-CN":"身份介绍使用“저는 + 身份 + 이에요/예요”。","ko-KR":"신분 소개는 ‘저는 + 신분 + 이에요/예요’를 사용합니다."},{"zh-CN":"确认别人身份时，用“姓名 씨는 + 身份 + 이에요/예요?”。","ko-KR":"상대의 신분을 확인할 때는 ‘이름 씨는 + 신분 + 이에요/예요?’를 사용합니다."}]}'::jsonb,
    updated_at = now()
  where activity_id = pattern_choice_id;
end $$;
