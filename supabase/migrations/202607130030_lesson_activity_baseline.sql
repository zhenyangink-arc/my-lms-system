-- Historical baseline for learner progress and lesson questions. Tenant IDs,
-- tenant foreign keys, tenant triggers and final policies are applied later by
-- the existing multi-tenant migrations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started'::text,
  progress_percent integer not null default 0,
  started_at timestamptz,
  last_viewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_status_check
    check (status = any (array['not_started'::text, 'in_progress'::text, 'completed'::text])),
  constraint lesson_progress_user_id_lesson_id_key unique (user_id, lesson_id)
);

create index if not exists lesson_progress_course_id_idx on public.lesson_progress (course_id);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index if not exists lesson_progress_user_id_idx on public.lesson_progress (user_id);

create table if not exists public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question_target text not null default 'teacher'::text,
  title text not null,
  message text not null,
  status text not null default 'pending'::text,
  ai_answer text,
  teacher_answer text,
  teacher_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz,
  student_read_at timestamptz,
  constraint lesson_questions_status_check
    check (status = any (array['pending'::text, 'ai_answered'::text, 'teacher_answered'::text, 'closed'::text])),
  constraint lesson_questions_target_check
    check (question_target = any (array['teacher'::text, 'ai'::text, 'both'::text]))
);

create index if not exists lesson_questions_course_id_idx on public.lesson_questions (course_id);
create index if not exists lesson_questions_lesson_id_idx on public.lesson_questions (lesson_id);
create index if not exists lesson_questions_status_idx on public.lesson_questions (status);
create index if not exists lesson_questions_student_id_idx on public.lesson_questions (student_id);

alter table public.lesson_progress enable row level security;
alter table public.lesson_questions enable row level security;

commit;
