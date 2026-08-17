begin;

-- learning_time_log was created after the platform-owner RLS bypass migration,
-- so a SECURITY INVOKER function correctly cannot read it cross-tenant. Keep
-- that table out of the RPC contract; the server page fetches it with its
-- existing explicitly authorized, tenant-correlated paginated fallback.
drop function if exists public.get_platform_management_app_overview(uuid);

create function public.get_platform_management_app_overview(
  p_app_id uuid
)
returns table (
  tenant_id uuid,
  tenant_name text,
  active_students bigint,
  active_staff bigint,
  assignments bigint,
  published_assignments bigint,
  submissions bigint,
  graded_submissions bigint,
  notes bigint,
  active_notes bigint,
  scenarios bigint,
  published_scenarios bigint,
  conversation_practices bigint,
  completed_conversation_practices bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_app_id is null or not private.is_platform_owner() then
    raise exception '只有平台负责人可以查看跨机构应用汇总'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.student_apps as app
    where app.id = p_app_id
  ) then
    raise exception '应用不存在'
      using errcode = '22023';
  end if;

  return query
  with active_tenants as materialized (
    select tenant.id as tenant_id, tenant.name as tenant_name
    from public.tenants as tenant
    where tenant.status = 'active'
  ),
  enrollment_totals as (
    select
      enrollment.tenant_id,
      count(*) filter (where enrollment.status = 'active')::bigint
        as active_students
    from public.student_app_enrollments as enrollment
    join active_tenants as tenant
      on tenant.tenant_id = enrollment.tenant_id
    where enrollment.tenant_id = tenant.tenant_id
      and enrollment.app_id = p_app_id
    group by enrollment.tenant_id
  ),
  staff_totals as (
    select
      staff_assignment.tenant_id,
      count(*) filter (where staff_assignment.status = 'active')::bigint
        as active_staff
    from public.staff_app_assignments as staff_assignment
    join active_tenants as tenant
      on tenant.tenant_id = staff_assignment.tenant_id
    where staff_assignment.tenant_id = tenant.tenant_id
      and staff_assignment.app_id = p_app_id
    group by staff_assignment.tenant_id
  ),
  assignment_totals as (
    select
      assignment.tenant_id,
      count(*)::bigint as assignments,
      count(*) filter (where assignment.status = 'published')::bigint
        as published_assignments
    from public.learning_assignments as assignment
    join active_tenants as tenant
      on tenant.tenant_id = assignment.tenant_id
    where assignment.tenant_id = tenant.tenant_id
      and assignment.student_app_id = p_app_id
    group by assignment.tenant_id
  ),
  submission_totals as (
    select
      submission.tenant_id,
      count(*)::bigint as submissions,
      count(*) filter (where submission.status = 'graded')::bigint
        as graded_submissions
    from public.learning_submissions as submission
    join active_tenants as tenant
      on tenant.tenant_id = submission.tenant_id
    join public.learning_assignments as assignment
      on assignment.tenant_id = submission.tenant_id
     and assignment.id = submission.assignment_id
    where submission.tenant_id = tenant.tenant_id
      and assignment.tenant_id = tenant.tenant_id
      and assignment.student_app_id = p_app_id
    group by submission.tenant_id
  ),
  note_totals as (
    select
      note.tenant_id,
      count(*)::bigint as notes,
      count(*) filter (where note.status = 'active')::bigint as active_notes
    from public.learning_record_notes as note
    join active_tenants as tenant
      on tenant.tenant_id = note.tenant_id
    where note.tenant_id = tenant.tenant_id
      and note.student_app_id = p_app_id
    group by note.tenant_id
  ),
  scenario_totals as (
    select
      scenario.tenant_id,
      count(*)::bigint as scenarios,
      count(*) filter (where scenario.status = 'published')::bigint
        as published_scenarios
    from public.conversation_practice_scenarios as scenario
    join active_tenants as tenant
      on tenant.tenant_id = scenario.tenant_id
    where scenario.tenant_id = tenant.tenant_id
      and scenario.student_app_id = p_app_id
    group by scenario.tenant_id
  ),
  conversation_totals as (
    select
      progress.tenant_id,
      count(*)::bigint as conversation_practices,
      count(*) filter (where progress.status = 'completed')::bigint
        as completed_conversation_practices
    from public.conversation_practice_progress as progress
    join active_tenants as tenant
      on tenant.tenant_id = progress.tenant_id
    join public.conversation_practice_scenarios as scenario
      on scenario.tenant_id = progress.tenant_id
     and scenario.id = progress.scenario_id
    where progress.tenant_id = tenant.tenant_id
      and scenario.tenant_id = tenant.tenant_id
      and scenario.student_app_id = p_app_id
    group by progress.tenant_id
  ),
  overview as (
    select
      tenant.tenant_id,
      tenant.tenant_name,
      coalesce(enrollment.active_students, 0)::bigint as active_students,
      coalesce(staff.active_staff, 0)::bigint as active_staff,
      coalesce(assignment.assignments, 0)::bigint as assignments,
      coalesce(assignment.published_assignments, 0)::bigint
        as published_assignments,
      coalesce(submission.submissions, 0)::bigint as submissions,
      coalesce(submission.graded_submissions, 0)::bigint
        as graded_submissions,
      coalesce(note.notes, 0)::bigint as notes,
      coalesce(note.active_notes, 0)::bigint as active_notes,
      coalesce(scenario.scenarios, 0)::bigint as scenarios,
      coalesce(scenario.published_scenarios, 0)::bigint
        as published_scenarios,
      coalesce(conversation.conversation_practices, 0)::bigint
        as conversation_practices,
      coalesce(conversation.completed_conversation_practices, 0)::bigint
        as completed_conversation_practices
    from active_tenants as tenant
    left join enrollment_totals as enrollment
      on enrollment.tenant_id = tenant.tenant_id
    left join staff_totals as staff
      on staff.tenant_id = tenant.tenant_id
    left join assignment_totals as assignment
      on assignment.tenant_id = tenant.tenant_id
    left join submission_totals as submission
      on submission.tenant_id = tenant.tenant_id
    left join note_totals as note
      on note.tenant_id = tenant.tenant_id
    left join scenario_totals as scenario
      on scenario.tenant_id = tenant.tenant_id
    left join conversation_totals as conversation
      on conversation.tenant_id = tenant.tenant_id
  )
  select
    overview.tenant_id,
    overview.tenant_name,
    overview.active_students,
    overview.active_staff,
    overview.assignments,
    overview.published_assignments,
    overview.submissions,
    overview.graded_submissions,
    overview.notes,
    overview.active_notes,
    overview.scenarios,
    overview.published_scenarios,
    overview.conversation_practices,
    overview.completed_conversation_practices
  from overview
  where overview.active_students
      + overview.active_staff
      + overview.assignments
      + overview.notes
      + overview.scenarios
      + overview.conversation_practices > 0
  order by overview.tenant_name, overview.tenant_id;
end;
$function$;

revoke all on function public.get_platform_management_app_overview(uuid)
  from public, anon;
grant execute on function public.get_platform_management_app_overview(uuid)
  to authenticated;

comment on function public.get_platform_management_app_overview(uuid) is
  '平台负责人按应用读取活跃机构级汇总；SECURITY INVOKER，逐表绑定 tenant_id；学习时长因既有 RLS 由服务器分页合并。';

commit;
