-- ============================================================
-- 多租户阶段 B（策略层）：RLS 与权限函数全部改为租户作用域
--
-- 核心原则：
-- 1. 业务权限只来自 tenant_memberships（当前租户的角色/状态/会员档位），
--    profiles.role 退化为平台身份（platform owner / deputy），不再决定业务权限。
--    这同时修复了「租户开通的超级管理员拿到全局 super_admin，从而通过全部
--    旧版角色策略读写其他租户数据」的越权路径。
-- 2. 每条业务表策略都带 tenant_id = (select private.current_tenant_id())。
-- 3. 平台共享目录（韩国院校/学校/申请与签证要求模板）保持全局读，
--    写入收紧为平台目录管理员（PUFFY 兼容租户的管理员）——租户管理员
--    不能再改动全平台共享目录。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. 核心身份函数：单点切换到租户成员关系
-- ------------------------------------------------------------

-- 当前租户内的业务角色。平台负责人（非租户开通的 super_admin）在无成员关系
-- 时回退到全局身份，避免被锁死；副负责人不获得业务角色。
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select membership.role
      from public.tenant_memberships as membership
      where membership.user_id = (select auth.uid())
        and membership.tenant_id = private.current_tenant_id()
        and membership.status = 'active'
    ),
    (
      select profile.role
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.role = 'super_admin'
        and not exists (
          select 1
          from public.tenant_provisioned_accounts as account
          where account.user_id = profile.id
        )
    )
  );
$$;

create or replace function public.current_profile_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when profile.id is null then null
    when coalesce(profile.status, 'active') <> 'active' then coalesce(profile.status, 'active')
    when private.current_tenant_id() is not null then 'active'
    when profile.role = 'super_admin' and not exists (
      select 1
      from public.tenant_provisioned_accounts as account
      where account.user_id = profile.id
    ) then 'active'
    else 'inactive'
  end
  from public.profiles as profile
  where profile.id = (select auth.uid());
$$;

-- 学生功能开关：会员档位与角色改从当前租户成员关系读取。
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
        when membership.role in ('teacher', 'admin', 'ceo', 'super_admin') then true
        when membership.status <> 'active' then false
        when requested_feature = 'message_services' then true
        when membership.membership_tier in ('vip1', 'vip2', 'vip3')
          and requested_feature in ('university_target', 'application_documents', 'visa_tasks', 'course_preview')
          then true
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

-- ------------------------------------------------------------
-- 2. 模块权限函数：负责人 = 当前租户 super_admin；
--    管理员授权按 (tenant_id, admin_id) 查询
-- ------------------------------------------------------------

create or replace function public.current_user_is_announcement_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_is_conversation_practice_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_is_help_center_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_is_grade_center_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_is_learning_record_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_is_library_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_owner_account(); $$;

create or replace function public.current_user_can_access_announcements()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.announcement_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_can_manage_conversation_practice()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.conversation_practice_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_can_manage_help_center()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.help_center_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_can_manage_grade_center()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.grade_center_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_can_manage_learning_records()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.learning_record_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_can_manage_library()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account() and (
    public.current_profile_role() in ('super_admin', 'ceo')
    or (
      public.current_profile_role() = 'admin'
      and exists (
        select 1 from public.library_admin_assignments as assignment
        where assignment.admin_id = (select auth.uid())
          and assignment.tenant_id = private.current_tenant_id()
          and assignment.revoked_at is null
      )
    )
  );
$$;

create or replace function public.current_user_is_assignment_manager()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_active_account()
    and public.current_profile_role() in ('teacher', 'admin', 'ceo', 'super_admin');
$$;

-- 作业可见性：全部判断限定在当前租户内。
create or replace function public.current_user_can_view_learning_assignment(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path = ''
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
        and due_at >= now()
    )
    and public.is_active_account()
    and public.current_profile_role() = 'student';
$$;

create or replace function public.current_user_can_view_conversation_scenario(p_scenario_id uuid)
returns boolean language sql stable security definer set search_path = ''
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
        )
      )
  );
$$;

-- 平台共享目录管理员：PUFFY 兼容租户的管理层，或平台负责人。
create or replace function private.is_platform_catalog_manager()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    join public.profiles as profile on profile.id = membership.user_id
    where membership.user_id = (select auth.uid())
      and membership.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
      and membership.status = 'active'
      and membership.role in ('admin', 'ceo', 'super_admin')
      and coalesce(profile.status, 'active') = 'active'
  )
  or exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and coalesce(profile.status, 'active') = 'active'
      and profile.role = 'super_admin'
      and not exists (
        select 1 from public.tenant_provisioned_accounts as account
        where account.user_id = profile.id
      )
  );
$$;

revoke all on function private.is_platform_catalog_manager() from public;
grant execute on function private.is_platform_catalog_manager() to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. 丢弃受影响表上的全部旧策略（按系统目录动态清理，避免名字漂移）
-- ------------------------------------------------------------
do $$
declare
  policy record;
begin
  for policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'course_categories','courses','lessons','lesson_resources','lesson_progress','lesson_questions',
        'announcements','announcement_admin_assignments',
        'learning_assignments','learning_assignment_questions','learning_assignment_question_keys',
        'learning_assignment_targets','learning_submissions','learning_submission_answers',
        'conversation_practice_scenarios','conversation_practice_progress','conversation_practice_admin_assignments',
        'help_articles','help_tickets','help_ticket_messages','help_center_admin_assignments',
        'grade_items','grade_records','grade_review_requests','grade_center_admin_assignments',
        'learning_record_notes','learning_record_admin_assignments',
        'library_resources','library_downloads','library_favorites','library_admin_assignments',
        'student_university_targets','student_university_comparisons','student_university_assessments',
        'student_application_documents','student_visa_cases','student_visa_tasks','student_visa_task_events',
        'ai_token_usage','account_management_audit_logs','account_deletion_audit_logs',
        'course_content_audit_logs','student_service_card_deletion_logs',
        'profiles',
        'korean_universities','korean_university_programs','schools','school_programs',
        'university_application_document_requirements','university_visa_application_requirements'
      )
  loop
    execute format('drop policy %I on %I.%I', policy.policyname, policy.schemaname, policy.tablename);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 4. profiles：自助读写 + 管理端限定同租户成员
-- ------------------------------------------------------------
create policy "Users can view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Executives read profiles of their tenant members"
on public.profiles for select to authenticated
using (
  (select public.is_executive_account())
  and exists (
    select 1
    from public.tenant_memberships as membership
    where membership.user_id = profiles.id
      and membership.tenant_id = (select private.current_tenant_id())
  )
);

create policy "Executives manage subordinate tenant member profiles"
on public.profiles for update to authenticated
using (
  exists (
    select 1
    from public.tenant_memberships as membership
    where membership.user_id = profiles.id
      and membership.tenant_id = (select private.current_tenant_id())
  )
  and role <> 'tenant_operator'
  and (
    (select public.is_owner_account())
    or ((select public.is_executive_account()) and role not in ('super_admin', 'ceo'))
  )
)
with check (
  exists (
    select 1
    from public.tenant_memberships as membership
    where membership.user_id = profiles.id
      and membership.tenant_id = (select private.current_tenant_id())
  )
  and role <> 'tenant_operator'
  and (
    (select public.is_owner_account())
    or ((select public.is_executive_account()) and role not in ('super_admin', 'ceo'))
  )
);

-- ------------------------------------------------------------
-- 5. 课程模块
-- ------------------------------------------------------------
create policy "tenant members read published course categories"
on public.course_categories for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select public.is_admin()))
);

create policy "tenant admins manage course categories"
on public.course_categories for all to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()))
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

create policy "tenant members read published courses"
on public.courses for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select public.is_admin()))
);

create policy "tenant admins manage courses"
on public.courses for all to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()))
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

create policy "tenant members read published lessons"
on public.lessons for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select public.is_admin()))
);

create policy "tenant admins manage lessons"
on public.lessons for all to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()))
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

create policy "tenant members read published lesson resources"
on public.lesson_resources for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (is_published or (select public.is_admin()))
);

create policy "tenant admins insert lesson resources"
on public.lesson_resources for insert to authenticated
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

create policy "tenant admins update lesson resources"
on public.lesson_resources for update to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()))
with check (tenant_id = (select private.current_tenant_id()) and (select public.is_admin()));

create policy "tenant owner deletes lesson resources"
on public.lesson_resources for delete to authenticated
using (tenant_id = (select private.current_tenant_id()) and (select public.is_owner_account()));

create policy "tenant users manage own lesson progress"
on public.lesson_progress for all to authenticated
using (tenant_id = (select private.current_tenant_id()) and user_id = (select auth.uid()))
with check (tenant_id = (select private.current_tenant_id()) and user_id = (select auth.uid()));

create policy "tenant students view own lesson questions"
on public.lesson_questions for select to authenticated
using (tenant_id = (select private.current_tenant_id()) and student_id = (select auth.uid()));

create policy "tenant students insert own lesson questions"
on public.lesson_questions for insert to authenticated
with check (tenant_id = (select private.current_tenant_id()) and student_id = (select auth.uid()));

create policy "tenant students update own open lesson questions"
on public.lesson_questions for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
  and status <> 'closed'
)
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
  and status <> 'closed'
);

-- ------------------------------------------------------------
-- 6. 公告模块
-- ------------------------------------------------------------
create policy "tenant users read announcements"
on public.announcements for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_access_announcements())
    or (status = 'published' and (select public.is_active_account()))
  )
);

create policy "tenant staff create announcements"
on public.announcements for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_access_announcements())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy "tenant staff update announcements"
on public.announcements for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_access_announcements())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_access_announcements())
);

create policy "tenant announcement assignments visible to owner or assignee"
on public.announcement_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_announcement_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages announcement assignments"
on public.announcement_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_announcement_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_announcement_owner())
);

-- ------------------------------------------------------------
-- 7. 作业与考试模块
-- ------------------------------------------------------------
create policy "tenant users read visible learning assignments"
on public.learning_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.current_user_can_view_learning_assignment(id)
);

create policy "tenant users read visible assignment questions"
on public.learning_assignment_questions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.current_user_can_view_learning_assignment(assignment_id)
);

create policy "tenant managers read assignment answer keys"
on public.learning_assignment_question_keys for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_assignment_manager())
);

create policy "tenant managers or assigned students read targets"
on public.learning_assignment_targets for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_assignment_manager()) or student_id = (select auth.uid()))
);

create policy "tenant managers or owners read submissions"
on public.learning_submissions for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_assignment_manager()) or student_id = (select auth.uid()))
);

create policy "tenant managers or owners read submission answers"
on public.learning_submission_answers for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_is_assignment_manager())
    or exists (
      select 1
      from public.learning_submissions as submission
      where submission.id = learning_submission_answers.submission_id
        and submission.student_id = (select auth.uid())
    )
  )
);

-- ------------------------------------------------------------
-- 8. 对话练习模块
-- ------------------------------------------------------------
create policy "tenant users read visible conversation scenarios"
on public.conversation_practice_scenarios for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and public.current_user_can_view_conversation_scenario(id)
);

create policy "tenant managers or owners read conversation progress"
on public.conversation_practice_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_can_manage_conversation_practice()) or user_id = (select auth.uid()))
);

create policy "tenant conversation assignments visible to owner or assignee"
on public.conversation_practice_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_conversation_practice_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages conversation assignments"
on public.conversation_practice_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_conversation_practice_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_conversation_practice_owner())
);

-- ------------------------------------------------------------
-- 9. 帮助中心模块
-- ------------------------------------------------------------
create policy "tenant users read help articles"
on public.help_articles for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_help_center())
    or (status = 'published' and (select public.is_active_account()))
  )
);

create policy "tenant managers or owners read help tickets"
on public.help_tickets for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_can_manage_help_center()) or user_id = (select auth.uid()))
);

create policy "tenant managers or owners read help messages"
on public.help_ticket_messages for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_help_center())
    or exists (
      select 1
      from public.help_tickets as ticket
      where ticket.id = help_ticket_messages.ticket_id
        and ticket.user_id = (select auth.uid())
    )
  )
);

create policy "tenant help assignments visible to owner or assignee"
on public.help_center_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_help_center_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages help assignments"
on public.help_center_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_help_center_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_help_center_owner())
);

-- ------------------------------------------------------------
-- 10. 成绩中心模块
-- ------------------------------------------------------------
create policy "tenant users read visible grade items"
on public.grade_items for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_grade_center())
    or (status = 'published' and (select public.is_active_account()))
  )
);

create policy "tenant managers or owners read grade records"
on public.grade_records for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_grade_center())
    or (
      student_id = (select auth.uid())
      and exists (
        select 1
        from public.grade_items as item
        where item.id = grade_records.item_id
          and item.status = 'published'
      )
    )
  )
);

create policy "tenant managers or owners read grade reviews"
on public.grade_review_requests for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_can_manage_grade_center()) or student_id = (select auth.uid()))
);

create policy "tenant grade assignments visible to owner or assignee"
on public.grade_center_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_grade_center_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages grade assignments"
on public.grade_center_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_grade_center_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_grade_center_owner())
);

-- ------------------------------------------------------------
-- 11. 学习记录模块
-- ------------------------------------------------------------
create policy "tenant managers or students read learning record notes"
on public.learning_record_notes for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_learning_records())
    or (
      student_id = (select auth.uid())
      and visibility = 'student_visible'
      and status = 'active'
    )
  )
);

create policy "tenant learning record assignments visible to owner or assignee"
on public.learning_record_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_learning_record_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages learning record assignments"
on public.learning_record_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_learning_record_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_learning_record_owner())
);

-- ------------------------------------------------------------
-- 12. 资料库模块
-- ------------------------------------------------------------
create policy "tenant users read library resources"
on public.library_resources for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_user_can_manage_library())
    or (status = 'published' and (select public.is_active_account()))
  )
);

create policy "tenant library managers read downloads"
on public.library_downloads for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_can_manage_library())
);

create policy "tenant users read own library favorites"
on public.library_favorites for select to authenticated
using (tenant_id = (select private.current_tenant_id()) and user_id = (select auth.uid()));

create policy "tenant library assignments visible to owner or assignee"
on public.library_admin_assignments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and ((select public.current_user_is_library_owner()) or admin_id = (select auth.uid()))
);

create policy "tenant owner manages library assignments"
on public.library_admin_assignments for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_library_owner())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.current_user_is_library_owner())
);

-- ------------------------------------------------------------
-- 13. 学生规划 / 申请材料 / 签证工作区
-- ------------------------------------------------------------
create policy "tenant targets read own or staff"
on public.student_university_targets for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    user_id = (select auth.uid())
    or (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

create policy "tenant students manage own university targets"
on public.student_university_targets for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('university_target')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('university_target')
);

create policy "tenant admins update university targets"
on public.student_university_targets for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant students manage own university comparisons"
on public.student_university_comparisons for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('university_comparison')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('university_comparison')
);

create policy "tenant assessments read own or staff"
on public.student_university_assessments for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    user_id = (select auth.uid())
    or (select public.current_profile_role()) in ('teacher', 'admin', 'ceo', 'super_admin')
  )
);

create policy "tenant students create own university assessments"
on public.student_university_assessments for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('university_target')
);

create policy "tenant application documents read own or admins"
on public.student_application_documents for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.is_admin_account()))
);

create policy "tenant admins create application checklist items"
on public.student_application_documents for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and target_id is not null
  and (select public.is_admin_account())
);

create policy "tenant admins update application checklist items"
on public.student_application_documents for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant admins delete application checklist items"
on public.student_application_documents for delete to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and admin_locked_at is null
  and (select public.is_admin_account())
);

create policy "tenant students update own checklist status"
on public.student_application_documents for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and status in ('preparing', 'completed', 'not_needed')
  and public.student_feature_allowed('application_documents')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and status in ('preparing', 'completed', 'not_needed')
  and public.student_feature_allowed('application_documents')
);

create policy "tenant visa cases read own or admins"
on public.student_visa_cases for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.is_admin_account()))
);

create policy "tenant admins manage visa cases"
on public.student_visa_cases for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant students create own visa case"
on public.student_visa_cases for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('visa_tasks')
);

create policy "tenant students update own visa case"
on public.student_visa_cases for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('visa_tasks')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and public.student_feature_allowed('visa_tasks')
);

create policy "tenant visa tasks read own or admins"
on public.student_visa_tasks for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (user_id = (select auth.uid()) and is_archived = false)
    or (select public.is_admin_account())
  )
);

create policy "tenant admins manage visa tasks"
on public.student_visa_tasks for all to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant students create active own visa tasks"
on public.student_visa_tasks for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
);

create policy "tenant students update active own visa tasks"
on public.student_visa_tasks for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
)
with check (
  tenant_id = (select private.current_tenant_id())
  and user_id = (select auth.uid())
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
);

create policy "tenant visa task events read own or admins"
on public.student_visa_task_events for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (user_id = (select auth.uid()) or (select public.is_admin_account()))
);

-- ------------------------------------------------------------
-- 14. AI 用量与审计日志
-- ------------------------------------------------------------
create policy "tenant admins read AI token usage"
on public.ai_token_usage for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant executives read account audit logs"
on public.account_management_audit_logs for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_executive_account())
);

create policy "tenant owner reads account deletion audit logs"
on public.account_deletion_audit_logs for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_owner_account())
);

create policy "tenant admins read course audit logs"
on public.course_content_audit_logs for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

create policy "tenant admins read service card deletion logs"
on public.student_service_card_deletion_logs for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin_account())
);

-- ------------------------------------------------------------
-- 15. 平台共享目录：全局可读，仅平台目录管理员可写
-- ------------------------------------------------------------
create policy "authenticated read published universities"
on public.korean_universities for select to authenticated
using (is_published = true or (select private.is_platform_catalog_manager()));

create policy "platform catalog managers manage universities"
on public.korean_universities for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

create policy "authenticated read published university programs"
on public.korean_university_programs for select to authenticated
using (is_published = true or (select private.is_platform_catalog_manager()));

create policy "platform catalog managers manage university programs"
on public.korean_university_programs for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

create policy "authenticated read published schools"
on public.schools for select to authenticated
using (is_published = true or (select private.is_platform_catalog_manager()));

create policy "platform catalog managers manage schools"
on public.schools for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

create policy "authenticated read published school programs"
on public.school_programs for select to authenticated
using (is_published = true or (select private.is_platform_catalog_manager()));

create policy "platform catalog managers manage school programs"
on public.school_programs for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

create policy "authenticated read university document requirements"
on public.university_application_document_requirements for select to authenticated
using (true);

create policy "platform catalog managers manage document requirements"
on public.university_application_document_requirements for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

create policy "authenticated read university visa requirements"
on public.university_visa_application_requirements for select to authenticated
using (true);

create policy "platform catalog managers manage visa requirements"
on public.university_visa_application_requirements for all to authenticated
using ((select private.is_platform_catalog_manager()))
with check ((select private.is_platform_catalog_manager()));

comment on function public.current_profile_role() is
  '当前租户内的业务角色（tenant_memberships），平台负责人无成员关系时回退全局身份';
comment on function public.student_feature_allowed(text) is
  '学生功能开关：按当前租户成员关系的角色与会员档位判断';

commit;
