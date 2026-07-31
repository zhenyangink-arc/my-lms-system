begin;

-- 平台标准题库管理员授权。平台负责人永久拥有权限；这里只记录其亲自授权的平台副负责人。
create table if not exists public.question_bank_admin_assignments (
  admin_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  check (
    (revoked_at is null and revoked_by is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

alter table public.question_bank_admin_assignments enable row level security;

create or replace function private.can_manage_standard_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_owner()
    or exists (
      select 1
      from public.question_bank_admin_assignments as assignment
      join public.profiles as profile on profile.id = assignment.admin_id
      where assignment.admin_id = (select auth.uid())
        and assignment.revoked_at is null
        and profile.global_role = 'platform_deputy'
        and profile.role = 'tenant_operator'
        and coalesce(profile.status, 'active') = 'active'
    );
$$;

create or replace function public.current_user_can_manage_standard_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_standard_question_bank();
$$;

create or replace function public.current_user_can_use_standard_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_standard_question_bank()
    or (
      private.current_tenant_id() is not null
      and public.is_active_account()
      and public.current_profile_role() in ('tenant_super_admin', 'ceo', 'admin')
    );
$$;

revoke all on function private.can_manage_standard_question_bank() from public;
grant execute on function private.can_manage_standard_question_bank()
  to authenticated, service_role;
revoke all on function public.current_user_can_manage_standard_question_bank() from public;
grant execute on function public.current_user_can_manage_standard_question_bank()
  to authenticated, service_role;
revoke all on function public.current_user_can_use_standard_question_bank() from public;
grant execute on function public.current_user_can_use_standard_question_bank()
  to authenticated, service_role;

drop policy if exists "question bank assignments visible to owner or assignee"
  on public.question_bank_admin_assignments;
create policy "question bank assignments visible to owner or assignee"
on public.question_bank_admin_assignments for select to authenticated
using (
  (select private.is_platform_owner())
  or admin_id = (select auth.uid())
);

revoke all on public.question_bank_admin_assignments from anon, authenticated;
grant select on public.question_bank_admin_assignments to authenticated;
grant select, insert, update, delete on public.question_bank_admin_assignments
  to service_role;

-- 将现有四章测试题扩展为统一标准题库。题目仍保留所属课程/章节，
-- 但同时支持作业常用题型、默认分值、难度、标签、版本和发布状态。
alter table public.course_test_questions
  add column if not exists question_type text not null default 'single_choice',
  add column if not exists correct_answer text,
  add column if not exists default_points numeric(8,2) not null default 10,
  add column if not exists difficulty text not null default 'foundation',
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'published',
  add column if not exists version integer not null default 1,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.course_test_questions
  alter column correct_option drop not null;

alter table public.course_test_questions
  drop constraint if exists course_test_questions_options_check,
  drop constraint if exists course_test_questions_answer_in_options_check,
  drop constraint if exists course_test_questions_question_type_check,
  drop constraint if exists course_test_questions_default_points_check,
  drop constraint if exists course_test_questions_difficulty_check,
  drop constraint if exists course_test_questions_tags_check,
  drop constraint if exists course_test_questions_status_check,
  drop constraint if exists course_test_questions_version_check,
  add constraint course_test_questions_options_check
    check (jsonb_typeof(options) = 'array'),
  add constraint course_test_questions_question_type_check
    check (
      question_type in ('short_text', 'long_text', 'single_choice', 'file_link')
    ),
  add constraint course_test_questions_default_points_check
    check (default_points > 0 and default_points <= 1000),
  add constraint course_test_questions_difficulty_check
    check (difficulty in ('foundation', 'easy', 'medium', 'hard')),
  add constraint course_test_questions_tags_check
    check (jsonb_typeof(tags) = 'array'),
  add constraint course_test_questions_status_check
    check (status in ('draft', 'published', 'archived')),
  add constraint course_test_questions_version_check
    check (version > 0),
  add constraint course_test_questions_answer_in_options_check
    check (
      (
        question_type = 'single_choice'
        and jsonb_array_length(options) >= 2
        and correct_option is not null
        and correct_option >= 0
        and correct_option < jsonb_array_length(options)
      )
      or (
        question_type <> 'single_choice'
        and jsonb_array_length(options) = 0
        and correct_option is null
      )
    );

create index if not exists course_test_questions_bank_filter_idx
  on public.course_test_questions (
    status,
    difficulty,
    test_id,
    sort_order
  );

drop policy if exists "standard question groups are readable by authorized staff"
  on public.course_tests;
create policy "standard question groups are readable by authorized staff"
on public.course_tests for select to authenticated
using (
  (select private.can_manage_standard_question_bank())
  or (
    status = 'published'
    and (select public.current_user_can_use_standard_question_bank())
  )
);

drop policy if exists "platform question bank managers create groups"
  on public.course_tests;
create policy "platform question bank managers create groups"
on public.course_tests for insert to authenticated
with check ((select private.can_manage_standard_question_bank()));

drop policy if exists "platform question bank managers update groups"
  on public.course_tests;
create policy "platform question bank managers update groups"
on public.course_tests for update to authenticated
using ((select private.can_manage_standard_question_bank()))
with check ((select private.can_manage_standard_question_bank()));

drop policy if exists "platform question bank managers delete groups"
  on public.course_tests;
create policy "platform question bank managers delete groups"
on public.course_tests for delete to authenticated
using ((select private.can_manage_standard_question_bank()));

drop policy if exists "standard questions are readable by authorized staff"
  on public.course_test_questions;
create policy "standard questions are readable by authorized staff"
on public.course_test_questions for select to authenticated
using (
  (select private.can_manage_standard_question_bank())
  or (
    status = 'published'
    and (select public.current_user_can_use_standard_question_bank())
    and exists (
      select 1
      from public.course_tests as test
      where test.id = test_id
        and test.status = 'published'
    )
  )
);

drop policy if exists "platform question bank managers create questions"
  on public.course_test_questions;
create policy "platform question bank managers create questions"
on public.course_test_questions for insert to authenticated
with check ((select private.can_manage_standard_question_bank()));

drop policy if exists "platform question bank managers update questions"
  on public.course_test_questions;
create policy "platform question bank managers update questions"
on public.course_test_questions for update to authenticated
using ((select private.can_manage_standard_question_bank()))
with check ((select private.can_manage_standard_question_bank()));

drop policy if exists "platform question bank managers delete questions"
  on public.course_test_questions;
create policy "platform question bank managers delete questions"
on public.course_test_questions for delete to authenticated
using ((select private.can_manage_standard_question_bank()));

revoke all on public.course_tests from anon, authenticated;
revoke all on public.course_test_questions from anon, authenticated;
grant select, insert, update, delete on public.course_tests to authenticated;
grant select, insert, update, delete on public.course_test_questions to authenticated;

-- 只有平台负责人能授予或收回题库管理权。
create or replace function public.grant_question_bank_admin(p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以授权题库管理员';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_admin_id
      and profile.global_role = 'platform_deputy'
      and profile.role = 'tenant_operator'
      and coalesce(profile.status, 'active') = 'active'
  ) then
    raise exception '只能授权正常状态的平台副负责人';
  end if;

  insert into public.question_bank_admin_assignments (
    admin_id,
    granted_by,
    granted_at,
    revoked_at,
    revoked_by
  )
  values (
    p_admin_id,
    auth.uid(),
    now(),
    null,
    null
  )
  on conflict (admin_id) do update set
    granted_by = excluded.granted_by,
    granted_at = excluded.granted_at,
    revoked_at = null,
    revoked_by = null;
end;
$$;

create or replace function public.revoke_question_bank_admin(p_admin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_owner() then
    raise exception '只有平台负责人可以收回题库管理员权限';
  end if;

  update public.question_bank_admin_assignments
  set revoked_at = now(),
      revoked_by = auth.uid()
  where admin_id = p_admin_id
    and revoked_at is null;
end;
$$;

revoke all on function public.grant_question_bank_admin(uuid) from public;
grant execute on function public.grant_question_bank_admin(uuid) to authenticated;
revoke all on function public.revoke_question_bank_admin(uuid) from public;
grant execute on function public.revoke_question_bank_admin(uuid) to authenticated;

-- 平台题库维护统一走数据库函数；版本号由数据库递增。
create or replace function public.save_standard_question(
  p_question_id uuid,
  p_test_id uuid,
  p_question_type text,
  p_prompt text,
  p_options jsonb,
  p_correct_option integer,
  p_correct_answer text,
  p_explanation text,
  p_skill text,
  p_default_points numeric,
  p_difficulty text,
  p_tags jsonb,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_sort_order integer;
  v_current_test_id uuid;
begin
  if not private.can_manage_standard_question_bank() then
    raise exception '当前账号没有标准题库编辑权限';
  end if;

  p_prompt := btrim(coalesce(p_prompt, ''));
  p_explanation := btrim(coalesce(p_explanation, ''));
  p_skill := btrim(coalesce(p_skill, ''));
  p_correct_answer := nullif(btrim(coalesce(p_correct_answer, '')), '');
  p_options := coalesce(p_options, '[]'::jsonb);
  p_tags := coalesce(p_tags, '[]'::jsonb);

  if not exists (
    select 1 from public.course_tests where id = p_test_id
  ) then
    raise exception '所选课程章节不存在';
  end if;
  if p_question_type not in ('short_text', 'long_text', 'single_choice', 'file_link') then
    raise exception '题型不正确';
  end if;
  if char_length(p_prompt) not between 1 and 3000 then
    raise exception '题目不能为空且不能超过 3000 个字';
  end if;
  if char_length(p_explanation) > 3000 then
    raise exception '解析不能超过 3000 个字';
  end if;
  if char_length(p_skill) not between 1 and 80 then
    raise exception '知识点需要填写 1 至 80 个字';
  end if;
  if p_default_points is null or p_default_points <= 0 or p_default_points > 1000 then
    raise exception '默认分值需要大于 0 且不超过 1000';
  end if;
  if p_difficulty not in ('foundation', 'easy', 'medium', 'hard') then
    raise exception '难度不正确';
  end if;
  if p_status not in ('draft', 'published', 'archived') then
    raise exception '发布状态不正确';
  end if;
  if jsonb_typeof(p_tags) <> 'array' then
    raise exception '标签格式不正确';
  end if;

  if p_question_type = 'single_choice' then
    if jsonb_typeof(p_options) <> 'array'
      or jsonb_array_length(p_options) < 2 then
      raise exception '选择题至少需要两个选项';
    end if;
    if p_correct_option is null
      or p_correct_option < 0
      or p_correct_option >= jsonb_array_length(p_options) then
      raise exception '请选择正确答案';
    end if;
    p_correct_answer := null;
  else
    p_options := '[]'::jsonb;
    p_correct_option := null;
  end if;

  if p_question_id is null then
    select coalesce(max(question.sort_order), 0) + 1
    into v_sort_order
    from public.course_test_questions as question
    where question.test_id = p_test_id;

    insert into public.course_test_questions (
      test_id,
      question_key,
      prompt,
      options,
      correct_option,
      correct_answer,
      explanation,
      skill,
      sort_order,
      question_type,
      default_points,
      difficulty,
      tags,
      status,
      version,
      created_by,
      updated_by
    )
    values (
      p_test_id,
      'bank-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
      p_prompt,
      p_options,
      p_correct_option,
      p_correct_answer,
      p_explanation,
      p_skill,
      v_sort_order,
      p_question_type,
      p_default_points,
      p_difficulty,
      p_tags,
      p_status,
      1,
      auth.uid(),
      auth.uid()
    )
    returning id into v_question_id;
  else
    select question.test_id
    into v_current_test_id
    from public.course_test_questions as question
    where question.id = p_question_id;

    if not found then
      raise exception '题目不存在';
    end if;

    if v_current_test_id <> p_test_id then
      select coalesce(max(question.sort_order), 0) + 1
      into v_sort_order
      from public.course_test_questions as question
      where question.test_id = p_test_id;
    else
      select question.sort_order
      into v_sort_order
      from public.course_test_questions as question
      where question.id = p_question_id;
    end if;

    update public.course_test_questions
    set test_id = p_test_id,
        prompt = p_prompt,
        options = p_options,
        correct_option = p_correct_option,
        correct_answer = p_correct_answer,
        explanation = p_explanation,
        skill = p_skill,
        sort_order = v_sort_order,
        question_type = p_question_type,
        default_points = p_default_points,
        difficulty = p_difficulty,
        tags = p_tags,
        status = p_status,
        version = version + 1,
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_question_id
    returning id into v_question_id;
  end if;

  return v_question_id;
end;
$$;

create or replace function public.delete_standard_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_standard_question_bank() then
    raise exception '当前账号没有标准题库删除权限';
  end if;

  delete from public.course_test_questions
  where id = p_question_id;

  if not found then
    raise exception '题目不存在';
  end if;
end;
$$;

revoke all on function public.save_standard_question(
  uuid, uuid, text, text, jsonb, integer, text, text, text,
  numeric, text, jsonb, text
) from public;
grant execute on function public.save_standard_question(
  uuid, uuid, text, text, jsonb, integer, text, text, text,
  numeric, text, jsonb, text
) to authenticated;
revoke all on function public.delete_standard_question(uuid) from public;
grant execute on function public.delete_standard_question(uuid) to authenticated;

-- 作业保存题目来源及版本；正文、答案和解析仍复制成快照，防止题库后续更新
-- 改变已经发布给学生的作业。
alter table public.learning_assignment_questions
  add column if not exists source_bank_question_id uuid
    references public.course_test_questions(id) on delete set null,
  add column if not exists source_bank_version integer;

create index if not exists learning_assignment_questions_source_bank_idx
  on public.learning_assignment_questions (source_bank_question_id);

create or replace function public.create_learning_assignment_from_bank(
  p_title text,
  p_description text,
  p_assignment_type text,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_due_at timestamptz,
  p_duration_minutes integer,
  p_allow_resubmission boolean,
  p_publish boolean,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_assignment_id uuid;
  v_selection jsonb;
  v_bank_question public.course_test_questions%rowtype;
  v_question_id uuid;
  v_bank_question_id uuid;
  v_points numeric(8,2);
  v_total_points numeric(8,2) := 0;
  v_sort_order integer := 0;
  v_correct_answer text;
  v_target_count integer;
  v_expected_target_count integer;
  v_seen_ids uuid[] := array[]::uuid[];
begin
  if v_tenant_id is null
    or not public.current_user_can_use_standard_question_bank() then
    raise exception '当前账号没有使用标准题库布置任务的权限';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_title) not between 2 and 120 then
    raise exception '标题需要填写 2 至 120 个字';
  end if;
  if char_length(p_description) > 5000 then
    raise exception '任务说明不能超过 5000 个字';
  end if;
  if p_assignment_type not in ('homework', 'exam') then
    raise exception '任务类型只能是作业或考试';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception '截止时间必须晚于当前时间';
  end if;
  if p_duration_minutes is not null
    and p_duration_minutes not between 1 and 600 then
    raise exception '建议用时需要在 1 至 600 分钟之间';
  end if;
  if p_course_id is not null and not exists (
    select 1
    from public.courses
    where id = p_course_id
      and tenant_id = v_tenant_id
  ) then
    raise exception '所选课程不存在';
  end if;
  if p_questions is null
    or jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception '请从标准题库选择 1 至 50 道题目';
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
      and membership.tenant_id = v_tenant_id
      and membership.role = 'student'
      and membership.status = 'active';

    if v_target_count <> v_expected_target_count then
      raise exception '分配名单中包含无效学生账号';
    end if;
  end if;

  insert into public.learning_assignments (
    tenant_id,
    title,
    description,
    assignment_type,
    course_id,
    target_scope,
    due_at,
    duration_minutes,
    allow_resubmission,
    status,
    published_at,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    p_title,
    p_description,
    p_assignment_type,
    p_course_id,
    p_target_scope,
    p_due_at,
    p_duration_minutes,
    coalesce(p_allow_resubmission, false),
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() else null end,
    auth.uid(),
    auth.uid()
  )
  returning id into v_assignment_id;

  for v_selection in
    select value from jsonb_array_elements(p_questions)
  loop
    begin
      v_bank_question_id := (v_selection ->> 'questionId')::uuid;
      v_points := (v_selection ->> 'points')::numeric;
    exception
      when others then
        raise exception '选题数据格式不正确';
    end;

    if v_bank_question_id = any(v_seen_ids) then
      raise exception '不能重复选择同一道题';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_bank_question_id);

    if v_points <= 0 or v_points > 1000 then
      raise exception '第 % 题分值需要大于 0 且不超过 1000', v_sort_order + 1;
    end if;

    select question.*
    into v_bank_question
    from public.course_test_questions as question
    join public.course_tests as test on test.id = question.test_id
    where question.id = v_bank_question_id
      and question.status = 'published'
      and test.status = 'published';

    if not found then
      raise exception '第 % 道标准题不存在或尚未发布', v_sort_order + 1;
    end if;

    insert into public.learning_assignment_questions (
      tenant_id,
      assignment_id,
      question_type,
      prompt,
      options,
      points,
      sort_order,
      source_bank_question_id,
      source_bank_version
    )
    values (
      v_tenant_id,
      v_assignment_id,
      v_bank_question.question_type,
      v_bank_question.prompt,
      v_bank_question.options,
      v_points,
      v_sort_order,
      v_bank_question.id,
      v_bank_question.version
    )
    returning id into v_question_id;

    v_correct_answer := case
      when v_bank_question.question_type = 'single_choice'
        then v_bank_question.options ->> v_bank_question.correct_option
      else v_bank_question.correct_answer
    end;

    if v_correct_answer is not null or v_bank_question.explanation <> '' then
      insert into public.learning_assignment_question_keys (
        tenant_id,
        question_id,
        correct_answer,
        explanation,
        updated_by
      )
      values (
        v_tenant_id,
        v_question_id,
        v_correct_answer,
        nullif(v_bank_question.explanation, ''),
        auth.uid()
      );
    end if;

    v_total_points := v_total_points + v_points;
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.learning_assignments
  set total_points = v_total_points
  where id = v_assignment_id
    and tenant_id = v_tenant_id;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (
      tenant_id,
      assignment_id,
      student_id
    )
    select v_tenant_id, v_assignment_id, value::uuid
    from unnest(p_target_ids) as value
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$$;

-- 关闭旧的“把任意题干和答案从浏览器传入数据库”入口。
revoke all on function public.create_learning_assignment(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) from public;
grant execute on function public.create_learning_assignment(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) to service_role;

revoke all on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) from public;
grant execute on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) to authenticated;

-- 章节测试只使用已发布的单选题；判分仍在数据库内部完成。
create or replace function public.submit_course_test(
  p_test_slug text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_test public.course_tests%rowtype;
  v_question public.course_test_questions%rowtype;
  v_selected integer;
  v_correct boolean;
  v_correct_count integer := 0;
  v_total_questions integer := 0;
  v_score integer;
  v_passed boolean;
  v_results jsonb := '[]'::jsonb;
  v_dimensions jsonb := '{}'::jsonb;
  v_dimension_scores jsonb := '{}'::jsonb;
  v_dimension_key text;
  v_dimension_value jsonb;
  v_dimension_correct integer;
  v_dimension_total integer;
  v_attempt_id uuid;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再提交测试';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception '答案格式不正确';
  end if;

  select *
  into v_test
  from public.course_tests
  where slug = p_test_slug
    and status = 'published';

  if not found then
    raise exception '没有找到这份章节测试';
  end if;

  select count(*)
  into v_total_questions
  from public.course_test_questions
  where test_id = v_test.id
    and status = 'published'
    and question_type = 'single_choice';

  if v_total_questions = 0
    or (select count(*) from jsonb_object_keys(p_answers)) <> v_total_questions then
    raise exception '请完成全部题目后再交卷';
  end if;

  for v_question in
    select *
    from public.course_test_questions
    where test_id = v_test.id
      and status = 'published'
      and question_type = 'single_choice'
    order by sort_order
  loop
    if not (p_answers ? v_question.question_key) then
      raise exception '请完成全部题目后再交卷';
    end if;

    begin
      v_selected := (p_answers ->> v_question.question_key)::integer;
    exception
      when invalid_text_representation then
        raise exception '有一道题的答案格式不正确';
    end;

    if v_selected < 0
      or v_selected >= jsonb_array_length(v_question.options) then
      raise exception '有一道题的选项不正确';
    end if;

    v_correct := v_selected = v_question.correct_option;
    if v_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_dimension_correct :=
      coalesce((v_dimensions -> v_question.skill ->> 'correct')::integer, 0)
      + case when v_correct then 1 else 0 end;
    v_dimension_total :=
      coalesce((v_dimensions -> v_question.skill ->> 'total')::integer, 0) + 1;
    v_dimensions := jsonb_set(
      v_dimensions,
      array[v_question.skill],
      jsonb_build_object(
        'label', coalesce(v_test.skills ->> v_question.skill, v_question.skill),
        'correct', v_dimension_correct,
        'total', v_dimension_total
      ),
      true
    );

    v_results := v_results || jsonb_build_array(
      jsonb_build_object(
        'id', v_question.question_key,
        'selectedOption', v_selected,
        'correctOption', v_question.correct_option,
        'correct', v_correct,
        'explanation', v_question.explanation
      )
    );
  end loop;

  v_score := round(
    (v_correct_count::numeric / v_total_questions::numeric) * 100
  );
  v_passed := v_score >= v_test.passing_score;

  for v_dimension_key, v_dimension_value in
    select key, value from jsonb_each(v_dimensions)
  loop
    v_dimension_correct := (v_dimension_value ->> 'correct')::integer;
    v_dimension_total := (v_dimension_value ->> 'total')::integer;
    v_dimension_scores := jsonb_set(
      v_dimension_scores,
      array[v_dimension_key],
      v_dimension_value || jsonb_build_object(
        'percent',
        round(
          (v_dimension_correct::numeric / v_dimension_total::numeric) * 100
        )
      ),
      true
    );
  end loop;

  insert into public.course_test_attempts (
    tenant_id,
    student_id,
    test_id,
    test_slug,
    test_version,
    score,
    correct_count,
    total_questions,
    passed,
    answers,
    dimension_scores
  )
  values (
    v_tenant_id,
    v_user_id,
    v_test.id,
    v_test.slug,
    v_test.version,
    v_score,
    v_correct_count,
    v_total_questions,
    v_passed,
    p_answers,
    v_dimension_scores
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'score', v_score,
    'correctCount', v_correct_count,
    'totalQuestions', v_total_questions,
    'passed', v_passed,
    'dimensionScores', v_dimension_scores,
    'questions', v_results
  );
end;
$$;

revoke all on function public.submit_course_test(text, jsonb) from public;
grant execute on function public.submit_course_test(text, jsonb) to authenticated;

comment on table public.course_test_questions is
  '平台统一维护的标准题库；租户管理层只读并通过题目 ID 选用，学生不可访问。';
comment on table public.question_bank_admin_assignments is
  '平台负责人指定的标准题库管理员；与租户管理员权限完全分离。';
comment on function public.create_learning_assignment_from_bank(
  text, text, text, uuid, text, uuid[], timestamptz,
  integer, boolean, boolean, jsonb
) is
  '租户管理层只能按标准题目 ID 创建作业快照，不能从客户端提交或篡改题干、答案和解析。';

commit;
