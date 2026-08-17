begin;

-- lesson_progress is tenant-owned even when the completed lesson comes from the
-- shared platform catalog. Resolve the application from either tenant content
-- or platform content, while still rejecting content owned by another tenant.
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
    on course.id = lesson.course_id
   and (
     course.tenant_id is null
     or course.tenant_id = new.tenant_id
   )
  where lesson.id = new.lesson_id
    and (
      lesson.tenant_id is null
      or lesson.tenant_id = new.tenant_id
    );

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

revoke all on function private.capture_lesson_completion_activity_event()
  from public;

commit;
