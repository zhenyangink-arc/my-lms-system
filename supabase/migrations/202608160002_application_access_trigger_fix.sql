begin;

-- A polymorphic trigger cannot safely reference a column that is absent from
-- one of its target tables, even when that reference appears in an unselected
-- CASE/IF branch. Read the table-specific fields through JSON instead so both
-- student and staff authorization updates are validated by the same function.
create or replace function private.validate_application_access_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_user_id uuid;
  v_expected_role text;
  v_membership_tier text;
begin
  if tg_table_name = 'student_app_enrollments' then
    v_user_id := nullif(v_row ->> 'student_id', '')::uuid;
    v_expected_role := 'student';
  elsif tg_table_name = 'staff_app_assignments' then
    v_user_id := nullif(v_row ->> 'staff_id', '')::uuid;
    v_expected_role := null;
  else
    raise exception '不支持的应用授权表：%', tg_table_name;
  end if;

  select membership.membership_tier
  into v_membership_tier
  from public.tenant_memberships as membership
  where membership.tenant_id = new.tenant_id
    and membership.user_id = v_user_id
    and membership.status = 'active'
    and (
      (v_expected_role = 'student' and membership.role = 'student')
      or (v_expected_role is null and membership.role in (
        'teacher', 'admin', 'ceo', 'tenant_super_admin'
      ))
    );

  if not found then
    raise exception '应用授权目标不属于当前机构或账号角色不正确';
  end if;

  if tg_table_name = 'student_app_enrollments'
    and (v_row ->> 'access_tier') is distinct from v_membership_tier then
    raise exception '学生应用等级必须与当前机构会员等级一致';
  end if;

  if not exists (
    select 1
    from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = new.tenant_id
      and tenant_app.app_id = new.app_id
  ) then
    raise exception '当前机构没有注册该应用';
  end if;

  if new.status = 'active' and not exists (
    select 1
    from public.tenant_student_apps as tenant_app
    where tenant_app.tenant_id = new.tenant_id
      and tenant_app.app_id = new.app_id
      and tenant_app.is_enabled
      and tenant_app.status <> 'hidden'
  ) then
    raise exception '当前机构尚未开放该应用';
  end if;

  return new;
end;
$$;

commit;
