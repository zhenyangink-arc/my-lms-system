-- D2 回滚：恢复原课时进度触发器函数，删除策略函数与策略表。
begin;
CREATE OR REPLACE FUNCTION public.enforce_student_lesson_progress_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$

;
drop function if exists private.student_app_full_course_allowed(uuid);
drop table if exists private.student_app_course_access_policies;
commit;
