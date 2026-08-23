with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activities activity
set public_config = jsonb_set(activity.public_config, '{items}', $items$[
  {"id":"a-name","group":"listening-a","question":{"zh-CN":"说话人叫什么名字？","ko-KR":"말하는 사람의 이름은 무엇이에요?"},"options":["지민","수진","리나","왕밍"]},
  {"id":"a-origin","group":"listening-a","question":{"zh-CN":"说话人是哪国人？","ko-KR":"말하는 사람은 어느 나라 사람이에요?"},"options":["중국 사람","일본 사람","한국 사람","没有提到／언급하지 않음"]},
  {"id":"a-identity","group":"listening-a","question":{"zh-CN":"说话人的身份是什么？","ko-KR":"말하는 사람의 신분은 무엇이에요?"},"options":["선생님","학생","회사원","의사"]},
  {"id":"a-learning","group":"listening-a","question":{"zh-CN":"说话人最近在学习什么？","ko-KR":"말하는 사람은 요즘 무엇을 배워요?"},"options":["영어","수학","没有提到／언급하지 않음","한국어"]},
  {"id":"b-name","group":"listening-b","question":{"zh-CN":"自我介绍的人叫什么名字？","ko-KR":"자기소개한 사람의 이름은 무엇이에요?"},"options":["수진","왕밍","지민","리나"]},
  {"id":"b-origin","group":"listening-b","question":{"zh-CN":"王明是哪国人？","ko-KR":"왕밍 씨는 어느 나라 사람이에요?"},"options":["한국 사람","중국 사람","일본 사람","没有提到／언급하지 않음"]},
  {"id":"b-identity","group":"listening-b","question":{"zh-CN":"王明的身份是什么？","ko-KR":"왕밍 씨의 신분은 무엇이에요?"},"options":["학생","선생님","회사원","의사"]},
  {"id":"b-jimin","group":"listening-b","question":{"zh-CN":"智敏的身份是什么？","ko-KR":"지민 씨의 신분은 무엇이에요?"},"options":["회사원","선생님","没有提到／언급하지 않음","학생"]}
]$items$::jsonb),
    updated_at = now()
where activity.id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
update public.digital_textbook_activity_secrets secret
set answer_key = '{"kind":"index_array","value":[1,2,1,3,1,1,2,3]}'::jsonb,
    updated_at = now()
where secret.activity_id in (select id from target_activity);

with target_activity as (
  select activity.id
  from public.digital_textbook_activities activity
  join public.digital_textbook_nodes node on node.id = activity.node_id
  join public.digital_textbook_modules module on module.id = node.module_id
  join public.digital_textbook_chapters chapter on chapter.id = module.chapter_id
  join public.digital_textbook_versions version on version.id = chapter.version_id
  join public.digital_textbooks textbook on textbook.id = version.textbook_id
  where textbook.slug = 'korean-level-one-smart'
    and chapter.chapter_number = 1
    and activity.activity_key = 'listening-identity'
)
delete from public.digital_textbook_activity_page_progress progress
where progress.activity_id in (select id from target_activity);
