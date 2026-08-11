-- ============================================================
-- 老师查看学生课程进度：lesson_progress 放行老师读取
--
-- 老师在"我的学生"中查看某学生的课程与学习进度，需要读取
-- lesson_progress。该表原 RLS 只允许学生本人，这里照抄
-- 202608070004 中 conversation_practice_progress 的写法，
-- 允许老师读取自己负责学生的进度行（行级强制，不会越权到
-- 其他学生）。
-- ============================================================

begin;

create policy "teachers read lesson progress of their assigned students"
on public.lesson_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and exists (
    select 1
    from public.tenant_student_assignments as assignment
    where assignment.tenant_id = lesson_progress.tenant_id
      and assignment.student_id = lesson_progress.user_id
      and assignment.teacher_id = (select auth.uid())
  )
);

commit;
