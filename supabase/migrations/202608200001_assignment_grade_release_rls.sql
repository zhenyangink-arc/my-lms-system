begin;

-- RLS can only admit or reject whole rows. Keep the grading-bearing base rows
-- unavailable to students until release, and expose the pre-release fields the
-- student workflow still needs through deliberately masked, read-only views.
drop policy if exists "application users read submissions"
  on public.learning_submissions;
create policy "application users read submissions"
on public.learning_submissions for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_submissions.assignment_id
      and assignment.tenant_id = learning_submissions.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'view_analytics'
        )
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          learning_submissions.student_id,
          assignment.student_app_id
        )
        or (
          learning_submissions.student_id = (select auth.uid())
          and learning_submissions.submission_state = 'grade_released'
          and private.current_student_has_app_access(
            assignment.tenant_id,
            learning_submissions.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

drop policy if exists "application users read submission answers"
  on public.learning_submission_answers;
create policy "application users read submission answers"
on public.learning_submission_answers for select to authenticated
using (
  exists (
    select 1
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.id = submission.assignment_id
     and assignment.tenant_id = submission.tenant_id
    where submission.id = learning_submission_answers.submission_id
      and submission.tenant_id = learning_submission_answers.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          submission.student_id,
          assignment.student_app_id
        )
        or (
          submission.student_id = (select auth.uid())
          and submission.submission_state = 'grade_released'
          and private.current_student_has_app_access(
            assignment.tenant_id,
            submission.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

-- Assignment grading is also copied into the unified review center's
-- feedback_snapshot when grading completes. Gate those derived rows by the
-- authoritative source submission so the review table cannot bypass release.
create or replace function private.student_review_item_grade_is_released(
  p_tenant_id uuid,
  p_student_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_content_snapshot jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not (p_source_type = any(array[
      'teacher_homework',
      'formal_chapter_exam',
      'stage_exam',
      'midterm_exam',
      'final_exam',
      'makeup_exam',
      'teacher_speaking_writing_feedback'
    ]::text[]))
    or exists (
      select 1
      from public.learning_submissions as submission
      where submission.tenant_id = p_tenant_id
        and submission.student_id = p_student_id
        and submission.assignment_id = p_source_id
        and submission.id::text = p_content_snapshot ->> 'sourceSubmissionId'
        and submission.submission_state = 'grade_released'
    );
$$;

revoke all on function private.student_review_item_grade_is_released(
  uuid, uuid, text, uuid, jsonb
) from public;
grant execute on function private.student_review_item_grade_is_released(
  uuid, uuid, text, uuid, jsonb
) to authenticated, service_role;

drop policy if exists "authorized users read student review items"
  on public.student_review_items;
create policy "authorized users read student review items"
on public.student_review_items for select to authenticated
using (
  private.current_user_can_view_student_activity(
    tenant_id,
    student_id,
    student_app_id
  )
  and (
    public.current_profile_role() <> 'student'
    or private.student_review_item_grade_is_released(
      tenant_id,
      student_id,
      source_type,
      source_id,
      content_snapshot
    )
  )
);

drop policy if exists "students insert own review items"
  on public.student_review_items;
create policy "students insert own review items"
on public.student_review_items for insert to authenticated
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and private.student_review_item_grade_is_released(
    tenant_id,
    student_id,
    source_type,
    source_id,
    content_snapshot
  )
);

drop policy if exists "students update own review items"
  on public.student_review_items;
create policy "students update own review items"
on public.student_review_items for update to authenticated
using (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and private.student_review_item_grade_is_released(
    tenant_id,
    student_id,
    source_type,
    source_id,
    content_snapshot
  )
)
with check (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and private.student_review_item_grade_is_released(
    tenant_id,
    student_id,
    source_type,
    source_id,
    content_snapshot
  )
);

drop policy if exists "students delete own review items"
  on public.student_review_items;
create policy "students delete own review items"
on public.student_review_items for delete to authenticated
using (
  private.current_student_has_app_access(
    tenant_id,
    student_id,
    student_app_id
  )
  and private.student_review_item_grade_is_released(
    tenant_id,
    student_id,
    source_type,
    source_id,
    content_snapshot
  )
);

-- These owner-executed views intentionally bypass the newly restrictive base
-- RLS only after applying their explicit auth.uid(), tenant, app-access, and
-- release-state masks. security_barrier prevents caller predicates from being
-- pushed below that boundary.
create view public.student_learning_submissions
with (security_barrier = true)
as
select
  submission.id,
  submission.tenant_id,
  submission.assignment_id,
  submission.student_id,
  submission.attempt_number,
  submission.status,
  submission.submission_state,
  case
    when submission.submission_state = 'grade_released' then submission.score
    else null
  end as score,
  case
    when submission.submission_state = 'grade_released'
      then submission.overall_feedback
    else null
  end as overall_feedback,
  submission.submitted_at,
  submission.graded_at,
  submission.objective_graded_at,
  submission.grade_released_at
from public.learning_submissions as submission
join public.learning_assignments as assignment
  on assignment.id = submission.assignment_id
 and assignment.tenant_id = submission.tenant_id
where submission.student_id = (select auth.uid())
  and private.current_student_has_app_access(
    assignment.tenant_id,
    submission.student_id,
    assignment.student_app_id
  );

comment on view public.student_learning_submissions is
  'Student-safe submission projection. Final score and teacher feedback are null until grade_released.';

create view public.student_learning_submission_answers
with (security_barrier = true)
as
select
  answer.id,
  answer.tenant_id,
  answer.submission_id,
  answer.question_id,
  answer.answer_text,
  case
    when question.auto_graded
      or submission.submission_state = 'grade_released'
      then answer.awarded_points
    else null
  end as awarded_points,
  case
    when submission.submission_state = 'grade_released'
      then answer.rubric_scores
    else null
  end as rubric_scores,
  case
    when submission.submission_state = 'grade_released'
      then answer.grader_feedback
    else null
  end as grader_feedback,
  answer.created_at,
  answer.updated_at
from public.learning_submission_answers as answer
join public.learning_submissions as submission
  on submission.id = answer.submission_id
 and submission.tenant_id = answer.tenant_id
join public.learning_assignments as assignment
  on assignment.id = submission.assignment_id
 and assignment.tenant_id = submission.tenant_id
join public.learning_assignment_questions as question
  on question.id = answer.question_id
 and question.assignment_id = assignment.id
 and question.tenant_id = answer.tenant_id
where submission.student_id = (select auth.uid())
  and private.current_student_has_app_access(
    assignment.tenant_id,
    submission.student_id,
    assignment.student_app_id
  );

comment on view public.student_learning_submission_answers is
  'Student-safe answer projection. Objective points remain immediate; subjective points, rubrics, and grader feedback are null until grade_released.';

revoke all on public.student_learning_submissions from public, anon, authenticated;
revoke all on public.student_learning_submission_answers from public, anon, authenticated;
grant select on public.student_learning_submissions to authenticated;
grant select on public.student_learning_submission_answers to authenticated;

commit;
