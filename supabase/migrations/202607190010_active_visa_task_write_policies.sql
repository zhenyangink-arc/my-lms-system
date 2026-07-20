drop policy if exists "eligible students manage active own visa tasks"
  on public.student_visa_tasks;
drop policy if exists "eligible students create own visa tasks"
  on public.student_visa_tasks;
drop policy if exists "eligible students update own visa tasks"
  on public.student_visa_tasks;

create policy "eligible students create active own visa tasks"
on public.student_visa_tasks for insert
to authenticated
with check (
  auth.uid() = user_id
  and is_archived = false
  and public.student_feature_allowed('visa_tasks')
);

create policy "eligible students update active own visa tasks"
on public.student_visa_tasks for update
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

comment on policy "eligible students create active own visa tasks"
  on public.student_visa_tasks is
  '学生只能新增当前启用的签证任务，不能写入归档任务';
comment on policy "eligible students update active own visa tasks"
  on public.student_visa_tasks is
  '学生只能更新当前启用的签证任务，且没有删除权限';

notify pgrst, 'reload schema';
