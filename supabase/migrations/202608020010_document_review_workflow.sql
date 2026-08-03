begin;

-- 资料清单的“完成状态”与管理员对整份申请单的“审核状态”分开保存。
alter table public.student_university_targets
  add column if not exists document_review_status text not null default 'preparing',
  add column if not exists document_review_submitted_at timestamptz,
  add column if not exists document_reviewed_at timestamptz,
  add column if not exists document_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists document_review_note text not null default '';

alter table public.student_university_targets
  drop constraint if exists student_university_targets_document_review_status_check,
  drop constraint if exists student_university_targets_document_review_note_check;

alter table public.student_university_targets
  add constraint student_university_targets_document_review_status_check
    check (document_review_status in ('preparing', 'pending_review', 'revision_required', 'approved')),
  add constraint student_university_targets_document_review_note_check
    check (char_length(document_review_note) <= 2000);

update public.student_university_targets
set
  document_review_status = case
    when application_stage >= 2 then 'approved'
    when documents_locked_at is not null then 'pending_review'
    else 'preparing'
  end,
  document_review_submitted_at = case
    when documents_locked_at is not null then coalesce(document_review_submitted_at, documents_locked_at)
    else document_review_submitted_at
  end,
  document_reviewed_at = case
    when application_stage >= 2 then coalesce(document_reviewed_at, updated_at)
    else document_reviewed_at
  end
where document_review_status = 'preparing';

create index if not exists student_university_targets_document_review_idx
  on public.student_university_targets (tenant_id, document_review_status, updated_at desc);

-- 学生提交时自动进入待确认；学生不能直接伪造管理员审核结果。
create or replace function public.enforce_university_target_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
  unresolved_count integer;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  actor_is_admin := public.is_admin_account();

  if actor_is_admin then
    if tg_op = 'UPDATE' then
      if new.documents_locked_at is not null
         and new.documents_locked_at is distinct from old.documents_locked_at then
        new.documents_locked_at := now();
        new.application_stage := greatest(new.application_stage, 2);
      end if;
      if new.courier_mailed_at is not null
         and new.courier_mailed_at is distinct from old.courier_mailed_at then
        new.application_stage := greatest(new.application_stage, 3);
      end if;
    end if;
    return coalesce(new, old);
  end if;

  if old.documents_locked_at is not null then
    if tg_op = 'DELETE' then
      raise exception '这份申请表已锁定，请联系管理员解锁';
    end if;

    if new.documents_locked_at is distinct from old.documents_locked_at
       or (to_jsonb(new) - 'courier_mailed_at' - 'courier_estimated_arrival_at' - 'updated_at')
          is distinct from (to_jsonb(old) - 'courier_mailed_at' - 'courier_estimated_arrival_at' - 'updated_at') then
      raise exception '这份申请表已锁定，请联系管理员解锁';
    end if;
  elsif tg_op = 'DELETE' then
    return old;
  end if;

  new.application_stage := old.application_stage;
  new.document_review_status := old.document_review_status;
  new.document_review_submitted_at := old.document_review_submitted_at;
  new.document_reviewed_at := old.document_reviewed_at;
  new.document_reviewed_by := old.document_reviewed_by;
  new.document_review_note := old.document_review_note;

  if old.documents_locked_at is null and new.documents_locked_at is not null then
    new.documents_locked_at := now();

    select count(*) into unresolved_count
    from public.student_application_documents
    where target_id = new.id
      and status = 'preparing'
      and admin_locked_at is null;

    if unresolved_count > 0 then
      raise exception '还有材料未标记为已完成或无需，无法提交';
    end if;

    new.application_stage := greatest(new.application_stage, 1);
    new.document_review_status := 'pending_review';
    new.document_review_submitted_at := now();
    new.document_reviewed_at := null;
    new.document_reviewed_by := null;
    new.document_review_note := '';
  end if;

  if new.courier_mailed_at is not null
     and new.courier_mailed_at is distinct from old.courier_mailed_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
    if old.application_stage < 2 then
      raise exception '请等待管理员确认后再填写快递邮寄时间';
    end if;
    new.application_stage := greatest(new.application_stage, 3);
  end if;

  if new.courier_estimated_arrival_at is not null
     and new.courier_estimated_arrival_at is distinct from old.courier_estimated_arrival_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
    if old.application_stage < 2 then
      raise exception '请等待管理员确认后再填写快递邮寄时间';
    end if;
  end if;

  return new;
end;
$$;

-- 普通管理员必须获得资料审核模块授权；机构负责人和运营负责人自动拥有权限。
create table if not exists public.document_review_admin_assignments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  admin_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  primary key (tenant_id, admin_id)
);

create index if not exists document_review_admin_assignments_active_idx
  on public.document_review_admin_assignments (tenant_id, admin_id)
  where revoked_at is null;

create or replace function public.current_user_can_manage_document_reviews()
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
        from public.document_review_admin_assignments as assignment
        where assignment.tenant_id = private.current_tenant_id()
          and assignment.admin_id = (select auth.uid())
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.enforce_document_review_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以配置资料审核管理员';
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

drop trigger if exists enforce_document_review_assignment_trigger
  on public.document_review_admin_assignments;
create trigger enforce_document_review_assignment_trigger
before insert or update on public.document_review_admin_assignments
for each row execute function public.enforce_document_review_assignment();

alter table public.document_review_admin_assignments enable row level security;

create policy "document review assignments visible to platform or assignee"
on public.document_review_admin_assignments for select to authenticated
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

create policy "platform owner manages document review assignments"
on public.document_review_admin_assignments for all to authenticated
using ((select private.is_platform_owner()))
with check ((select private.is_platform_owner()));

grant select, insert, update on public.document_review_admin_assignments to authenticated;
revoke delete on public.document_review_admin_assignments from authenticated;

-- 单项资料清单只向学生本人、机构负责人和获授权的资料审核管理员开放。
drop policy if exists "tenant application documents read own or admins"
  on public.student_application_documents;
drop policy if exists "tenant admins create application checklist items"
  on public.student_application_documents;
drop policy if exists "tenant admins update application checklist items"
  on public.student_application_documents;
drop policy if exists "tenant admins delete application checklist items"
  on public.student_application_documents;

create policy "tenant application documents read own or reviewers"
on public.student_application_documents for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (
      user_id = (select auth.uid())
      or (select public.current_user_can_manage_document_reviews())
    )
  )
);

create policy "tenant reviewers create application checklist items"
on public.student_application_documents for insert to authenticated
with check (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and target_id is not null
    and (select public.current_user_can_manage_document_reviews())
  )
);

create policy "tenant reviewers update application checklist items"
on public.student_application_documents for update to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select public.current_user_can_manage_document_reviews())
  )
)
with check (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select public.current_user_can_manage_document_reviews())
  )
);

create policy "tenant reviewers delete application checklist items"
on public.student_application_documents for delete to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and admin_locked_at is null
    and (select public.current_user_can_manage_document_reviews())
  )
);

-- 审核日志只记录状态变化，不保存或暴露学生上传文件。
create table if not exists public.document_review_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_id uuid not null references public.student_university_targets(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  previous_status text not null check (previous_status in ('preparing', 'pending_review', 'revision_required', 'approved')),
  new_status text not null check (new_status in ('preparing', 'pending_review', 'revision_required', 'approved')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists document_review_events_target_idx
  on public.document_review_events (tenant_id, target_id, created_at desc);

alter table public.document_review_events enable row level security;

create policy "document review managers read events"
on public.document_review_events for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and (select public.current_user_can_manage_document_reviews())
  )
);

grant select on public.document_review_events to authenticated;
revoke insert, update, delete on public.document_review_events from authenticated;

create or replace function public.log_document_review_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.document_review_status is distinct from old.document_review_status then
    insert into public.document_review_events (
      tenant_id,
      target_id,
      actor_id,
      previous_status,
      new_status,
      note
    ) values (
      new.tenant_id,
      new.id,
      auth.uid(),
      old.document_review_status,
      new.document_review_status,
      new.document_review_note
    );
  end if;
  return new;
end;
$$;

drop trigger if exists log_document_review_status_change_trigger
  on public.student_university_targets;
create trigger log_document_review_status_change_trigger
after update of document_review_status on public.student_university_targets
for each row execute function public.log_document_review_status_change();

-- 平台负责人只读取机构级汇总，不返回学生编号、姓名、大学或项目。
create or replace function public.get_platform_document_review_overview()
returns table (
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  tenant_status text,
  active_student_count bigint,
  application_count bigint,
  preparing_count bigint,
  pending_review_count bigint,
  revision_required_count bigint,
  approved_count bigint,
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
    raise exception '只有平台负责人可以查看机构资料审核概览';
  end if;

  return query
  with active_students as (
    select membership.tenant_id, count(*)::bigint as student_count
    from public.tenant_memberships as membership
    where membership.role = 'student'
      and membership.status = 'active'
    group by membership.tenant_id
  ),
  review_statistics as (
    select
      target.tenant_id,
      count(*) filter (where target.status <> 'researching')::bigint as total_count,
      count(*) filter (
        where target.status <> 'researching'
          and target.document_review_status = 'preparing'
      )::bigint as preparing_total,
      count(*) filter (
        where target.status <> 'researching'
          and target.document_review_status = 'pending_review'
      )::bigint as pending_total,
      count(*) filter (
        where target.status <> 'researching'
          and target.document_review_status = 'revision_required'
      )::bigint as revision_total,
      count(*) filter (
        where target.status <> 'researching'
          and target.document_review_status = 'approved'
      )::bigint as approved_total,
      min(target.document_review_submitted_at) filter (
        where target.document_review_status = 'pending_review'
      ) as oldest_pending,
      max(target.updated_at) filter (where target.status <> 'researching') as latest_activity
    from public.student_university_targets as target
    group by target.tenant_id
  )
  select
    tenant.id,
    tenant.slug,
    tenant.name,
    tenant.status,
    coalesce(student.student_count, 0)::bigint,
    coalesce(statistics.total_count, 0)::bigint,
    coalesce(statistics.preparing_total, 0)::bigint,
    coalesce(statistics.pending_total, 0)::bigint,
    coalesce(statistics.revision_total, 0)::bigint,
    coalesce(statistics.approved_total, 0)::bigint,
    statistics.oldest_pending,
    statistics.latest_activity
  from public.tenants as tenant
  left join active_students as student on student.tenant_id = tenant.id
  left join review_statistics as statistics on statistics.tenant_id = tenant.id
  order by
    case when tenant.status = 'active' then 0 else 1 end,
    coalesce(statistics.pending_total, 0) desc,
    tenant.name,
    tenant.id;
end;
$$;

revoke all on function public.current_user_can_manage_document_reviews()
  from public, anon;
revoke all on function public.enforce_document_review_assignment()
  from public, anon, authenticated;
revoke all on function public.log_document_review_status_change()
  from public, anon, authenticated;
revoke all on function public.get_platform_document_review_overview()
  from public, anon;
grant execute on function public.current_user_can_manage_document_reviews()
  to authenticated;
grant execute on function public.get_platform_document_review_overview()
  to authenticated;

comment on column public.student_university_targets.document_review_status is
  '整份大学申请资料清单的审核状态，与单项资料准备状态分离。';
comment on table public.document_review_events is
  '申请资料审核状态变更日志；不保存学生上传文件。';
comment on function public.get_platform_document_review_overview() is
  '平台负责人专用机构级资料审核汇总；不返回任何学生身份或申请详情。';

notify pgrst, 'reload schema';

commit;
