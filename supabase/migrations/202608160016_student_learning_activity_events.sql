begin;

-- 学习记录页需要“每一次发生过的行为”，不能只依赖会被覆盖的当前状态表。
-- 例如 conversation_practice_progress 只保留累计次数和最后练习时间，
-- chapter_test_attempts 也会覆盖同一章节的旧成绩。这里建立只追加的事实账本。
create table public.student_learning_activity_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_app_id uuid not null references public.student_apps(id) on delete restrict,
  category text not null check (category in ('course', 'task', 'practice')),
  event_type text not null check (char_length(event_type) between 2 and 80),
  source_kind text not null check (char_length(source_kind) between 2 and 80),
  source_id text not null check (char_length(source_id) between 1 and 200),
  dedupe_key text not null check (char_length(dedupe_key) between 3 and 300),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (tenant_id, student_id, student_app_id, dedupe_key)
);

comment on table public.student_learning_activity_events is
  '按租户、学生和学生应用隔离的只追加学习行为账本；用于全年足迹与记录明细。';
comment on column public.student_learning_activity_events.dedupe_key is
  '同一来源事件在租户、学生、应用范围内的幂等键。';

create index student_learning_activity_events_timeline_idx
  on public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, occurred_at desc
  );
create index student_learning_activity_events_type_idx
  on public.student_learning_activity_events (
    tenant_id, student_app_id, event_type, occurred_at desc
  );

alter table public.student_learning_activity_events enable row level security;

-- 平台角色、机构管理角色与任课教师必须分开判断。特别是教师即使拥有
-- view_analytics，也只能读取已建立师生分配关系的学生，而不是整个机构。
create or replace function private.current_user_can_view_student_activity(
  p_tenant_id uuid,
  p_student_id uuid,
  p_student_app_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.current_student_has_app_access(
      p_tenant_id, p_student_id, p_student_app_id
    )
    or private.current_teacher_has_student_app_access(
      p_tenant_id, p_student_id, p_student_app_id
    )
    or (
      private.current_user_has_app_capability(
        p_tenant_id, p_student_app_id, 'view_analytics'
      )
      and (
        exists (
          select 1
          from public.profiles as profile
          where profile.id = (select auth.uid())
            and coalesce(profile.status, 'active') = 'active'
            and profile.global_role in (
              'platform_owner', 'platform_deputy', 'platform_admin'
            )
        )
        or exists (
          select 1
          from public.tenant_memberships as membership
          where membership.tenant_id = p_tenant_id
            and membership.user_id = (select auth.uid())
            and membership.status = 'active'
            and membership.role in ('admin', 'ceo', 'tenant_super_admin')
        )
      )
    );
$$;

revoke all on function private.current_user_can_view_student_activity(uuid, uuid, uuid)
  from public;
grant execute on function private.current_user_can_view_student_activity(uuid, uuid, uuid)
  to authenticated, service_role;

create policy "authorized users read student learning activity events"
on public.student_learning_activity_events for select to authenticated
using (
  private.current_user_can_view_student_activity(
    tenant_id, student_id, student_app_id
  )
);

revoke all on public.student_learning_activity_events from anon, authenticated;
grant select on public.student_learning_activity_events to authenticated;
grant all on public.student_learning_activity_events to service_role;

create or replace function private.capture_learning_time_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, duration_seconds, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.student_id,
    new.student_app_id,
    case when new.source = 'toolbox' then 'practice' else 'course' end,
    'learning_time_recorded',
    'learning_time_log',
    new.id::text,
    'learning-time:' || new.id::text,
    new.seconds,
    new.recorded_at,
    jsonb_build_object('source', new.source, 'test_slug', new.test_slug)
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

create or replace function private.capture_lesson_completion_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
  v_lesson_title text;
begin
  if new.status <> 'completed'
    or (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;

  select course.student_app_id, lesson.title
  into v_student_app_id, v_lesson_title
  from public.lessons as lesson
  join public.courses as course
    on course.tenant_id = lesson.tenant_id
   and course.id = lesson.course_id
  where lesson.tenant_id = new.tenant_id
    and lesson.id = new.lesson_id;

  if v_student_app_id is null then
    raise exception '课时学习事件缺少有效的学生应用归属';
  end if;

  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.user_id,
    v_student_app_id,
    'course',
    'lesson_completed',
    'lesson_progress',
    new.id::text,
    'lesson-completed:' || new.id::text,
    coalesce(new.completed_at, new.last_viewed_at, new.updated_at, now()),
    jsonb_build_object(
      'course_id', new.course_id,
      'lesson_id', new.lesson_id,
      'title', v_lesson_title
    )
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

create or replace function private.capture_assignment_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
  v_assignment_title text;
  v_event_type text;
  v_occurred_at timestamptz;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'assignment_submitted';
    v_occurred_at := new.submitted_at;
  elsif new.status is not distinct from old.status
    or new.status not in ('graded', 'revision_required') then
    return new;
  else
    v_event_type := case new.status
      when 'graded' then 'assignment_graded'
      else 'assignment_revision_required'
    end;
    v_occurred_at := coalesce(new.graded_at, new.updated_at, now());
  end if;

  select assignment.student_app_id, assignment.title
  into v_student_app_id, v_assignment_title
  from public.learning_assignments as assignment
  where assignment.tenant_id = new.tenant_id
    and assignment.id = new.assignment_id;

  if v_student_app_id is null then
    raise exception '作业学习事件缺少有效的学生应用归属';
  end if;

  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.student_id,
    v_student_app_id,
    'task',
    v_event_type,
    'learning_submission',
    new.id::text,
    'submission:' || new.id::text || ':' || v_event_type,
    v_occurred_at,
    jsonb_build_object(
      'assignment_id', new.assignment_id,
      'attempt_number', new.attempt_number,
      'status', new.status,
      'score', new.score,
      'title', v_assignment_title
    )
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

create or replace function private.capture_conversation_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
  v_scenario_title text;
begin
  if tg_op = 'UPDATE' and new.practice_count <= old.practice_count then
    return new;
  end if;

  select scenario.student_app_id, scenario.title
  into v_student_app_id, v_scenario_title
  from public.conversation_practice_scenarios as scenario
  where scenario.tenant_id = new.tenant_id
    and scenario.id = new.scenario_id;

  if v_student_app_id is null then
    raise exception '会话练习事件缺少有效的学生应用归属';
  end if;

  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.user_id,
    v_student_app_id,
    'practice',
    'conversation_practiced',
    'conversation_practice_progress',
    new.scenario_id::text,
    'conversation:' || new.scenario_id::text || ':' || new.practice_count::text,
    new.last_practiced_at,
    jsonb_build_object(
      'practice_count', new.practice_count,
      'status', new.status,
      'confidence', new.confidence,
      'title', v_scenario_title
    )
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

create or replace function private.capture_chapter_test_activity_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_app_id uuid;
  v_test_title text;
begin
  select test.student_app_id, test.title
  into v_student_app_id, v_test_title
  from public.chapter_tests as test
  where (new.test_id is not null and test.id = new.test_id)
     or (new.test_id is null and test.slug = new.test_slug)
  order by case when test.id = new.test_id then 0 else 1 end
  limit 1;

  if v_student_app_id is null then
    raise exception '章节测试事件缺少有效的学生应用归属';
  end if;

  insert into public.student_learning_activity_events (
    tenant_id, student_id, student_app_id, category, event_type,
    source_kind, source_id, dedupe_key, occurred_at, metadata
  ) values (
    new.tenant_id,
    new.student_id,
    v_student_app_id,
    'task',
    'chapter_test_completed',
    'chapter_test_attempt',
    new.id::text,
    'chapter-test-attempt:' || new.id::text,
    new.attempted_at,
    jsonb_build_object(
      'test_id', new.test_id,
      'test_slug', new.test_slug,
      'score', new.score,
      'passed', new.passed,
      'correct_count', new.correct_count,
      'total_questions', new.total_questions,
      'title', v_test_title
    )
  )
  on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function private.capture_learning_time_activity_event() from public;
revoke all on function private.capture_lesson_completion_activity_event() from public;
revoke all on function private.capture_assignment_activity_event() from public;
revoke all on function private.capture_conversation_activity_event() from public;
revoke all on function private.capture_chapter_test_activity_event() from public;

drop trigger if exists learning_time_log_capture_activity
  on public.learning_time_log;
create trigger learning_time_log_capture_activity
after insert on public.learning_time_log
for each row execute function private.capture_learning_time_activity_event();

drop trigger if exists lesson_progress_capture_completion_activity
  on public.lesson_progress;
create trigger lesson_progress_capture_completion_activity
after insert or update of status on public.lesson_progress
for each row execute function private.capture_lesson_completion_activity_event();

drop trigger if exists learning_submissions_capture_activity
  on public.learning_submissions;
create trigger learning_submissions_capture_activity
after insert or update of status on public.learning_submissions
for each row execute function private.capture_assignment_activity_event();

drop trigger if exists conversation_progress_capture_activity
  on public.conversation_practice_progress;
create trigger conversation_progress_capture_activity
after insert or update of practice_count on public.conversation_practice_progress
for each row execute function private.capture_conversation_activity_event();

drop trigger if exists chapter_test_attempts_capture_activity
  on public.chapter_test_attempts;
create trigger chapter_test_attempts_capture_activity
after insert on public.chapter_test_attempts
for each row execute function private.capture_chapter_test_activity_event();

-- 可精确还原的历史事实逐条回填。
insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, duration_seconds, occurred_at, metadata
)
select
  log.tenant_id,
  log.student_id,
  log.student_app_id,
  case when log.source = 'toolbox' then 'practice' else 'course' end,
  'learning_time_recorded',
  'learning_time_log',
  log.id::text,
  'learning-time:' || log.id::text,
  log.seconds,
  log.recorded_at,
  jsonb_build_object('source', log.source, 'test_slug', log.test_slug)
from public.learning_time_log as log
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at, metadata
)
select
  progress.tenant_id,
  progress.user_id,
  course.student_app_id,
  'course',
  'lesson_completed',
  'lesson_progress',
  progress.id::text,
  'lesson-completed:' || progress.id::text,
  coalesce(progress.completed_at, progress.last_viewed_at, progress.updated_at, now()),
  jsonb_build_object(
    'course_id', progress.course_id,
    'lesson_id', progress.lesson_id,
    'title', lesson.title
  )
from public.lesson_progress as progress
join public.lessons as lesson
  on lesson.tenant_id = progress.tenant_id
 and lesson.id = progress.lesson_id
join public.courses as course
  on course.tenant_id = lesson.tenant_id
 and course.id = lesson.course_id
where progress.status = 'completed'
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at, metadata
)
select
  submission.tenant_id,
  submission.student_id,
  assignment.student_app_id,
  'task',
  'assignment_submitted',
  'learning_submission',
  submission.id::text,
  'submission:' || submission.id::text || ':assignment_submitted',
  submission.submitted_at,
  jsonb_build_object(
    'assignment_id', submission.assignment_id,
    'attempt_number', submission.attempt_number,
    'status', submission.status,
    'score', submission.score,
    'title', assignment.title
  )
from public.learning_submissions as submission
join public.learning_assignments as assignment
  on assignment.tenant_id = submission.tenant_id
 and assignment.id = submission.assignment_id
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at, metadata
)
select
  submission.tenant_id,
  submission.student_id,
  assignment.student_app_id,
  'task',
  case submission.status
    when 'graded' then 'assignment_graded'
    else 'assignment_revision_required'
  end,
  'learning_submission',
  submission.id::text,
  'submission:' || submission.id::text || ':' || case submission.status
    when 'graded' then 'assignment_graded'
    else 'assignment_revision_required'
  end,
  coalesce(submission.graded_at, submission.updated_at, now()),
  jsonb_build_object(
    'assignment_id', submission.assignment_id,
    'attempt_number', submission.attempt_number,
    'status', submission.status,
    'score', submission.score,
    'title', assignment.title
  )
from public.learning_submissions as submission
join public.learning_assignments as assignment
  on assignment.tenant_id = submission.tenant_id
 and assignment.id = submission.assignment_id
where submission.status in ('graded', 'revision_required')
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

-- 旧会话表无法还原每次练习的日期，只回填一个明确标注精度的历史快照；
-- 此迁移之后的每一次练习都会由触发器独立保存。
insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at, metadata
)
select
  progress.tenant_id,
  progress.user_id,
  scenario.student_app_id,
  'practice',
  'conversation_practiced',
  'conversation_practice_progress',
  progress.scenario_id::text,
  'conversation:' || progress.scenario_id::text || ':' || progress.practice_count::text,
  progress.last_practiced_at,
  jsonb_build_object(
    'practice_count', progress.practice_count,
    'status', progress.status,
    'confidence', progress.confidence,
    'title', scenario.title,
    'historical_snapshot', true
  )
from public.conversation_practice_progress as progress
join public.conversation_practice_scenarios as scenario
  on scenario.tenant_id = progress.tenant_id
 and scenario.id = progress.scenario_id
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

-- 章节测试旧表只保留最近一次结果；现有结果先回填，迁移后的重做记录不会再丢失。
insert into public.student_learning_activity_events (
  tenant_id, student_id, student_app_id, category, event_type,
  source_kind, source_id, dedupe_key, occurred_at, metadata
)
select
  attempt.tenant_id,
  attempt.student_id,
  test.student_app_id,
  'task',
  'chapter_test_completed',
  'chapter_test_attempt',
  attempt.id::text,
  'chapter-test-attempt:' || attempt.id::text,
  attempt.attempted_at,
  jsonb_build_object(
    'test_id', attempt.test_id,
    'test_slug', attempt.test_slug,
    'score', attempt.score,
    'passed', attempt.passed,
    'correct_count', attempt.correct_count,
    'total_questions', attempt.total_questions,
    'title', test.title,
    'historical_snapshot', true
  )
from public.chapter_test_attempts as attempt
join public.chapter_tests as test
  on test.id = attempt.test_id
on conflict (tenant_id, student_id, student_app_id, dedupe_key) do nothing;

commit;
