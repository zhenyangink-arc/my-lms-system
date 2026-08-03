begin;

-- 公告明确分为平台公告与机构公告。历史公告继续归属原机构，不会被提升为全平台公告。
alter table public.announcements
  add column if not exists scope text not null default 'tenant';

alter table public.announcements
  alter column tenant_id drop not null,
  drop constraint if exists announcements_scope_check,
  drop constraint if exists announcements_scope_tenant_check;

update public.announcements
set scope = 'tenant'
where scope is distinct from 'tenant';

alter table public.announcements
  add constraint announcements_scope_check
    check (scope in ('platform', 'tenant')),
  add constraint announcements_scope_tenant_check
    check (
      (scope = 'platform' and tenant_id is null)
      or (scope = 'tenant' and tenant_id is not null)
    );

-- 通用租户触发器会拒绝 tenant_id 为空的行，因此公告改用了解 platform 范围的专用约束。
create or replace function private.enforce_announcement_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_tenant_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.scope is distinct from old.scope
      or new.tenant_id is distinct from old.tenant_id then
      raise exception '不能修改公告的发布范围';
    end if;
    return new;
  end if;

  if new.scope = 'platform' then
    if new.tenant_id is not null then
      raise exception '平台公告不能归属某个机构';
    end if;
    return new;
  end if;

  if new.tenant_id is null then
    resolved_tenant_id := private.current_tenant_id();
    if resolved_tenant_id is null and new.created_by is not null then
      resolved_tenant_id := private.default_tenant_of(new.created_by);
    end if;
    new.tenant_id := resolved_tenant_id;
  end if;

  if new.tenant_id is null then
    raise exception '机构公告缺少机构上下文';
  end if;

  return new;
end;
$$;

drop trigger if exists announcements_tenant_scope on public.announcements;
drop trigger if exists announcements_scope_guard on public.announcements;
create trigger announcements_scope_guard
before insert or update on public.announcements
for each row execute function private.enforce_announcement_scope();

create index if not exists announcements_scope_status_published_idx
  on public.announcements (scope, tenant_id, status, is_pinned desc, published_at desc);

-- 公告后台不再支持“公告管理员授权”。只有平台负责人、机构负责人和运营负责人可以管理。
create or replace function public.current_user_can_access_announcements()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account() and (
    private.is_platform_owner()
    or (
      private.current_tenant_id() is not null
      and public.current_profile_role() in ('tenant_super_admin', 'ceo')
    )
  );
$$;

drop policy if exists "tenant users read announcements"
  on public.announcements;
drop policy if exists "tenant staff create announcements"
  on public.announcements;
drop policy if exists "tenant staff update announcements"
  on public.announcements;

create policy "visible announcements or managed announcements"
on public.announcements for select to authenticated
using (
  (select private.is_platform_owner())
  or (
    scope = 'platform'
    and status = 'published'
    and (select public.is_active_account())
  )
  or (
    scope = 'tenant'
    and tenant_id = (select private.current_tenant_id())
    and (
      status = 'published'
      or (select public.current_user_can_access_announcements())
    )
    and (select public.is_active_account())
  )
);

create policy "platform or tenant owners create announcements"
on public.announcements for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and (
    (
      scope = 'platform'
      and tenant_id is null
      and (select private.is_platform_owner())
    )
    or (
      scope = 'tenant'
      and tenant_id = (select private.current_tenant_id())
      and public.current_profile_role() in ('tenant_super_admin', 'ceo')
      and (select public.is_active_account())
    )
  )
);

create policy "platform or tenant owners update announcements"
on public.announcements for update to authenticated
using (
  (
    scope = 'platform'
    and tenant_id is null
    and (select private.is_platform_owner())
  )
  or (
    scope = 'tenant'
    and tenant_id = (select private.current_tenant_id())
    and public.current_profile_role() in ('tenant_super_admin', 'ceo')
    and (select public.is_active_account())
  )
)
with check (
  (
    scope = 'platform'
    and tenant_id is null
    and (select private.is_platform_owner())
  )
  or (
    scope = 'tenant'
    and tenant_id = (select private.current_tenant_id())
    and public.current_profile_role() in ('tenant_super_admin', 'ceo')
    and (select public.is_active_account())
  )
);

-- 旧授权表保留历史记录，但撤销所有应用访问和写入能力。
drop policy if exists "tenant announcement assignments visible to owner or assignee"
  on public.announcement_admin_assignments;
drop policy if exists "tenant owner manages announcement assignments"
  on public.announcement_admin_assignments;
revoke all on public.announcement_admin_assignments from authenticated;

-- 阅读回执只记录“谁在何时读过哪条公告”，不记录公告正文副本。
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_reads_tenant_announcement_idx
  on public.announcement_reads (tenant_id, announcement_id, read_at desc);

alter table public.announcement_reads enable row level security;

create policy "announcement reads visible to reader or managers"
on public.announcement_reads for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_owner())
  or (
    tenant_id = (select private.current_tenant_id())
    and public.current_profile_role() in ('tenant_super_admin', 'ceo')
    and (select public.is_active_account())
  )
);

grant select on public.announcement_reads to authenticated;
revoke insert, update, delete on public.announcement_reads from authenticated;

create or replace function public.mark_visible_announcements_read(requested_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_tenant_id uuid;
  marked_count integer;
begin
  if auth.uid() is null or not public.is_active_account() then
    raise exception '请先登录正常账号';
  end if;

  viewer_tenant_id := private.current_tenant_id();

  insert into public.announcement_reads (announcement_id, user_id, tenant_id, read_at)
  select announcement.id, auth.uid(), viewer_tenant_id, now()
  from public.announcements as announcement
  where announcement.id = any(coalesce(requested_ids, array[]::uuid[]))
    and announcement.status = 'published'
    and (
      announcement.scope = 'platform'
      or (
        announcement.scope = 'tenant'
        and announcement.tenant_id = viewer_tenant_id
      )
    )
  on conflict (announcement_id, user_id)
  do update set read_at = excluded.read_at;

  get diagnostics marked_count = row_count;
  return marked_count;
end;
$$;

revoke all on function public.mark_visible_announcements_read(uuid[])
  from public, anon;
grant execute on function public.mark_visible_announcements_read(uuid[])
  to authenticated;

comment on column public.announcements.scope is
  'platform 为全平台公告，tenant 为仅所属机构可见的机构公告。';
comment on table public.announcement_reads is
  '公告阅读回执，用于统计覆盖人数、已读人数和已读率。';

notify pgrst, 'reload schema';

commit;
