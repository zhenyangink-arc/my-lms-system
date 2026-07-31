-- ============================================================
-- 平台标准作业卷 / 考试卷
--
-- 权限边界：
-- 1. 仅平台负责人及其指定的标准题库管理员可以创建、复制和变更试卷状态。
-- 2. 机构教学管理人员只能读取平台已发布的整套试卷，并基于整卷创建发布记录。
-- 3. 机构不能读取试卷答案表，也不能逐题拼卷或修改试卷快照。
-- 4. 机构发布后，题目、答案、分值和顺序复制为租户任务快照。
-- ============================================================

create sequence if not exists public.assessment_paper_code_seq;

create table if not exists public.assessment_papers (
  id uuid primary key default gen_random_uuid(),
  paper_code text not null unique,
  paper_type text not null check (paper_type in ('homework', 'exam')),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  source_test_id uuid not null references public.course_tests(id) on delete restrict,
  duration_minutes integer check (
    duration_minutes is null or duration_minutes between 1 and 600
  ),
  passing_score numeric(5,2) check (
    passing_score is null or passing_score between 0 and 100
  ),
  allow_resubmission boolean not null default false,
  total_points numeric(8,2) not null default 0 check (total_points >= 0),
  question_count integer not null default 0 check (question_count >= 0),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired', 'archived')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.assessment_papers(id) on delete cascade,
  source_bank_question_id uuid references public.course_test_questions(id) on delete set null,
  source_bank_version integer not null check (source_bank_version > 0),
  question_type text not null
    check (question_type in ('short_text', 'long_text', 'single_choice', 'file_link')),
  prompt text not null check (char_length(prompt) between 1 and 3000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  points numeric(8,2) not null check (points > 0 and points <= 1000),
  sort_order integer not null check (sort_order >= 0),
  difficulty text not null
    check (difficulty in ('foundation', 'medium', 'hard', 'expert')),
  skill text not null default '',
  created_at timestamptz not null default now(),
  unique (paper_id, sort_order)
);

create table if not exists public.assessment_paper_question_keys (
  question_id uuid primary key
    references public.assessment_paper_questions(id) on delete cascade,
  correct_answer text,
  explanation text check (char_length(explanation) <= 3000),
  created_at timestamptz not null default now()
);

create index if not exists assessment_papers_catalog_idx
  on public.assessment_papers (paper_type, status, updated_at desc);
create index if not exists assessment_papers_source_test_idx
  on public.assessment_papers (source_test_id, paper_type, status);
create index if not exists assessment_paper_questions_order_idx
  on public.assessment_paper_questions (paper_id, sort_order);

alter table public.learning_assignments
  add column if not exists source_paper_id uuid
    references public.assessment_papers(id) on delete restrict,
  add column if not exists source_paper_code text,
  add column if not exists source_paper_version integer,
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists institution_note text not null default ''
    check (char_length(institution_note) <= 2000);

create index if not exists learning_assignments_source_paper_idx
  on public.learning_assignments (source_paper_id);
create index if not exists learning_assignments_start_due_idx
  on public.learning_assignments (tenant_id, status, starts_at, due_at);

create or replace function public.current_user_can_manage_assessment_papers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_standard_question_bank();
$$;

create or replace function public.current_user_can_publish_assessment_papers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_tenant_id() is not null
    and public.current_user_is_assignment_manager();
$$;

create or replace function public.current_user_can_view_assessment_papers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_manage_assessment_papers()
    or public.current_user_can_publish_assessment_papers();
$$;

revoke all on function public.current_user_can_manage_assessment_papers() from public;
grant execute on function public.current_user_can_manage_assessment_papers()
  to authenticated;
revoke all on function public.current_user_can_publish_assessment_papers() from public;
grant execute on function public.current_user_can_publish_assessment_papers()
  to authenticated;
revoke all on function public.current_user_can_view_assessment_papers() from public;
grant execute on function public.current_user_can_view_assessment_papers()
  to authenticated;

alter table public.assessment_papers enable row level security;
alter table public.assessment_paper_questions enable row level security;
alter table public.assessment_paper_question_keys enable row level security;

drop policy if exists "authorized staff read assessment papers"
  on public.assessment_papers;
create policy "authorized staff read assessment papers"
on public.assessment_papers for select to authenticated
using (
  public.current_user_can_manage_assessment_papers()
  or (
    status = 'published'
    and public.current_user_can_publish_assessment_papers()
  )
);

drop policy if exists "platform managers write assessment papers"
  on public.assessment_papers;
create policy "platform managers write assessment papers"
on public.assessment_papers for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

drop policy if exists "authorized staff read assessment paper questions"
  on public.assessment_paper_questions;
create policy "authorized staff read assessment paper questions"
on public.assessment_paper_questions for select to authenticated
using (
  exists (
    select 1
    from public.assessment_papers as paper
    where paper.id = assessment_paper_questions.paper_id
      and (
        public.current_user_can_manage_assessment_papers()
        or (
          paper.status = 'published'
          and public.current_user_can_publish_assessment_papers()
        )
      )
  )
);

drop policy if exists "platform managers write assessment paper questions"
  on public.assessment_paper_questions;
create policy "platform managers write assessment paper questions"
on public.assessment_paper_questions for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

drop policy if exists "platform managers read assessment paper keys"
  on public.assessment_paper_question_keys;
create policy "platform managers read assessment paper keys"
on public.assessment_paper_question_keys for select to authenticated
using (public.current_user_can_manage_assessment_papers());

drop policy if exists "platform managers write assessment paper keys"
  on public.assessment_paper_question_keys;
create policy "platform managers write assessment paper keys"
on public.assessment_paper_question_keys for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

revoke all on public.assessment_papers from anon, authenticated;
revoke all on public.assessment_paper_questions from anon, authenticated;
revoke all on public.assessment_paper_question_keys from anon, authenticated;
grant select on public.assessment_papers to authenticated;
grant select on public.assessment_paper_questions to authenticated;
grant select on public.assessment_paper_question_keys to authenticated;
grant select, insert, update, delete on public.assessment_papers to service_role;
grant select, insert, update, delete on public.assessment_paper_questions to service_role;
grant select, insert, update, delete on public.assessment_paper_question_keys to service_role;

-- 机构不再直接读取或使用平台标准题库；标准题库只服务平台组卷。
create or replace function public.current_user_can_use_standard_question_bank()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_standard_question_bank();
$$;

-- 机构只能读取已发布试卷关联的章节名称，不获得标准题目表访问权。
drop policy if exists "standard question groups are readable by authorized staff"
  on public.course_tests;
create policy "standard question groups are readable by authorized staff"
on public.course_tests for select to authenticated
using (
  status = 'published'
  and (
    public.current_user_can_manage_standard_question_bank()
    or public.current_user_can_publish_assessment_papers()
  )
);

create or replace function public.create_assessment_paper_from_bank(
  p_title text,
  p_description text,
  p_paper_type text,
  p_source_test_id uuid,
  p_duration_minutes integer,
  p_passing_score numeric,
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
  v_paper_id uuid;
  v_paper_code text;
  v_selection jsonb;
  v_bank_question public.course_test_questions%rowtype;
  v_paper_question_id uuid;
  v_bank_question_id uuid;
  v_points numeric(8,2);
  v_total_points numeric(8,2) := 0;
  v_sort_order integer := 0;
  v_correct_answer text;
  v_seen_ids uuid[] := array[]::uuid[];
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人或指定管理员可以创建标准试卷';
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_description := btrim(coalesce(p_description, ''));
  if char_length(p_title) not between 2 and 120 then
    raise exception '试卷名称需要填写 2 至 120 个字';
  end if;
  if char_length(p_description) > 5000 then
    raise exception '试卷说明不能超过 5000 个字';
  end if;
  if p_paper_type not in ('homework', 'exam') then
    raise exception '试卷类型只能是作业或考试';
  end if;
  if p_duration_minutes is not null
    and p_duration_minutes not between 1 and 600 then
    raise exception '建议用时需要在 1 至 600 分钟之间';
  end if;
  if p_passing_score is not null
    and p_passing_score not between 0 and 100 then
    raise exception '及格线需要在 0 至 100 之间';
  end if;
  if not exists (
    select 1
    from public.course_tests
    where id = p_source_test_id
      and status = 'published'
  ) then
    raise exception '所选题库章节不存在或尚未发布';
  end if;
  if p_questions is null
    or jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) not between 1 and 100 then
    raise exception '每套试卷需要选择 1 至 100 道题目';
  end if;

  v_paper_code :=
    case when p_paper_type = 'homework' then 'HW-' else 'EX-' end
    || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0');

  insert into public.assessment_papers (
    paper_code,
    paper_type,
    title,
    description,
    source_test_id,
    duration_minutes,
    passing_score,
    allow_resubmission,
    status,
    published_at,
    created_by,
    updated_by
  )
  values (
    v_paper_code,
    p_paper_type,
    p_title,
    p_description,
    p_source_test_id,
    p_duration_minutes,
    p_passing_score,
    coalesce(p_allow_resubmission, p_paper_type = 'homework'),
    case when p_publish then 'published' else 'draft' end,
    case when p_publish then now() else null end,
    auth.uid(),
    auth.uid()
  )
  returning id into v_paper_id;

  for v_selection in
    select value from jsonb_array_elements(p_questions)
  loop
    begin
      v_bank_question_id := (v_selection ->> 'questionId')::uuid;
      v_points := (v_selection ->> 'points')::numeric;
    exception when others then
      raise exception '试卷选题数据格式不正确';
    end;

    if v_bank_question_id = any(v_seen_ids) then
      raise exception '同一套试卷不能重复使用同一道题';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_bank_question_id);

    if v_points <= 0 or v_points > 1000 then
      raise exception '第 % 题分值需要大于 0 且不超过 1000', v_sort_order + 1;
    end if;

    select question.*
    into v_bank_question
    from public.course_test_questions as question
    where question.id = v_bank_question_id
      and question.test_id = p_source_test_id
      and question.status = 'published';

    if not found then
      raise exception '第 % 道标准题不存在、不属于所选章节或尚未发布', v_sort_order + 1;
    end if;

    insert into public.assessment_paper_questions (
      paper_id,
      source_bank_question_id,
      source_bank_version,
      question_type,
      prompt,
      options,
      points,
      sort_order,
      difficulty,
      skill
    )
    values (
      v_paper_id,
      v_bank_question.id,
      v_bank_question.version,
      v_bank_question.question_type,
      v_bank_question.prompt,
      v_bank_question.options,
      v_points,
      v_sort_order,
      v_bank_question.difficulty,
      v_bank_question.skill
    )
    returning id into v_paper_question_id;

    v_correct_answer := case
      when v_bank_question.question_type = 'single_choice'
        then v_bank_question.options ->> v_bank_question.correct_option
      else v_bank_question.correct_answer
    end;

    insert into public.assessment_paper_question_keys (
      question_id,
      correct_answer,
      explanation
    )
    values (
      v_paper_question_id,
      v_correct_answer,
      nullif(v_bank_question.explanation, '')
    );

    v_total_points := v_total_points + v_points;
    v_sort_order := v_sort_order + 1;
  end loop;

  update public.assessment_papers
  set total_points = v_total_points,
      question_count = v_sort_order,
      updated_at = now()
  where id = v_paper_id;

  return v_paper_id;
end;
$$;

create or replace function public.change_assessment_paper_status(
  p_paper_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人或指定管理员可以变更试卷状态';
  end if;
  if p_status not in ('draft', 'published', 'retired', 'archived') then
    raise exception '试卷状态不正确';
  end if;
  if p_status = 'published' and not exists (
    select 1
    from public.assessment_paper_questions
    where paper_id = p_paper_id
  ) then
    raise exception '空试卷不能发布';
  end if;

  update public.assessment_papers
  set status = p_status,
      published_at = case
        when p_status = 'published' and status <> 'published' then now()
        when p_status = 'draft' then null
        else published_at
      end,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_paper_id;

  if not found then
    raise exception '试卷不存在';
  end if;
end;
$$;

create or replace function public.duplicate_assessment_paper(
  p_paper_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.assessment_papers%rowtype;
  v_new_id uuid;
  v_new_code text;
begin
  if not public.current_user_can_manage_assessment_papers() then
    raise exception '只有平台负责人或指定管理员可以复制试卷';
  end if;

  select * into v_source
  from public.assessment_papers
  where id = p_paper_id;
  if not found then raise exception '试卷不存在'; end if;

  v_new_code :=
    case when v_source.paper_type = 'homework' then 'HW-' else 'EX-' end
    || lpad(nextval('public.assessment_paper_code_seq')::text, 6, '0');

  insert into public.assessment_papers (
    paper_code, paper_type, title, description, source_test_id,
    duration_minutes, passing_score, allow_resubmission, total_points,
    question_count, version, status, created_by, updated_by
  )
  values (
    v_new_code, v_source.paper_type, left(v_source.title || '（副本）', 120),
    v_source.description, v_source.source_test_id, v_source.duration_minutes,
    v_source.passing_score, v_source.allow_resubmission, v_source.total_points,
    v_source.question_count, 1, 'draft', auth.uid(), auth.uid()
  )
  returning id into v_new_id;

  with copied as (
    insert into public.assessment_paper_questions (
      paper_id, source_bank_question_id, source_bank_version, question_type,
      prompt, options, points, sort_order, difficulty, skill
    )
    select
      v_new_id, source_bank_question_id, source_bank_version, question_type,
      prompt, options, points, sort_order, difficulty, skill
    from public.assessment_paper_questions
    where paper_id = p_paper_id
    order by sort_order
    returning id, sort_order
  )
  insert into public.assessment_paper_question_keys (
    question_id, correct_answer, explanation
  )
  select copied.id, source_key.correct_answer, source_key.explanation
  from copied
  join public.assessment_paper_questions as source_question
    on source_question.paper_id = p_paper_id
   and source_question.sort_order = copied.sort_order
  join public.assessment_paper_question_keys as source_key
    on source_key.question_id = source_question.id;

  return v_new_id;
end;
$$;

create or replace function public.create_learning_assignment_from_paper(
  p_paper_id uuid,
  p_course_id uuid,
  p_target_scope text,
  p_target_ids uuid[],
  p_starts_at timestamptz,
  p_due_at timestamptz,
  p_institution_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_paper public.assessment_papers%rowtype;
  v_paper_question public.assessment_paper_questions%rowtype;
  v_paper_key public.assessment_paper_question_keys%rowtype;
  v_assignment_id uuid;
  v_question_id uuid;
  v_target_count integer;
  v_expected_target_count integer;
begin
  if v_tenant_id is null
    or not public.current_user_can_publish_assessment_papers() then
    raise exception '当前账号没有发布标准试卷的权限';
  end if;

  select * into v_paper
  from public.assessment_papers
  where id = p_paper_id
    and status = 'published';
  if not found then
    raise exception '所选标准试卷不存在或已经停止提供';
  end if;

  p_institution_note := btrim(coalesce(p_institution_note, ''));
  if char_length(p_institution_note) > 2000 then
    raise exception '机构通知不能超过 2000 个字';
  end if;
  if p_target_scope not in ('all_students', 'selected_students') then
    raise exception '分配范围不正确';
  end if;
  p_starts_at := coalesce(p_starts_at, now());
  if p_due_at is null or p_due_at <= p_starts_at then
    raise exception '截止时间必须晚于开始时间';
  end if;
  if p_course_id is not null and not exists (
    select 1
    from public.courses
    where id = p_course_id
      and tenant_id = v_tenant_id
      and is_published = true
  ) then
    raise exception '所选机构课程不存在或尚未发布';
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
    tenant_id, title, description, assignment_type, course_id, target_scope,
    total_points, starts_at, due_at, duration_minutes, allow_resubmission,
    status, published_at, created_by, updated_by, source_paper_id,
    source_paper_code, source_paper_version, institution_note
  )
  values (
    v_tenant_id, v_paper.title, v_paper.description, v_paper.paper_type,
    p_course_id, p_target_scope, v_paper.total_points, p_starts_at, p_due_at,
    v_paper.duration_minutes, v_paper.allow_resubmission, 'published', now(),
    auth.uid(), auth.uid(), v_paper.id, v_paper.paper_code, v_paper.version,
    p_institution_note
  )
  returning id into v_assignment_id;

  for v_paper_question in
    select *
    from public.assessment_paper_questions
    where paper_id = v_paper.id
    order by sort_order
  loop
    insert into public.learning_assignment_questions (
      tenant_id, assignment_id, question_type, prompt, options, points,
      sort_order, source_bank_question_id, source_bank_version
    )
    values (
      v_tenant_id, v_assignment_id, v_paper_question.question_type,
      v_paper_question.prompt, v_paper_question.options, v_paper_question.points,
      v_paper_question.sort_order, v_paper_question.source_bank_question_id,
      v_paper_question.source_bank_version
    )
    returning id into v_question_id;

    select * into v_paper_key
    from public.assessment_paper_question_keys
    where question_id = v_paper_question.id;

    if found then
      insert into public.learning_assignment_question_keys (
        tenant_id, question_id, correct_answer, explanation, updated_by
      )
      values (
        v_tenant_id, v_question_id, v_paper_key.correct_answer,
        v_paper_key.explanation, auth.uid()
      );
    end if;
  end loop;

  if p_target_scope = 'selected_students' then
    insert into public.learning_assignment_targets (
      tenant_id, assignment_id, student_id
    )
    select v_tenant_id, v_assignment_id, value::uuid
    from unnest(p_target_ids) as value
    on conflict do nothing;
  end if;

  return v_assignment_id;
end;
$$;

-- 学生只有在机构设置的开始时间之后才能提交。
create or replace function public.current_user_can_submit_learning_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and exists (
      select 1
      from public.learning_assignments
      where id = p_assignment_id
        and tenant_id = private.current_tenant_id()
        and status = 'published'
        and starts_at <= now()
        and due_at >= now()
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

-- 学生可以提前看到任务安排，但考试题目只在开始时间后开放。
create or replace function public.current_user_can_view_learning_assignment_questions(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.tenant_id = private.current_tenant_id()
      and (
        public.current_user_is_assignment_manager()
        or (
          public.current_user_can_view_learning_assignment(assignment.id)
          and assignment.starts_at <= now()
        )
      )
  );
$$;

drop policy if exists "tenant users read visible assignment questions"
  on public.learning_assignment_questions;
create policy "tenant users read visible assignment questions"
on public.learning_assignment_questions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.current_user_can_view_learning_assignment_questions(assignment_id)
);

revoke all on function public.create_assessment_paper_from_bank(
  text, text, text, uuid, integer, numeric, boolean, boolean, jsonb
) from public;
grant execute on function public.create_assessment_paper_from_bank(
  text, text, text, uuid, integer, numeric, boolean, boolean, jsonb
) to authenticated;

revoke all on function public.change_assessment_paper_status(uuid, text) from public;
grant execute on function public.change_assessment_paper_status(uuid, text)
  to authenticated;

revoke all on function public.duplicate_assessment_paper(uuid) from public;
grant execute on function public.duplicate_assessment_paper(uuid)
  to authenticated;

revoke all on function public.create_learning_assignment_from_paper(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text
) from public;
grant execute on function public.create_learning_assignment_from_paper(
  uuid, uuid, text, uuid[], timestamptz, timestamptz, text
) to authenticated;

comment on table public.assessment_papers is
  '平台统一制作、机构只能整卷选择和发布的标准作业卷与考试卷。';
comment on table public.assessment_paper_questions is
  '标准试卷题目快照；机构只读，发布后再次复制到租户任务。';
comment on table public.assessment_paper_question_keys is
  '标准试卷答案快照；只允许平台试卷管理员读取。';
