-- ============================================================
-- 申请材料安全上传与审核工作流
-- 流程：未开始 → 准备中 → 待审核 → 审核中 → 已确认／退回重交。
-- 文件保存在私有存储桶；学生只能上传，管理员及以上角色才能下载查看。
-- ============================================================

-- 先移除旧状态约束，再把“已整理”迁移为“待审核”；整个迁移在同一事务中执行。
alter table public.student_application_documents
  drop constraint if exists student_application_documents_status_check;

update public.student_application_documents
set status = 'pending_review'
where status = 'uploaded';

-- 扩展材料主表，保存当前提交文件和审核时间线所需的信息。
alter table public.student_application_documents
  add column if not exists original_file_name text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_mime_type text,
  add column if not exists submission_version integer not null default 0,
  add column if not exists submitted_at timestamptz,
  add column if not exists review_started_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text;

alter table public.student_application_documents
  add constraint student_application_documents_status_check
  check (status in (
    'not_started',
    'preparing',
    'pending_review',
    'reviewing',
    'approved',
    'revision_required'
  ));

alter table public.student_application_documents
  drop constraint if exists student_application_documents_file_size_check;

alter table public.student_application_documents
  add constraint student_application_documents_file_size_check
  check (file_size_bytes is null or file_size_bytes between 1 and 15728640);

alter table public.student_application_documents
  drop constraint if exists student_application_documents_review_note_check;

alter table public.student_application_documents
  add constraint student_application_documents_review_note_check
  check (review_note is null or char_length(review_note) <= 500);

-- 每次提交都建立不可覆盖的版本记录，退回重交时仍能追溯旧文件。
create table if not exists public.student_application_document_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.student_application_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  storage_path text not null unique,
  original_file_name text not null check (char_length(original_file_name) between 1 and 180),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 15728640),
  mime_type text not null,
  submitted_at timestamptz not null default now(),
  unique (document_id, version)
);

create index if not exists application_document_files_document_version_idx
  on public.student_application_document_files (document_id, version desc);

-- 状态事件由数据库触发器写入，前端不能伪造或删除审核历史。
create table if not exists public.student_application_document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.student_application_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'status_updated',
    'submitted',
    'review_started',
    'approved',
    'revision_requested'
  )),
  from_status text,
  to_status text not null,
  submission_version integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists application_document_events_document_created_idx
  on public.student_application_document_events (document_id, created_at desc);

-- 私有材料桶允许 PDF、常见图片和 Word 文件，单个文件最大 15MB。
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'application-documents',
  'application-documents',
  false,
  15728640,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 学生只能把文件上传到“自己的用户编号／自己的材料编号”目录。
drop policy if exists "eligible students upload own application documents" on storage.objects;
create policy "eligible students upload own application documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.student_application_documents as document
    where document.id::text = (storage.foldername(name))[2]
      and document.user_id = auth.uid()
      and public.student_feature_allowed('application_documents')
  )
);

-- 学生只能清理尚未写入版本表的失败上传，已提交文件不能自行删除。
drop policy if exists "students delete unregistered application uploads" on storage.objects;
create policy "students delete unregistered application uploads"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and not exists (
    select 1
    from public.student_application_document_files as file
    where file.storage_path = name
  )
);

-- 只有正常状态的管理员、运营负责人和负责人可以查看材料文件。
drop policy if exists "admins read application document files" on storage.objects;
create policy "admins read application document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'application-documents'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

-- 版本表和事件表启用行级安全。
alter table public.student_application_document_files enable row level security;
alter table public.student_application_document_events enable row level security;

-- 学生可以看到自己提交的文件名称和版本，但没有存储桶读取权限，无法下载文件内容。
drop policy if exists "students read own application file metadata" on public.student_application_document_files;
create policy "students read own application file metadata"
on public.student_application_document_files for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins read application file metadata" on public.student_application_document_files;
create policy "admins read application file metadata"
on public.student_application_document_files for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "students read own application document events" on public.student_application_document_events;
create policy "students read own application document events"
on public.student_application_document_events for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "admins read application document events" on public.student_application_document_events;
create policy "admins read application document events"
on public.student_application_document_events for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

-- 重新拆分材料清单策略：学生只能创建清单并更新准备状态，审核状态由安全函数和管理员维护。
drop policy if exists "application documents read own or staff" on public.student_application_documents;
create policy "application documents read own or admins"
on public.student_application_documents for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

drop policy if exists "eligible students manage own application documents" on public.student_application_documents;
drop policy if exists "application documents manage own" on public.student_application_documents;

create policy "eligible students create own application documents"
on public.student_application_documents for insert
to authenticated
with check (
  auth.uid() = user_id
  and status = 'not_started'
  and public.student_feature_allowed('application_documents')
);

create policy "eligible students update own preparation status"
on public.student_application_documents for update
to authenticated
using (
  auth.uid() = user_id
  and status in ('not_started', 'preparing')
  and public.student_feature_allowed('application_documents')
)
with check (
  auth.uid() = user_id
  and status in ('not_started', 'preparing')
  and public.student_feature_allowed('application_documents')
);

create policy "admins update application document reviews"
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

-- 数据库状态机阻止学生绕过页面伪造审核结果，也阻止管理员跳过“开始审核”步骤。
create or replace function public.enforce_application_document_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
  submitted_file_exists boolean;
begin
  -- 数据库维护任务没有登录用户时保留执行能力；普通请求必须遵守下面的状态机。
  if auth.uid() is null then
    return new;
  end if;

  select role into current_role
  from public.profiles
  where id = auth.uid();

  if current_role in ('admin', 'ceo', 'super_admin') then
    if old.status is distinct from new.status
       and not (
         (old.status = 'pending_review' and new.status = 'reviewing')
         or (old.status = 'reviewing' and new.status in ('approved', 'revision_required'))
       ) then
      raise exception '申请材料审核状态必须按流程更新';
    end if;
    return new;
  end if;

  if auth.uid() <> old.user_id or new.user_id <> old.user_id then
    raise exception '只能更新自己的申请材料';
  end if;

  if new.status in ('not_started', 'preparing')
     and old.status in ('not_started', 'preparing') then
    if (to_jsonb(new) - 'status' - 'updated_at')
       is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
      raise exception '学生只能修改材料准备状态';
    end if;
    return new;
  end if;

  if new.status = 'pending_review'
     and old.status in ('not_started', 'preparing', 'revision_required') then
    select exists (
      select 1
      from public.student_application_document_files as file
      where file.document_id = new.id
        and file.user_id = auth.uid()
        and file.version = new.submission_version
        and file.storage_path = new.storage_path
    ) into submitted_file_exists;

    if submitted_file_exists then
      return new;
    end if;
  end if;

  raise exception '当前账号不能执行这个材料状态变更';
end;
$$;

drop trigger if exists application_documents_enforce_workflow on public.student_application_documents;
create trigger application_documents_enforce_workflow
before update on public.student_application_documents
for each row
execute function public.enforce_application_document_workflow();

-- 提交函数在一个数据库事务中写入文件版本并把状态切换为待审核。
create or replace function public.submit_student_application_document(
  requested_document_id uuid,
  requested_storage_path text,
  requested_file_name text,
  requested_file_size bigint,
  requested_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  current_document public.student_application_documents%rowtype;
  next_version integer;
  created_file_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  if not public.student_feature_allowed('application_documents') then
    raise exception '当前账号没有申请资料提交权限';
  end if;

  select * into current_document
  from public.student_application_documents
  where id = requested_document_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception '找不到要提交的申请材料';
  end if;

  if current_document.status not in ('not_started', 'preparing', 'revision_required') then
    raise exception '当前材料状态不能重复提交';
  end if;

  if requested_storage_path not like auth.uid()::text || '/' || requested_document_id::text || '/%' then
    raise exception '文件存储路径无效';
  end if;

  if requested_file_size < 1 or requested_file_size > 15728640 then
    raise exception '文件大小必须在 15MB 以内';
  end if;

  if char_length(requested_file_name) < 1 or char_length(requested_file_name) > 180 then
    raise exception '文件名称无效';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'application-documents'
      and name = requested_storage_path
  ) then
    raise exception '上传文件不存在，请重新选择文件';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.student_application_document_files
  where document_id = requested_document_id;

  insert into public.student_application_document_files (
    document_id,
    user_id,
    version,
    storage_path,
    original_file_name,
    file_size_bytes,
    mime_type
  )
  values (
    requested_document_id,
    auth.uid(),
    next_version,
    requested_storage_path,
    requested_file_name,
    requested_file_size,
    requested_mime_type
  )
  returning id into created_file_id;

  update public.student_application_documents
  set
    status = 'pending_review',
    storage_path = requested_storage_path,
    original_file_name = requested_file_name,
    file_size_bytes = requested_file_size,
    file_mime_type = requested_mime_type,
    submission_version = next_version,
    submitted_at = now(),
    review_started_at = null,
    reviewed_at = null,
    reviewed_by = null,
    review_note = null
  where id = requested_document_id;

  return created_file_id;
end;
$$;

-- 自动记录每次状态变化，学生和管理员都能看到一致的进度历史。
create or replace function public.log_application_document_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  event_name := case new.status
    when 'pending_review' then 'submitted'
    when 'reviewing' then 'review_started'
    when 'approved' then 'approved'
    when 'revision_required' then 'revision_requested'
    else 'status_updated'
  end;

  insert into public.student_application_document_events (
    document_id,
    user_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    submission_version,
    note
  ) values (
    new.id,
    new.user_id,
    auth.uid(),
    event_name,
    old.status,
    new.status,
    new.submission_version,
    new.review_note
  );

  return new;
end;
$$;

drop trigger if exists application_documents_log_status_change on public.student_application_documents;
create trigger application_documents_log_status_change
after update of status on public.student_application_documents
for each row
execute function public.log_application_document_status_change();

grant select on public.student_application_document_files to authenticated;
grant select on public.student_application_document_events to authenticated;
revoke insert, update, delete on public.student_application_document_files from authenticated;
revoke insert, update, delete on public.student_application_document_events from authenticated;

revoke all on function public.submit_student_application_document(uuid, text, text, bigint, text) from public;
grant execute on function public.submit_student_application_document(uuid, text, text, bigint, text) to authenticated;

comment on table public.student_application_document_files is '学生申请材料的不可覆盖提交版本';
comment on table public.student_application_document_events is '申请材料提交与审核状态事件';
comment on function public.submit_student_application_document(uuid, text, text, bigint, text) is '学生安全提交申请材料文件并进入待审核状态';
