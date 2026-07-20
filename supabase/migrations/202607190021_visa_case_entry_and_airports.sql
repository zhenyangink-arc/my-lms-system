-- ============================================================
-- 递签领区下面新增三项学生可自行填写的信息：
-- 预计入境时间、出境机场（中国，按省/直辖市选择）、到达机场（韩国，按地区选择）。
-- 这些都是学生自己填写的“计划”信息，与管理员维护的“最晚入境日期”
-- （target_entry_date）是两回事，所以单独开列。
-- ============================================================

alter table public.student_visa_cases
  add column if not exists planned_entry_date date,
  add column if not exists departure_province text,
  add column if not exists departure_airport text,
  add column if not exists arrival_region text,
  add column if not exists arrival_airport text;

comment on column public.student_visa_cases.planned_entry_date is
  '学生自己填写的预计入境时间，仅供参考，与管理员维护的最晚入境日期（target_entry_date）是两回事';
comment on column public.student_visa_cases.departure_province is
  '学生选择的出境机场所在省/直辖市（中国）';
comment on column public.student_visa_cases.departure_airport is
  '学生选择的出境机场（中国）';
comment on column public.student_visa_cases.arrival_region is
  '学生选择的到达机场所在地区（韩国）';
comment on column public.student_visa_cases.arrival_airport is
  '学生选择的到达机场（韩国）';

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

  if (to_jsonb(new)
        - 'application_city' - 'residence_province' - 'residence_city'
        - 'planned_entry_date' - 'departure_province' - 'departure_airport'
        - 'arrival_region' - 'arrival_airport' - 'updated_at')
     is distinct from
     (to_jsonb(old)
        - 'application_city' - 'residence_province' - 'residence_city'
        - 'planned_entry_date' - 'departure_province' - 'departure_airport'
        - 'arrival_region' - 'arrival_airport' - 'updated_at') then
    raise exception '学生只能更新自己的递签领区和行程信息';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
