begin;

-- 平台巡检可查看匿名案件运行明细，不返回 user_id、姓名、邮箱、院校或材料内容。
create or replace function public.get_platform_visa_case_audit()
returns table (
  tenant_id uuid,
  case_reference text,
  visa_type text,
  application_channel text,
  case_status text,
  task_count bigint,
  approved_task_count bigint,
  pending_task_count bigint,
  support_task_count bigint,
  target_entry_date date,
  planned_entry_date date,
  oldest_pending_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以巡检机构签证案件';
  end if;

  return query
  with task_statistics as (
    select
      task.tenant_id,
      task.user_id,
      count(*) filter (where task.is_archived = false)::bigint as total_count,
      count(*) filter (where task.status = 'approved' and task.is_archived = false)::bigint as approved_count,
      count(*) filter (where task.status in ('submitted', 'reviewing') and task.is_archived = false)::bigint as pending_count,
      count(*) filter (where task.status in ('revision_required', 'blocked') and task.is_archived = false)::bigint as support_count,
      min(coalesce(task.submitted_at, task.updated_at)) filter (
        where task.status in ('submitted', 'reviewing') and task.is_archived = false
      ) as oldest_pending
    from public.student_visa_tasks as task
    group by task.tenant_id, task.user_id
  )
  select
    visa_case.tenant_id,
    upper(right(replace(visa_case.id::text, '-', ''), 8)),
    visa_case.visa_type,
    visa_case.application_channel,
    visa_case.case_status,
    coalesce(task_data.total_count, 0)::bigint,
    coalesce(task_data.approved_count, 0)::bigint,
    coalesce(task_data.pending_count, 0)::bigint,
    coalesce(task_data.support_count, 0)::bigint,
    visa_case.target_entry_date,
    visa_case.planned_entry_date,
    task_data.oldest_pending,
    visa_case.updated_at
  from public.student_visa_cases as visa_case
  left join task_statistics as task_data
    on task_data.tenant_id = visa_case.tenant_id
   and task_data.user_id = visa_case.user_id
  order by
    coalesce(task_data.pending_count, 0) desc,
    coalesce(task_data.support_count, 0) desc,
    visa_case.updated_at desc,
    visa_case.id;
end;
$$;

revoke all on function public.get_platform_visa_case_audit()
  from public, anon;
grant execute on function public.get_platform_visa_case_audit()
  to authenticated;

comment on function public.get_platform_visa_case_audit() is
  '平台负责人巡检机构签证案件的匿名运行明细，不返回学生身份、院校或材料内容。';

notify pgrst, 'reload schema';

commit;
