begin;

create table if not exists public.course_ebook_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  test_slug text not null references public.course_tests(slug) on delete cascade,
  current_page integer not null default 0 check (current_page >= 0),
  total_pages integer not null check (total_pages > 0),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, test_slug)
);

create index if not exists course_ebook_progress_student_idx
  on public.course_ebook_progress (tenant_id, student_id, last_read_at desc);

alter table public.course_ebook_progress enable row level security;

create policy "students view own ebook progress"
on public.course_ebook_progress for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

create policy "students add own ebook progress"
on public.course_ebook_progress for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

create policy "students update own ebook progress"
on public.course_ebook_progress for update to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
)
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

grant select, insert, update on public.course_ebook_progress to authenticated;
grant select, insert, update, delete on public.course_ebook_progress to service_role;

comment on table public.course_ebook_progress is
  '按章节测试 slug 保存每一本电子书的当前页、总页数和最高阅读进度。';

commit;
