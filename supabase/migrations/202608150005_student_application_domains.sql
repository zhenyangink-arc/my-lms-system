begin;

-- 学生端从单一 dashboard 拆分为多个应用。现有课程、分类和学习数据全部保留，
-- 只增加稳定的应用归属，避免以后依赖分类 slug 在前端临时判断。
create table if not exists public.student_apps (
  id uuid primary key,
  slug text not null unique,
  title text not null,
  short_title text not null,
  description text not null default '',
  app_kind text not null check (app_kind in ('learning', 'service')),
  default_status text not null default 'coming_soon'
    check (default_status in ('active', 'coming_soon', 'hidden')),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.student_apps
  (id, slug, title, short_title, description, app_kind, default_status, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', 'korean', '韩语学习', '韩语', '从韩文字母到综合应用的独立韩语学习空间。', 'learning', 'active', 10),
  ('10000000-0000-4000-8000-000000000002', 'english', '英语学习', '英语', '围绕听说读写建立系统化英语能力。', 'learning', 'coming_soon', 20),
  ('10000000-0000-4000-8000-000000000003', 'math', '数学学习', '数学', '按知识体系组织课程、练习与阶段测评。', 'learning', 'coming_soon', 30),
  ('10000000-0000-4000-8000-000000000004', 'university', '大学课程', '大学课程', '独立的大学课程与专业学习空间。', 'learning', 'coming_soon', 40),
  ('10000000-0000-4000-8000-000000000005', 'study-abroad', '留学服务', '留学服务', '目标大学、申请材料与签证准备服务空间。', 'service', 'active', 50)
on conflict (id) do update set
  slug = excluded.slug,
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  app_kind = excluded.app_kind,
  default_status = excluded.default_status,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.tenant_student_apps (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  app_id uuid not null references public.student_apps(id) on delete restrict,
  is_enabled boolean not null default true,
  status text not null check (status in ('active', 'coming_soon', 'hidden')),
  custom_title text,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, app_id)
);

insert into public.tenant_student_apps
  (tenant_id, app_id, is_enabled, status, sort_order)
select
  tenant.id,
  app.id,
  true,
  app.default_status,
  app.sort_order
from public.tenants as tenant
cross join public.student_apps as app
on conflict (tenant_id, app_id) do nothing;

-- 新建租户也必须从第一天拥有同一套应用注册关系，不能只照顾迁移时已有租户。
create or replace function private.seed_student_apps_for_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_student_apps
    (tenant_id, app_id, is_enabled, status, sort_order)
  select
    new.id,
    app.id,
    true,
    app.default_status,
    app.sort_order
  from public.student_apps as app
  on conflict (tenant_id, app_id) do nothing;

  return new;
end;
$$;

drop trigger if exists tenants_seed_student_apps on public.tenants;
create trigger tenants_seed_student_apps
after insert on public.tenants
for each row execute function private.seed_student_apps_for_tenant();

alter table public.course_categories
  add column if not exists student_app_id uuid references public.student_apps(id) on delete restrict;

alter table public.courses
  add column if not exists student_app_id uuid references public.student_apps(id) on delete restrict;

create index if not exists course_categories_student_app_idx
  on public.course_categories (student_app_id, is_published, sort_order);
create index if not exists courses_student_app_idx
  on public.courses (student_app_id, is_published, created_at);
create index if not exists tenant_student_apps_visible_idx
  on public.tenant_student_apps (tenant_id, is_enabled, status, sort_order);

-- 一级分类直接映射应用；所有后代分类继承同一应用。
with recursive category_tree as (
  select
    category.id,
    category.parent_id,
    app.id as student_app_id
  from public.course_categories as category
  join public.student_apps as app
    on app.slug = case category.slug
      when 'service' then 'study-abroad'
      else category.slug
    end
  where category.parent_id is null

  union all

  select
    child.id,
    child.parent_id,
    parent.student_app_id
  from public.course_categories as child
  join category_tree as parent on parent.id = child.parent_id
)
update public.course_categories as category
set student_app_id = tree.student_app_id
from category_tree as tree
where category.id = tree.id
  and category.student_app_id is distinct from tree.student_app_id;

update public.courses as course
set student_app_id = category.student_app_id
from public.course_categories as category
where category.id = course.category_id
  and course.student_app_id is distinct from category.student_app_id;

-- 没有课程外键的学习事实也必须带应用归属；现有事实均来自当前韩语学生端。
alter table public.learning_assignments
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.chapter_tests
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.learning_time_log
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.course_ebook_progress
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.learning_record_notes
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.conversation_practice_scenarios
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;

update public.learning_assignments as assignment
set student_app_id = coalesce(
  (select course.student_app_id from public.courses as course where course.id = assignment.course_id),
  '10000000-0000-4000-8000-000000000001'::uuid
);

update public.chapter_tests as test
set student_app_id = coalesce(
  (
    select course.student_app_id
    from public.lessons as lesson
    join public.courses as course on course.id = lesson.course_id
    where lesson.id = test.lesson_id
  ),
  '10000000-0000-4000-8000-000000000001'::uuid
);

create index if not exists learning_assignments_student_app_idx
  on public.learning_assignments (tenant_id, student_app_id, status, due_at);
create index if not exists chapter_tests_student_app_idx
  on public.chapter_tests (student_app_id, status, chapter_number);
create index if not exists learning_time_log_student_app_idx
  on public.learning_time_log (tenant_id, student_id, student_app_id, recorded_at);
create index if not exists learning_record_notes_student_app_idx
  on public.learning_record_notes (tenant_id, student_id, student_app_id, occurred_at desc);
create index if not exists conversation_scenarios_student_app_idx
  on public.conversation_practice_scenarios (tenant_id, student_app_id, status, sort_order);

create or replace function private.sync_student_app_ownership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
begin
  if tg_table_name = 'course_categories' then
    if new.parent_id is not null then
      select parent.student_app_id
      into new.student_app_id
      from public.course_categories as parent
      where parent.id = new.parent_id;
    elsif new.student_app_id is null then
      select app.id
      into new.student_app_id
      from public.student_apps as app
      where app.slug = case new.slug
        when 'service' then 'study-abroad'
        else new.slug
      end;
    end if;
  elsif tg_table_name = 'courses' and new.category_id is not null then
    select category.student_app_id
    into new.student_app_id
    from public.course_categories as category
    where category.id = new.category_id;
  elsif tg_table_name = 'learning_assignments' then
    if new.course_id is not null then
      select course.student_app_id
      into new.student_app_id
      from public.courses as course
      where course.id = new.course_id;
    end if;
    new.student_app_id := coalesce(
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  elsif tg_table_name = 'chapter_tests' then
    if new.lesson_id is not null then
      select course.student_app_id
      into new.student_app_id
      from public.lessons as lesson
      join public.courses as course on course.id = lesson.course_id
      where lesson.id = new.lesson_id;
    end if;
    new.student_app_id := coalesce(
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  elsif tg_table_name = 'growth_toolbox_exercises' then
    if new.course_id is not null then
      select course.student_app_id
      into new.student_app_id
      from public.courses as course
      where course.id = new.course_id;
    end if;
    new.student_app_id := coalesce(
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  elsif tg_table_name = 'toolbox_practice_sessions' then
    if new.exercise_id is not null then
      select exercise.student_app_id
      into new.student_app_id
      from public.growth_toolbox_exercises as exercise
      where exercise.id = new.exercise_id;
    end if;
    new.student_app_id := coalesce(
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  elsif tg_table_name = 'course_ebook_progress' then
    if new.test_slug is not null then
      select test.student_app_id
      into v_student_app_id
      from public.chapter_tests as test
      where test.slug = new.test_slug;
    end if;
    new.student_app_id := coalesce(
      v_student_app_id,
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  elsif tg_table_name = 'learning_time_log' then
    if new.test_slug is not null then
      select test.student_app_id
      into v_student_app_id
      from public.chapter_tests as test
      where test.slug = new.test_slug;
    end if;
    new.student_app_id := coalesce(
      v_student_app_id,
      new.student_app_id,
      '10000000-0000-4000-8000-000000000001'::uuid
    );
  end if;

  return new;
end;
$$;

drop trigger if exists course_categories_sync_student_app on public.course_categories;
create trigger course_categories_sync_student_app
before insert or update of parent_id, slug, student_app_id
on public.course_categories
for each row execute function private.sync_student_app_ownership();

drop trigger if exists courses_sync_student_app on public.courses;
create trigger courses_sync_student_app
before insert or update of category_id, student_app_id
on public.courses
for each row execute function private.sync_student_app_ownership();

drop trigger if exists learning_assignments_sync_student_app on public.learning_assignments;
create trigger learning_assignments_sync_student_app
before insert or update of course_id, student_app_id
on public.learning_assignments
for each row execute function private.sync_student_app_ownership();

drop trigger if exists chapter_tests_sync_student_app on public.chapter_tests;
create trigger chapter_tests_sync_student_app
before insert or update of lesson_id, student_app_id
on public.chapter_tests
for each row execute function private.sync_student_app_ownership();

drop trigger if exists course_ebook_progress_sync_student_app on public.course_ebook_progress;
create trigger course_ebook_progress_sync_student_app
before insert or update of test_slug, student_app_id
on public.course_ebook_progress
for each row execute function private.sync_student_app_ownership();

drop trigger if exists learning_time_log_sync_student_app on public.learning_time_log;
create trigger learning_time_log_sync_student_app
before insert or update of test_slug, student_app_id
on public.learning_time_log
for each row execute function private.sync_student_app_ownership();

-- 当前成长工具箱属于韩语应用。表由前一迁移创建，直接补齐明确归属。
alter table public.growth_toolbox_exercises
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;
alter table public.toolbox_practice_sessions
  add column if not exists student_app_id uuid not null
    default '10000000-0000-4000-8000-000000000001'
    references public.student_apps(id) on delete restrict;

update public.growth_toolbox_exercises as exercise
set student_app_id = coalesce(
  (select course.student_app_id from public.courses as course where course.id = exercise.course_id),
  '10000000-0000-4000-8000-000000000001'::uuid
)
where exercise.student_app_id is null;

update public.toolbox_practice_sessions as session
set student_app_id = coalesce(
  (
    select exercise.student_app_id
    from public.growth_toolbox_exercises as exercise
    where exercise.id = session.exercise_id
  ),
  '10000000-0000-4000-8000-000000000001'::uuid
)
where session.student_app_id is null;

create index if not exists growth_toolbox_exercises_student_app_idx
  on public.growth_toolbox_exercises (student_app_id, skill, status, sort_order);
create index if not exists toolbox_practice_sessions_student_app_idx
  on public.toolbox_practice_sessions (tenant_id, student_id, student_app_id, completed_at desc);

drop trigger if exists growth_toolbox_exercises_sync_student_app on public.growth_toolbox_exercises;
create trigger growth_toolbox_exercises_sync_student_app
before insert or update of course_id, student_app_id
on public.growth_toolbox_exercises
for each row execute function private.sync_student_app_ownership();

drop trigger if exists toolbox_practice_sessions_sync_student_app on public.toolbox_practice_sessions;
create trigger toolbox_practice_sessions_sync_student_app
before insert or update of exercise_id, student_app_id
on public.toolbox_practice_sessions
for each row execute function private.sync_student_app_ownership();

-- 成绩六维视图按应用分组，韩语成绩页不会吸收未来英语或数学成绩。
drop view if exists public.student_grade_skill_profiles;
create view public.student_grade_skill_profiles
with (security_invoker = true, security_barrier = true)
as
with latest_graded_submission as (
  select distinct on (
    submission.tenant_id,
    submission.student_id,
    submission.assignment_id
  )
    submission.tenant_id,
    submission.student_id,
    submission.id as submission_id,
    submission.assignment_id,
    submission.graded_at,
    assignment.course_id,
    assignment.student_app_id,
    assignment.source_paper_id,
    case when assignment.assignment_type = 'exam' then 'exam' else 'homework' end as grade_category
  from public.learning_submissions as submission
  join public.learning_assignments as assignment
    on assignment.tenant_id = submission.tenant_id
   and assignment.id = submission.assignment_id
  where submission.status = 'graded'
    and submission.score is not null
    and assignment.assignment_type in ('homework', 'exam')
  order by
    submission.tenant_id,
    submission.student_id,
    submission.assignment_id,
    submission.attempt_number desc,
    coalesce(submission.graded_at, submission.submitted_at) desc,
    submission.id desc
), scored_answer as (
  select
    latest.tenant_id,
    latest.student_id,
    latest.student_app_id,
    latest.course_id,
    latest.submission_id,
    latest.grade_category,
    latest.graded_at,
    answer.awarded_points,
    assignment_question.points,
    case
      when lower(trim(paper_question.skill)) ~ '(listening|listen|听力|听写|듣기)' then 'listening'
      when lower(trim(paper_question.skill)) ~ '(speaking|speak|口语|发音|朗读|录音|말하기)' then 'speaking'
      when lower(trim(paper_question.skill)) ~ '(reading|read|阅读|理解|읽기)' then 'reading'
      when lower(trim(paper_question.skill)) ~ '(writing|write|写作|作文|书写|쓰기)' then 'writing'
      when lower(trim(paper_question.skill)) ~ '(vocabulary|vocab|word|词汇|单词|字词|어휘)' then 'vocabulary'
      when lower(trim(paper_question.skill)) ~ '(grammar|language use|语法|句法|语言运用|문법)' then 'grammar'
      when assignment_question.question_type = 'long_text' then 'writing'
      when assignment_question.question_type = 'file_link' then 'speaking'
      else null
    end as skill
  from latest_graded_submission as latest
  join public.learning_submission_answers as answer
    on answer.tenant_id = latest.tenant_id
   and answer.submission_id = latest.submission_id
  join public.learning_assignment_questions as assignment_question
    on assignment_question.tenant_id = answer.tenant_id
   and assignment_question.id = answer.question_id
  left join public.assessment_paper_questions as paper_question
    on paper_question.paper_id = latest.source_paper_id
   and paper_question.sort_order = assignment_question.sort_order
  where answer.awarded_points is not null
)
select
  tenant_id,
  student_id,
  student_app_id,
  grade_category,
  skill,
  round(sum(greatest(awarded_points, 0)), 2)::numeric(12, 2) as earned_points,
  round(sum(greatest(points, 0)), 2)::numeric(12, 2) as total_points,
  case when sum(greatest(points, 0)) > 0 then
    round(
      least(100, greatest(0, sum(greatest(awarded_points, 0)) / sum(greatest(points, 0)) * 100)),
      1
    )
  else null end::numeric(5, 1) as percentage,
  count(*)::bigint as question_count,
  count(distinct submission_id)::bigint as assessment_count,
  max(graded_at) as last_graded_at
from scored_answer
where skill is not null
group by tenant_id, student_id, student_app_id, grade_category, skill;

revoke all on public.student_grade_skill_profiles from public, anon, authenticated;
grant select on public.student_grade_skill_profiles to service_role;

-- 工具箱能力也按应用分组，和其他应用未来的练习记录完全隔离。
drop view if exists public.student_toolbox_skill_profiles;
create view public.student_toolbox_skill_profiles
with (security_invoker = true, security_barrier = true)
as
with valid_session as (
  select
    session.tenant_id,
    session.student_id,
    session.student_app_id,
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
    student_app_id,
    skill,
    round(sum(earned_score / max_score * 100 * recency_weight) / nullif(sum(recency_weight), 0), 1) as accuracy_score,
    round(sum(answered_count::numeric / greatest(item_count, 1) * 100 * recency_weight) / nullif(sum(recency_weight), 0), 1) as completion_score,
    least(100, count(distinct completed_at::date)::numeric / 8 * 100) as consistency_score,
    sum(answered_count)::bigint as valid_attempts,
    count(*)::bigint as valid_sessions,
    count(distinct completed_at::date)::bigint as active_days,
    sum(active_seconds)::bigint as active_seconds,
    max(completed_at) as last_practiced_at
  from valid_session
  group by tenant_id, student_id, student_app_id, skill
)
select
  tenant_id,
  student_id,
  student_app_id,
  skill,
  case when valid_attempts >= 5 then
    round(least(100, greatest(0, accuracy_score * 0.75 + completion_score * 0.15 + consistency_score * 0.10)), 1)
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

alter table public.student_apps enable row level security;
alter table public.tenant_student_apps enable row level security;

grant select on public.student_apps to authenticated;
grant select on public.tenant_student_apps to authenticated;

drop policy if exists "authenticated read student apps" on public.student_apps;
create policy "authenticated read student apps"
on public.student_apps for select to authenticated
using (true);

drop policy if exists "members read tenant student apps" on public.tenant_student_apps;
create policy "members read tenant student apps"
on public.tenant_student_apps for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  or (select private.is_platform_owner())
);

comment on table public.student_apps is
  '学生端独立应用注册表；课程学习与留学服务均通过稳定 app slug 分区';
comment on table public.tenant_student_apps is
  '每个租户学生门户中启用的应用及展示状态';
comment on column public.course_categories.student_app_id is
  '课程分类所属学生应用，后代分类从父分类继承';
comment on column public.courses.student_app_id is
  '课程所属学生应用，由课程分类自动同步';

commit;
