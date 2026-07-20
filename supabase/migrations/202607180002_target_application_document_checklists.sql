-- 将申请资料清单关联到具体目标大学。
-- 目标进入“准备资料”及后续阶段时自动创建标准清单；学生只能提交，管理员维护清单项目。

alter table public.student_application_documents
  add column if not exists target_id uuid;

alter table public.student_application_documents
  drop constraint if exists student_application_documents_target_id_fkey;

alter table public.student_application_documents
  add constraint student_application_documents_target_id_fkey
  foreign key (target_id)
  references public.student_university_targets(id)
  on delete cascade;

alter table public.student_application_documents
  drop constraint if exists student_application_documents_user_id_document_key_key;

create unique index if not exists student_application_documents_target_key_idx
  on public.student_application_documents (target_id, document_key)
  where target_id is not null;

create unique index if not exists student_application_documents_legacy_user_key_idx
  on public.student_application_documents (user_id, document_key)
  where target_id is null;

create index if not exists student_application_documents_target_status_idx
  on public.student_application_documents (target_id, status, sort_order);

create or replace function public.enforce_application_document_target_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.student_university_targets as target
    where target.id = new.target_id
      and target.user_id = new.user_id
  ) then
    raise exception '申请资料必须属于目标大学对应的学生';
  end if;

  return new;
end;
$$;

drop trigger if exists application_documents_enforce_target_owner
  on public.student_application_documents;

create trigger application_documents_enforce_target_owner
before insert or update of target_id, user_id
on public.student_application_documents
for each row execute function public.enforce_application_document_target_owner();

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

  if not found or target_record.status = 'researching' then
    return;
  end if;

  insert into public.student_application_documents (
    user_id,
    target_id,
    document_key,
    title,
    category,
    status,
    sort_order
  )
  values
    (target_record.user_id, target_record.id, 'passport', '护照', 'identity', 'not_started', 10),
    (target_record.user_id, target_record.id, 'transcript', '成绩单', 'academic', 'not_started', 20),
    (target_record.user_id, target_record.id, 'graduation', '毕业证明', 'academic', 'not_started', 30),
    (target_record.user_id, target_record.id, 'study_plan', '学习计划书', 'application', 'not_started', 40),
    (target_record.user_id, target_record.id, 'recommendation', '推荐信', 'application', 'not_started', 50),
    (target_record.user_id, target_record.id, 'bank_statement', '存款证明', 'financial', 'not_started', 60),
    (target_record.user_id, target_record.id, 'language_score', '语言成绩证明', 'language', 'not_started', 70)
  on conflict do nothing;
end;
$$;

create or replace function public.initialize_documents_when_target_prepares()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'researching' then
    perform public.initialize_target_application_documents(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists initialize_documents_when_target_prepares
  on public.student_university_targets;

create trigger initialize_documents_when_target_prepares
after insert or update of status
on public.student_university_targets
for each row execute function public.initialize_documents_when_target_prepares();

-- 为已经进入准备或后续阶段的目标大学补建标准申请资料清单。
insert into public.student_application_documents (
  user_id,
  target_id,
  document_key,
  title,
  category,
  status,
  sort_order
)
select
  target.user_id,
  target.id,
  template.document_key,
  template.title,
  template.category,
  'not_started',
  template.sort_order
from public.student_university_targets as target
cross join (
  values
    ('passport', '护照', 'identity', 10),
    ('transcript', '成绩单', 'academic', 20),
    ('graduation', '毕业证明', 'academic', 30),
    ('study_plan', '学习计划书', 'application', 40),
    ('recommendation', '推荐信', 'application', 50),
    ('bank_statement', '存款证明', 'financial', 60),
    ('language_score', '语言成绩证明', 'language', 70)
) as template(document_key, title, category, sort_order)
where target.status <> 'researching'
on conflict do nothing;

drop policy if exists "eligible students create own application documents"
  on public.student_application_documents;

drop policy if exists "admins create application checklist items"
  on public.student_application_documents;
create policy "admins create application checklist items"
on public.student_application_documents for insert
to authenticated
with check (
  target_id is not null
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "admins delete unused application checklist items"
  on public.student_application_documents;
create policy "admins delete unused application checklist items"
on public.student_application_documents for delete
to authenticated
using (
  submission_version = 0
  and storage_path is null
  and status in ('not_started', 'preparing')
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

revoke all on function public.initialize_target_application_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.initialize_documents_when_target_prepares()
  from public, anon, authenticated;
revoke all on function public.enforce_application_document_target_owner()
  from public, anon, authenticated;

comment on column public.student_application_documents.target_id is
  '资料清单所属的学生目标大学；为空时表示迁移前的历史通用资料';

notify pgrst, 'reload schema';
