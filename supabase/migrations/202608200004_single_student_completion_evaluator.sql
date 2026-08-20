begin;

alter table public.student_course_completion_evaluations
  add column evaluation_fingerprint text;

update public.student_course_completion_evaluations
set evaluation_fingerprint = md5(id::text)
where evaluation_fingerprint is null;

alter table public.student_course_completion_evaluations
  alter column evaluation_fingerprint set not null,
  add constraint student_course_completion_evaluations_fingerprint_check
    check (evaluation_fingerprint ~ '^[0-9a-f]{32}$');

create unique index student_course_completion_evaluations_idempotency_key
  on public.student_course_completion_evaluations (
    tenant_id, student_id, course_id, policy_id,
    evaluation_version, evaluation_fingerprint
  );

comment on column public.student_course_completion_evaluations.evaluation_fingerprint is
  '算法版本、政策快照与权威证据快照的确定性 MD5；相同输入重复计算复用同一行。';

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
      'midterm_exam', 'final_exam', 'manual_grading', 'overall_score'
    )
    and p_gap ->> 'status' in (
      'missing', 'in_progress', 'failed', 'pending_grading'
    )
    and char_length(btrim(p_gap ->> 'key')) between 1 and 160
    and char_length(btrim(p_gap ->> 'title')) between 1 and 200
    and char_length(btrim(p_gap ->> 'reason')) between 2 and 500
    and (
      not (p_gap ? 'href')
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

create or replace function private.completion_gaps_are_valid(p_gaps jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_gaps) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements(p_gaps) as gap
      where not private.completion_gap_is_valid(gap)
    );
$$;

create or replace function private.completion_evidence_uses_released_scores(
  p_evidence jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
begin
  if jsonb_typeof(p_evidence) = 'object' then
    if p_evidence ?| array['computedScore', 'tentativeScore', 'unreleasedScore'] then
      return false;
    end if;
    if p_evidence ? 'score'
      and jsonb_typeof(p_evidence -> 'score') = 'number'
      and coalesce((p_evidence ->> 'gradeReleased')::boolean, false) is false
      and coalesce((p_evidence ->> 'published')::boolean, false) is false then
      return false;
    end if;
    if p_evidence ? 'originalScore'
      and jsonb_typeof(p_evidence -> 'originalScore') = 'number'
      and coalesce((p_evidence ->> 'originalGradeReleased')::boolean, false) is false then
      return false;
    end if;
    if p_evidence ? 'retakeScore'
      and jsonb_typeof(p_evidence -> 'retakeScore') = 'number'
      and coalesce((p_evidence ->> 'retakeGradeReleased')::boolean, false) is false then
      return false;
    end if;
    for v_key, v_value in select key, value from jsonb_each(p_evidence) loop
      if v_key ~* 'score$'
        and jsonb_typeof(v_value) = 'number'
        and v_key not in ('score', 'originalScore', 'retakeScore') then
        return false;
      end if;
      if not private.completion_evidence_uses_released_scores(v_value) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_evidence) = 'array' then
    for v_value in select value from jsonb_array_elements(p_evidence) loop
      if not private.completion_evidence_uses_released_scores(v_value) then
        return false;
      end if;
    end loop;
  end if;
  return true;
exception when invalid_text_representation then
  return false;
end;
$$;

alter table public.student_course_completion_evaluations
  add constraint student_course_completion_evaluations_gap_shape_check
    check (private.completion_gaps_are_valid(missing_requirements)),
  add constraint student_course_completion_evaluations_released_scores_check
    check (private.completion_evidence_uses_released_scores(evidence_snapshot));

create or replace function private.build_completion_gap(
  p_key text,
  p_category text,
  p_title text,
  p_status text,
  p_reason text,
  p_href text,
  p_current_value numeric default null,
  p_required_value numeric default null,
  p_source_id text default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'key', p_key,
    'category', p_category,
    'title', p_title,
    'status', p_status,
    'currentValue', p_current_value,
    'requiredValue', p_required_value,
    'sourceId', p_source_id,
    'href', p_href,
    'reason', p_reason
  ));
$$;

-- Only released scores are selected here. computed_score is deliberately absent.
-- Attempts before the configured retake window are original attempts; attempts in
-- the retake window are retake attempts for students on the task retake list.
create or replace function private.completion_assignment_evidence(
  p_assignment_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
  v_retake_enabled boolean := false;
  v_original public.learning_submissions%rowtype;
  v_retake public.learning_submissions%rowtype;
  v_selected public.learning_submissions%rowtype;
  v_original_score numeric;
  v_retake_score numeric;
  v_score numeric;
  v_pending boolean := false;
  v_has_submission boolean := false;
  v_manual_count integer := 0;
begin
  select * into strict v_assignment
  from public.learning_assignments
  where id = p_assignment_id;

  v_retake_enabled := v_assignment.retake_paper_id is not null and exists (
    select 1
    from public.learning_assignment_retake_students as retake_student
    where retake_student.assignment_id = v_assignment.id
      and retake_student.student_id = p_student_id
  );

  select exists (
    select 1 from public.learning_submissions as submission
    where submission.assignment_id = v_assignment.id
      and submission.student_id = p_student_id
  ) into v_has_submission;

  select exists (
    select 1 from public.learning_submissions as submission
    where submission.assignment_id = v_assignment.id
      and submission.student_id = p_student_id
      and submission.submission_state in (
        'submitted_pending_grading',
        'objective_graded_pending_manual',
        'grading_completed'
      )
  ) into v_pending;

  select count(*) into v_manual_count
  from public.learning_assignment_questions as question
  where question.assignment_id = v_assignment.id
    and not question.auto_graded;

  select submission.* into v_original
  from public.learning_submissions as submission
  where submission.assignment_id = v_assignment.id
    and submission.student_id = p_student_id
    and submission.submission_state = 'grade_released'
    and submission.grade_released_at is not null
    and submission.score is not null
    and (
      not v_retake_enabled
      or submission.submitted_at < v_assignment.retake_starts_at
    )
  order by submission.submitted_at desc, submission.attempt_number desc
  limit 1;

  if v_original.id is not null then
    v_original_score := round(
      least(100, greatest(0,
        v_original.score * 100 / nullif(v_assignment.total_points, 0)
      )), 3
    );
  end if;

  if v_retake_enabled then
    select submission.* into v_retake
    from public.learning_submissions as submission
    where submission.assignment_id = v_assignment.id
      and submission.student_id = p_student_id
      and submission.submission_state = 'grade_released'
      and submission.grade_released_at is not null
      and submission.score is not null
      and submission.submitted_at >= v_assignment.retake_starts_at
    order by submission.submitted_at desc, submission.attempt_number desc
    limit 1;

    if v_retake.id is not null then
      v_retake_score := round(
        least(100, greatest(0,
          v_retake.score * 100 / nullif(v_assignment.total_points, 0)
        )), 3
      );
    end if;
  end if;

  if v_retake_score is null then
    v_score := v_original_score;
    v_selected := v_original;
  elsif v_original_score is null then
    v_score := v_retake_score;
    v_selected := v_retake;
  elsif v_assignment.retake_score_policy = 'highest' then
    if v_retake_score >= v_original_score then
      v_score := v_retake_score;
      v_selected := v_retake;
    else
      v_score := v_original_score;
      v_selected := v_original;
    end if;
  elsif v_assignment.retake_score_policy = 'latest' then
    v_score := v_retake_score;
    v_selected := v_retake;
  elsif v_assignment.retake_score_policy = 'weighted' then
    v_score := round(
      v_original_score * v_assignment.retake_original_weight_percent / 100
      + v_retake_score * (100 - v_assignment.retake_original_weight_percent) / 100,
      3
    );
    v_selected := v_retake;
  else
    raise exception '任务 % 的补考计分策略无效', v_assignment.id;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'assignmentId', v_assignment.id,
    'sourcePaperId', v_assignment.source_paper_id,
    'sourcePaperCode', v_assignment.source_paper_code,
    'href', '/dashboard/assignments/' || v_assignment.id,
    'hasSubmission', v_has_submission,
    'pendingGrading', v_pending and v_score is null,
    'manualQuestionCount', v_manual_count,
    'manualGradingComplete', not (v_manual_count > 0 and v_pending and v_score is null),
    'gradeReleased', v_score is not null,
    'score', v_score,
    'releasedSubmissionId', v_selected.id,
    'releasedAt', v_selected.grade_released_at,
    'retake', jsonb_strip_nulls(jsonb_build_object(
      'enabled', v_retake_enabled,
      'policy', case when v_retake_enabled then v_assignment.retake_score_policy end,
      'originalWeightPercent', case when v_retake_enabled
        then v_assignment.retake_original_weight_percent end,
      'originalGradeReleased', v_original_score is not null,
      'retakeGradeReleased', v_retake_score is not null,
      'originalScore', v_original_score,
      'retakeScore', v_retake_score
    ))
  ));
end;
$$;

revoke all on function private.completion_assignment_evidence(uuid, uuid)
  from public;

create or replace function public.evaluate_student_course_completion(
  p_student_id uuid,
  p_course_id uuid,
  p_policy_id uuid default null
)
returns public.student_course_completion_evaluations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_algorithm_version constant text := 'k1-completion-v1.0.1';
  v_course public.courses%rowtype;
  v_policy public.course_completion_policies%rowtype;
  v_tenant_id uuid;
  v_tenant_count integer;
  v_course_href text := '/dashboard/courses';
  v_requirements jsonb;
  v_policy_snapshot jsonb;
  v_evidence jsonb := '{}'::jsonb;
  v_gaps jsonb := '[]'::jsonb;
  v_textbook_evidence jsonb := '[]'::jsonb;
  v_assignment_evidence jsonb := '[]'::jsonb;
  v_chapter_exam_evidence jsonb := '[]'::jsonb;
  v_stage_evidence jsonb := '[]'::jsonb;
  v_midterm_evidence jsonb;
  v_final_evidence jsonb;
  v_item_evidence jsonb;
  v_item record;
  v_chapter record;
  v_required integer;
  v_min_completed integer;
  v_min_passed integer;
  v_completed integer := 0;
  v_passed integer := 0;
  v_assigned integer := 0;
  v_needed integer := 0;
  v_added integer := 0;
  v_score numeric;
  v_passing numeric;
  v_pending_count integer := 0;
  v_manual_pending_count integer := 0;
  v_requires_grading boolean := false;
  v_requires_submission boolean := false;
  v_requirement_satisfied boolean := false;
  v_has_unavailable_requirement boolean := false;
  v_overall_score numeric;
  v_overall_published boolean := false;
  v_overall_exists boolean := false;
  v_overall_item_id uuid;
  v_overall_href constant text := '/dashboard/grades';
  v_maximum_gaps integer;
  v_gap_count integer;
  v_status text;
  v_eligible boolean;
  v_fingerprint text;
  v_result public.student_course_completion_evaluations%rowtype;
begin
  if p_student_id is null or p_course_id is null then
    raise exception 'student_id 和 course_id 不能为空';
  end if;

  select * into v_course from public.courses where id = p_course_id;
  if not found or v_course.student_app_id is null then
    raise exception '课程不存在或未关联学习应用';
  end if;

  select count(distinct membership.tenant_id)
  into v_tenant_count
  from public.tenant_memberships as membership
  join public.student_app_enrollments as enrollment
    on enrollment.tenant_id = membership.tenant_id
   and enrollment.student_id = membership.user_id
   and enrollment.app_id = v_course.student_app_id
   and enrollment.status = 'active'
   and enrollment.starts_at <= now()
   and (enrollment.ends_at is null or enrollment.ends_at > now())
  where membership.user_id = p_student_id
    and membership.role = 'student'
    and membership.status = 'active';

  select membership.tenant_id into v_tenant_id
  from public.tenant_memberships as membership
  join public.student_app_enrollments as enrollment
    on enrollment.tenant_id = membership.tenant_id
   and enrollment.student_id = membership.user_id
   and enrollment.app_id = v_course.student_app_id
   and enrollment.status = 'active'
   and enrollment.starts_at <= now()
   and (enrollment.ends_at is null or enrollment.ends_at > now())
  where membership.user_id = p_student_id
    and membership.role = 'student'
    and membership.status = 'active'
  order by membership.is_default desc, membership.joined_at
  limit 1;

  if v_tenant_id is null then
    raise exception '学生没有该课程学习应用的有效机构学籍';
  elsif v_tenant_count > 1 and not exists (
    select 1 from public.tenant_memberships
    where user_id = p_student_id and tenant_id = v_tenant_id and is_default
  ) then
    raise exception '学生在多个机构拥有该应用学籍，但未设置默认机构';
  end if;

  if p_policy_id is null then
    select * into v_policy
    from public.course_completion_policies as policy
    where policy.course_id = p_course_id
      and policy.student_app_id = v_course.student_app_id
      and policy.status = 'published'
      and policy.is_default
      and policy.effective_from <= now()
      and (policy.effective_until is null or policy.effective_until > now())
    order by policy.effective_from desc
    limit 1;
  else
    select * into v_policy
    from public.course_completion_policies as policy
    where policy.id = p_policy_id
      and policy.course_id = p_course_id
      and policy.student_app_id = v_course.student_app_id
      and policy.status in ('published', 'retired');
  end if;
  if v_policy.id is null then
    raise exception '没有找到该课程可用于资格计算的已发布政策';
  end if;

  v_requirements := v_policy.requirements;
  v_policy_snapshot := jsonb_build_object(
    'id', v_policy.id,
    'policyCode', v_policy.policy_code,
    'version', v_policy.version,
    'title', v_policy.title,
    'publishedAt', v_policy.published_at,
    'effectiveFrom', v_policy.effective_from,
    'effectiveUntil', v_policy.effective_until,
    'requirements', v_requirements
  );

  select '/dashboard/courses/' || parent.slug || '/' || subcategory.slug || '/'
      || v_course.slug || '/' || lesson.slug
  into v_course_href
  from public.lessons as lesson
  join public.course_categories as subcategory on subcategory.id = v_course.category_id
  join public.course_categories as parent on parent.id = subcategory.parent_id
  where lesson.course_id = v_course.id
    and exists (
      select 1 from public.course_tests as test
      where test.lesson_id = lesson.id and test.course_key = 'korean-level-one'
    )
  order by lesson.sort_order
  limit 1;
  v_course_href := coalesce(v_course_href, '/dashboard/courses');

  -- Resolve each required chapter through the real digital-textbook catalog.
  -- Published assessment seed snapshots may share course/chapter metadata, but
  -- they are not linked from digital_textbook_chapters and must never become
  -- completion requirements. course_ebook_progress is the authoritative
  -- chapter-completion projection maintained from real textbook activity.
  v_required := (v_requirements #>> '{textbook,required_chapter_count}')::integer;
  v_completed := 0;
  for v_chapter in
    select expected.chapter_number, canonical.source_id, canonical.slug,
      progress.completed_at
    from generate_series(1, v_required) as expected(chapter_number)
    left join lateral (
      select chapter.id as source_id, test.slug
      from public.digital_textbooks as textbook
      join public.lessons as textbook_lesson
        on textbook_lesson.id = textbook.lesson_id
       and textbook_lesson.course_id = v_course.id
      join public.digital_textbook_versions as version
        on version.textbook_id = textbook.id
      join public.digital_textbook_chapters as chapter
        on chapter.version_id = version.id
       and chapter.chapter_number = expected.chapter_number
      join public.chapter_tests as test
        on test.id = chapter.chapter_test_id
       and test.student_app_id = v_course.student_app_id
      order by
        case version.status when 'published' then 0 when 'draft' then 1 else 2 end,
        version.version_number desc,
        chapter.updated_at desc
      limit 1
    ) as canonical on true
    left join public.course_ebook_progress as progress
      on progress.tenant_id = v_tenant_id
     and progress.student_id = p_student_id
     and progress.student_app_id = v_course.student_app_id
     and progress.test_slug = canonical.slug
    order by expected.chapter_number
  loop
    if v_chapter.completed_at is not null then v_completed := v_completed + 1; end if;
    v_textbook_evidence := v_textbook_evidence || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'chapterNumber', v_chapter.chapter_number,
        'sourceId', v_chapter.source_id,
        'testSlug', v_chapter.slug,
        'completed', v_chapter.completed_at is not null,
        'completedAt', v_chapter.completed_at,
        'href', v_course_href || case when v_chapter.slug is not null
          then '?chapter=' || v_chapter.slug else '' end
      ))
    );
    if v_chapter.completed_at is null then
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'textbook:chapter:' || v_chapter.chapter_number,
        'course', '第' || v_chapter.chapter_number || '章教材', 'in_progress',
        '第' || v_chapter.chapter_number || '章教材尚未完成。',
        v_course_href || case when v_chapter.slug is not null
          then '?chapter=' || v_chapter.slug else '' end,
        0, 1, v_chapter.source_id::text
      ));
    end if;
  end loop;

  -- Required homework is deduplicated by source paper (or assignment when native).
  v_required := 0;
  v_completed := 0;
  v_requires_grading := coalesce(
    (v_requirements #>> '{required_assignments,require_graded}')::boolean,
    false
  );
  v_requires_submission := coalesce(
    (v_requirements #>> '{required_assignments,require_submitted}')::boolean,
    false
  );
  if coalesce((v_requirements #>> '{required_assignments,require_all_assigned}')::boolean, false) then
    for v_item in
      with applicable as (
        select assignment.*,
          coalesce(assignment.source_paper_id::text, assignment.id::text) as item_key,
          private.completion_assignment_evidence(assignment.id, p_student_id) as evidence
        from public.learning_assignments as assignment
        where assignment.tenant_id = v_tenant_id
          and assignment.student_app_id = v_course.student_app_id
          and assignment.course_id = v_course.id
          and assignment.assignment_type = 'homework'
          and assignment.status in ('published', 'closed')
          and (assignment.target_scope = 'all_students' or exists (
            select 1 from public.learning_assignment_targets as target
            where target.assignment_id = assignment.id
              and target.student_id = p_student_id
          ))
      ), ranked as (
        select *, row_number() over (
          partition by item_key
          order by (evidence ->> 'score')::numeric desc nulls last, created_at desc
        ) as rank
        from applicable
      )
      select * from ranked where rank = 1 order by item_key
    loop
      v_required := v_required + 1;
      v_item_evidence := v_item.evidence || jsonb_build_object(
        'itemKey', 'assignment:' || v_item.item_key,
        'title', v_item.title
      );
      v_assignment_evidence := v_assignment_evidence || jsonb_build_array(v_item_evidence);
      v_requirement_satisfied := case
        when v_requires_grading then (v_item_evidence ->> 'score') is not null
        when v_requires_submission then coalesce(
          (v_item_evidence ->> 'hasSubmission')::boolean, false
        )
        else true
      end;
      if v_requirement_satisfied then
        v_completed := v_completed + 1;
      else
        if v_requires_grading
          and coalesce((v_item_evidence ->> 'pendingGrading')::boolean, false) then
          v_pending_count := v_pending_count + 1;
          v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
            'assignment:' || v_item.item_key, 'assignment', v_item.title,
            'pending_grading', v_item.title || '已提交，成绩尚未发布。',
            v_item_evidence ->> 'href', null, null, v_item.id::text
          ));
        elsif coalesce((v_item_evidence ->> 'hasSubmission')::boolean, false) then
          v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
            'assignment:' || v_item.item_key, 'assignment', v_item.title,
            'in_progress', v_item.title || '已提交但尚未形成有效的已发布成绩。',
            v_item_evidence ->> 'href', null, null, v_item.id::text
          ));
        else
          v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
            'assignment:' || v_item.item_key, 'assignment', v_item.title,
            'missing', v_item.title || '尚未提交。',
            v_item_evidence ->> 'href', 0, 1, v_item.id::text
          ));
        end if;
      end if;
    end loop;
  end if;

  -- Formal chapter exams are identified only by source paper id + canonical code.
  v_min_completed := (v_requirements #>> '{formal_chapter_exams,minimum_completed_count}')::integer;
  v_min_passed := (v_requirements #>> '{formal_chapter_exams,minimum_passed_count}')::integer;
  v_passing := (v_requirements #>> '{formal_chapter_exams,passing_score}')::numeric;
  v_completed := 0; v_passed := 0; v_assigned := 0;
  for v_item in
    with applicable as (
      select assignment.*, paper.source_test_id,
        test.chapter_number,
        '/dashboard/practice/course/' || v_course.slug || '/' || chapter.slug
          as practice_href,
        private.completion_assignment_evidence(assignment.id, p_student_id) as evidence
      from public.learning_assignments as assignment
      join public.assessment_papers as paper
        on paper.id = assignment.source_paper_id
       and paper.paper_code = assignment.source_paper_code
      join public.course_tests as test on test.id = paper.source_test_id
      join public.lessons as lesson
        on lesson.id = test.lesson_id and lesson.course_id = v_course.id
      left join public.course_chapters as chapter
        on chapter.lesson_id = lesson.id
       and chapter.chapter_test_id = test.id
       and chapter.is_published
      where assignment.tenant_id = v_tenant_id
        and assignment.student_app_id = v_course.student_app_id
        and assignment.course_id = v_course.id
        and assignment.status in ('published', 'closed')
        and paper.paper_code ~ '^EX-K1-(0[1-9]|1[0-6])-V[0-9]+$'
        and (assignment.target_scope = 'all_students' or exists (
          select 1 from public.learning_assignment_targets as target
          where target.assignment_id = assignment.id and target.student_id = p_student_id
        ))
    ), ranked as (
      select *, row_number() over (
        partition by chapter_number
        order by (evidence ->> 'score')::numeric desc nulls last, created_at desc
      ) as rank from applicable
    )
    select * from ranked where rank = 1 order by chapter_number
  loop
    v_assigned := v_assigned + 1;
    v_item_evidence := v_item.evidence || jsonb_build_object(
      'itemKey', 'chapter-exam:' || v_item.chapter_number,
      'chapterNumber', v_item.chapter_number,
      'practiceHref', v_item.practice_href
    );
    v_chapter_exam_evidence := v_chapter_exam_evidence || jsonb_build_array(v_item_evidence);
    v_score := (v_item_evidence ->> 'score')::numeric;
    if v_score is not null then
      v_completed := v_completed + 1;
      if v_score >= v_passing then v_passed := v_passed + 1; end if;
    end if;
  end loop;

  -- Only the policy's minimum counts are blocking. Additional assigned chapter
  -- exams remain auditable evidence but do not create duplicate/extra gaps.
  v_needed := greatest(0, v_min_completed - v_completed);
  v_added := 0;
  for v_item in
    select item
    from jsonb_array_elements(v_chapter_exam_evidence) as item
    where item ->> 'score' is null
    order by (item ->> 'chapterNumber')::integer
  loop
    exit when v_added >= v_needed;
    v_item_evidence := v_item.item;
    if coalesce((v_item_evidence ->> 'pendingGrading')::boolean, false) then
      v_pending_count := v_pending_count + 1;
      if (v_item_evidence ->> 'manualQuestionCount')::integer > 0 then
        v_manual_pending_count := v_manual_pending_count + 1;
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          'manual-grading:chapter:' || (v_item_evidence ->> 'chapterNumber'),
          'manual_grading',
          '第' || (v_item_evidence ->> 'chapterNumber') || '章正式考试人工批改',
          'pending_grading',
          '第' || (v_item_evidence ->> 'chapterNumber')
            || '章正式考试的口语或写作题正在等待老师批改并发布成绩。',
          v_item_evidence ->> 'href', null, null,
          v_item_evidence ->> 'assignmentId'
        ));
      else
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          'chapter-exam:' || (v_item_evidence ->> 'chapterNumber'),
          'chapter_exam',
          '第' || (v_item_evidence ->> 'chapterNumber') || '章正式考试',
          'pending_grading',
          '第' || (v_item_evidence ->> 'chapterNumber')
            || '章正式考试已提交，成绩尚未发布。',
          v_item_evidence ->> 'href', null, null,
          v_item_evidence ->> 'assignmentId'
        ));
      end if;
    else
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'chapter-exam:' || (v_item_evidence ->> 'chapterNumber'),
        'chapter_exam',
        '第' || (v_item_evidence ->> 'chapterNumber') || '章正式考试',
        case when coalesce((v_item_evidence ->> 'hasSubmission')::boolean, false)
          then 'in_progress' else 'missing' end,
        '第' || (v_item_evidence ->> 'chapterNumber')
          || '章正式考试尚未完成并发布成绩。',
        v_item_evidence ->> 'href', 0, 1,
        v_item_evidence ->> 'assignmentId'
      ));
    end if;
    v_added := v_added + 1;
  end loop;

  v_needed := greatest(0, v_min_passed - v_passed);
  v_added := 0;
  for v_item in
    select item
    from jsonb_array_elements(v_chapter_exam_evidence) as item
    where item ->> 'score' is not null
      and (item ->> 'score')::numeric < v_passing
    order by (item ->> 'score')::numeric desc,
      (item ->> 'chapterNumber')::integer
  loop
    exit when v_added >= v_needed;
    v_item_evidence := v_item.item;
    v_score := (v_item_evidence ->> 'score')::numeric;
    v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
      'chapter-exam:' || (v_item_evidence ->> 'chapterNumber'),
      'chapter_exam',
      '第' || (v_item_evidence ->> 'chapterNumber') || '章正式考试', 'failed',
      '第' || (v_item_evidence ->> 'chapterNumber') || '章正式考试成绩为'
        || v_score || '分，政策要求' || v_passing || '分。',
      v_item_evidence ->> 'practiceHref',
      v_score, v_passing,
      v_item_evidence ->> 'assignmentId'
    ));
    v_added := v_added + 1;
  end loop;

  if v_assigned < v_min_completed then
    v_has_unavailable_requirement := true;
    v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
      'chapter-exam:assigned-count', 'chapter_exam', '正式章节考试', 'missing',
      '当前仅布置' || v_assigned || '套正式章节考试，政策要求至少完成'
        || v_min_completed || '套。',
      null, v_assigned, v_min_completed, null
    ));
  end if;

  -- Four canonical stage items. Missing delivery is a not_ready condition.
  v_required := (v_requirements #>> '{stage_exams,required_count}')::integer;
  v_completed := 0;
  for v_item in select generate_series(1, v_required) as stage_number loop
    v_item_evidence := null;
    select candidate.evidence || jsonb_build_object(
      'itemKey', 'stage-exam:' || v_item.stage_number,
      'stageNumber', v_item.stage_number
    ) into v_item_evidence
    from (
      select private.completion_assignment_evidence(assignment.id, p_student_id) as evidence
      from public.learning_assignments as assignment
      join public.assessment_papers as paper
        on paper.id = assignment.source_paper_id
       and paper.paper_code = assignment.source_paper_code
      where assignment.tenant_id = v_tenant_id
        and assignment.course_id = v_course.id
        and assignment.student_app_id = v_course.student_app_id
        and assignment.status in ('published', 'closed')
        and paper.paper_code = 'EX-K1-ST0' || v_item.stage_number || '-V1'
        and (assignment.target_scope = 'all_students' or exists (
          select 1 from public.learning_assignment_targets as target
          where target.assignment_id = assignment.id and target.student_id = p_student_id
        ))
      order by ((private.completion_assignment_evidence(
        assignment.id, p_student_id
      ) ->> 'score')::numeric) desc nulls last, assignment.created_at desc
      limit 1
    ) as candidate;
    if v_item_evidence is null then
      v_has_unavailable_requirement := true;
      v_item_evidence := jsonb_build_object(
        'itemKey', 'stage-exam:' || v_item.stage_number,
        'stageNumber', v_item.stage_number,
        'assigned', false,
        'gradeReleased', false,
        'href', null
      );
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'stage-exam:' || v_item.stage_number, 'stage_exam',
        '第' || v_item.stage_number || '阶段考试', 'missing',
        '第' || v_item.stage_number || '阶段考试尚未布置。',
        null, 0, 1, null
      ));
    elsif (v_item_evidence ->> 'score') is not null then
      v_completed := v_completed + 1;
    elsif coalesce((v_item_evidence ->> 'pendingGrading')::boolean, false) then
      v_pending_count := v_pending_count + 1;
      if (v_item_evidence ->> 'manualQuestionCount')::integer > 0 then
        v_manual_pending_count := v_manual_pending_count + 1;
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          'manual-grading:stage:' || v_item.stage_number, 'manual_grading',
          '第' || v_item.stage_number || '阶段考试人工批改', 'pending_grading',
          '第' || v_item.stage_number || '阶段考试的口语或写作题正在等待老师批改并发布成绩。',
          v_item_evidence ->> 'href', null, null,
          v_item_evidence ->> 'assignmentId'
        ));
      else
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          'stage-exam:' || v_item.stage_number, 'stage_exam',
          '第' || v_item.stage_number || '阶段考试', 'pending_grading',
          '第' || v_item.stage_number || '阶段考试已提交，成绩尚未发布。',
          v_item_evidence ->> 'href', null, null,
          v_item_evidence ->> 'assignmentId'
        ));
      end if;
    else
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'stage-exam:' || v_item.stage_number, 'stage_exam',
        '第' || v_item.stage_number || '阶段考试', 'missing',
        '第' || v_item.stage_number || '阶段考试尚未完成并发布成绩。',
        v_item_evidence ->> 'href', 0, 1,
        v_item_evidence ->> 'assignmentId'
      ));
    end if;
    v_stage_evidence := v_stage_evidence || jsonb_build_array(v_item_evidence);
  end loop;

  -- Midterm and final are exact canonical mother-paper codes, never title matches.
  for v_item in
    select * from (values
      ('midterm', 'EX-K1-MID-V1', 'midterm_exam', '期中考试',
        (v_requirements #>> '{midterm_exam,passing_score}')::numeric),
      ('final', 'EX-K1-FIN-V1', 'final_exam', '期末考试',
        (v_requirements #>> '{final_exam,passing_score}')::numeric)
    ) as requirement(kind, paper_code, category, title, passing_score)
  loop
    v_item_evidence := null;
    select candidate.evidence || jsonb_build_object(
      'itemKey', v_item.kind || '-exam', 'motherPaperCode', v_item.paper_code
    ) into v_item_evidence
    from (
      select private.completion_assignment_evidence(assignment.id, p_student_id) as evidence
      from public.learning_assignments as assignment
      join public.assessment_papers as paper
        on paper.id = assignment.source_paper_id
       and paper.paper_code = assignment.source_paper_code
      where assignment.tenant_id = v_tenant_id
        and assignment.course_id = v_course.id
        and assignment.student_app_id = v_course.student_app_id
        and assignment.status in ('published', 'closed')
        and paper.paper_code = v_item.paper_code
        and (assignment.target_scope = 'all_students' or exists (
          select 1 from public.learning_assignment_targets as target
          where target.assignment_id = assignment.id and target.student_id = p_student_id
        ))
      order by ((private.completion_assignment_evidence(
        assignment.id, p_student_id
      ) ->> 'score')::numeric) desc nulls last, assignment.created_at desc
      limit 1
    ) as candidate;
    if v_item_evidence is null then
      v_has_unavailable_requirement := true;
      v_item_evidence := jsonb_build_object(
        'itemKey', v_item.kind || '-exam',
        'motherPaperCode', v_item.paper_code,
        'assigned', false,
        'gradeReleased', false,
        'href', null
      );
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        v_item.kind || '-exam', v_item.category, v_item.title, 'missing',
        v_item.title || '尚未布置。', null,
        0, v_item.passing_score, null
      ));
    else
      v_score := (v_item_evidence ->> 'score')::numeric;
      if v_score is not null and v_score < v_item.passing_score then
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          v_item.kind || '-exam', v_item.category, v_item.title, 'failed',
          v_item.title || '成绩为' || v_score || '分，政策要求'
            || v_item.passing_score || '分。',
          v_item_evidence ->> 'href', v_score, v_item.passing_score,
          v_item_evidence ->> 'assignmentId'
        ));
      elsif v_score is null
        and coalesce((v_item_evidence ->> 'pendingGrading')::boolean, false) then
        v_pending_count := v_pending_count + 1;
        if (v_item_evidence ->> 'manualQuestionCount')::integer > 0 then
          v_manual_pending_count := v_manual_pending_count + 1;
          v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
            'manual-grading:' || v_item.kind, 'manual_grading',
            v_item.title || '口语写作批改', 'pending_grading',
            v_item.title || '口语或写作题正在等待老师批改并发布成绩。',
            v_item_evidence ->> 'href', null, null,
            v_item_evidence ->> 'assignmentId'
          ));
        else
          v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
            v_item.kind || '-exam', v_item.category, v_item.title,
            'pending_grading', v_item.title || '已提交，成绩尚未发布。',
            v_item_evidence ->> 'href', null, v_item.passing_score,
            v_item_evidence ->> 'assignmentId'
          ));
        end if;
      elsif v_score is null then
        v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
          v_item.kind || '-exam', v_item.category, v_item.title,
          case when coalesce((v_item_evidence ->> 'hasSubmission')::boolean, false)
            then 'in_progress' else 'missing' end,
          v_item.title || '尚未完成并发布成绩。',
          v_item_evidence ->> 'href', 0, v_item.passing_score,
          v_item_evidence ->> 'assignmentId'
        ));
      end if;
    end if;
    if v_item.kind = 'midterm' then v_midterm_evidence := v_item_evidence;
    else v_final_evidence := v_item_evidence; end if;
  end loop;

  -- Overall score is the latest released course/final grade-center item.
  select true, grade_item.id,
    round(least(100, greatest(0,
      grade_record.score * 100 / nullif(grade_item.total_points, 0)
    )), 3)
  into v_overall_published, v_overall_item_id, v_overall_score
  from public.grade_items as grade_item
  join public.grade_records as grade_record
    on grade_record.tenant_id = grade_item.tenant_id
   and grade_record.item_id = grade_item.id
   and grade_record.student_id = p_student_id
   and grade_record.record_status = 'graded'
   and grade_record.score is not null
  where grade_item.tenant_id = v_tenant_id
    and (
      grade_item.course_id = v_course.id
      or exists (
        select 1 from public.learning_assignments as source_assignment
        where source_assignment.id = grade_item.source_assignment_id
          and source_assignment.tenant_id = grade_item.tenant_id
          and source_assignment.course_id = v_course.id
      )
    )
    and grade_item.item_type in ('course', 'final')
    and grade_item.status = 'published'
    and grade_item.published_at is not null
  order by grade_item.published_at desc, grade_record.graded_at desc
  limit 1;

  select exists (
    select 1 from public.grade_items as grade_item
    where grade_item.tenant_id = v_tenant_id
      and (
        grade_item.course_id = v_course.id
        or exists (
          select 1 from public.learning_assignments as source_assignment
          where source_assignment.id = grade_item.source_assignment_id
            and source_assignment.tenant_id = grade_item.tenant_id
            and source_assignment.course_id = v_course.id
        )
      )
      and grade_item.item_type in ('course', 'final')
  ) into v_overall_exists;

  v_passing := (v_requirements #>> '{overall_score,minimum_score}')::numeric;
  if v_overall_score is null then
    if v_overall_exists then
      v_pending_count := v_pending_count + 1;
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'overall-score', 'overall_score', '综合成绩', 'pending_grading',
        '综合成绩尚未发布，未发布分数不计入结课资格。',
        null, null, v_passing, null
      ));
    else
      v_has_unavailable_requirement := true;
      v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
        'overall-score', 'overall_score', '综合成绩', 'missing',
        '尚未生成并发布综合成绩，政策要求达到' || v_passing || '分。',
        null, null, v_passing, null
      ));
    end if;
  elsif v_overall_score < v_passing then
    v_gaps := v_gaps || jsonb_build_array(private.build_completion_gap(
      'overall-score', 'overall_score', '综合成绩', 'failed',
      '综合成绩为' || v_overall_score || '分，政策要求' || v_passing || '分。',
      null, v_overall_score, v_passing, v_overall_item_id::text
    ));
  end if;

  v_evidence := jsonb_build_object(
    'course', jsonb_build_object(
      'courseId', v_course.id,
      'studentAppId', v_course.student_app_id,
      'tenantId', v_tenant_id
    ),
    'textbook', jsonb_build_object(
      'requiredChapterCount',
        (v_requirements #>> '{textbook,required_chapter_count}')::integer,
      'completedChapterCount',
        (select count(*) from jsonb_array_elements(v_textbook_evidence) item
          where (item ->> 'completed')::boolean),
      'chapters', v_textbook_evidence
    ),
    'requiredAssignments', v_assignment_evidence,
    'formalChapterExams', v_chapter_exam_evidence,
    'stageExams', v_stage_evidence,
    'midtermExam', v_midterm_evidence,
    'finalExam', v_final_evidence,
    'subjectiveGrading', jsonb_build_object(
      'required', coalesce((v_requirements #>>
        '{subjective_grading,require_all_certification_items_graded}')::boolean, false),
      'pendingCount', v_manual_pending_count,
      'complete', v_manual_pending_count = 0
    ),
    'overallScore', jsonb_strip_nulls(jsonb_build_object(
      'gradeItemId', v_overall_item_id,
      'published', v_overall_published,
      'score', v_overall_score,
      'href', v_overall_href
    )),
    'authoritativePaperCodes', jsonb_build_object(
      'midterm', 'EX-K1-MID-V1',
      'final', 'EX-K1-FIN-V1',
      'stage', jsonb_build_array(
        'EX-K1-ST01-V1', 'EX-K1-ST02-V1',
        'EX-K1-ST03-V1', 'EX-K1-ST04-V1'
      )
    )
  );

  v_gap_count := jsonb_array_length(v_gaps);
  v_maximum_gaps := (v_requirements #>> '{blocking_gaps,maximum_allowed_count}')::integer;
  v_eligible := v_gap_count <= v_maximum_gaps;
  v_status := case
    when v_eligible then 'eligible'
    when v_pending_count > 0 then 'pending_grading'
    when v_has_unavailable_requirement then 'not_ready'
    else 'not_eligible'
  end;

  v_fingerprint := md5(concat_ws('|',
    v_algorithm_version, v_policy.id::text, v_policy.version::text,
    v_policy_snapshot::text, v_evidence::text, v_gaps::text,
    v_status, v_eligible::text, coalesce(v_overall_score::text, '')
  ));

  perform pg_advisory_xact_lock(hashtextextended(
    v_tenant_id::text || ':' || p_student_id::text || ':' || p_course_id::text,
    0
  ));

  select * into v_result
  from public.student_course_completion_evaluations
  where tenant_id = v_tenant_id
    and student_id = p_student_id
    and course_id = p_course_id
    and policy_id = v_policy.id
    and evaluation_version = v_algorithm_version
    and evaluation_fingerprint = v_fingerprint;

  if v_result.id is not null and v_result.status <> 'superseded' then
    return v_result;
  end if;

  update public.student_course_completion_evaluations
  set status = 'superseded', updated_at = now()
  where tenant_id = v_tenant_id
    and student_id = p_student_id
    and course_id = p_course_id
    and policy_id = v_policy.id
    and evaluation_version = v_algorithm_version
    and evaluation_fingerprint <> v_fingerprint
    and status <> 'superseded';

  if v_result.id is not null then
    update public.student_course_completion_evaluations
    set status = v_status,
        eligible = v_eligible,
        updated_at = now()
    where id = v_result.id
    returning * into v_result;
    return v_result;
  end if;

  insert into public.student_course_completion_evaluations (
    tenant_id, student_id, student_app_id, course_id,
    policy_id, policy_version, status, eligible, overall_score,
    requirements_snapshot, evidence_snapshot, missing_requirements,
    evaluated_at, evaluation_version, evaluation_fingerprint
  ) values (
    v_tenant_id, p_student_id, v_course.student_app_id, p_course_id,
    v_policy.id, v_policy.version, v_status, v_eligible, v_overall_score,
    v_policy_snapshot, v_evidence, v_gaps,
    clock_timestamp(), v_algorithm_version, v_fingerprint
  ) returning * into v_result;

  return v_result;
end;
$$;

comment on function public.evaluate_student_course_completion(uuid, uuid, uuid) is
  '按已发布政策和权威学习证据幂等计算单学生结课资格；仅供 service_role 调用。';

revoke all on function public.evaluate_student_course_completion(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.evaluate_student_course_completion(uuid, uuid, uuid)
  to service_role;

-- Direct mutation is no longer an institution-client capability. Institution
-- workflows invoke the service-role RPC and retain their existing read access.
revoke insert, update, delete
  on public.student_course_completion_evaluations from authenticated;

commit;
