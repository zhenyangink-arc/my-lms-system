begin;

-- The access audit trigger serves four tables with different key column names.
-- Resolve those polymorphic fields through JSON so an enrollment update never
-- tries to dereference assignment-only or staff-only columns (and vice versa).
create or replace function private.audit_application_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;
  v_tenant_id uuid;
  v_app_id uuid;
  v_subject_type text;
  v_subject_user_id uuid;
begin
  v_tenant_id := nullif(v_row ->> 'tenant_id', '')::uuid;

  if tg_table_name = 'tenant_student_assignments' then
    v_app_id := nullif(v_row ->> 'student_app_id', '')::uuid;
    v_subject_type := 'teacher_assignment';
    v_subject_user_id := nullif(v_row ->> 'student_id', '')::uuid;
  elsif tg_table_name = 'student_app_enrollments' then
    v_app_id := nullif(v_row ->> 'app_id', '')::uuid;
    v_subject_type := 'student';
    v_subject_user_id := nullif(v_row ->> 'student_id', '')::uuid;
  elsif tg_table_name = 'staff_app_assignments' then
    v_app_id := nullif(v_row ->> 'app_id', '')::uuid;
    v_subject_type := 'staff';
    v_subject_user_id := nullif(v_row ->> 'staff_id', '')::uuid;
  elsif tg_table_name = 'tenant_student_apps' then
    v_app_id := nullif(v_row ->> 'app_id', '')::uuid;
    v_subject_type := 'tenant_app';
    v_subject_user_id := null;
  else
    raise exception '不支持的应用授权审计表：%', tg_table_name;
  end if;

  insert into public.application_access_audit_logs (
    tenant_id, app_id, actor_id, subject_type, subject_user_id,
    operation, before_data, after_data
  ) values (
    v_tenant_id,
    v_app_id,
    auth.uid(),
    v_subject_type,
    v_subject_user_id,
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

commit;
