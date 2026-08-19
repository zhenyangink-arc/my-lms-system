begin;

-- Packet 10: one database round trip builds the teacher's application-scoped
-- roster, task facts, student rollups, and class summary. The function never
-- accepts a teacher id from the caller: auth.uid() is the only teacher scope.
create or replace function public.get_teacher_class_today_snapshot(
  p_tenant_id uuid,
  p_student_app_id uuid,
  p_student_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_teacher_id uuid := (select auth.uid());
  v_today_start timestamptz;
  v_tomorrow_start timestamptz;
begin
  if v_teacher_id is null
    or p_tenant_id is distinct from (select private.current_tenant_id())
    or not exists (
      select 1
      from public.tenant_memberships as membership
      join public.profiles as profile on profile.id = membership.user_id
      where membership.tenant_id = p_tenant_id
        and membership.user_id = v_teacher_id
        and membership.role = 'teacher'
        and membership.status = 'active'
        and coalesce(profile.status, 'active') = 'active'
    )
    or not private.current_staff_has_app_capability(
      p_tenant_id,
      p_student_app_id,
      'view_analytics'
    ) then
    raise exception using
      errcode = '42501',
      message = '当前老师没有查看该应用班级数据的权限';
  end if;

  -- A deep link is rejected before any student profile or task row is read.
  if p_student_id is not null
    and not private.current_teacher_has_student_app_access(
      p_tenant_id,
      p_student_id,
      p_student_app_id
    ) then
    raise exception using
      errcode = '42501',
      message = '该学生不在当前老师的教学分配范围内';
  end if;

  v_today_start := date_trunc('day', p_now at time zone 'Asia/Seoul')
    at time zone 'Asia/Seoul';
  v_tomorrow_start := v_today_start + interval '1 day';

  return (
    with authorized_students as materialized (
      select distinct on (assignment.student_id)
        assignment.student_id,
        profile.full_name,
        profile.login_id,
        greatest(assignment.created_at, enrollment.starts_at) as tracking_started_at
      from public.tenant_student_assignments as assignment
      join public.student_app_enrollments as enrollment
        on enrollment.tenant_id = assignment.tenant_id
       and enrollment.student_id = assignment.student_id
       and enrollment.app_id = assignment.student_app_id
      join public.tenant_memberships as membership
        on membership.tenant_id = assignment.tenant_id
       and membership.user_id = assignment.student_id
       and membership.role = 'student'
       and membership.status = 'active'
      join public.profiles as profile
        on profile.id = assignment.student_id
       and coalesce(profile.status, 'active') = 'active'
      where assignment.tenant_id = p_tenant_id
        and assignment.teacher_id = v_teacher_id
        and assignment.student_app_id = p_student_app_id
        and (p_student_id is null or assignment.student_id = p_student_id)
        and enrollment.status = 'active'
        and enrollment.starts_at <= p_now
        and (enrollment.ends_at is null or enrollment.ends_at > p_now)
        and private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          assignment.student_id,
          assignment.student_app_id
        )
      order by assignment.student_id, assignment.created_at desc
    ),
    activity_rollups as materialized (
      select
        student.student_id,
        max(activity.occurred_at) as last_activity_at,
        coalesce(
          bool_or(
            activity.occurred_at >= v_today_start
            and activity.occurred_at < v_tomorrow_start
          ),
          false
        ) as studied_today
      from authorized_students as student
      left join public.student_learning_activity_events as activity
        on activity.tenant_id = p_tenant_id
       and activity.student_id = student.student_id
       and activity.student_app_id = p_student_app_id
       -- Teacher-side grading/revision events are written into the student's
       -- timeline for history, but they are not evidence that the student
       -- studied today and must not reset the no-learning streak.
       and activity.event_type not in (
         'assignment_graded',
         'assignment_revision_required'
       )
      group by student.student_id
    ),
    assignment_audience as materialized (
      select
        student.student_id,
        assignment.id as assignment_id,
        assignment.title,
        assignment.assignment_type,
        assignment.starts_at,
        case
          when assignment.unlock_after_chapter_completion
            and chapter_progress.completed_at is not null
            and coalesce(assignment.due_days_after_unlock, 0) > 0
            then chapter_progress.completed_at
              + make_interval(days => assignment.due_days_after_unlock)
          else assignment.due_at
        end as effective_due_at,
        assignment.allow_late_submission,
        assignment.unlock_after_chapter_completion,
        chapter_progress.completed_at as chapter_completed_at,
        progress.progress_state,
        progress.updated_at as progress_updated_at
      from authorized_students as student
      join public.learning_assignments as assignment
        on assignment.tenant_id = p_tenant_id
       and assignment.student_app_id = p_student_app_id
       and assignment.status = 'published'
       and assignment.assignment_type in ('homework', 'exam')
       and (
         assignment.target_scope = 'all_students'
         or exists (
           select 1
           from public.learning_assignment_targets as target
           where target.assignment_id = assignment.id
             and target.student_id = student.student_id
         )
       )
      left join public.learning_assignment_progress as progress
        on progress.tenant_id = assignment.tenant_id
       and progress.assignment_id = assignment.id
       and progress.student_id = student.student_id
      left join public.course_ebook_progress as chapter_progress
        on chapter_progress.tenant_id = assignment.tenant_id
       and chapter_progress.student_id = student.student_id
       and chapter_progress.student_app_id = assignment.student_app_id
       and chapter_progress.test_slug = assignment.unlock_test_slug
       and chapter_progress.completed_at is not null
    ),
    task_statuses as materialized (
      select
        audience.*,
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
    task_facts as materialized (
      select
        task.*,
        (
          (task.starts_at >= v_today_start and task.starts_at < v_tomorrow_start)
          or (
            task.effective_due_at >= v_today_start
            and task.effective_due_at < v_tomorrow_start
          )
          or (
            task.task_status = 'overdue'
            and task.allow_late_submission
          )
        ) as is_required_today
      from task_statuses as task
    ),
    student_rollups as materialized (
      select
        student.student_id,
        student.full_name,
        student.login_id,
        activity.studied_today,
        activity.last_activity_at,
        greatest(
          0,
          (v_today_start at time zone 'Asia/Seoul')::date
            - (
                coalesce(activity.last_activity_at, student.tracking_started_at)
                at time zone 'Asia/Seoul'
              )::date
        )::integer as inactive_days,
        count(task.assignment_id) filter (where task.is_required_today)::integer
          as required_task_total,
        count(task.assignment_id) filter (
          where task.is_required_today and task.task_status = 'completed'
        )::integer as required_task_completed,
        count(task.assignment_id) filter (
          where task.is_required_today
            and task.task_status in ('not_started', 'locked')
        )::integer as not_started_task_count,
        count(task.assignment_id) filter (
          where task.is_required_today and task.task_status = 'in_progress'
        )::integer as in_progress_task_count,
        count(task.assignment_id) filter (
          where task.is_required_today and task.task_status = 'completed'
        )::integer as completed_task_count,
        count(task.assignment_id) filter (
          where task.task_status = 'overdue'
        )::integer as overdue_task_count,
        count(task.assignment_id) filter (
          where task.task_status = 'pending_grading'
        )::integer as pending_grading_task_count
      from authorized_students as student
      join activity_rollups as activity on activity.student_id = student.student_id
      left join task_facts as task on task.student_id = student.student_id
      group by
        student.student_id,
        student.full_name,
        student.login_id,
        student.tracking_started_at,
        activity.studied_today,
        activity.last_activity_at
    ),
    class_summary as (
      select
        count(*)::integer as student_count,
        count(*) filter (where studied_today)::integer as studied_today_count,
        coalesce(sum(required_task_total), 0)::integer as required_task_total,
        coalesce(sum(required_task_completed), 0)::integer
          as required_task_completed,
        count(*) filter (where not_started_task_count > 0)::integer
          as not_started_count,
        count(*) filter (where in_progress_task_count > 0)::integer
          as in_progress_count,
        count(*) filter (where completed_task_count > 0)::integer
          as completed_count,
        count(*) filter (where overdue_task_count > 0)::integer
          as overdue_count,
        count(*) filter (where pending_grading_task_count > 0)::integer
          as pending_grading_count,
        count(*) filter (where inactive_days >= 3)::integer
          as continuous_no_learning_count
      from student_rollups
    )
    select jsonb_build_object(
      'generated_at', p_now,
      'summary', jsonb_build_object(
        'student_count', summary.student_count,
        'studied_today_count', summary.studied_today_count,
        'required_task_total', summary.required_task_total,
        'required_task_completed', summary.required_task_completed,
        'required_completion_rate', case
          when summary.required_task_total = 0 then 0
          else round(
            summary.required_task_completed::numeric
              * 100 / summary.required_task_total,
            1
          )
        end,
        'not_started_count', summary.not_started_count,
        'in_progress_count', summary.in_progress_count,
        'completed_count', summary.completed_count,
        'overdue_count', summary.overdue_count,
        'pending_grading_count', summary.pending_grading_count,
        'continuous_no_learning_count', summary.continuous_no_learning_count
      ),
      'students', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'student_id', student.student_id,
            'full_name', student.full_name,
            'login_id', student.login_id,
            'studied_today', student.studied_today,
            'last_activity_at', student.last_activity_at,
            'inactive_days', student.inactive_days,
            'continuous_no_learning', student.inactive_days >= 3,
            'required_task_total', student.required_task_total,
            'required_task_completed', student.required_task_completed,
            'not_started_task_count', student.not_started_task_count,
            'in_progress_task_count', student.in_progress_task_count,
            'completed_task_count', student.completed_task_count,
            'overdue_task_count', student.overdue_task_count,
            'pending_grading_task_count', student.pending_grading_task_count
          )
          order by coalesce(student.full_name, student.login_id, student.student_id::text)
        )
        from student_rollups as student
      ), '[]'::jsonb),
      'tasks', case
        when p_student_id is null then '[]'::jsonb
        else coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'assignment_id', task.assignment_id,
              'title', task.title,
              'assignment_type', task.assignment_type,
              'status', task.task_status,
              'starts_at', task.starts_at,
              'due_at', task.effective_due_at,
              'is_required_today', task.is_required_today
            )
            order by
              task.is_required_today desc,
              task.effective_due_at,
              task.assignment_id
          )
          from task_facts as task
          where task.student_id = p_student_id
            and (
              task.is_required_today
              or task.task_status in ('overdue', 'pending_grading', 'in_progress')
            )
        ), '[]'::jsonb)
      end
    )
    from class_summary as summary
  );
end;
$$;

revoke all on function public.get_teacher_class_today_snapshot(
  uuid,
  uuid,
  uuid,
  timestamptz
) from public, anon;
grant execute on function public.get_teacher_class_today_snapshot(
  uuid,
  uuid,
  uuid,
  timestamptz
) to authenticated;

comment on function public.get_teacher_class_today_snapshot(
  uuid,
  uuid,
  uuid,
  timestamptz
) is
  '老师班级今日只读快照：按应用级教学分配授权，以单次聚合查询返回汇总、学生状态与可选学生明细。';

commit;
