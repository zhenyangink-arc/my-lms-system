begin;

create table if not exists public.course_question_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.course_tests(id) on delete cascade,
  question_id uuid not null references public.course_test_questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, question_id)
);

create index if not exists course_question_reviews_student_idx
  on public.course_question_reviews (
    tenant_id,
    student_id,
    created_at desc
  );

alter table public.course_question_reviews enable row level security;

drop policy if exists "students view own course question reviews"
  on public.course_question_reviews;
create policy "students view own course question reviews"
on public.course_question_reviews for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "students add own course question reviews"
  on public.course_question_reviews;
create policy "students add own course question reviews"
on public.course_question_reviews for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "students refresh own course question reviews"
  on public.course_question_reviews;
create policy "students refresh own course question reviews"
on public.course_question_reviews for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "students remove own course question reviews"
  on public.course_question_reviews;
create policy "students remove own course question reviews"
on public.course_question_reviews for delete to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

grant select, insert, update, delete
  on public.course_question_reviews to authenticated;

grant select, insert, update, delete
  on public.course_question_reviews to service_role;

comment on table public.course_question_reviews is
  '学生在章节测试中主动加入的待复习题目；答题页只允许加入，移除操作集中在深化学习页面。';

commit;
