-- ============================================================
-- 通知公告与负责人授权
-- 访问与发布范围：负责人、全部 CEO、负责人单独指定的管理员。
-- 页面权限、Server Action 权限和数据库 RLS 使用同一套规则。
-- ============================================================

create table if not exists public.announcement_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

create index if not exists announcement_admin_assignments_active_idx
  on public.announcement_admin_assignments (admin_id)
  where revoked_at is null;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  content text not null check (char_length(content) between 2 and 5000),
  category text not null default 'general' check (
    category in ('general', 'course', 'exam', 'system')
  ),
  priority text not null default 'normal' check (
    priority in ('normal', 'important', 'urgent')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'archived')
  ),
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_status_published_idx
  on public.announcements (status, published_at desc);
create index if not exists announcements_pinned_created_idx
  on public.announcements (is_pinned desc, created_at desc);

create or replace function public.current_user_is_announcement_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and role = 'super_admin'
  );
$$;

create or replace function public.current_user_can_access_announcements()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as viewer
    where viewer.id = auth.uid()
      and coalesce(viewer.status, 'active') = 'active'
      and (
        viewer.role in ('super_admin', 'ceo')
        or (
          viewer.role = 'admin'
          and exists (
            select 1
            from public.announcement_admin_assignments as assignment
            where assignment.admin_id = viewer.id
              and assignment.revoked_at is null
          )
        )
      )
  );
$$;

create or replace function public.enforce_announcement_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_status text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.current_user_is_announcement_owner() then
    raise exception '只有负责人可以指定公告管理员';
  end if;

  select role, coalesce(status, 'active')
    into target_role, target_status
  from public.profiles
  where id = new.admin_id;

  if new.revoked_at is null
     and (target_role is distinct from 'admin' or target_status is distinct from 'active') then
    raise exception '只能授权状态正常的管理员账号';
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

drop trigger if exists enforce_announcement_assignment_trigger
  on public.announcement_admin_assignments;
create trigger enforce_announcement_assignment_trigger
before insert or update on public.announcement_admin_assignments
for each row execute function public.enforce_announcement_assignment();

create or replace function public.enforce_announcement_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.current_user_can_access_announcements() then
    raise exception '当前账号没有公告管理权限';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();

  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_announcement_attribution_trigger on public.announcements;
create trigger enforce_announcement_attribution_trigger
before insert or update on public.announcements
for each row execute function public.enforce_announcement_attribution();

alter table public.announcement_admin_assignments enable row level security;
alter table public.announcements enable row level security;

drop policy if exists "announcement assignments visible to owner or assignee"
  on public.announcement_admin_assignments;
create policy "announcement assignments visible to owner or assignee"
on public.announcement_admin_assignments for select to authenticated
using (
  public.current_user_is_announcement_owner()
  or admin_id = auth.uid()
);

drop policy if exists "owner manages announcement assignments"
  on public.announcement_admin_assignments;
create policy "owner manages announcement assignments"
on public.announcement_admin_assignments for all to authenticated
using (public.current_user_is_announcement_owner())
with check (public.current_user_is_announcement_owner());

drop policy if exists "authorized staff read announcements" on public.announcements;
create policy "authorized staff read announcements"
on public.announcements for select to authenticated
using (public.current_user_can_access_announcements());

drop policy if exists "authorized staff create announcements" on public.announcements;
create policy "authorized staff create announcements"
on public.announcements for insert to authenticated
with check (
  public.current_user_can_access_announcements()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

drop policy if exists "authorized staff update announcements" on public.announcements;
create policy "authorized staff update announcements"
on public.announcements for update to authenticated
using (public.current_user_can_access_announcements())
with check (public.current_user_can_access_announcements());

grant select, insert, update on public.announcements to authenticated;
grant select, insert, update on public.announcement_admin_assignments to authenticated;
grant execute on function public.current_user_is_announcement_owner() to authenticated;
grant execute on function public.current_user_can_access_announcements() to authenticated;

revoke delete on public.announcements from authenticated;
revoke delete on public.announcement_admin_assignments from authenticated;

comment on table public.announcements is
  '仅负责人、CEO 和负责人指定管理员可查看与发布的内部通知公告';
comment on table public.announcement_admin_assignments is
  '负责人授予普通管理员的通知公告查看与发布权限，撤销记录保留';
comment on function public.current_user_can_access_announcements() is
  '统一判断当前账号是否具备通知公告查看与发布权限';
