-- 永久删除租户时，平台负责人/副负责人需要清空该租户的成员关系。
-- 日常成员管理仍只允许租户超级管理员或 CEO；这里只放行已进入 hard-delete
-- 事务、且调用者确实是平台租户生命周期管理员的 DELETE。
begin;

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

  if is_hard_delete
     and tg_op = 'DELETE'
     and private.is_platform_tenant_manager() then
    return old;
  end if;

  if tg_op <> 'DELETE' and new.is_default and new.status <> 'active' then
    raise exception '默认租户成员关系必须处于活跃状态';
  end if;

  if tg_op = 'DELETE' then
    removes_owner := old.role = 'tenant_super_admin' and old.status = 'active';
  elsif tg_op = 'UPDATE' then
    removes_owner := old.role = 'tenant_super_admin' and old.status = 'active'
      and (new.role <> 'tenant_super_admin' or new.status <> 'active');
  end if;

  if removes_owner and not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = affected_tenant_id
      and membership.user_id <> old.user_id
      and membership.role = 'tenant_super_admin'
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
     and new.role = 'tenant_super_admin'
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

  if actor_id is not null
     and auth.role() <> 'service_role'
     and not private.has_tenant_role(
       affected_tenant_id,
       array['tenant_super_admin']::text[]
     ) then
    if not private.has_tenant_role(
      affected_tenant_id,
      array['ceo']::text[]
    ) then
      raise exception '只有租户超级管理员或 CEO 可以管理成员';
    end if;

    if (tg_op <> 'INSERT' and old.role = 'tenant_super_admin')
       or (tg_op <> 'DELETE' and new.role = 'tenant_super_admin') then
      raise exception '只有租户超级管理员可以管理超级管理员角色';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function private.enforce_tenant_membership_integrity() is
  '保护租户成员完整性；仅在平台生命周期管理员执行永久删除租户时放行成员清理';

commit;
