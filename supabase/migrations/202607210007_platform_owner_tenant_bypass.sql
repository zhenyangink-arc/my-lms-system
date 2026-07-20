-- 平台负责人是平台层身份：不属于任何具体租户，但可绕过租户级 RLS。
-- 撤销 202607210006 将平台负责人绑定默认租户的过渡方案。
begin;

create or replace function private.is_platform_owner()
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
      and profile.global_role = 'platform_owner'
      and profile.role = 'platform_super_admin'
      and coalesce(profile.status, 'active') = 'active'
  );
$$;

revoke all on function private.is_platform_owner() from public;
grant execute on function private.is_platform_owner() to authenticated, service_role;

-- 平台账号不保留任何租户成员关系。
select set_config('app.tenant_hard_delete', 'on', true);
delete from public.tenant_memberships as membership
using public.profiles as profile
where membership.user_id = profile.id
  and profile.role in ('platform_super_admin', 'tenant_operator');

-- profiles 变化时继续保持平台身份与租户成员身份互斥。
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
  if target_tenant_id is null then return new; end if;

  update public.tenant_memberships as membership
  set role = case when new.role in ('student', 'teacher', 'admin', 'ceo', 'tenant_super_admin') then new.role else 'student' end,
      status = case when coalesce(new.status, 'active') = 'active' then 'active' else 'suspended' end,
      membership_tier = case when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then new.membership_tier else 'normal' end,
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

-- 服务端权限函数直接识别平台负责人，不再依赖 current_tenant_id()。
create or replace function public.is_owner_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() = 'tenant_super_admin');
$$;

create or replace function public.is_executive_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() in ('tenant_super_admin', 'ceo'));
$$;

create or replace function public.is_admin_account()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and (private.is_platform_owner() or public.current_profile_role() in ('tenant_super_admin', 'ceo', 'admin'));
$$;

-- 给所有租户业务表及 profiles 的现有策略增加平台负责人旁路。
-- ALTER POLICY 保留原 command 与 roles，只扩展 USING / WITH CHECK。
do $$
declare
  policy_row record;
  statement text;
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
        table_row.relname = 'profiles'
        or exists (
          select 1 from pg_attribute as attribute
          where attribute.attrelid = table_row.oid
            and attribute.attname = 'tenant_id'
            and not attribute.attisdropped
        )
      )
  loop
    using_expression := policy_row.using_expression;
    check_expression := policy_row.check_expression;
    if coalesce(using_expression, '') like '%is_platform_owner%' or coalesce(check_expression, '') like '%is_platform_owner%' then
      continue;
    end if;

    statement := format('alter policy %I on %I.%I', policy_row.policy_name, policy_row.schema_name, policy_row.table_name);
    if using_expression is not null then
      statement := statement || format(' using ((%s) or (select private.is_platform_owner()))', using_expression);
    end if;
    if check_expression is not null then
      statement := statement || format(' with check ((%s) or (select private.is_platform_owner()))', check_expression);
    end if;
    execute statement;
  end loop;
end;
$$;

commit;
