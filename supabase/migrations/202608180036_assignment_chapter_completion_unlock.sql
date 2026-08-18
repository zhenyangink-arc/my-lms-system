begin;

alter table public.learning_assignments
  add column if not exists unlock_after_chapter_completion boolean not null default false,
  add column if not exists unlock_test_slug text;

alter table public.learning_assignments
  add constraint learning_assignments_unlock_test_slug_check
    check (
      not unlock_after_chapter_completion
      or char_length(coalesce(unlock_test_slug, '')) between 2 and 120
    );

create or replace function public.current_user_completed_assignment_chapter(
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
        not assignment.unlock_after_chapter_completion
        or private.current_staff_has_app_capability(
          assignment.tenant_id,
          assignment.student_app_id,
          'manage_assessments'
        )
        or exists (
          select 1
          from public.course_ebook_progress as progress
          where progress.tenant_id = assignment.tenant_id
            and progress.student_id = (select auth.uid())
            and progress.student_app_id = assignment.student_app_id
            and progress.test_slug = assignment.unlock_test_slug
            and (
              progress.completion_source in ('smart_textbook', 'both')
              or (
                progress.progress_percent >= 100
                and progress.reading_seconds >= 600
              )
            )
        )
      )
  );
$$;

create or replace function public.configure_assignment_chapter_unlock(
  p_assignment_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.learning_assignments%rowtype;
  v_test_slug text;
begin
  select * into v_assignment
  from public.learning_assignments
  where id = p_assignment_id and tenant_id = private.current_tenant_id()
  for update;
  if not found or not private.current_staff_has_app_capability(
    v_assignment.tenant_id, v_assignment.student_app_id, 'manage_assessments'
  ) then
    raise exception '当前账号没有配置该作业的权限';
  end if;

  if coalesce(p_enabled, false) then
    select test.slug into v_test_slug
    from public.assessment_papers as paper
    join public.course_tests as test on test.id = paper.source_test_id
    where paper.id = v_assignment.source_paper_id;
    if v_test_slug is null then
      raise exception '该作业缺少对应章节，不能按章节完成状态开放';
    end if;
  end if;

  update public.learning_assignments
  set unlock_after_chapter_completion = coalesce(p_enabled, false),
      unlock_test_slug = case when p_enabled then v_test_slug else null end,
      updated_at = now()
  where id = p_assignment_id;
end;
$$;

create or replace function public.current_user_can_view_learning_assignment_questions(
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
          'manage_assessments'
        )
        or (
          public.current_user_can_view_learning_assignment(assignment.id)
          and assignment.starts_at <= now()
          and public.current_user_completed_assignment_chapter(assignment.id)
        )
      )
  );
$$;

create or replace function public.current_user_can_submit_learning_assignment(
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and public.current_user_completed_assignment_chapter(p_assignment_id)
    and exists (
      select 1 from public.learning_assignments
      where id = p_assignment_id
        and tenant_id = private.current_tenant_id()
        and status = 'published'
        and (starts_at is null or starts_at <= now())
        and due_at >= now()
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

revoke all on function public.current_user_completed_assignment_chapter(uuid)
  from public, anon;
grant execute on function public.current_user_completed_assignment_chapter(uuid)
  to authenticated;
revoke all on function public.configure_assignment_chapter_unlock(uuid, boolean)
  from public, anon;
grant execute on function public.configure_assignment_chapter_unlock(uuid, boolean)
  to authenticated;

comment on column public.learning_assignments.unlock_after_chapter_completion is
  '为 true 时，学生必须完成来源章节教材后才能查看题目和提交。';

commit;
