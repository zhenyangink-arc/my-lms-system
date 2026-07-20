-- ============================================================
-- 管理员删除学生的单个业务档案卡
-- 仅清理申请资料或签证模块，不删除学生账号、目标大学和学习数据。
-- ============================================================

create table if not exists public.student_service_card_deletion_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid not null,
  target_email text,
  target_full_name text,
  card_type text not null check (card_type in ('application_documents', 'visa')),
  related_data_counts jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists student_service_card_deletion_logs_target_idx
  on public.student_service_card_deletion_logs (target_user_id, deleted_at desc);

create index if not exists student_service_card_deletion_logs_actor_idx
  on public.student_service_card_deletion_logs (actor_id, deleted_at desc);

alter table public.student_service_card_deletion_logs enable row level security;

drop policy if exists "admins read student service card deletion logs"
  on public.student_service_card_deletion_logs;
create policy "admins read student service card deletion logs"
on public.student_service_card_deletion_logs for select
to authenticated
using (exists (
  select 1
  from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role in ('admin', 'ceo', 'super_admin')
));

grant select on public.student_service_card_deletion_logs to authenticated;
revoke insert, update, delete on public.student_service_card_deletion_logs from authenticated;

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
    raise exception '只有管理员可以删除学生申请资料卡';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
    and role = 'student'
  for update;

  if not found then
    raise exception '找不到要删除的学生账号';
  end if;

  if not exists (
    select 1
    from public.student_application_documents
    where user_id = requested_user_id
  ) then
    raise exception '这名学生的申请资料卡已经不存在';
  end if;

  select jsonb_build_object(
    '申请资料项目', (select count(*) from public.student_application_documents where user_id = requested_user_id),
    '提交文件版本', (select count(*) from public.student_application_document_files where user_id = requested_user_id),
    '审核事件', (select count(*) from public.student_application_document_events where user_id = requested_user_id)
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

  -- 文件版本和审核事件通过 document_id 外键级联删除。
  delete from public.student_application_documents
  where user_id = requested_user_id;

  return true;
end;
$$;

create or replace function public.delete_student_visa_card(
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
    raise exception '只有管理员可以删除学生签证卡';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
    and role = 'student'
  for update;

  if not found then
    raise exception '找不到要删除的学生账号';
  end if;

  if not exists (
    select 1 from public.student_visa_cases where user_id = requested_user_id
  ) and not exists (
    select 1 from public.student_visa_tasks where user_id = requested_user_id
  ) then
    raise exception '这名学生的签证卡已经不存在';
  end if;

  select jsonb_build_object(
    '签证档案', (select count(*) from public.student_visa_cases where user_id = requested_user_id),
    '签证任务', (select count(*) from public.student_visa_tasks where user_id = requested_user_id),
    '任务事件', (select count(*) from public.student_visa_task_events where user_id = requested_user_id)
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
    'visa',
    related_counts
  );

  -- 任务事件通过 task_id 外键级联删除。
  delete from public.student_visa_tasks
  where user_id = requested_user_id;

  delete from public.student_visa_cases
  where user_id = requested_user_id;

  return true;
end;
$$;

revoke all on function public.delete_student_application_document_card(uuid)
  from public, anon;
revoke all on function public.delete_student_visa_card(uuid)
  from public, anon;
grant execute on function public.delete_student_application_document_card(uuid)
  to authenticated;
grant execute on function public.delete_student_visa_card(uuid)
  to authenticated;

-- 删除资料卡后，服务端动作会通过 Storage API 清理对应的私有附件。
drop policy if exists "admins delete application document files"
  on storage.objects;
create policy "admins delete application document files"
on storage.objects for delete
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

comment on table public.student_service_card_deletion_logs is
  '管理员删除学生申请资料卡或签证卡时保留的独立审计记录';
comment on function public.delete_student_application_document_card(uuid) is
  '管理员删除指定学生的全部申请资料、提交版本与审核事件，保留账号和目标大学';
comment on function public.delete_student_visa_card(uuid) is
  '管理员删除指定学生的签证档案、任务与任务事件，保留学生账号';

notify pgrst, 'reload schema';
