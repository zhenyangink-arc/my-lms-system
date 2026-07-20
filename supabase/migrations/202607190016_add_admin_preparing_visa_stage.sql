-- 整体办理阶段新增“管理员准备中”作为第一步，新建签证档案默认从这一步开始。

alter table public.student_visa_cases
  drop constraint if exists student_visa_cases_case_status_check;

alter table public.student_visa_cases
  add constraint student_visa_cases_case_status_check check (
    case_status in ('admin_preparing', 'planning', 'preparing', 'ready_to_submit', 'submitted', 'additional_documents', 'approved', 'issued', 'closed')
  );

alter table public.student_visa_cases
  alter column case_status set default 'admin_preparing';

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
    new.case_status := 'admin_preparing';
    new.assigned_admin_id := null;
    new.advisor_note := null;
    new.last_reviewed_at := null;
    return new;
  end if;

  if new.visa_type is distinct from old.visa_type
     or new.application_channel is distinct from old.application_channel
     or new.target_entry_date is distinct from old.target_entry_date then
    raise exception '签证类型、办理通道和最晚入境日期由管理员确认，学生不能修改';
  end if;

  if (to_jsonb(new) - 'application_city' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'application_city' - 'updated_at') then
    raise exception '学生只能更新自己的递签领区信息';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
