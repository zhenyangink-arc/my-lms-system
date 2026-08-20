begin;

-- Keep every delivered paper as an immutable assignment snapshot.  A retake
-- can use a different mother paper without rewriting the questions referenced
-- by the first-attempt submissions.
alter table public.learning_assignment_questions
  add column if not exists delivery_paper_id uuid
    references public.assessment_papers(id) on delete restrict,
  add column if not exists source_paper_question_id uuid
    references public.assessment_paper_questions(id) on delete restrict;

update public.learning_assignment_questions as question
set delivery_paper_id = assignment.source_paper_id
from public.learning_assignments as assignment
where assignment.id = question.assignment_id
  and assignment.tenant_id = question.tenant_id
  and question.delivery_paper_id is null
  and assignment.source_paper_id is not null;

update public.learning_assignment_questions as question
set source_paper_question_id = paper_question.id
from public.assessment_paper_questions as paper_question
where paper_question.paper_id = question.delivery_paper_id
  and paper_question.sort_order = question.sort_order
  and question.source_paper_question_id is null;

alter table public.learning_assignment_questions
  drop constraint if exists learning_assignment_questions_assignment_id_sort_order_key;

create unique index if not exists learning_assignment_questions_delivery_order_idx
  on public.learning_assignment_questions (
    assignment_id,
    coalesce(delivery_paper_id, '00000000-0000-0000-0000-000000000000'::uuid),
    sort_order
  );

create index if not exists learning_assignment_questions_delivery_paper_idx
  on public.learning_assignment_questions (assignment_id, delivery_paper_id, sort_order);

comment on column public.learning_assignment_questions.delivery_paper_id is
  'Mother-paper identity of this immutable delivery snapshot; original and retake snapshots may coexist.';
comment on column public.learning_assignment_questions.source_paper_question_id is
  'Exact mother-paper question identity used to prove and audit snapshot correspondence.';

create or replace function private.set_assignment_question_delivery_paper()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.delivery_paper_id is null then
    select assignment.source_paper_id into new.delivery_paper_id
    from public.learning_assignments as assignment
    where assignment.tenant_id = new.tenant_id
      and assignment.id = new.assignment_id;
  end if;
  if new.source_paper_question_id is null and new.delivery_paper_id is not null then
    select paper_question.id into new.source_paper_question_id
    from public.assessment_paper_questions as paper_question
    where paper_question.paper_id = new.delivery_paper_id
      and paper_question.sort_order = new.sort_order;
  end if;
  return new;
end;
$$;

drop trigger if exists learning_assignment_questions_set_delivery_paper
  on public.learning_assignment_questions;
create trigger learning_assignment_questions_set_delivery_paper
before insert on public.learning_assignment_questions
for each row execute function private.set_assignment_question_delivery_paper();

-- A status-only gap deliberately has no student action. Failed examinations also
-- stay off the original attempt: the teacher creates a retake from the review.
create or replace function private.normalize_completion_gaps(p_gaps jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case
      when gap ->> 'status' = 'pending_grading' then gap - 'href'
      when gap ->> 'category' in (
        'stage_exam', 'midterm_exam', 'final_exam'
      ) and (
        gap ->> 'status' = 'failed'
        or gap ->> 'reason' like '%尚未布置%'
      ) then (gap - 'href') || case
        when gap ->> 'status' = 'failed'
          and gap ->> 'reason' not like '%老师%补考%'
        then jsonb_build_object(
          'reason', rtrim(gap ->> 'reason', '。') || '，老师将根据本次成绩布置补考。'
        )
        else '{}'::jsonb
      end
      else gap
    end
    order by ordinal
  ), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_gaps, '[]'::jsonb))
    with ordinality as item(gap, ordinal);
$$;

create or replace function private.completion_gap_is_valid(p_gap jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  return jsonb_typeof(p_gap) = 'object'
    and p_gap ?& array['key', 'category', 'title', 'status', 'reason']
    and p_gap ->> 'category' in (
      'course', 'assignment', 'chapter_exam', 'stage_exam',
      'midterm_exam', 'final_exam', 'manual_grading', 'overall_score',
      'chapter_practice', 'specialized_practice', 'review'
    )
    and p_gap ->> 'status' in (
      'missing', 'in_progress', 'failed', 'pending_grading'
    )
    and char_length(btrim(p_gap ->> 'key')) between 1 and 160
    and char_length(btrim(p_gap ->> 'title')) between 1 and 200
    and char_length(btrim(p_gap ->> 'reason')) between 2 and 500
    and (
      not (p_gap ? 'href')
      or p_gap ->> 'href' is null
      or (p_gap ->> 'href') ~ '^/dashboard(?:/|$)'
    )
    and not (p_gap ?| array[
      'color', 'icon', 'class', 'className', 'cssClass', 'backgroundColor'
    ])
    and (
      not (p_gap ? 'currentValue')
      or jsonb_typeof(p_gap -> 'currentValue') = 'number'
    )
    and (
      not (p_gap ? 'requiredValue')
      or jsonb_typeof(p_gap -> 'requiredValue') = 'number'
    );
exception when others then
  return false;
end;
$$;

create or replace function private.normalize_completion_evaluation_gaps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.missing_requirements := private.normalize_completion_gaps(
    new.missing_requirements
  );
  return new;
end;
$$;

drop trigger if exists normalize_completion_evaluation_gaps
  on public.student_course_completion_evaluations;
create trigger normalize_completion_evaluation_gaps
before insert or update of missing_requirements
on public.student_course_completion_evaluations
for each row execute function private.normalize_completion_evaluation_gaps();

update public.student_course_completion_evaluations
set missing_requirements = private.normalize_completion_gaps(missing_requirements)
where missing_requirements is distinct from
  private.normalize_completion_gaps(missing_requirements);

drop policy if exists learning_assignment_retake_students_student_select
  on public.learning_assignment_retake_students;
create policy learning_assignment_retake_students_student_select
on public.learning_assignment_retake_students for select to authenticated
using (
  student_id = (select auth.uid())
  and tenant_id = private.current_tenant_id()
  and public.is_active_account()
  and public.current_profile_role() = 'student'
);

create or replace function public.configure_learning_assignment_retake(
  p_evaluation_id uuid,
  p_assignment_id uuid,
  p_retake_paper_id uuid,
  p_retake_starts_at timestamptz,
  p_retake_due_at timestamptz,
  p_retake_score_policy text,
  p_retake_original_weight_percent integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_evaluation public.student_course_completion_evaluations%rowtype;
  v_assignment public.learning_assignments%rowtype;
  v_paper public.assessment_papers%rowtype;
  v_next_attempt integer;
  v_paper_question public.assessment_paper_questions%rowtype;
  v_paper_key public.assessment_paper_question_keys%rowtype;
  v_question_id uuid;
begin
  select * into v_evaluation
  from public.student_course_completion_evaluations
  where id = p_evaluation_id
    and tenant_id = v_tenant_id
    and status <> 'superseded'
  for key share;
  if v_evaluation.id is null then
    raise exception '结课资格记录不存在或已经失效';
  end if;

  select * into v_assignment
  from public.learning_assignments
  where id = p_assignment_id
    and tenant_id = v_tenant_id
    and student_app_id = v_evaluation.student_app_id
    and course_id = v_evaluation.course_id
    and assignment_type = 'exam'
    and status in ('published', 'closed')
  for update;
  if v_assignment.id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, v_evaluation.student_app_id, 'manage_assessments'
    )
    or not (
      private.has_current_tenant_role(
        array['tenant_super_admin', 'ceo']::text[]
      )
      or private.current_teacher_has_student_app_access(
        v_tenant_id, v_evaluation.student_id, v_evaluation.student_app_id
      )
    ) then
    raise exception '当前账号没有为该考试发起补考的权限';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_evaluation.missing_requirements) as gap
    where gap ->> 'sourceId' = p_assignment_id::text
      and gap ->> 'status' = 'failed'
      and gap ->> 'category' in (
        'chapter_exam', 'stage_exam', 'midterm_exam', 'final_exam'
      )
  ) then
    raise exception '该考试不在当前资格快照的未通过项目中';
  end if;

  select * into v_paper
  from public.assessment_papers
  where id = p_retake_paper_id and status = 'published';
  if v_paper.id is null
    or v_paper.student_app_id is distinct from v_assignment.student_app_id
    or v_paper.paper_type <> 'exam'
    or v_paper.total_points is distinct from v_assignment.total_points then
    raise exception '补考卷必须是同应用、同类型、同满分值的已发布试卷';
  end if;
  if p_retake_starts_at <= now()
    or p_retake_starts_at < v_assignment.due_at
    or p_retake_due_at <= p_retake_starts_at then
    raise exception '补考开始时间必须晚于当前时间和首次截止时间，截止时间必须晚于开始时间';
  end if;
  if p_retake_score_policy not in ('highest', 'latest', 'weighted') then
    raise exception '补考成绩采用规则不正确';
  end if;
  if (p_retake_score_policy = 'weighted' and
      coalesce(p_retake_original_weight_percent, 0) not between 1 and 99)
    or (p_retake_score_policy <> 'weighted' and
      p_retake_original_weight_percent is not null) then
    raise exception '补考加权比例不正确';
  end if;
  if v_assignment.retake_paper_id is not null and (
    v_assignment.retake_paper_id is distinct from p_retake_paper_id
    or v_assignment.retake_starts_at is distinct from p_retake_starts_at
    or v_assignment.retake_due_at is distinct from p_retake_due_at
    or v_assignment.retake_score_policy is distinct from p_retake_score_policy
    or v_assignment.retake_original_weight_percent is distinct from
      p_retake_original_weight_percent
  ) then
    raise exception '该考试已经有补考安排；新增学生须沿用同一试卷、时间和计分规则';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next_attempt
  from public.learning_submissions
  where tenant_id = v_tenant_id
    and assignment_id = v_assignment.id
    and student_id = v_evaluation.student_id;

  update public.learning_assignments
  set status = 'published',
      retake_paper_id = p_retake_paper_id,
      retake_starts_at = p_retake_starts_at,
      retake_due_at = p_retake_due_at,
      retake_score_policy = p_retake_score_policy,
      retake_original_weight_percent = p_retake_original_weight_percent,
      allow_resubmission = true,
      max_attempts = greatest(max_attempts, v_next_attempt),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_assignment.id;

  -- Snapshot the selected retake mother paper exactly once.  The original
  -- snapshot remains available for historical submissions and audit.
  if not exists (
    select 1
    from public.learning_assignment_questions as question
    where question.tenant_id = v_tenant_id
      and question.assignment_id = v_assignment.id
      and question.delivery_paper_id = v_paper.id
  ) then
    for v_paper_question in
      select *
      from public.assessment_paper_questions
      where paper_id = v_paper.id
      order by sort_order
    loop
      insert into public.learning_assignment_questions (
        tenant_id, assignment_id, delivery_paper_id,
        source_paper_question_id, question_type,
        language_skill, stimulus_text, prompt, options, points, sort_order,
        source_bank_question_id, source_bank_version, auto_graded
      ) values (
        v_tenant_id, v_assignment.id, v_paper.id, v_paper_question.id,
        v_paper_question.question_type, v_paper_question.skill,
        v_paper_question.stimulus_text, v_paper_question.prompt,
        v_paper_question.options, v_paper_question.points,
        v_paper_question.sort_order, v_paper_question.source_bank_question_id,
        v_paper_question.source_bank_version, v_paper_question.auto_graded
      ) returning id into v_question_id;

      select * into v_paper_key
      from public.assessment_paper_question_keys
      where question_id = v_paper_question.id;
      if found then
        insert into public.learning_assignment_question_keys (
          tenant_id, question_id, correct_answer, explanation, updated_by
        ) values (
          v_tenant_id, v_question_id, v_paper_key.correct_answer,
          v_paper_key.explanation, auth.uid()
        );
      end if;
    end loop;
  end if;

  insert into public.learning_assignment_retake_students (
    tenant_id, assignment_id, student_id, assigned_at
  ) values (
    v_tenant_id, v_assignment.id, v_evaluation.student_id, now()
  ) on conflict (assignment_id, student_id) do update
    set assigned_at = excluded.assigned_at;
end;
$$;

revoke all on function public.configure_learning_assignment_retake(
  uuid, uuid, uuid, timestamptz, timestamptz, text, integer
) from public, anon;
grant execute on function public.configure_learning_assignment_retake(
  uuid, uuid, uuid, timestamptz, timestamptz, text, integer
) to authenticated;

-- Existing submission and authoritative-timing functions already consume this
-- window, so returning the retake window makes the added attempt executable.
create or replace function public.current_user_assignment_window(
  p_assignment_id uuid
)
returns table (
  chapter_completed boolean,
  unlocked_at timestamptz,
  effective_due_at timestamptz,
  due_days_after_unlock integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when retake.assignment_id is not null then true else
      not assignment.unlock_after_chapter_completion
      or private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      )
      or progress.completed_at is not null
    end,
    case when retake.assignment_id is not null then assignment.retake_starts_at
      when private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      ) or not assignment.unlock_after_chapter_completion then assignment.starts_at
      else progress.completed_at end,
    case when retake.assignment_id is not null then assignment.retake_due_at
      when private.current_staff_has_app_capability(
        assignment.tenant_id, assignment.student_app_id, 'manage_assessments'
      ) or not assignment.unlock_after_chapter_completion then assignment.due_at
      when progress.completed_at is null then null
      when assignment.due_days_after_unlock is not null then progress.completed_at
        + make_interval(days => assignment.due_days_after_unlock)
      else assignment.due_at end,
    case when retake.assignment_id is not null then null
      else assignment.due_days_after_unlock end
  from public.learning_assignments as assignment
  left join public.course_ebook_progress as progress
    on progress.tenant_id = assignment.tenant_id
   and progress.student_id = (select auth.uid())
   and progress.student_app_id = assignment.student_app_id
   and progress.test_slug = assignment.unlock_test_slug
   and progress.completed_at is not null
  left join public.learning_assignment_retake_students as retake
    on retake.tenant_id = assignment.tenant_id
   and retake.assignment_id = assignment.id
   and retake.student_id = (select auth.uid())
  where assignment.id = p_assignment_id
    and assignment.tenant_id = private.current_tenant_id()
    and public.current_user_can_view_learning_assignment(assignment.id);
$$;

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
        and (
          exists (
            select 1 from public.learning_assignment_retake_students as retake
            where retake.tenant_id = assignment.tenant_id
              and retake.assignment_id = assignment.id
              and retake.student_id = (select auth.uid())
              and assignment.retake_starts_at <= now()
              and assignment.retake_due_at >= now()
              and not exists (
                select 1 from public.learning_submissions as submission
                where submission.tenant_id = assignment.tenant_id
                  and submission.assignment_id = assignment.id
                  and submission.student_id = retake.student_id
                  and submission.submitted_at >= assignment.retake_starts_at
              )
          )
          or (
            not exists (
              select 1
              from public.learning_assignment_retake_students as assigned_retake
              where assigned_retake.tenant_id = assignment.tenant_id
                and assigned_retake.assignment_id = assignment.id
                and assigned_retake.student_id = (select auth.uid())
            )
            and
            (assignment.starts_at is null or assignment.starts_at <= now())
            and (
              assignment.allow_late_submission
              or (not assignment.unlock_after_chapter_completion and assignment.due_at >= now())
              or exists (
                select 1 from public.course_ebook_progress as progress
                where progress.tenant_id = assignment.tenant_id
                  and progress.student_id = (select auth.uid())
                  and progress.student_app_id = assignment.student_app_id
                  and progress.test_slug = assignment.unlock_test_slug
                  and progress.completed_at is not null
                  and coalesce(
                    case when assignment.due_days_after_unlock is not null
                      then progress.completed_at + make_interval(days => assignment.due_days_after_unlock)
                    end,
                    assignment.due_at
                  ) >= now()
              )
            )
          )
        )
        and coalesce((
          select counter.attempt_count
          from public.learning_assignment_submission_counters as counter
          where counter.tenant_id = assignment.tenant_id
            and counter.assignment_id = assignment.id
            and counter.student_id = (select auth.uid())
        ), 0) < assignment.max_attempts
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

create or replace function private.assignment_delivery_paper_id(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_student_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.learning_assignment_retake_students as retake
      where retake.tenant_id = assignment.tenant_id
        and retake.assignment_id = assignment.id
        and retake.student_id = p_student_id
    ) then assignment.retake_paper_id
    else assignment.source_paper_id
  end
  from public.learning_assignments as assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.id = p_assignment_id;
$$;

-- Give every authenticated caller one authoritative delivery-paper identity.
-- Students receive the paper assigned to their own retake row; managers keep
-- the original-paper preview used by the assignment administration screen.
create or replace function public.current_user_assignment_delivery_paper_id(
  p_assignment_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.current_profile_role() = 'student' then
      private.assignment_delivery_paper_id(
        assignment.tenant_id, assignment.id, (select auth.uid())
      )
    else assignment.source_paper_id
  end
  from public.learning_assignments as assignment
  where assignment.tenant_id = private.current_tenant_id()
    and assignment.id = p_assignment_id
    and public.current_user_can_view_learning_assignment(assignment.id);
$$;

revoke all on function public.current_user_assignment_delivery_paper_id(uuid)
  from public, anon;
grant execute on function public.current_user_assignment_delivery_paper_id(uuid)
  to authenticated;

-- Preserve every timing, idempotency, grading and concurrency invariant in the
-- authoritative submission RPC from Packet 12, while narrowing its two
-- question lookups to the student's active delivery snapshot.  The guarded
-- replacements intentionally fail this migration if that earlier contract is
-- changed without updating the retake integration.
do $migration$
declare
  v_definition text;
  v_patched text;
begin
  v_definition := pg_get_functiondef(
    'public.submit_learning_assignment(uuid,jsonb,uuid,text)'::regprocedure
  );
  if v_definition like '%question.delivery_paper_id is not distinct from%' then
    return;
  end if;
  v_patched := replace(
    v_definition,
    $old$    and question.assignment_id = p_assignment_id;
  select
    count(distinct value->>'questionId'),$old$,
    $new$    and question.assignment_id = p_assignment_id
    and question.delivery_paper_id is not distinct from
      private.assignment_delivery_paper_id(
        v_tenant_id, p_assignment_id, v_student_id
      );
  select
    count(distinct value->>'questionId'),$new$
  );
  v_patched := replace(
    v_patched,
    $old$      and question.assignment_id = p_assignment_id
      and question.tenant_id = v_tenant_id;
    if not found then$old$,
    $new$      and question.assignment_id = p_assignment_id
      and question.tenant_id = v_tenant_id
      and question.delivery_paper_id is not distinct from
        private.assignment_delivery_paper_id(
          v_tenant_id, p_assignment_id, v_student_id
        );
    if not found then$new$
  );
  if v_patched = v_definition
    or v_patched not like '%question.delivery_paper_id is not distinct from%'
  then
    raise exception '无法把补考题目快照约束接入 submit_learning_assignment';
  end if;
  execute v_patched;
end;
$migration$;

comment on function private.assignment_delivery_paper_id(uuid, uuid, uuid) is
  'Returns the immutable mother-paper snapshot active for one assignment/student delivery.';
comment on function public.current_user_assignment_delivery_paper_id(uuid) is
  'Returns only the mother-paper snapshot active for the current assignment viewer.';

commit;
