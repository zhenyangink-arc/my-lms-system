-- 将历史 super_admin 拆成互斥的平台负责人和机构负责人。
-- global_role 决定 URL 空间；profiles.role / tenant_memberships.role 决定具体权限。

begin;

lock table public.profiles in share row exclusive mode;
lock table public.tenant_memberships in share row exclusive mode;

-- 先移除旧角色约束，数据和函数完成迁移后再以新角色集合重建。
do $$
declare
  role_constraint record;
begin
  for role_constraint in
    select constraint_row.conname
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) like '%role%'
      and pg_get_constraintdef(constraint_row.oid) not like '%global_role%'
  loop
    execute format('alter table public.profiles drop constraint %I', role_constraint.conname);
  end loop;
end;
$$;

alter table public.tenant_memberships
  drop constraint if exists tenant_memberships_role_check;

alter table public.profiles
  drop constraint if exists profiles_role_global_consistency_check;

-- 旧迁移中有大量函数直接比较历史角色。统一改成机构负责人，随后单独
-- 重建平台权限函数，避免租户权限被误当成平台权限。
do $$
declare
  routine record;
  definition text;
begin
  for routine in
    select procedure_row.oid
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname in ('public', 'private')
      and procedure_row.prokind = 'f'
      and pg_get_functiondef(procedure_row.oid) like '%''super_admin''%'
  loop
    definition := replace(
      pg_get_functiondef(routine.oid),
      '''super_admin''',
      '''tenant_super_admin'''
    );
    execute definition;
  end loop;
end;
$$;

-- 同步改写仍引用历史角色的 RLS 表达式。
do $$
declare
  policy_row record;
  alter_statement text;
  using_expression text;
  check_expression text;
begin
  for policy_row in
    select
      namespace_row.nspname as schema_name,
      table_row.relname as table_name,
      policy.polname as policy_name,
      pg_get_expr(policy.polqual, policy.polrelid) as using_expression,
      pg_get_expr(policy.polwithcheck, policy.polrelid) as check_expression
    from pg_policy as policy
    join pg_class as table_row on table_row.oid = policy.polrelid
    join pg_namespace as namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and (
        coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') like '%''super_admin''%'
        or coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), '') like '%''super_admin''%'
      )
  loop
    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_row.policy_name,
      policy_row.schema_name,
      policy_row.table_name
    );
    using_expression := replace(policy_row.using_expression, '''super_admin''', '''tenant_super_admin''');
    check_expression := replace(policy_row.check_expression, '''super_admin''', '''tenant_super_admin''');

    if using_expression is not null then
      alter_statement := alter_statement || format(' using (%s)', using_expression);
    end if;
    if check_expression is not null then
      alter_statement := alter_statement || format(' with check (%s)', check_expression);
    end if;

    execute alter_statement;
  end loop;
end;
$$;

-- 平台租户控制面只接受成对匹配的平台身份。
create or replace function private.is_platform_tenant_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and coalesce(profile.status, 'active') = 'active'
      and (
        (profile.global_role = 'platform_owner' and profile.role = 'platform_super_admin')
        or (profile.global_role = 'platform_deputy' and profile.role = 'tenant_operator')
      )
  );
$$;

-- 当前业务角色只能来自当前租户成员关系，平台角色不再回退成业务角色。
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.tenant_memberships as membership
  where membership.user_id = (select auth.uid())
    and membership.tenant_id = private.current_tenant_id()
    and membership.status = 'active'
  limit 1;
$$;

create or replace function public.current_profile_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(profile.status, 'active') <> 'active' then coalesce(profile.status, 'active')
    when (
      (profile.global_role = 'platform_owner' and profile.role = 'platform_super_admin')
      or (profile.global_role = 'platform_deputy' and profile.role = 'tenant_operator')
    ) then 'active'
    when private.current_tenant_id() is not null then 'active'
    else 'inactive'
  end
  from public.profiles as profile
  where profile.id = (select auth.uid());
$$;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.current_profile_status() = 'active';
$$;

create or replace function public.is_owner_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and public.current_profile_role() = 'tenant_super_admin';
$$;

create or replace function public.is_executive_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and public.current_profile_role() in ('tenant_super_admin', 'ceo');
$$;

create or replace function public.is_admin_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and public.current_profile_role() in ('tenant_super_admin', 'ceo', 'admin');
$$;

-- 平台共享目录：PUFFY 租户管理层可维护，平台侧仅平台负责人可维护。
create or replace function private.is_platform_catalog_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and membership.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
      and membership.status = 'active'
      and membership.role in ('admin', 'ceo', 'tenant_super_admin')
      and coalesce(profile.status, 'active') = 'active'
  )
  or exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.global_role = 'platform_owner'
      and profile.role = 'platform_super_admin'
      and coalesce(profile.status, 'active') = 'active'
  );
$$;

-- profiles 仍是账号管理的过渡写入口，但只同步到机构成员关系；平台账号
-- 一旦获得平台角色，会同时清除历史租户成员关系。
create or replace function private.sync_profile_to_bootstrap_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  if old.role is not distinct from new.role
     and old.status is not distinct from new.status
     and old.membership_tier is not distinct from new.membership_tier then
    return new;
  end if;

  if new.role in ('platform_super_admin', 'tenant_operator') then
    perform set_config('app.tenant_hard_delete', 'on', true);
    delete from public.tenant_memberships where user_id = new.id;
    return new;
  end if;

  select provisioned.tenant_id into target_tenant_id
  from public.tenant_provisioned_accounts as provisioned
  where provisioned.user_id = new.id
  order by provisioned.created_at, provisioned.tenant_id
  limit 1;

  target_tenant_id := coalesce(target_tenant_id, private.default_tenant_of(new.id));
  if target_tenant_id is null then
    return new;
  end if;

  update public.tenant_memberships as membership
  set role = case
        when new.role in ('student', 'teacher', 'admin', 'ceo', 'tenant_super_admin') then new.role
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
          select 1 from public.tenant_memberships as other
          where other.user_id = new.id
            and other.tenant_id <> membership.tenant_id
            and other.status = 'active'
            and other.is_default
        )
      end,
      updated_at = now()
  where membership.tenant_id = target_tenant_id
    and membership.user_id = new.id;

  return new;
end;
$$;

-- 数据迁移期间关闭 profiles -> membership 同步，避免半迁移状态触发交叉写入。
alter table public.profiles disable trigger profiles_sync_bootstrap_membership;

-- tenant_provisioned_accounts 是机构负责人身份的最强来源。
update public.profiles as profile
set role = 'tenant_super_admin',
    global_role = 'tenant_super_admin'
where profile.role = 'tenant_super_admin'
   or profile.global_role = 'tenant_super_admin'
   or exists (
     select 1 from public.tenant_provisioned_accounts as account
     where account.user_id = profile.id
   );

update public.profiles as profile
set role = 'tenant_operator',
    global_role = 'platform_deputy'
where profile.role = 'tenant_operator'
   or profile.global_role = 'platform_deputy';

update public.profiles as profile
set role = 'platform_super_admin',
    global_role = 'platform_owner'
where (
    profile.role in ('super_admin', 'platform_super_admin')
    or profile.global_role = 'platform_owner'
  )
  and not exists (
    select 1 from public.tenant_provisioned_accounts as account
    where account.user_id = profile.id
  );

update public.tenant_memberships
set role = 'tenant_super_admin'
where role = 'super_admin';

-- 非平台账号如果已经是某租户的负责人，统一同步其资料身份。
update public.profiles as profile
set role = 'tenant_super_admin',
    global_role = 'tenant_super_admin'
where profile.global_role not in ('platform_owner', 'platform_deputy')
  and exists (
    select 1 from public.tenant_memberships as membership
    where membership.user_id = profile.id
      and membership.role = 'tenant_super_admin'
  );

update public.profiles
set global_role = 'member'
where role in ('student', 'teacher', 'admin', 'ceo')
  and global_role is distinct from 'member';

-- 平台身份不能同时持有租户成员身份；机构开通账号也只保留其归属租户。
select set_config('app.tenant_hard_delete', 'on', true);

delete from public.tenant_memberships as membership
using public.profiles as profile
where membership.user_id = profile.id
  and profile.role in ('platform_super_admin', 'tenant_operator');

delete from public.tenant_memberships as membership
where exists (
    select 1 from public.tenant_provisioned_accounts as account
    where account.user_id = membership.user_id
  )
  and not exists (
    select 1 from public.tenant_provisioned_accounts as account
    where account.user_id = membership.user_id
      and account.tenant_id = membership.tenant_id
  );

-- 修复历史上已开通但成员关系缺失/角色不一致的机构负责人。
with provisioned as (
  select
    account.tenant_id,
    account.user_id,
    account.created_by,
    row_number() over (
      partition by account.user_id
      order by account.created_at, account.tenant_id
    ) = 1 as is_default
  from public.tenant_provisioned_accounts as account
)
insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  status,
  membership_tier,
  is_default,
  invited_by,
  joined_at
)
select
  provisioned.tenant_id,
  provisioned.user_id,
  'tenant_super_admin',
  case when coalesce(profile.status, 'active') = 'active' then 'active' else 'suspended' end,
  'normal',
  provisioned.is_default and coalesce(profile.status, 'active') = 'active',
  provisioned.created_by,
  now()
from provisioned
join public.profiles as profile on profile.id = provisioned.user_id
on conflict (tenant_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    is_default = excluded.is_default,
    updated_at = now();

alter table public.profiles enable trigger profiles_sync_bootstrap_membership;

-- global_role 对所有新账号默认显式为 member，URL 空间不再依赖空值推断。
update public.profiles set global_role = 'member' where global_role is null;

alter table public.profiles
  alter column global_role set default 'member',
  alter column global_role set not null;

alter table public.profiles
  drop constraint if exists profiles_global_role_check;

alter table public.profiles
  add constraint profiles_global_role_check check (
    global_role in ('platform_owner', 'platform_deputy', 'tenant_super_admin', 'member')
  ),
  add constraint profiles_role_check check (
    role in (
      'student', 'teacher', 'admin', 'ceo',
      'platform_super_admin', 'tenant_super_admin', 'tenant_operator'
    )
  ),
  add constraint profiles_role_global_consistency_check check (
    (role = 'platform_super_admin' and global_role = 'platform_owner')
    or (role = 'tenant_operator' and global_role = 'platform_deputy')
    or (role = 'tenant_super_admin' and global_role = 'tenant_super_admin')
    or (role in ('student', 'teacher', 'admin', 'ceo') and global_role = 'member')
  );

alter table public.tenant_memberships
  add constraint tenant_memberships_role_check check (
    role in ('student', 'teacher', 'admin', 'ceo', 'tenant_super_admin')
  );

comment on column public.profiles.global_role is
  'URL 空间身份：platform_owner/platform_deputy 进入平台空间，其余进入租户空间';
comment on column public.profiles.role is
  '账号权限角色：platform_super_admin 与 tenant_super_admin 互斥，不再使用历史 super_admin';
comment on column public.tenant_memberships.role is
  '当前租户内的业务角色；租户最高角色为 tenant_super_admin';

revoke all on function private.is_platform_tenant_manager() from public;
revoke all on function private.is_platform_catalog_manager() from public;
grant execute on function private.is_platform_tenant_manager() to authenticated, service_role;
grant execute on function private.is_platform_catalog_manager() to authenticated, service_role;
grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.current_profile_status() to authenticated, service_role;
grant execute on function public.is_active_account() to authenticated, service_role;
grant execute on function public.is_owner_account() to authenticated, service_role;
grant execute on function public.is_executive_account() to authenticated, service_role;
grant execute on function public.is_admin_account() to authenticated, service_role;

-- 防止迁移完成后仍有任何运行时对象或数据接受历史角色。
do $$
begin
  if exists (select 1 from public.profiles where role = 'super_admin')
     or exists (select 1 from public.tenant_memberships where role = 'super_admin') then
    raise exception '角色拆分失败：数据中仍存在历史 super_admin';
  end if;

  if exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname in ('public', 'private')
      and procedure_row.prokind = 'f'
      and procedure_row.prosrc like '%''super_admin''%'
  ) then
    raise exception '角色拆分失败：数据库函数中仍存在历史 super_admin';
  end if;

  if exists (
    select 1
    from pg_policy as policy
    join pg_class as table_row on table_row.oid = policy.polrelid
    join pg_namespace as namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and (
        coalesce(pg_get_expr(policy.polqual, policy.polrelid), '') like '%''super_admin''%'
        or coalesce(pg_get_expr(policy.polwithcheck, policy.polrelid), '') like '%''super_admin''%'
      )
  ) then
    raise exception '角色拆分失败：RLS 策略中仍存在历史 super_admin';
  end if;
end;
$$;

commit;
