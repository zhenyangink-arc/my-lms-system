-- ============================================================
-- 申请表锁定后，学生需要补填快递邮寄时间和预计到达时间（纸质材料寄送信息）。
-- 这是锁定后学生唯一还能自己填写的字段，其余字段依旧被锁定保护。
-- ============================================================

alter table public.student_university_targets
  add column if not exists courier_mailed_at date,
  add column if not exists courier_estimated_arrival_at date;

alter table public.student_university_targets
  drop constraint if exists student_university_targets_courier_dates_check,
  add constraint student_university_targets_courier_dates_check check (
    courier_mailed_at is null
    or courier_estimated_arrival_at is null
    or courier_estimated_arrival_at >= courier_mailed_at
  );

create or replace function public.enforce_university_target_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
  unresolved_count integer;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  ) into actor_is_admin;

  if actor_is_admin then
    if tg_op = 'UPDATE'
       and new.documents_locked_at is not null
       and new.documents_locked_at is distinct from old.documents_locked_at then
      new.documents_locked_at := now();
    end if;
    return coalesce(new, old);
  end if;

  if old.documents_locked_at is not null then
    if tg_op = 'DELETE' then
      raise exception '这份申请表已锁定，请联系管理员解锁';
    end if;

    -- 锁定后学生只能继续填写快递邮寄时间 / 预计到达时间，其余字段一律拒绝修改。
    if new.documents_locked_at is distinct from old.documents_locked_at
       or (to_jsonb(new) - 'courier_mailed_at' - 'courier_estimated_arrival_at' - 'updated_at')
          is distinct from (to_jsonb(old) - 'courier_mailed_at' - 'courier_estimated_arrival_at' - 'updated_at') then
      raise exception '这份申请表已锁定，请联系管理员解锁';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.documents_locked_at is not null then
    new.documents_locked_at := now();

    select count(*) into unresolved_count
    from public.student_application_documents
    where target_id = new.id
      and status = 'preparing'
      and admin_locked_at is null;

    if unresolved_count > 0 then
      raise exception '还有材料未标记为已完成或无，无法提交';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

comment on column public.student_university_targets.courier_mailed_at is
  '学生纸质材料寄出的日期，申请表锁定后填写';
comment on column public.student_university_targets.courier_estimated_arrival_at is
  '预计快递到达大学/机构的日期，申请表锁定后填写';

notify pgrst, 'reload schema';
