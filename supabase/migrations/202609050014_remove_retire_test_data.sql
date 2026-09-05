-- ============================================================
-- 清理"停用标准计划"功能联调测试留下的一份已停用模板
-- （标题"停用测试模板"）。跟 202609050010 一样，临时关闭
-- 已发布/已停用内容的删除保护后清理。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := 'd0021ba1-b602-42c5-8b26-4d29f39119a6';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '停用测试模板'
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
