-- ============================================================
-- 申请资料项目的截止日期改为自动跟随所属目标大学的申请截止日期，
-- 不再由管理员手动填写；截止日期最终来源仍是"韩国大学管理"里配置的
-- application_deadlines（与 student_university_targets.application_deadline
-- 的同步逻辑保持一致）。
-- ============================================================

create or replace function public.enforce_application_document_due_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_id is null then
    new.due_date := null;
    return new;
  end if;

  select target.application_deadline
  into new.due_date
  from public.student_university_targets as target
  where target.id = new.target_id;

  return new;
end;
$$;

drop trigger if exists application_documents_enforce_due_date
  on public.student_application_documents;
create trigger application_documents_enforce_due_date
before insert or update of target_id
on public.student_application_documents
for each row execute function public.enforce_application_document_due_date();

create or replace function public.sync_application_documents_due_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.student_application_documents as document
  set due_date = new.application_deadline
  where document.target_id = new.id
    and document.due_date is distinct from new.application_deadline;

  return new;
end;
$$;

drop trigger if exists application_documents_sync_due_date
  on public.student_university_targets;
create trigger application_documents_sync_due_date
after update of application_deadline
on public.student_university_targets
for each row
when (old.application_deadline is distinct from new.application_deadline)
execute function public.sync_application_documents_due_date();

-- 回填现有清单项目，统一以目标大学当前的截止日期为准。
update public.student_application_documents as document
set due_date = target.application_deadline
from public.student_university_targets as target
where document.target_id = target.id
  and document.due_date is distinct from target.application_deadline;

revoke all on function public.enforce_application_document_due_date()
  from public, anon, authenticated;
revoke all on function public.sync_application_documents_due_date()
  from public, anon, authenticated;

comment on column public.student_application_documents.due_date is
  '自动跟随所属目标大学的申请截止日期（来自韩国大学管理配置），不可手动填写';

notify pgrst, 'reload schema';
