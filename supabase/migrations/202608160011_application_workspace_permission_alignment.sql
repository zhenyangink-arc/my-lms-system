begin;

-- Application workspaces are authoritative. The older feature-wide grants are
-- kept for legacy screens only and must not veto or widen an app assignment.

create or replace function public.list_learning_assignment_students_by_app(
  p_student_app_id uuid
)
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_staff_has_app_capability(
    private.current_tenant_id(), p_student_app_id, 'manage_assessments'
  ) then
    raise exception '当前账号没有该应用的作业管理权限';
  end if;

  return query
  select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.student_app_enrollments as enrollment
  join public.tenant_memberships as membership
    on membership.tenant_id = enrollment.tenant_id
   and membership.user_id = enrollment.student_id
  join public.profiles as profile on profile.id = enrollment.student_id
  where enrollment.tenant_id = private.current_tenant_id()
    and enrollment.app_id = p_student_app_id
    and enrollment.status = 'active'
    and enrollment.starts_at <= now()
    and (enrollment.ends_at is null or enrollment.ends_at > now())
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
    and (
      public.current_profile_role() <> 'teacher'
      or private.current_teacher_has_student_app_access(
        enrollment.tenant_id, enrollment.student_id, p_student_app_id
      )
    )
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.resolve_grade_review(
  p_review_id uuid,
  p_status text,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_student_id uuid;
  v_app_id uuid;
begin
  select review.student_id, private.grade_review_student_app_id(review.id)
    into v_student_id, v_app_id
  from public.grade_review_requests as review
  where review.id = p_review_id
    and review.tenant_id = v_tenant_id;

  if v_app_id is null
    or not private.current_staff_has_app_capability(
      v_tenant_id, v_app_id, 'manage_assessments'
    )
    or (
      public.current_profile_role() = 'teacher'
      and not private.current_teacher_has_student_app_access(
        v_tenant_id, v_student_id, v_app_id
      )
    ) then
    raise exception '复核申请不存在或当前账号没有该应用的处理权限';
  end if;
  if p_status not in ('reviewing', 'resolved', 'rejected')
    or char_length(trim(coalesce(p_response, ''))) > 3000 then
    raise exception '复核状态或回复不正确';
  end if;

  update public.grade_review_requests
  set status = p_status,
      response = trim(coalesce(p_response, '')),
      handled_by = auth.uid(),
      handled_at = case
        when p_status in ('resolved', 'rejected') then now()
        else null
      end,
      updated_at = now()
  where id = p_review_id
    and tenant_id = v_tenant_id;
end;
$$;

create or replace function public.save_learning_record_note(
  p_id uuid,
  p_student_id uuid,
  p_record_type text,
  p_title text,
  p_content text,
  p_next_action text,
  p_visibility text,
  p_occurred_at timestamptz,
  p_student_app_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid := private.current_tenant_id();
  v_id uuid;
begin
  if not private.current_staff_has_app_capability(
    v_tenant_id, p_student_app_id, 'manage_assessments'
  ) then
    raise exception '当前账号没有该应用的辅导备注管理权限';
  end if;
  if public.current_profile_role() = 'teacher'
    and not private.current_teacher_has_student_app_access(
      v_tenant_id, p_student_id, p_student_app_id
    ) then
    raise exception '只能管理当前应用中自己负责学生的辅导备注';
  end if;
  if not exists (
    select 1
    from public.student_app_enrollments as enrollment
    join public.tenant_memberships as membership
      on membership.tenant_id = enrollment.tenant_id
     and membership.user_id = enrollment.student_id
    where enrollment.tenant_id = v_tenant_id
      and enrollment.student_id = p_student_id
      and enrollment.app_id = p_student_app_id
      and enrollment.status = 'active'
      and enrollment.starts_at <= now()
      and (enrollment.ends_at is null or enrollment.ends_at > now())
      and membership.role = 'student'
      and membership.status = 'active'
  ) then
    raise exception '学生未开通当前应用';
  end if;
  if p_record_type not in (
    'coaching', 'evaluation', 'milestone', 'attention', 'plan'
  ) or p_visibility not in ('student_visible', 'internal') then
    raise exception '记录类型或可见范围不正确';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_content, ''))) not between 2 and 5000
    or char_length(coalesce(p_next_action, '')) > 2000 then
    raise exception '记录标题、内容或下一步建议长度不正确';
  end if;

  if p_id is null then
    insert into public.learning_record_notes (
      tenant_id,
      student_app_id,
      student_id,
      record_type,
      title,
      content,
      next_action,
      visibility,
      occurred_at,
      created_by,
      updated_by
    ) values (
      v_tenant_id,
      p_student_app_id,
      p_student_id,
      p_record_type,
      trim(p_title),
      trim(p_content),
      trim(coalesce(p_next_action, '')),
      p_visibility,
      coalesce(p_occurred_at, now()),
      auth.uid(),
      auth.uid()
    ) returning id into v_id;
  else
    update public.learning_record_notes
    set record_type = p_record_type,
        title = trim(p_title),
        content = trim(p_content),
        next_action = trim(coalesce(p_next_action, '')),
        visibility = p_visibility,
        occurred_at = coalesce(p_occurred_at, occurred_at),
        updated_by = auth.uid(),
        updated_at = now()
    where id = p_id
      and tenant_id = v_tenant_id
      and student_id = p_student_id
      and student_app_id = p_student_app_id
    returning id into v_id;
    if v_id is null then
      raise exception '当前应用中不存在该学习记录';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.change_learning_record_note_status(
  p_note_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note public.learning_record_notes%rowtype;
begin
  select * into v_note
  from public.learning_record_notes
  where id = p_note_id
    and tenant_id = private.current_tenant_id();
  if not found
    or not private.current_staff_has_app_capability(
      v_note.tenant_id, v_note.student_app_id, 'manage_assessments'
    )
    or (
      public.current_profile_role() = 'teacher'
      and not private.current_teacher_has_student_app_access(
        v_note.tenant_id, v_note.student_id, v_note.student_app_id
      )
    ) then
    raise exception '学习记录不存在或当前账号没有该应用的管理权限';
  end if;
  if p_status not in ('active', 'archived') then
    raise exception '学习记录状态不正确';
  end if;

  update public.learning_record_notes
  set status = p_status,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_note_id
    and tenant_id = v_note.tenant_id;
end;
$$;

revoke all on function public.list_learning_assignment_students_by_app(uuid)
  from public, anon;
grant execute on function public.list_learning_assignment_students_by_app(uuid)
  to authenticated, service_role;

revoke all on function public.save_learning_record_note(
  uuid, uuid, text, text, text, text, text, timestamptz
) from authenticated;
revoke all on function public.save_learning_record_note(
  uuid, uuid, text, text, text, text, text, timestamptz, uuid
) from public, anon;
grant execute on function public.save_learning_record_note(
  uuid, uuid, text, text, text, text, text, timestamptz, uuid
) to authenticated, service_role;

revoke all on function public.list_learning_record_students_by_app(uuid)
  from public, anon;
revoke all on function public.get_tenant_student_learning_record_overview_by_app(uuid)
  from public, anon;
grant execute on function public.list_learning_record_students_by_app(uuid)
  to authenticated, service_role;
grant execute on function public.get_tenant_student_learning_record_overview_by_app(uuid)
  to authenticated, service_role;

create or replace function public.current_user_can_view_learning_assignment(
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
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'view_analytics'
        )
        or (
          assignment.status = 'published'
          and public.student_feature_allowed('learning_assignments')
          and private.current_student_has_app_access(
            assignment.tenant_id,
            (select auth.uid()),
            assignment.student_app_id
          )
          and (
            assignment.target_scope = 'all_students'
            or exists (
              select 1
              from public.learning_assignment_targets as target
              where target.assignment_id = assignment.id
                and target.student_id = (select auth.uid())
            )
          )
        )
      )
  );
$$;

drop policy if exists "application users read submissions"
  on public.learning_submissions;
create policy "application users read submissions"
on public.learning_submissions for select to authenticated
using (
  exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = learning_submissions.assignment_id
      and assignment.tenant_id = learning_submissions.tenant_id
      and (
        private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'view_analytics'
        )
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          learning_submissions.student_id,
          assignment.student_app_id
        )
        or (
          learning_submissions.student_id = (select auth.uid())
          and private.current_student_has_app_access(
            assignment.tenant_id,
            learning_submissions.student_id,
            assignment.student_app_id
          )
        )
      )
  )
);

create or replace function public.change_learning_assignment_status(
  p_assignment_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.tenant_id = private.current_tenant_id()
      and private.current_staff_has_app_capability(
        assignment.tenant_id,
        assignment.student_app_id,
        'manage_assessments'
      )
  ) then
    raise exception '任务不存在或当前账号没有该应用的教学管理权限';
  end if;
  if p_status not in ('draft', 'published', 'closed') then
    raise exception '任务状态不正确';
  end if;
  if p_status = 'published' and exists (
    select 1
    from public.learning_assignments
    where id = p_assignment_id
      and tenant_id = private.current_tenant_id()
      and due_at <= now()
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
  where id = p_assignment_id
    and tenant_id = private.current_tenant_id();
end;
$$;

create or replace function public.update_learning_assignment_deadline(
  p_assignment_id uuid,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_due_at is null or p_due_at <= now() then
    raise exception '新的截止时间必须晚于当前时间';
  end if;
  if not exists (
    select 1
    from public.learning_assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.tenant_id = private.current_tenant_id()
      and private.current_staff_has_app_capability(
        assignment.tenant_id,
        assignment.student_app_id,
        'manage_assessments'
      )
  ) then
    raise exception '任务不存在或当前账号没有该应用的教学管理权限';
  end if;

  update public.learning_assignments
  set due_at = p_due_at,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_assignment_id
    and tenant_id = private.current_tenant_id();
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
set search_path = ''
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
  if not exists (
    select 1
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.tenant_id = submission.tenant_id
     and assignment.id = submission.assignment_id
    where submission.id = p_submission_id
      and submission.tenant_id = private.current_tenant_id()
      and private.current_staff_has_app_capability(
        assignment.tenant_id,
        assignment.student_app_id,
        'manage_assessments'
      )
      and (
        public.current_profile_role() <> 'teacher'
        or private.current_teacher_has_student_app_access(
          assignment.tenant_id,
          submission.student_id,
          assignment.student_app_id
        )
      )
  ) then
    raise exception '提交记录不存在或当前账号没有该应用的批改权限';
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
  from public.learning_submission_answers
  where submission_id = p_submission_id;
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
    join public.learning_assignment_questions as question
      on question.id = answer.question_id
    where answer.id = v_answer_id
      and answer.submission_id = p_submission_id;
    if not found then
      raise exception '评分中包含不属于本次提交的答案';
    end if;
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
  where id = p_submission_id
    and tenant_id = private.current_tenant_id();
end;
$$;

create or replace function public.list_learning_record_students_by_app(
  p_student_app_id uuid
)
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_staff_has_app_capability(
    private.current_tenant_id(), p_student_app_id, 'view_analytics'
  ) then
    raise exception '当前账号没有该应用的数据权限';
  end if;

  return query
  select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.student_app_enrollments as enrollment
  join public.tenant_memberships as membership
    on membership.tenant_id = enrollment.tenant_id
   and membership.user_id = enrollment.student_id
  join public.profiles as profile on profile.id = enrollment.student_id
  where enrollment.tenant_id = private.current_tenant_id()
    and enrollment.app_id = p_student_app_id
    and enrollment.status = 'active'
    and enrollment.starts_at <= now()
    and (enrollment.ends_at is null or enrollment.ends_at > now())
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
    and (
      public.current_profile_role() <> 'teacher'
      or private.current_teacher_has_student_app_access(
        enrollment.tenant_id, enrollment.student_id, p_student_app_id
      )
    )
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.get_tenant_student_learning_record_overview_by_app(
  p_student_app_id uuid
)
returns table (
  student_id uuid,
  full_name text,
  email text,
  membership_tier text,
  completed_lesson_count bigint,
  active_lesson_count bigint,
  submission_count bigint,
  graded_submission_count bigint,
  conversation_practice_count bigint,
  grade_count bigint,
  note_count bigint,
  attention_count bigint,
  last_learning_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_staff_has_app_capability(
    private.current_tenant_id(), p_student_app_id, 'view_analytics'
  ) then
    raise exception '当前账号没有该应用的数据权限';
  end if;

  return query
  with active_students as (
    select
      enrollment.student_id,
      profile.full_name,
      profile.email,
      membership.membership_tier
    from public.student_app_enrollments as enrollment
    join public.tenant_memberships as membership
      on membership.tenant_id = enrollment.tenant_id
     and membership.user_id = enrollment.student_id
    join public.profiles as profile on profile.id = enrollment.student_id
    where enrollment.tenant_id = private.current_tenant_id()
      and enrollment.app_id = p_student_app_id
      and enrollment.status = 'active'
      and enrollment.starts_at <= now()
      and (enrollment.ends_at is null or enrollment.ends_at > now())
      and membership.role = 'student'
      and membership.status = 'active'
      and coalesce(profile.status, 'active') = 'active'
      and (
        public.current_profile_role() <> 'teacher'
        or private.current_teacher_has_student_app_access(
          enrollment.tenant_id, enrollment.student_id, p_student_app_id
        )
      )
  ),
  lesson_statistics as (
    select
      progress.user_id as student_id,
      count(*) filter (where progress.status = 'completed')::bigint as completed_count,
      count(*) filter (where progress.status <> 'completed')::bigint as active_count,
      max(coalesce(progress.completed_at, progress.last_viewed_at, progress.updated_at)) as latest_at
    from public.lesson_progress as progress
    join public.courses as course on course.id = progress.course_id
    where progress.tenant_id = private.current_tenant_id()
      and course.student_app_id = p_student_app_id
    group by progress.user_id
  ),
  submission_statistics as (
    select
      submission.student_id,
      count(*)::bigint as submission_count,
      count(*) filter (where submission.status = 'graded')::bigint as graded_count,
      max(coalesce(submission.graded_at, submission.submitted_at)) as latest_at
    from public.learning_submissions as submission
    join public.learning_assignments as assignment
      on assignment.id = submission.assignment_id
    where submission.tenant_id = private.current_tenant_id()
      and assignment.student_app_id = p_student_app_id
    group by submission.student_id
  ),
  conversation_statistics as (
    select
      progress.user_id as student_id,
      coalesce(sum(progress.practice_count), 0)::bigint as practice_count,
      max(progress.last_practiced_at) as latest_at
    from public.conversation_practice_progress as progress
    join public.conversation_practice_scenarios as scenario
      on scenario.id = progress.scenario_id
    where progress.tenant_id = private.current_tenant_id()
      and scenario.student_app_id = p_student_app_id
    group by progress.user_id
  ),
  grade_statistics as (
    select
      record.student_id,
      count(*)::bigint as grade_count,
      max(record.graded_at) as latest_at
    from public.grade_records as record
    join public.grade_items as item on item.id = record.item_id
    left join public.courses as course on course.id = item.course_id
    left join public.learning_assignments as assignment
      on assignment.id = item.source_assignment_id
    where record.tenant_id = private.current_tenant_id()
      and coalesce(course.student_app_id, assignment.student_app_id) = p_student_app_id
    group by record.student_id
  ),
  note_statistics as (
    select
      note.student_id,
      count(*) filter (where note.status = 'active')::bigint as note_count,
      count(*) filter (
        where note.status = 'active' and note.record_type = 'attention'
      )::bigint as attention_count
    from public.learning_record_notes as note
    where note.tenant_id = private.current_tenant_id()
      and note.student_app_id = p_student_app_id
    group by note.student_id
  )
  select
    student.student_id,
    student.full_name,
    student.email,
    student.membership_tier,
    coalesce(lesson.completed_count, 0)::bigint,
    coalesce(lesson.active_count, 0)::bigint,
    coalesce(submission.submission_count, 0)::bigint,
    coalesce(submission.graded_count, 0)::bigint,
    coalesce(conversation.practice_count, 0)::bigint,
    coalesce(grade_record.grade_count, 0)::bigint,
    coalesce(note.note_count, 0)::bigint,
    coalesce(note.attention_count, 0)::bigint,
    greatest(
      lesson.latest_at,
      submission.latest_at,
      conversation.latest_at,
      grade_record.latest_at
    )
  from active_students as student
  left join lesson_statistics as lesson on lesson.student_id = student.student_id
  left join submission_statistics as submission on submission.student_id = student.student_id
  left join conversation_statistics as conversation on conversation.student_id = student.student_id
  left join grade_statistics as grade_record on grade_record.student_id = student.student_id
  left join note_statistics as note on note.student_id = student.student_id
  order by coalesce(student.full_name, student.email, student.student_id::text);
end;
$$;

commit;
