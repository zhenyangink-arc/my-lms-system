begin;

drop policy if exists "tenant staff read published curriculum plan templates"
  on public.curriculum_plan_templates;
create policy "tenant staff read published curriculum plan templates"
on public.curriculum_plan_templates for select to authenticated
using (
  status = 'published'
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or exists (
      select 1 from public.staff_app_assignments as access
      where access.tenant_id = (select private.current_tenant_id())
        and access.staff_id = (select auth.uid())
        and access.app_id = curriculum_plan_templates.student_app_id
        and access.status = 'active'
    )
  )
);

drop policy if exists "tenant staff read published curriculum plan template items"
  on public.curriculum_plan_template_items;
create policy "tenant staff read published curriculum plan template items"
on public.curriculum_plan_template_items for select to authenticated
using (
  exists (
    select 1
    from public.curriculum_plan_templates as template
    where template.id = curriculum_plan_template_items.template_id
      and template.status = 'published'
      and (
        (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
        or exists (
          select 1 from public.staff_app_assignments as access
          where access.app_id = template.student_app_id
            and access.tenant_id = (select private.current_tenant_id())
            and access.staff_id = (select auth.uid())
            and access.status = 'active'
        )
      )
  )
);

create or replace function private.validate_institution_curriculum_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_id uuid;
  v_template_status text;
begin
  select template.student_app_id, template.status
  into v_app_id, v_template_status
  from public.curriculum_plan_templates as template
  where template.id = new.template_id;

  if v_app_id is null or v_app_id <> new.student_app_id then
    raise exception '机构计划与标准计划所属应用不一致';
  end if;
  if v_template_status <> 'published' then
    raise exception '机构只能采用已发布的平台标准计划';
  end if;
  return new;
end;
$$;

create trigger institution_curriculum_plans_validate
before insert or update of template_id, student_app_id
on public.institution_curriculum_plans
for each row execute function private.validate_institution_curriculum_plan();

create or replace function private.validate_institution_curriculum_plan_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_tenant_id uuid;
  v_app_id uuid;
begin
  select plan.tenant_id, plan.student_app_id
  into v_plan_tenant_id, v_app_id
  from public.institution_curriculum_plans as plan
  where plan.id = new.plan_id;

  if v_plan_tenant_id is null or v_plan_tenant_id <> new.tenant_id then
    raise exception '学生分配与机构计划所属机构不一致';
  end if;
  if not exists (
    select 1 from public.student_app_enrollments as enrollment
    where enrollment.tenant_id = new.tenant_id
      and enrollment.student_id = new.student_id
      and enrollment.app_id = v_app_id
      and enrollment.status = 'active'
  ) then
    raise exception '学生尚未开通该学习应用';
  end if;
  return new;
end;
$$;

create trigger institution_curriculum_plan_students_validate
before insert or update of plan_id, tenant_id, student_id
on public.institution_curriculum_plan_students
for each row execute function private.validate_institution_curriculum_plan_student();

commit;
