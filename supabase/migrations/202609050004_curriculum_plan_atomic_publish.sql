begin;

create or replace function private.can_manage_curriculum_plan(
  p_plan_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_curriculum_plans as plan
    where plan.id = p_plan_id
      and plan.tenant_id = (select private.current_tenant_id())
      and (
        (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
        or (
          (select public.current_profile_role()) = 'admin'
          and exists (
            select 1 from public.staff_app_assignments as access
            where access.tenant_id = plan.tenant_id
              and access.app_id = plan.student_app_id
              and access.staff_id = (select auth.uid())
              and access.status = 'active'
              and access.can_manage_assessments
          )
        )
        or (
          (select public.current_profile_role()) = 'teacher'
          and plan.created_by = (select auth.uid())
          and exists (
            select 1 from public.staff_app_assignments as access
            where access.tenant_id = plan.tenant_id
              and access.app_id = plan.student_app_id
              and access.staff_id = (select auth.uid())
              and access.status = 'active'
              and access.can_manage_assessments
          )
        )
      )
  );
$$;

create or replace function private.student_has_curriculum_template(
  p_template_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.institution_curriculum_plans as plan
    join public.institution_curriculum_plan_students as assignment
      on assignment.plan_id = plan.id
     and assignment.tenant_id = plan.tenant_id
    where plan.template_id = p_template_id
      and assignment.student_id = (select auth.uid())
      and plan.status in ('published', 'active', 'completed')
  );
$$;

revoke all on function private.can_manage_curriculum_plan(uuid)
  from public, anon, authenticated;
revoke all on function private.student_has_curriculum_template(uuid)
  from public, anon, authenticated;
grant execute on function private.can_manage_curriculum_plan(uuid)
  to authenticated;
grant execute on function private.student_has_curriculum_template(uuid)
  to authenticated;

drop policy if exists "assigned students read published curriculum plan template items"
  on public.curriculum_plan_template_items;
create policy "assigned students read published curriculum plan template items"
on public.curriculum_plan_template_items for select to authenticated
using (
  (select private.student_has_curriculum_template(
    curriculum_plan_template_items.template_id
  ))
);

drop policy if exists "institution leaders manage curriculum plan students"
  on public.institution_curriculum_plan_students;
drop policy if exists "teachers manage assigned students in own curriculum plans"
  on public.institution_curriculum_plan_students;

create policy "authorized staff manage curriculum plan students"
on public.institution_curriculum_plan_students for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select private.can_manage_curriculum_plan(
    institution_curriculum_plan_students.plan_id
  ))
  and (
    (select public.current_profile_role()) <> 'teacher'
    or (
      assigned_by = (select auth.uid())
      and exists (
        select 1 from public.tenant_student_assignments as teaching
        where teaching.tenant_id = institution_curriculum_plan_students.tenant_id
          and teaching.teacher_id = (select auth.uid())
          and teaching.student_id = institution_curriculum_plan_students.student_id
      )
    )
  )
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select private.can_manage_curriculum_plan(
    institution_curriculum_plan_students.plan_id
  ))
  and (
    (select public.current_profile_role()) <> 'teacher'
    or (
      assigned_by = (select auth.uid())
      and exists (
        select 1 from public.tenant_student_assignments as teaching
        where teaching.tenant_id = institution_curriculum_plan_students.tenant_id
          and teaching.teacher_id = (select auth.uid())
          and teaching.student_id = institution_curriculum_plan_students.student_id
      )
    )
  )
);

create or replace function public.publish_institution_curriculum_plan(
  p_student_app_id uuid,
  p_template_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_student_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_tenant_id uuid := private.current_tenant_id();
  v_user_id uuid := auth.uid();
  v_published_at timestamptz := now();
begin
  if v_tenant_id is null or v_user_id is null then
    raise exception '当前登录上下文无效';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 180 then
    raise exception '机构计划名称长度无效';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception '计划结束时间必须晚于开始时间';
  end if;
  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    raise exception '请至少选择一名学生';
  end if;
  if cardinality(p_student_ids) <> (
    select count(distinct student_id)
    from unnest(p_student_ids) as selected(student_id)
  ) then
    raise exception '学生列表包含重复账号';
  end if;

  insert into public.institution_curriculum_plans (
    tenant_id,
    student_app_id,
    template_id,
    title,
    starts_at,
    ends_at,
    status,
    created_by,
    published_by,
    published_at
  ) values (
    v_tenant_id,
    p_student_app_id,
    p_template_id,
    btrim(p_title),
    p_starts_at,
    p_ends_at,
    'published',
    v_user_id,
    v_user_id,
    v_published_at
  )
  returning id into v_plan_id;

  insert into public.institution_curriculum_plan_students (
    plan_id,
    tenant_id,
    student_id,
    assigned_by
  )
  select
    v_plan_id,
    v_tenant_id,
    student_id,
    v_user_id
  from unnest(p_student_ids) as selected(student_id);

  return v_plan_id;
end;
$$;

revoke all on function public.publish_institution_curriculum_plan(
  uuid, uuid, text, timestamptz, timestamptz, uuid[]
) from public, anon;
grant execute on function public.publish_institution_curriculum_plan(
  uuid, uuid, text, timestamptz, timestamptz, uuid[]
) to authenticated;

commit;
