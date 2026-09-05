-- ============================================================
-- 清理"批量按章节生成排课"功能联调测试留下的一份已发布标准模板
-- （标题"发布验证测试"）。跟 202609050010 一样，临时关闭已发布内容
-- 的删除保护后清理。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := '0b6b40d7-60ec-4ec0-9580-fc98508736f2';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '发布验证测试'
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
