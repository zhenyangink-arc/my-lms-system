-- Expand chapter-one listening from one identity question to two pages of
-- six evidence-based questions. The transcript remains private.

with target_activity as (
  select activity.id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activities as activity
set prompt = '{"zh-CN":"听同一段自我介绍，分两页找出关键信息。","ko-KR":"같은 자기소개를 듣고 두 페이지에서 핵심 정보를 찾으세요."}'::jsonb,
    instruction = '{"zh-CN":"每页完成三题；依据音频原话作答，不查看完整原文。","ko-KR":"페이지마다 세 문제를 풀고 전체 원고가 아니라 실제 음성을 근거로 답하세요."}'::jsonb,
    options = '[]'::jsonb,
    public_config = activity.public_config || $config$
    {
      "shuffleOptions":false,
      "pageCount":2,
      "items":[
        {"id":"listen-name","group":"key-information","question":{"zh-CN":"说话人叫什么名字？","ko-KR":"말하는 사람의 이름은 무엇이에요?"},"options":["수진","지민","리나","왕밍"]},
        {"id":"listen-origin","group":"key-information","question":{"zh-CN":"说话人来自哪里？","ko-KR":"말하는 사람은 어느 나라 사람이에요?"},"options":["한국","중국","일본","没有提到／언급하지 않음"]},
        {"id":"listen-identity","group":"key-information","question":{"zh-CN":"说话人的身份是什么？","ko-KR":"말하는 사람의 신분은 무엇이에요?"},"options":["학생","선생님","회사원","의사"]},
        {"id":"listen-learning","group":"expression-details","question":{"zh-CN":"说话人正在学习什么？","ko-KR":"말하는 사람은 무엇을 배워요?"},"options":["한국어","영어","수학","没有提到／언급하지 않음"]},
        {"id":"listen-closing","group":"expression-details","question":{"zh-CN":"自我介绍最后使用了哪一句？","ko-KR":"자기소개 마지막에 어떤 말을 했어요?"},"options":["만나서 반가워요.","안녕히 가세요.","감사합니다.","죄송합니다."]},
        {"id":"listen-not-mentioned","group":"expression-details","question":{"zh-CN":"下面哪项信息没有在音频中出现？","ko-KR":"다음 중 음성에 나오지 않은 정보는 무엇이에요?"},"options":["姓名／이름","国籍／국적","身份／신분","年龄／나이"]}
      ]
    }
    $config$::jsonb,
    updated_at = now()
where activity.id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions as version on version.id = chapter.version_id
  join public.digital_textbooks as textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activity_secrets as secret
set answer_key = '{"kind":"index_array","value":[0,0,0,0,0,3]}'::jsonb,
    explanation = $explanation$
    {
      "correct":{"zh-CN":"答案均来自音频原话；音频没有提到年龄。","ko-KR":"모든 답은 음성의 실제 표현에 있으며 나이는 나오지 않습니다."},
      "feedback":[
        {"zh-CN":"重新听姓名、国籍和身份所在的完整句子。","ko-KR":"이름, 국적과 신분이 나오는 문장을 다시 들어 보세요."},
        {"zh-CN":"再听学习内容和最后一句，不要根据图片猜测。","ko-KR":"배우는 내용과 마지막 문장을 다시 듣고 그림으로 추측하지 마세요."}
      ]
    }
    $explanation$::jsonb,
    updated_at = now()
where secret.activity_id in (select id from target_activity);
