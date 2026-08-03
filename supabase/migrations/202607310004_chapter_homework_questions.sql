begin;

create table if not exists public.chapter_homework_questions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null
    references public.chapter_homework_plans(id) on delete cascade,
  language_skill text not null
    check (language_skill in ('listening', 'speaking', 'reading', 'writing')),
  source_bank_question_id uuid
    references public.course_test_questions(id) on delete set null,
  source_bank_version integer
    check (source_bank_version is null or source_bank_version > 0),
  question_type text not null
    check (
      question_type in (
        'single_choice',
        'short_text',
        'long_text',
        'audio_recording'
      )
    ),
  stimulus_text text not null default ''
    check (char_length(stimulus_text) <= 5000),
  prompt text not null check (char_length(prompt) between 1 and 5000),
  options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array'),
  correct_answer text,
  explanation text not null default ''
    check (char_length(explanation) <= 5000),
  difficulty text not null default 'foundation'
    check (difficulty in ('foundation', 'medium', 'hard', 'expert')),
  source_skill text not null default '',
  points numeric(8,2) not null check (points > 0 and points <= 1000),
  sort_order integer not null check (sort_order between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, language_skill, sort_order)
);

create index if not exists chapter_homework_questions_plan_skill_idx
  on public.chapter_homework_questions (plan_id, language_skill, sort_order);
create index if not exists chapter_homework_questions_source_idx
  on public.chapter_homework_questions (source_bank_question_id)
  where source_bank_question_id is not null;

drop trigger if exists chapter_homework_questions_set_updated_at
  on public.chapter_homework_questions;
create trigger chapter_homework_questions_set_updated_at
before update on public.chapter_homework_questions
for each row execute function private.set_updated_at();

create or replace function private.sync_chapter_homework_questions(
  p_test_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  select plan.id
  into v_plan_id
  from public.chapter_homework_plans as plan
  where plan.test_id = p_test_id;

  if v_plan_id is null then
    return;
  end if;

  -- Listening uses five real chapter-bank questions as audio scripts. The
  -- script is visible to staff, while the student-facing prompt remains short.
  insert into public.chapter_homework_questions (
    plan_id,
    language_skill,
    source_bank_question_id,
    source_bank_version,
    question_type,
    stimulus_text,
    prompt,
    options,
    correct_answer,
    explanation,
    difficulty,
    source_skill,
    points,
    sort_order
  )
  select
    v_plan_id,
    'listening',
    ranked.id,
    ranked.version,
    'single_choice',
    ranked.prompt,
    '听材料后，选择正确答案。',
    ranked.options,
    ranked.options ->> ranked.correct_option,
    ranked.explanation,
    ranked.difficulty,
    ranked.skill,
    5,
    ranked.question_rank
  from (
    select
      question.*,
      row_number() over (
        order by question.sort_order, question.id
      )::integer as question_rank
    from public.course_test_questions as question
    where question.test_id = p_test_id
      and question.status = 'published'
      and question.question_type = 'single_choice'
      and question.is_chapter_test_item
  ) as ranked
  where ranked.question_rank between 1 and 5
  on conflict (plan_id, language_skill, sort_order) do update set
    source_bank_question_id = excluded.source_bank_question_id,
    source_bank_version = excluded.source_bank_version,
    question_type = excluded.question_type,
    stimulus_text = excluded.stimulus_text,
    prompt = excluded.prompt,
    options = excluded.options,
    correct_answer = excluded.correct_answer,
    explanation = excluded.explanation,
    difficulty = excluded.difficulty,
    source_skill = excluded.source_skill,
    points = excluded.points;

  -- Reading uses the next five real chapter-bank questions.
  insert into public.chapter_homework_questions (
    plan_id,
    language_skill,
    source_bank_question_id,
    source_bank_version,
    question_type,
    stimulus_text,
    prompt,
    options,
    correct_answer,
    explanation,
    difficulty,
    source_skill,
    points,
    sort_order
  )
  select
    v_plan_id,
    'reading',
    ranked.id,
    ranked.version,
    'single_choice',
    '',
    ranked.prompt,
    ranked.options,
    ranked.options ->> ranked.correct_option,
    ranked.explanation,
    ranked.difficulty,
    ranked.skill,
    5,
    ranked.question_rank - 5
  from (
    select
      question.*,
      row_number() over (
        order by question.sort_order, question.id
      )::integer as question_rank
    from public.course_test_questions as question
    where question.test_id = p_test_id
      and question.status = 'published'
      and question.question_type = 'single_choice'
      and question.is_chapter_test_item
  ) as ranked
  where ranked.question_rank between 6 and 10
  on conflict (plan_id, language_skill, sort_order) do update set
    source_bank_question_id = excluded.source_bank_question_id,
    source_bank_version = excluded.source_bank_version,
    question_type = excluded.question_type,
    stimulus_text = excluded.stimulus_text,
    prompt = excluded.prompt,
    options = excluded.options,
    correct_answer = excluded.correct_answer,
    explanation = excluded.explanation,
    difficulty = excluded.difficulty,
    source_skill = excluded.source_skill,
    points = excluded.points;

  -- Speaking and writing are genuine open-response homework items and follow
  -- the chapter-specific requirements maintained by the plan editor.
  insert into public.chapter_homework_questions (
    plan_id,
    language_skill,
    question_type,
    stimulus_text,
    prompt,
    options,
    correct_answer,
    explanation,
    difficulty,
    source_skill,
    points,
    sort_order
  )
  select
    setting.plan_id,
    setting.language_skill,
    case
      when setting.language_skill = 'speaking' then 'audio_recording'
      else 'long_text'
    end,
    '',
    setting.instructions,
    '[]'::jsonb,
    null,
    case
      when setting.language_skill = 'speaking' then
        '按章节要求完成录音，由教师结合发音、流利度、准确度和完整度评分。'
      else
        '按章节要求完成写作，由教师结合内容、语法、词汇和连贯性评分。'
    end,
    'foundation',
    setting.language_skill,
    25,
    1
  from public.chapter_homework_skill_settings as setting
  where setting.plan_id = v_plan_id
    and setting.language_skill in ('speaking', 'writing')
    and btrim(setting.instructions) <> ''
  on conflict (plan_id, language_skill, sort_order) do update set
    question_type = excluded.question_type,
    prompt = excluded.prompt,
    explanation = excluded.explanation,
    points = excluded.points;
end;
$$;

revoke all on function private.sync_chapter_homework_questions(uuid)
  from public;
grant execute on function private.sync_chapter_homework_questions(uuid)
  to service_role;

create or replace function private.sync_homework_questions_after_bank_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_chapter_homework_questions(
    case when tg_op = 'DELETE' then old.test_id else new.test_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists course_test_questions_sync_homework
  on public.course_test_questions;
create trigger course_test_questions_sync_homework
after insert or update or delete on public.course_test_questions
for each row execute function private.sync_homework_questions_after_bank_change();

create or replace function private.sync_homework_questions_after_setting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_id uuid;
begin
  select plan.test_id
  into v_test_id
  from public.chapter_homework_plans as plan
  where plan.id = new.plan_id;

  perform private.sync_chapter_homework_questions(v_test_id);
  return new;
end;
$$;

drop trigger if exists chapter_homework_settings_sync_questions
  on public.chapter_homework_skill_settings;
create trigger chapter_homework_settings_sync_questions
after insert or update on public.chapter_homework_skill_settings
for each row execute function private.sync_homework_questions_after_setting_change();

select private.sync_chapter_homework_questions(test.id)
from public.course_tests as test
join public.chapter_homework_plans as plan on plan.test_id = test.id;

alter table public.chapter_homework_questions enable row level security;

drop policy if exists "chapter homework questions are readable by authorized staff"
  on public.chapter_homework_questions;
create policy "chapter homework questions are readable by authorized staff"
on public.chapter_homework_questions for select to authenticated
using (
  exists (
    select 1
    from public.chapter_homework_plans as plan
    where plan.id = plan_id
      and (
        public.current_user_can_manage_assessment_papers()
        or (
          plan.status = 'published'
          and public.current_user_can_publish_assessment_papers()
        )
      )
  )
);

drop policy if exists "platform managers maintain chapter homework questions"
  on public.chapter_homework_questions;
create policy "platform managers maintain chapter homework questions"
on public.chapter_homework_questions for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

revoke all on public.chapter_homework_questions from anon, authenticated;
grant select, insert, update, delete
  on public.chapter_homework_questions to authenticated;
grant select, insert, update, delete
  on public.chapter_homework_questions to service_role;

comment on table public.chapter_homework_questions is
  '章节作业中可预览和发布的听力、口语、阅读、写作具体题目。';
comment on column public.chapter_homework_questions.stimulus_text is
  '听力材料或作答前置材料；平台管理端可见。';

commit;
