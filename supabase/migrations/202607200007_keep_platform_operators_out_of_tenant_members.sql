-- 平台负责人/副负责人拥有跨租户权限，不再自动成为租户成员。
begin;

create or replace function public.create_tenant(requested_name text, requested_slug text, requested_plan_key text default 'starter')
returns uuid language plpgsql security definer set search_path = '' as $$
declare created_tenant_id uuid;
begin
  if not private.is_platform_tenant_manager() then raise exception '只有负责人或副负责人可以创建租户'; end if;
  insert into public.tenants (slug, name, plan_key, created_by)
  values (lower(btrim(requested_slug)), btrim(requested_name), requested_plan_key, auth.uid())
  returning id into created_tenant_id;
  return created_tenant_id;
end;
$$;

-- 清理旧流程留下的平台账号租户成员关系；仅在租户已有另一位活跃超级管理员时执行。
select set_config('app.tenant_hard_delete', 'on', true);
delete from public.tenant_memberships as platform_membership
using public.profiles as platform_profile
where platform_membership.user_id = platform_profile.id
  and platform_profile.role in ('super_admin', 'tenant_operator')
  and platform_membership.tenant_id <> '00000000-0000-4000-8000-000000000001'::uuid
  and exists (
    select 1 from public.tenant_memberships as tenant_admin
    where tenant_admin.tenant_id = platform_membership.tenant_id
      and tenant_admin.user_id <> platform_membership.user_id
      and tenant_admin.role = 'super_admin'
      and tenant_admin.status = 'active'
  );

commit;
