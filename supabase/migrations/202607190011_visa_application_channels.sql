alter table public.student_visa_cases
  add column if not exists application_channel text not null default 'china_consulate';

alter table public.student_visa_cases
  drop constraint if exists student_visa_cases_application_channel_check;
alter table public.student_visa_cases
  add constraint student_visa_cases_application_channel_check check (
    application_channel in ('china_consulate', 'korea_immigration')
  );

create or replace function public.enforce_student_visa_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into current_role from public.profiles where id = auth.uid();
  if current_role in ('admin', 'ceo', 'super_admin') then
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

comment on column public.student_visa_cases.application_channel is
  '签证办理通道：驻中韩国领事馆递签或韩国出入境返签证';

notify pgrst, 'reload schema';
