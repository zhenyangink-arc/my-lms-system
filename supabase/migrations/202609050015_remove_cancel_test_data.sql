-- ============================================================
-- 清理"取消发布机构计划"功能联调测试留下的一份已发布模板
-- （标题"取消发布测试模板"）。对应的机构计划已在测试脚本里直接删除，
-- 这里只需要处理模板本身。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := 'e2cffd1e-aacd-460a-a330-e7ea1a10fe98';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '取消发布测试模板'
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
