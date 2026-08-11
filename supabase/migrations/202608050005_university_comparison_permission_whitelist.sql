begin;

-- student_feature_allowed('university_comparison') was never added to the
-- vip1+ allow-list, so no student tier could ever pass the RLS check on
-- student_university_comparisons even though the UI (getFeatureDeniedMessage)
-- implies upgrading membership unlocks it. Mirrors the same fix applied to
-- canUseStudentFeature() in src/lib/student-permissions.ts.
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
            'university_comparison',
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

comment on function public.student_feature_allowed(text) is
  '按当前租户成员档位判断学生功能；VIP1 起开放大学对比，VIP2 开放韩语课程、作业考试和 AI 交流，VIP3 另开放会话课程';

commit;
