-- ============================================================
-- 多租户 SaaS 控制面（共享数据库、共享表）
--
-- 本迁移只建立租户、成员关系、租户角色、审计与 RLS 辅助函数，
-- 不改变现有业务表及其策略。业务表 tenant_id 按模块在后续迁移中接入。
-- ============================================================

begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  plan_key text not null default 'starter',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_check check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  constraint tenants_name_check check (char_length(btrim(name)) between 2 and 120),
  constraint tenants_status_check check (status in ('active', 'suspended', 'archived')),
  constraint tenants_plan_key_check check (plan_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint tenants_settings_object_check check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'student',
  status text not null default 'active',
  membership_tier text not null default 'normal',
  is_default boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_memberships_role_check check (
    role in ('student', 'teacher', 'admin', 'ceo', 'super_admin')
  ),
  constraint tenant_memberships_status_check check (
    status in ('invited', 'active', 'suspended', 'left')
  ),
  constraint tenant_memberships_tier_check check (
    membership_tier in ('normal', 'vip1', 'vip2', 'vip3')
  ),
  constraint tenant_memberships_default_active_check check (
    not is_default or status = 'active'
  )
);

create unique index if not exists tenant_memberships_one_default_per_user_idx
  on public.tenant_memberships (user_id)
  where is_default and status = 'active';

create index if not exists tenant_memberships_user_status_idx
  on public.tenant_memberships (user_id, status, is_default desc);

create index if not exists tenant_memberships_tenant_role_status_idx
  on public.tenant_memberships (tenant_id, role, status, user_id);

create table if not exists public.tenant_membership_audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null,
  operation text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  constraint tenant_membership_audit_operation_check check (
    operation in ('insert', 'update', 'delete')
  )
);

create index if not exists tenant_membership_audit_tenant_created_idx
  on public.tenant_membership_audit_logs (tenant_id, created_at desc);

create index if not exists tenant_membership_audit_target_created_idx
  on public.tenant_membership_audit_logs (target_user_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function private.set_updated_at();

drop trigger if exists tenant_memberships_set_updated_at on public.tenant_memberships;
create trigger tenant_memberships_set_updated_at
before update on public.tenant_memberships
for each row execute function private.set_updated_at();

-- 当前租户是用户主动选择的默认租户；若历史数据没有默认值，则稳定回退到最早加入的活跃租户。
create or replace function private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.tenant_id
  from public.tenant_memberships as membership
  join public.tenants as tenant on tenant.id = membership.tenant_id
  where membership.user_id = (select auth.uid())
    and membership.status = 'active'
    and tenant.status = 'active'
  order by membership.is_default desc, membership.created_at, membership.tenant_id
  limit 1;
$$;

create or replace function private.is_tenant_member(requested_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.tenants as tenant on tenant.id = membership.tenant_id
    where membership.tenant_id = requested_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and tenant.status = 'active'
  );
$$;

create or replace function private.has_tenant_role(
  requested_tenant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.tenants as tenant on tenant.id = membership.tenant_id
    where membership.tenant_id = requested_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and tenant.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function private.has_current_tenant_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_role(private.current_tenant_id(), allowed_roles);
$$;

-- 成员关系的关键不变量：默认成员必须活跃，且租户不能失去最后一个活跃超级管理员。
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
begin
  affected_tenant_id := case
    when tg_op = 'DELETE' then old.tenant_id
    else new.tenant_id
  end;

  if tg_op <> 'DELETE' and new.is_default and new.status <> 'active' then
    raise exception '默认租户成员关系必须处于活跃状态';
  end if;

  if tg_op = 'DELETE' then
    removes_owner := old.role = 'super_admin' and old.status = 'active';
  elsif tg_op = 'UPDATE' then
    removes_owner := old.role = 'super_admin'
      and old.status = 'active'
      and (new.role <> 'super_admin' or new.status <> 'active');
  end if;

  if removes_owner and not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = affected_tenant_id
      and membership.user_id <> old.user_id
      and membership.role = 'super_admin'
      and membership.status = 'active'
  ) then
    raise exception '租户必须保留至少一个活跃的超级管理员';
  end if;

  -- 默认租户切换只允许用户修改自己的 is_default 标记。
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

  -- create_tenant() 允许创建者写入新租户的第一条超级管理员成员关系。
  if tg_op = 'INSERT'
     and actor_id = new.user_id
     and new.role = 'super_admin'
     and new.status = 'active'
     and exists (
       select 1
       from public.tenants as tenant
       where tenant.id = new.tenant_id
         and tenant.created_by = actor_id
     )
     and not exists (
       select 1
       from public.tenant_memberships as membership
       where membership.tenant_id = new.tenant_id
     ) then
    return new;
  end if;

  -- 注册触发器可以把新学生加入兼容租户；普通客户端仍会先被 RLS 拒绝直接插入。
  if tg_op = 'INSERT'
     and new.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
     and (actor_id is null or actor_id = new.user_id)
     and new.role = 'student'
     and not exists (
       select 1
       from public.tenant_memberships as membership
       where membership.user_id = new.user_id
     ) then
    return new;
  end if;

  -- CEO 可以管理普通成员，但不能授予、修改或移除超级管理员角色。
  if actor_id is not null
     and auth.role() <> 'service_role'
     and not private.has_tenant_role(
       affected_tenant_id,
       array['super_admin']::text[]
     ) then
    if not private.has_tenant_role(
      affected_tenant_id,
      array['ceo']::text[]
    ) then
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

drop trigger if exists tenant_memberships_enforce_integrity on public.tenant_memberships;
create trigger tenant_memberships_enforce_integrity
before insert or update or delete on public.tenant_memberships
for each row execute function private.enforce_tenant_membership_integrity();

create or replace function private.audit_tenant_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_membership_audit_logs (
    tenant_id,
    actor_id,
    target_user_id,
    operation,
    before_data,
    after_data
  ) values (
    case when tg_op = 'DELETE' then old.tenant_id else new.tenant_id end,
    auth.uid(),
    case when tg_op = 'DELETE' then old.user_id else new.user_id end,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists tenant_memberships_audit_change on public.tenant_memberships;
create trigger tenant_memberships_audit_change
after insert or update or delete on public.tenant_memberships
for each row execute function private.audit_tenant_membership_change();

-- 固定 ID 让后续业务表回填可以安全、可重复地引用现有单租户数据。
insert into public.tenants (
  id,
  slug,
  name,
  status,
  plan_key,
  created_by
) values (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'puffy',
  'PUFFY',
  'active',
  'legacy',
  (
    select profile.id
    from public.profiles as profile
    where profile.role = 'super_admin'
    order by profile.created_at, profile.id
    limit 1
  )
)
on conflict (id) do nothing;

insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  status,
  membership_tier,
  is_default,
  joined_at
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  profile.id,
  case
    when profile.role in ('student', 'teacher', 'admin', 'ceo', 'super_admin') then profile.role
    else 'student'
  end,
  case
    when coalesce(profile.status, 'active') = 'active' then 'active'
    else 'suspended'
  end,
  case
    when profile.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then profile.membership_tier
    else 'normal'
  end,
  coalesce(profile.status, 'active') = 'active',
  coalesce(profile.registered_at, profile.created_at, now())
from public.profiles as profile
on conflict (tenant_id, user_id) do nothing;

-- 在邀请式注册流程完成前，新账号继续进入现有 PUFFY 租户，避免产生孤儿 profile。
create or replace function private.attach_new_profile_to_bootstrap_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    membership_tier,
    is_default,
    joined_at
  ) values (
    '00000000-0000-4000-8000-000000000001'::uuid,
    new.id,
    case
      when new.role in ('student', 'teacher', 'admin', 'ceo', 'super_admin') then new.role
      else 'student'
    end,
    case when coalesce(new.status, 'active') = 'active' then 'active' else 'suspended' end,
    case
      when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then new.membership_tier
      else 'normal'
    end,
    coalesce(new.status, 'active') = 'active',
    coalesce(new.registered_at, new.created_at, now())
  )
  on conflict (tenant_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_attach_bootstrap_tenant on public.profiles;
create trigger profiles_attach_bootstrap_tenant
after insert on public.profiles
for each row execute function private.attach_new_profile_to_bootstrap_tenant();

-- 过渡期账号管理仍写 profiles；同步兼容租户成员关系以保持现有停用、角色和会员操作可用。
create or replace function private.sync_profile_to_bootstrap_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is not distinct from new.role
     and old.status is not distinct from new.status
     and old.membership_tier is not distinct from new.membership_tier then
    return new;
  end if;

  update public.tenant_memberships as membership
  set role = case
        when new.role in ('student', 'teacher', 'admin', 'ceo', 'super_admin') then new.role
        else 'student'
      end,
      status = case
        when coalesce(new.status, 'active') = 'active' then 'active'
        else 'suspended'
      end,
      membership_tier = case
        when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then new.membership_tier
        else 'normal'
      end,
      is_default = case
        when coalesce(new.status, 'active') <> 'active' then false
        when membership.is_default then true
        else not exists (
          select 1
          from public.tenant_memberships as other
          where other.user_id = new.id
            and other.tenant_id <> membership.tenant_id
            and other.status = 'active'
            and other.is_default
        )
      end,
      updated_at = now()
  where membership.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
    and membership.user_id = new.id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_bootstrap_membership on public.profiles;
create trigger profiles_sync_bootstrap_membership
after update of role, status, membership_tier on public.profiles
for each row execute function private.sync_profile_to_bootstrap_membership();

-- 原子切换默认租户。客户端传入的 tenant_id 只用于选择，成员资格仍由数据库验证。
create or replace function public.set_default_tenant(requested_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '需要登录后才能切换租户';
  end if;

  if not private.is_tenant_member(requested_tenant_id) then
    raise exception '无权访问该租户';
  end if;

  perform 1
  from public.tenant_memberships as membership
  where membership.user_id = auth.uid()
  for update;

  update public.tenant_memberships
  set is_default = false
  where user_id = auth.uid()
    and is_default;

  update public.tenant_memberships
  set is_default = true,
      updated_at = now()
  where tenant_id = requested_tenant_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

-- 仅保留给迁移期平台超级管理员使用；正式自助开通应走计费/审批后的服务端流程。
create or replace function public.create_tenant(
  requested_name text,
  requested_slug text,
  requested_plan_key text default 'starter'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_tenant_id uuid;
begin
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and coalesce(profile.status, 'active') = 'active'
      and profile.role = 'super_admin'
  ) then
    raise exception '只有平台超级管理员可以创建租户';
  end if;

  insert into public.tenants (slug, name, plan_key, created_by)
  values (lower(btrim(requested_slug)), btrim(requested_name), requested_plan_key, auth.uid())
  returning id into created_tenant_id;

  insert into public.tenant_memberships (
    tenant_id,
    user_id,
    role,
    status,
    membership_tier,
    is_default,
    joined_at
  ) values (
    created_tenant_id,
    auth.uid(),
    'super_admin',
    'active',
    'normal',
    false,
    now()
  );

  return created_tenant_id;
end;
$$;

alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_membership_audit_logs enable row level security;

create policy "members read their tenants"
on public.tenants
for select
to authenticated
using ((select private.is_tenant_member(id)));

create policy "tenant owners update their tenant"
on public.tenants
for update
to authenticated
using ((select private.has_tenant_role(id, array['super_admin']::text[])))
with check ((select private.has_tenant_role(id, array['super_admin']::text[])));

create policy "members or managers read tenant memberships"
on public.tenant_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_tenant_role(
    tenant_id,
    array['ceo', 'super_admin']::text[]
  ))
);

create policy "tenant managers create memberships"
on public.tenant_memberships
for insert
to authenticated
with check ((select private.has_tenant_role(
  tenant_id,
  array['ceo', 'super_admin']::text[]
)));

create policy "tenant managers update memberships"
on public.tenant_memberships
for update
to authenticated
using ((select private.has_tenant_role(
  tenant_id,
  array['ceo', 'super_admin']::text[]
)))
with check ((select private.has_tenant_role(
  tenant_id,
  array['ceo', 'super_admin']::text[]
)));

create policy "tenant managers delete memberships"
on public.tenant_memberships
for delete
to authenticated
using ((select private.has_tenant_role(
  tenant_id,
  array['ceo', 'super_admin']::text[]
)));

create policy "tenant owners read membership audit logs"
on public.tenant_membership_audit_logs
for select
to authenticated
using ((select private.has_tenant_role(
  tenant_id,
  array['super_admin']::text[]
)));

revoke all on public.tenants from anon;
revoke all on public.tenant_memberships from anon;
revoke all on public.tenant_membership_audit_logs from anon;

grant select, update on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_memberships to authenticated;
grant select on public.tenant_membership_audit_logs to authenticated;

revoke all on function private.current_tenant_id() from public;
revoke all on function private.is_tenant_member(uuid) from public;
revoke all on function private.has_tenant_role(uuid, text[]) from public;
revoke all on function private.has_current_tenant_role(text[]) from public;
grant execute on function private.current_tenant_id() to authenticated, service_role;
grant execute on function private.is_tenant_member(uuid) to authenticated, service_role;
grant execute on function private.has_tenant_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.has_current_tenant_role(text[]) to authenticated, service_role;

revoke all on function public.set_default_tenant(uuid) from public;
revoke all on function public.create_tenant(text, text, text) from public;
grant execute on function public.set_default_tenant(uuid) to authenticated;
grant execute on function public.create_tenant(text, text, text) to authenticated;

comment on table public.tenants is 'SaaS 租户控制面；业务数据通过 tenant_id 关联';
comment on table public.tenant_memberships is '用户在不同租户中的角色、状态与会员档位';
comment on table public.tenant_membership_audit_logs is '租户成员关系的不可由客户端改写的审计记录';
comment on function private.current_tenant_id() is '返回当前用户选择的活跃默认租户';
comment on function private.is_tenant_member(uuid) is 'RLS 使用的租户成员资格判断';
comment on function private.has_tenant_role(uuid, text[]) is 'RLS 使用的租户角色判断';

commit;
