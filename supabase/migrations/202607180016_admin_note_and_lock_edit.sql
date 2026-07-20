-- ============================================================
-- 新增独立的"管理员备注"字段（区别于资料原本的说明 notes），
-- 学生端可见；锁定后管理员本人也必须先解锁才能继续编辑/留言。
-- ============================================================

alter table public.student_application_documents
  add column if not exists admin_note text;

alter table public.student_application_documents
  drop constraint if exists student_application_documents_admin_note_check,
  add constraint student_application_documents_admin_note_check
    check (admin_note is null or char_length(admin_note) <= 300);

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
    if old.admin_locked_at is not null
       and new.admin_locked_at is not distinct from old.admin_locked_at then
      raise exception '这项资料已锁定，请先解锁再修改';
    end if;
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

comment on column public.student_application_documents.admin_note is
  '管理员给这项资料的备注，学生端可见；仅管理员可编辑，锁定后需先解锁';

notify pgrst, 'reload schema';
