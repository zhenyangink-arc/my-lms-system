begin;

-- 学生学习档案不单独创建空记录，而是以机构中的有效学生成员关系为基础，
-- 动态汇总课程、作业、会话、成绩和人工辅导备注。
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
  if not public.current_user_can_manage_learning_records() then
    raise exception '当前账号没有学习记录管理权限';
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

revoke all on function public.get_tenant_student_learning_record_overview()
  from public, anon;
grant execute on function public.get_tenant_student_learning_record_overview()
  to authenticated;

comment on function public.get_tenant_student_learning_record_overview() is
  '机构学习记录管理表：每个有效学生账号自动形成一行，并汇总真实学习活动与辅导备注。';

commit;
