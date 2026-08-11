begin;

-- student_course_category_favorites / student_course_category_learning_plans 的策略
-- 之前只判断"是不是你自己的数据"，没有校验机构归属——理论上可以用同一个账号跨机构
-- 读到/写入不属于当前机构上下文的收藏和学习计划记录。两张表都有 tenant_id 列，
-- 应用层写入时也已经在填这个字段（见 dashboard/courses/actions.ts），
-- 这里把 RLS 补齐成和其余学生数据表一致的"自己的数据 + 当前机构"双重校验。
drop policy if exists "users read own course category favorites" on public.student_course_category_favorites;
drop policy if exists "users add own course category favorites" on public.student_course_category_favorites;
drop policy if exists "users remove own course category favorites" on public.student_course_category_favorites;

create policy "users read own course category favorites"
on public.student_course_category_favorites for select to authenticated
using (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

create policy "users add own course category favorites"
on public.student_course_category_favorites for insert to authenticated
with check (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

create policy "users remove own course category favorites"
on public.student_course_category_favorites for delete to authenticated
using (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

drop policy if exists "users read own course learning plans" on public.student_course_category_learning_plans;
drop policy if exists "users add own course learning plans" on public.student_course_category_learning_plans;
drop policy if exists "users remove own course learning plans" on public.student_course_category_learning_plans;

create policy "users read own course learning plans"
on public.student_course_category_learning_plans for select to authenticated
using (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

create policy "users add own course learning plans"
on public.student_course_category_learning_plans for insert to authenticated
with check (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

create policy "users remove own course learning plans"
on public.student_course_category_learning_plans for delete to authenticated
using (user_id = (select auth.uid()) and tenant_id = (select private.current_tenant_id()));

commit;
