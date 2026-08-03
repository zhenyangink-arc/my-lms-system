begin;

-- 平台负责人只读取机构级成绩运行指标，不返回学生编号、姓名、单人成绩或答题数据。
create or replace function public.get_platform_grade_overview()
returns table (
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  tenant_status text,
  active_student_count bigint,
  published_assignment_count bigint,
  grade_record_count bigint,
  average_score_percent numeric,
  pass_rate_percent numeric,
  pending_review_count bigint,
  last_grade_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以查看机构成绩运行概览';
  end if;

  return query
  with active_students as (
    select membership.tenant_id, count(*)::bigint as student_count
    from public.tenant_memberships as membership
    where membership.role = 'student'
      and membership.status = 'active'
    group by membership.tenant_id
  ),
  published_assignments as (
    select assignment.tenant_id, count(*)::bigint as assignment_count
    from public.learning_assignments as assignment
    where assignment.status in ('published', 'closed')
    group by assignment.tenant_id
  ),
  latest_assignment_submissions as (
    select distinct on (
      submission.tenant_id,
      submission.assignment_id,
      submission.student_id
    )
      submission.tenant_id,
      submission.score,
      assignment.total_points,
      coalesce(submission.graded_at, submission.submitted_at) as recorded_at
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.tenant_id = submission.tenant_id
     and assignment.id = submission.assignment_id
    where submission.status = 'graded'
      and submission.score is not null
      and assignment.total_points > 0
    order by
      submission.tenant_id,
      submission.assignment_id,
      submission.student_id,
      submission.attempt_number desc,
      coalesce(submission.graded_at, submission.submitted_at) desc,
      submission.id desc
  ),
  grade_rows as (
    select
      submission.tenant_id,
      (submission.score / submission.total_points * 100)::numeric as score_percent,
      (submission.score / submission.total_points * 100) >= 60 as passed,
      submission.recorded_at
    from latest_assignment_submissions as submission

    union all

    select
      attempt.tenant_id,
      attempt.score::numeric as score_percent,
      attempt.passed,
      attempt.attempted_at as recorded_at
    from public.chapter_test_attempts as attempt
  ),
  grade_statistics as (
    select
      grade.tenant_id,
      count(*)::bigint as record_count,
      round(avg(grade.score_percent), 2) as average_percent,
      round(
        avg(case when grade.passed then 100::numeric else 0::numeric end),
        2
      ) as pass_percent,
      max(grade.recorded_at) as latest_grade_at
    from grade_rows as grade
    group by grade.tenant_id
  ),
  pending_reviews as (
    select review.tenant_id, count(*)::bigint as review_count
    from public.grade_review_requests as review
    where review.status in ('pending', 'reviewing')
    group by review.tenant_id
  )
  select
    tenant.id,
    tenant.slug,
    tenant.name,
    tenant.status,
    coalesce(student.student_count, 0)::bigint,
    coalesce(assignment.assignment_count, 0)::bigint,
    coalesce(statistics.record_count, 0)::bigint,
    statistics.average_percent,
    statistics.pass_percent,
    coalesce(review.review_count, 0)::bigint,
    statistics.latest_grade_at
  from public.tenants as tenant
  left join active_students as student on student.tenant_id = tenant.id
  left join published_assignments as assignment on assignment.tenant_id = tenant.id
  left join grade_statistics as statistics on statistics.tenant_id = tenant.id
  left join pending_reviews as review on review.tenant_id = tenant.id
  order by
    case when tenant.status = 'active' then 0 else 1 end,
    tenant.name,
    tenant.id;
end;
$function$;

revoke all on function public.get_platform_grade_overview()
  from public, anon;
grant execute on function public.get_platform_grade_overview()
  to authenticated;

comment on function public.get_platform_grade_overview() is
  '平台负责人专用机构级成绩运行汇总；不返回任何学生级成绩或身份数据。';

commit;
