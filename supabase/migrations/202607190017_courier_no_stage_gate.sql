-- ============================================================
-- 快递邮寄时间不再要求 application_stage >= 2 才能填写：学生随时可以
-- 填写并确认一次；确认后（courier_mailed_at 和 courier_estimated_arrival_at
-- 都已填写）学生不能再自行修改，只有管理员可以更改。
-- ============================================================

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
    if tg_op = 'UPDATE' then
      if new.documents_locked_at is not null and new.documents_locked_at is distinct from old.documents_locked_at then
        new.documents_locked_at := now();
        new.application_stage := greatest(new.application_stage, 2);
      end if;
      if new.courier_mailed_at is not null and new.courier_mailed_at is distinct from old.courier_mailed_at then
        new.application_stage := greatest(new.application_stage, 3);
      end if;
    end if;
    return coalesce(new, old);
  end if;

  -- 非管理员（学生）
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
  elsif tg_op = 'DELETE' then
    return old;
  end if;

  new.application_stage := old.application_stage;

  if old.documents_locked_at is null and new.documents_locked_at is not null then
    new.documents_locked_at := now();

    select count(*) into unresolved_count
    from public.student_application_documents
    where target_id = new.id
      and status = 'preparing'
      and admin_locked_at is null;

    if unresolved_count > 0 then
      raise exception '还有材料未标记为已完成或无，无法提交';
    end if;

    new.application_stage := greatest(new.application_stage, 1);
  end if;

  if new.courier_mailed_at is not null and new.courier_mailed_at is distinct from old.courier_mailed_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
    new.application_stage := greatest(new.application_stage, 3);
  end if;

  if new.courier_estimated_arrival_at is not null and new.courier_estimated_arrival_at is distinct from old.courier_estimated_arrival_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
