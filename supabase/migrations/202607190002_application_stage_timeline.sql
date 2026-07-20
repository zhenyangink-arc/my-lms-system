-- ============================================================
-- 申请表整体进程：1 学生确认信息 2 管理员确认 3 资料邮寄
-- 4 资料到达韩国 5 资料审核中 6 审核完毕，请进入签证申请阶段
-- 0 表示学生还没有提交（尚未进入流程）。
-- 阶段 1 在学生提交（锁定）申请表时自动推进；其余阶段只能由管理员推进。
-- ============================================================

alter table public.student_university_targets
  add column if not exists application_stage smallint not null default 0;

alter table public.student_university_targets
  drop constraint if exists student_university_targets_application_stage_check,
  add constraint student_university_targets_application_stage_check
    check (application_stage between 0 and 6);

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

    -- 锁定后学生只能继续填写快递邮寄时间 / 预计到达时间，其余字段（含 application_stage）一律拒绝修改。
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

  -- 学生自己永远不能直接指定 application_stage，只有"锁定"这个动作本身
  -- 会把阶段自动推进到 1；其余情况一律保持原值，交给管理员推进。
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

    new.application_stage := greatest(coalesce(old.application_stage, 0), 1);
  else
    new.application_stage := old.application_stage;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

comment on column public.student_university_targets.application_stage is
  '申请表整体进程：0 未提交，1 学生确认信息，2 管理员确认，3 资料邮寄，4 资料到达韩国，5 资料审核中，6 审核完毕请进入签证申请阶段。阶段 1 由学生提交时自动设置，2-6 只能由管理员推进。';

notify pgrst, 'reload schema';
