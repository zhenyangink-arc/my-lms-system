-- ============================================================
-- 申请资料改为纯清单进度
-- 取消文件上传、版本、审核事件与审核状态，只保留“准备中 / 已完成”。
-- ============================================================

-- 先移除所有依赖文件版本表或旧审核字段的策略与触发器。
drop policy if exists "eligible students upload own application documents" on storage.objects;
drop policy if exists "students delete unregistered application uploads" on storage.objects;
drop policy if exists "admins read application document files" on storage.objects;
drop policy if exists "admins delete application document files" on storage.objects;

drop policy if exists "eligible students create own application documents"
  on public.student_application_documents;
drop policy if exists "eligible students update own preparation status"
  on public.student_application_documents;
drop policy if exists "admins update application document reviews"
  on public.student_application_documents;
drop policy if exists "admins delete unused application checklist items"
  on public.student_application_documents;
drop policy if exists "application documents read own or admins"
  on public.student_application_documents;

drop trigger if exists application_documents_enforce_workflow
  on public.student_application_documents;
drop trigger if exists application_documents_log_status_change
  on public.student_application_documents;
drop trigger if exists application_documents_enforce_archived_immutability
  on public.student_application_documents;

drop function if exists public.submit_student_application_document(uuid, text, text, bigint, text);
drop function if exists public.enforce_application_document_workflow();
drop function if exists public.log_application_document_status_change();
drop function if exists public.enforce_archived_application_document_immutability();

-- 卡片删除审计不再统计已经取消的文件版本和审核事件。
create or replace function public.delete_student_application_document_card(
  requested_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_profile public.profiles%rowtype;
  related_counts jsonb;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'active';

  if actor_role is null or actor_role not in ('admin', 'ceo', 'super_admin') then
    raise exception '只有管理员可以删除申请资料卡';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if actor_role <> 'super_admin' and target_profile.role <> 'student' then
    raise exception '普通管理员只能删除学生申请资料卡';
  end if;

  if not exists (
    select 1
    from public.student_application_documents
    where user_id = requested_user_id
  ) then
    raise exception '这个账号的申请资料卡已经不存在';
  end if;

  select jsonb_build_object(
    '申请资料项目', (
      select count(*)
      from public.student_application_documents
      where user_id = requested_user_id
    )
  ) into related_counts;

  insert into public.student_service_card_deletion_logs (
    actor_id,
    target_user_id,
    target_email,
    target_full_name,
    card_type,
    related_data_counts
  ) values (
    auth.uid(),
    requested_user_id,
    target_profile.email,
    target_profile.full_name,
    'application_documents',
    related_counts
  );

  delete from public.student_application_documents
  where user_id = requested_user_id;

  return true;
end;
$$;

-- 新增模板项默认进入“准备中”；模板停用或切换申请阶段时直接删除旧清单项。
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
    sort_order
  )
  select
    target_record.user_id,
    target_record.id,
    requirement.requirement_key,
    requirement.id,
    requirement.title,
    requirement.category,
    requirement.description,
    'preparing',
    requirement.sort_order
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
    sort_order = excluded.sort_order;
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
    where requirement_id = old.id;
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
      sort_order
    )
    select
      target.user_id,
      target.id,
      new.requirement_key,
      new.id,
      new.title,
      new.category,
      new.description,
      'preparing',
      new.sort_order
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
      sort_order = excluded.sort_order;
  else
    delete from public.student_application_documents
    where requirement_id = new.id;
  end if;

  return new;
end;
$$;

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
    delete from public.student_application_documents as document
    using public.university_application_document_requirements as requirement
    where document.target_id = new.id
      and document.requirement_id = requirement.id
      and requirement.admission_stage <> target_stage;
  end if;

  if new.status <> 'researching' then
    perform public.initialize_target_application_documents(new.id);
  end if;

  return new;
end;
$$;

-- 归档只用于保留旧上传历史；上传取消后不再保留这套软删除结构。
delete from public.student_application_documents
where is_archived = true;

drop index if exists public.student_application_documents_requirement_idx;
drop index if exists public.student_application_documents_active_target_idx;

alter table public.student_application_documents
  drop constraint if exists student_application_documents_status_check,
  drop constraint if exists student_application_documents_file_size_check,
  drop constraint if exists student_application_documents_review_note_check,
  drop constraint if exists student_application_documents_review_file_check;

update public.student_application_documents
set status = case
  when status in ('pending_review', 'reviewing', 'approved') then 'completed'
  else 'preparing'
end;

alter table public.student_application_documents
  alter column status set default 'preparing',
  add constraint student_application_documents_status_check
    check (status in ('preparing', 'completed')),
  drop column if exists storage_path,
  drop column if exists original_file_name,
  drop column if exists file_size_bytes,
  drop column if exists file_mime_type,
  drop column if exists submission_version,
  drop column if exists submitted_at,
  drop column if exists review_started_at,
  drop column if exists reviewed_at,
  drop column if exists reviewed_by,
  drop column if exists review_note,
  drop column if exists is_archived;

create index student_application_documents_requirement_idx
  on public.student_application_documents (requirement_id);
create index student_application_documents_target_category_idx
  on public.student_application_documents (target_id, category, sort_order);

drop table if exists public.student_application_document_events;
drop table if exists public.student_application_document_files;

-- Storage 系统表禁止通过 SQL 直接删除；空桶在迁移后由 Storage API 删除。

-- 学生只能更新自己的状态字段，不能借更新请求修改标题、备注或关联目标。
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

  if new.status not in ('preparing', 'completed') then
    raise exception '申请资料状态只能是准备中或已完成';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
     is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception '学生只能修改申请资料状态';
  end if;

  return new;
end;
$$;

drop trigger if exists application_documents_enforce_checklist_update
  on public.student_application_documents;
create trigger application_documents_enforce_checklist_update
before update on public.student_application_documents
for each row execute function public.enforce_application_document_checklist_update();

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

create policy "eligible students update own checklist status"
on public.student_application_documents for update
to authenticated
using (
  auth.uid() = user_id
  and status in ('preparing', 'completed')
  and public.student_feature_allowed('application_documents')
)
with check (
  auth.uid() = user_id
  and status in ('preparing', 'completed')
  and public.student_feature_allowed('application_documents')
);

create policy "admins delete application checklist items"
on public.student_application_documents for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role in ('admin', 'ceo', 'super_admin')
  )
);

revoke all on function public.initialize_target_application_documents(uuid)
  from public, anon, authenticated;
revoke all on function public.sync_university_application_document_requirement()
  from public, anon, authenticated;
revoke all on function public.initialize_documents_when_target_prepares()
  from public, anon, authenticated;
revoke all on function public.enforce_application_document_checklist_update()
  from public, anon, authenticated;

revoke all on function public.delete_student_application_document_card(uuid)
  from public, anon;
grant execute on function public.delete_student_application_document_card(uuid)
  to authenticated;

comment on table public.student_application_documents is
  '学生按目标大学与申请阶段维护的申请资料准备清单；不保存文件';
comment on column public.student_application_documents.status is
  '申请资料准备状态：preparing（准备中）或 completed（已完成）';
comment on function public.delete_student_application_document_card(uuid) is
  '管理员删除申请资料清单卡；负责人可删除管理页显示的任意卡，包括自己的';

notify pgrst, 'reload schema';
