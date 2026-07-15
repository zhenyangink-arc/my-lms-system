-- ============================================================
-- 收紧签证模块学生写权限：拆分为 insert / update，去掉 delete
-- 之前 "eligible students manage own visa tasks/case" 用的是 for all，
-- 学生可以绕过审核工作流触发器，直接删除自己的签证任务或档案；
-- 由于 student_visa_task_events 对 task_id 是 on delete cascade，
-- 删除任务还会连带清空该任务已有的提交与审核历史。
-- 这里改成和申请材料模块（202607150005）一致的 insert-only + update-only 收紧方式。
-- ============================================================

drop policy if exists "eligible students manage own visa tasks" on public.student_visa_tasks;

create policy "eligible students create own visa tasks"
on public.student_visa_tasks for insert
to authenticated
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

create policy "eligible students update own visa tasks"
on public.student_visa_tasks for update
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'))
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

drop policy if exists "eligible students manage own visa case" on public.student_visa_cases;

create policy "eligible students create own visa case"
on public.student_visa_cases for insert
to authenticated
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

create policy "eligible students update own visa case"
on public.student_visa_cases for update
to authenticated
using (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'))
with check (auth.uid() = user_id and public.student_feature_allowed('visa_tasks'));

comment on policy "eligible students update own visa tasks" on public.student_visa_tasks is
  '学生只能创建和更新自己的签证任务，不再拥有删除权限，审核历史由触发器和管理员维护';
comment on policy "eligible students update own visa case" on public.student_visa_cases is
  '学生只能创建和更新自己的签证档案，不再拥有删除权限';
