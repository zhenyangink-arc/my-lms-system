begin;

-- current_profile_status() 里判断"平台角色算不算活跃"的白名单只写了最早的两个
-- (platform_owner/platform_super_admin、platform_deputy/tenant_operator)，后来
-- 新增的 platform_admin（role=admin）和 platform_course_inspector 两个平台角色
-- 一直没有补进来——这两类账号因为不属于任何具体租户，current_tenant_id() 兜底分支
-- 也救不了它们，于是被系统判定为"不活跃"，连带 is_admin_account() 等一大批依赖
-- "先判断活跃"的权限检查全部失效。四个组合的对应关系以
-- accounts/actions.ts 的 getPlatformProfileIdentity() 为准。
create or replace function public.current_profile_status()
returns text
language sql
stable security definer
set search_path = ''
as $$
  select case
    when coalesce(profile.status, 'active') <> 'active' then coalesce(profile.status, 'active')
    when (
      (profile.global_role = 'platform_owner' and profile.role = 'platform_super_admin')
      or (profile.global_role = 'platform_deputy' and profile.role = 'tenant_operator')
      or (profile.global_role = 'platform_admin' and profile.role = 'admin')
      or (profile.global_role = 'platform_course_inspector' and profile.role = 'platform_course_inspector')
    ) then 'active'
    when private.current_tenant_id() is not null then 'active'
    else 'inactive'
  end
  from public.profiles as profile
  where profile.id = (select auth.uid());
$$;

commit;
