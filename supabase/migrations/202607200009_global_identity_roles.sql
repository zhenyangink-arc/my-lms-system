-- 将平台身份与租户身份明确分层，避免租户最高管理员被显示成平台负责人。
begin;

alter table public.profiles
  add column if not exists global_role text;

alter table public.profiles
  drop constraint if exists profiles_global_role_check;

alter table public.profiles
  add constraint profiles_global_role_check check (
    global_role is null or global_role in ('platform_owner', 'tenant_super_admin', 'platform_deputy', 'member')
  );

update public.profiles as profile
set global_role = case
  when exists (select 1 from public.tenant_provisioned_accounts account where account.user_id = profile.id)
    then 'tenant_super_admin'
  when profile.role = 'tenant_operator' then 'platform_deputy'
  when profile.role = 'super_admin' then 'platform_owner'
  else 'member'
end
where profile.global_role is null;

commit;
