-- 每所大学的申请资料模板按五个申请阶段独立维护。
-- 升级时把现有模板复制到五个阶段，保证已经配置的资料和学生历史不丢失。

alter table public.university_application_document_requirements
  add column if not exists admission_stage text;

update public.university_application_document_requirements
set admission_stage = 'language'
where admission_stage is null;

alter table public.university_application_document_requirements
  alter column admission_stage set default 'language',
  alter column admission_stage set not null;

alter table public.university_application_document_requirements
  drop constraint if exists university_document_requirements_stage_check;
alter table public.university_application_document_requirements
  add constraint university_document_requirements_stage_check check (
    admission_stage in ('language', 'bachelor_fresh', 'bachelor_transfer', 'master', 'doctor')
  );

drop index if exists public.university_document_requirements_title_idx;
create unique index university_document_requirements_title_idx
  on public.university_application_document_requirements (
    university_id,
    admission_stage,
    category,
    lower(btrim(title))
  );

drop index if exists public.university_document_requirements_active_idx;
create index university_document_requirements_active_idx
  on public.university_application_document_requirements (
    university_id,
    admission_stage,
    is_active,
    category,
    sort_order
  );

insert into public.university_application_document_requirements (
  university_id,
  requirement_key,
  admission_stage,
  category,
  title,
  description,
  sort_order,
  is_active
)
select
  requirement.university_id,
  stage.admission_stage || ':' || requirement.requirement_key,
  stage.admission_stage,
  requirement.category,
  requirement.title,
  requirement.description,
  requirement.sort_order,
  requirement.is_active
from public.university_application_document_requirements as requirement
cross join (
  values
    ('bachelor_fresh'),
    ('bachelor_transfer'),
    ('master'),
    ('doctor')
) as stage(admission_stage)
where requirement.admission_stage = 'language'
on conflict (university_id, requirement_key) do nothing;

-- 非语学院目标改为关联其申请阶段对应的模板，文件和审核记录原地保留。
update public.student_application_documents as document
set requirement_id = stage_requirement.id,
    document_key = stage_requirement.requirement_key,
    title = stage_requirement.title,
    category = stage_requirement.category,
    notes = stage_requirement.description,
    sort_order = stage_requirement.sort_order
from public.student_university_targets as target,
     public.university_application_document_requirements as source_requirement,
     public.university_application_document_requirements as stage_requirement
where document.target_id = target.id
  and document.requirement_id = source_requirement.id
  and source_requirement.admission_stage = 'language'
  and target.admission_track in ('bachelor_fresh', 'bachelor_transfer', 'master', 'doctor')
  and stage_requirement.university_id = source_requirement.university_id
  and stage_requirement.admission_stage = target.admission_track
  and stage_requirement.requirement_key = target.admission_track || ':' || source_requirement.requirement_key;

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
  target_stage text;
begin
  select * into target_record
  from public.student_university_targets
  where id = requested_target_id;

  if not found
     or target_record.status = 'researching'
     or target_record.university_id is null then
    return;
  end if;

  target_stage := coalesce(target_record.admission_track, 'language');

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
    and requirement.admission_stage = target_stage
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
  if tg_op = 'UPDATE'
     and old.is_active
     and (
       old.university_id is distinct from new.university_id
       or old.admission_stage is distinct from new.admission_stage
     ) then
    delete from public.student_application_documents
    where requirement_id = old.id
      and submission_version = 0
      and storage_path is null
      and status in ('not_started', 'preparing');

    update public.student_application_documents
    set is_archived = true
    where requirement_id = old.id
      and is_archived = false;
  end if;

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
      and coalesce(target.admission_track, 'language') = new.admission_stage
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

-- 学生在尚未提交资料时可以调整申请阶段；系统会删除旧阶段的未提交模板项并生成新阶段清单。
-- 一旦已有提交历史，则阻止切换阶段，避免文件与申请阶段错配。
create or replace function public.initialize_documents_when_target_prepares()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_stage text;
begin
  target_stage := coalesce(new.admission_track, 'language');

  if tg_op = 'UPDATE'
     and old.admission_track is distinct from new.admission_track
     and new.status <> 'researching' then
    if exists (
      select 1
      from public.student_application_documents as document
      join public.university_application_document_requirements as requirement
        on requirement.id = document.requirement_id
      where document.target_id = new.id
        and requirement.admission_stage <> target_stage
        and document.submission_version > 0
    ) then
      raise exception '该目标已有提交记录，不能直接切换申请阶段';
    end if;

    delete from public.student_application_documents as document
    using public.university_application_document_requirements as requirement
    where document.target_id = new.id
      and document.requirement_id = requirement.id
      and requirement.admission_stage <> target_stage
      and document.submission_version = 0;
  end if;

  if new.status <> 'researching' then
    perform public.initialize_target_application_documents(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists initialize_documents_when_target_prepares
  on public.student_university_targets;
create trigger initialize_documents_when_target_prepares
after insert or update of status, admission_track
on public.student_university_targets
for each row execute function public.initialize_documents_when_target_prepares();

drop trigger if exists sync_university_document_requirement
  on public.university_application_document_requirements;
create trigger sync_university_document_requirement
after insert or update of university_id, admission_stage, title, category, description, sort_order, is_active
on public.university_application_document_requirements
for each row execute function public.sync_university_application_document_requirement();

revoke all on function public.initialize_target_application_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_university_application_document_requirement()
  from public, anon, authenticated;
revoke all on function public.initialize_documents_when_target_prepares()
  from public, anon, authenticated;

comment on column public.university_application_document_requirements.admission_stage is
  '资料模板所属申请阶段：语学院、大学新入、大学插班、硕士或博士';

notify pgrst, 'reload schema';
