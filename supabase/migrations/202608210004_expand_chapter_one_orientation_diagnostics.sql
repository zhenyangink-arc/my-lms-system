-- Expand the chapter-one scene diagnosis from one greeting check to three
-- evidence-based questions. "없음" is correct when the dialogue does not
-- state a person's occupation or identity.
with target_node as (
  select node.id
  from public.digital_textbook_nodes as node
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and node.node_code = 'mission-map'
), activity_seed as (
  select *
  from jsonb_to_recordset($activities$
  [
    {
      "key":"orientation-check",
      "sort":1,
      "prompt":{"zh-CN":"王明和智敏初次见面时先说了什么？","ko-KR":"왕밍과 지민이 처음 만났을 때 먼저 무슨 말을 했어요?"},
      "instruction":{"zh-CN":"根据第 1 页的对话选择两人初次见面时的问候；本题不计分。","ko-KR":"1쪽 대화에서 두 사람이 처음 만났을 때 한 인사를 고르세요. 점수에는 포함되지 않습니다."},
      "options":["안녕하세요?","얼마예요?","어디에 있어요?","감기에 걸렸어요."],
      "answer":{"kind":"index","value":0},
      "explanation":{"correct":{"zh-CN":"两人初次见面时用 안녕하세요? 开始交流。","ko-KR":"두 사람은 안녕하세요?라고 인사하며 대화를 시작합니다."},"feedback":[{"zh-CN":"回想完整对话的第一轮。","ko-KR":"전체 대화의 첫 번째 말을 떠올리세요."},{"zh-CN":"寻找问候语，不要选择价格、地点或健康表达。","ko-KR":"가격, 장소나 건강 표현이 아닌 인사말을 찾으세요."},{"zh-CN":"正确答案是 안녕하세요?。","ko-KR":"정답은 안녕하세요?입니다."}]}
    },
    {
      "key":"orientation-jimin-occupation",
      "sort":2,
      "prompt":{"zh-CN":"智敏的身份／职业是什么？","ko-KR":"지민의 신분이나 직업은 무엇이에요?"},
      "instruction":{"zh-CN":"只依据对话中明确出现的信息作答；没有提及时选择“없음”。本题不计分。","ko-KR":"대화에 직접 나온 정보만 보고, 나오지 않으면 없음을 고르세요. 점수에는 포함되지 않습니다."},
      "options":["학생","선생님","회사원","없음"],
      "answer":{"kind":"index","value":0},
      "explanation":{"correct":{"zh-CN":"智敏明确回答“네, 학생이에요.”，所以答案是学生。","ko-KR":"지민이 네, 학생이에요.라고 직접 답했으므로 학생입니다."},"feedback":[{"zh-CN":"找到智敏回答身份问题的句子。","ko-KR":"지민이 신분 질문에 답한 문장을 찾으세요."},{"zh-CN":"不要根据人物外表猜测职业。","ko-KR":"인물의 모습만 보고 직업을 짐작하지 마세요."},{"zh-CN":"正确答案是 학생。","ko-KR":"정답은 학생입니다."}]}
    },
    {
      "key":"orientation-wangming-occupation",
      "sort":3,
      "prompt":{"zh-CN":"王明的身份／职业是什么？","ko-KR":"왕밍의 신분이나 직업은 무엇이에요?"},
      "instruction":{"zh-CN":"只依据对话中明确出现的信息作答；没有提及时选择“없음”。本题不计分。","ko-KR":"대화에 직접 나온 정보만 보고, 나오지 않으면 없음을 고르세요. 점수에는 포함되지 않습니다."},
      "options":["학생","선생님","회사원","없음"],
      "answer":{"kind":"index","value":3},
      "explanation":{"correct":{"zh-CN":"王明只介绍了姓名，对话没有说明他的身份或职业，所以选择“없음”。","ko-KR":"왕밍은 이름만 소개했고 신분이나 직업은 말하지 않았으므로 없음이 맞습니다."},"feedback":[{"zh-CN":"区分“介绍姓名”和“说明职业”。","ko-KR":"이름 소개와 직업 설명을 구별하세요."},{"zh-CN":"不要因为智敏是学生就推测王明也是学生。","ko-KR":"지민이 학생이라는 이유로 왕밍도 학생이라고 추측하지 마세요."},{"zh-CN":"对话未提及王明的职业，答案是 없음。","ko-KR":"대화에 왕밍의 직업이 나오지 않으므로 정답은 없음입니다."}]}
    }
  ]
  $activities$::jsonb) as seed(
    key text,
    sort integer,
    prompt jsonb,
    instruction jsonb,
    options jsonb,
    answer jsonb,
    explanation jsonb
  )
), upserted as (
  insert into public.digital_textbook_activities (
    node_id, activity_key, activity_type, sort_order, prompt, instruction,
    options, public_config, max_attempts
  )
  select
    target_node.id, activity_seed.key, 'single_choice', activity_seed.sort,
    activity_seed.prompt, activity_seed.instruction, activity_seed.options,
    '{"shuffle":false,"showScore":false}'::jsonb, 3
  from target_node cross join activity_seed
  on conflict (node_id, activity_key) do update set
    activity_type = excluded.activity_type,
    sort_order = excluded.sort_order,
    prompt = excluded.prompt,
    instruction = excluded.instruction,
    options = excluded.options,
    public_config = excluded.public_config,
    max_attempts = excluded.max_attempts,
    updated_at = now()
  returning id, activity_key
)
insert into public.digital_textbook_activity_secrets (
  activity_id, answer_key, explanation
)
select upserted.id, activity_seed.answer, activity_seed.explanation
from upserted
join activity_seed on activity_seed.key = upserted.activity_key
on conflict (activity_id) do update set
  answer_key = excluded.answer_key,
  explanation = excluded.explanation,
  updated_at = now();
