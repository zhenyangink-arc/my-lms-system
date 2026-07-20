-- 将大学申请资料模板备注同步到学生申请资料清单。
-- student_application_documents.notes 是既有字段，此处用于保存模板备注快照。

create or replace function public.initialize_target_application_documents(
  requested_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_record public.student_university_targets%rowtype;
begin
  select * into target_record
  from public.student_university_targets
  where id = requested_target_id;

  if not found
     or target_record.status = 'researching'
     or target_record.university_id is null then
    return;
  end if;

  insert into public.student_application_documents (
    user_id,
    target_id,
    document_key,
    requirement_id,
    title,
    category,
    notes,
    status,
    sort_order,
    is_archived
  )
  select
    target_record.user_id,
    target_record.id,
    requirement.requirement_key,
    requirement.id,
    requirement.title,
    requirement.category,
    requirement.description,
    'not_started',
    requirement.sort_order,
    false
  from public.university_application_document_requirements as requirement
  where requirement.university_id = target_record.university_id
    and requirement.is_active = true
  on conflict (target_id, document_key) where target_id is not null
  do update set
    requirement_id = excluded.requirement_id,
    title = excluded.title,
    category = excluded.category,
    notes = excluded.notes,
    sort_order = excluded.sort_order,
    is_archived = false;
end;
$$;

create or replace function public.sync_university_application_document_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    insert into public.student_application_documents (
      user_id,
      target_id,
      document_key,
      requirement_id,
      title,
      category,
      notes,
      status,
      sort_order,
      is_archived
    )
    select
      target.user_id,
      target.id,
      new.requirement_key,
      new.id,
      new.title,
      new.category,
      new.description,
      'not_started',
      new.sort_order,
      false
    from public.student_university_targets as target
    where target.university_id = new.university_id
      and target.status <> 'researching'
    on conflict (target_id, document_key) where target_id is not null
    do update set
      requirement_id = excluded.requirement_id,
      title = excluded.title,
      category = excluded.category,
      notes = excluded.notes,
      sort_order = excluded.sort_order,
      is_archived = false;
  else
    delete from public.student_application_documents
    where requirement_id = new.id
      and submission_version = 0
      and storage_path is null
      and status in ('not_started', 'preparing');

    update public.student_application_documents
    set is_archived = true
    where requirement_id = new.id
      and is_archived = false;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_university_document_requirement
  on public.university_application_document_requirements;
create trigger sync_university_document_requirement
after insert or update of title, category, description, sort_order, is_active
on public.university_application_document_requirements
for each row execute function public.sync_university_application_document_requirement();

-- 若模板已经存在备注，升级后立即补到现有学生清单；空备注不会覆盖历史手工备注。
update public.student_application_documents as document
set notes = requirement.description
from public.university_application_document_requirements as requirement
where document.requirement_id = requirement.id
  and requirement.description is not null
  and document.notes is null;

revoke all on function public.initialize_target_application_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_university_application_document_requirement()
  from public, anon, authenticated;

comment on column public.university_application_document_requirements.description is
  '管理员维护的资料备注，自动同步并显示在学生申请资料清单';

notify pgrst, 'reload schema';
