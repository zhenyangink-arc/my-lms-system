-- ============================================================
-- 202609050011 放开了触发器校验，允许课程学习项目绑定
-- source_type = 'chapter'，但漏改了列上的 check 约束，导致插入
-- 直接被数据库拒绝（constraint curriculum_plan_template_items_
-- source_type_check）。这里把 'chapter' 加进允许值列表。
-- ============================================================

begin;

alter table public.curriculum_plan_template_items
  drop constraint curriculum_plan_template_items_source_type_check;

alter table public.curriculum_plan_template_items
  add constraint curriculum_plan_template_items_source_type_check
  check (
    source_type in (
      'lesson', 'chapter', 'specialized_practice', 'chapter_test', 'assessment_paper', 'manual'
    )
  );

commit;
