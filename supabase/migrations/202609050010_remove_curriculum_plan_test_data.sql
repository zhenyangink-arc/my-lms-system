-- ============================================================
-- 清理这次学习计划功能联调测试留下的一份已发布标准模板（标题带
-- "（测试）"）。机构执行计划和学生分配已经在测试会话里删掉，这里
-- 只剩模板本身和它的明细。模板处于已发布状态，明细表和模板表都有
-- 防止误删已发布内容的触发器，这里临时关闭后删除，跟其它内容迁移
-- 清理/补齐数据时的做法一致。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := '7ab9c158-d4b6-40c8-9a5c-c20e02062aab';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '韩国语一级 · 30 天标准计划（测试）'
  ) then
    alter table public.curriculum_plan_template_items disable trigger user;
    alter table public.curriculum_plan_templates disable trigger user;

    delete from public.curriculum_plan_template_items where template_id = v_template_id;
    delete from public.curriculum_plan_templates where id = v_template_id;

    alter table public.curriculum_plan_template_items enable trigger user;
    alter table public.curriculum_plan_templates enable trigger user;
  end if;
end;
$$;

commit;
