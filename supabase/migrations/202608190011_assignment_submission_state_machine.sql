begin;

-- A submission keeps the legacy status for existing grade-center consumers,
-- while submission_state records the complete grading/release workflow.
alter table public.learning_submissions
  add column if not exists request_id uuid,
  add column if not exists request_payload_hash text,
  add column if not exists submission_state text,
  add column if not exists computed_score numeric(8,2),
  add column if not exists objective_graded_at timestamptz,
  add column if not exists grading_completed_at timestamptz,
  add column if not exists grade_released_at timestamptz;

alter table public.learning_assignment_drafts
  add column if not exists request_id uuid;

update public.learning_assignment_drafts
set request_id = coalesce(request_id, gen_random_uuid());

alter table public.learning_assignment_drafts
  alter column request_id set default gen_random_uuid(),
  alter column request_id set not null;

update public.learning_submissions as submission
set request_id = coalesce(submission.request_id, gen_random_uuid()),
    request_payload_hash = coalesce(
      submission.request_payload_hash,
      md5(submission.id::text)
    ),
    submission_state = coalesce(
      submission.submission_state,
      case submission.status
        when 'graded' then 'grade_released'
        when 'revision_required' then 'revision_required'
        else 'objective_graded_pending_manual'
      end
    ),
    computed_score = coalesce(submission.computed_score, submission.score),
    objective_graded_at = coalesce(
      submission.objective_graded_at,
      case
        when exists (
          select 1
          from public.learning_submission_answers as answer
          where answer.tenant_id = submission.tenant_id
            and answer.submission_id = submission.id
            and answer.awarded_points is not null
        ) then submission.submitted_at
        else null
      end
    ),
    grading_completed_at = coalesce(
      submission.grading_completed_at,
      case when submission.status = 'graded' then submission.graded_at else null end
    ),
    grade_released_at = coalesce(
      submission.grade_released_at,
      case when submission.status = 'graded'
        then coalesce(submission.graded_at, submission.updated_at)
        else null
      end
    );

alter table public.learning_submissions
  alter column request_id set not null,
  alter column request_payload_hash set not null,
  alter column submission_state set default 'submitted_pending_grading',
  alter column submission_state set not null,
  drop constraint if exists learning_submissions_submission_state_check,
  add constraint learning_submissions_submission_state_check check (
    submission_state in (
      'submitted_pending_grading',
      'objective_graded_pending_manual',
      'grading_completed',
      'grade_released',
      'revision_required'
    )
  ),
  drop constraint if exists learning_submissions_computed_score_check,
  add constraint learning_submissions_computed_score_check check (
    computed_score is null or computed_score >= 0
  ),
  drop constraint if exists learning_submissions_state_timestamps_check,
  add constraint learning_submissions_state_timestamps_check check (
    (submission_state <> 'objective_graded_pending_manual'
      or objective_graded_at is not null)
    and (submission_state not in ('grading_completed', 'grade_released')
      or grading_completed_at is not null)
    and (submission_state <> 'grade_released'
      or grade_released_at is not null)
  );

create unique index if not exists learning_submissions_request_id_key
  on public.learning_submissions (
    tenant_id, assignment_id, student_id, request_id
  );

create index if not exists learning_submissions_student_state_idx
  on public.learning_submissions (
    tenant_id, student_id, submission_state, submitted_at desc
  );

-- This row is the serialization point for attempt allocation. It removes the
-- empty-result race that a SELECT MAX(... FOR UPDATE) cannot lock.
create table if not exists public.learning_assignment_submission_counters (
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  assignment_id uuid not null,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, assignment_id, student_id),
  foreign key (tenant_id, assignment_id)
    references public.learning_assignments(tenant_id, id) on delete cascade
);

insert into public.learning_assignment_submission_counters (
  tenant_id, assignment_id, student_id, attempt_count
)
select
  submission.tenant_id,
  submission.assignment_id,
  submission.student_id,
  max(submission.attempt_number)
from public.learning_submissions as submission
group by submission.tenant_id, submission.assignment_id, submission.student_id
on conflict (tenant_id, assignment_id, student_id) do update
set attempt_count = greatest(
      public.learning_assignment_submission_counters.attempt_count,
      excluded.attempt_count
    ),
    updated_at = now();

alter table public.learning_assignment_submission_counters enable row level security;
alter table public.learning_assignment_submission_counters force row level security;
revoke all on public.learning_assignment_submission_counters
  from public, anon, authenticated;
grant all on public.learning_assignment_submission_counters to service_role;

-- One authoritative row restores a student's task state after refresh. An
-- absent row means not_started; a draft produces in_progress.
create table if not exists public.learning_assignment_progress (
  tenant_id uuid not null
    references public.tenants(id) on delete cascade,
  assignment_id uuid not null,
  student_id uuid not null
    references public.profiles(id) on delete cascade,
  progress_state text not null check (
    progress_state in (
      'in_progress',
      'submitted_pending_grading',
      'objective_graded_pending_manual',
      'grading_completed',
      'grade_released',
      'revision_required'
    )
  ),
  latest_submission_id uuid,
  attempts_used integer not null default 0 check (attempts_used >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, assignment_id, student_id),
  foreign key (tenant_id, assignment_id)
    references public.learning_assignments(tenant_id, id) on delete cascade,
  foreign key (tenant_id, latest_submission_id)
    references public.learning_submissions(tenant_id, id) on delete cascade
);

create index if not exists learning_assignment_progress_student_idx
  on public.learning_assignment_progress (
    tenant_id, student_id, progress_state, updated_at desc
  );

alter table public.learning_assignment_progress enable row level security;
alter table public.learning_assignment_progress force row level security;

drop policy if exists learning_assignment_progress_select
  on public.learning_assignment_progress;
create policy learning_assignment_progress_select
on public.learning_assignment_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    student_id = (select auth.uid())
    or public.current_user_is_assignment_manager()
  )
);

revoke all on public.learning_assignment_progress from public, anon, authenticated;
grant select on public.learning_assignment_progress to authenticated;
grant all on public.learning_assignment_progress to service_role;

create or replace function private.sync_learning_assignment_submission_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest public.learning_submissions%rowtype;
  v_attempts integer;
begin
  select submission.* into v_latest
  from public.learning_submissions as submission
  where submission.tenant_id = new.tenant_id
    and submission.assignment_id = new.assignment_id
    and submission.student_id = new.student_id
  order by submission.attempt_number desc, submission.submitted_at desc,
    submission.id desc
  limit 1;

  select coalesce(max(submission.attempt_number), 0) into v_attempts
  from public.learning_submissions as submission
  where submission.tenant_id = new.tenant_id
    and submission.assignment_id = new.assignment_id
    and submission.student_id = new.student_id;

  insert into public.learning_assignment_progress (
    tenant_id, assignment_id, student_id, progress_state,
    latest_submission_id, attempts_used, updated_at
  ) values (
    new.tenant_id, new.assignment_id, new.student_id,
    v_latest.submission_state, v_latest.id, v_attempts, now()
  )
  on conflict (tenant_id, assignment_id, student_id) do update
  set progress_state = excluded.progress_state,
      latest_submission_id = excluded.latest_submission_id,
      attempts_used = excluded.attempts_used,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists learning_submissions_sync_progress
  on public.learning_submissions;
create trigger learning_submissions_sync_progress
after insert or update of submission_state
on public.learning_submissions
for each row execute function private.sync_learning_assignment_submission_progress();

create or replace function private.sync_learning_assignment_draft_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  select coalesce(max(submission.attempt_number), 0) into v_attempts
  from public.learning_submissions as submission
  where submission.tenant_id = new.tenant_id
    and submission.assignment_id = new.assignment_id
    and submission.student_id = new.student_id;

  insert into public.learning_assignment_progress (
    tenant_id, assignment_id, student_id, progress_state,
    latest_submission_id, attempts_used, updated_at
  ) values (
    new.tenant_id, new.assignment_id, new.student_id, 'in_progress',
    null, v_attempts, new.updated_at
  )
  on conflict (tenant_id, assignment_id, student_id) do update
  set progress_state = 'in_progress',
      latest_submission_id = null,
      attempts_used = excluded.attempts_used,
      updated_at = excluded.updated_at;
  return new;
end;
$$;

drop trigger if exists learning_assignment_drafts_sync_progress
  on public.learning_assignment_drafts;
create trigger learning_assignment_drafts_sync_progress
after insert or update of answers, active_step, updated_at
on public.learning_assignment_drafts
for each row execute function private.sync_learning_assignment_draft_progress();

-- Backfill the authoritative progress snapshot after both sync functions exist.
insert into public.learning_assignment_progress (
  tenant_id, assignment_id, student_id, progress_state,
  latest_submission_id, attempts_used, updated_at
)
select distinct on (
  submission.tenant_id, submission.assignment_id, submission.student_id
)
  submission.tenant_id,
  submission.assignment_id,
  submission.student_id,
  submission.submission_state,
  submission.id,
  max(submission.attempt_number) over (
    partition by submission.tenant_id, submission.assignment_id,
      submission.student_id
  ),
  submission.updated_at
from public.learning_submissions as submission
order by submission.tenant_id, submission.assignment_id,
  submission.student_id, submission.attempt_number desc,
  submission.submitted_at desc, submission.id desc
on conflict (tenant_id, assignment_id, student_id) do update
set progress_state = excluded.progress_state,
    latest_submission_id = excluded.latest_submission_id,
    attempts_used = excluded.attempts_used,
    updated_at = excluded.updated_at;

insert into public.learning_assignment_progress (
  tenant_id, assignment_id, student_id, progress_state,
  latest_submission_id, attempts_used, updated_at
)
select
  draft.tenant_id,
  draft.assignment_id,
  draft.student_id,
  'in_progress',
  null,
  coalesce(counter.attempt_count, 0),
  draft.updated_at
from public.learning_assignment_drafts as draft
left join public.learning_assignment_submission_counters as counter
  on counter.tenant_id = draft.tenant_id
 and counter.assignment_id = draft.assignment_id
 and counter.student_id = draft.student_id
on conflict (tenant_id, assignment_id, student_id) do update
set progress_state = 'in_progress',
    latest_submission_id = null,
    attempts_used = excluded.attempts_used,
    updated_at = excluded.updated_at
where public.learning_assignment_progress.updated_at <= excluded.updated_at;

-- The UI may use this helper for availability, but correctness is enforced
-- again while the counter row is locked inside submit_learning_assignment.
create or replace function public.current_user_can_submit_learning_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and exists (
      select 1
      from public.learning_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.tenant_id = private.current_tenant_id()
        and assignment.status = 'published'
        and (assignment.starts_at is null or assignment.starts_at <= now())
        and (
          assignment.allow_late_submission
          or (
            not assignment.unlock_after_chapter_completion
            and assignment.due_at >= now()
          )
          or exists (
            select 1
            from public.course_ebook_progress as progress
            where progress.tenant_id = assignment.tenant_id
              and progress.student_id = (select auth.uid())
              and progress.student_app_id = assignment.student_app_id
              and progress.test_slug = assignment.unlock_test_slug
              and progress.completed_at is not null
              and coalesce(
                case when assignment.due_days_after_unlock is not null
                  then progress.completed_at
                    + make_interval(days => assignment.due_days_after_unlock)
                  else null end,
                assignment.due_at
              ) >= now()
          )
        )
        and coalesce(
          (
            select counter.attempt_count
            from public.learning_assignment_submission_counters as counter
            where counter.tenant_id = assignment.tenant_id
              and counter.assignment_id = assignment.id
              and counter.student_id = (select auth.uid())
          ),
          0
        ) < assignment.max_attempts
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

drop function if exists public.save_learning_assignment_draft(
  uuid, jsonb, integer
);
drop function if exists public.save_learning_assignment_draft(
  uuid, jsonb, integer, uuid
);

create function public.save_learning_assignment_draft(
  p_assignment_id uuid,
  p_answers jsonb,
  p_active_step integer,
  p_request_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_student_id uuid := auth.uid();
  v_saved_at timestamptz;
  v_item record;
  v_question_id uuid;
begin
  if v_student_id is null
    or p_request_id is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account()
    or not public.current_user_can_view_learning_assignment_questions(
      p_assignment_id
    )
  then
    raise exception '当前账号不能保存这份作业草稿';
  end if;

  insert into public.learning_assignment_submission_counters (
    tenant_id, assignment_id, student_id, attempt_count
  )
  select
    v_tenant_id,
    p_assignment_id,
    v_student_id,
    coalesce(max(submission.attempt_number), 0)
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
  on conflict (tenant_id, assignment_id, student_id) do nothing;

  perform counter.attempt_count
  from public.learning_assignment_submission_counters as counter
  where counter.tenant_id = v_tenant_id
    and counter.assignment_id = p_assignment_id
    and counter.student_id = v_student_id
  for update;

  -- A delayed autosave from the form that just committed must not recreate
  -- the cleared draft or move authoritative progress back to in_progress.
  select submission.submitted_at into v_saved_at
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
    and submission.request_id = p_request_id;
  if found then
    return v_saved_at;
  end if;

  if not public.current_user_can_submit_learning_assignment(p_assignment_id)
  then
    raise exception '这份任务当前不能继续保存草稿';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
    or (select count(*) from jsonb_object_keys(p_answers)) > 100 then
    raise exception '草稿答案格式不正确';
  end if;
  if coalesce(p_active_step, -1) not between 0 and 10 then
    raise exception '草稿步骤不正确';
  end if;

  for v_item in select key, value from jsonb_each(p_answers)
  loop
    begin
      v_question_id := v_item.key::uuid;
    exception when others then
      raise exception '草稿中包含无效题目';
    end;
    if jsonb_typeof(v_item.value) <> 'string'
      or char_length(v_item.value #>> '{}') > 10000
      or not exists (
        select 1
        from public.learning_assignment_questions as question
        where question.id = v_question_id
          and question.assignment_id = p_assignment_id
          and question.tenant_id = v_tenant_id
      )
    then
      raise exception '草稿中包含无效答案';
    end if;
  end loop;

  insert into public.learning_assignment_drafts (
    tenant_id, assignment_id, student_id, request_id,
    answers, active_step, updated_at
  ) values (
    v_tenant_id, p_assignment_id, v_student_id, p_request_id,
    p_answers, p_active_step, now()
  )
  on conflict (tenant_id, assignment_id, student_id) do update
  set request_id = excluded.request_id,
      answers = excluded.answers,
      active_step = excluded.active_step,
      updated_at = now()
  returning updated_at into v_saved_at;
  return v_saved_at;
end;
$$;

revoke all on function public.save_learning_assignment_draft(
  uuid, jsonb, integer, uuid
) from public, anon;
grant execute on function public.save_learning_assignment_draft(
  uuid, jsonb, integer, uuid
) to authenticated;

drop function if exists public.submit_learning_assignment(uuid, jsonb);
drop function if exists public.submit_learning_assignment(uuid, jsonb, uuid);

create function public.submit_learning_assignment(
  p_assignment_id uuid,
  p_answers jsonb,
  p_request_id uuid
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
  v_payload_hash text;
  v_answer jsonb;
  v_question_id uuid;
  v_answer_text text;
  v_question_type text;
  v_options jsonb;
  v_question_count integer;
  v_answer_count integer;
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
  v_payload_hash := md5(p_answers::text);

  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.tenant_id = v_tenant_id
  for key share;

  if v_assignment.id is null
    or v_student_id is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account()
  then
    raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
  end if;

  insert into public.learning_assignment_submission_counters (
    tenant_id, assignment_id, student_id, attempt_count
  )
  select
    v_tenant_id,
    p_assignment_id,
    v_student_id,
    coalesce(max(submission.attempt_number), 0)
  from public.learning_submissions as submission
  where submission.tenant_id = v_tenant_id
    and submission.assignment_id = p_assignment_id
    and submission.student_id = v_student_id
  on conflict (tenant_id, assignment_id, student_id) do nothing;

  select counter.attempt_count into v_attempt
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
    or (v_assignment.starts_at is not null and v_assignment.starts_at > now())
    or not (
      v_assignment.allow_late_submission
      or (
        not v_assignment.unlock_after_chapter_completion
        and v_assignment.due_at >= now()
      )
      or exists (
        select 1
        from public.course_ebook_progress as progress
        where progress.tenant_id = v_assignment.tenant_id
          and progress.student_id = v_student_id
          and progress.student_app_id = v_assignment.student_app_id
          and progress.test_slug = v_assignment.unlock_test_slug
          and progress.completed_at is not null
          and coalesce(
            case when v_assignment.due_days_after_unlock is not null
              then progress.completed_at
                + make_interval(days => v_assignment.due_days_after_unlock)
              else null end,
            v_assignment.due_at
          ) >= now()
      )
    )
  then
    raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
  end if;

  if v_attempt >= v_assignment.max_attempts then
    raise exception '已达到本任务允许的提交次数';
  end if;
  if v_attempt > 0 and not v_assignment.allow_resubmission and not exists (
    select 1
    from public.learning_submissions as submission
    where submission.tenant_id = v_tenant_id
      and submission.assignment_id = p_assignment_id
      and submission.student_id = v_student_id
      and submission.status = 'revision_required'
  ) then
    raise exception '该任务不允许重复提交';
  end if;
  v_attempt := v_attempt + 1;

  select count(*) into v_question_count
  from public.learning_assignment_questions as question
  where question.tenant_id = v_tenant_id
    and question.assignment_id = p_assignment_id;
  select count(distinct value->>'questionId') into v_answer_count
  from jsonb_array_elements(p_answers) as value;
  if v_question_count = 0
    or v_answer_count <> v_question_count
    or jsonb_array_length(p_answers) <> v_question_count then
    raise exception '请完成全部题目后再提交';
  end if;

  insert into public.learning_submissions (
    tenant_id, assignment_id, student_id, attempt_number, status,
    request_id, request_payload_hash, submission_state, submitted_at
  ) values (
    v_tenant_id, p_assignment_id, v_student_id, v_attempt, 'submitted',
    p_request_id, v_payload_hash, 'submitted_pending_grading', now()
  ) returning id into v_submission_id;

  for v_answer in select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_question_id := (v_answer->>'questionId')::uuid;
    exception when others then
      raise exception '答案中包含无效题目';
    end;
    v_answer_text := btrim(coalesce(v_answer->>'answer', ''));
    if char_length(v_answer_text) not between 1 and 10000 then
      raise exception '每道题都需要作答，单题答案不能超过 10000 个字';
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
    if v_question_type = 'single_choice'
      and not exists (
        select 1
        from jsonb_array_elements_text(v_options) as option
        where option = v_answer_text
      ) then
      raise exception '选择题答案不在有效选项中';
    end if;
    if v_question_type = 'file_link'
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
    count(*) filter (where not question.auto_graded),
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
        objective_graded_at = now(),
        updated_at = now()
    where tenant_id = v_tenant_id and id = v_submission_id;
  else
    v_submission_state := case
      when v_assignment.grade_release_at is null
        or v_assignment.grade_release_at <= now()
      then 'grade_released'
      else 'grading_completed'
    end;
    update public.learning_submissions
    set status = case when v_submission_state = 'grade_released'
          then 'graded' else 'submitted' end,
        score = case when v_submission_state = 'grade_released'
          then v_objective_score else null end,
        computed_score = v_objective_score,
        submission_state = v_submission_state,
        objective_graded_at = now(),
        grading_completed_at = now(),
        grade_released_at = case when v_submission_state = 'grade_released'
          then now() else null end,
        graded_at = now(),
        updated_at = now()
    where tenant_id = v_tenant_id and id = v_submission_id;
  end if;

  update public.learning_assignment_submission_counters
  set attempt_count = v_attempt,
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

revoke all on function public.submit_learning_assignment(uuid, jsonb, uuid)
  from public, anon;
grant execute on function public.submit_learning_assignment(uuid, jsonb, uuid)
  to authenticated;

create or replace function public.grade_learning_submission(
  p_submission_id uuid,
  p_decision text,
  p_overall_feedback text,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.learning_submissions%rowtype;
  v_assignment public.learning_assignments%rowtype;
  v_item jsonb;
  v_answer_id uuid;
  v_points numeric(8,2);
  v_feedback text;
  v_max_points numeric(8,2);
  v_total numeric(8,2) := 0;
  v_expected integer;
  v_received integer;
  v_submission_state text;
begin
  select submission.*
  into v_submission
  from public.learning_submissions as submission
  join public.learning_assignments as assignment
    on assignment.tenant_id = submission.tenant_id
   and assignment.id = submission.assignment_id
  where submission.id = p_submission_id
    and submission.tenant_id = private.current_tenant_id()
    and private.current_staff_has_app_capability(
      assignment.tenant_id,
      assignment.student_app_id,
      'manage_assessments'
    )
    and (
      public.current_profile_role() <> 'teacher'
      or private.current_teacher_has_student_app_access(
        assignment.tenant_id,
        submission.student_id,
        assignment.student_app_id
      )
    )
  for update of submission;

  if v_submission.id is null then
    raise exception '提交记录不存在或当前账号没有该应用的批改权限';
  end if;

  select assignment.* into v_assignment
  from public.learning_assignments as assignment
  where assignment.tenant_id = v_submission.tenant_id
    and assignment.id = v_submission.assignment_id;
  if p_decision not in ('graded', 'revision_required') then
    raise exception '批改结果不正确';
  end if;
  p_overall_feedback := btrim(coalesce(p_overall_feedback, ''));
  if char_length(p_overall_feedback) > 3000 then
    raise exception '总体评语不能超过 3000 个字';
  end if;
  if p_decision = 'revision_required'
    and char_length(p_overall_feedback) < 2 then
    raise exception '退回重做时必须填写明确原因';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception '评分数据格式不正确';
  end if;

  select count(*) into v_expected
  from public.learning_submission_answers
  where tenant_id = v_submission.tenant_id
    and submission_id = p_submission_id;
  select count(distinct value->>'answerId') into v_received
  from jsonb_array_elements(p_scores) as value;
  if v_expected = 0
    or v_received <> v_expected
    or jsonb_array_length(p_scores) <> v_expected then
    raise exception '请填写全部题目的评分';
  end if;

  for v_item in select value from jsonb_array_elements(p_scores)
  loop
    begin
      v_answer_id := (v_item->>'answerId')::uuid;
      v_points := (v_item->>'points')::numeric;
    exception when others then
      raise exception '评分中包含无效数据';
    end;
    v_feedback := nullif(btrim(coalesce(v_item->>'feedback', '')), '');
    if v_feedback is not null and char_length(v_feedback) > 2000 then
      raise exception '单题评语不能超过 2000 个字';
    end if;

    select question.points into v_max_points
    from public.learning_submission_answers as answer
    join public.learning_assignment_questions as question
      on question.tenant_id = answer.tenant_id
     and question.id = answer.question_id
    where answer.id = v_answer_id
      and answer.tenant_id = v_submission.tenant_id
      and answer.submission_id = p_submission_id;
    if not found then
      raise exception '评分中包含不属于本次提交的答案';
    end if;
    if v_points < 0 or v_points > v_max_points then
      raise exception '单题得分必须在 0 分和题目满分之间';
    end if;

    update public.learning_submission_answers
    set awarded_points = v_points,
        grader_feedback = v_feedback,
        updated_at = now()
    where id = v_answer_id
      and tenant_id = v_submission.tenant_id;
    v_total := v_total + v_points;
  end loop;

  v_submission_state := case
    when p_decision = 'revision_required' then 'revision_required'
    when v_assignment.grade_release_at is null
      or v_assignment.grade_release_at <= now()
      then 'grade_released'
    else 'grading_completed'
  end;

  update public.learning_submissions
  set status = case
        when p_decision = 'revision_required' then 'revision_required'
        when v_submission_state = 'grade_released' then 'graded'
        else 'submitted'
      end,
      score = case when v_submission_state = 'grade_released'
        then v_total else null end,
      computed_score = case when p_decision = 'graded' then v_total else null end,
      overall_feedback = nullif(p_overall_feedback, ''),
      submission_state = v_submission_state,
      grading_completed_at = case when p_decision = 'graded' then now() else null end,
      grade_released_at = case when v_submission_state = 'grade_released'
        then now() else null end,
      graded_at = now(),
      graded_by = auth.uid(),
      updated_at = now()
  where id = p_submission_id
    and tenant_id = v_submission.tenant_id;
end;
$$;

-- A student read makes a scheduled release durable before returning data.
-- This avoids inferring "released" from the assignment timestamp on every UI.
create or replace function public.release_current_user_due_assignment_grades()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_released integer;
begin
  if auth.uid() is null
    or public.current_profile_role() <> 'student'
    or not public.is_active_account() then
    return 0;
  end if;

  update public.learning_submissions as submission
  set status = 'graded',
      score = submission.computed_score,
      submission_state = 'grade_released',
      grade_released_at = now(),
      updated_at = now()
  from public.learning_assignments as assignment
  where assignment.tenant_id = submission.tenant_id
    and assignment.id = submission.assignment_id
    and submission.tenant_id = private.current_tenant_id()
    and submission.student_id = auth.uid()
    and submission.submission_state = 'grading_completed'
    and assignment.grade_release_at is not null
    and assignment.grade_release_at <= now();
  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

revoke all on function public.release_current_user_due_assignment_grades()
  from public, anon;
grant execute on function public.release_current_user_due_assignment_grades()
  to authenticated;

comment on column public.learning_submissions.request_id is
  'Client-generated idempotency key; a retry of the same real submission returns the original result.';
comment on column public.learning_submissions.submission_state is
  'Explicit workflow state from submitted_pending_grading through grade_released.';
comment on table public.learning_assignment_submission_counters is
  'Per-assignment/student row lock and authoritative submitted-attempt count.';
comment on table public.learning_assignment_progress is
  'Refresh-safe authoritative student task state; absence means not_started.';

commit;
