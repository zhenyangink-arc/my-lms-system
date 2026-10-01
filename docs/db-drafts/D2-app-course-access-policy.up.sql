-- D2（草稿，未进入 supabase/migrations）：按应用的“完整课程访问”策略 + 课时进度触发器改造。
-- 1. 新增策略表：每个学生应用中可以学习全部课时的会员档位。收费方案确定后只改表中数据。
--    默认韩语、英语为 vip2 / vip3，与原 korean_course 规则相同；没有配置的应用只能学习试看课时（与现在一致）。
-- 2. 课时进度触发器按课程所属应用（courses.student_app_id）查策略，不再按分类 slug = 'korean' 判断。
-- 3. 教职人员判断改用 public.current_profile_role()（当前机构成员角色），与 lesson_progress 的 RLS 口径一致；
--    修复“资料角色误设为教职人员的学生可绕过会员档位写入进度”的问题。
-- 代码侧（课时页、课时操作、课时资料下载）的对应改造属于黄区，待 Codex 线收尾后与课时页插槽一起进行。
-- 正式迁移须按 Architecture Gate 流程提交。
begin;

create table if not exists private.student_app_course_access_policies (
  app_id uuid primary key references public.student_apps(id) on delete cascade,
  full_access_tiers text[] not null default '{}',
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint student_app_course_access_policies_tiers_check
    check (full_access_tiers <@ array['normal', 'vip1', 'vip2', 'vip3']::text[])
);
revoke all on table private.student_app_course_access_policies from public, anon, authenticated;

insert into private.student_app_course_access_policies (app_id, full_access_tiers, note)
select id, array['vip2', 'vip3']::text[], '默认规则，与原 korean_course 相同；收费方案确定后替换'
from public.student_apps
where slug in ('korean', 'english')
on conflict (app_id) do nothing;

create or replace function private.student_app_full_course_allowed(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select membership.status = 'active'
        and membership.membership_tier = any (policy.full_access_tiers)
      from public.tenant_memberships as membership
      join private.student_app_course_access_policies as policy
        on policy.app_id = p_app_id
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
revoke all on function private.student_app_full_course_allowed(uuid) from public, anon, authenticated;

create or replace function public.enforce_student_lesson_progress_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  preview_enabled boolean;
  lesson_app_id uuid;
begin
  if public.current_profile_role() in ('teacher', 'admin', 'ceo', 'tenant_super_admin') then
    return new;
  end if;

  select lesson.is_free_preview, course.student_app_id
  into preview_enabled, lesson_app_id
  from public.lessons as lesson
  join public.courses as course
    on course.id = lesson.course_id
  where lesson.id = new.lesson_id;

  if lesson_app_id is not null
    and private.student_app_full_course_allowed(lesson_app_id) then
    return new;
  end if;

  if public.student_feature_allowed('course_preview')
    and coalesce(preview_enabled, false) then
    return new;
  end if;

  raise exception '当前账号没有此课时的学习记录权限';
end;
$$;

commit;
