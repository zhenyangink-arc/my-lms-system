-- ============================================================
-- 申请资料状态新增"无"（not_needed），用于标记不需要准备的材料。
-- ============================================================

alter table public.student_application_documents
  drop constraint if exists student_application_documents_status_check,
  add constraint student_application_documents_status_check
    check (status in ('preparing', 'completed', 'not_needed'));

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

drop policy if exists "eligible students update own checklist status"
  on public.student_application_documents;
create policy "eligible students update own checklist status"
on public.student_application_documents for update
to authenticated
using (
  auth.uid() = user_id
  and status in ('preparing', 'completed', 'not_needed')
  and public.student_feature_allowed('application_documents')
)
with check (
  auth.uid() = user_id
  and status in ('preparing', 'completed', 'not_needed')
  and public.student_feature_allowed('application_documents')
);

revoke all on function public.enforce_application_document_checklist_update()
  from public, anon, authenticated;

comment on column public.student_application_documents.status is
  '申请资料准备状态：preparing（准备中）、completed（已完成）或 not_needed（无需准备）';

notify pgrst, 'reload schema';
