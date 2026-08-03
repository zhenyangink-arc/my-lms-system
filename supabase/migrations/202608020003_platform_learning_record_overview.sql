begin;

-- 平台负责人只读取机构级学习记录统计，不返回学生身份、记录标题、正文或建议。
create or replace function public.get_platform_learning_record_overview()
returns table (
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  tenant_status text,
  active_student_count bigint,
  total_record_count bigint,
  active_record_count bigint,
  student_visible_count bigint,
  internal_record_count bigint,
  attention_record_count bigint,
  plan_record_count bigint,
  last_record_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以查看机构学习记录运行概览';
  end if;

  return query
  with active_students as (
    select membership.tenant_id, count(*)::bigint as student_count
    from public.tenant_memberships as membership
    where membership.role = 'student'
      and membership.status = 'active'
    group by membership.tenant_id
  ),
  record_statistics as (
    select
      note.tenant_id,
      count(*)::bigint as total_count,
      count(*) filter (where note.status = 'active')::bigint as active_count,
      count(*) filter (
        where note.status = 'active'
          and note.visibility = 'student_visible'
      )::bigint as visible_count,
      count(*) filter (
        where note.status = 'active'
          and note.visibility = 'internal'
      )::bigint as internal_count,
      count(*) filter (
        where note.status = 'active'
          and note.record_type = 'attention'
      )::bigint as attention_count,
      count(*) filter (
        where note.status = 'active'
          and note.record_type = 'plan'
      )::bigint as plan_count,
      max(note.occurred_at) as latest_record_at
    from public.learning_record_notes as note
    group by note.tenant_id
  )
  select
    tenant.id,
    tenant.slug,
    tenant.name,
    tenant.status,
    coalesce(student.student_count, 0)::bigint,
    coalesce(statistics.total_count, 0)::bigint,
    coalesce(statistics.active_count, 0)::bigint,
    coalesce(statistics.visible_count, 0)::bigint,
    coalesce(statistics.internal_count, 0)::bigint,
    coalesce(statistics.attention_count, 0)::bigint,
    coalesce(statistics.plan_count, 0)::bigint,
    statistics.latest_record_at
  from public.tenants as tenant
  left join active_students as student on student.tenant_id = tenant.id
  left join record_statistics as statistics on statistics.tenant_id = tenant.id
  order by
    case when tenant.status = 'active' then 0 else 1 end,
    tenant.name,
    tenant.id;
end;
$function$;

revoke all on function public.get_platform_learning_record_overview()
  from public, anon;
grant execute on function public.get_platform_learning_record_overview()
  to authenticated;

comment on function public.get_platform_learning_record_overview() is
  '平台负责人专用机构级学习记录汇总；不返回任何学生身份或记录正文。';

commit;
