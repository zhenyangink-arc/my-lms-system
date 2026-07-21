-- The application now derives business roles from tenant_memberships.  The
-- target lock trigger still checked the legacy profiles.role column, causing
-- tenant owners to be handled as students when they locked an application.

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

  actor_is_admin := public.is_admin_account();

  if actor_is_admin then
    if tg_op = 'UPDATE' then
      if new.documents_locked_at is not null
         and new.documents_locked_at is distinct from old.documents_locked_at then
        new.documents_locked_at := now();
        new.application_stage := greatest(new.application_stage, 2);
      end if;
      if new.courier_mailed_at is not null
         and new.courier_mailed_at is distinct from old.courier_mailed_at then
        new.application_stage := greatest(new.application_stage, 3);
      end if;
    end if;
    return coalesce(new, old);
  end if;

  if old.documents_locked_at is not null then
    if tg_op = 'DELETE' then
      raise exception '这份申请表已锁定，请联系管理员解锁';
    end if;

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
      raise exception '还有材料未标记为已完成或无需，无法提交';
    end if;

    new.application_stage := greatest(new.application_stage, 1);
  end if;

  if new.courier_mailed_at is not null
     and new.courier_mailed_at is distinct from old.courier_mailed_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
    if old.application_stage < 2 then
      raise exception '请等待管理员确认后再填写快递邮寄时间';
    end if;
    new.application_stage := greatest(new.application_stage, 3);
  end if;

  if new.courier_estimated_arrival_at is not null
     and new.courier_estimated_arrival_at is distinct from old.courier_estimated_arrival_at then
    if old.courier_mailed_at is not null and old.courier_estimated_arrival_at is not null then
      raise exception '快递信息已确认锁定，如需修改请联系管理员';
    end if;
    if old.application_stage < 2 then
      raise exception '请等待管理员确认后再填写快递邮寄时间';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
