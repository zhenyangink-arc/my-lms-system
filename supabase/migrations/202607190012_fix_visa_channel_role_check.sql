create or replace function public.enforce_student_visa_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role in ('admin', 'ceo', 'super_admin') then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证档案操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.case_status := 'planning';
    new.assigned_admin_id := null;
    new.advisor_note := null;
    new.last_reviewed_at := null;
    return new;
  end if;

  if (to_jsonb(new) - 'visa_type' - 'application_channel' - 'target_entry_date' - 'application_city' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'visa_type' - 'application_channel' - 'target_entry_date' - 'application_city' - 'updated_at') then
    raise exception '学生只能更新自己的签证基础信息';
  end if;
  return new;
end;
$$;

comment on function public.enforce_student_visa_case_fields() is
  '签证档案字段权限：管理员可推进第九步，学生可维护签证类型、办理通道、日期和领区';

notify pgrst, 'reload schema';
