-- 将 VIP2 作业考试权限与会话课程限制落实到数据库读取、提交和练习 RPC。

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
        public.current_user_is_assignment_manager()
        or (
          assignment.status = 'published'
          and public.is_active_account()
          and public.current_profile_role() = 'student'
          and public.student_feature_allowed('learning_assignments')
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

drop policy if exists "tenant managers or assigned students read targets"
  on public.learning_assignment_targets;
create policy "tenant managers or assigned students read targets"
on public.learning_assignment_targets for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_is_assignment_manager())
    or (
      student_id = (select auth.uid())
      and public.student_feature_allowed('learning_assignments')
    )
  )
);

drop policy if exists "tenant managers or owners read submissions"
  on public.learning_submissions;
create policy "tenant managers or owners read submissions"
on public.learning_submissions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_is_assignment_manager())
    or (
      student_id = (select auth.uid())
      and public.student_feature_allowed('learning_assignments')
    )
  )
);

drop policy if exists "tenant managers or owners read submission answers"
  on public.learning_submission_answers;
create policy "tenant managers or owners read submission answers"
on public.learning_submission_answers for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_is_assignment_manager())
    or (
      public.student_feature_allowed('learning_assignments')
      and exists (
        select 1
        from public.learning_submissions as submission
        where submission.id = learning_submission_answers.submission_id
          and submission.student_id = (select auth.uid())
      )
    )
  )
);

create or replace function public.current_user_can_view_conversation_scenario(
  p_scenario_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_practice_scenarios as scenario
    where scenario.id = p_scenario_id
      and scenario.tenant_id = private.current_tenant_id()
      and (
        public.current_user_can_manage_conversation_practice()
        or (
          scenario.status = 'published'
          and public.is_active_account()
          and public.current_profile_role() = 'student'
          and public.student_feature_allowed('conversation_course')
        )
      )
  );
$$;

drop policy if exists "tenant managers or owners read conversation progress"
  on public.conversation_practice_progress;
create policy "tenant managers or owners read conversation progress"
on public.conversation_practice_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_conversation_practice())
    or (
      user_id = (select auth.uid())
      and public.student_feature_allowed('conversation_course')
    )
  )
);

create or replace function public.record_conversation_practice(
  p_scenario_id uuid,
  p_confidence integer,
  p_reflection text,
  p_completed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_active_account()
    and public.current_profile_role() = 'student'
    and public.student_feature_allowed('conversation_course')
  ) then
    raise exception '当前会员档位没有会话课程权限';
  end if;
  if not exists (
    select 1
    from public.conversation_practice_scenarios
    where id = p_scenario_id
      and tenant_id = private.current_tenant_id()
      and status = 'published'
  ) then
    raise exception '该会话场景尚未开放';
  end if;
  if p_confidence is not null and p_confidence not between 1 and 5 then
    raise exception '请填写 1 至 5 级的自信程度';
  end if;
  if char_length(coalesce(p_reflection, '')) > 1200 then
    raise exception '练习复盘不能超过 1200 个字';
  end if;

  insert into public.conversation_practice_progress (
    user_id, scenario_id, status, practice_count, confidence, reflection,
    first_practiced_at, last_practiced_at, completed_at
  ) values (
    auth.uid(), p_scenario_id,
    case when coalesce(p_completed, false) then 'completed' else 'practicing' end,
    1, p_confidence, coalesce(p_reflection, ''), now(), now(),
    case when coalesce(p_completed, false) then now() else null end
  )
  on conflict (user_id, scenario_id) do update
  set status = case
        when coalesce(p_completed, false) then 'completed'
        else public.conversation_practice_progress.status
      end,
      practice_count = public.conversation_practice_progress.practice_count + 1,
      confidence = p_confidence,
      reflection = coalesce(p_reflection, ''),
      last_practiced_at = now(),
      completed_at = case
        when coalesce(p_completed, false)
          then coalesce(public.conversation_practice_progress.completed_at, now())
        else public.conversation_practice_progress.completed_at
      end;
end;
$$;
