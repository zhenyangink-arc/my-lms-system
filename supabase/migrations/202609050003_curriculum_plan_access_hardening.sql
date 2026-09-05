begin;

create unique index curriculum_plan_templates_version_uidx
  on public.curriculum_plan_templates (
    student_app_id,
    coalesce(course_id, '00000000-0000-0000-0000-000000000000'::uuid),
    version
  );

create or replace function private.guard_curriculum_plan_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_app_id uuid;
  v_course_scope text;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception '已发布或停用的标准计划不能删除';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if not (
      old.status = 'published'
      and new.status = 'retired'
      and new.student_app_id = old.student_app_id
      and new.course_id is not distinct from old.course_id
      and new.title = old.title
      and new.description is not distinct from old.description
      and new.duration_days = old.duration_days
      and new.version = old.version
      and new.created_by = old.created_by
      and new.published_by is not distinct from old.published_by
      and new.published_at is not distinct from old.published_at
    ) then
      raise exception '已发布的标准计划不可修改，请建立新版本';
    end if;
  end if;

  if new.course_id is not null then
    select course.student_app_id, course.content_scope
    into v_course_app_id, v_course_scope
    from public.courses as course
    where course.id = new.course_id;

    if v_course_app_id is null
      or v_course_app_id <> new.student_app_id
      or v_course_scope <> 'platform'
    then
      raise exception '标准计划只能绑定当前应用的平台课程';
    end if;
  end if;
  return new;
end;
$$;

create trigger curriculum_plan_templates_guard
before insert or update or delete on public.curriculum_plan_templates
for each row execute function private.guard_curriculum_plan_template();

drop policy if exists "tenant staff manage institution curriculum plans"
  on public.institution_curriculum_plans;

create policy "institution leaders manage curriculum plans"
on public.institution_curriculum_plans for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or (
      (select public.current_profile_role()) = 'admin'
      and exists (
        select 1 from public.staff_app_assignments as access
        where access.tenant_id = institution_curriculum_plans.tenant_id
          and access.staff_id = (select auth.uid())
          and access.app_id = institution_curriculum_plans.student_app_id
          and access.status = 'active'
          and access.can_manage_assessments
      )
    )
  )
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or (
      (select public.current_profile_role()) = 'admin'
      and exists (
        select 1 from public.staff_app_assignments as access
        where access.tenant_id = institution_curriculum_plans.tenant_id
          and access.staff_id = (select auth.uid())
          and access.app_id = institution_curriculum_plans.student_app_id
          and access.status = 'active'
          and access.can_manage_assessments
      )
    )
  )
);

create policy "teachers manage own curriculum plans"
on public.institution_curriculum_plans for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) = 'teacher'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.staff_app_assignments as access
    where access.tenant_id = institution_curriculum_plans.tenant_id
      and access.staff_id = (select auth.uid())
      and access.app_id = institution_curriculum_plans.student_app_id
      and access.status = 'active'
      and access.can_manage_assessments
  )
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_profile_role()) = 'teacher'
  and created_by = (select auth.uid())
  and published_by = (select auth.uid())
  and exists (
    select 1 from public.staff_app_assignments as access
    where access.tenant_id = institution_curriculum_plans.tenant_id
      and access.staff_id = (select auth.uid())
      and access.app_id = institution_curriculum_plans.student_app_id
      and access.status = 'active'
      and access.can_manage_assessments
  )
);

drop policy if exists "tenant staff manage institution curriculum plan students"
  on public.institution_curriculum_plan_students;

create policy "institution leaders manage curriculum plan students"
on public.institution_curriculum_plan_students for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or (
      (select public.current_profile_role()) = 'admin'
      and exists (
        select 1
        from public.institution_curriculum_plans as plan
        join public.staff_app_assignments as access
          on access.tenant_id = plan.tenant_id
         and access.app_id = plan.student_app_id
         and access.staff_id = (select auth.uid())
         and access.status = 'active'
         and access.can_manage_assessments
        where plan.id = institution_curriculum_plan_students.plan_id
      )
    )
  )
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or (
      (select public.current_profile_role()) = 'admin'
      and exists (
        select 1
        from public.institution_curriculum_plans as plan
        join public.staff_app_assignments as access
          on access.tenant_id = plan.tenant_id
         and access.app_id = plan.student_app_id
         and access.staff_id = (select auth.uid())
         and access.status = 'active'
         and access.can_manage_assessments
        where plan.id = institution_curriculum_plan_students.plan_id
      )
    )
  )
);

create policy "teachers manage assigned students in own curriculum plans"
on public.institution_curriculum_plan_students for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and assigned_by = (select auth.uid())
  and (select public.current_profile_role()) = 'teacher'
  and exists (
    select 1 from public.tenant_student_assignments as teaching
    where teaching.tenant_id = institution_curriculum_plan_students.tenant_id
      and teaching.teacher_id = (select auth.uid())
      and teaching.student_id = institution_curriculum_plan_students.student_id
  )
)
with check (
  tenant_id = (select private.current_tenant_id())
  and assigned_by = (select auth.uid())
  and (select public.current_profile_role()) = 'teacher'
  and exists (
    select 1 from public.tenant_student_assignments as teaching
    where teaching.tenant_id = institution_curriculum_plan_students.tenant_id
      and teaching.teacher_id = (select auth.uid())
      and teaching.student_id = institution_curriculum_plan_students.student_id
  )
  and exists (
    select 1 from public.institution_curriculum_plans as plan
    where plan.id = institution_curriculum_plan_students.plan_id
      and plan.tenant_id = institution_curriculum_plan_students.tenant_id
      and plan.created_by = (select auth.uid())
  )
);

commit;
