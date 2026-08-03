begin;

-- 旧函数仍使用 super_admin 等历史角色名；统一改用签证专属权限判断。
create or replace function public.delete_student_visa_card(requested_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
  target_profile public.profiles%rowtype;
  related_counts jsonb;
  acting_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  acting_tenant_id := private.current_tenant_id();
  if acting_tenant_id is null or not public.current_user_can_manage_visas() then
    raise exception '当前账号没有签证管理权限';
  end if;

  select membership.role into target_role
  from public.tenant_memberships as membership
  where membership.user_id = requested_user_id
    and membership.tenant_id = acting_tenant_id;

  if target_role is null then
    raise exception '找不到要删除的账号';
  end if;
  if target_role <> 'student' then
    raise exception '签证管理只能删除学生的签证档案';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if not exists (
    select 1 from public.student_visa_cases
    where user_id = requested_user_id and tenant_id = acting_tenant_id
  ) and not exists (
    select 1 from public.student_visa_tasks
    where user_id = requested_user_id and tenant_id = acting_tenant_id
  ) then
    raise exception '这个账号的签证档案已经不存在';
  end if;

  select jsonb_build_object(
    '签证档案', (select count(*) from public.student_visa_cases where user_id = requested_user_id and tenant_id = acting_tenant_id),
    '签证任务', (select count(*) from public.student_visa_tasks where user_id = requested_user_id and tenant_id = acting_tenant_id),
    '任务事件', (select count(*) from public.student_visa_task_events where user_id = requested_user_id and tenant_id = acting_tenant_id)
  ) into related_counts;

  insert into public.student_service_card_deletion_logs (
    tenant_id,
    actor_id,
    target_user_id,
    target_email,
    target_full_name,
    card_type,
    related_data_counts
  ) values (
    acting_tenant_id,
    auth.uid(),
    requested_user_id,
    target_profile.email,
    target_profile.full_name,
    'visa',
    related_counts
  );

  delete from public.student_visa_tasks
  where user_id = requested_user_id and tenant_id = acting_tenant_id;

  delete from public.student_visa_cases
  where user_id = requested_user_id and tenant_id = acting_tenant_id;

  return true;
end;
$$;

revoke all on function public.delete_student_visa_card(uuid)
  from public, anon;
grant execute on function public.delete_student_visa_card(uuid)
  to authenticated;

comment on function public.delete_student_visa_card(uuid) is
  '由本机构负责人、运营负责人或获授权签证管理员删除学生签证档案，并保留审计记录。';

notify pgrst, 'reload schema';

commit;
