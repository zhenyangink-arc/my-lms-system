begin;

-- The counter row is already the serialized, per-student/per-assignment attempt
-- allocator. Keep the open attempt's immutable server timestamp on that same
-- locked row, and snapshot it onto the committed submission.
alter table public.learning_assignment_submission_counters
  add column if not exists current_attempt_started_at timestamptz;

alter table public.learning_submissions
  add column if not exists attempt_started_at timestamptz,
  add column if not exists submission_intent text not null default 'complete',
  add column if not exists unanswered_count integer not null default 0;

alter table public.learning_submissions
  drop constraint if exists learning_submissions_submission_intent_check,
  add constraint learning_submissions_submission_intent_check check (
    submission_intent in ('complete', 'confirmed_incomplete', 'time_expired')
  ),
  drop constraint if exists learning_submissions_unanswered_count_check,
  add constraint learning_submissions_unanswered_count_check check (
    unanswered_count >= 0
  );

-- An unanswered question is represented by an answer snapshot with an empty
-- string so every submission still has exactly one immutable row per question.
alter table public.learning_submission_answers
  drop constraint if exists learning_submission_answers_answer_text_check,
  add constraint learning_submission_answers_answer_text_check check (
    char_length(answer_text) between 0 and 10000
  );

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

  new.answer_text := btrim(coalesce(new.answer_text, ''));
  if new.answer_text = '' then
    new.awarded_points := 0;
    return new;
  end if;

  if v_question.question_type = 'audio_recording' then
    begin
      v_evidence_id := new.answer_text::uuid;
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

-- Read-only resume metadata. It never creates or changes an attempt.
create or replace function public.current_user_learning_assignment_attempt(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
  v_started_at timestamptz;
  v_effective_due_at timestamptz;
  v_expires_at timestamptz;
begin
  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.tenant_id = private.current_tenant_id()
    and assignment.assignment_type = 'exam'
    and public.current_user_can_view_learning_assignment(assignment.id);
  if v_assignment.id is null then
    return null;
  end if;

  select counter.current_attempt_started_at into v_started_at
  from public.learning_assignment_submission_counters as counter
  where counter.tenant_id = v_assignment.tenant_id
    and counter.assignment_id = v_assignment.id
    and counter.student_id = (select auth.uid());
  if v_started_at is null then
    return null;
  end if;

  select assignment_window.effective_due_at into v_effective_due_at
  from public.current_user_assignment_window(p_assignment_id)
    as assignment_window
  limit 1;
  v_expires_at := least(
    v_started_at + make_interval(mins => v_assignment.duration_minutes),
    v_effective_due_at
  );
  return jsonb_build_object(
    'startedAt', v_started_at,
    'expiresAt', v_expires_at,
    'serverNow', now()
  );
end;
$$;

revoke all on function public.current_user_learning_assignment_attempt(uuid)
  from public, anon;
grant execute on function public.current_user_learning_assignment_attempt(uuid)
  to authenticated;

-- Starts the next exam attempt exactly once. The timestamp is generated by the
-- database, protected by the same row lock used by final submission, and can
-- neither be supplied nor replaced by the client.
create or replace function public.start_learning_assignment_attempt(
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_student_id uuid := auth.uid();
  v_assignment public.learning_assignments%rowtype;
  v_attempt integer;
  v_started_at timestamptz;
  v_effective_due_at timestamptz;
  v_expires_at timestamptz;
  v_idempotent boolean := true;
begin
  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.tenant_id = v_tenant_id
  for key share;
  if v_assignment.id is null
    or v_assignment.assignment_type <> 'exam'
    or v_assignment.duration_minutes is null
    or v_student_id is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account()
    or not public.current_user_can_view_learning_assignment_questions(
      p_assignment_id
    ) then
    raise exception '当前账号不能开始这场考试';
  end if;

  insert into public.learning_assignment_submission_counters (
    tenant_id, assignment_id, student_id, attempt_count
  )
  select v_tenant_id, p_assignment_id, v_student_id,
    coalesce(max(submission.attempt_number), 0)
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
  on conflict (tenant_id, assignment_id, student_id) do nothing;

  select counter.attempt_count, counter.current_attempt_started_at
  into v_attempt, v_started_at
  from public.learning_assignment_submission_counters as counter
  where counter.tenant_id = v_tenant_id
    and counter.assignment_id = p_assignment_id
    and counter.student_id = v_student_id
  for update;

  if v_started_at is null then
    if v_assignment.status <> 'published'
      or v_assignment.starts_at > now()
      or not public.current_user_can_submit_learning_assignment(p_assignment_id)
      or v_attempt >= v_assignment.max_attempts then
      raise exception '考试尚未开放、已经截止或作答次数已用完';
    end if;
    v_started_at := now();
    v_idempotent := false;
    update public.learning_assignment_submission_counters
    set current_attempt_started_at = v_started_at,
        updated_at = now()
    where tenant_id = v_tenant_id
      and assignment_id = p_assignment_id
      and student_id = v_student_id;

    insert into public.learning_assignment_progress (
      tenant_id, assignment_id, student_id, progress_state,
      latest_submission_id, attempts_used, updated_at
    ) values (
      v_tenant_id, p_assignment_id, v_student_id, 'in_progress',
      null, v_attempt, now()
    )
    on conflict (tenant_id, assignment_id, student_id) do update
    set progress_state = 'in_progress',
        latest_submission_id = null,
        attempts_used = excluded.attempts_used,
        updated_at = now();
  end if;

  select assignment_window.effective_due_at into v_effective_due_at
  from public.current_user_assignment_window(p_assignment_id)
    as assignment_window
  limit 1;
  v_expires_at := least(
    v_started_at + make_interval(mins => v_assignment.duration_minutes),
    v_effective_due_at
  );
  return jsonb_build_object(
    'startedAt', v_started_at,
    'expiresAt', v_expires_at,
    'serverNow', now(),
    'idempotent', v_idempotent
  );
end;
$$;

revoke all on function public.start_learning_assignment_attempt(uuid)
  from public, anon;
grant execute on function public.start_learning_assignment_attempt(uuid)
  to authenticated;

drop function if exists public.submit_learning_assignment(uuid, jsonb, uuid);
drop function if exists public.submit_learning_assignment(uuid, jsonb, uuid, text);

create function public.submit_learning_assignment(
  p_assignment_id uuid,
  p_answers jsonb,
  p_request_id uuid,
  p_submission_intent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_student_id uuid := auth.uid();
  v_assignment public.learning_assignments%rowtype;
  v_existing public.learning_submissions%rowtype;
  v_submission_id uuid;
  v_attempt integer;
  v_attempt_started_at timestamptz;
  v_effective_due_at timestamptz;
  v_authoritative_deadline timestamptz;
  v_minimum_engagement interval;
  v_payload_hash text;
  v_answer jsonb;
  v_question_id uuid;
  v_answer_text text;
  v_question_type text;
  v_options jsonb;
  v_question_count integer;
  v_answer_count integer;
  v_answered_count integer;
  v_unanswered_count integer;
  v_manual_count integer;
  v_objective_score numeric(8,2);
  v_submission_state text;
begin
  if p_request_id is null then
    raise exception '提交请求编号不正确';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception '答案格式不正确';
  end if;
  if p_submission_intent not in (
    'complete', 'confirmed_incomplete', 'time_expired'
  ) then
    raise exception '提交方式不正确';
  end if;
  v_payload_hash := md5(jsonb_build_object(
    'answers', p_answers, 'intent', p_submission_intent
  )::text);

  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.tenant_id = v_tenant_id
  for key share;
  if v_assignment.id is null
    or v_student_id is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account() then
    raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
  end if;

  insert into public.learning_assignment_submission_counters (
    tenant_id, assignment_id, student_id, attempt_count
  )
  select v_tenant_id, p_assignment_id, v_student_id,
    coalesce(max(submission.attempt_number), 0)
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
  on conflict (tenant_id, assignment_id, student_id) do nothing;

  select counter.attempt_count, counter.current_attempt_started_at
  into v_attempt, v_attempt_started_at
  from public.learning_assignment_submission_counters as counter
  where counter.tenant_id = v_tenant_id
    and counter.assignment_id = p_assignment_id
    and counter.student_id = v_student_id
  for update;

  select submission.* into v_existing
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
    and submission.request_id = p_request_id;
  if v_existing.id is not null then
    if v_existing.request_payload_hash <> v_payload_hash then
      raise exception '同一提交请求编号不能用于不同答案';
    end if;
    return jsonb_build_object(
      'submissionId', v_existing.id,
      'attemptNumber', v_existing.attempt_number,
      'workflowState', v_existing.submission_state,
      'idempotent', true
    );
  end if;

  if not public.current_user_can_view_learning_assignment(p_assignment_id)
    or v_assignment.status <> 'published'
    or v_assignment.starts_at > now() then
    raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
  end if;
  if v_attempt >= v_assignment.max_attempts then
    raise exception '已达到本任务允许的提交次数';
  end if;
  if v_attempt > 0 and not v_assignment.allow_resubmission and not exists (
    select 1 from public.learning_submissions as submission
    where submission.tenant_id = v_tenant_id
      and submission.assignment_id = p_assignment_id
      and submission.student_id = v_student_id
      and submission.status = 'revision_required'
  ) then
    raise exception '该任务不允许重复提交';
  end if;

  select assignment_window.effective_due_at into v_effective_due_at
  from public.current_user_assignment_window(p_assignment_id)
    as assignment_window
  limit 1;

  select count(*) into v_question_count
  from public.learning_assignment_questions as question
  where question.tenant_id = v_tenant_id
    and question.assignment_id = p_assignment_id;
  select
    count(distinct value->>'questionId'),
    count(*) filter (where btrim(coalesce(value->>'answer', '')) <> '')
  into v_answer_count, v_answered_count
  from jsonb_array_elements(p_answers) as value;
  if v_question_count = 0
    or v_answer_count <> v_question_count
    or jsonb_array_length(p_answers) <> v_question_count then
    raise exception '答案必须与本任务题目一一对应';
  end if;
  v_unanswered_count := v_question_count - v_answered_count;

  if v_assignment.assignment_type = 'exam' then
    if v_assignment.duration_minutes is null
      or v_attempt_started_at is null then
      raise exception '请先通过考试说明页开始作答';
    end if;
    v_authoritative_deadline := least(
      v_attempt_started_at
        + make_interval(mins => v_assignment.duration_minutes),
      v_effective_due_at
    );
    if p_submission_intent = 'time_expired' then
      if now() < v_authoritative_deadline
        or now() > v_authoritative_deadline + interval '5 minutes' then
        raise exception '自动交卷只允许在服务端计时结束后的五分钟内执行';
      end if;
    elsif now() > v_authoritative_deadline then
      raise exception '考试计时已经结束，请使用到期自动交卷';
    elsif v_effective_due_at < now() and not v_assignment.allow_late_submission then
      raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
    end if;

    if v_unanswered_count > 0 then
      if p_submission_intent = 'confirmed_incomplete' then
        v_minimum_engagement := least(
          interval '5 minutes',
          greatest(
            interval '1 minute',
            make_interval(secs => v_assignment.duration_minutes * 6)
          )
        );
        if v_answered_count = 0
          or now() < v_attempt_started_at + v_minimum_engagement
          or now() >= v_authoritative_deadline then
          raise exception '未答确认提交需要至少完成一题并达到最短有效作答时间';
        end if;
      elsif p_submission_intent <> 'time_expired' then
        raise exception '存在未答题，请确认未答提交或等待系统到期交卷';
      end if;
    end if;
  else
    if v_unanswered_count > 0 then
      raise exception '请完成全部题目后再提交';
    end if;
    if not (
      v_assignment.allow_late_submission
      or (not v_assignment.unlock_after_chapter_completion
        and v_assignment.due_at >= now())
      or (v_effective_due_at is not null and v_effective_due_at >= now())
    ) then
      raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
    end if;
    p_submission_intent := 'complete';
  end if;
  if v_unanswered_count = 0 and p_submission_intent <> 'time_expired' then
    p_submission_intent := 'complete';
  end if;
  v_attempt := v_attempt + 1;

  insert into public.learning_submissions (
    tenant_id, assignment_id, student_id, attempt_number, status,
    request_id, request_payload_hash, submission_state, submitted_at,
    attempt_started_at, submission_intent, unanswered_count
  ) values (
    v_tenant_id, p_assignment_id, v_student_id, v_attempt, 'submitted',
    p_request_id, v_payload_hash, 'submitted_pending_grading', now(),
    v_attempt_started_at, p_submission_intent, v_unanswered_count
  ) returning id into v_submission_id;

  for v_answer in select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_question_id := (v_answer->>'questionId')::uuid;
    exception when others then
      raise exception '答案中包含无效题目';
    end;
    v_answer_text := btrim(coalesce(v_answer->>'answer', ''));
    if char_length(v_answer_text) > 10000 then
      raise exception '单题答案不能超过 10000 个字';
    end if;
    select question.question_type, question.options
    into v_question_type, v_options
    from public.learning_assignment_questions as question
    where question.id = v_question_id
      and question.assignment_id = p_assignment_id
      and question.tenant_id = v_tenant_id;
    if not found then
      raise exception '答案中包含不属于本任务的题目';
    end if;
    if v_answer_text <> '' and v_question_type = 'single_choice'
      and not exists (
        select 1 from jsonb_array_elements_text(v_options) as option
        where option = v_answer_text
      ) then
      raise exception '选择题答案不在有效选项中';
    end if;
    if v_answer_text <> '' and v_question_type = 'file_link'
      and v_answer_text !~* '^https?://[^[:space:]]+$' then
      raise exception '附件链接需要使用完整的 http 或 https 地址';
    end if;
    insert into public.learning_submission_answers (
      tenant_id, submission_id, question_id, answer_text
    ) values (
      v_tenant_id, v_submission_id, v_question_id, v_answer_text
    );
  end loop;

  select
    count(*) filter (
      where not question.auto_graded and answer.answer_text <> ''
    ),
    coalesce(sum(answer.awarded_points), 0)
  into v_manual_count, v_objective_score
  from public.learning_submission_answers as answer
  join public.learning_assignment_questions as question
    on question.tenant_id = answer.tenant_id
   and question.id = answer.question_id
  where answer.tenant_id = v_tenant_id
    and answer.submission_id = v_submission_id;

  if v_manual_count > 0 then
    v_submission_state := 'objective_graded_pending_manual';
    update public.learning_submissions
    set submission_state = v_submission_state,
        objective_graded_at = now(), updated_at = now()
    where tenant_id = v_tenant_id and id = v_submission_id;
  else
    v_submission_state := case
      when v_assignment.grade_release_at is null
        or v_assignment.grade_release_at <= now()
      then 'grade_released' else 'grading_completed' end;
    update public.learning_submissions
    set status = case when v_submission_state = 'grade_released'
          then 'graded' else 'submitted' end,
        score = case when v_submission_state = 'grade_released'
          then v_objective_score else null end,
        computed_score = v_objective_score,
        submission_state = v_submission_state,
        objective_graded_at = now(), grading_completed_at = now(),
        grade_released_at = case when v_submission_state = 'grade_released'
          then now() else null end,
        graded_at = now(), updated_at = now()
    where tenant_id = v_tenant_id and id = v_submission_id;
  end if;

  update public.learning_assignment_submission_counters
  set attempt_count = v_attempt,
      current_attempt_started_at = null,
      updated_at = now()
  where tenant_id = v_tenant_id
    and assignment_id = p_assignment_id
    and student_id = v_student_id;

  return jsonb_build_object(
    'submissionId', v_submission_id,
    'attemptNumber', v_attempt,
    'workflowState', v_submission_state,
    'idempotent', false
  );
end;
$$;

revoke all on function public.submit_learning_assignment(
  uuid, jsonb, uuid, text
) from public, anon;
grant execute on function public.submit_learning_assignment(
  uuid, jsonb, uuid, text
) to authenticated;

comment on column public.learning_assignment_submission_counters.current_attempt_started_at is
  'Immutable server start time for the currently open attempt; cleared only after commit.';
comment on column public.learning_submissions.attempt_started_at is
  'Server-authoritative start-time snapshot for this committed attempt.';
comment on column public.learning_submissions.submission_intent is
  'complete, explicit confirmed_incomplete, or server-deadline time_expired.';
comment on column public.learning_submissions.unanswered_count is
  'Number of empty answer snapshots accepted under the exam submission contract.';

commit;
