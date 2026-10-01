-- D6：出题入口支持数学题（草稿；依赖 D5）。
-- 在 public.create_learning_assignment 上做三处改动，其余逻辑逐字不变：
--   1) 题型白名单新增 math.expression、math.numeric；
--   2) 数学题必须带合法的 mathSpec（判题规格），写入 math_question_specs；其他题型不得带；
--   3) 数学题不使用 correctAnswer（标准答案写在判题规格里），避免与精确匹配判分混淆。
-- 沿用原有的权限判断 current_user_is_assignment_manager()；作业所属应用仍由课程推导。
begin;
CREATE OR REPLACE FUNCTION public.create_learning_assignment(p_title text, p_description text, p_assignment_type text, p_course_id uuid, p_target_scope text, p_target_ids uuid[], p_due_at timestamp with time zone, p_duration_minutes integer, p_allow_resubmission boolean, p_publish boolean, p_questions jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_assignment_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_type text;
  v_prompt text;
  v_options jsonb;
  v_points numeric(8,2);
  v_total_points numeric(8,2) := 0;
  v_sort_order integer := 0;
  v_correct_answer text;
  v_explanation text;
  v_math_spec jsonb;
  v_grader_key text;
  v_target_count integer;
  v_expected_target_count integer;
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_title) not between 2 and 120 then
    raise exception '标题需要填写 2 至 120 个字';
  end if;
  if char_length(p_description) > 5000 then
    raise exception '任务说明不能超过 5000 个字';
  end if;
  if p_assignment_type not in ('homework', 'quiz', 'exam') then
    raise exception '任务类型不正确';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception '截止时间必须晚于当前时间';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not between 1 and 600 then
    raise exception '建议用时需要在 1 至 600 分钟之间';
  end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses
    where id = p_course_id and tenant_id = private.current_tenant_id()
  ) then
    raise exception '所选课程不存在';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception '请设置 1 至 50 道题目';
  end if;

  if p_target_scope = 'selected_students' then
    select count(distinct value::uuid)
      into v_expected_target_count
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value;
    if v_expected_target_count = 0 then
      raise exception '请至少选择一名学生';
    end if;
    select count(*)
      into v_target_count
    from public.tenant_memberships as membership
    where membership.user_id = any(p_target_ids)
      and membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active';
    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含无效学生账号';
    end if;
  end if;

  insert into public.learning_assignments (
    title, description, assignment_type, course_id, target_scope,
    due_at, duration_minutes, allow_resubmission, status, published_at,
    created_by, updated_by
  ) values (
    p_title, p_description, p_assignment_type, p_course_id, p_target_scope,
    p_due_at, p_duration_minutes, coalesce(p_allow_resubmission, false),
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() else null end,
    auth.uid(), auth.uid()
  ) returning id into v_assignment_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_question_type := coalesce(v_question->>'type', '');
    v_prompt := btrim(coalesce(v_question->>'prompt', ''));
    v_options := coalesce(v_question->'options', '[]'::jsonb);
    v_correct_answer := nullif(btrim(coalesce(v_question->>'correctAnswer', '')), '');
    v_explanation := nullif(btrim(coalesce(v_question->>'explanation', '')), '');
    v_math_spec := v_question->'mathSpec';
    begin
      v_points := (v_question->>'points')::numeric;
    exception when others then
      raise exception '第 % 题分值不正确', v_sort_order + 1;
    end;

    if v_question_type not in (
      'short_text', 'long_text', 'single_choice', 'file_link', 'math.expression', 'math.numeric'
    ) then
      raise exception '第 % 题类型不正确', v_sort_order + 1;
    end if;
    -- 数学题必须带判题规格（mathSpec），其他题型不得带
    if v_question_type in ('math.expression', 'math.numeric') then
      v_grader_key := case v_question_type
        when 'math.expression' then 'math.expression-equivalence' else 'math.numeric' end;
      if v_math_spec is null or not private.math_spec_is_valid(v_grader_key, v_math_spec) then
        raise exception '第 % 题缺少合法的判题规格', v_sort_order + 1;
      end if;
      if v_correct_answer is not null then
        raise exception '第 % 题是数学题，标准答案请写入判题规格', v_sort_order + 1;
      end if;
    elsif v_math_spec is not null then
      raise exception '第 % 题不是数学题，不能设置判题规格', v_sort_order + 1;
    end if;
    if char_length(v_prompt) not between 1 and 3000 then
      raise exception '第 % 题题目不能为空且不能超过 3000 个字', v_sort_order + 1;
    end if;
    if v_points <= 0 or v_points > 1000 then
      raise exception '第 % 题分值需要在 0 至 1000 分之间', v_sort_order + 1;
    end if;
    if jsonb_typeof(v_options) <> 'array' then
      raise exception '第 % 题选项格式不正确', v_sort_order + 1;
    end if;
    if v_question_type = 'single_choice' and jsonb_array_length(v_options) < 2 then
      raise exception '第 % 道选择题至少需要两个选项', v_sort_order + 1;
    end if;
    if v_explanation is not null and char_length(v_explanation) > 3000 then
      raise exception '第 % 题解析不能超过 3000 个字', v_sort_order + 1;
    end if;

    insert into public.learning_assignment_questions (
      assignment_id, question_type, prompt, options, points, sort_order
    ) values (
      v_assignment_id, v_question_type, v_prompt, v_options, v_points, v_sort_order
    ) returning id into v_question_id;

    if v_math_spec is not null then
      insert into public.math_question_specs (question_id, tenant_id, grader_key, spec, updated_by)
      select v_question_id, question.tenant_id, v_grader_key, v_math_spec, auth.uid()
      from public.learning_assignment_questions as question
      where question.id = v_question_id;
    end if;

    if v_correct_answer is not null or v_explanation is not null then
      insert into public.learning_assignment_question_keys (
        question_id, correct_answer, explanation, updated_by
      ) values (
        v_question_id, v_correct_answer, v_explanation, auth.uid()
      );
    end if;

    v_total_points := v_total_points + v_points;
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.learning_assignments
  set total_points = v_total_points
  where id = v_assignment_id;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (assignment_id, student_id)
    select v_assignment_id, value::uuid
    from unnest(p_target_ids) as value
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$function$;
commit;
