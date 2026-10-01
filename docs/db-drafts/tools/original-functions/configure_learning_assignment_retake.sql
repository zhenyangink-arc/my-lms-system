CREATE OR REPLACE FUNCTION public.configure_learning_assignment_retake(p_evaluation_id uuid, p_assignment_id uuid, p_retake_paper_id uuid, p_retake_starts_at timestamp with time zone, p_retake_due_at timestamp with time zone, p_retake_score_policy text, p_retake_original_weight_percent integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

