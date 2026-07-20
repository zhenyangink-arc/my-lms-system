drop policy if exists "eligible students manage own visa tasks"
  on public.student_visa_tasks;
drop policy if exists "visa tasks manage own"
  on public.student_visa_tasks;
drop policy if exists "eligible students manage active own visa tasks"
  on public.student_visa_tasks;

create policy "eligible students manage active own visa tasks"
on public.student_visa_tasks for all
to authenticated
using (
  auth.uid() = user_id
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
)
with check (
  auth.uid() = user_id
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
);

comment on policy "eligible students manage active own visa tasks"
  on public.student_visa_tasks is
  '学生只能维护大学当前仍启用的签证资料任务；历史归档仅供管理员审计';

notify pgrst, 'reload schema';
