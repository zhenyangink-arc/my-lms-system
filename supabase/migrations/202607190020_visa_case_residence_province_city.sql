-- ============================================================
-- 递签领区目前只保存了系统推算出来的领馆名称（application_city），
-- 学生实际选择的省份/城市从未落库，所以刷新页面后省份和城市选框会清空。
-- 这里新增 residence_province / residence_city 两列，保存学生的原始选择，
-- 并允许学生在未锁定时更新这两列（和 application_city 一样）。
-- ============================================================

alter table public.student_visa_cases
  add column if not exists residence_province text,
  add column if not exists residence_city text;

comment on column public.student_visa_cases.residence_province is
  '学生选择的户籍/常住省份，用于推算递签领区（application_city）';
comment on column public.student_visa_cases.residence_city is
  '学生选择的户籍/常住城市，仅用于辅助定位，不影响领区推算';

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

  if (to_jsonb(new) - 'application_city' - 'residence_province' - 'residence_city' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'application_city' - 'residence_province' - 'residence_city' - 'updated_at') then
    raise exception '学生只能更新自己的递签领区信息';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
