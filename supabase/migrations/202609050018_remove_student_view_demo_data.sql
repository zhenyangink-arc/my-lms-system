-- ============================================================
-- 清理为了给用户实际演示"学生端本周学习计划"效果而临时发布的一份
-- 标准模板（标题"学生端展示用临时计划"）。对应的机构执行计划已经在
-- 演示脚本里直接删除，这里只需要处理模板本身。
-- ============================================================

begin;

do $$
declare
  v_template_id uuid := 'ec024cbd-9f5b-4398-9ba5-e9928c3200d9';
begin
  if exists (
    select 1 from public.curriculum_plan_templates
    where id = v_template_id and title = '学生端展示用临时计划'
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
