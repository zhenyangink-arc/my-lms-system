-- 课程树展示开关已迁移到 course_tree_view_items（home 视图），
-- 删除旧的 show_on_home_tree 字段。
begin;

alter table public.courses
  drop column if exists show_on_home_tree;

alter table public.course_categories
  drop column if exists show_on_home_tree;

commit;
