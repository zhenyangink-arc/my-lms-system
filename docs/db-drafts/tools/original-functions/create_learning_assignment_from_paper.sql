CREATE OR REPLACE FUNCTION public.create_learning_assignment_from_paper(p_paper_id uuid, p_course_id uuid, p_target_scope text, p_target_ids uuid[], p_starts_at timestamp with time zone, p_due_at timestamp with time zone, p_institution_note text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_paper public.assessment_papers%rowtype;
  v_paper_question public.assessment_paper_questions%rowtype;
  v_paper_key public.assessment_paper_question_keys%rowtype;
  v_assignment_id uuid;
  v_question_id uuid;
  v_course_app_id uuid;
  v_target_count integer;
  v_expected_target_count integer;
begin
  select * into v_paper from public.assessment_papers
  where id = p_paper_id and status = 'published';
  if v_tenant_id is null or not found
    or not private.current_staff_has_app_capability(
      v_tenant_id, v_paper.student_app_id, 'manage_assessments'
    ) then
    raise exception '所选标准试卷不存在或当前账号没有该应用发布权限';
  end if;
  if not exists (
    select 1 from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = v_tenant_id
      and tenant_app.app_id = v_paper.student_app_id
      and tenant_app.is_enabled and tenant_app.status = 'active'
  ) then
    raise exception '该应用尚未正式开放，不能发布作业或考试';
  end if;

  p_institution_note := btrim(coalesce(p_institution_note, ''));
  if char_length(p_institution_note) > 2000 then
    raise exception '机构通知不能超过 2000 个字';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  p_starts_at := coalesce(p_starts_at, now());
  if p_due_at is null or p_due_at <= p_starts_at then
    raise exception '截止时间必须晚于开始时间';
  end if;

  if p_course_id is not null then
    select course.student_app_id into v_course_app_id
    from public.courses as course
    where course.id = p_course_id and course.is_published
      and (course.content_scope = 'platform' or course.tenant_id = v_tenant_id);
    if v_course_app_id is null then
      raise exception '所选课程不存在、尚未发布或不属于当前机构';
    end if;
    if v_course_app_id is distinct from v_paper.student_app_id then
      raise exception '所选课程与标准试卷不属于同一个应用';
    end if;
  end if;

  if p_target_scope = 'selected_students' then
    select count(distinct value) into v_expected_target_count
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value;
    if v_expected_target_count = 0 then raise exception '请至少选择一名学生'; end if;
    select count(*) into v_target_count from (
      select distinct requested.value as student_id
      from unnest(p_target_ids) as requested(value)
      join public.tenant_memberships as membership
        on membership.tenant_id = v_tenant_id
       and membership.user_id = requested.value
       and membership.role = 'student' and membership.status = 'active'
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = membership.tenant_id
       and enrollment.student_id = membership.user_id
       and enrollment.app_id = v_paper.student_app_id
       and enrollment.status = 'active' and enrollment.starts_at <= now()
       and (enrollment.ends_at is null or enrollment.ends_at > now())
    ) as valid_target;
    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含未开通该应用的学生';
    end if;
  end if;

  insert into public.learning_assignments (
    tenant_id, student_app_id, title, description, assignment_type,
    course_id, target_scope, total_points, starts_at, due_at,
    duration_minutes, allow_resubmission, status, published_at,
    created_by, updated_by, source_paper_id, source_paper_code,
    source_paper_version, institution_note
  ) values (
    v_tenant_id, v_paper.student_app_id, v_paper.title, v_paper.description,
    v_paper.paper_type, p_course_id, p_target_scope, v_paper.total_points,
    p_starts_at, p_due_at, v_paper.duration_minutes,
    v_paper.allow_resubmission, 'published', now(), auth.uid(), auth.uid(),
    v_paper.id, v_paper.paper_code, v_paper.version, p_institution_note
  ) returning id into v_assignment_id;

  for v_paper_question in
    select * from public.assessment_paper_questions
    where paper_id = v_paper.id order by sort_order
  loop
    insert into public.learning_assignment_questions (
      tenant_id, assignment_id, question_type, language_skill, stimulus_text,
      prompt, options, points, sort_order, source_bank_question_id,
      source_bank_version
    ) values (
      v_tenant_id, v_assignment_id, v_paper_question.question_type,
      v_paper_question.skill, v_paper_question.stimulus_text,
      v_paper_question.prompt, v_paper_question.options,
      v_paper_question.points, v_paper_question.sort_order,
      v_paper_question.source_bank_question_id,
      v_paper_question.source_bank_version
    ) returning id into v_question_id;

    select * into v_paper_key from public.assessment_paper_question_keys
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

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (
      tenant_id, assignment_id, student_id
    ) select v_tenant_id, v_assignment_id, requested.value
    from (select distinct value from unnest(p_target_ids) as value) as requested
    on conflict do nothing;
  end if;
  return v_assignment_id;
end;
$function$

