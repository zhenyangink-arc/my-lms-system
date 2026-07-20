-- ============================================================
-- 申请表整体进程扩展到 9 个阶段，并把阶段推进逻辑集中放在触发器里：
-- 1 学生确认信息：学生点"上传"提交时自动推进（沿用已有逻辑）。
-- 2 管理员确认：管理员点"锁定学生端"时自动推进。
-- 3 资料邮寄：学生填写并确认快递邮寄时间（courier_mailed_at）时自动推进。
-- 4-9：只能由管理员通过阶段下拉框手动推进。
-- ============================================================

alter table public.student_university_targets
  drop constraint if exists student_university_targets_application_stage_check,
  add constraint student_university_targets_application_stage_check
    check (application_stage between 0 and 9);

comment on column public.student_university_targets.application_stage is
  '申请表整体进程：0 未提交，1 学生确认信息，2 管理员确认，3 资料邮寄，4 资料到达韩国，5 资料审核中，'
  '6 审核完毕颁发入学标准许可书，7 资料已寄回国，8 资料到达学生住址，9 请进入申请签证页面。'
  '阶段 1/3 由学生操作自动推进，阶段 2 由管理员锁定时自动推进，阶段 4-9 只能由管理员手动推进。';

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

    if new.courier_mailed_at is not null and new.courier_mailed_at is distinct from old.courier_mailed_at then
      new.application_stage := greatest(old.application_stage, 3);
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  -- 学生自己永远不能直接指定 application_stage；只有下面两个具体动作会自动推进阶段。
  new.application_stage := old.application_stage;

  if new.documents_locked_at is not null and old.documents_locked_at is null then
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
    new.application_stage := greatest(new.application_stage, 3);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
