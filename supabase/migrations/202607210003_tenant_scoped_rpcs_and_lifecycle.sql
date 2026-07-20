-- ============================================================
-- 多租户阶段 B（函数层）：SECURITY DEFINER RPC 与触发器租户加固
--
-- SECURITY DEFINER 函数绕过 RLS，因此每个按 id 读写业务行的函数都必须
-- 自带 tenant_id = private.current_tenant_id() 守卫，否则拿到外租户 UUID
-- 即可越权。本迁移同时：
-- 1. 学生名单类 RPC 改为按当前租户成员关系枚举；
-- 2. 账号管理同步触发器从「只同步 PUFFY」改为「同步到成员默认租户」；
-- 3. 永久删除租户前先清空该租户全部业务数据（业务表外键为 restrict）；
-- 4. 与迁移 1 的唯一约束调整保持一致（on conflict 目标列更新）。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. 帮助中心
-- ------------------------------------------------------------
create or replace function public.create_help_ticket(p_subject text, p_description text, p_category text, p_priority text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_ticket_id uuid;
begin
  if not (public.is_active_account() and public.current_profile_role() = 'student') then
    raise exception '只有正常状态的学生账号可以提交求助';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_description, ''))) not between 2 and 5000 then
    raise exception '求助标题或问题描述长度不正确';
  end if;
  if p_category not in ('technical', 'account', 'course', 'service', 'other')
     or p_priority not in ('normal', 'urgent') then
    raise exception '求助分类或紧急程度不正确';
  end if;

  insert into public.help_tickets (user_id, subject, description, category, priority)
  values (auth.uid(), trim(p_subject), trim(p_description), p_category, p_priority)
  returning id into v_ticket_id;
  return v_ticket_id;
end;
$$;

create or replace function public.add_help_ticket_message(p_ticket_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare
  v_owner uuid;
  v_status text;
  v_message_id uuid;
  v_is_manager boolean;
begin
  v_is_manager := public.current_user_can_manage_help_center();
  select user_id, status into v_owner, v_status
  from public.help_tickets
  where id = p_ticket_id and tenant_id = private.current_tenant_id();
  if v_owner is null then raise exception '求助记录不存在'; end if;
  if not v_is_manager and v_owner <> auth.uid() then raise exception '无权回复该求助'; end if;
  if not v_is_manager and v_status = 'closed' then raise exception '该求助已经关闭'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then
    raise exception '回复内容需要填写 1 至 5000 个字';
  end if;

  insert into public.help_ticket_messages (ticket_id, sender_id, sender_kind, body)
  values (p_ticket_id, auth.uid(), case when v_is_manager then 'staff' else 'student' end, trim(p_body))
  returning id into v_message_id;

  update public.help_tickets
  set status = case when v_is_manager and status = 'open' then 'in_progress' else status end,
      assigned_to = case when v_is_manager then coalesce(assigned_to, auth.uid()) else assigned_to end,
      updated_at = now()
  where id = p_ticket_id and tenant_id = private.current_tenant_id();
  return v_message_id;
end;
$$;

create or replace function public.update_help_ticket(p_ticket_id uuid, p_status text, p_priority text, p_resolution text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved', 'closed')
     or p_priority not in ('normal', 'urgent')
     or char_length(coalesce(p_resolution, '')) > 3000 then
    raise exception '求助状态、紧急程度或处理结果不正确';
  end if;
  update public.help_tickets
  set status = p_status, priority = p_priority,
      resolution = trim(coalesce(p_resolution, '')),
      assigned_to = coalesce(assigned_to, auth.uid()),
      resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_ticket_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '求助记录不存在'; end if;
end;
$$;

create or replace function public.change_help_article_status(p_article_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '帮助文章状态不正确';
  end if;
  update public.help_articles
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(), updated_at = now()
  where id = p_article_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '帮助文章不存在'; end if;
end;
$$;

create or replace function public.save_help_article(p_id uuid, p_title text, p_summary text, p_content text, p_category text, p_is_featured boolean, p_sort_order integer, p_status text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_help_center() then
    raise exception '当前账号没有帮助中心管理权限';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
     or char_length(trim(coalesce(p_content, ''))) not between 2 and 10000
     or char_length(coalesce(p_summary, '')) > 500 then
    raise exception '帮助文章标题、摘要或正文长度不正确';
  end if;
  if p_category not in ('platform', 'account', 'course', 'study', 'visa', 'service')
     or p_status not in ('draft', 'published', 'archived')
     or p_sort_order not between 0 and 100000 then
    raise exception '帮助文章分类、状态或排序值不正确';
  end if;

  if p_id is null then
    insert into public.help_articles (
      title, summary, content, category, is_featured, sort_order, status,
      published_at, created_by, updated_by
    ) values (
      trim(p_title), trim(coalesce(p_summary, '')), trim(p_content), p_category,
      coalesce(p_is_featured, false), p_sort_order, p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.help_articles
    set title = trim(p_title), summary = trim(coalesce(p_summary, '')),
        content = trim(p_content), category = p_category,
        is_featured = coalesce(p_is_featured, false), sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(), updated_at = now()
    where id = p_id and tenant_id = private.current_tenant_id()
    returning id into v_id;
    if v_id is null then raise exception '帮助文章不存在'; end if;
  end if;
  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- 2. 成绩中心
-- ------------------------------------------------------------
create or replace function public.save_grade_item(p_id uuid, p_title text, p_description text, p_item_type text, p_term text, p_total_points numeric, p_weight_percent numeric, p_status text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120 or char_length(coalesce(p_description, '')) > 2000 or char_length(coalesce(p_term, '')) > 60 then raise exception '成绩项目内容长度不正确'; end if;
  if p_item_type not in ('homework', 'quiz', 'exam', 'course', 'final', 'other') or p_status not in ('draft', 'published', 'archived') then raise exception '成绩项目类型或状态不正确'; end if;
  if p_total_points <= 0 or p_total_points > 10000 or p_weight_percent < 0 or p_weight_percent > 100 then raise exception '满分或权重不正确'; end if;
  if p_id is null then
    insert into public.grade_items (title, description, item_type, term, total_points, weight_percent, status, published_at, created_by, updated_by)
    values (trim(p_title), trim(coalesce(p_description, '')), p_item_type, trim(coalesce(p_term, '')), p_total_points, p_weight_percent, p_status, case when p_status = 'published' then now() else null end, auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.grade_items set title = trim(p_title), description = trim(coalesce(p_description, '')), item_type = p_item_type, term = trim(coalesce(p_term, '')), total_points = p_total_points, weight_percent = p_weight_percent, status = p_status, published_at = case when p_status = 'published' and status <> 'published' then now() when p_status = 'draft' then null else published_at end, updated_by = auth.uid(), updated_at = now()
    where id = p_id and tenant_id = private.current_tenant_id()
    returning id into v_id;
    if v_id is null then raise exception '成绩项目不存在'; end if;
    if exists (select 1 from public.grade_records where item_id = p_id and score > p_total_points) then raise exception '新满分低于现有学生得分'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_grade_item_status(p_item_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception '成绩项目状态不正确'; end if;
  update public.grade_items set status = p_status, published_at = case when p_status = 'published' and status <> 'published' then now() when p_status = 'draft' then null else published_at end, updated_by = auth.uid(), updated_at = now()
  where id = p_item_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '成绩项目不存在'; end if;
end;
$$;

create or replace function public.save_grade_record(p_item_id uuid, p_student_id uuid, p_record_status text, p_score numeric, p_feedback text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_total numeric; v_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  select total_points into v_total from public.grade_items
  where id = p_item_id and tenant_id = private.current_tenant_id();
  if v_total is null then raise exception '成绩项目不存在'; end if;
  if not exists (
    select 1 from public.tenant_memberships as membership
    where membership.user_id = p_student_id
      and membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active'
  ) then raise exception '学生账号无效'; end if;
  if p_record_status not in ('graded', 'absent', 'exempt') then raise exception '成绩记录状态不正确'; end if;
  if p_record_status = 'graded' and (p_score is null or p_score < 0 or p_score > v_total) then raise exception '学生得分需要在 0 和满分之间'; end if;
  if p_record_status <> 'graded' then p_score := null; end if;
  if char_length(coalesce(p_feedback, '')) > 3000 then raise exception '成绩评语过长'; end if;
  insert into public.grade_records (item_id, student_id, record_status, score, feedback, graded_by)
  values (p_item_id, p_student_id, p_record_status, p_score, trim(coalesce(p_feedback, '')), auth.uid())
  on conflict (item_id, student_id) do update set record_status = excluded.record_status, score = excluded.score, feedback = excluded.feedback, graded_by = auth.uid(), graded_at = now(), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.request_grade_review(p_record_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_student uuid; v_item_status text; v_id uuid;
begin
  select record.student_id, item.status into v_student, v_item_status
  from public.grade_records as record
  join public.grade_items as item on item.id = record.item_id
  where record.id = p_record_id and record.tenant_id = private.current_tenant_id();
  if v_student is distinct from auth.uid() or v_item_status is distinct from 'published' then raise exception '无权申请该成绩复核'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 2 and 2000 then raise exception '复核原因需要填写 2 至 2000 个字'; end if;
  if exists (select 1 from public.grade_review_requests where record_id = p_record_id and status in ('pending','reviewing')) then raise exception '该成绩已有正在处理的复核申请'; end if;
  insert into public.grade_review_requests (record_id, student_id, reason)
  values (p_record_id, auth.uid(), trim(p_reason))
  on conflict (record_id) do update set reason = excluded.reason, status = 'pending', response = '', handled_by = null, requested_at = now(), handled_at = null, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_grade_review(p_review_id uuid, p_status text, p_response text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  if p_status not in ('reviewing','resolved','rejected') or char_length(trim(coalesce(p_response, ''))) > 3000 then raise exception '复核状态或回复不正确'; end if;
  update public.grade_review_requests set status = p_status, response = trim(coalesce(p_response, '')), handled_by = auth.uid(), handled_at = case when p_status in ('resolved','rejected') then now() else null end, updated_at = now()
  where id = p_review_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '复核申请不存在'; end if;
end;
$$;

create or replace function public.import_assignment_grades(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_assignment public.learning_assignments%rowtype; v_item_id uuid;
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  select * into v_assignment from public.learning_assignments
  where id = p_assignment_id and tenant_id = private.current_tenant_id();
  if v_assignment.id is null then raise exception '作业或考试不存在'; end if;
  insert into public.grade_items (title, description, item_type, term, total_points, source_assignment_id, status, created_by, updated_by)
  values (v_assignment.title, v_assignment.description, case when v_assignment.assignment_type in ('homework','quiz','exam') then v_assignment.assignment_type else 'other' end, '', v_assignment.total_points, v_assignment.id, 'draft', auth.uid(), auth.uid())
  on conflict (source_assignment_id) do update set title = excluded.title, description = excluded.description, total_points = excluded.total_points, updated_by = auth.uid(), updated_at = now()
  returning id into v_item_id;
  insert into public.grade_records (item_id, student_id, record_status, score, feedback, graded_by, graded_at)
  select v_item_id, latest.student_id, 'graded', latest.score, coalesce(latest.overall_feedback, ''), auth.uid(), coalesce(latest.graded_at, now())
  from (
    select distinct on (submission.student_id) submission.student_id, submission.score, submission.overall_feedback, submission.graded_at
    from public.learning_submissions as submission
    where submission.assignment_id = p_assignment_id and submission.status = 'graded' and submission.score is not null
    order by submission.student_id, submission.attempt_number desc
  ) as latest
  on conflict (item_id, student_id) do update set record_status = 'graded', score = excluded.score, feedback = excluded.feedback, graded_by = auth.uid(), graded_at = excluded.graded_at, updated_at = now();
  return v_item_id;
end;
$$;

create or replace function public.list_grade_center_students()
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_grade_center() then raise exception '当前账号没有成绩管理权限'; end if;
  return query select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.tenant_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  where membership.tenant_id = private.current_tenant_id()
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

-- ------------------------------------------------------------
-- 3. 作业与考试
-- ------------------------------------------------------------
create or replace function public.list_learning_assignment_students()
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;
  return query select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.tenant_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  where membership.tenant_id = private.current_tenant_id()
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.list_learning_record_students()
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  return query select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.tenant_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  where membership.tenant_id = private.current_tenant_id()
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

-- 创建作业：课程与分配学生都必须属于当前租户。
create or replace function public.create_learning_assignment(p_title text, p_description text, p_assignment_type text, p_course_id uuid, p_target_scope text, p_target_ids uuid[], p_due_at timestamp with time zone, p_duration_minutes integer, p_allow_resubmission boolean, p_publish boolean, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare
  v_assignment_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_question_type text;
  v_prompt text;
  v_options jsonb;
  v_points numeric(8,2);
  v_total_points numeric(8,2) := 0;
  v_sort_order integer := 0;
  v_correct_answer text;
  v_explanation text;
  v_target_count integer;
  v_expected_target_count integer;
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_title) not between 2 and 120 then
    raise exception '标题需要填写 2 至 120 个字';
  end if;
  if char_length(p_description) > 5000 then
    raise exception '任务说明不能超过 5000 个字';
  end if;
  if p_assignment_type not in ('homework', 'quiz', 'exam') then
    raise exception '任务类型不正确';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception '截止时间必须晚于当前时间';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not between 1 and 600 then
    raise exception '建议用时需要在 1 至 600 分钟之间';
  end if;
  if p_course_id is not null and not exists (
    select 1 from public.courses
    where id = p_course_id and tenant_id = private.current_tenant_id()
  ) then
    raise exception '所选课程不存在';
  end if;
  if p_questions is null or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception '请设置 1 至 50 道题目';
  end if;

  if p_target_scope = 'selected_students' then
    select count(distinct value::uuid)
      into v_expected_target_count
    from unnest(coalesce(p_target_ids, array[]::uuid[])) as value;
    if v_expected_target_count = 0 then
      raise exception '请至少选择一名学生';
    end if;
    select count(*)
      into v_target_count
    from public.tenant_memberships as membership
    where membership.user_id = any(p_target_ids)
      and membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active';
    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含无效学生账号';
    end if;
  end if;

  insert into public.learning_assignments (
    title, description, assignment_type, course_id, target_scope,
    due_at, duration_minutes, allow_resubmission, status, published_at,
    created_by, updated_by
  ) values (
    p_title, p_description, p_assignment_type, p_course_id, p_target_scope,
    p_due_at, p_duration_minutes, coalesce(p_allow_resubmission, false),
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() else null end,
    auth.uid(), auth.uid()
  ) returning id into v_assignment_id;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    v_question_type := coalesce(v_question->>'type', '');
    v_prompt := btrim(coalesce(v_question->>'prompt', ''));
    v_options := coalesce(v_question->'options', '[]'::jsonb);
    v_correct_answer := nullif(btrim(coalesce(v_question->>'correctAnswer', '')), '');
    v_explanation := nullif(btrim(coalesce(v_question->>'explanation', '')), '');
    begin
      v_points := (v_question->>'points')::numeric;
    exception when others then
      raise exception '第 % 题分值不正确', v_sort_order + 1;
    end;

    if v_question_type not in ('short_text', 'long_text', 'single_choice', 'file_link') then
      raise exception '第 % 题类型不正确', v_sort_order + 1;
    end if;
    if char_length(v_prompt) not between 1 and 3000 then
      raise exception '第 % 题题目不能为空且不能超过 3000 个字', v_sort_order + 1;
    end if;
    if v_points <= 0 or v_points > 1000 then
      raise exception '第 % 题分值需要在 0 至 1000 分之间', v_sort_order + 1;
    end if;
    if jsonb_typeof(v_options) <> 'array' then
      raise exception '第 % 题选项格式不正确', v_sort_order + 1;
    end if;
    if v_question_type = 'single_choice' and jsonb_array_length(v_options) < 2 then
      raise exception '第 % 道选择题至少需要两个选项', v_sort_order + 1;
    end if;
    if v_explanation is not null and char_length(v_explanation) > 3000 then
      raise exception '第 % 题解析不能超过 3000 个字', v_sort_order + 1;
    end if;

    insert into public.learning_assignment_questions (
      assignment_id, question_type, prompt, options, points, sort_order
    ) values (
      v_assignment_id, v_question_type, v_prompt, v_options, v_points, v_sort_order
    ) returning id into v_question_id;

    if v_correct_answer is not null or v_explanation is not null then
      insert into public.learning_assignment_question_keys (
        question_id, correct_answer, explanation, updated_by
      ) values (
        v_question_id, v_correct_answer, v_explanation, auth.uid()
      );
    end if;

    v_total_points := v_total_points + v_points;
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.learning_assignments
  set total_points = v_total_points
  where id = v_assignment_id;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (assignment_id, student_id)
    select v_assignment_id, value::uuid
    from unnest(p_target_ids) as value
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$$;

create or replace function public.change_learning_assignment_status(p_assignment_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;
  if p_status not in ('draft', 'published', 'closed') then
    raise exception '任务状态不正确';
  end if;
  if p_status = 'published' and exists (
    select 1 from public.learning_assignments
    where id = p_assignment_id and tenant_id = private.current_tenant_id() and due_at <= now()
  ) then
    raise exception '截止时间已过，不能发布';
  end if;

  update public.learning_assignments
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_assignment_id and tenant_id = private.current_tenant_id();

  if not found then raise exception '任务不存在'; end if;
end;
$$;

create or replace function public.update_learning_assignment_deadline(p_assignment_id uuid, p_due_at timestamp with time zone)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception '新的截止时间必须晚于当前时间';
  end if;
  update public.learning_assignments
  set due_at = p_due_at, updated_by = auth.uid(), updated_at = now()
  where id = p_assignment_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '任务不存在'; end if;
end;
$$;

-- 批改：先确认提交属于当前租户，再逐题写分。
create or replace function public.grade_learning_submission(p_submission_id uuid, p_decision text, p_overall_feedback text, p_scores jsonb)
returns void language plpgsql security definer set search_path = 'public'
as $$
declare
  v_item jsonb;
  v_answer_id uuid;
  v_points numeric(8,2);
  v_feedback text;
  v_max_points numeric(8,2);
  v_total numeric(8,2) := 0;
  v_expected integer;
  v_received integer;
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有批改权限';
  end if;
  if not exists (
    select 1 from public.learning_submissions
    where id = p_submission_id and tenant_id = private.current_tenant_id()
  ) then
    raise exception '提交记录不存在';
  end if;
  if p_decision not in ('graded', 'revision_required') then
    raise exception '批改结果不正确';
  end if;
  p_overall_feedback := btrim(coalesce(p_overall_feedback, ''));
  if char_length(p_overall_feedback) > 3000 then
    raise exception '总体评语不能超过 3000 个字';
  end if;
  if p_decision = 'revision_required' and char_length(p_overall_feedback) < 2 then
    raise exception '退回重做时必须填写明确原因';
  end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    raise exception '评分数据格式不正确';
  end if;

  select count(*) into v_expected
  from public.learning_submission_answers where submission_id = p_submission_id;
  select count(distinct (value->>'answerId')) into v_received
  from jsonb_array_elements(p_scores);
  if v_expected = 0 or v_received <> v_expected then
    raise exception '请填写全部题目的评分';
  end if;

  for v_item in select value from jsonb_array_elements(p_scores)
  loop
    begin
      v_answer_id := (v_item->>'answerId')::uuid;
      v_points := (v_item->>'points')::numeric;
    exception when others then
      raise exception '评分中包含无效数据';
    end;
    v_feedback := nullif(btrim(coalesce(v_item->>'feedback', '')), '');
    if v_feedback is not null and char_length(v_feedback) > 2000 then
      raise exception '单题评语不能超过 2000 个字';
    end if;

    select question.points into v_max_points
    from public.learning_submission_answers as answer
    join public.learning_assignment_questions as question on question.id = answer.question_id
    where answer.id = v_answer_id and answer.submission_id = p_submission_id;
    if not found then raise exception '评分中包含不属于本次提交的答案'; end if;
    if v_points < 0 or v_points > v_max_points then
      raise exception '单题得分必须在 0 分和题目满分之间';
    end if;

    update public.learning_submission_answers
    set awarded_points = v_points,
        grader_feedback = v_feedback,
        updated_at = now()
    where id = v_answer_id;
    v_total := v_total + v_points;
  end loop;

  update public.learning_submissions
  set status = p_decision,
      score = case when p_decision = 'graded' then v_total else null end,
      overall_feedback = nullif(p_overall_feedback, ''),
      graded_at = now(),
      graded_by = auth.uid(),
      updated_at = now()
  where id = p_submission_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '提交记录不存在'; end if;
end;
$$;

-- ------------------------------------------------------------
-- 4. 学习记录 / 资料库 / 会话练习
-- ------------------------------------------------------------
create or replace function public.save_learning_record_note(p_id uuid, p_student_id uuid, p_record_type text, p_title text, p_content text, p_next_action text, p_visibility text, p_occurred_at timestamp with time zone)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  if not exists (
    select 1 from public.tenant_memberships as membership
    where membership.user_id = p_student_id
      and membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active'
  ) then raise exception '学生账号无效'; end if;
  if p_record_type not in ('coaching','evaluation','milestone','attention','plan') or p_visibility not in ('student_visible','internal') then raise exception '记录类型或可见范围不正确'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 120 or char_length(trim(coalesce(p_content,''))) not between 2 and 5000 or char_length(coalesce(p_next_action,'')) > 2000 then raise exception '记录标题、内容或下一步建议长度不正确'; end if;
  if p_id is null then
    insert into public.learning_record_notes (student_id, record_type, title, content, next_action, visibility, occurred_at, created_by, updated_by)
    values (p_student_id, p_record_type, trim(p_title), trim(p_content), trim(coalesce(p_next_action,'')), p_visibility, coalesce(p_occurred_at, now()), auth.uid(), auth.uid()) returning id into v_id;
  else
    update public.learning_record_notes set record_type = p_record_type, title = trim(p_title), content = trim(p_content), next_action = trim(coalesce(p_next_action,'')), visibility = p_visibility, occurred_at = coalesce(p_occurred_at, occurred_at), updated_by = auth.uid(), updated_at = now()
    where id = p_id and student_id = p_student_id and tenant_id = private.current_tenant_id()
    returning id into v_id;
    if v_id is null then raise exception '学习记录不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_learning_record_note_status(p_note_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_learning_records() then raise exception '当前账号没有学习记录管理权限'; end if;
  if p_status not in ('active','archived') then raise exception '学习记录状态不正确'; end if;
  update public.learning_record_notes set status = p_status, updated_by = auth.uid(), updated_at = now()
  where id = p_note_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '学习记录不存在'; end if;
end;
$$;

create or replace function public.save_library_resource(p_id uuid, p_title text, p_description text, p_category text, p_resource_type text, p_file_path text, p_original_file_name text, p_mime_type text, p_file_size bigint, p_external_url text, p_is_featured boolean, p_sort_order integer, p_status text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare v_id uuid;
begin
  if not public.current_user_can_manage_library() then raise exception '当前账号没有资料库管理权限'; end if;
  if char_length(trim(coalesce(p_title,''))) not between 2 and 140 or char_length(coalesce(p_description,''))>3000 then raise exception '资料标题或说明长度不正确'; end if;
  if p_category not in ('language','study','application','visa','career','tools') or p_resource_type not in ('document','image','spreadsheet','presentation','archive','link') or p_status not in ('draft','published','archived') or p_sort_order not between 0 and 100000 then raise exception '资料分类、类型、状态或排序不正确'; end if;
  if p_resource_type='link' then
    if p_external_url is null or p_external_url !~ '^https?://' then raise exception '外部链接地址不正确'; end if;
    p_file_path:=null;p_original_file_name:=null;p_mime_type:=null;p_file_size:=null;
  else
    if p_file_path is null or p_original_file_name is null or p_file_size is null or p_file_size not between 1 and 15728640 then raise exception '资料文件信息不完整'; end if;
    p_external_url:=null;
  end if;
  if p_id is null then
    insert into public.library_resources(title,description,category,resource_type,file_path,original_file_name,mime_type,file_size,external_url,is_featured,sort_order,status,published_at,created_by,updated_by)
    values(trim(p_title),trim(coalesce(p_description,'')),p_category,p_resource_type,p_file_path,p_original_file_name,p_mime_type,p_file_size,p_external_url,coalesce(p_is_featured,false),p_sort_order,p_status,case when p_status='published' then now() else null end,auth.uid(),auth.uid()) returning id into v_id;
  else
    update public.library_resources set title=trim(p_title),description=trim(coalesce(p_description,'')),category=p_category,resource_type=p_resource_type,file_path=p_file_path,original_file_name=p_original_file_name,mime_type=p_mime_type,file_size=p_file_size,external_url=p_external_url,is_featured=coalesce(p_is_featured,false),sort_order=p_sort_order,status=p_status,published_at=case when p_status='published' and status<>'published' then now() when p_status='draft' then null else published_at end,updated_by=auth.uid(),updated_at=now()
    where id=p_id and tenant_id = private.current_tenant_id()
    returning id into v_id;
    if v_id is null then raise exception '资料不存在'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_library_resource_status(p_resource_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_library() then raise exception '当前账号没有资料库管理权限'; end if;
  if p_status not in ('draft','published','archived') then raise exception '资料状态不正确'; end if;
  update public.library_resources set status=p_status,published_at=case when p_status='published' and status<>'published' then now() when p_status='draft' then null else published_at end,updated_by=auth.uid(),updated_at=now()
  where id=p_resource_id and tenant_id = private.current_tenant_id();
  if not found then raise exception '资料不存在'; end if;
end;
$$;

create or replace function public.record_library_download(p_resource_id uuid)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.is_active_account()
    or not exists(
      select 1 from public.library_resources
      where id=p_resource_id
        and tenant_id = private.current_tenant_id()
        and (status='published' or public.current_user_can_manage_library())
    )
  then raise exception '无权下载该资料'; end if;
  insert into public.library_downloads(resource_id,user_id) values(p_resource_id,auth.uid());
  update public.library_resources set download_count=download_count+1
  where id=p_resource_id and tenant_id = private.current_tenant_id();
end;
$$;

create or replace function public.toggle_library_favorite(p_resource_id uuid)
returns boolean language plpgsql security definer set search_path = 'public'
as $$
declare v_added boolean;
begin
  if not public.is_active_account()
    or not exists(
      select 1 from public.library_resources
      where id=p_resource_id and tenant_id = private.current_tenant_id() and status='published'
    ) then raise exception '无权收藏该资料'; end if;
  if exists(select 1 from public.library_favorites where user_id=auth.uid() and resource_id=p_resource_id) then
    delete from public.library_favorites where user_id=auth.uid() and resource_id=p_resource_id;
    v_added:=false;
  else
    insert into public.library_favorites(user_id,resource_id) values(auth.uid(),p_resource_id);
    v_added:=true;
  end if;
  return v_added;
end;
$$;

create or replace function public.record_conversation_practice(p_scenario_id uuid, p_confidence integer, p_reflection text, p_completed boolean)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not (public.is_active_account() and public.current_profile_role() = 'student') then
    raise exception '只有正常状态的学生账号可以保存练习记录';
  end if;
  if not exists (
    select 1 from public.conversation_practice_scenarios
    where id = p_scenario_id and tenant_id = private.current_tenant_id() and status = 'published'
  ) then
    raise exception '该会话场景尚未开放';
  end if;
  if p_confidence is not null and p_confidence not between 1 and 5 then
    raise exception '请填写 1 至 5 级的自信程度';
  end if;
  if char_length(coalesce(p_reflection, '')) > 1200 then
    raise exception '练习复盘不能超过 1200 个字';
  end if;

  insert into public.conversation_practice_progress (
    user_id, scenario_id, status, practice_count, confidence, reflection,
    first_practiced_at, last_practiced_at, completed_at
  ) values (
    auth.uid(), p_scenario_id,
    case when coalesce(p_completed, false) then 'completed' else 'practicing' end,
    1, p_confidence, coalesce(p_reflection, ''), now(), now(),
    case when coalesce(p_completed, false) then now() else null end
  )
  on conflict (user_id, scenario_id) do update
  set status = case when coalesce(p_completed, false) then 'completed' else conversation_practice_progress.status end,
      practice_count = conversation_practice_progress.practice_count + 1,
      confidence = p_confidence,
      reflection = coalesce(p_reflection, ''),
      last_practiced_at = now(),
      completed_at = case
        when coalesce(p_completed, false) then coalesce(conversation_practice_progress.completed_at, now())
        else conversation_practice_progress.completed_at
      end;
end;
$$;

create or replace function public.save_conversation_practice_scenario(p_id uuid, p_title text, p_description text, p_category text, p_difficulty text, p_situation text, p_learning_objectives jsonb, p_sample_dialogue jsonb, p_key_expressions jsonb, p_starter_prompt text, p_practice_tips text, p_duration_minutes integer, p_is_featured boolean, p_sort_order integer, p_status text)
returns uuid language plpgsql security definer set search_path = 'public'
as $$
declare
  v_id uuid;
begin
  if not public.current_user_can_manage_conversation_practice() then
    raise exception '当前账号没有会话练习管理权限';
  end if;

  if char_length(trim(coalesce(p_title, ''))) not between 2 and 100 then
    raise exception '场景标题需要填写 2 至 100 个字';
  end if;
  if char_length(coalesce(p_description, '')) > 500
     or char_length(coalesce(p_situation, '')) > 1500
     or char_length(coalesce(p_starter_prompt, '')) > 1000
     or char_length(coalesce(p_practice_tips, '')) > 1500 then
    raise exception '场景内容超过允许长度';
  end if;
  if p_category not in ('daily', 'campus', 'travel', 'interview', 'workplace')
     or p_difficulty not in ('beginner', 'intermediate', 'advanced')
     or p_status not in ('draft', 'published', 'archived') then
    raise exception '场景分类、难度或状态不正确';
  end if;
  if p_duration_minutes not between 1 and 120 or p_sort_order not between 0 and 100000 then
    raise exception '练习时长或排序值不正确';
  end if;
  if jsonb_typeof(coalesce(p_learning_objectives, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_sample_dialogue, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_key_expressions, '[]'::jsonb)) <> 'array' then
    raise exception '场景结构化内容格式不正确';
  end if;
  if jsonb_array_length(coalesce(p_learning_objectives, '[]'::jsonb)) > 20
     or jsonb_array_length(coalesce(p_sample_dialogue, '[]'::jsonb)) > 50
     or jsonb_array_length(coalesce(p_key_expressions, '[]'::jsonb)) > 30 then
    raise exception '学习内容条目过多';
  end if;

  if p_id is null then
    insert into public.conversation_practice_scenarios (
      title, description, category, difficulty, situation, learning_objectives,
      sample_dialogue, key_expressions, starter_prompt, practice_tips,
      duration_minutes, is_featured, sort_order, status, published_at,
      created_by, updated_by
    ) values (
      trim(p_title), coalesce(p_description, ''), p_category, p_difficulty,
      coalesce(p_situation, ''), coalesce(p_learning_objectives, '[]'::jsonb),
      coalesce(p_sample_dialogue, '[]'::jsonb), coalesce(p_key_expressions, '[]'::jsonb),
      coalesce(p_starter_prompt, ''), coalesce(p_practice_tips, ''),
      p_duration_minutes, coalesce(p_is_featured, false), p_sort_order, p_status,
      case when p_status = 'published' then now() else null end,
      auth.uid(), auth.uid()
    ) returning id into v_id;
  else
    update public.conversation_practice_scenarios
    set title = trim(p_title),
        description = coalesce(p_description, ''),
        category = p_category,
        difficulty = p_difficulty,
        situation = coalesce(p_situation, ''),
        learning_objectives = coalesce(p_learning_objectives, '[]'::jsonb),
        sample_dialogue = coalesce(p_sample_dialogue, '[]'::jsonb),
        key_expressions = coalesce(p_key_expressions, '[]'::jsonb),
        starter_prompt = coalesce(p_starter_prompt, ''),
        practice_tips = coalesce(p_practice_tips, ''),
        duration_minutes = p_duration_minutes,
        is_featured = coalesce(p_is_featured, false),
        sort_order = p_sort_order,
        status = p_status,
        published_at = case
          when p_status = 'published' and status <> 'published' then now()
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id and tenant_id = private.current_tenant_id()
    returning id into v_id;

    if v_id is null then
      raise exception '会话场景不存在或已经被移除';
    end if;
  end if;

  return v_id;
end;
$$;

create or replace function public.change_conversation_practice_scenario_status(p_scenario_id uuid, p_status text)
returns void language plpgsql security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_manage_conversation_practice() then
    raise exception '当前账号没有会话练习管理权限';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '场景状态不正确';
  end if;

  update public.conversation_practice_scenarios
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_scenario_id and tenant_id = private.current_tenant_id();

  if not found then
    raise exception '会话场景不存在';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 5. 模块管理员授权触发器：被授权人必须是本租户的活跃管理员
--    （tenant_id 由 *_tenant_scope 触发器补齐，这里做兜底 coalesce）
-- ------------------------------------------------------------
do $$
declare
  module record;
begin
  for module in
    select * from (values
      ('enforce_announcement_assignment',          'current_user_is_announcement_owner',          '公告'),
      ('enforce_conversation_practice_assignment', 'current_user_is_conversation_practice_owner', '会话练习'),
      ('enforce_help_center_assignment',           'current_user_is_help_center_owner',           '帮助中心'),
      ('enforce_grade_center_assignment',          'current_user_is_grade_center_owner',          '成绩'),
      ('enforce_learning_record_assignment',       'current_user_is_learning_record_owner',       '学习记录'),
      ('enforce_library_assignment',               'current_user_is_library_owner',               '资料库')
    ) as m(fn_name, owner_fn, label)
  loop
    execute format($fn$
create or replace function public.%I()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $body$
declare
  resolved_tenant_id uuid;
begin
  if auth.uid() is null then return new; end if;
  if not public.%I() then raise exception '只有负责人可以指定%s管理员'; end if;

  resolved_tenant_id := coalesce(new.tenant_id, private.current_tenant_id());
  new.tenant_id := resolved_tenant_id;

  if new.revoked_at is null and not exists (
    select 1
    from public.tenant_memberships as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.user_id = new.admin_id
      and membership.tenant_id = resolved_tenant_id
      and membership.role = 'admin'
      and membership.status = 'active'
      and coalesce(profile.status, 'active') = 'active'
  ) then
    raise exception '只能授权状态正常的管理员账号';
  end if;

  if new.revoked_at is null then
    new.granted_by := auth.uid(); new.granted_at := now(); new.revoked_by := null;
  else
    new.revoked_by := auth.uid();
  end if;
  return new;
end;
$body$
$fn$, module.fn_name, module.owner_fn, module.label);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 6. 学生规划 / 签证工作区：目标行与派生行全部锁定同租户
-- ------------------------------------------------------------
create or replace function public.initialize_target_application_documents(requested_target_id uuid)
returns void
language plpgsql security definer set search_path = ''
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

  -- 由登录用户触发时，目标必须属于当前租户；触发器链内（如管理员更新学生行）
  -- 行本身已通过 RLS 校验，这里再挡一次直接 RPC 越权。
  if auth.uid() is not null
     and private.current_tenant_id() is not null
     and target_record.tenant_id <> private.current_tenant_id() then
    raise exception '无权初始化其他租户的申请材料';
  end if;

  target_stage := coalesce(target_record.admission_track, 'language');

  insert into public.student_application_documents (
    tenant_id,
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
    target_record.tenant_id,
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

create or replace function public.initialize_student_visa_workspace_for_user(requested_user_id uuid, requested_visa_type text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  created_case_id uuid;
  resolved_visa_type text;
  resolved_tenant_id uuid;
begin
  if requested_user_id is null then
    raise exception '缺少学生账号';
  end if;

  resolved_tenant_id := coalesce(private.current_tenant_id(), private.default_tenant_of(requested_user_id));
  if resolved_tenant_id is null then
    raise exception '缺少租户上下文';
  end if;

  resolved_visa_type := case
    when requested_visa_type in ('d4_language', 'd2_bachelor', 'd2_master', 'd2_doctor')
      then requested_visa_type
    else 'd4_language'
  end;

  insert into public.student_visa_cases (tenant_id, user_id, visa_type)
  values (resolved_tenant_id, requested_user_id, resolved_visa_type)
  on conflict (tenant_id, user_id) do nothing;

  select id into created_case_id
  from public.student_visa_cases
  where user_id = requested_user_id
    and tenant_id = resolved_tenant_id;

  return created_case_id;
end;
$$;

create or replace function public.initialize_student_visa_requirements(requested_user_id uuid, requested_target_id uuid, requested_visa_type text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  source_university_id uuid;
  source_tenant_id uuid;
begin
  select target.university_id, target.tenant_id
  into source_university_id, source_tenant_id
  from public.student_university_targets as target
  where target.id = requested_target_id
    and target.user_id = requested_user_id;

  if source_university_id is null then
    return;
  end if;

  if auth.uid() is not null
     and private.current_tenant_id() is not null
     and source_tenant_id <> private.current_tenant_id() then
    raise exception '无权初始化其他租户的签证任务';
  end if;

  insert into public.student_visa_tasks (
    tenant_id,
    user_id,
    task_key,
    requirement_id,
    title,
    description,
    stage,
    sort_order,
    is_archived
  )
  select
    source_tenant_id,
    requested_user_id,
    requirement.requirement_key,
    requirement.id,
    requirement.title,
    requirement.description,
    requirement.stage,
    requirement.sort_order,
    false
  from public.university_visa_application_requirements as requirement
  where requirement.university_id = source_university_id
    and requirement.visa_type = requested_visa_type
    and requirement.is_active = true
  on conflict (tenant_id, user_id, task_key)
  do update set
    requirement_id = excluded.requirement_id,
    title = excluded.title,
    description = excluded.description,
    stage = excluded.stage,
    sort_order = excluded.sort_order,
    is_archived = false;
end;
$$;

create or replace function public.sync_student_visa_requirements_from_case()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.source_target_id is distinct from new.source_target_id
     or old.visa_type is distinct from new.visa_type then
    delete from public.student_visa_tasks as task
    using public.university_visa_application_requirements as requirement
    where task.user_id = new.user_id
      and task.tenant_id = new.tenant_id
      and task.requirement_id = requirement.id
      and (
        requirement.visa_type is distinct from new.visa_type
        or not exists (
          select 1
          from public.student_university_targets as target
          where target.id = new.source_target_id
            and target.university_id = requirement.university_id
        )
      )
      and task.submission_version = 0
      and task.status in ('pending', 'in_progress', 'blocked');

    update public.student_visa_tasks as task
    set is_archived = true
    from public.university_visa_application_requirements as requirement
    where task.user_id = new.user_id
      and task.tenant_id = new.tenant_id
      and task.requirement_id = requirement.id
      and task.is_archived = false
      and (
        requirement.visa_type is distinct from new.visa_type
        or not exists (
          select 1
          from public.student_university_targets as target
          where target.id = new.source_target_id
            and target.university_id = requirement.university_id
        )
      );
  end if;

  if new.source_target_id is not null then
    perform public.initialize_student_visa_requirements(
      new.user_id,
      new.source_target_id,
      new.visa_type
    );
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 7. 管理端删除类 RPC：目标账号必须是当前租户成员
-- ------------------------------------------------------------
create or replace function public.delete_student_application_document_card(requested_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  target_profile public.profiles%rowtype;
  related_counts jsonb;
  acting_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  actor_role := public.current_profile_role();
  acting_tenant_id := private.current_tenant_id();

  if actor_role is null or actor_role not in ('admin', 'ceo', 'super_admin') or acting_tenant_id is null then
    raise exception '只有管理员可以删除申请资料卡';
  end if;

  select membership.role into target_role
  from public.tenant_memberships as membership
  where membership.user_id = requested_user_id
    and membership.tenant_id = acting_tenant_id;

  if target_role is null then
    raise exception '找不到要删除的账号';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if actor_role <> 'super_admin' and target_role <> 'student' then
    raise exception '普通管理员只能删除学生申请资料卡';
  end if;

  if not exists (
    select 1
    from public.student_application_documents
    where user_id = requested_user_id
      and tenant_id = acting_tenant_id
  ) then
    raise exception '这个账号的申请资料卡已经不存在';
  end if;

  select jsonb_build_object(
    '申请资料项目', (
      select count(*)
      from public.student_application_documents
      where user_id = requested_user_id
        and tenant_id = acting_tenant_id
    )
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
    'application_documents',
    related_counts
  );

  delete from public.student_application_documents
  where user_id = requested_user_id
    and tenant_id = acting_tenant_id;

  return true;
end;
$$;

create or replace function public.delete_student_visa_card(requested_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  target_profile public.profiles%rowtype;
  related_counts jsonb;
  acting_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception '请先登录';
  end if;

  actor_role := public.current_profile_role();
  acting_tenant_id := private.current_tenant_id();

  if actor_role is null or actor_role not in ('admin', 'ceo', 'super_admin') or acting_tenant_id is null then
    raise exception '只有管理员可以删除签证卡';
  end if;

  select membership.role into target_role
  from public.tenant_memberships as membership
  where membership.user_id = requested_user_id
    and membership.tenant_id = acting_tenant_id;

  if target_role is null then
    raise exception '找不到要删除的账号';
  end if;

  select * into target_profile
  from public.profiles
  where id = requested_user_id
  for update;

  if not found then
    raise exception '找不到要删除的账号';
  end if;

  if actor_role <> 'super_admin' and target_role <> 'student' then
    raise exception '普通管理员只能删除学生签证卡';
  end if;

  if not exists (
    select 1 from public.student_visa_cases
    where user_id = requested_user_id and tenant_id = acting_tenant_id
  ) and not exists (
    select 1 from public.student_visa_tasks
    where user_id = requested_user_id and tenant_id = acting_tenant_id
  ) then
    raise exception '这个账号的签证卡已经不存在';
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

-- 永久删除账号：只允许删除当前租户的成员；跨租户成员需先由对方租户移除。
create or replace function public.delete_managed_account(requested_user_id uuid, requested_confirmation text, requested_reason text)
returns boolean
language plpgsql security definer
set search_path = 'public', 'auth'
as $$
declare
  target_profile public.profiles%rowtype;
  target_auth_email text;
  expected_confirmation text;
  related_counts jsonb;
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

  if target_profile.role in ('super_admin', 'tenant_operator') then
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

  insert into public.account_deletion_audit_logs (
    tenant_id,
    actor_id,
    target_user_id,
    target_email,
    target_full_name,
    target_role,
    deletion_reason,
    related_data_counts
  ) values (
    acting_tenant_id,
    auth.uid(),
    requested_user_id,
    coalesce(target_profile.email, target_auth_email),
    target_profile.full_name,
    target_profile.role,
    btrim(requested_reason),
    related_counts
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

-- ------------------------------------------------------------
-- 8. 账号管理同步：profiles 过渡字段改同步到成员的默认租户
--    （原实现只同步 PUFFY，导致其他租户改角色/状态不生效）
-- ------------------------------------------------------------
create or replace function private.sync_profile_to_bootstrap_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_tenant_id uuid;
begin
  if old.role is not distinct from new.role
     and old.status is not distinct from new.status
     and old.membership_tier is not distinct from new.membership_tier then
    return new;
  end if;

  target_tenant_id := private.default_tenant_of(new.id);
  if target_tenant_id is null then
    return new;
  end if;

  update public.tenant_memberships as membership
  set role = case
        when new.role in ('student', 'teacher', 'admin', 'ceo', 'super_admin') then new.role
        else 'student'
      end,
      status = case
        when coalesce(new.status, 'active') = 'active' then 'active'
        else 'suspended'
      end,
      membership_tier = case
        when new.membership_tier in ('normal', 'vip1', 'vip2', 'vip3') then new.membership_tier
        else 'normal'
      end,
      is_default = case
        when coalesce(new.status, 'active') <> 'active' then false
        when membership.is_default then true
        else not exists (
          select 1
          from public.tenant_memberships as other
          where other.user_id = new.id
            and other.tenant_id <> membership.tenant_id
            and other.status = 'active'
            and other.is_default
        )
      end,
      updated_at = now()
  where membership.tenant_id = target_tenant_id
    and membership.user_id = new.id;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 9. 永久删除租户：先清空业务数据（业务表外键为 on delete restrict）
-- ------------------------------------------------------------
create or replace function public.delete_tenant_permanently(requested_tenant_id uuid, requested_slug_confirmation text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.tenants%rowtype;
  removed_members integer := 0;
  business_table text;
begin
  if not private.is_platform_tenant_manager() then raise exception '只有负责人或副负责人可以永久删除租户'; end if;
  select * into target from public.tenants where id = requested_tenant_id for update;
  if not found then raise exception '租户不存在'; end if;
  if target.id = '00000000-0000-4000-8000-000000000001'::uuid then raise exception '默认 PUFFY 租户不能永久删除'; end if;
  if target.status not in ('suspended', 'archived') then raise exception '请先停用租户，再执行永久删除'; end if;
  if lower(btrim(requested_slug_confirmation)) <> target.slug then raise exception '删除确认租户标识不正确'; end if;

  perform set_config('app.tenant_hard_delete', 'on', true);

  -- 子表在前、父表在后，避免 restrict/复合外键阻塞。
  foreach business_table in array array[
    'student_visa_task_events','student_visa_tasks','student_visa_cases',
    'student_application_documents','student_university_assessments',
    'student_university_comparisons','student_university_targets',
    'learning_submission_answers','learning_submissions',
    'learning_assignment_question_keys','learning_assignment_targets',
    'learning_assignment_questions','grade_review_requests','grade_records',
    'grade_items','learning_assignments',
    'help_ticket_messages','help_tickets','help_articles',
    'conversation_practice_progress','conversation_practice_scenarios',
    'library_downloads','library_favorites','library_resources',
    'learning_record_notes','announcements',
    'announcement_admin_assignments','conversation_practice_admin_assignments',
    'help_center_admin_assignments','grade_center_admin_assignments',
    'learning_record_admin_assignments','library_admin_assignments',
    'lesson_progress','lesson_questions','lesson_resources','lessons',
    'courses','course_categories',
    'ai_token_usage','account_management_audit_logs','account_deletion_audit_logs',
    'course_content_audit_logs','student_service_card_deletion_logs'
  ]
  loop
    execute format('delete from public.%I where tenant_id = $1', business_table) using target.id;
  end loop;

  delete from public.tenant_provisioned_accounts where tenant_id = target.id;
  delete from public.tenant_memberships where tenant_id = target.id;
  get diagnostics removed_members = row_count;
  delete from public.tenant_membership_audit_logs where tenant_id = target.id;
  delete from public.tenants where id = target.id;
  insert into public.tenant_lifecycle_audit_logs (tenant_id, tenant_slug, actor_id, action, details)
  values (target.id, target.slug, auth.uid(), 'permanently_deleted', jsonb_build_object('removed_memberships', removed_members));
end;
$$;

comment on function public.delete_tenant_permanently(uuid, text) is
  '永久删除租户：先清空该租户全部业务数据，再删成员关系与租户本体';

commit;
