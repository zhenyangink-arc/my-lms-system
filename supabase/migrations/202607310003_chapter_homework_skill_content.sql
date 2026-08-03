begin;

-- Keep the plan total aligned with the four default skill durations.
update public.chapter_homework_plans as plan
set duration_minutes = skill_totals.duration_minutes
from (
  select
    plan_id,
    sum(duration_minutes)::integer as duration_minutes
  from public.chapter_homework_skill_settings
  where enabled
  group by plan_id
) as skill_totals
where plan.id = skill_totals.plan_id
  and plan.duration_minutes = 30
  and skill_totals.duration_minutes between 1 and 600;

-- Give every existing chapter a concrete, chapter-aware requirement for each
-- of listening, speaking, reading and writing. Existing staff-authored text is
-- deliberately preserved.
with chapter_context as (
  select
    plan.id as plan_id,
    test.course_key,
    concat(
      '《',
      test.title,
      case
        when nullif(btrim(test.korean_title), '') is null then ''
        else ' · ' || btrim(test.korean_title)
      end,
      '》'
    ) as topic,
    nullif(btrim(test.description), '') as learning_goal
  from public.chapter_homework_plans as plan
  join public.course_tests as test on test.id = plan.test_id
)
update public.chapter_homework_skill_settings as setting
set instructions = case setting.language_skill
  when 'listening' then
    case
      when context.course_key = 'hangul-introduction' then
        '听辨' || context.topic ||
        '中的核心字母、音节与发音规则；先听后选或听写，并能区分相近音。'
      else
        '听懂围绕' || context.topic ||
        '展开的短对话，捕捉人物、场景、关键信息和本课重点表达。'
    end
  when 'speaking' then
    case
      when context.course_key = 'hangul-introduction' then
        '准确朗读' || context.topic ||
        '中的字母、音节和例词；按提示录音，注意口型、收音和音变。'
      else
        '围绕' || context.topic ||
        '完成情景口语录音，使用本课词汇与语法作答，保证发音清楚、表达完整。'
    end
  when 'reading' then
    case
      when context.course_key = 'hangul-introduction' then
        '阅读并拆分' || context.topic ||
        '中的音节和例词，判断字母组成、收音位置及适用的拼读或音变规则。'
      else
        '阅读与' || context.topic ||
        '相关的短对话或短文，理解主旨、细节、词汇含义和语法功能。'
    end
  when 'writing' then
    case
      when context.course_key = 'hangul-introduction' then
        '根据' || context.topic ||
        '完成字母、音节和例词的规范书写或听写，并写出关键拼读规则。'
      else
        '围绕' || context.topic ||
        '使用本课重点词汇和语法写 4—6 句连贯短文；内容切题、格式完整。'
    end
end ||
case
  when context.learning_goal is null then ''
  else ' 学习重点：' || context.learning_goal
end
from chapter_context as context
where setting.plan_id = context.plan_id
  and btrim(setting.instructions) = '';

-- New course chapters receive the same complete, chapter-aware data without
-- requiring a second backfill.
create or replace function private.ensure_chapter_homework_plan(
  p_test_id uuid,
  p_test_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_course_key text;
  v_topic text;
  v_learning_goal text;
begin
  select
    test.course_key,
    concat(
      '《',
      test.title,
      case
        when nullif(btrim(test.korean_title), '') is null then ''
        else ' · ' || btrim(test.korean_title)
      end,
      '》'
    ),
    nullif(btrim(test.description), '')
  into v_course_key, v_topic, v_learning_goal
  from public.course_tests as test
  where test.id = p_test_id;

  insert into public.chapter_homework_plans (
    test_id,
    title,
    duration_minutes
  )
  values (
    p_test_id,
    left(coalesce(nullif(btrim(p_test_title), ''), '章节') || '作业', 120),
    35
  )
  on conflict (test_id) do nothing;

  select plan.id
  into v_plan_id
  from public.chapter_homework_plans as plan
  where plan.test_id = p_test_id;

  insert into public.chapter_homework_skill_settings (
    plan_id,
    language_skill,
    response_mode,
    target_question_count,
    target_points,
    duration_minutes,
    instructions,
    sort_order
  )
  values
    (
      v_plan_id,
      'listening',
      'mixed',
      5,
      25,
      8,
      case
        when v_course_key = 'hangul-introduction' then
          '听辨' || v_topic || '中的核心字母、音节与发音规则；先听后选或听写，并能区分相近音。'
        else
          '听懂围绕' || v_topic || '展开的短对话，捕捉人物、场景、关键信息和本课重点表达。'
      end ||
      case when v_learning_goal is null then '' else ' 学习重点：' || v_learning_goal end,
      1
    ),
    (
      v_plan_id,
      'speaking',
      'audio_recording',
      1,
      25,
      5,
      case
        when v_course_key = 'hangul-introduction' then
          '准确朗读' || v_topic || '中的字母、音节和例词；按提示录音，注意口型、收音和音变。'
        else
          '围绕' || v_topic || '完成情景口语录音，使用本课词汇与语法作答，保证发音清楚、表达完整。'
      end ||
      case when v_learning_goal is null then '' else ' 学习重点：' || v_learning_goal end,
      2
    ),
    (
      v_plan_id,
      'reading',
      'mixed',
      5,
      25,
      10,
      case
        when v_course_key = 'hangul-introduction' then
          '阅读并拆分' || v_topic || '中的音节和例词，判断字母组成、收音位置及适用的拼读或音变规则。'
        else
          '阅读与' || v_topic || '相关的短对话或短文，理解主旨、细节、词汇含义和语法功能。'
      end ||
      case when v_learning_goal is null then '' else ' 学习重点：' || v_learning_goal end,
      3
    ),
    (
      v_plan_id,
      'writing',
      'long_text',
      1,
      25,
      12,
      case
        when v_course_key = 'hangul-introduction' then
          '根据' || v_topic || '完成字母、音节和例词的规范书写或听写，并写出关键拼读规则。'
        else
          '围绕' || v_topic || '使用本课重点词汇和语法写 4—6 句连贯短文；内容切题、格式完整。'
      end ||
      case when v_learning_goal is null then '' else ' 学习重点：' || v_learning_goal end,
      4
    )
  on conflict (plan_id, language_skill) do nothing;

  return v_plan_id;
end;
$$;

comment on function private.ensure_chapter_homework_plan(uuid, text) is
  '为课程章节建立 35 分钟作业计划，并按章节主题补齐听、说、读、写四项要求。';

commit;
