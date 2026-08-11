begin;

-- request_source_grade_review did an unlocked check-then-act: SELECT for an
-- existing pending/reviewing request, then INSERT if none was found. Two
-- concurrent calls (double-click, or two tabs) can both pass the SELECT
-- before either commits, and the second INSERT then fails on
-- grade_review_requests_source_result_unique_idx with a raw Postgres
-- constraint-violation error instead of the friendly "already has a pending
-- review" message. Serialize with an advisory lock, matching the same
-- pattern already used for course_test_attempts submissions.
create or replace function public.request_source_grade_review(
  p_source_type text,
  p_source_result_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_review_id uuid;
  v_existing_status text;
  v_source_title text;
  v_source_score numeric;
  v_source_total numeric;
  v_source_context jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception '请先登录后再申请成绩复核';
  end if;

  if p_source_type not in ('assignment_submission', 'chapter_test_attempt') then
    raise exception '成绩来源不正确';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) not between 2 and 2000 then
    raise exception '复核原因需要填写 2 至 2000 个字';
  end if;

  -- 同一学生对同一条成绩的复核申请必须串行处理，避免双击并发时
  -- 两个事务都读到"尚无申请"，其中一个撞唯一索引报出原始数据库错误。
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      coalesce(v_tenant_id::text, '') || ':' || auth.uid()::text || ':' ||
        p_source_type || ':' || p_source_result_id::text,
      0
    )
  );

  if p_source_type = 'assignment_submission' then
    select
      assignment.title,
      submission.score,
      assignment.total_points,
      jsonb_build_object(
        'assignment_id', assignment.id,
        'assignment_type', assignment.assignment_type,
        'attempt_number', submission.attempt_number
      )
    into
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.tenant_id = submission.tenant_id
     and assignment.id = submission.assignment_id
    where submission.tenant_id = v_tenant_id
      and submission.id = p_source_result_id
      and submission.student_id = auth.uid()
      and submission.status = 'graded'
      and submission.score is not null;
  else
    select
      coalesce(test.title, attempt.test_slug),
      attempt.score,
      100,
      jsonb_build_object(
        'test_slug', attempt.test_slug,
        'correct_count', attempt.correct_count,
        'total_questions', attempt.total_questions,
        'passed', attempt.passed
      )
    into
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context
    from public.chapter_test_attempts as attempt
    left join public.chapter_tests as test
      on test.slug = attempt.test_slug
    where attempt.tenant_id = v_tenant_id
      and attempt.id = p_source_result_id
      and attempt.student_id = auth.uid();
  end if;

  if v_source_title is null then
    raise exception '未找到可复核的成绩记录';
  end if;

  select review.id, review.status
  into v_review_id, v_existing_status
  from public.grade_review_requests as review
  where review.tenant_id = v_tenant_id
    and review.student_id = auth.uid()
    and review.source_type = p_source_type
    and review.source_result_id = p_source_result_id;

  if v_existing_status in ('pending', 'reviewing') then
    raise exception '该成绩已有正在处理的复核申请';
  end if;

  if v_review_id is null then
    insert into public.grade_review_requests (
      tenant_id,
      record_id,
      student_id,
      source_type,
      source_result_id,
      source_title,
      source_score,
      source_total_points,
      source_context,
      reason
    )
    values (
      v_tenant_id,
      null,
      auth.uid(),
      p_source_type,
      p_source_result_id,
      v_source_title,
      v_source_score,
      v_source_total,
      v_source_context,
      trim(p_reason)
    )
    returning id into v_review_id;
  else
    update public.grade_review_requests
    set
      source_title = v_source_title,
      source_score = v_source_score,
      source_total_points = v_source_total,
      source_context = v_source_context,
      reason = trim(p_reason),
      status = 'pending',
      response = '',
      handled_by = null,
      requested_at = now(),
      handled_at = null,
      updated_at = now()
    where id = v_review_id;
  end if;

  return v_review_id;
end;
$function$;

revoke all on function public.request_source_grade_review(text, uuid, text)
  from public, anon;
grant execute on function public.request_source_grade_review(text, uuid, text)
  to authenticated;

comment on function public.request_source_grade_review(text, uuid, text) is
  '学生针对本人真实作业提交或章节测试结果发起成绩复核；同一来源的申请用 advisory lock 串行化，避免并发重复申请撞唯一索引报出原始数据库错误。';

commit;
