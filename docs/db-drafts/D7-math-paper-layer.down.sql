-- D7 回滚：还原 6 个既有函数的定义（取自 D7 之前的验证库），删除新增对象。
-- 若已有数学试卷（assessment_paper_questions 中有 math.* 题型），先删除这些试卷，否则收紧约束会失败。
begin;
CREATE OR REPLACE FUNCTION private.assessment_paper_release_issues_with_temporary_notice(p_paper_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paper public.assessment_papers%rowtype;
  v_issues text[] := array[]::text[];
  v_is_chapter_exam boolean;
  v_is_midterm boolean;
  v_invalid_count integer;
  v_question record;
begin
  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id;
  if not found then
    return array['标准试卷不存在'];
  end if;

  v_is_chapter_exam := v_paper.paper_type = 'exam'
    and v_paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$';
  v_is_midterm := v_paper.paper_type = 'exam'
    and v_paper.paper_code like 'EX-K1-MID-%';

  if v_paper.question_count < 1 then
    v_issues := array_append(v_issues, '试卷没有题目');
  end if;
  if v_paper.duration_minutes is null then
    v_issues := array_append(v_issues, '未设置考试时长');
  end if;
  if v_paper.passing_score is null then
    v_issues := array_append(v_issues, '未设置及格分');
  end if;
  if not v_paper.resubmission_policy_configured then
    v_issues := array_append(v_issues, '重复提交规则尚未由内容负责人确认');
  end if;

  select count(*) into v_invalid_count
  from (
    select lower(btrim(question.prompt))
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
    group by lower(btrim(question.prompt))
    having count(*) > 1
  ) as duplicates;
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('存在 %s 组重复题干', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  left join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and (
      nullif(btrim(question.prompt), '') is null
      or question.points <= 0
      or answer_key.question_id is null
      or nullif(btrim(answer_key.explanation), '') is null
      or question.skill not in (
        'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
      )
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题的题干、解析、分值或能力分类未完成', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  left join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      nullif(btrim(answer_key.correct_answer), '') is null
      or nullif(btrim(answer_key.explanation), '') is null
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题缺少正确答案或解析', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  join public.assessment_paper_question_keys as answer_key
    on answer_key.question_id = question.id
  where question.paper_id = p_paper_id
    and question.auto_graded
    and (
      jsonb_array_length(question.options) < 2
      or not question.options @> jsonb_build_array(answer_key.correct_answer)
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道客观题的可选项未完整冻结或不包含正确答案', v_invalid_count));
  end if;

  select count(*) into v_invalid_count
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id
    and exists (
      select 1
      from jsonb_array_elements_text(question.options) as option_value(value)
      group by lower(btrim(option_value.value))
      having count(*) > 1
    );
  if v_invalid_count > 0 then
    v_issues := array_append(v_issues,
      format('有 %s 道题包含完全重复的选项', v_invalid_count));
  end if;

  if (
    select count(*) from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.question_count then
    v_issues := array_append(v_issues, '试卷题量与题目快照不一致');
  end if;
  if (
    select coalesce(sum(question.points), 0)
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
  ) <> v_paper.total_points then
    v_issues := array_append(v_issues, '试卷总分与题目快照不一致');
  end if;

  if v_is_midterm then
    if v_paper.paper_code !~ '^EX-K1-MID-V[0-9]+$' then
      v_issues := array_append(v_issues, '期中母卷代码必须符合 EX-K1-MID-V{版本号}');
    end if;
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '期中考试母卷总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(v_issues,
        '期中考试六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;
    for v_question in
      select
        coalesce(question.question_code, '未编号题目') as question_code,
        question.points,
        case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end as expected_points
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
        and question.points <> case question.skill
          when 'vocabulary' then 1.5::numeric
          when 'grammar' then 2::numeric
          when 'listening' then 3::numeric
          when 'speaking' then 15::numeric
          when 'reading' then 2.5::numeric
          when 'writing' then 15::numeric
        end
      order by question.sort_order
    loop
      v_issues := array_append(
        v_issues,
        format(
          '期中题 %s 分值应为 %s 分，当前为 %s 分',
          v_question.question_code,
          v_question.expected_points,
          v_question.points
        )
      );
    end loop;
    if (
      select count(distinct chapter_key)
      from public.assessment_paper_questions as question
      cross join unnest(question.source_chapters) as chapter_key
      where question.paper_id = p_paper_id
        and chapter_key ~ '^K1-(0[1-9]|1[0-6])$'
    ) < 6 then
      v_issues := array_append(v_issues, '期中考试必须至少覆盖6个不同章节');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and (
        question.question_code is null
        or cardinality(question.source_chapters) = 0
        or nullif(btrim(question.source_knowledge), '') is null
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道期中题缺少稳定题号、章节来源或知识点快照', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('vocabulary', 'grammar', 'listening', 'reading')
        and not question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的单词、语法、听力或阅读客观题未配置自动判分');
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in ('speaking', 'writing')
        and question.auto_graded
    ) then
      v_issues := array_append(v_issues, '期中考试的口语和写作必须配置为人工批改');
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.skill in ('speaking', 'writing')
      and (
        (question.skill = 'speaking' and question.question_type <> 'audio_recording')
        or (question.skill = 'writing' and question.question_type <> 'long_text')
        or case
          when jsonb_typeof(answer_key.rubric_snapshot -> 'criteria') = 'array'
          then
            exists (
              select 1
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
              where jsonb_typeof(criterion -> 'maxPoints') <> 'number'
            )
            or coalesce((
              select sum((criterion ->> 'maxPoints')::numeric)
              from jsonb_array_elements(
                answer_key.rubric_snapshot -> 'criteria'
              ) as criterion
            ), 0) <> question.points
          else true
        end
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道主观题的作答方式或量规满分与题目分值不一致', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and (
        nullif(btrim(question.stimulus_text), '') is null
        or question.audio_status not in ('temporary', 'formal')
      );
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题缺少材料文本或有效音频状态', v_invalid_count));
    end if;
    select count(*) into v_invalid_count
    from public.assessment_paper_questions as question
    where question.paper_id = p_paper_id
      and question.skill = 'listening'
      and question.audio_status = 'temporary';
    if v_invalid_count > 0 then
      v_issues := array_append(v_issues,
        format('有 %s 道听力题仍使用 temporary 临时音频，正式发布前须完成听校并复制为新版本', v_invalid_count));
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and question.audio_status = 'formal'
    ) and v_paper.paper_code = 'EX-K1-MID-V1' then
      v_issues := array_append(v_issues, 'EX-K1-MID-V1 合同规定听力状态不得标记为 formal');
    end if;
  elsif v_is_chapter_exam then
    if v_paper.total_points <> 100 then
      v_issues := array_append(v_issues, '正式章节考试总分必须等于100分');
    end if;
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '单词、语法、听力、口语、阅读、写作六项不齐全');
    end if;
    if exists (
      select required.skill
      from (values
        ('vocabulary', 15::numeric), ('grammar', 20::numeric),
        ('listening', 15::numeric), ('speaking', 15::numeric),
        ('reading', 20::numeric), ('writing', 15::numeric)
      ) as required(skill, points)
      left join (
        select question.skill, sum(question.points) as points
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (skill)
      where coalesce(actual.points, 0) <> required.points
    ) then
      v_issues := array_append(v_issues,
        '六项分值必须为单词15、语法20、听力15、口语15、阅读20、写作15');
    end if;
  elsif v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      v_issues := array_append(v_issues, '章节作业的词汇、语法、听说读写六项内容不完整');
    end if;
    if exists (
      select 1 from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      v_issues := array_append(v_issues, '章节作业的听力题缺少韩语听力材料');
    end if;
  end if;

  return v_issues;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_assessment_paper_release(p_paper_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_paper public.assessment_papers%rowtype;
  v_question_count integer;
  v_total_points numeric;
begin
  select * into v_paper from public.assessment_papers where id = p_paper_id;
  if v_paper.id is null or v_paper.status <> 'published' then
    raise exception '所选标准试卷当前不可发布';
  end if;
  select count(*), coalesce(sum(question.points), 0)
  into v_question_count, v_total_points
  from public.assessment_paper_questions as question
  where question.paper_id = p_paper_id;
  if v_question_count <> v_paper.question_count
    or v_total_points <> v_paper.total_points then
    raise exception '标准试卷题量或总分与题目快照不一致';
  end if;
  if exists (
    select 1
    from public.assessment_paper_questions as question
    left join public.assessment_paper_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.paper_id = p_paper_id
      and question.auto_graded
      and nullif(btrim(coalesce(answer_key.correct_answer, '')), '') is null
  ) then
    raise exception '标准试卷中有客观题缺少正确答案';
  end if;

  if v_paper.paper_type = 'homework' then
    if (
      select count(distinct question.skill)
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill in (
          'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'
        )
    ) <> 6 then
      raise exception '章节作业的词汇、语法、听说读写六项内容不完整';
    end if;
    if exists (
      select 1
      from public.assessment_paper_questions as question
      where question.paper_id = p_paper_id
        and question.skill = 'listening'
        and nullif(btrim(question.stimulus_text), '') is null
    ) then
      raise exception '章节作业的听力题缺少韩语听力材料';
    end if;
    if v_paper.source_homework_plan_id is not null and exists (
      select 1
      from (
        select source.language_skill, count(*) as expected_count
        from public.chapter_homework_questions as source
        where source.plan_id = v_paper.source_homework_plan_id
        group by source.language_skill
      ) as expected
      left join (
        select question.skill as language_skill, count(*) as actual_count
        from public.assessment_paper_questions as question
        where question.paper_id = p_paper_id
        group by question.skill
      ) as actual using (language_skill)
      where expected.expected_count <> coalesce(actual.actual_count, 0)
    ) then
      raise exception '章节作业与平台发布的词汇、语法或六项题目数量不一致';
    end if;
  end if;
end;
$function$;

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
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION public.duplicate_assessment_paper(p_paper_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '当前账号不能复制标准试卷';
  end if;
  select * into v_source from public.assessment_papers
  where id = p_paper_id for update;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code := case
    when v_source.paper_code ~ '^(HW|EX)-K1-((0[1-9]|1[0-6])|ST0[1-4]|MID|FIN)-V[0-9]+$'
      then regexp_replace(v_source.paper_code, '-V[0-9]+$',
        '-V' || (v_source.version + 1)::text)
    else (case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end)
      || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0')
  end;

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    student_app_id, duration_minutes, passing_score, allow_resubmission,
    resubmission_policy_configured, total_points, question_count, version,
    status, created_by, updated_by
  ) values (
    v_new_code, v_source.paper_type, left(v_source.title || '（新版本）', 120),
    v_source.description, v_source.source_test_id, v_source.student_app_id,
    v_source.duration_minutes, v_source.passing_score, v_source.allow_resubmission,
    v_source.resubmission_policy_configured, v_source.total_points,
    v_source.question_count, v_source.version + 1, 'draft', auth.uid(), auth.uid()
  ) returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    )
    select v_new_id, source_bank_question_id, source_bank_version, question_type,
      stimulus_text, prompt, options, points, sort_order, difficulty, skill,
      audio_status, question_code, source_chapters, source_knowledge
    from public.assessment_paper_questions where paper_id = p_paper_id
    order by sort_order returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation, rubric_snapshot
  )
  select copied.id, source_key.correct_answer, source_key.explanation,
    source_key.rubric_snapshot
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$function$;

drop function if exists public.create_math_paper(text, text, text, uuid, integer, numeric, boolean, jsonb);
drop function if exists private.insert_math_paper_questions(uuid, jsonb);
drop table if exists public.math_paper_question_specs;
drop function if exists private.check_math_paper_spec();
drop function if exists private.assessment_paper_uses_language_skills(uuid);
alter table public.assessment_paper_questions
  drop constraint assessment_paper_questions_question_type_check;
alter table public.assessment_paper_questions
  add constraint assessment_paper_questions_question_type_check
  check (question_type = any (array['short_text', 'long_text', 'single_choice', 'file_link', 'audio_recording']));
commit;
