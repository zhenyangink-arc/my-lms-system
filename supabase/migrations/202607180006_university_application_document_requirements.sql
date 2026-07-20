-- 每所韩国大学独立维护申请资料模板，并同步到已经进入“准备资料”的学生申请表。
-- 模板只包含五类正式申请材料；管理员为单个学生临时追加的 other 类材料继续保留。

create table if not exists public.university_application_document_requirements (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.korean_universities(id) on delete cascade,
  requirement_key text not null,
  category text not null check (
    category in ('identity', 'academic', 'application', 'financial', 'language')
  ),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  description text check (description is null or char_length(description) <= 300),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, requirement_key)
);

create unique index if not exists university_document_requirements_title_idx
  on public.university_application_document_requirements (
    university_id,
    category,
    lower(btrim(title))
  );

create index if not exists university_document_requirements_active_idx
  on public.university_application_document_requirements (
    university_id,
    is_active,
    category,
    sort_order
  );

drop trigger if exists set_university_document_requirements_updated_at
  on public.university_application_document_requirements;
create trigger set_university_document_requirements_updated_at
before update on public.university_application_document_requirements
for each row execute function public.set_student_planning_updated_at();

alter table public.university_application_document_requirements enable row level security;

drop policy if exists "admins manage university document requirements"
  on public.university_application_document_requirements;
create policy "admins manage university document requirements"
on public.university_application_document_requirements for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

grant select, insert, update on public.university_application_document_requirements
  to authenticated;

alter table public.student_application_documents
  add column if not exists requirement_id uuid,
  add column if not exists is_archived boolean not null default false;

alter table public.student_application_documents
  drop constraint if exists student_application_documents_requirement_id_fkey;
alter table public.student_application_documents
  add constraint student_application_documents_requirement_id_fkey
  foreign key (requirement_id)
  references public.university_application_document_requirements(id)
  on delete set null;

create index if not exists student_application_documents_requirement_idx
  on public.student_application_documents (requirement_id, is_archived);

create index if not exists student_application_documents_active_target_idx
  on public.student_application_documents (target_id, is_archived, category, sort_order);

-- 把当前系统的七项标准清单转成每所大学自己的初始模板，保证升级前后学生清单不丢项。
insert into public.university_application_document_requirements (
  university_id,
  requirement_key,
  category,
  title,
  sort_order
)
select
  university.id,
  template.requirement_key,
  template.category,
  template.title,
  template.sort_order
from public.korean_universities as university
cross join (
  values
    ('passport', 'identity', '护照', 10),
    ('transcript', 'academic', '成绩单', 20),
    ('graduation', 'academic', '毕业证明', 30),
    ('study_plan', 'application', '学习计划书', 40),
    ('recommendation', 'application', '推荐信', 50),
    ('bank_statement', 'financial', '存款证明', 60),
    ('language_score', 'language', '语言成绩证明', 70)
) as template(requirement_key, category, title, sort_order)
on conflict (university_id, requirement_key) do nothing;

-- 把迁移前已经生成的标准资料关联到对应大学模板。
update public.student_application_documents as document
set requirement_id = requirement.id,
    is_archived = false
from public.student_university_targets as target
join public.university_application_document_requirements as requirement
  on requirement.university_id = target.university_id
where document.target_id = target.id
  and document.document_key = requirement.requirement_key
  and document.requirement_id is null;

-- 新目标进入准备阶段时，只生成这所大学当前启用的资料要求。
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
    sort_order = excluded.sort_order,
    is_archived = false;
end;
$$;

-- 大学模板变化时同步所有已经进入准备阶段的学生申请表。
-- 删除要求采用停用方式：未提交项目直接移除，已有提交历史的项目归档隐藏。
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
after insert or update of title, category, sort_order, is_active
on public.university_application_document_requirements
for each row execute function public.sync_university_application_document_requirement();

-- 学生不能通过已归档项目继续提交或修改；管理员仍可查看和维护历史审核记录。
create or replace function public.enforce_archived_application_document_immutability()
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

  if old.is_archived or new.is_archived is distinct from old.is_archived then
    raise exception '这项申请资料已经停止使用';
  end if;

  return new;
end;
$$;

drop trigger if exists application_documents_enforce_archived_immutability
  on public.student_application_documents;
create trigger application_documents_enforce_archived_immutability
before update on public.student_application_documents
for each row execute function public.enforce_archived_application_document_immutability();

drop policy if exists "application documents read own or admins"
  on public.student_application_documents;
create policy "application documents read own or admins"
on public.student_application_documents for select
to authenticated
using (
  (auth.uid() = user_id and is_archived = false)
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "eligible students update own preparation status"
  on public.student_application_documents;
create policy "eligible students update own preparation status"
on public.student_application_documents for update
to authenticated
using (
  auth.uid() = user_id
  and is_archived = false
  and status in ('not_started', 'preparing')
  and public.student_feature_allowed('application_documents')
)
with check (
  auth.uid() = user_id
  and is_archived = false
  and status in ('not_started', 'preparing')
  and public.student_feature_allowed('application_documents')
);

revoke all on function public.initialize_target_application_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_university_application_document_requirement()
  from public, anon, authenticated;
revoke all on function public.enforce_archived_application_document_immutability()
  from public, anon, authenticated;

comment on table public.university_application_document_requirements is
  '每所韩国大学独立维护的五类申请资料模板';
comment on column public.student_application_documents.requirement_id is
  '生成该学生资料项目的大学申请资料模板；为空表示历史或管理员临时追加项目';
comment on column public.student_application_documents.is_archived is
  '大学不再要求该资料时隐藏；已有提交历史仍保留以便审计';

notify pgrst, 'reload schema';
