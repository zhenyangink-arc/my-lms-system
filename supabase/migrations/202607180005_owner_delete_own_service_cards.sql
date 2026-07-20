-- ============================================================
-- 负责人拥有业务卡最高删除权限
-- admin / ceo 只能删除学生业务卡；super_admin 可以删除管理页中
-- 显示的任意申请资料卡或签证卡，包括负责人自己的业务卡。
-- ============================================================

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
    raise exception '只有管理员可以删除签证卡';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if actor_role <> 'super_admin' and target_profile.role <> 'student' then
    raise exception '普通管理员只能删除学生签证卡';
  end if;

  if not exists (
    select 1 from public.student_visa_cases where user_id = requested_user_id
  ) and not exists (
    select 1 from public.student_visa_tasks where user_id = requested_user_id
  ) then
    raise exception '这个账号的签证卡已经不存在';
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

comment on function public.delete_student_application_document_card(uuid) is
  '管理员删除学生申请资料卡；负责人可删除管理页显示的任意申请资料卡，包括自己的';
comment on function public.delete_student_visa_card(uuid) is
  '管理员删除学生签证卡；负责人可删除管理页显示的任意签证卡，包括自己的';

notify pgrst, 'reload schema';
