begin;

create table if not exists public.course_test_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id()
    references public.tenants(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  test_slug text not null check (
    test_slug in (
      'meet-hangul',
      'vowels-and-consonants',
      'batchim-and-reading',
      'pronunciation-rules-and-reading'
    )
  ),
  test_version integer not null default 1 check (test_version > 0),
  score integer not null check (score between 0 and 100),
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  dimension_scores jsonb not null default '{}'::jsonb,
  attempted_at timestamptz not null default now(),
  constraint course_test_attempts_correct_within_total_check
    check (correct_count <= total_questions)
);

create index if not exists course_test_attempts_student_test_idx
  on public.course_test_attempts (
    tenant_id,
    student_id,
    test_slug,
    score desc,
    attempted_at desc
  );

alter table public.course_test_attempts enable row level security;

drop policy if exists "students view own course test attempts"
  on public.course_test_attempts;
create policy "students view own course test attempts"
on public.course_test_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "students record own course test attempts"
  on public.course_test_attempts;
create policy "students record own course test attempts"
on public.course_test_attempts for insert to authenticated
with check (
  tenant_id = (select private.current_tenant_id())
  and student_id = (select auth.uid())
);

drop policy if exists "tenant admins view course test attempts"
  on public.course_test_attempts;
create policy "tenant admins view course test attempts"
on public.course_test_attempts for select to authenticated
using (
  tenant_id = (select private.current_tenant_id())
  and (select public.is_admin())
);

grant select, insert on public.course_test_attempts to authenticated;

comment on table public.course_test_attempts is
  '课程内形成性测试记录；与老师发布的作业、考试提交记录完全分离。';

commit;
