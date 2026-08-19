begin;

-- Packet 11: a single aggregate query serves both institution owners and the
-- global platform owner. No caller-supplied user id or institution list can
-- widen the scope selected from the authenticated database identity.
create or replace function public.get_institution_platform_learning_overview(
  p_tenant_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_tenant_id uuid := private.current_tenant_id();
  v_is_platform_owner boolean := private.is_platform_owner();
  v_scope text;
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = '当前账号无权查看学习概览';
  end if;

  if v_is_platform_owner then
    if p_tenant_id is not null then
      raise exception using
        errcode = '42501',
        message = '平台负责人只能使用全局机构汇总入口';
    end if;
    v_scope := 'platform';
  else
    if p_tenant_id is null
      or p_tenant_id is distinct from v_current_tenant_id
      or not exists (
        select 1
        from public.tenant_memberships as membership
        join public.profiles as profile on profile.id = membership.user_id
        where membership.tenant_id = p_tenant_id
          and membership.user_id = v_user_id
          and membership.role = 'tenant_super_admin'
          and membership.status = 'active'
          and coalesce(profile.status, 'active') = 'active'
      ) then
      raise exception using
        errcode = '42501',
        message = '机构负责人只能查看自己的当前机构';
    end if;
    v_scope := 'institution';
  end if;

  v_today_start := date_trunc('day', p_now at time zone 'Asia/Seoul')
    at time zone 'Asia/Seoul';
  v_tomorrow_start := v_today_start + interval '1 day';

  return (
    with authorized_tenants as materialized (
      select tenant.id, tenant.name
      from public.tenants as tenant
      where tenant.status = 'active'
        and (v_is_platform_owner or tenant.id = p_tenant_id)
    ),
    active_students as materialized (
      select membership.tenant_id, membership.user_id as student_id
      from public.tenant_memberships as membership
      join authorized_tenants as tenant on tenant.id = membership.tenant_id
      join public.profiles as profile on profile.id = membership.user_id
      where membership.role = 'student'
        and membership.status = 'active'
        and coalesce(profile.status, 'active') = 'active'
        and exists (
          select 1
          from public.student_app_enrollments as enrollment
          where enrollment.tenant_id = membership.tenant_id
            and enrollment.student_id = membership.user_id
            and enrollment.status = 'active'
            and enrollment.starts_at <= p_now
            and (enrollment.ends_at is null or enrollment.ends_at > p_now)
        )
    ),
    active_enrollments as materialized (
      select enrollment.tenant_id, enrollment.student_id,
        enrollment.app_id as student_app_id
      from public.student_app_enrollments as enrollment
      join active_students as student
        on student.tenant_id = enrollment.tenant_id
       and student.student_id = enrollment.student_id
      where enrollment.status = 'active'
        and enrollment.starts_at <= p_now
        and (enrollment.ends_at is null or enrollment.ends_at > p_now)
    ),
    activity_students as materialized (
      select distinct activity.tenant_id, activity.student_id
      from public.student_learning_activity_events as activity
      join active_students as student
        on student.tenant_id = activity.tenant_id
       and student.student_id = activity.student_id
      where activity.occurred_at >= v_today_start
        and activity.occurred_at < v_tomorrow_start
        and activity.event_type not in (
          'assignment_graded',
          'assignment_revision_required'
        )
    ),
    submission_rollups as materialized (
      select submission.tenant_id, submission.assignment_id,
        submission.student_id, min(submission.submitted_at) as first_submitted_at
      from public.learning_submissions as submission
      join authorized_tenants as tenant on tenant.id = submission.tenant_id
      group by submission.tenant_id, submission.assignment_id,
        submission.student_id
    ),
    chapter_completions as materialized (
      select progress.tenant_id, progress.student_id, progress.student_app_id,
        progress.test_slug, max(progress.completed_at) as completed_at
      from public.course_ebook_progress as progress
      join authorized_tenants as tenant on tenant.id = progress.tenant_id
      where progress.completed_at is not null
      group by progress.tenant_id, progress.student_id,
        progress.student_app_id, progress.test_slug
    ),
    assignment_audience as materialized (
      select
        enrollment.tenant_id,
        enrollment.student_id,
        enrollment.student_app_id,
        assignment.id as assignment_id,
        assignment.assignment_type,
        assignment.starts_at,
        case
          when assignment.unlock_after_chapter_completion
            and completion.completed_at is not null
            and coalesce(assignment.due_days_after_unlock, 0) > 0
            then completion.completed_at
              + make_interval(days => assignment.due_days_after_unlock)
          else assignment.due_at
        end as effective_due_at,
        assignment.allow_late_submission,
        assignment.unlock_after_chapter_completion,
        completion.completed_at as chapter_completed_at,
        progress.progress_state,
        submission.first_submitted_at,
        counter.current_attempt_started_at
      from active_enrollments as enrollment
      join public.learning_assignments as assignment
        on assignment.tenant_id = enrollment.tenant_id
       and assignment.student_app_id = enrollment.student_app_id
       and assignment.status = 'published'
       and assignment.assignment_type in ('homework', 'exam')
       and (
         assignment.target_scope = 'all_students'
         or exists (
           select 1
           from public.learning_assignment_targets as target
           where target.assignment_id = assignment.id
             and target.student_id = enrollment.student_id
         )
       )
      left join chapter_completions as completion
        on completion.tenant_id = assignment.tenant_id
       and completion.student_id = enrollment.student_id
       and completion.student_app_id = assignment.student_app_id
       and completion.test_slug = assignment.unlock_test_slug
      left join public.learning_assignment_progress as progress
        on progress.tenant_id = assignment.tenant_id
       and progress.assignment_id = assignment.id
       and progress.student_id = enrollment.student_id
      left join submission_rollups as submission
        on submission.tenant_id = assignment.tenant_id
       and submission.assignment_id = assignment.id
       and submission.student_id = enrollment.student_id
      left join public.learning_assignment_submission_counters as counter
        on counter.tenant_id = assignment.tenant_id
       and counter.assignment_id = assignment.id
       and counter.student_id = enrollment.student_id
    ),
    assignment_statuses as materialized (
      select audience.*,
        case
          when audience.progress_state in ('grading_completed', 'grade_released')
            then 'completed'
          when audience.progress_state in (
            'submitted_pending_grading',
            'objective_graded_pending_manual'
          ) then 'pending_grading'
          when (
            audience.unlock_after_chapter_completion
            and audience.chapter_completed_at is null
          ) or audience.starts_at > p_now then 'locked'
          when audience.effective_due_at < p_now then 'overdue'
          when audience.progress_state in ('in_progress', 'revision_required')
            then 'in_progress'
          else 'not_started'
        end as task_status
      from assignment_audience as audience
    ),
    assignment_facts as materialized (
      select status.*,
        (
          (status.starts_at >= v_today_start
            and status.starts_at < v_tomorrow_start)
          or (status.effective_due_at >= v_today_start
            and status.effective_due_at < v_tomorrow_start)
          or (status.task_status = 'overdue' and status.allow_late_submission)
        ) as is_required_today
      from assignment_statuses as status
    ),
    student_counts as (
      select student.tenant_id, count(*)::integer as student_count
      from active_students as student
      group by student.tenant_id
    ),
    activity_counts as (
      select activity.tenant_id, count(*)::integer as active_count
      from activity_students as activity
      group by activity.tenant_id
    ),
    assignment_counts as (
      select fact.tenant_id,
        count(*) filter (where fact.is_required_today)::integer
          as required_task_total,
        count(*) filter (
          where fact.is_required_today and fact.task_status = 'completed'
        )::integer as required_task_completed,
        count(*) filter (
          where fact.assignment_type = 'homework'
            and fact.effective_due_at <= p_now
        )::integer as homework_due_total,
        count(*) filter (
          where fact.assignment_type = 'homework'
            and fact.effective_due_at <= p_now
            and fact.first_submitted_at <= fact.effective_due_at
        )::integer as homework_on_time_count,
        count(*) filter (
          where fact.assignment_type = 'exam' and fact.starts_at <= p_now
        )::integer as exam_eligible_total,
        count(*) filter (
          where fact.assignment_type = 'exam'
            and fact.starts_at <= p_now
            and (
              fact.first_submitted_at is not null
              or fact.current_attempt_started_at is not null
            )
        )::integer as exam_participated_count
      from assignment_facts as fact
      group by fact.tenant_id
    ),
    practice_counts as (
      select progress.tenant_id,
        count(distinct progress.student_id)::integer as user_count
      from public.student_chapter_practice_progress as progress
      join active_students as student
        on student.tenant_id = progress.tenant_id
       and student.student_id = progress.student_id
      where progress.status in ('in_progress', 'needs_reinforcement', 'mastered')
        or progress.started_at is not null
        or progress.last_practiced_at is not null
      group by progress.tenant_id
    ),
    review_counts as (
      select review.tenant_id,
        count(distinct review.student_id)::integer as user_count
      from public.student_review_items as review
      join active_students as student
        on student.tenant_id = review.tenant_id
       and student.student_id = review.student_id
      where review.status in ('reviewing', 'mastered')
        or review.last_reviewed_at is not null
      group by review.tenant_id
    ),
    class_roster as materialized (
      select distinct assignment.tenant_id, assignment.teacher_id,
        assignment.student_app_id, assignment.student_id,
        coalesce(
          nullif(btrim(teacher.full_name), ''),
          nullif(btrim(teacher.login_id), ''),
          '老师 ' || right(assignment.teacher_id::text, 6)
        ) || ' · ' || app.short_title as class_name
      from public.tenant_student_assignments as assignment
      join active_enrollments as enrollment
        on enrollment.tenant_id = assignment.tenant_id
       and enrollment.student_id = assignment.student_id
       and enrollment.student_app_id = assignment.student_app_id
      join public.tenant_memberships as teacher_membership
        on teacher_membership.tenant_id = assignment.tenant_id
       and teacher_membership.user_id = assignment.teacher_id
       and teacher_membership.role = 'teacher'
       and teacher_membership.status = 'active'
      join public.profiles as teacher
        on teacher.id = assignment.teacher_id
       and coalesce(teacher.status, 'active') = 'active'
      join public.student_apps as app on app.id = assignment.student_app_id
    ),
    class_activity as (
      select roster.tenant_id, roster.teacher_id, roster.student_app_id,
        count(distinct roster.student_id) filter (
          where activity.student_id is not null
        )::integer as active_count
      from class_roster as roster
      left join public.student_learning_activity_events as activity
        on activity.tenant_id = roster.tenant_id
       and activity.student_id = roster.student_id
       and activity.student_app_id = roster.student_app_id
       and activity.occurred_at >= v_today_start
       and activity.occurred_at < v_tomorrow_start
       and activity.event_type not in (
         'assignment_graded',
         'assignment_revision_required'
       )
      group by roster.tenant_id, roster.teacher_id, roster.student_app_id
    ),
    class_tasks as (
      select roster.tenant_id, roster.teacher_id, roster.student_app_id,
        count(fact.assignment_id) filter (where fact.is_required_today)::integer
          as required_task_total,
        count(fact.assignment_id) filter (
          where fact.is_required_today and fact.task_status = 'completed'
        )::integer as required_task_completed
      from class_roster as roster
      left join assignment_facts as fact
        on fact.tenant_id = roster.tenant_id
       and fact.student_id = roster.student_id
       and fact.student_app_id = roster.student_app_id
      group by roster.tenant_id, roster.teacher_id, roster.student_app_id
    ),
    class_rollups as (
      select roster.tenant_id, roster.teacher_id, roster.student_app_id,
        min(roster.class_name) as class_name,
        count(distinct roster.student_id)::integer as student_count,
        coalesce(activity.active_count, 0)::integer as active_count,
        coalesce(task.required_task_total, 0)::integer as required_task_total,
        coalesce(task.required_task_completed, 0)::integer
          as required_task_completed
      from class_roster as roster
      left join class_activity as activity
        on activity.tenant_id = roster.tenant_id
       and activity.teacher_id = roster.teacher_id
       and activity.student_app_id = roster.student_app_id
      left join class_tasks as task
        on task.tenant_id = roster.tenant_id
       and task.teacher_id = roster.teacher_id
       and task.student_app_id = roster.student_app_id
      group by roster.tenant_id, roster.teacher_id, roster.student_app_id,
        activity.active_count, task.required_task_total,
        task.required_task_completed
    ),
    class_json as (
      select class.tenant_id,
        jsonb_agg(
          jsonb_build_object(
            'class_key', class.teacher_id::text || ':' || class.student_app_id::text,
            'class_name', class.class_name,
            'teacher_id', class.teacher_id,
            'student_app_id', class.student_app_id,
            'student_count', class.student_count,
            'active_count', class.active_count,
            'active_rate', case when class.student_count = 0 then 0 else
              round(class.active_count::numeric * 100 / class.student_count, 1)
            end,
            'required_task_total', class.required_task_total,
            'required_task_completed', class.required_task_completed,
            'required_completion_rate', case
              when class.required_task_total = 0 then 0 else round(
                class.required_task_completed::numeric * 100
                  / class.required_task_total,
                1
              )
            end
          )
          order by class.class_name, class.teacher_id, class.student_app_id
        ) as classes
      from class_rollups as class
      group by class.tenant_id
    ),
    institution_rows as (
      select tenant.id, tenant.name,
        coalesce(student.student_count, 0)::integer as student_count,
        coalesce(activity.active_count, 0)::integer as active_count,
        coalesce(assignment.required_task_total, 0)::integer
          as required_task_total,
        coalesce(assignment.required_task_completed, 0)::integer
          as required_task_completed,
        coalesce(assignment.homework_due_total, 0)::integer
          as homework_due_total,
        coalesce(assignment.homework_on_time_count, 0)::integer
          as homework_on_time_count,
        coalesce(assignment.exam_eligible_total, 0)::integer
          as exam_eligible_total,
        coalesce(assignment.exam_participated_count, 0)::integer
          as exam_participated_count,
        coalesce(practice.user_count, 0)::integer as chapter_practice_user_count,
        coalesce(review.user_count, 0)::integer as review_user_count,
        coalesce(class_json.classes, '[]'::jsonb) as classes
      from authorized_tenants as tenant
      left join student_counts as student on student.tenant_id = tenant.id
      left join activity_counts as activity on activity.tenant_id = tenant.id
      left join assignment_counts as assignment on assignment.tenant_id = tenant.id
      left join practice_counts as practice on practice.tenant_id = tenant.id
      left join review_counts as review on review.tenant_id = tenant.id
      left join class_json on class_json.tenant_id = tenant.id
    )
    select jsonb_build_object(
      'generated_at', p_now,
      'scope', v_scope,
      'institutions', coalesce(jsonb_agg(
        jsonb_build_object(
          'tenant_id', institution.id,
          'tenant_name', institution.name,
          'student_count', institution.student_count,
          'active_count', institution.active_count,
          'active_rate', case when institution.student_count = 0 then 0 else
            round(institution.active_count::numeric * 100
              / institution.student_count, 1)
          end,
          'required_task_total', institution.required_task_total,
          'required_task_completed', institution.required_task_completed,
          'required_completion_rate', case
            when institution.required_task_total = 0 then 0 else round(
              institution.required_task_completed::numeric * 100
                / institution.required_task_total,
              1
            )
          end,
          'homework_due_total', institution.homework_due_total,
          'homework_on_time_count', institution.homework_on_time_count,
          'homework_on_time_rate', case
            when institution.homework_due_total = 0 then 0 else round(
              institution.homework_on_time_count::numeric * 100
                / institution.homework_due_total,
              1
            )
          end,
          'exam_eligible_total', institution.exam_eligible_total,
          'exam_participated_count', institution.exam_participated_count,
          'exam_participation_rate', case
            when institution.exam_eligible_total = 0 then 0 else round(
              institution.exam_participated_count::numeric * 100
                / institution.exam_eligible_total,
              1
            )
          end,
          'chapter_practice_user_count', institution.chapter_practice_user_count,
          'chapter_practice_usage_rate', case
            when institution.student_count = 0 then 0 else round(
              institution.chapter_practice_user_count::numeric * 100
                / institution.student_count,
              1
            )
          end,
          'review_user_count', institution.review_user_count,
          'review_usage_rate', case
            when institution.student_count = 0 then 0 else round(
              institution.review_user_count::numeric * 100
                / institution.student_count,
              1
            )
          end,
          'classes', case
            when v_scope = 'institution' then institution.classes
            else '[]'::jsonb
          end
        ) order by institution.name, institution.id
      ), '[]'::jsonb)
    )
    from institution_rows as institution
  );
end;
$$;

revoke all on function public.get_institution_platform_learning_overview(
  uuid,
  timestamptz
) from public, anon;
grant execute on function public.get_institution_platform_learning_overview(
  uuid,
  timestamptz
) to authenticated;

comment on function public.get_institution_platform_learning_overview(
  uuid,
  timestamptz
) is
  'Packet 11 单次聚合：机构负责人仅本机构，平台负责人读取全部正常机构的匿名使用对比。';

commit;
