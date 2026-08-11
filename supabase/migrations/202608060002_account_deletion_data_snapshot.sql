begin;

-- delete_managed_account 删除账号时，会级联清空学生的选校目标、申请材料、签证案件/
-- 任务、成绩、作业提交、章节测试记录、教材进度、会话练习进度等核心数据——没有软删除、
-- 没有回收站、没有任何恢复手段，误删或者本该只是停用账号却走了永久删除流程时，
-- 这些数据就彻底找不回来了。
--
-- 这里没有改动级联删除本身（改成拦截 CASCADE 触发的删除、转成软删除，在 profiles 也
-- 同一事务里被删掉的情况下会导致这些表留下指向不存在 profiles.id 的孤儿外键，属于更
-- 高风险的改法）。改成更稳妥的方式：删除前把这些表里这个学生的完整数据整行快照进
-- account_deletion_audit_logs，误删后可以凭这份快照人工恢复，不需要改动现有的级联
-- 删除机制和外键约束。
alter table public.account_deletion_audit_logs
  add column if not exists deleted_data_snapshot jsonb not null default '{}'::jsonb;

comment on column public.account_deletion_audit_logs.deleted_data_snapshot is
  '删除账号前对核心学习数据的整行快照（选校目标/申请材料/签证案件/签证任务/成绩/成绩复核/作业提交/章节测试记录与错题复盘/教材阅读进度/会话练习进度），误删时可凭这份快照人工恢复。';

create or replace function public.delete_managed_account(requested_user_id uuid, requested_confirmation text, requested_reason text)
returns boolean
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
declare
  target_profile public.profiles%rowtype;
  target_auth_email text;
  expected_confirmation text;
  related_counts jsonb;
  data_snapshot jsonb;
  auth_user_deleted boolean := false;
  acting_tenant_id uuid;
  foreign_membership_count integer;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  acting_tenant_id := private.current_tenant_id();

  if not public.is_owner_account() or acting_tenant_id is null then
    raise exception '只有负责人可以永久删除账号';
  end if;

  if requested_user_id = auth.uid() then
    raise exception '不能删除当前登录的负责人账号';
  end if;

  if not exists (
    select 1 from public.tenant_memberships as membership
    where membership.user_id = requested_user_id
      and membership.tenant_id = acting_tenant_id
  ) then
    raise exception '找不到要删除的账号';
  end if;

  select count(*) into foreign_membership_count
  from public.tenant_memberships as membership
  where membership.user_id = requested_user_id
    and membership.tenant_id <> acting_tenant_id;

  if foreign_membership_count > 0 then
    raise exception '该账号还属于其他租户，请联系平台负责人处理';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if target_profile.role in ('tenant_super_admin', 'tenant_operator') then
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

  select jsonb_build_object(
    '目标大学', (select count(*) from public.student_university_targets where user_id = requested_user_id),
    '申请材料', (select count(*) from public.student_application_documents where user_id = requested_user_id),
    '签证任务', (select count(*) from public.student_visa_tasks where user_id = requested_user_id),
    '签证档案', (select count(*) from public.student_visa_cases where user_id = requested_user_id)
  ) into related_counts;

  select jsonb_build_object(
    'student_university_targets', coalesce((select jsonb_agg(to_jsonb(t)) from public.student_university_targets t where t.user_id = requested_user_id), '[]'::jsonb),
    'student_application_documents', coalesce((select jsonb_agg(to_jsonb(t)) from public.student_application_documents t where t.user_id = requested_user_id), '[]'::jsonb),
    'student_visa_cases', coalesce((select jsonb_agg(to_jsonb(t)) from public.student_visa_cases t where t.user_id = requested_user_id), '[]'::jsonb),
    'student_visa_tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.student_visa_tasks t where t.user_id = requested_user_id), '[]'::jsonb),
    'grade_records', coalesce((select jsonb_agg(to_jsonb(t)) from public.grade_records t where t.student_id = requested_user_id), '[]'::jsonb),
    'grade_review_requests', coalesce((select jsonb_agg(to_jsonb(t)) from public.grade_review_requests t where t.student_id = requested_user_id), '[]'::jsonb),
    'learning_submissions', coalesce((select jsonb_agg(to_jsonb(t)) from public.learning_submissions t where t.student_id = requested_user_id), '[]'::jsonb),
    'chapter_test_attempts', coalesce((select jsonb_agg(to_jsonb(t)) from public.chapter_test_attempts t where t.student_id = requested_user_id), '[]'::jsonb),
    'chapter_test_question_reviews', coalesce((select jsonb_agg(to_jsonb(t)) from public.chapter_test_question_reviews t where t.student_id = requested_user_id), '[]'::jsonb),
    'course_ebook_progress', coalesce((select jsonb_agg(to_jsonb(t)) from public.course_ebook_progress t where t.student_id = requested_user_id), '[]'::jsonb),
    'conversation_practice_progress', coalesce((select jsonb_agg(to_jsonb(t)) from public.conversation_practice_progress t where t.user_id = requested_user_id), '[]'::jsonb)
  ) into data_snapshot;

  insert into public.account_deletion_audit_logs (
    tenant_id,
    actor_id,
    target_user_id,
    target_email,
    target_full_name,
    target_role,
    deletion_reason,
    related_data_counts,
    deleted_data_snapshot
  ) values (
    acting_tenant_id,
    auth.uid(),
    requested_user_id,
    coalesce(target_profile.email, target_auth_email),
    target_profile.full_name,
    target_profile.role,
    btrim(requested_reason),
    related_counts,
    data_snapshot
  );

  perform set_config('app.tenant_hard_delete', 'on', true);

  delete from auth.users where id = requested_user_id;
  auth_user_deleted := found;

  if not auth_user_deleted then
    delete from public.profiles where id = requested_user_id;
  end if;

  return true;
end;
$$;

commit;
