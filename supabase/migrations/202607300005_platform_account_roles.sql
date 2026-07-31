-- 平台账号与机构账号使用独立的身份空间。
-- 平台管理员沿用 admin 的业务权限标识，但通过 global_role 保持在平台空间，
-- 且永远不建立 tenant_memberships。
begin;

alter table public.profiles
  drop constraint if exists profiles_global_role_check,
  drop constraint if exists profiles_role_global_consistency_check;

alter table public.profiles
  add constraint profiles_global_role_check check (
    global_role in (
      'platform_owner',
      'platform_deputy',
      'platform_admin',
      'tenant_super_admin',
      'member'
    )
  ),
  add constraint profiles_role_global_consistency_check check (
    (role = 'platform_super_admin' and global_role = 'platform_owner')
    or (role = 'tenant_operator' and global_role = 'platform_deputy')
    or (role = 'admin' and global_role = 'platform_admin')
    or (role = 'tenant_super_admin' and global_role = 'tenant_super_admin')
    or (role in ('student', 'teacher', 'admin', 'ceo') and global_role = 'member')
  );

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
     and old.global_role is not distinct from new.global_role
     and old.status is not distinct from new.status
     and old.membership_tier is not distinct from new.membership_tier then
    return new;
  end if;

  if new.global_role in ('platform_owner', 'platform_deputy', 'platform_admin') then
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
  set role = case
        when new.role in ('student', 'teacher', 'admin', 'ceo', 'tenant_super_admin')
          then new.role
        else 'student'
      end,
      status = case
        when coalesce(new.status, 'active') = 'active' then 'active'
        else 'suspended'
      end,
      membership_tier = case
        when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3')
          then new.membership_tier
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
  where membership.tenant_id = target_tenant_id
    and membership.user_id = new.id;

  return new;
end;
$$;

comment on column public.profiles.global_role is
  '账号空间身份：platform_owner/platform_deputy/platform_admin 进入平台空间，tenant_super_admin/member 进入机构空间';

commit;
