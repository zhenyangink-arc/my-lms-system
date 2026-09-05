-- ============================================================
-- 机构负责人查看学习计划进度需要读取 lesson_progress，但该表原本
-- 只放行学生本人和老师（按 tenant_student_assignments）。ceo、
-- tenant_super_admin 和拥有 can_manage_assessments 的 admin 已经
-- 能够管理机构学习计划，这里补齐同一批角色对课程进度的只读访问，
-- 复用 202609050003 中机构学习计划管理策略的同一套角色判断。
-- ============================================================

begin;

create policy "institution leaders read lesson progress for curriculum plans"
on public.lesson_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (
    (select public.current_profile_role()) in ('ceo', 'tenant_super_admin')
    or (
      (select public.current_profile_role()) = 'admin'
      and exists (
        select 1
        from public.courses as course
        join public.staff_app_assignments as access
          on access.tenant_id = lesson_progress.tenant_id
         and access.app_id = course.student_app_id
         and access.staff_id = (select auth.uid())
         and access.status = 'active'
         and access.can_manage_assessments
        where course.id = lesson_progress.course_id
      )
    )
  )
);

commit;
