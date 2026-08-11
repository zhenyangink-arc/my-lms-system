begin;

-- 'super_admin'（不带前缀）从来不是这套系统里真实存在过的角色值——当前角色体系是
-- platform_owner/platform_deputy/platform_admin/platform_course_inspector 四个平台
-- 角色，加 tenant_super_admin/ceo/admin/teacher/student 五个机构角色。这个残留字面量
-- 在两处函数的角色白名单里躺着，清理掉（没有任何账号用得到这个值，纯粹是死代码）。
create or replace function public.student_feature_allowed(requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select case
        when membership.role in (
          'teacher',
          'admin',
          'ceo',
          'tenant_super_admin'
        ) then true
        when membership.status <> 'active' then false
        when requested_feature = 'message_services' then true
        when membership.membership_tier in ('vip1', 'vip2', 'vip3')
          and requested_feature in (
            'dashboard_section',
            'university_target',
            'university_comparison',
            'application_documents',
            'visa_tasks',
            'course_preview'
          ) then true
        when membership.membership_tier in ('vip2', 'vip3')
          and requested_feature in (
            'learning_assignments',
            'korean_course',
            'ai_conversation_experience'
          ) then true
        when membership.membership_tier = 'vip3'
          and requested_feature = 'conversation_course' then true
        else false
      end
      from public.tenant_memberships as membership
      where membership.user_id = (select auth.uid())
        and membership.tenant_id = private.current_tenant_id()
    ), false)
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and coalesce(profile.status, 'active') = 'active'
    );
$$;

create or replace function public.enforce_student_lesson_progress_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  preview_enabled boolean;
  korean_lesson boolean;
begin
  select profile.role
  into actor_role
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if actor_role in (
    'teacher',
    'admin',
    'ceo',
    'tenant_super_admin',
    'platform_super_admin',
    'tenant_operator'
  ) then
    return new;
  end if;

  select
    lesson.is_free_preview,
    (
      category.slug = 'korean'
      or parent_category.slug = 'korean'
    )
  into preview_enabled, korean_lesson
  from public.lessons as lesson
  join public.courses as course
    on course.id = lesson.course_id
  join public.course_categories as category
    on category.id = course.category_id
  left join public.course_categories as parent_category
    on parent_category.id = category.parent_id
  where lesson.id = new.lesson_id;

  if coalesce(korean_lesson, false)
    and public.student_feature_allowed('korean_course') then
    return new;
  end if;

  if public.student_feature_allowed('course_preview')
    and coalesce(preview_enabled, false) then
    return new;
  end if;

  raise exception '当前账号没有此课时的学习记录权限';
end;
$$;

commit;
