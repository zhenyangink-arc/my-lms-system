-- ============================================================
-- 管理员可以针对单条申请资料留言（复用 notes 字段）并单独锁定/解锁，
-- 锁定后学生无法修改该项状态；同时补上此前遗漏的管理员更新权限。
-- ============================================================

alter table public.student_application_documents
  add column if not exists admin_locked_at timestamptz;

drop policy if exists "admins update application checklist items"
  on public.student_application_documents;
create policy "admins update application checklist items"
on public.student_application_documents for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

create or replace function public.enforce_application_document_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_is_admin boolean;
begin
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

  if auth.uid() <> old.user_id or new.user_id <> old.user_id then
    raise exception '只能更新自己的申请资料清单';
  end if;

  if old.admin_locked_at is not null then
    raise exception '这项资料已被管理员锁定，暂时无法修改';
  end if;

  if new.status not in ('preparing', 'completed', 'not_needed') then
    raise exception '申请资料状态只能是准备中、已完成或无';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception '学生只能修改申请资料状态';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_application_document_checklist_update()
  from public, anon, authenticated;

comment on column public.student_application_documents.admin_locked_at is
  '管理员单独锁定这项资料的时间；锁定后学生无法修改状态，为空表示未锁定';

-- 学生提交整份申请表时，管理员已锁定的项目不计入"必须全部完成"的校验，
-- 避免管理员锁定了还在准备中的项目后学生永远无法提交。
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
    and status = 'preparing'
    and admin_locked_at is null;

  if unresolved_count > 0 then
    raise exception '还有材料未标记为已完成或无，无法提交';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_application_documents_lock()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
