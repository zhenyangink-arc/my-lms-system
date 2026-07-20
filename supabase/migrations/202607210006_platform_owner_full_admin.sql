-- 平台负责人既管理 SaaS 组织控制面，也保留默认机构的完整业务后台。
-- 平台副负责人仍只管理组织，不进入任何租户业务上下文。
begin;

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

  if new.role = 'tenant_operator' then
    perform set_config('app.tenant_hard_delete', 'on', true);
    delete from public.tenant_memberships where user_id = new.id;
    return new;
  end if;

  if new.role = 'platform_super_admin' then
    target_tenant_id := '00000000-0000-4000-8000-000000000001'::uuid;
  else
    select provisioned.tenant_id into target_tenant_id
    from public.tenant_provisioned_accounts as provisioned
    where provisioned.user_id = new.id
    order by provisioned.created_at, provisioned.tenant_id
    limit 1;
    target_tenant_id := coalesce(target_tenant_id, private.default_tenant_of(new.id));
  end if;

  if target_tenant_id is null then return new; end if;

  insert into public.tenant_memberships (
    tenant_id, user_id, role, status, membership_tier, is_default, invited_by, joined_at
  ) values (
    target_tenant_id,
    new.id,
    case when new.role = 'platform_super_admin' then 'tenant_super_admin' else new.role end,
    case when coalesce(new.status, 'active') = 'active' then 'active' else 'suspended' end,
    case when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then new.membership_tier else 'normal' end,
    coalesce(new.status, 'active') = 'active',
    null,
    now()
  )
  on conflict (tenant_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      membership_tier = excluded.membership_tier,
      is_default = excluded.is_default,
      updated_at = now();

  return new;
end;
$$;

insert into public.tenant_memberships (
  tenant_id, user_id, role, status, membership_tier, is_default, invited_by, joined_at
)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  profile.id,
  'tenant_super_admin',
  case when coalesce(profile.status, 'active') = 'active' then 'active' else 'suspended' end,
  'normal',
  coalesce(profile.status, 'active') = 'active',
  null,
  now()
from public.profiles as profile
where profile.role = 'platform_super_admin'
  and profile.global_role = 'platform_owner'
on conflict (tenant_id, user_id) do update
set role = 'tenant_super_admin',
    status = excluded.status,
    membership_tier = 'normal',
    is_default = excluded.is_default,
    updated_at = now();

commit;
