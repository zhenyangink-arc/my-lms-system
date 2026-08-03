-- 平台课程巡检员属于平台空间，只能只读巡检已发布课程，不加入任何机构。
begin;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  drop constraint if exists profiles_global_role_check,
  drop constraint if exists profiles_role_global_consistency_check;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'student',
      'teacher',
      'admin',
      'ceo',
      'platform_super_admin',
      'platform_course_inspector',
      'tenant_super_admin',
      'tenant_operator'
    )
  ),
  add constraint profiles_global_role_check check (
    global_role in (
      'platform_owner',
      'platform_deputy',
      'platform_admin',
      'platform_course_inspector',
      'tenant_super_admin',
      'member'
    )
  ),
  add constraint profiles_role_global_consistency_check check (
    (role = 'platform_super_admin' and global_role = 'platform_owner')
    or (role = 'tenant_operator' and global_role = 'platform_deputy')
    or (role = 'admin' and global_role = 'platform_admin')
    or (
      role = 'platform_course_inspector'
      and global_role = 'platform_course_inspector'
    )
    or (role = 'tenant_super_admin' and global_role = 'tenant_super_admin')
    or (role in ('student', 'teacher', 'admin', 'ceo') and global_role = 'member')
  );

comment on column public.profiles.global_role is
  '账号空间身份：platform_owner/platform_deputy/platform_admin/platform_course_inspector 进入平台空间，tenant_super_admin/member 进入机构空间';

commit;
