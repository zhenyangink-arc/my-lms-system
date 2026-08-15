begin;

-- 成长工具箱练习数据与成绩中心完全隔离：
-- 课程作业/考试继续使用 student_grade_skill_profiles；
-- 本迁移只记录学生主动发起的日常专项练习。

insert into public.growth_toolbox_items
  (slug, title, description, href, icon_name, accent, soft, sort_order, is_enabled)
values
  ('listening', '听力练习', '听音辨义，磨耳朵提升对话理解与反应速度。', '/dashboard/toolbox/listening', 'ear', 'var(--app-success)', 'var(--app-success-soft)', 1, true),
  ('speaking', '口语练习', '情境对话与发音练习，开口说韩语，越练越自然。', '/dashboard/toolbox/speaking', 'mic', 'var(--app-warm)', 'var(--app-warm-soft)', 2, true),
  ('reading', '阅读练习', '通过短文理解、信息定位与语境判断，稳步提升阅读能力。', '/dashboard/toolbox/reading', 'book-open', 'var(--app-secondary)', 'var(--app-secondary-soft)', 3, true),
  ('writing', '写作练习', '从基础句子到完整表达，练习准确、自然地书写韩语。', '/dashboard/toolbox/writing', 'pen-tool', 'var(--app-accent)', 'var(--app-accent-soft)', 4, true),
  ('grammar', '语法练习', '梳理助词、句式与常用表达，把规则变成语感。', '/dashboard/toolbox/grammar', 'message-square', 'var(--app-secondary)', 'var(--app-secondary-soft)', 5, true),
  ('vocabulary', '单词练习', '按章节巩固词汇，掌握发音与含义，为听说读写打底。', '/dashboard/toolbox/vocabulary', 'notebook-pen', 'var(--app-accent)', 'var(--app-accent-soft)', 6, true)
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  href = excluded.href,
  icon_name = excluded.icon_name,
  accent = excluded.accent,
  soft = excluded.soft,
  sort_order = excluded.sort_order,
  is_enabled = excluded.is_enabled,
  updated_at = now();

create table if not exists public.growth_toolbox_exercises (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  slug text not null,
  skill text not null check (
    skill in ('listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary')
  ),
  title text not null check (char_length(title) between 2 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  instructions text not null default '' check (char_length(instructions) <= 2000),
  difficulty text not null default 'beginner' check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  source text not null default 'platform' check (
    source in ('platform', 'textbook', 'teacher')
  ),
  course_id uuid references public.courses(id) on delete set null,
  chapter_id uuid references public.digital_textbook_chapters(id) on delete set null,
  content_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content_payload) = 'object'
  ),
  status text not null default 'draft' check (
    status in ('draft', 'published', 'archived')
  ),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, slug)
);

create table if not exists public.growth_toolbox_questions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.growth_toolbox_exercises(id) on delete cascade,
  primary_skill text not null check (
    primary_skill in ('listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary')
  ),
  question_type text not null check (
    question_type in ('single_choice', 'true_false', 'short_text', 'writing_text', 'speaking_recording')
  ),
  prompt text not null check (char_length(prompt) between 1 and 3000),
  content_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(content_payload) = 'object'
  ),
  max_score numeric(8, 2) not null default 1 check (max_score > 0 and max_score <= 1000),
  difficulty text not null default 'beginner' check (
    difficulty in ('beginner', 'intermediate', 'advanced')
  ),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, sort_order)
);

-- 正确答案与评分规则不对学生端开放，提交时由安全函数读取。
create table if not exists public.growth_toolbox_question_keys (
  question_id uuid primary key references public.growth_toolbox_questions(id) on delete cascade,
  accepted_answers jsonb not null default '[]'::jsonb check (
    jsonb_typeof(accepted_answers) = 'array'
  ),
  rubric jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric) = 'object'),
  explanation text not null default '' check (char_length(explanation) <= 3000),
  updated_at timestamptz not null default now()
);

create table if not exists public.toolbox_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.growth_toolbox_exercises(id) on delete set null,
  skill text not null check (
    skill in ('listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary')
  ),
  status text not null default 'started' check (
    status in ('started', 'completed', 'abandoned')
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  active_seconds integer not null default 0 check (active_seconds between 0 and 7200),
  item_count integer not null default 0 check (item_count between 0 and 500),
  answered_count integer not null default 0 check (answered_count between 0 and 500),
  correct_count integer not null default 0 check (correct_count between 0 and 500),
  earned_score numeric(10, 2) not null default 0 check (earned_score >= 0),
  max_score numeric(10, 2) not null default 0 check (max_score >= 0),
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, student_id, client_event_id)
);

create table if not exists public.toolbox_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.toolbox_practice_sessions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.growth_toolbox_questions(id) on delete set null,
  skill text not null check (
    skill in ('listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary')
  ),
  attempt_number integer not null default 1 check (attempt_number between 1 and 100),
  response_payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(response_payload) = 'object'
  ),
  is_correct boolean,
  earned_score numeric(8, 2) not null default 0 check (earned_score >= 0),
  max_score numeric(8, 2) not null default 0 check (max_score >= 0),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 7200),
  hints_used integer not null default 0 check (hints_used between 0 and 100),
  evaluated_by text not null default 'automatic' check (
    evaluated_by in ('automatic', 'teacher', 'ai', 'self')
  ),
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, question_id, attempt_number)
);

create table if not exists public.toolbox_practice_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  attempt_id uuid not null references public.toolbox_practice_attempts(id) on delete cascade,
  evaluated_by text not null check (evaluated_by in ('automatic', 'teacher', 'ai')),
  evaluator_id uuid references public.profiles(id) on delete set null,
  rubric_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(rubric_scores) = 'object'),
  earned_score numeric(8, 2) not null check (earned_score >= 0),
  max_score numeric(8, 2) not null check (max_score > 0),
  feedback text not null default '' check (char_length(feedback) <= 5000),
  evaluator_version text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists growth_toolbox_exercises_catalog_idx
  on public.growth_toolbox_exercises (skill, status, sort_order, created_at);
create index if not exists growth_toolbox_questions_exercise_idx
  on public.growth_toolbox_questions (exercise_id, sort_order);
create index if not exists toolbox_practice_sessions_student_idx
  on public.toolbox_practice_sessions (tenant_id, student_id, completed_at desc);
create index if not exists toolbox_practice_sessions_skill_idx
  on public.toolbox_practice_sessions (tenant_id, student_id, skill, completed_at desc);
create index if not exists toolbox_practice_attempts_session_idx
  on public.toolbox_practice_attempts (session_id, answered_at);

alter table public.growth_toolbox_exercises enable row level security;
alter table public.growth_toolbox_questions enable row level security;
alter table public.growth_toolbox_question_keys enable row level security;
alter table public.toolbox_practice_sessions enable row level security;
alter table public.toolbox_practice_attempts enable row level security;
alter table public.toolbox_practice_evaluations enable row level security;

grant select on public.growth_toolbox_exercises to authenticated;
grant select on public.growth_toolbox_questions to authenticated;

create policy "authenticated read published toolbox exercises"
on public.growth_toolbox_exercises for select to authenticated
using (
  status = 'published'
  and (tenant_id is null or tenant_id = (select private.current_tenant_id()))
);

create policy "authenticated read published toolbox questions"
on public.growth_toolbox_questions for select to authenticated
using (
  exists (
    select 1
    from public.growth_toolbox_exercises as exercise
    where exercise.id = growth_toolbox_questions.exercise_id
      and exercise.status = 'published'
      and (exercise.tenant_id is null or exercise.tenant_id = (select private.current_tenant_id()))
  )
);

create policy "students read own toolbox sessions"
on public.toolbox_practice_sessions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

create policy "students read own toolbox attempts"
on public.toolbox_practice_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

create policy "students read own toolbox evaluations"
on public.toolbox_practice_evaluations for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.toolbox_practice_attempts as attempt
    where attempt.id = toolbox_practice_evaluations.attempt_id
      and attempt.student_id = (select auth.uid())
  )
);

revoke all on public.growth_toolbox_question_keys from public, anon, authenticated;
revoke all on public.toolbox_practice_sessions from public, anon, authenticated;
revoke all on public.toolbox_practice_attempts from public, anon, authenticated;
revoke all on public.toolbox_practice_evaluations from public, anon, authenticated;
grant select on public.toolbox_practice_sessions to authenticated;
grant select on public.toolbox_practice_attempts to authenticated;
grant select on public.toolbox_practice_evaluations to authenticated;

-- 服务端核验答案，客户端只提交题号与作答内容，不能自行声明得分。
create or replace function public.submit_toolbox_practice(
  p_exercise_id uuid,
  p_answers jsonb,
  p_active_seconds integer,
  p_client_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid := private.current_tenant_id();
  v_exercise public.growth_toolbox_exercises%rowtype;
  v_session_id uuid;
  v_existing public.toolbox_practice_sessions%rowtype;
  v_answer jsonb;
  v_question record;
  v_question_id uuid;
  v_response text;
  v_normalized_response text;
  v_is_correct boolean;
  v_answered integer := 0;
  v_correct integer := 0;
  v_earned numeric := 0;
  v_max numeric := 0;
  v_item_count integer := 0;
begin
  if v_user_id is null or v_tenant_id is null then
    raise exception '请登录有效的机构账号后再提交练习';
  end if;
  if not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = v_tenant_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
      and membership.role = 'student'
  ) then
    raise exception '只有当前机构的学生账号可以提交练习';
  end if;
  if p_exercise_id is null or p_client_event_id is null then
    raise exception '练习编号不完整';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception '练习答案格式不正确';
  end if;
  if jsonb_array_length(p_answers) > 100 then
    raise exception '练习答案数量超过限制';
  end if;
  if coalesce(p_active_seconds, 0) not between 0 and 7200 then
    raise exception '练习时间不正确';
  end if;

  select * into v_exercise
  from public.growth_toolbox_exercises as exercise
  where exercise.id = p_exercise_id
    and exercise.status = 'published'
    and (exercise.tenant_id is null or exercise.tenant_id = v_tenant_id);

  if v_exercise.id is null then
    raise exception '练习不存在或尚未发布';
  end if;

  select count(*)::integer, coalesce(sum(question.max_score), 0)
    into v_item_count, v_max
  from public.growth_toolbox_questions as question
  where question.exercise_id = p_exercise_id;

  if v_item_count = 0 then
    raise exception '练习尚未配置题目';
  end if;

  insert into public.toolbox_practice_sessions (
    tenant_id, student_id, exercise_id, skill, status, active_seconds,
    item_count, answered_count, correct_count, earned_score, max_score,
    client_event_id, completed_at
  ) values (
    v_tenant_id, v_user_id, p_exercise_id, v_exercise.skill, 'started',
    coalesce(p_active_seconds, 0), v_item_count, 0, 0, 0, v_max,
    p_client_event_id, null
  )
  on conflict (tenant_id, student_id, client_event_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select * into v_existing
    from public.toolbox_practice_sessions
    where tenant_id = v_tenant_id
      and student_id = v_user_id
      and client_event_id = p_client_event_id;

    return jsonb_build_object(
      'sessionId', v_existing.id,
      'answeredCount', v_existing.answered_count,
      'correctCount', v_existing.correct_count,
      'earnedScore', v_existing.earned_score,
      'maxScore', v_existing.max_score,
      'percentage', case when v_existing.max_score > 0
        then round(v_existing.earned_score / v_existing.max_score * 100, 1)
        else 0 end,
      'duplicate', true
    );
  end if;

  for v_answer in
    select value from jsonb_array_elements(p_answers)
  loop
    begin
      v_question_id := (v_answer->>'questionId')::uuid;
    exception when others then
      continue;
    end;

    select
      question.id,
      question.primary_skill,
      question.question_type,
      question.max_score,
      answer_key.accepted_answers
    into v_question
    from public.growth_toolbox_questions as question
    join public.growth_toolbox_question_keys as answer_key
      on answer_key.question_id = question.id
    where question.id = v_question_id
      and question.exercise_id = p_exercise_id;

    if v_question.id is null then
      continue;
    end if;

    v_response := trim(coalesce(v_answer->>'response', ''));
    if v_response = '' then
      continue;
    end if;

    v_normalized_response := lower(
      regexp_replace(v_response, '[[:space:][:punct:]，。！？、]+', '', 'g')
    );
    select exists (
      select 1
      from jsonb_array_elements_text(v_question.accepted_answers) as accepted(value)
      where lower(
        regexp_replace(accepted.value, '[[:space:][:punct:]，。！？、]+', '', 'g')
      ) = v_normalized_response
    ) into v_is_correct;

    v_answered := v_answered + 1;
    v_correct := v_correct + case when v_is_correct then 1 else 0 end;
    v_earned := v_earned + case when v_is_correct then v_question.max_score else 0 end;

    insert into public.toolbox_practice_attempts (
      tenant_id, session_id, student_id, question_id, skill,
      response_payload, is_correct, earned_score, max_score,
      duration_seconds, evaluated_by
    ) values (
      v_tenant_id, v_session_id, v_user_id, v_question.id, v_question.primary_skill,
      jsonb_build_object('value', v_response), v_is_correct,
      case when v_is_correct then v_question.max_score else 0 end,
      v_question.max_score,
      case
        when coalesce(v_answer->>'durationSeconds', '') ~ '^[0-9]+$'
          then least((v_answer->>'durationSeconds')::integer, 7200)
        else 0
      end,
      'automatic'
    );
  end loop;

  update public.toolbox_practice_sessions
  set
    status = 'completed',
    answered_count = v_answered,
    correct_count = v_correct,
    earned_score = v_earned,
    completed_at = now(),
    updated_at = now()
  where id = v_session_id;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'answeredCount', v_answered,
    'correctCount', v_correct,
    'earnedScore', v_earned,
    'maxScore', v_max,
    'percentage', case when v_max > 0 then round(v_earned / v_max * 100, 1) else 0 end,
    'duplicate', false
  );
end;
$$;

revoke all on function public.submit_toolbox_practice(uuid, jsonb, integer, uuid)
  from public, anon;
grant execute on function public.submit_toolbox_practice(uuid, jsonb, integer, uuid)
  to authenticated;

create or replace view public.student_toolbox_skill_profiles
with (security_invoker = true, security_barrier = true)
as
with valid_session as (
  select
    session.tenant_id,
    session.student_id,
    session.skill,
    session.id,
    session.completed_at,
    session.active_seconds,
    session.answered_count,
    session.item_count,
    session.earned_score,
    session.max_score,
    case
      when session.completed_at >= now() - interval '7 days' then 1.0
      when session.completed_at >= now() - interval '14 days' then 0.8
      else 0.6
    end::numeric as recency_weight
  from public.toolbox_practice_sessions as session
  where session.status = 'completed'
    and session.completed_at >= now() - interval '30 days'
    and session.answered_count > 0
    and session.max_score > 0
), aggregate_profile as (
  select
    tenant_id,
    student_id,
    skill,
    round(
      sum(earned_score / max_score * 100 * recency_weight)
        / nullif(sum(recency_weight), 0),
      1
    ) as accuracy_score,
    round(
      sum(answered_count::numeric / greatest(item_count, 1) * 100 * recency_weight)
        / nullif(sum(recency_weight), 0),
      1
    ) as completion_score,
    least(100, count(distinct completed_at::date)::numeric / 8 * 100) as consistency_score,
    sum(answered_count)::bigint as valid_attempts,
    count(*)::bigint as valid_sessions,
    count(distinct completed_at::date)::bigint as active_days,
    sum(active_seconds)::bigint as active_seconds,
    max(completed_at) as last_practiced_at
  from valid_session
  group by tenant_id, student_id, skill
)
select
  tenant_id,
  student_id,
  skill,
  case when valid_attempts >= 5 then
    round(
      least(100, greatest(0,
        accuracy_score * 0.75
        + completion_score * 0.15
        + consistency_score * 0.10
      )),
      1
    )
  else null end::numeric(5, 1) as ability_score,
  accuracy_score::numeric(5, 1),
  completion_score::numeric(5, 1),
  round(consistency_score, 1)::numeric(5, 1) as consistency_score,
  valid_sessions,
  valid_attempts,
  active_days,
  active_seconds,
  last_practiced_at
from aggregate_profile;

revoke all on public.student_toolbox_skill_profiles from public, anon;
grant select on public.student_toolbox_skill_profiles to authenticated;

comment on view public.student_toolbox_skill_profiles is
  '成长工具箱独立六维能力视图：只汇总最近 30 天练习会话，不读取任何作业或考试成绩。';

-- 平台示例：阅读理解（客观题）和基础写作（可自动核验的短句）。
insert into public.growth_toolbox_exercises (
  id, tenant_id, slug, skill, title, description, instructions,
  difficulty, source, content_payload, status, sort_order
) values
  (
    '15000000-0000-4000-8000-000000000001', null, 'reading-campus-day', 'reading',
    '校园里的一天', '阅读一段初级韩语短文，并完成信息理解题。',
    '先完整阅读短文，再根据原文选择最合适的答案。', 'beginner', 'platform',
    jsonb_build_object(
      'passageTitle', '민수의 학교생활',
      'passage', '민수는 한국어를 공부하는 학생입니다. 아침 여덟 시에 학교에 갑니다. 오전에는 한국어 수업을 듣고, 점심에는 친구와 김밥을 먹습니다. 오후 세 시에 수업이 끝납니다. 수업 후에는 도서관에서 한 시간 동안 복습합니다. 그리고 다섯 시에 집에 갑니다.'
    ),
    'published', 1
  ),
  (
    '15000000-0000-4000-8000-000000000002', null, 'writing-basic-sentences', 'writing',
    '基础句子表达', '根据中文提示写出完整的初级韩语句子。',
    '注意助词、空格和句尾形式；标点符号不会影响自动判定。', 'beginner', 'platform',
    jsonb_build_object('helper', '本练习采用可自动核验的基础句型，提交后立即得到结果。'),
    'published', 1
  )
on conflict (tenant_id, slug) do update
set
  title = excluded.title,
  description = excluded.description,
  instructions = excluded.instructions,
  content_payload = excluded.content_payload,
  status = excluded.status,
  updated_at = now();

insert into public.growth_toolbox_questions (
  id, exercise_id, primary_skill, question_type, prompt,
  content_payload, max_score, difficulty, sort_order
) values
  ('15100000-0000-4000-8000-000000000001', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '민수는 무엇을 공부합니까?', '{"options":[{"value":"a","label":"영어"},{"value":"b","label":"한국어"},{"value":"c","label":"수학"}]}'::jsonb, 10, 'beginner', 1),
  ('15100000-0000-4000-8000-000000000002', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '민수는 몇 시에 학교에 갑니까?', '{"options":[{"value":"a","label":"아침 여덟 시"},{"value":"b","label":"오전 열 시"},{"value":"c","label":"오후 세 시"}]}'::jsonb, 10, 'beginner', 2),
  ('15100000-0000-4000-8000-000000000003', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '민수는 점심에 무엇을 먹습니까?', '{"options":[{"value":"a","label":"비빔밥"},{"value":"b","label":"김밥"},{"value":"c","label":"라면"}]}'::jsonb, 10, 'beginner', 3),
  ('15100000-0000-4000-8000-000000000004', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '수업은 몇 시에 끝납니까?', '{"options":[{"value":"a","label":"두 시"},{"value":"b","label":"세 시"},{"value":"c","label":"다섯 시"}]}'::jsonb, 10, 'beginner', 4),
  ('15100000-0000-4000-8000-000000000005', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '수업 후에 민수는 어디에서 복습합니까?', '{"options":[{"value":"a","label":"도서관"},{"value":"b","label":"식당"},{"value":"c","label":"운동장"}]}'::jsonb, 10, 'beginner', 5),
  ('15100000-0000-4000-8000-000000000006', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'reading-campus-day'), 'reading', 'single_choice', '민수는 도서관에서 얼마나 복습합니까?', '{"options":[{"value":"a","label":"삼십 분"},{"value":"b","label":"한 시간"},{"value":"c","label":"두 시간"}]}'::jsonb, 10, 'beginner', 6),
  ('15200000-0000-4000-8000-000000000001', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“我是学生。”请用韩语书写。', '{"hint":"저 + 학생"}'::jsonb, 10, 'beginner', 1),
  ('15200000-0000-4000-8000-000000000002', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“我学习韩语。”请用韩语书写。', '{"hint":"한국어 + 공부하다"}'::jsonb, 10, 'beginner', 2),
  ('15200000-0000-4000-8000-000000000003', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“今天去学校。”请用韩语书写。', '{"hint":"오늘 + 학교 + 가다"}'::jsonb, 10, 'beginner', 3),
  ('15200000-0000-4000-8000-000000000004', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“和朋友一起吃饭。”请用韩语书写。', '{"hint":"친구 + 같이 + 밥 + 먹다"}'::jsonb, 10, 'beginner', 4),
  ('15200000-0000-4000-8000-000000000005', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“图书馆里有书。”请用韩语书写。', '{"hint":"도서관 + 책 + 있다"}'::jsonb, 10, 'beginner', 5),
  ('15200000-0000-4000-8000-000000000006', (select id from public.growth_toolbox_exercises where tenant_id is null and slug = 'writing-basic-sentences'), 'writing', 'short_text', '“明天见。”请用韩语书写。', '{"hint":"내일 + 만나다"}'::jsonb, 10, 'beginner', 6)
on conflict (id) do update
set
  exercise_id = excluded.exercise_id,
  prompt = excluded.prompt,
  content_payload = excluded.content_payload,
  max_score = excluded.max_score,
  updated_at = now();

insert into public.growth_toolbox_question_keys (question_id, accepted_answers, explanation)
values
  ('15100000-0000-4000-8000-000000000001', '["b"]', '民洙学习韩语。'),
  ('15100000-0000-4000-8000-000000000002', '["a"]', '他早上八点去学校。'),
  ('15100000-0000-4000-8000-000000000003', '["b"]', '午饭和朋友一起吃紫菜包饭。'),
  ('15100000-0000-4000-8000-000000000004', '["b"]', '课程下午三点结束。'),
  ('15100000-0000-4000-8000-000000000005', '["a"]', '下课后在图书馆复习。'),
  ('15100000-0000-4000-8000-000000000006', '["b"]', '在图书馆复习一小时。'),
  ('15200000-0000-4000-8000-000000000001', '["저는 학생입니다","나는 학생입니다"]', '主语后使用主题助词，句尾使用 입니다。'),
  ('15200000-0000-4000-8000-000000000002', '["저는 한국어를 공부합니다","나는 한국어를 공부합니다"]', '宾语后使用 를。'),
  ('15200000-0000-4000-8000-000000000003', '["오늘 학교에 갑니다","저는 오늘 학교에 갑니다"]', '目的地后使用 에。'),
  ('15200000-0000-4000-8000-000000000004', '["친구와 같이 밥을 먹습니다","친구하고 같이 밥을 먹습니다","친구와 함께 밥을 먹습니다"]', '可以使用 와 같이 或 와 함께。'),
  ('15200000-0000-4000-8000-000000000005', '["도서관에 책이 있습니다","도서관에는 책이 있습니다"]', '存在地点使用 에，主语使用 이。'),
  ('15200000-0000-4000-8000-000000000006', '["내일 만나요","내일 봐요"]', '日常表达可以使用 만나요 或 봐요。')
on conflict (question_id) do update
set
  accepted_answers = excluded.accepted_answers,
  explanation = excluded.explanation,
  updated_at = now();

commit;
