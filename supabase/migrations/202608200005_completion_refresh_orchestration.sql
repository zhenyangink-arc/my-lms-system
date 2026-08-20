begin;

-- Qualification refreshes are durable work items. Business-event triggers use
-- safe, single-student evaluation and retain a retry task only when evaluation
-- fails. Policy publication and institution-wide requests always use a batch
-- task so the caller never loops over students or makes one request per student.
create table public.course_completion_refresh_tasks (
  id uuid primary key default gen_random_uuid(),
  task_kind text not null check (task_kind in (
    'event_retry', 'policy_publish', 'institution_manual', 'grade_item_publish'
  )),
  tenant_id uuid references public.tenants(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  student_app_id uuid not null
    references public.student_apps(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete cascade,
  policy_id uuid references public.course_completion_policies(id)
    on delete cascade,
  source_kind text,
  source_id text,
  reason text not null check (char_length(btrim(reason)) between 2 and 300),
  dedupe_key text not null check (char_length(dedupe_key) between 8 and 500),
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'succeeded', 'partial_failed', 'failed'
  )),
  requested_by uuid references public.profiles(id) on delete set null,
  available_at timestamptz not null default now(),
  worker_token uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  target_count integer not null default 0 check (target_count >= 0),
  succeeded_count integer not null default 0 check (succeeded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_completion_refresh_tasks_scope_check check (
    (task_kind = 'policy_publish' and tenant_id is null and student_id is null
      and policy_id is not null)
    or (task_kind = 'grade_item_publish' and tenant_id is not null
      and student_id is null)
    or (task_kind = 'institution_manual' and tenant_id is not null)
    or (task_kind = 'event_retry' and tenant_id is not null
      and student_id is not null)
  )
);

comment on table public.course_completion_refresh_tasks is
  '结课资格异步刷新任务；政策发布和机构批量刷新由服务端以集合查询执行，业务事件失败仅入队重试。';

create unique index course_completion_refresh_tasks_active_dedupe_key
  on public.course_completion_refresh_tasks (dedupe_key)
  where status in ('pending', 'processing');
create index course_completion_refresh_tasks_claim_idx
  on public.course_completion_refresh_tasks (available_at, created_at)
  where status = 'pending';
create index course_completion_refresh_tasks_tenant_timeline_idx
  on public.course_completion_refresh_tasks (tenant_id, created_at desc)
  where tenant_id is not null;

create table public.course_completion_refresh_task_results (
  task_id uuid not null references public.course_completion_refresh_tasks(id)
    on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  evaluation_id uuid references public.student_course_completion_evaluations(id)
    on delete set null,
  succeeded boolean not null,
  error_code text,
  error_message text,
  attempted_at timestamptz not null default clock_timestamp(),
  primary key (task_id, student_id),
  constraint course_completion_refresh_task_results_error_check check (
    (succeeded and evaluation_id is not null
      and error_code is null and error_message is null)
    or (not succeeded and evaluation_id is null and error_message is not null)
  )
);

comment on table public.course_completion_refresh_task_results is
  '批量资格刷新中每名学生的结果；失败按学生隔离，不回滚同任务内其他学生。';

alter table public.course_completion_refresh_tasks enable row level security;
alter table public.course_completion_refresh_tasks force row level security;
alter table public.course_completion_refresh_task_results enable row level security;
alter table public.course_completion_refresh_task_results force row level security;

create policy course_completion_refresh_tasks_institution_read
on public.course_completion_refresh_tasks for select to authenticated
using (
  tenant_id = private.current_tenant_id()
  and private.current_staff_has_app_capability(
    tenant_id, student_app_id, 'manage_assessments'
  )
);

create policy course_completion_refresh_task_results_institution_read
on public.course_completion_refresh_task_results for select to authenticated
using (
  exists (
    select 1
    from public.course_completion_refresh_tasks as task
    where task.id = course_completion_refresh_task_results.task_id
      and task.tenant_id = private.current_tenant_id()
      and private.current_staff_has_app_capability(
        task.tenant_id, task.student_app_id, 'manage_assessments'
      )
  )
);

revoke all on public.course_completion_refresh_tasks,
  public.course_completion_refresh_task_results
  from public, anon, authenticated;
grant select on public.course_completion_refresh_tasks,
  public.course_completion_refresh_task_results to authenticated;
grant all on public.course_completion_refresh_tasks,
  public.course_completion_refresh_task_results to service_role;

-- Converts one evaluator exception into a row result. Calling this function
-- from a set-returning query isolates a bad student without aborting the batch.
create or replace function private.try_evaluate_student_course_completion(
  p_student_id uuid,
  p_course_id uuid,
  p_policy_id uuid default null
)
returns table (
  evaluation_id uuid,
  succeeded boolean,
  error_code text,
  error_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluation public.student_course_completion_evaluations%rowtype;
begin
  v_evaluation := public.evaluate_student_course_completion(
    p_student_id, p_course_id, p_policy_id
  );
  return query select v_evaluation.id, true, null::text, null::text;
exception when others then
  return query select
    null::uuid,
    false,
    sqlstate::text,
    left(sqlerrm, 2000);
end;
$$;

revoke all on function private.try_evaluate_student_course_completion(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function private.try_evaluate_student_course_completion(
  uuid, uuid, uuid
) to service_role;

create or replace function private.enqueue_completion_refresh_task(
  p_task_kind text,
  p_tenant_id uuid,
  p_student_id uuid,
  p_student_app_id uuid,
  p_course_id uuid,
  p_policy_id uuid,
  p_source_kind text,
  p_source_id text,
  p_reason text,
  p_dedupe_key text,
  p_requested_by uuid default null,
  p_available_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task_id uuid;
begin
  insert into public.course_completion_refresh_tasks (
    task_kind, tenant_id, student_id, student_app_id, course_id, policy_id,
    source_kind, source_id, reason, dedupe_key, requested_by, available_at
  ) values (
    p_task_kind, p_tenant_id, p_student_id, p_student_app_id, p_course_id,
    p_policy_id, nullif(btrim(p_source_kind), ''), nullif(btrim(p_source_id), ''),
    btrim(p_reason), p_dedupe_key, p_requested_by,
    coalesce(p_available_at, now())
  )
  on conflict do nothing
  returning id into v_task_id;

  if v_task_id is null then
    select task.id into v_task_id
    from public.course_completion_refresh_tasks as task
    where task.dedupe_key = p_dedupe_key
      and task.status in ('pending', 'processing')
    order by task.created_at desc
    limit 1;
  end if;
  return v_task_id;
end;
$$;

revoke all on function private.enqueue_completion_refresh_task(
  text, uuid, uuid, uuid, uuid, uuid, text, text, text, text, uuid, timestamptz
) from public, anon, authenticated;

-- Business-event path: the authoritative row already exists because every
-- caller is an AFTER trigger. Evaluation errors are caught and converted to a
-- durable retry task, so they cannot roll back the business write.
create or replace function private.safe_refresh_student_course_completion(
  p_tenant_id uuid,
  p_student_id uuid,
  p_student_app_id uuid,
  p_course_id uuid,
  p_source_kind text,
  p_source_id text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
  v_task_id uuid;
begin
  if p_tenant_id is null or p_student_id is null or p_student_app_id is null
    or p_course_id is null then
    return;
  end if;

  -- A later policy-publication batch covers events that occur before any
  -- active default policy exists; do not create permanently failing noise.
  if not exists (
    select 1
    from public.course_completion_policies as policy
    where policy.student_app_id = p_student_app_id
      and policy.course_id = p_course_id
      and policy.status = 'published'
      and policy.is_default
      and policy.effective_from <= now()
      and (policy.effective_until is null or policy.effective_until > now())
  ) then
    return;
  end if;

  select * into v_result
  from private.try_evaluate_student_course_completion(
    p_student_id, p_course_id, null
  );

  if not v_result.succeeded then
    begin
      v_task_id := private.enqueue_completion_refresh_task(
        'event_retry', p_tenant_id, p_student_id, p_student_app_id,
        p_course_id, null, p_source_kind, p_source_id,
        p_reason || '（自动刷新失败，等待重试）',
        concat_ws(':', 'event-retry', p_tenant_id, p_student_id, p_course_id),
        null, now()
      );
      update public.course_completion_refresh_tasks
      set last_error = left(v_result.error_code || ': ' || v_result.error_message, 2000),
          updated_at = now()
      where id = v_task_id;
    exception when others then
      -- Queue observability must not become a new reason to reject the
      -- authoritative completion or grade publication.
      null;
    end;
  end if;
exception when others then
  -- This final boundary deliberately isolates all refresh infrastructure from
  -- the business transaction that fired it.
  null;
end;
$$;

revoke all on function private.safe_refresh_student_course_completion(
  uuid, uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;

create or replace function private.refresh_completion_after_ebook_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if new.completed_at is null
    or (tg_op = 'UPDATE' and old.completed_at is not null) then
    return new;
  end if;

  select lesson.course_id into v_course_id
  from public.course_tests as test
  join public.lessons as lesson on lesson.id = test.lesson_id
  join public.courses as course on course.id = lesson.course_id
  where test.slug = new.test_slug
    and course.student_app_id = new.student_app_id
  limit 1;

  perform private.safe_refresh_student_course_completion(
    new.tenant_id, new.student_id, new.student_app_id, v_course_id,
    'course_ebook_progress', new.id::text, '教材章节完成'
  );
  return new;
end;
$$;

create trigger course_ebook_progress_refresh_completion
after insert or update of completion_source, progress_percent,
  reading_seconds, completed_at on public.course_ebook_progress
for each row execute function private.refresh_completion_after_ebook_progress();

create or replace function private.refresh_completion_after_grade_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
begin
  if new.submission_state <> 'grade_released'
    or (tg_op = 'UPDATE' and old.submission_state = 'grade_released') then
    return new;
  end if;

  select * into v_assignment
  from public.learning_assignments
  where id = new.assignment_id and tenant_id = new.tenant_id;

  perform private.safe_refresh_student_course_completion(
    new.tenant_id, new.student_id, v_assignment.student_app_id,
    v_assignment.course_id, 'learning_submission', new.id::text,
    case
      when v_assignment.retake_paper_id is not null
        and v_assignment.retake_starts_at is not null
        and new.submitted_at >= v_assignment.retake_starts_at
        then '补考最终成绩发布'
      when v_assignment.source_paper_code = 'EX-K1-MID-V1'
        then '期中成绩发布'
      when v_assignment.source_paper_code = 'EX-K1-FIN-V1'
        then '期末成绩发布'
      when v_assignment.source_paper_code like 'EX-K1-ST%-V1'
        then '阶段成绩发布'
      when v_assignment.source_paper_code like 'EX-K1-%-V1'
        then '章节成绩发布'
      else '必修作业成绩发布'
    end
  );
  return new;
end;
$$;

create trigger learning_submissions_refresh_completion
after insert or update of submission_state on public.learning_submissions
for each row execute function private.refresh_completion_after_grade_release();

create or replace function private.refresh_completion_after_grade_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.grade_items%rowtype;
  v_course_id uuid;
  v_student_app_id uuid;
begin
  select * into v_item
  from public.grade_items
  where id = new.item_id and tenant_id = new.tenant_id
    and status = 'published' and published_at is not null;
  if v_item.id is null then return new; end if;

  select coalesce(v_item.course_id, assignment.course_id),
    coalesce(course.student_app_id, assignment.student_app_id)
  into v_course_id, v_student_app_id
  from (select 1) as singleton
  left join public.learning_assignments as assignment
    on assignment.id = v_item.source_assignment_id
   and assignment.tenant_id = v_item.tenant_id
  left join public.courses as course
    on course.id = coalesce(v_item.course_id, assignment.course_id);

  perform private.safe_refresh_student_course_completion(
    new.tenant_id, new.student_id, v_student_app_id, v_course_id,
    'grade_record', new.id::text, '已发布成绩记录变更'
  );
  return new;
end;
$$;

create trigger grade_records_refresh_completion
after insert or update of record_status, score on public.grade_records
for each row execute function private.refresh_completion_after_grade_record();

create or replace function private.enqueue_completion_after_grade_item_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_student_app_id uuid;
begin
  if new.status <> 'published' or new.published_at is null
    or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  select coalesce(new.course_id, assignment.course_id),
    coalesce(course.student_app_id, assignment.student_app_id)
  into v_course_id, v_student_app_id
  from (select 1) as singleton
  left join public.learning_assignments as assignment
    on assignment.id = new.source_assignment_id
   and assignment.tenant_id = new.tenant_id
  left join public.courses as course
    on course.id = coalesce(new.course_id, assignment.course_id);

  if v_course_id is null or v_student_app_id is null then return new; end if;
  begin
    perform private.enqueue_completion_refresh_task(
      'grade_item_publish', new.tenant_id, null, v_student_app_id,
      v_course_id, null, 'grade_item', new.id::text,
      '成绩项目发布后的机构批量刷新',
      'grade-item-publish:' || new.id::text || ':' || new.published_at::text,
      auth.uid(), now()
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

create trigger grade_items_enqueue_completion_refresh
after insert or update of status on public.grade_items
for each row execute function private.enqueue_completion_after_grade_item_publish();

create or replace function private.enqueue_completion_after_policy_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published'
    or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  perform private.enqueue_completion_refresh_task(
    'policy_publish', null, null, new.student_app_id, new.course_id,
    new.id, 'course_completion_policy', new.id::text,
    '新结课政策发布后的适用学生批量刷新',
    'policy-publish:' || new.id::text, new.published_by,
    greatest(now(), new.effective_from)
  );
  return new;
end;
$$;

create trigger course_completion_policies_enqueue_refresh
after insert or update of status on public.course_completion_policies
for each row execute function private.enqueue_completion_after_policy_publish();

-- Minimal Round 3 institution entry point. A null student means every active
-- enrollee in the current institution; Round 4 can put a formal UI on this RPC.
create or replace function public.request_institution_course_completion_refresh(
  p_course_id uuid,
  p_student_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_student_app_id uuid;
  v_task_id uuid;
begin
  select course.student_app_id into v_student_app_id
  from public.courses as course where course.id = p_course_id;

  if auth.uid() is null or v_tenant_id is null or v_student_app_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, v_student_app_id, 'manage_assessments'
    ) then
    raise exception '当前账号没有该课程的结课资格刷新权限';
  end if;

  if p_student_id is not null and not exists (
    select 1
    from public.tenant_memberships as membership
    join public.student_app_enrollments as enrollment
      on enrollment.tenant_id = membership.tenant_id
     and enrollment.student_id = membership.user_id
     and enrollment.app_id = v_student_app_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= now()
     and (enrollment.ends_at is null or enrollment.ends_at > now())
    where membership.tenant_id = v_tenant_id
      and membership.user_id = p_student_id
      and membership.role = 'student'
      and membership.status = 'active'
  ) then
    raise exception '该学生不在当前机构或没有该课程应用的有效学籍';
  end if;

  v_task_id := private.enqueue_completion_refresh_task(
    'institution_manual', v_tenant_id, p_student_id, v_student_app_id,
    p_course_id, null, 'institution', v_tenant_id::text,
    case when p_student_id is null then '机构手动批量刷新结课资格'
      else '机构手动刷新单学生结课资格' end,
    'institution-manual:' || gen_random_uuid()::text, auth.uid(), now()
  );
  return v_task_id;
end;
$$;

revoke all on function public.request_institution_course_completion_refresh(
  uuid, uuid
) from public, anon;
grant execute on function public.request_institution_course_completion_refresh(
  uuid, uuid
) to authenticated;

-- Claims up to p_limit tasks once, expands all task scopes with a single set
-- query, and invokes the safe wrapper through LATERAL. There is deliberately no
-- PL/pgSQL student loop and no client-side fan-out.
create or replace function public.process_course_completion_refresh_tasks(
  p_limit integer default 25
)
returns table (
  task_id uuid,
  status text,
  target_count integer,
  succeeded_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_token uuid := gen_random_uuid();
  v_task_ids uuid[] := '{}'::uuid[];
begin
  if auth.role() is distinct from 'service_role' then
    raise exception '只有 service_role 可以执行结课资格刷新任务';
  end if;
  if coalesce(p_limit, 0) not between 1 and 200 then
    raise exception '批量任务数量必须在 1 到 200 之间';
  end if;

  with claimed as (
    update public.course_completion_refresh_tasks as task
    set status = 'processing', worker_token = v_worker_token,
        attempt_count = task.attempt_count + 1,
        started_at = clock_timestamp(), finished_at = null,
        last_error = null, updated_at = now()
    where task.id in (
      select candidate.id
      from public.course_completion_refresh_tasks as candidate
      where candidate.status = 'pending'
        and candidate.available_at <= now()
      order by candidate.available_at, candidate.created_at
      for update skip locked
      limit p_limit
    )
    returning task.id
  )
  select coalesce(array_agg(claimed.id), '{}'::uuid[])
  into v_task_ids
  from claimed;

  insert into public.course_completion_refresh_task_results (
    task_id, student_id, tenant_id, evaluation_id, succeeded,
    error_code, error_message, attempted_at
  )
  with targets as materialized (
    select distinct on (task.id, enrollment.student_id)
      task.id as task_id,
      enrollment.student_id,
      enrollment.tenant_id,
      task.course_id,
      task.policy_id
    from public.course_completion_refresh_tasks as task
    join public.student_app_enrollments as enrollment
      on enrollment.app_id = task.student_app_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= now()
     and (enrollment.ends_at is null or enrollment.ends_at > now())
     and (task.tenant_id is null or enrollment.tenant_id = task.tenant_id)
     and (task.student_id is null or enrollment.student_id = task.student_id)
    join public.tenant_memberships as membership
      on membership.tenant_id = enrollment.tenant_id
     and membership.user_id = enrollment.student_id
     and membership.role = 'student'
     and membership.status = 'active'
    where task.worker_token = v_worker_token
      and task.status = 'processing'
    order by task.id, enrollment.student_id,
      membership.is_default desc, membership.joined_at, enrollment.tenant_id
  ), outcomes as (
    select target.task_id, target.student_id, target.tenant_id,
      result.evaluation_id, result.succeeded,
      result.error_code, result.error_message
    from targets as target
    cross join lateral private.try_evaluate_student_course_completion(
      target.student_id, target.course_id, target.policy_id
    ) as result
  )
  select outcome.task_id, outcome.student_id, outcome.tenant_id,
    outcome.evaluation_id, outcome.succeeded,
    outcome.error_code, outcome.error_message, clock_timestamp()
  from outcomes as outcome
  on conflict on constraint course_completion_refresh_task_results_pkey do update
  set tenant_id = excluded.tenant_id,
      evaluation_id = excluded.evaluation_id,
      succeeded = excluded.succeeded,
      error_code = excluded.error_code,
      error_message = excluded.error_message,
      attempted_at = excluded.attempted_at;

  update public.course_completion_refresh_tasks as task
  set target_count = result.target_count,
      succeeded_count = result.succeeded_count,
      failed_count = result.failed_count,
      status = case
        when result.failed_count = 0 then 'succeeded'
        when result.succeeded_count = 0 then 'failed'
        else 'partial_failed'
      end,
      last_error = result.last_error,
      worker_token = null,
      finished_at = clock_timestamp(),
      updated_at = now()
  from (
    select selected_task.id as task_id,
      count(task_result.student_id)::integer as target_count,
      count(*) filter (where task_result.succeeded)::integer
        as succeeded_count,
      count(*) filter (where not task_result.succeeded)::integer
        as failed_count,
      left(string_agg(
        task_result.error_code || ': ' || task_result.error_message,
        E'\n' order by task_result.student_id
      ) filter (where not task_result.succeeded), 2000) as last_error
    from unnest(v_task_ids) as claimed(task_id)
    join public.course_completion_refresh_tasks as selected_task
      on selected_task.id = claimed.task_id
    left join public.course_completion_refresh_task_results as task_result
      on task_result.task_id = selected_task.id
    group by selected_task.id
  ) as result
  where task.id = result.task_id
    and task.worker_token = v_worker_token
    and task.status = 'processing';

  return query
  select task.id, task.status, task.target_count,
    task.succeeded_count, task.failed_count
  from public.course_completion_refresh_tasks as task
  where task.id = any(v_task_ids)
  order by task.created_at;
end;
$$;

comment on function public.process_course_completion_refresh_tasks(integer) is
  'service_role 批量处理资格刷新任务：SKIP LOCKED 领取，集合查询展开学生，逐学生异常隔离。';

revoke all on function public.process_course_completion_refresh_tasks(integer)
  from public, anon, authenticated;
grant execute on function public.process_course_completion_refresh_tasks(integer)
  to service_role;

commit;
