begin;

-- current_user_can_submit_learning_assignment checked status='published' and
-- due_at >= now(), but never starts_at <= now(). A student calling
-- submit_learning_assignment directly (bypassing the board UI, which does
-- hide not-yet-open assignments) could submit an assignment before its
-- scheduled opening time.
create or replace function public.current_user_can_submit_learning_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.current_user_can_view_learning_assignment(p_assignment_id)
    and exists (
      select 1
      from public.learning_assignments
      where id = p_assignment_id
        and tenant_id = private.current_tenant_id()
        and status = 'published'
        and (starts_at is null or starts_at <= now())
        and due_at >= now()
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

comment on function public.current_user_can_submit_learning_assignment(uuid) is
  '学生是否可以提交某个作业/考试：必须已发布、已到开放时间（starts_at）、未过截止时间（due_at）。';

commit;
