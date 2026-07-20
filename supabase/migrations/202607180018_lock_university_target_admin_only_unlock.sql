-- ============================================================
-- 目标大学申请表锁定后：
-- 1. 学生不能再自己解锁（之前允许），只有管理员可以解锁。
-- 2. 锁定同时冻结整条目标记录——申请阶段（状态）不能改，目标校也不能删除，
--    避免通过修改/删除目标绕开已锁定的申请资料清单。
-- 管理员操作不受影响。
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
    if tg_op = 'UPDATE'
       and new.documents_locked_at is not null
       and new.documents_locked_at is distinct from old.documents_locked_at then
      new.documents_locked_at := now();
    end if;
    return coalesce(new, old);
  end if;

  if old.documents_locked_at is not null then
    raise exception '这份申请表已锁定，请联系管理员解锁';
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

drop trigger if exists university_targets_enforce_documents_lock
  on public.student_university_targets;
drop trigger if exists university_targets_enforce_lock
  on public.student_university_targets;
create trigger university_targets_enforce_lock
before update or delete on public.student_university_targets
for each row execute function public.enforce_university_target_lock();

drop function if exists public.enforce_application_documents_lock();

revoke all on function public.enforce_university_target_lock()
  from public, anon, authenticated;

comment on column public.student_university_targets.documents_locked_at is
  '这份申请表被锁定的时间；锁定后学生不能修改申请阶段、不能删除目标校、也不能自行解锁，只有管理员可以解锁';

notify pgrst, 'reload schema';
