-- ============================================================
-- 学生端成长首页：代课老师（负责老师）展示
--
-- tenant_student_assignments 的 RLS 只允许机构负责人读写、老师读
-- 自己负责的学生，学生本身没有读权限；这里通过 security definer
-- RPC 只返回「当前登录学生」自己的分配记录，供学生端成长首页展示
-- 代课老师（一名学生可被多位老师负责，全部返回）。
-- ============================================================

begin;

create or replace function public.get_student_assigned_teachers()
returns table (teacher_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select public.profiles.full_name
  from public.tenant_student_assignments as assignment
  join public.profiles on public.profiles.id = assignment.teacher_id
  where assignment.student_id = auth.uid()
    and assignment.tenant_id = private.current_tenant_id()
  order by assignment.created_at asc
$$;

comment on function public.get_student_assigned_teachers() is
  '学生查询自己被分配的负责老师姓名（代课老师）；仅返回 auth.uid() 自己的分配记录。';

revoke all on function public.get_student_assigned_teachers() from public;
grant execute on function public.get_student_assigned_teachers() to authenticated;

commit;
