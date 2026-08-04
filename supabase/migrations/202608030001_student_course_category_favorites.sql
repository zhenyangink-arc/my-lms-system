-- 开放课程默认展示；只有学生主动收纳的课程才进入收藏夹。
create table if not exists public.student_course_category_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  category_id uuid not null references public.course_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create index if not exists student_course_category_favorites_user_created_idx
  on public.student_course_category_favorites (user_id, created_at desc);

alter table public.student_course_category_favorites enable row level security;

create policy "users read own course category favorites"
  on public.student_course_category_favorites
  for select to authenticated
  using (user_id = auth.uid());

create policy "users add own course category favorites"
  on public.student_course_category_favorites
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "users remove own course category favorites"
  on public.student_course_category_favorites
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.student_course_category_favorites to authenticated;

comment on table public.student_course_category_favorites is '学生主动收纳的课程分类收藏夹';
