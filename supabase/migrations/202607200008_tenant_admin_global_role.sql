-- 租户超级管理员在全局资料中也保留超级管理员身份，但不得因此取得平台租户管理权限。
begin;

update public.profiles as profile
set role = 'super_admin',
    status = 'active'
where exists (
  select 1
  from public.tenant_provisioned_accounts as account
  where account.user_id = profile.id
)
  and profile.role = 'student';

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
    where profile.id = auth.uid()
      and coalesce(profile.status, 'active') = 'active'
      and (
        profile.role = 'tenant_operator'
        or (
          profile.role = 'super_admin'
          and not exists (
            select 1
            from public.tenant_provisioned_accounts as account
            where account.user_id = profile.id
          )
        )
      )
  );
$$;

commit;
