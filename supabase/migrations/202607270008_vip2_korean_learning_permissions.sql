-- VIP2 学生：完整韩语课程、作业与考试、AI 交流体验。
-- VIP2 不开放会话课程；VIP3 在继承 VIP2 权限的基础上开放会话课程。

create or replace function public.student_feature_allowed(requested_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select case
        when membership.role in (
          'teacher',
          'admin',
          'ceo',
          'tenant_super_admin',
          'super_admin'
        ) then true
        when membership.status <> 'active' then false
        when requested_feature = 'message_services' then true
        when membership.membership_tier in ('vip1', 'vip2', 'vip3')
          and requested_feature in (
            'dashboard_section',
            'university_target',
            'application_documents',
            'visa_tasks',
            'course_preview'
          ) then true
        when membership.membership_tier in ('vip2', 'vip3')
          and requested_feature in (
            'learning_assignments',
            'korean_course',
            'ai_conversation_experience'
          ) then true
        when membership.membership_tier = 'vip3'
          and requested_feature = 'conversation_course' then true
        else false
      end
      from public.tenant_memberships as membership
      where membership.user_id = (select auth.uid())
        and membership.tenant_id = private.current_tenant_id()
    ), false)
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and coalesce(profile.status, 'active') = 'active'
    );
$$;

revoke all on function public.student_feature_allowed(text) from public;
grant execute on function public.student_feature_allowed(text)
  to authenticated, service_role;

create or replace function public.enforce_student_lesson_progress_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  preview_enabled boolean;
  korean_lesson boolean;
begin
  select profile.role
  into actor_role
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if actor_role in (
    'teacher',
    'admin',
    'ceo',
    'tenant_super_admin',
    'platform_super_admin',
    'tenant_operator',
    'super_admin'
  ) then
    return new;
  end if;

  select
    lesson.is_free_preview,
    (
      category.slug = 'korean'
      or parent_category.slug = 'korean'
    )
  into preview_enabled, korean_lesson
  from public.lessons as lesson
  join public.courses as course
    on course.id = lesson.course_id
  join public.course_categories as category
    on category.id = course.category_id
  left join public.course_categories as parent_category
    on parent_category.id = category.parent_id
  where lesson.id = new.lesson_id;

  if coalesce(korean_lesson, false)
    and public.student_feature_allowed('korean_course') then
    return new;
  end if;

  if public.student_feature_allowed('course_preview')
    and coalesce(preview_enabled, false) then
    return new;
  end if;

  raise exception '当前账号没有此课时的学习记录权限';
end;
$$;

comment on function public.student_feature_allowed(text) is
  '按当前租户成员档位判断学生功能；VIP2 开放韩语课程、作业考试和 AI 交流，VIP3 另开放会话课程';
comment on function public.enforce_student_lesson_progress_permission() is
  'VIP2/VIP3 可记录全部韩语课时进度；VIP1 仅可记录标记为可试听的课时';

-- 作业与考试：页面权限之外，数据库查询和提交也只对 VIP2/VIP3 学生开放。
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

-- 会话课程：VIP2 不能通过直接查询、RPC 或旧链接绕过页面，只保留 AI 体验。
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
