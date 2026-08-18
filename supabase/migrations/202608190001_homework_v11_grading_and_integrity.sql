begin;

-- 标记可以由数据库自动判定的客观题。平台卷和学生任务都保留快照字段，
-- 避免以后题型规则变化影响已经发布的作业。
alter table public.assessment_paper_questions
  add column if not exists auto_graded boolean not null default false;

alter table public.learning_assignment_questions
  add column if not exists auto_graded boolean not null default false;

create or replace function private.set_assignment_question_grading_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.auto_graded := (
    new.question_type = 'single_choice'
    or (
      new.question_type = 'short_text'
      and coalesce(new.skill, '') = 'vocabulary'
    )
  );
  return new;
end;
$$;

drop trigger if exists assessment_paper_questions_set_grading_mode
  on public.assessment_paper_questions;
create trigger assessment_paper_questions_set_grading_mode
before insert or update of question_type, skill
on public.assessment_paper_questions
for each row execute function private.set_assignment_question_grading_mode();

create or replace function private.set_learning_question_grading_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.auto_graded := (
    new.question_type = 'single_choice'
    or (
      new.question_type = 'short_text'
      and coalesce(new.language_skill, '') = 'vocabulary'
    )
  );
  return new;
end;
$$;

drop trigger if exists learning_assignment_questions_set_grading_mode
  on public.learning_assignment_questions;
create trigger learning_assignment_questions_set_grading_mode
before insert or update of question_type, language_skill
on public.learning_assignment_questions
for each row execute function private.set_learning_question_grading_mode();

update public.assessment_paper_questions
set auto_graded = (
  question_type = 'single_choice'
  or (question_type = 'short_text' and skill = 'vocabulary')
);

update public.learning_assignment_questions
set auto_graded = (
  question_type = 'single_choice'
  or (question_type = 'short_text' and language_skill = 'vocabulary')
);

create or replace function private.normalize_assignment_answer(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(
    regexp_replace(
      btrim(coalesce(p_value, '')),
      '[[:space:]。．.!！?？,，;；:''"“”‘’()（）\[\]{}]+',
      '',
      'g'
    )
  );
$$;

-- 同一个触发器同时完成两件事：
-- 1. 对平台标记的客观题写入自动得分；
-- 2. 口语题必须引用当前学生为当前题上传的真实私有录音，并原子消费证据。
create or replace function private.prepare_learning_submission_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.learning_assignment_questions%rowtype;
  v_submission public.learning_submissions%rowtype;
  v_key public.learning_assignment_question_keys%rowtype;
  v_evidence_id uuid;
  v_evidence public.learning_assignment_recording_evidence%rowtype;
begin
  select * into v_question
  from public.learning_assignment_questions
  where id = new.question_id and tenant_id = new.tenant_id;
  select * into v_submission
  from public.learning_submissions
  where id = new.submission_id and tenant_id = new.tenant_id;
  if v_question.id is null or v_submission.id is null
    or v_question.assignment_id <> v_submission.assignment_id then
    raise exception '答案与任务题目不匹配';
  end if;

  if v_question.question_type = 'audio_recording' then
    begin
      v_evidence_id := btrim(new.answer_text)::uuid;
    exception when others then
      raise exception '口语录音编号不正确，请重新录制';
    end;
    select * into v_evidence
    from public.learning_assignment_recording_evidence
    where id = v_evidence_id
    for update;
    if v_evidence.id is null
      or v_evidence.tenant_id <> new.tenant_id
      or v_evidence.student_id <> v_submission.student_id
      or v_evidence.assignment_id <> v_submission.assignment_id
      or v_evidence.question_id <> v_question.id
      or v_evidence.consumed_submission_id is not null
      or v_evidence.created_at < now() - interval '7 days' then
      raise exception '口语录音与本题不匹配或已经失效，请重新录制';
    end if;
    update public.learning_assignment_recording_evidence
    set consumed_submission_id = v_submission.id,
        consumed_at = now()
    where id = v_evidence.id;
  end if;

  if v_question.auto_graded then
    select * into v_key
    from public.learning_assignment_question_keys
    where question_id = v_question.id and tenant_id = new.tenant_id;
    if nullif(btrim(coalesce(v_key.correct_answer, '')), '') is null then
      raise exception '客观题缺少判定答案，请联系老师';
    end if;
    new.awarded_points := case
      when private.normalize_assignment_answer(new.answer_text)
        = private.normalize_assignment_answer(v_key.correct_answer)
      then v_question.points
      else 0
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_submission_answers_prepare
  on public.learning_submission_answers;
create trigger learning_submission_answers_prepare
before insert on public.learning_submission_answers
for each row execute function private.prepare_learning_submission_answer();

-- 用互动教材里的真实听力活动替换第一版误用的普通章节题。
create or replace function private.replace_chapter_homework_listening(
  p_test_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_question_count integer;
begin
  select id into v_plan_id
  from public.chapter_homework_plans where test_id = p_test_id;
  if v_plan_id is null then return; end if;

  delete from public.chapter_homework_questions
  where plan_id = v_plan_id and language_skill = 'listening';

  insert into public.chapter_homework_questions (
    plan_id, language_skill, question_type, stimulus_text, prompt, options,
    correct_answer, explanation, difficulty, source_skill, points, sort_order
  )
  select
    v_plan_id,
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
  from public.digital_textbook_activities as activity
  join public.digital_textbook_nodes as node on node.id = activity.node_id
  join public.digital_textbook_modules as module on module.id = node.module_id
  join public.digital_textbook_chapters as chapter on chapter.id = module.chapter_id
  join public.digital_textbook_activity_secrets as secret
    on secret.activity_id = activity.id
  where chapter.chapter_test_id = p_test_id
    and activity.activity_type = 'listening'
    and secret.answer_key ->> 'kind' = 'index'
    and nullif(btrim(coalesce(secret.transcript_ko, '')), '') is not null;

  get diagnostics v_question_count = row_count;
  update public.chapter_homework_skill_settings
  set target_question_count = v_question_count,
      target_points = 15,
      response_mode = 'single_choice',
      instructions = '播放本章真实听力材料后完成理解题；界面不直接展示听力原文。'
  where plan_id = v_plan_id and language_skill = 'listening';
end;
$$;

-- 保留第一版同步逻辑，并在每次同步结束后强制替换为真实听力活动。
alter function private.sync_chapter_homework_six_skills(uuid)
  rename to sync_chapter_homework_six_skills_v1;

create function private.sync_chapter_homework_six_skills(p_test_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_chapter_homework_six_skills_v1(p_test_id);
  perform private.replace_chapter_homework_listening(p_test_id);
end;
$$;

-- 新发布入口把“创建任务 + 设置章节完成后开放”包在同一事务中；任一步失败，
-- 整个任务都会回滚，不再产生半配置的已发布任务。
create or replace function public.create_learning_assignment_from_paper_with_unlock(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text,
  p_unlock_after_chapter_completion boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment_id uuid;
begin
  v_assignment_id := public.create_learning_assignment_from_paper(
    p_paper_id,
    p_course_id,
    p_target_scope,
    p_target_ids,
    p_starts_at,
    p_due_at,
    p_institution_note
  );
  perform public.configure_assignment_chapter_unlock(
    v_assignment_id,
    coalesce(p_unlock_after_chapter_completion, false)
  );
  return v_assignment_id;
end;
$$;

revoke all on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean
) from public, anon;
grant execute on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean
) to authenticated;

-- 现有 1—16 章草稿立即改用真实听力活动；已发布的学生任务保持原快照。
select private.replace_chapter_homework_listening(test.id)
from public.course_tests as test
where test.slug ~ '^korean-level-one-(0[1-9]|1[0-6])$';

comment on column public.learning_assignment_questions.auto_graded is
  '发布时冻结的客观题自动判分标记。';
comment on function public.create_learning_assignment_from_paper_with_unlock(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text, boolean
) is '原子创建标准卷任务并配置章节完成后开放规则。';

commit;
