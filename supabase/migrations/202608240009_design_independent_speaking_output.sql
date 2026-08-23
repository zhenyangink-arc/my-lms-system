-- Turn the final listen-speak page into a scaffolded independent introduction.
-- Learners choose keywords first; the full reference stays hidden until a
-- recording exists. Completion requires a persisted recording and four nodes.

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
    and node.node_code = 'listen-and-respond'
    and activity.activity_key = 'speaking-introduction'
)
update public.digital_textbook_activities as activity
set prompt = '{"zh-CN":"脱离完整原稿，用韩语完成一段自己的初次见面自我介绍。","ko-KR":"전체 원고 없이 한국어로 자신의 첫 만남 자기소개를 완성하세요."}'::jsonb,
    instruction = '{"zh-CN":"先选择表达关键词，再录制至少 15 秒；录音完成后可以查看参考表达。","ko-KR":"먼저 표현 핵심어를 고르고 15초 이상 녹음하세요. 녹음 후 참고 표현을 볼 수 있습니다."}'::jsonb,
    public_config = $config$
    {
      "presentation":"independent_output",
      "minimumSeconds":15,
      "maximumSeconds":60,
      "minimumTurns":0,
      "minimumOutlineItems":4,
      "requiredCriteria":4,
      "enforceCompletionRequirements":true,
      "pronunciationScore":false,
      "outlineItems":[
        {"id":"greeting","label":{"zh-CN":"问候","ko-KR":"인사"},"choices":["안녕하세요?","안녕하세요."]},
        {"id":"name","label":{"zh-CN":"姓名","ko-KR":"이름"},"choices":["저는 왕밍이에요.","저는 리나예요.","저는 김지민이에요."]},
        {"id":"country","label":{"zh-CN":"国籍","ko-KR":"국적"},"choices":["중국 사람이에요.","한국 사람이에요."]},
        {"id":"identity","label":{"zh-CN":"身份","ko-KR":"신분"},"choices":["학생이에요.","회사원이에요.","선생님이에요."]},
        {"id":"closing","label":{"zh-CN":"结束语","ko-KR":"마무리"},"choices":["만나서 반가워요.","네, 반가워요."]}
      ],
      "criteria":["问候","姓名","国籍","身份","礼貌结束"],
      "referenceText":"안녕하세요? 저는 왕밍이에요. 중국 사람이에요. 저는 학생이에요. 요즘 한국어를 배워요. 만나서 반가워요."
    }
    $config$::jsonb,
    updated_at = now()
where activity.id in (select id from target_activity);
