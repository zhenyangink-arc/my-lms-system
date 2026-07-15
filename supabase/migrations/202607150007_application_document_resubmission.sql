-- ============================================================
-- 学生待审核阶段更换提交文件
-- 学生可在管理员开始审核前重新提交；审核开始后立即锁定当前版本。
-- ============================================================

-- 扩展数据库状态机：待审核 → 待审核的版本替换是唯一新增的学生操作。
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
     and old.status in ('not_started', 'preparing', 'pending_review', 'revision_required') then
    select exists (
      select 1
      from public.student_application_document_files as file
      where file.document_id = new.id
        and file.user_id = auth.uid()
        and file.version = new.submission_version
        and file.storage_path = new.storage_path
    ) into submitted_file_exists;

    if submitted_file_exists
       and new.submission_version > old.submission_version then
      return new;
    end if;
  end if;

  raise exception '当前账号不能执行这个材料状态变更';
end;
$$;

-- 重新提交函数保留所有旧版本，只把主表指向最新文件。
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

  if current_document.status not in ('not_started', 'preparing', 'pending_review', 'revision_required') then
    raise exception '管理员已经开始审核，当前文件不能更换';
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

-- 同一状态下版本号增加也要生成“重新提交”事件，方便管理员追溯。
create or replace function public.log_application_document_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_name text;
begin
  if old.status is not distinct from new.status
     and old.submission_version is not distinct from new.submission_version then
    return new;
  end if;

  event_name := case
    when new.status = 'pending_review'
         and new.submission_version > old.submission_version then 'submitted'
    when new.status = 'reviewing' then 'review_started'
    when new.status = 'approved' then 'approved'
    when new.status = 'revision_required' then 'revision_requested'
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
after update of status, submission_version on public.student_application_documents
for each row
execute function public.log_application_document_status_change();

comment on function public.submit_student_application_document(uuid, text, text, bigint, text) is
  '学生首次提交、退回重交或在待审核阶段更换申请材料文件';
