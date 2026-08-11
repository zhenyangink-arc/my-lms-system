begin;

-- course_categories/courses/lessons/lesson_resources/course_chapters/chapter_test_attempts
-- 这 6 张表的 RLS 策略里引用的是 is_admin()，但仓库里从来没有定义过这个函数——线上
-- 环境实际是有人手工临时补过一个同名 shim 才没有直接报错，这里把它补进迁移历史，
-- 让本地重建数据库和线上环境保持一致，不再依赖"手工补过"这种侥幸。
create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path = 'public'
as $$
  select public.is_admin_account()
$$;

comment on function public.is_admin() is
  'is_admin_account() 的别名 shim；历史上多张表的 RLS 策略直接引用了 is_admin()，保留这个薄封装避免改动一堆策略定义。';

commit;
