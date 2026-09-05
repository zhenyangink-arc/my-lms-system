-- ============================================================
-- 清理"章节测试绑定"功能联调测试留下的一份已发布模板
-- （标题"章节测试绑定验证"）。对应的机构执行计划已经在测试脚本里
-- 直接删除，这里只需要处理模板本身。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := 'c2de8c46-5c9a-4bbe-92aa-2a4dce03ddeb';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '章节测试绑定验证'
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
