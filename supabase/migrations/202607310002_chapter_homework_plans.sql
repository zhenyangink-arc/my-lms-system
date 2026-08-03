begin;

-- 每个课程章节拥有一份作业计划，并固定包含听、说、读、写四项配置。
create table if not exists public.chapter_homework_plans (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null unique
    references public.course_tests(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  duration_minutes integer not null default 30
    check (duration_minutes between 1 and 600),
  passing_score numeric(5,2) not null default 60
    check (passing_score between 0 and 100),
  allow_resubmission boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapter_homework_skill_settings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null
    references public.chapter_homework_plans(id) on delete cascade,
  language_skill text not null
    check (language_skill in ('listening', 'speaking', 'reading', 'writing')),
  enabled boolean not null default true,
  response_mode text not null
    check (
      response_mode in (
        'single_choice',
        'short_text',
        'long_text',
        'audio_recording',
        'mixed'
      )
    ),
  target_question_count integer not null default 1
    check (target_question_count between 0 and 100),
  target_points numeric(8,2) not null default 25
    check (target_points between 0 and 1000),
  duration_minutes integer not null default 5
    check (duration_minutes between 1 and 180),
  instructions text not null default ''
    check (char_length(instructions) <= 2000),
  sort_order integer not null check (sort_order between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, language_skill),
  unique (plan_id, sort_order)
);

create index if not exists chapter_homework_plans_status_idx
  on public.chapter_homework_plans (status, updated_at desc);
create index if not exists chapter_homework_skill_settings_plan_idx
  on public.chapter_homework_skill_settings (plan_id, sort_order);

drop trigger if exists chapter_homework_plans_set_updated_at
  on public.chapter_homework_plans;
create trigger chapter_homework_plans_set_updated_at
before update on public.chapter_homework_plans
for each row execute function private.set_updated_at();

drop trigger if exists chapter_homework_skill_settings_set_updated_at
  on public.chapter_homework_skill_settings;
create trigger chapter_homework_skill_settings_set_updated_at
before update on public.chapter_homework_skill_settings
for each row execute function private.set_updated_at();

create or replace function private.ensure_chapter_homework_plan(
  p_test_id uuid,
  p_test_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
begin
  insert into public.chapter_homework_plans (test_id, title)
  values (p_test_id, left(coalesce(nullif(btrim(p_test_title), ''), '章节') || '作业', 120))
  on conflict (test_id) do nothing;

  select plan.id
  into v_plan_id
  from public.chapter_homework_plans as plan
  where plan.test_id = p_test_id;

  insert into public.chapter_homework_skill_settings (
    plan_id,
    language_skill,
    response_mode,
    target_question_count,
    target_points,
    duration_minutes,
    sort_order
  )
  values
    (v_plan_id, 'listening', 'mixed',           5, 25,  8, 1),
    (v_plan_id, 'speaking',  'audio_recording', 1, 25,  5, 2),
    (v_plan_id, 'reading',   'mixed',           5, 25, 10, 3),
    (v_plan_id, 'writing',   'long_text',       1, 25, 12, 4)
  on conflict (plan_id, language_skill) do nothing;

  return v_plan_id;
end;
$$;

-- 为现有的每一个课程章节补齐作业计划和听说读写四项配置。
select private.ensure_chapter_homework_plan(test.id, test.title)
from public.course_tests as test;

create or replace function private.ensure_homework_plan_for_new_course_test()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_chapter_homework_plan(new.id, new.title);
  return new;
end;
$$;

drop trigger if exists course_tests_ensure_homework_plan
  on public.course_tests;
create trigger course_tests_ensure_homework_plan
after insert on public.course_tests
for each row execute function private.ensure_homework_plan_for_new_course_test();

alter table public.chapter_homework_plans enable row level security;
alter table public.chapter_homework_skill_settings enable row level security;

drop policy if exists "chapter homework plans are readable by authorized staff"
  on public.chapter_homework_plans;
create policy "chapter homework plans are readable by authorized staff"
on public.chapter_homework_plans for select to authenticated
using (
  public.current_user_can_manage_assessment_papers()
  or (
    status = 'published'
    and public.current_user_can_publish_assessment_papers()
  )
);

drop policy if exists "platform managers maintain chapter homework plans"
  on public.chapter_homework_plans;
create policy "platform managers maintain chapter homework plans"
on public.chapter_homework_plans for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

drop policy if exists "chapter homework skills are readable by authorized staff"
  on public.chapter_homework_skill_settings;
create policy "chapter homework skills are readable by authorized staff"
on public.chapter_homework_skill_settings for select to authenticated
using (
  exists (
    select 1
    from public.chapter_homework_plans as plan
    where plan.id = plan_id
      and (
        public.current_user_can_manage_assessment_papers()
        or (
          plan.status = 'published'
          and public.current_user_can_publish_assessment_papers()
        )
      )
  )
);

drop policy if exists "platform managers maintain chapter homework skills"
  on public.chapter_homework_skill_settings;
create policy "platform managers maintain chapter homework skills"
on public.chapter_homework_skill_settings for all to authenticated
using (public.current_user_can_manage_assessment_papers())
with check (public.current_user_can_manage_assessment_papers());

revoke all on public.chapter_homework_plans from anon, authenticated;
revoke all on public.chapter_homework_skill_settings from anon, authenticated;
grant select, insert, update, delete
  on public.chapter_homework_plans to authenticated;
grant select, insert, update, delete
  on public.chapter_homework_skill_settings to authenticated;
grant select, insert, update, delete
  on public.chapter_homework_plans,
     public.chapter_homework_skill_settings
  to service_role;

comment on table public.chapter_homework_plans is
  '平台按课程章节维护的标准作业计划；每个 course_test 对应一条。';
comment on table public.chapter_homework_skill_settings is
  '章节作业的听、说、读、写四项配置。';

commit;
