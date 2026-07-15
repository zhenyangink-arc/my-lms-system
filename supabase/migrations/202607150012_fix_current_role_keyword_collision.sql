-- ============================================================
-- 修复审核触发器里的角色判断失效问题
-- 根因：这几个触发器函数把变量命名为 current_role。
-- current_role 是 Postgres 的保留关键字（等价于 CURRENT_ROLE 系统值，
-- 表示当前执行查询的数据库角色，例如 authenticated），
-- 在表达式里引用 current_role 永远解析成这个系统值，
-- 不会被 "select role into current_role ..." 赋的值覆盖。
-- 结果是 "if current_role in ('admin','ceo','super_admin')" 永远为假，
-- 不管当前登录账号实际角色是什么，都会被判定成普通学生，
-- 导致管理员／运营负责人／老板都无法通过审核流程更新状态。
-- 这里把变量改名为 actor_role，逻辑本身不做任何改动。
-- ============================================================

create or replace function public.enforce_application_document_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  submitted_file_exists boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role in ('admin', 'ceo', 'super_admin') then
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

create or replace function public.enforce_student_visa_task_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role in ('admin', 'ceo', 'super_admin') then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证准备操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.status := case when new.status in ('pending', 'in_progress') then new.status else 'pending' end;
    new.admin_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_started_at := null;
    new.submission_version := 0;
    return new;
  end if;

  new.submission_version := old.submission_version;
  new.submitted_at := old.submitted_at;

  if (to_jsonb(new) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'student_note' - 'submitted_at' - 'submission_version' - 'updated_at') then
    raise exception '学生只能更新签证任务状态和个人备注';
  end if;

  if old.status in ('submitted', 'reviewing', 'approved') then
    raise exception '当前任务已经提交或确认，不能自行修改';
  end if;

  if new.status = old.status and old.status in ('pending', 'in_progress', 'blocked', 'revision_required') then
    return new;
  end if;

  if (old.status = 'pending' and new.status in ('in_progress', 'blocked'))
     or (old.status = 'in_progress' and new.status in ('pending', 'blocked'))
     or (old.status = 'blocked' and new.status = 'in_progress')
     or (old.status = 'revision_required' and new.status = 'in_progress') then
    return new;
  end if;

  if old.status in ('in_progress', 'revision_required') and new.status = 'submitted' then
    new.submission_version := old.submission_version + 1;
    new.submitted_at := now();
    new.review_started_at := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.admin_note := null;
    return new;
  end if;

  raise exception '签证任务状态必须按准备流程更新';
end;
$$;

create or replace function public.enforce_student_visa_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role in ('admin', 'ceo', 'super_admin') then
    return new;
  end if;

  if new.user_id <> auth.uid() or not public.student_feature_allowed('visa_tasks') then
    raise exception '当前账号没有签证档案操作权限';
  end if;

  if tg_op = 'INSERT' then
    new.case_status := 'planning';
    new.assigned_admin_id := null;
    new.advisor_note := null;
    new.last_reviewed_at := null;
    return new;
  end if;

  if (to_jsonb(new) - 'visa_type' - 'target_entry_date' - 'application_city' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'visa_type' - 'target_entry_date' - 'application_city' - 'updated_at') then
    raise exception '学生只能更新自己的签证基础信息';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_student_lesson_progress_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  preview_enabled boolean;
begin
  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role in ('teacher', 'admin', 'ceo', 'super_admin') then
    return new;
  end if;

  select is_free_preview into preview_enabled from public.lessons where id = new.lesson_id;
  if not public.student_feature_allowed('course_preview') or not coalesce(preview_enabled, false) then
    raise exception '当前账号没有此课时的学习记录权限';
  end if;
  return new;
end;
$$;

comment on function public.enforce_application_document_workflow() is
  '申请材料状态机；变量已改名为 actor_role，避免与保留字 current_role 冲突';
comment on function public.enforce_student_visa_task_workflow() is
  '签证任务状态机；变量已改名为 actor_role，避免与保留字 current_role 冲突';
comment on function public.enforce_student_visa_case_fields() is
  '签证档案字段权限；变量已改名为 actor_role，避免与保留字 current_role 冲突';
comment on function public.enforce_student_lesson_progress_permission() is
  '课时学习记录权限；变量已改名为 actor_role，避免与保留字 current_role 冲突';
