begin;

-- 用显式联表条件重建听力题，避免旧的五道“把普通题目念出来”的占位题残留。
create or replace function private.replace_chapter_homework_listening(
  p_test_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_count integer;
begin
  delete from public.chapter_homework_questions as question
  using public.chapter_homework_plans as plan
  where question.plan_id = plan.id
    and plan.test_id = p_test_id
    and question.language_skill = 'listening';

  insert into public.chapter_homework_questions (
    plan_id, language_skill, question_type, stimulus_text, prompt, options,
    correct_answer, explanation, difficulty, source_skill, points, sort_order
  )
  select
    plan.id,
    'listening',
    'single_choice',
    secret.transcript_ko,
    coalesce(activity.prompt ->> 'zh-CN', activity.prompt ->> 'ko-KR'),
    activity.options,
    activity.options ->> ((secret.answer_key ->> 'value')::integer),
    coalesce(secret.explanation #>> '{correct,zh-CN}', '根据听力原文判断。'),
    'medium',
    'listening',
    15,
    row_number() over (order by activity.sort_order, activity.id)::integer
  from public.chapter_homework_plans as plan
  join public.digital_textbook_chapters as chapter
    on chapter.chapter_test_id = plan.test_id
  join public.digital_textbook_versions as version
    on version.id = chapter.version_id and version.status = 'published'
  join public.digital_textbooks as textbook
    on textbook.id = version.textbook_id and textbook.status = 'published'
  join public.digital_textbook_modules as module on module.chapter_id = chapter.id
  join public.digital_textbook_nodes as node on node.module_id = module.id
  join public.digital_textbook_activities as activity on activity.node_id = node.id
  join public.digital_textbook_activity_secrets as secret
    on secret.activity_id = activity.id
  where plan.test_id = p_test_id
    and chapter.status = 'published'
    and activity.activity_type = 'listening'
    and secret.answer_key ->> 'kind' = 'index'
    and nullif(btrim(coalesce(secret.transcript_ko, '')), '') is not null;

  get diagnostics v_question_count = row_count;
  if v_question_count < 1 then
    raise exception '本章缺少可用的真实听力活动';
  end if;

  update public.chapter_homework_skill_settings as setting
  set target_question_count = v_question_count,
      target_points = 15,
      response_mode = 'single_choice',
      instructions = '播放本章真实听力材料后完成理解题；界面不直接展示听力原文。'
  from public.chapter_homework_plans as plan
  where setting.plan_id = plan.id
    and plan.test_id = p_test_id
    and setting.language_skill = 'listening';
end;
$$;

delete from public.chapter_homework_questions as question
using public.chapter_homework_plans as plan, public.course_tests as test
where question.plan_id = plan.id
  and plan.test_id = test.id
  and question.language_skill = 'listening'
  and test.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

insert into public.chapter_homework_questions (
  plan_id, language_skill, question_type, stimulus_text, prompt, options,
  correct_answer, explanation, difficulty, source_skill, points, sort_order
)
select
  plan.id,
  'listening',
  'single_choice',
  secret.transcript_ko,
  coalesce(activity.prompt ->> 'zh-CN', activity.prompt ->> 'ko-KR'),
  activity.options,
  activity.options ->> ((secret.answer_key ->> 'value')::integer),
  coalesce(secret.explanation #>> '{correct,zh-CN}', '根据听力原文判断。'),
  'medium',
  'listening',
  15,
  row_number() over (
    partition by plan.id order by activity.sort_order, activity.id
  )::integer
from public.chapter_homework_plans as plan
join public.course_tests as test on test.id = plan.test_id
join public.digital_textbook_chapters as chapter
  on chapter.chapter_test_id = plan.test_id and chapter.status = 'published'
join public.digital_textbook_versions as version
  on version.id = chapter.version_id and version.status = 'published'
join public.digital_textbooks as textbook
  on textbook.id = version.textbook_id and textbook.status = 'published'
join public.digital_textbook_modules as module on module.chapter_id = chapter.id
join public.digital_textbook_nodes as node on node.module_id = module.id
join public.digital_textbook_activities as activity on activity.node_id = node.id
join public.digital_textbook_activity_secrets as secret
  on secret.activity_id = activity.id
where test.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$'
  and activity.activity_type = 'listening'
  and secret.answer_key ->> 'kind' = 'index'
  and nullif(btrim(coalesce(secret.transcript_ko, '')), '') is not null;

update public.chapter_homework_skill_settings as setting
set target_question_count = 1,
    target_points = 15,
    response_mode = 'single_choice',
    instructions = '播放本章真实听力材料后完成理解题；界面不直接展示听力原文。'
from public.chapter_homework_plans as plan
join public.course_tests as test on test.id = plan.test_id
where setting.plan_id = plan.id
  and setting.language_skill = 'listening'
  and test.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

commit;
