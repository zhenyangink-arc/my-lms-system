-- 租户账号、生命周期与安全删除。
-- 用户使用 login_id + password；Supabase Auth 邮箱仅作为不可见认证载体。

begin;

alter table public.profiles add column if not exists login_id text;

create unique index if not exists profiles_login_id_unique_idx
  on public.profiles (lower(login_id))
  where login_id is not null;

alter table public.profiles drop constraint if exists profiles_login_id_check;
alter table public.profiles add constraint profiles_login_id_check check (
  login_id is null
  or (login_id = lower(login_id) and login_id ~ '^[a-z0-9][a-z0-9_-]{2,31}$')
);

create table if not exists public.tenant_provisioned_accounts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.tenant_lifecycle_audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null,
  tenant_slug text not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('suspended', 'archived', 'restored', 'permanently_deleted')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tenant_lifecycle_audit_tenant_created_idx
  on public.tenant_lifecycle_audit_logs (tenant_id, created_at desc);

-- 永久删除流程专用标记，避免成员完整性触发器阻止已确认的整个租户删除。
create or replace function private.enforce_tenant_membership_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  affected_tenant_id uuid;
  removes_owner boolean := false;
  is_hard_delete boolean := coalesce(current_setting('app.tenant_hard_delete', true), '') = 'on';
begin
  affected_tenant_id := case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end;

  if tg_op <> 'DELETE' and new.is_default and new.status <> 'active' then
    raise exception '默认租户成员关系必须处于活跃状态';
  end if;

  if tg_op = 'DELETE' then
    removes_owner := old.role = 'super_admin' and old.status = 'active';
  elsif tg_op = 'UPDATE' then
    removes_owner := old.role = 'super_admin' and old.status = 'active'
      and (new.role <> 'super_admin' or new.status <> 'active');
  end if;

  if not is_hard_delete and removes_owner and not exists (
    select 1 from public.tenant_memberships as membership
    where membership.tenant_id = affected_tenant_id
      and membership.user_id <> old.user_id
      and membership.role = 'super_admin'
      and membership.status = 'active'
  ) then
    raise exception '租户必须保留至少一个活跃的超级管理员';
  end if;

  if tg_op = 'UPDATE'
     and actor_id = old.user_id
     and new.tenant_id = old.tenant_id
     and new.user_id = old.user_id
     and new.role = old.role
     and new.status = old.status
     and new.membership_tier = old.membership_tier
     and new.invited_by is not distinct from old.invited_by
     and new.joined_at is not distinct from old.joined_at
     and new.created_at = old.created_at then
    return new;
  end if;

  if tg_op = 'INSERT'
     and actor_id = new.user_id
     and new.role = 'super_admin'
     and new.status = 'active'
     and exists (select 1 from public.tenants as tenant where tenant.id = new.tenant_id and tenant.created_by = actor_id)
     and not exists (select 1 from public.tenant_memberships as membership where membership.tenant_id = new.tenant_id) then
    return new;
  end if;

  if tg_op = 'INSERT'
     and new.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
     and (actor_id is null or actor_id = new.user_id)
     and new.role = 'student'
     and not exists (select 1 from public.tenant_memberships as membership where membership.user_id = new.user_id) then
    return new;
  end if;

  if actor_id is not null and auth.role() <> 'service_role'
     and not private.has_tenant_role(affected_tenant_id, array['super_admin']::text[]) then
    if not private.has_tenant_role(affected_tenant_id, array['ceo']::text[]) then
      raise exception '只有租户超级管理员或 CEO 可以管理成员';
    end if;
    if (tg_op <> 'INSERT' and old.role = 'super_admin')
       or (tg_op <> 'DELETE' and new.role = 'super_admin') then
      raise exception '只有租户超级管理员可以管理超级管理员角色';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.set_tenant_lifecycle_status(requested_tenant_id uuid, requested_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tenants%rowtype;
  audit_action text;
begin
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid() and profile.role = 'super_admin' and coalesce(profile.status, 'active') = 'active'
  ) then raise exception '只有负责人可以变更租户状态'; end if;
  if requested_status not in ('active', 'suspended', 'archived') then raise exception '租户状态不正确'; end if;

  select * into target from public.tenants where id = requested_tenant_id for update;
  if not found then raise exception '租户不存在'; end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid and requested_status <> 'active' then
    raise exception '默认 PUFFY 租户不能停用或归档';
  end if;

  update public.tenants set status = requested_status where id = target.id;
  audit_action := case requested_status when 'active' then 'restored' when 'suspended' then 'suspended' else 'archived' end;
  insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, actor_id, action, details)
  values (target.id, target.slug, auth.uid(), audit_action, jsonb_build_object('previous_status', target.status));
end;
$$;

create or replace function public.delete_tenant_permanently(requested_tenant_id uuid, requested_slug_confirmation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.tenants%rowtype;
  removed_members integer := 0;
begin
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = auth.uid() and profile.role = 'super_admin' and coalesce(profile.status, 'active') = 'active'
  ) then raise exception '只有负责人可以永久删除租户'; end if;

  select * into target from public.tenants where id = requested_tenant_id for update;
  if not found then raise exception '租户不存在'; end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid then raise exception '默认 PUFFY 租户不能永久删除'; end if;
  if target.status <> 'archived' then raise exception '请先归档租户，再执行永久删除'; end if;
  if lower(btrim(requested_slug_confirmation)) <> target.slug then raise exception '删除确认租户标识不正确'; end if;

  perform set_config('app.tenant_hard_delete', 'on', true);
  delete from public.tenant_memberships where tenant_id = target.id;
  get diagnostics removed_members = row_count;
  delete from public.tenant_membership_audit_logs where tenant_id = target.id;
  delete from public.tenants where id = target.id;
  insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, actor_id, action, details)
  values (target.id, target.slug, auth.uid(), 'permanently_deleted', jsonb_build_object('removed_memberships', removed_members));
end;
$$;

alter table public.tenant_provisioned_accounts enable row level security;
alter table public.tenant_lifecycle_audit_logs enable row level security;

create policy "owners read provisioned tenant accounts"
on public.tenant_provisioned_accounts for select to authenticated
using ((select private.has_tenant_role(tenant_id, array['super_admin']::text[])));

create policy "platform owners read tenant lifecycle audit"
on public.tenant_lifecycle_audit_logs for select to authenticated
using (exists (select 1 from public.profiles as profile where profile.id = auth.uid() and profile.role = 'super_admin' and coalesce(profile.status, 'active') = 'active'));

revoke all on public.tenant_provisioned_accounts, public.tenant_lifecycle_audit_logs from anon;
grant select on public.tenant_provisioned_accounts, public.tenant_lifecycle_audit_logs to authenticated;
revoke all on function public.set_tenant_lifecycle_status(uuid, text) from public;
revoke all on function public.delete_tenant_permanently(uuid, text) from public;
grant execute on function public.set_tenant_lifecycle_status(uuid, text) to authenticated;
grant execute on function public.delete_tenant_permanently(uuid, text) to authenticated;

commit;
