-- ============================================================
-- 学生提交（上传）申请资料清单后，整份申请表锁定，不能再修改；
-- 点击"修改"可以随时解锁重新编辑。
-- ============================================================

alter table public.student_university_targets
  add column if not exists documents_locked_at timestamptz;

create or replace function public.enforce_application_documents_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
  unresolved_count integer;
begin
  if new.documents_locked_at is null then
    return new;
  end if;

  new.documents_locked_at := now();

  if auth.uid() is null then
    return new;
  end if;

  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  ) into actor_is_admin;

  if actor_is_admin then
    return new;
  end if;

  select count(*) into unresolved_count
  from public.student_application_documents
  where target_id = new.id
    and status = 'preparing';

  if unresolved_count > 0 then
    raise exception '还有材料未标记为已完成或无，无法提交';
  end if;

  return new;
end;
$$;

drop trigger if exists university_targets_enforce_documents_lock
  on public.student_university_targets;
create trigger university_targets_enforce_documents_lock
before update of documents_locked_at
on public.student_university_targets
for each row execute function public.enforce_application_documents_lock();

revoke all on function public.enforce_application_documents_lock()
  from public, anon, authenticated;

comment on column public.student_university_targets.documents_locked_at is
  '学生提交申请资料清单后加锁的时间；为空表示可以继续编辑，点击"修改"会清空重新解锁';

notify pgrst, 'reload schema';
