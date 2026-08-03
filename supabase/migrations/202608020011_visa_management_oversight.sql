begin;

-- 签证管理使用独立授权，不再让所有普通机构管理员自动获得学生签证写权限。
create table if not exists public.visa_admin_assignments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  primary key (tenant_id, admin_id)
);

create index if not exists visa_admin_assignments_active_idx
  on public.visa_admin_assignments (tenant_id, admin_id)
  where revoked_at is null;

create or replace function public.current_user_can_manage_visas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('tenant_super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1
        from public.visa_admin_assignments as assignment
        where assignment.tenant_id = private.current_tenant_id()
          and assignment.admin_id = (select auth.uid())
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.enforce_visa_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以配置签证管理员';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.tenant_id = new.tenant_id
      and membership.user_id = new.admin_id
      and membership.role = 'admin'
      and membership.status = 'active'
      and coalesce(profile.status, 'active') = 'active'
  ) then
    raise exception '只能授权状态正常的机构管理员账号';
  end if;

  if new.revoked_at is null then
    new.granted_by := auth.uid();
    new.granted_at := now();
    new.revoked_by := null;
  else
    new.revoked_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_visa_admin_assignment_trigger
  on public.visa_admin_assignments;
create trigger enforce_visa_admin_assignment_trigger
before insert or update on public.visa_admin_assignments
for each row execute function public.enforce_visa_admin_assignment();

alter table public.visa_admin_assignments enable row level security;

create policy "visa assignments visible to platform or assignee"
on public.visa_admin_assignments for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (
      admin_id = (select auth.uid())
      or public.current_profile_role() = 'tenant_super_admin'
    )
  )
);

create policy "platform owner manages visa assignments"
on public.visa_admin_assignments for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select, insert, update on public.visa_admin_assignments to authenticated;
revoke delete on public.visa_admin_assignments from authenticated;

-- 学生只能读写自己的签证工作区；机构负责人和获授权签证管理员处理本机构案件。
drop policy if exists "tenant visa cases read own or admins"
  on public.student_visa_cases;
drop policy if exists "tenant admins manage visa cases"
  on public.student_visa_cases;

create policy "tenant visa cases read own or managers"
on public.student_visa_cases for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    user_id = (select auth.uid())
    or (select public.current_user_can_manage_visas())
  )
);

create policy "tenant visa managers manage cases"
on public.student_visa_cases for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_manage_visas())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_manage_visas())
);

drop policy if exists "tenant visa tasks read own or admins"
  on public.student_visa_tasks;
drop policy if exists "tenant admins manage visa tasks"
  on public.student_visa_tasks;

create policy "tenant visa tasks read own or managers"
on public.student_visa_tasks for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (user_id = (select auth.uid()) and is_archived = false)
    or (select public.current_user_can_manage_visas())
  )
);

create policy "tenant visa managers manage tasks"
on public.student_visa_tasks for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_manage_visas())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_manage_visas())
);

drop policy if exists "tenant visa task events read own or admins"
  on public.student_visa_task_events;

create policy "tenant visa task events read own or managers"
on public.student_visa_task_events for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    user_id = (select auth.uid())
    or (select public.current_user_can_manage_visas())
  )
);

-- 原触发器只识别旧角色名称；改为调用签证专属权限函数。
create or replace function public.enforce_student_visa_task_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_can_manage_visas() then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.status := case when new.status in ('pending', 'in_progress') then new.status else 'pending' end;
    new.admin_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_started_at := null;
    new.submission_version := 0;
    return new;
  end if;

  new.submission_version := old.submission_version;
  new.submitted_at := old.submitted_at;

  if (to_jsonb(new) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at') then
    raise exception '学生只能更新签证任务状态和个人备注';
  end if;

  if old.status in ('submitted', 'reviewing', 'approved') then
    raise exception '当前任务已经提交或确认，不能自行修改';
  end if;

  if new.status = old.status and old.status in ('pending', 'in_progress', 'blocked', 'revision_required') then
    return new;
  end if;

  if (old.status = 'pending' and new.status in ('in_progress', 'blocked'))
     or (old.status = 'in_progress' and new.status in ('pending', 'blocked'))
     or (old.status = 'blocked' and new.status = 'in_progress')
     or (old.status = 'revision_required' and new.status = 'in_progress') then
    return new;
  end if;

  if old.status in ('in_progress', 'revision_required') and new.status = 'submitted' then
    new.submission_version := old.submission_version + 1;
    new.submitted_at := now();
    new.review_started_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.admin_note := null;
    return new;
  end if;

  raise exception '签证任务状态必须按准备流程更新';
end;
$$;

create or replace function public.enforce_student_visa_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.current_user_can_manage_visas() then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证档案操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.case_status := 'admin_preparing';
    new.assigned_admin_id := null;
    new.advisor_note := null;
    new.last_reviewed_at := null;
    return new;
  end if;

  if new.visa_type is distinct from old.visa_type
     or new.application_channel is distinct from old.application_channel
     or new.target_entry_date is distinct from old.target_entry_date then
    raise exception '签证类型、办理通道和最晚入境日期由管理员确认，学生不能修改';
  end if;

  if (to_jsonb(new) - 'application_city' - 'residence_province' - 'residence_city' - 'planned_entry_date' - 'accommodation_status' - 'airport_pickup_required' - 'departure_province' - 'departure_airport' - 'arrival_region' - 'arrival_airport' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'application_city' - 'residence_province' - 'residence_city' - 'planned_entry_date' - 'accommodation_status' - 'airport_pickup_required' - 'departure_province' - 'departure_airport' - 'arrival_region' - 'arrival_airport' - 'updated_at') then
    raise exception '学生只能更新自己的递签领区、行程、住宿与接机信息';
  end if;

  return new;
end;
$$;

-- 平台只通过此接口获取机构级运行汇总，不直接读取学生身份或签证材料。
create or replace function public.get_platform_visa_management_overview()
returns table (
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  tenant_status text,
  active_student_count bigint,
  case_count bigint,
  admin_preparing_count bigint,
  preparing_count bigint,
  submitted_count bigint,
  additional_documents_count bigint,
  approved_count bigint,
  issued_count bigint,
  pending_task_count bigint,
  support_task_count bigint,
  upcoming_entry_count bigint,
  oldest_pending_at timestamptz,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以查看机构签证运行概览';
  end if;

  return query
  with active_students as (
    select membership.tenant_id, count(*)::bigint as student_count
    from public.tenant_memberships as membership
    where membership.role = 'student'
      and membership.status = 'active'
    group by membership.tenant_id
  ),
  case_statistics as (
    select
      visa_case.tenant_id,
      count(*)::bigint as total_count,
      count(*) filter (where visa_case.case_status = 'admin_preparing')::bigint as admin_preparing_total,
      count(*) filter (where visa_case.case_status in ('planning', 'preparing', 'ready_to_submit'))::bigint as preparing_total,
      count(*) filter (where visa_case.case_status = 'submitted')::bigint as submitted_total,
      count(*) filter (where visa_case.case_status = 'additional_documents')::bigint as additional_total,
      count(*) filter (where visa_case.case_status = 'approved')::bigint as approved_total,
      count(*) filter (where visa_case.case_status = 'issued')::bigint as issued_total,
      count(*) filter (
        where visa_case.case_status <> 'closed'
          and coalesce(visa_case.planned_entry_date, visa_case.target_entry_date)
            between current_date and current_date + 30
      )::bigint as upcoming_entry_total,
      max(visa_case.updated_at) as latest_activity
    from public.student_visa_cases as visa_case
    group by visa_case.tenant_id
  ),
  task_statistics as (
    select
      task.tenant_id,
      count(*) filter (where task.status in ('submitted', 'reviewing') and task.is_archived = false)::bigint as pending_total,
      count(*) filter (where task.status in ('revision_required', 'blocked') and task.is_archived = false)::bigint as support_total,
      min(coalesce(task.submitted_at, task.updated_at)) filter (
        where task.status in ('submitted', 'reviewing') and task.is_archived = false
      ) as oldest_pending,
      max(task.updated_at) filter (where task.is_archived = false) as latest_activity
    from public.student_visa_tasks as task
    group by task.tenant_id
  )
  select
    tenant.id,
    tenant.slug,
    tenant.name,
    tenant.status,
    coalesce(student.student_count, 0)::bigint,
    coalesce(case_data.total_count, 0)::bigint,
    coalesce(case_data.admin_preparing_total, 0)::bigint,
    coalesce(case_data.preparing_total, 0)::bigint,
    coalesce(case_data.submitted_total, 0)::bigint,
    coalesce(case_data.additional_total, 0)::bigint,
    coalesce(case_data.approved_total, 0)::bigint,
    coalesce(case_data.issued_total, 0)::bigint,
    coalesce(task_data.pending_total, 0)::bigint,
    coalesce(task_data.support_total, 0)::bigint,
    coalesce(case_data.upcoming_entry_total, 0)::bigint,
    task_data.oldest_pending,
    case
      when case_data.latest_activity is null then task_data.latest_activity
      when task_data.latest_activity is null then case_data.latest_activity
      else greatest(case_data.latest_activity, task_data.latest_activity)
    end
  from public.tenants as tenant
  left join active_students as student on student.tenant_id = tenant.id
  left join case_statistics as case_data on case_data.tenant_id = tenant.id
  left join task_statistics as task_data on task_data.tenant_id = tenant.id
  order by
    case when tenant.status = 'active' then 0 else 1 end,
    coalesce(task_data.pending_total, 0) desc,
    coalesce(task_data.support_total, 0) desc,
    tenant.name,
    tenant.id;
end;
$$;

revoke all on function public.current_user_can_manage_visas()
  from public, anon;
revoke all on function public.enforce_visa_admin_assignment()
  from public, anon, authenticated;
revoke all on function public.enforce_student_visa_task_workflow()
  from public, anon, authenticated;
revoke all on function public.enforce_student_visa_case_fields()
  from public, anon, authenticated;
revoke all on function public.get_platform_visa_management_overview()
  from public, anon;
grant execute on function public.current_user_can_manage_visas()
  to authenticated;
grant execute on function public.get_platform_visa_management_overview()
  to authenticated;

comment on table public.visa_admin_assignments is
  '平台负责人配置的机构签证管理员授权；机构负责人和运营负责人自动拥有权限。';
comment on function public.get_platform_visa_management_overview() is
  '平台负责人专用的机构签证运行汇总，不返回学生身份与签证材料。';

notify pgrst, 'reload schema';

commit;
