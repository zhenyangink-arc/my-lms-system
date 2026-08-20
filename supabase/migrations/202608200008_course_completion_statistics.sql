begin;

-- Both statistics endpoints return one JSON document from one aggregate query.
-- The partial index keeps platform policy/version trends from scanning historical
-- superseded rows while tenant queries continue to use the existing tenant index.
create index if not exists student_course_completion_evaluations_stats_idx
  on public.student_course_completion_evaluations
  (student_app_id, policy_id, policy_version, evaluated_at, tenant_id)
  include (id, status, eligible)
  where status <> 'superseded';

create or replace function public.get_institution_course_completion_statistics(
  p_student_app_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = '必须登录后查看结课统计';
  end if;
  if v_tenant_id is null
    or not private.has_current_tenant_role(
      array['tenant_super_admin', 'ceo']::text[]
    ) then
    raise exception using errcode = '42501', message = '只有机构负责人可以查看本机构结课统计';
  end if;
  if p_student_app_id is null then
    raise exception '学生应用不能为空';
  end if;

  with current_evaluations as materialized (
    select
      evaluation.id,
      evaluation.status,
      evaluation.eligible,
      evaluation.missing_requirements
    from public.student_course_completion_evaluations as evaluation
    where evaluation.tenant_id = v_tenant_id
      and evaluation.student_app_id = p_student_app_id
      and evaluation.status <> 'superseded'
  ),
  issued_evaluations as materialized (
    select distinct certificate.evaluation_id
    from public.course_completion_certificates as certificate
    join current_evaluations as evaluation
      on evaluation.id = certificate.evaluation_id
    where certificate.status = 'issued'
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(*) filter (
        where evaluation.status = 'eligible' and evaluation.eligible
      )::integer as eligible_count,
      count(issued.evaluation_id)::integer as issued_count
    from current_evaluations as evaluation
    left join issued_evaluations as issued
      on issued.evaluation_id = evaluation.id
  ),
  gap_counts as (
    select
      gap.value ->> 'key' as gap_key,
      gap.value ->> 'category' as gap_category,
      max(gap.value ->> 'title') as gap_title,
      count(*)::integer as gap_count
    from current_evaluations as evaluation
    cross join lateral jsonb_array_elements(
      evaluation.missing_requirements
    ) as gap(value)
    where nullif(gap.value ->> 'key', '') is not null
      and nullif(gap.value ->> 'category', '') is not null
    group by gap.value ->> 'key', gap.value ->> 'category'
  )
  select jsonb_build_object(
    'scope', 'institution',
    'tenantId', v_tenant_id,
    'totalEvaluations', summary.total_count,
    'eligibleCount', summary.eligible_count,
    'eligibleRate', case
      when summary.total_count = 0 then 0
      else round(100.0 * summary.eligible_count / summary.total_count, 1)
    end,
    'issuedCount', summary.issued_count,
    'issuanceRate', case
      when summary.eligible_count = 0 then 0
      else round(100.0 * summary.issued_count / summary.eligible_count, 1)
    end,
    'missingRequirementCount', coalesce((
      select sum(gap_count)::integer from gap_counts
    ), 0),
    'gaps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'key', gap_key,
          'category', gap_category,
          'title', coalesce(nullif(gap_title, ''), gap_key),
          'count', gap_count
        )
        order by gap_count desc, gap_category, gap_key
      )
      from gap_counts
    ), '[]'::jsonb)
  ) into v_result
  from summary;

  return v_result;
end;
$$;

create or replace function public.get_platform_course_completion_trends(
  p_student_app_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(private.is_platform_owner(), false) then
    raise exception using errcode = '42501', message = '只有平台负责人可以查看跨机构结课趋势';
  end if;
  if p_student_app_id is null then
    raise exception '学生应用不能为空';
  end if;

  with current_evaluations as materialized (
    select
      evaluation.id,
      evaluation.tenant_id,
      evaluation.policy_id,
      evaluation.policy_version,
      evaluation.status,
      evaluation.eligible,
      date_trunc(
        'month', evaluation.evaluated_at at time zone 'Asia/Seoul'
      )::date as period_start
    from public.student_course_completion_evaluations as evaluation
    where evaluation.student_app_id = p_student_app_id
      and evaluation.status <> 'superseded'
  ),
  issued_evaluations as materialized (
    select distinct certificate.evaluation_id
    from public.course_completion_certificates as certificate
    join current_evaluations as evaluation
      on evaluation.id = certificate.evaluation_id
    where certificate.status = 'issued'
  ),
  trend_rows as (
    select
      evaluation.period_start,
      evaluation.policy_id,
      policy.policy_code,
      evaluation.policy_version,
      max(policy.title) as policy_title,
      count(distinct evaluation.tenant_id)::integer as institution_count,
      count(*)::integer as total_count,
      count(*) filter (
        where evaluation.status = 'eligible' and evaluation.eligible
      )::integer as eligible_count,
      count(issued.evaluation_id)::integer as issued_count
    from current_evaluations as evaluation
    join public.course_completion_policies as policy
      on policy.id = evaluation.policy_id
     and policy.version = evaluation.policy_version
     and policy.student_app_id = p_student_app_id
    left join issued_evaluations as issued
      on issued.evaluation_id = evaluation.id
    group by
      evaluation.period_start,
      evaluation.policy_id,
      policy.policy_code,
      evaluation.policy_version
  )
  select jsonb_build_object(
    'scope', 'platform',
    'trend', coalesce(jsonb_agg(
      jsonb_build_object(
        'periodStart', trend.period_start,
        'policyId', trend.policy_id,
        'policyCode', trend.policy_code,
        'policyVersion', trend.policy_version,
        'policyTitle', trend.policy_title,
        'institutionCount', trend.institution_count,
        'totalEvaluations', trend.total_count,
        'eligibleCount', trend.eligible_count,
        'eligibleRate', case
          when trend.total_count = 0 then 0
          else round(100.0 * trend.eligible_count / trend.total_count, 1)
        end,
        'issuedCount', trend.issued_count,
        'issuanceRate', case
          when trend.eligible_count = 0 then 0
          else round(100.0 * trend.issued_count / trend.eligible_count, 1)
        end
      )
      order by trend.period_start, trend.policy_id, trend.policy_version
    ), '[]'::jsonb)
  ) into v_result
  from trend_rows as trend;

  return v_result;
end;
$$;

revoke all on function public.get_institution_course_completion_statistics(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_platform_course_completion_trends(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.get_institution_course_completion_statistics(uuid)
  to authenticated;
grant execute on function public.get_platform_course_completion_trends(uuid)
  to authenticated;

comment on function public.get_institution_course_completion_statistics(uuid) is
  '单次聚合查询返回当前机构结课资格率、有效证书颁发率及按 key/category 聚合的缺口分布。';
comment on function public.get_platform_course_completion_trends(uuid) is
  '单次聚合查询返回跨机构月度结课趋势；不同 policy_id 与 policy_version 始终分组统计。';

commit;
