begin;

-- 成长工具箱入口可关联一门课程（例如"单词练习"关联"韩语初级"）
alter table public.growth_toolbox_items
  add column if not exists related_course_id uuid references public.courses(id) on delete set null;

commit;
