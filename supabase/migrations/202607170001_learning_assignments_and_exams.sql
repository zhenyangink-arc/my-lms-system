-- ============================================================
-- 作业与考试：任务、题目、定向学生、提交版本与批改闭环
-- 管理角色：teacher / admin / ceo / super_admin
-- 学生只能读取发布给自己的任务，以及自己的提交与成绩。
-- 所有写操作通过受控 RPC 完成，表本身只向登录用户开放读取。
-- ============================================================

create table if not exists public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  assignment_type text not null check (assignment_type in ('homework', 'quiz', 'exam')),
  course_id uuid references public.courses(id) on delete set null,
  target_scope text not null default 'all_students' check (target_scope in ('all_students', 'selected_students')),
  total_points numeric(8,2) not null default 0 check (total_points >= 0),
  due_at timestamptz not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 600),
  allow_resubmission boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.learning_assignments(id) on delete cascade,
  question_type text not null check (question_type in ('short_text', 'long_text', 'single_choice', 'file_link')),
  prompt text not null check (char_length(prompt) between 1 and 3000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  points numeric(8,2) not null check (points > 0 and points <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (assignment_id, sort_order)
);

-- 参考答案与解析单独存放，避免学生查询题目时读取到答案。
create table if not exists public.learning_assignment_question_keys (
  question_id uuid primary key references public.learning_assignment_questions(id) on delete cascade,
  correct_answer text,
  explanation text check (char_length(explanation) <= 3000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_assignment_targets (
  assignment_id uuid not null references public.learning_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create table if not exists public.learning_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.learning_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'submitted' check (status in ('submitted', 'graded', 'revision_required')),
  score numeric(8,2) check (score is null or score >= 0),
  overall_feedback text check (char_length(overall_feedback) <= 3000),
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  graded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id, attempt_number)
);

create table if not exists public.learning_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.learning_submissions(id) on delete cascade,
  question_id uuid not null references public.learning_assignment_questions(id) on delete cascade,
  answer_text text not null check (char_length(answer_text) between 1 and 10000),
  awarded_points numeric(8,2) check (awarded_points is null or awarded_points >= 0),
  grader_feedback text check (char_length(grader_feedback) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id)
);

create index if not exists learning_assignments_status_due_idx
  on public.learning_assignments (status, due_at);
create index if not exists learning_assignment_questions_order_idx
  on public.learning_assignment_questions (assignment_id, sort_order);
create index if not exists learning_assignment_targets_student_idx
  on public.learning_assignment_targets (student_id, assignment_id);
create index if not exists learning_submissions_assignment_status_idx
  on public.learning_submissions (assignment_id, status, submitted_at desc);
create index if not exists learning_submissions_student_idx
  on public.learning_submissions (student_id, submitted_at desc);
create index if not exists learning_submission_answers_submission_idx
  on public.learning_submission_answers (submission_id);

create or replace function public.current_user_is_assignment_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and coalesce(status, 'active') = 'active'
      and role in ('teacher', 'admin', 'ceo', 'super_admin')
  );
$$;

create or replace function public.current_user_can_view_learning_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_is_assignment_manager()
    or exists (
      select 1
      from public.learning_assignments as assignment
      join public.profiles as viewer on viewer.id = auth.uid()
      where assignment.id = p_assignment_id
        and assignment.status = 'published'
        and viewer.role = 'student'
        and coalesce(viewer.status, 'active') = 'active'
        and (
          assignment.target_scope = 'all_students'
          or exists (
            select 1
            from public.learning_assignment_targets as target
            where target.assignment_id = assignment.id
              and target.student_id = auth.uid()
          )
        )
    );
$$;

create or replace function public.current_user_can_submit_learning_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and exists (
      select 1
      from public.learning_assignments
      where id = p_assignment_id
        and status = 'published'
        and due_at >= now()
    )
    and exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'student'
        and coalesce(status, 'active') = 'active'
    );
$$;

create or replace function public.list_learning_assignment_students()
returns table (id uuid, full_name text, email text, membership_tier text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;

  return query
    select profile.id, profile.full_name, profile.email, profile.membership_tier
    from public.profiles as profile
    where profile.role = 'student'
      and coalesce(profile.status, 'active') = 'active'
    order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.create_learning_assignment(
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
set search_path = public
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
  if p_course_id is not null and not exists (select 1 from public.courses where id = p_course_id) then
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
    from public.profiles
    where id = any(p_target_ids)
      and role = 'student'
      and coalesce(status, 'active') = 'active';
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

create or replace function public.change_learning_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;
  if p_status not in ('draft', 'published', 'closed') then
    raise exception '任务状态不正确';
  end if;
  if p_status = 'published' and exists (
    select 1 from public.learning_assignments where id = p_assignment_id and due_at <= now()
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
  where id = p_assignment_id;

  if not found then raise exception '任务不存在'; end if;
end;
$$;

create or replace function public.update_learning_assignment_deadline(
  p_assignment_id uuid,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_is_assignment_manager() then
    raise exception '当前账号没有教学管理权限';
  end if;
  if p_due_at is null or p_due_at <= now() then
    raise exception '新的截止时间必须晚于当前时间';
  end if;

  update public.learning_assignments
  set due_at = p_due_at,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_assignment_id;
  if not found then raise exception '任务不存在'; end if;
end;
$$;

create or replace function public.submit_learning_assignment(
  p_assignment_id uuid,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_previous_status text;
  v_allow_resubmission boolean;
  v_attempt integer;
  v_answer jsonb;
  v_question_id uuid;
  v_answer_text text;
  v_question_type text;
  v_options jsonb;
  v_question_count integer;
  v_answer_count integer;
begin
  if not public.current_user_can_submit_learning_assignment(p_assignment_id) then
    raise exception '任务不可提交，可能尚未发布、已截止或未分配给当前账号';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception '答案格式不正确';
  end if;

  select allow_resubmission into v_allow_resubmission
  from public.learning_assignments where id = p_assignment_id;

  select status, attempt_number
    into v_previous_status, v_attempt
  from public.learning_submissions
  where assignment_id = p_assignment_id and student_id = auth.uid()
  order by attempt_number desc
  limit 1;

  if found and v_previous_status <> 'revision_required' and not v_allow_resubmission then
    raise exception '该任务不允许重复提交';
  end if;
  v_attempt := coalesce(v_attempt, 0) + 1;

  select count(*) into v_question_count
  from public.learning_assignment_questions where assignment_id = p_assignment_id;
  select count(distinct (value->>'questionId')) into v_answer_count
  from jsonb_array_elements(p_answers);
  if v_question_count = 0 or v_answer_count <> v_question_count then
    raise exception '请完成全部题目后再提交';
  end if;

  insert into public.learning_submissions (
    assignment_id, student_id, attempt_number, status, submitted_at
  ) values (
    p_assignment_id, auth.uid(), v_attempt, 'submitted', now()
  ) returning id into v_submission_id;

  for v_answer in select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_question_id := (v_answer->>'questionId')::uuid;
    exception when others then
      raise exception '答案中包含无效题目';
    end;
    v_answer_text := btrim(coalesce(v_answer->>'answer', ''));
    if char_length(v_answer_text) not between 1 and 10000 then
      raise exception '每道题都需要作答，单题答案不能超过 10000 个字';
    end if;

    select question_type, options into v_question_type, v_options
    from public.learning_assignment_questions
    where id = v_question_id and assignment_id = p_assignment_id;
    if not found then raise exception '答案中包含不属于本任务的题目'; end if;
    if v_question_type = 'single_choice'
       and not exists (select 1 from jsonb_array_elements_text(v_options) as option where option = v_answer_text) then
      raise exception '选择题答案不在有效选项中';
    end if;
    if v_question_type = 'file_link'
       and v_answer_text !~* '^https?://[^[:space:]]+$' then
      raise exception '附件链接需要使用完整的 http 或 https 地址';
    end if;

    insert into public.learning_submission_answers (
      submission_id, question_id, answer_text
    ) values (
      v_submission_id, v_question_id, v_answer_text
    );
  end loop;

  return v_submission_id;
end;
$$;

create or replace function public.grade_learning_submission(
  p_submission_id uuid,
  p_decision text,
  p_overall_feedback text,
  p_scores jsonb
)
returns void
language plpgsql
security definer
set search_path = public
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
  where id = p_submission_id;
  if not found then raise exception '提交记录不存在'; end if;
end;
$$;

alter table public.learning_assignments enable row level security;
alter table public.learning_assignment_questions enable row level security;
alter table public.learning_assignment_question_keys enable row level security;
alter table public.learning_assignment_targets enable row level security;
alter table public.learning_submissions enable row level security;
alter table public.learning_submission_answers enable row level security;

create policy "authorized users read learning assignments"
on public.learning_assignments for select to authenticated
using (public.current_user_can_view_learning_assignment(id));

create policy "authorized users read assignment questions"
on public.learning_assignment_questions for select to authenticated
using (public.current_user_can_view_learning_assignment(assignment_id));

create policy "managers read assignment answer keys"
on public.learning_assignment_question_keys for select to authenticated
using (public.current_user_is_assignment_manager());

create policy "managers or assigned students read targets"
on public.learning_assignment_targets for select to authenticated
using (public.current_user_is_assignment_manager() or student_id = auth.uid());

create policy "managers or owners read submissions"
on public.learning_submissions for select to authenticated
using (public.current_user_is_assignment_manager() or student_id = auth.uid());

create policy "managers or owners read submission answers"
on public.learning_submission_answers for select to authenticated
using (
  public.current_user_is_assignment_manager()
  or exists (
    select 1 from public.learning_submissions as submission
    where submission.id = learning_submission_answers.submission_id
      and submission.student_id = auth.uid()
  )
);

grant select on public.learning_assignments to authenticated;
grant select on public.learning_assignment_questions to authenticated;
grant select on public.learning_assignment_question_keys to authenticated;
grant select on public.learning_assignment_targets to authenticated;
grant select on public.learning_submissions to authenticated;
grant select on public.learning_submission_answers to authenticated;

revoke insert, update, delete on public.learning_assignments from authenticated;
revoke insert, update, delete on public.learning_assignment_questions from authenticated;
revoke insert, update, delete on public.learning_assignment_question_keys from authenticated;
revoke insert, update, delete on public.learning_assignment_targets from authenticated;
revoke insert, update, delete on public.learning_submissions from authenticated;
revoke insert, update, delete on public.learning_submission_answers from authenticated;

revoke all on function public.list_learning_assignment_students() from public, anon;
revoke all on function public.create_learning_assignment(text, text, text, uuid, text, uuid[], timestamptz, integer, boolean, boolean, jsonb) from public, anon;
revoke all on function public.change_learning_assignment_status(uuid, text) from public, anon;
revoke all on function public.update_learning_assignment_deadline(uuid, timestamptz) from public, anon;
revoke all on function public.submit_learning_assignment(uuid, jsonb) from public, anon;
revoke all on function public.grade_learning_submission(uuid, text, text, jsonb) from public, anon;

grant execute on function public.current_user_is_assignment_manager() to authenticated;
grant execute on function public.current_user_can_view_learning_assignment(uuid) to authenticated;
grant execute on function public.current_user_can_submit_learning_assignment(uuid) to authenticated;
grant execute on function public.list_learning_assignment_students() to authenticated;
grant execute on function public.create_learning_assignment(text, text, text, uuid, text, uuid[], timestamptz, integer, boolean, boolean, jsonb) to authenticated;
grant execute on function public.change_learning_assignment_status(uuid, text) to authenticated;
grant execute on function public.update_learning_assignment_deadline(uuid, timestamptz) to authenticated;
grant execute on function public.submit_learning_assignment(uuid, jsonb) to authenticated;
grant execute on function public.grade_learning_submission(uuid, text, text, jsonb) to authenticated;

comment on table public.learning_assignments is '作业、测验与考试主表';
comment on table public.learning_assignment_question_keys is '仅教学管理角色可见的参考答案和解析';
comment on table public.learning_submissions is '学生每次提交均保留独立版本';
comment on function public.submit_learning_assignment(uuid, jsonb) is '原子化校验并保存一次完整作答';
comment on function public.grade_learning_submission(uuid, text, text, jsonb) is '原子化保存逐题评分与总体批改结果';
