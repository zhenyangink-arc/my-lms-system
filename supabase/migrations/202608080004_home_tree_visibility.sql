-- ============================================================
-- 首页课程树展示控制
--
-- 学生端成长首页"查看全部课程"弹框的 React Flow 课程树，后台需要控制
-- 展示哪些分类/课程：给 course_categories 和 courses 各加
-- show_on_home_tree 开关，分类与课程都开启时该课程分支才会出现在首页树里。
-- ============================================================

begin;

alter table public.courses
  add column if not exists show_on_home_tree boolean not null default false;

alter table public.course_categories
  add column if not exists show_on_home_tree boolean not null default false;

comment on column public.courses.show_on_home_tree is
  '是否在成长首页的课程树弹框中展示（与 is_published 上架状态独立）。';
comment on column public.course_categories.show_on_home_tree is
  '分类是否在成长首页的课程树弹框中展示；分类与课程都开启才显示该课程分支。';

commit;
