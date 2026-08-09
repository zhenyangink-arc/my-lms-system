-- ============================================================
-- 老师查看教学数据：放行学习记录 / 成绩 / 会话练习（按负责学生过滤）
--
-- 老师进入成绩、学习记录、会话练习管理页时：
--   1. 相关 RPC / RLS 允许 teacher 读取；
--   2. 数据范围只限 tenant_student_assignments 中该老师负责的学生。
-- ============================================================

begin;

-- 学习记录只读权限：负责人/被授权管理员之外，老师也可查看（范围由查询内过滤）。
create or replace function public.current_user_can_view_learning_records()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_manage_learning_records()
    or (public.is_active_account() and public.current_profile_role() = 'teacher');
$$;

-- 老师可调用两个学习记录 RPC，但查询范围收窄到自己负责的学生。
create or replace function public.list_learning_record_students()
returns table(id uuid, full_name text, email text, membership_tier text)
language plpgsql stable security definer set search_path = 'public'
as $$
begin
  if not public.current_user_can_view_learning_records() then raise exception '当前账号没有学习记录查看权限'; end if;
  return query select profile.id, profile.full_name, profile.email, membership.membership_tier
  from public.tenant_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  where membership.tenant_id = private.current_tenant_id()
    and membership.role = 'student'
    and membership.status = 'active'
    and coalesce(profile.status, 'active') = 'active'
    and (
      public.current_profile_role() <> 'teacher'
      or exists (
        select 1
        from public.tenant_student_assignments as assignment
        where assignment.tenant_id = membership.tenant_id
          and assignment.student_id = membership.user_id
          and assignment.teacher_id = (select auth.uid())
      )
    )
  order by coalesce(profile.full_name, profile.email, profile.id::text);
end;
$$;

create or replace function public.get_tenant_student_learning_record_overview()
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
as $function$
begin
  if not public.current_user_can_view_learning_records() then
    raise exception '当前账号没有学习记录查看权限';
  end if;

  return query
  with active_students as (
    select
      membership.user_id as student_id,
      profile.full_name,
      profile.email,
      membership.membership_tier
    from public.tenant_memberships as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.tenant_id = private.current_tenant_id()
      and membership.role = 'student'
      and membership.status = 'active'
      and coalesce(profile.status, 'active') = 'active'
      and (
        public.current_profile_role() <> 'teacher'
        or exists (
          select 1
          from public.tenant_student_assignments as assignment
          where assignment.tenant_id = membership.tenant_id
            and assignment.student_id = membership.user_id
            and assignment.teacher_id = (select auth.uid())
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
    where progress.tenant_id = private.current_tenant_id()
    group by progress.user_id
  ),
  submission_statistics as (
    select
      submission.student_id,
      count(*)::bigint as submission_count,
      count(*) filter (where submission.status = 'graded')::bigint as graded_count,
      max(coalesce(submission.graded_at, submission.submitted_at)) as latest_at
    from public.learning_submissions as submission
    where submission.tenant_id = private.current_tenant_id()
    group by submission.student_id
  ),
  conversation_statistics as (
    select
      progress.user_id as student_id,
      coalesce(sum(progress.practice_count), 0)::bigint as practice_count,
      max(progress.last_practiced_at) as latest_at
    from public.conversation_practice_progress as progress
    where progress.tenant_id = private.current_tenant_id()
    group by progress.user_id
  ),
  grade_statistics as (
    select
      record.student_id,
      count(*)::bigint as grade_count,
      max(record.graded_at) as latest_at
    from public.grade_records as record
    where record.tenant_id = private.current_tenant_id()
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
$function$;

-- 老师读取自己负责学生的业务数据（成绩/记录/会话进度）。
create policy "teachers read notes of their assigned students"
on public.learning_record_notes for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = learning_record_notes.tenant_id
      and assignment.student_id = learning_record_notes.student_id
      and assignment.teacher_id = (select auth.uid())
  )
);

create policy "teachers read submissions of their assigned students"
on public.learning_submissions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = learning_submissions.tenant_id
      and assignment.student_id = learning_submissions.student_id
      and assignment.teacher_id = (select auth.uid())
  )
);

create policy "teachers read test attempts of their assigned students"
on public.chapter_test_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = chapter_test_attempts.tenant_id
      and assignment.student_id = chapter_test_attempts.student_id
      and assignment.teacher_id = (select auth.uid())
  )
);

create policy "teachers read grade reviews of their assigned students"
on public.grade_review_requests for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = grade_review_requests.tenant_id
      and assignment.student_id = grade_review_requests.student_id
      and assignment.teacher_id = (select auth.uid())
  )
);

create policy "teachers read progress of their assigned students"
on public.conversation_practice_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = conversation_practice_progress.tenant_id
      and assignment.student_id = conversation_practice_progress.user_id
      and assignment.teacher_id = (select auth.uid())
  )
);

grant execute on function public.current_user_can_view_learning_records()
  to authenticated;

commit;
