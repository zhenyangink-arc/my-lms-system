-- ============================================================
-- 负责人删除测试账号
-- 只有 super_admin 可以永久删除账号；删除前保存独立审计记录。
-- ============================================================

create table if not exists public.account_deletion_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid not null,
  target_email text,
  target_full_name text,
  target_role text,
  deletion_reason text not null check (char_length(btrim(deletion_reason)) between 2 and 300),
  related_data_counts jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists account_deletion_audit_deleted_at_idx
  on public.account_deletion_audit_logs (deleted_at desc);

alter table public.account_deletion_audit_logs enable row level security;

create policy "owners read account deletion audit logs"
on public.account_deletion_audit_logs for select to authenticated
using (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid()
    and profiles.status = 'active'
    and profiles.role = 'super_admin'
));

grant select on public.account_deletion_audit_logs to authenticated;
revoke insert, update, delete on public.account_deletion_audit_logs from authenticated;

-- 负责人删除账号时需要输入邮箱；无邮箱的历史账号输入账号编号后六位。
create or replace function public.delete_managed_account(
  requested_user_id uuid,
  requested_confirmation text,
  requested_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text;
  target_profile public.profiles%rowtype;
  target_auth_email text;
  expected_confirmation text;
  related_counts jsonb;
  auth_user_deleted boolean := false;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  select role into actor_role
  from public.profiles
  where id = auth.uid() and status = 'active';

  if actor_role is distinct from 'super_admin' then
    raise exception '只有负责人可以永久删除账号';
  end if;

  if requested_user_id = auth.uid() then
    raise exception '不能删除当前登录的负责人账号';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if target_profile.role = 'super_admin' then
    raise exception '负责人账号不能通过管理页面删除';
  end if;

  select email into target_auth_email from auth.users where id = requested_user_id;
  expected_confirmation := coalesce(
    nullif(lower(btrim(coalesce(target_profile.email, target_auth_email))), ''),
    right(requested_user_id::text, 6)
  );

  if lower(btrim(coalesce(requested_confirmation, ''))) <> expected_confirmation then
    raise exception '删除确认内容不正确';
  end if;

  if char_length(btrim(coalesce(requested_reason, ''))) not between 2 and 300 then
    raise exception '删除原因需要填写 2 至 300 个字';
  end if;

  -- 审计记录只保存数量和必要账号信息，不复制学生材料内容。
  select jsonb_build_object(
    '目标大学', (select count(*) from public.student_university_targets where user_id = requested_user_id),
    '申请材料', (select count(*) from public.student_application_documents where user_id = requested_user_id),
    '签证任务', (select count(*) from public.student_visa_tasks where user_id = requested_user_id),
    '签证档案', (select count(*) from public.student_visa_cases where user_id = requested_user_id)
  ) into related_counts;

  insert into public.account_deletion_audit_logs (
    actor_id,
    target_user_id,
    target_email,
    target_full_name,
    target_role,
    deletion_reason,
    related_data_counts
  ) values (
    auth.uid(),
    requested_user_id,
    coalesce(target_profile.email, target_auth_email),
    target_profile.full_name,
    target_profile.role,
    btrim(requested_reason),
    related_counts
  );

  -- 删除 Supabase Auth 主账号，外键级联清理个人资料与学生业务数据。
  delete from auth.users where id = requested_user_id;
  auth_user_deleted := found;

  -- 极少数历史账号可能只剩 profiles 行，此时仍允许负责人完成清理。
  if not auth_user_deleted then
    delete from public.profiles where id = requested_user_id;
  end if;

  return true;
end;
$$;

revoke all on function public.delete_managed_account(uuid, text, text) from public;
grant execute on function public.delete_managed_account(uuid, text, text) to authenticated;

-- 删除业务账号后，负责人可通过 Storage 接口清理该账号遗留的私有文件。
create policy "owners delete managed profile photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-photos'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role = 'super_admin'
  )
);

create policy "owners delete managed application documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'application-documents'
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role = 'super_admin'
  )
);

comment on table public.account_deletion_audit_logs is '负责人永久删除账号后的独立审计记录';
comment on function public.delete_managed_account(uuid, text, text) is '负责人确认账号标识后永久删除认证账号与关联数据';
