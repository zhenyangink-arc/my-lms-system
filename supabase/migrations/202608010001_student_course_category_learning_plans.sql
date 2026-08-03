-- 学生可手动把课程分类加入「当前学习」，用于和实际课时进度共同决定课程首页的主区展示。
create table if not exists public.student_course_category_learning_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  category_id uuid not null references public.course_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create index if not exists student_course_category_learning_plans_user_created_idx
  on public.student_course_category_learning_plans (user_id, created_at desc);

alter table public.student_course_category_learning_plans enable row level security;

create policy "users read own course learning plans"
  on public.student_course_category_learning_plans
  for select to authenticated
  using (user_id = auth.uid());

create policy "users add own course learning plans"
  on public.student_course_category_learning_plans
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "users remove own course learning plans"
  on public.student_course_category_learning_plans
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.student_course_category_learning_plans to authenticated;

comment on table public.student_course_category_learning_plans is '学生手动加入当前学习的课程分类';
