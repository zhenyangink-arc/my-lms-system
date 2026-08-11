-- Historical baseline for lessons and lesson resources. Final tenant columns,
-- compound foreign keys, course_chapters references, policies and triggers are
-- deliberately owned by the existing later migrations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null,
  slug text not null,
  title text not null,
  description text,
  lesson_type text not null default 'text'::text,
  duration_minutes integer not null default 10,
  is_free_preview boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_text text,
  video_url text,
  video_provider text,
  attachment_url text,
  attachment_label text,
  teacher_note text,
  allow_questions boolean not null default true,
  learning_objectives text,
  lesson_tasks text,
  key_points text,
  case_study text,
  common_mistakes text,
  summary_text text,
  reflection_questions text,
  extra_note text,
  video_object_key text,
  video_mime_type text default 'video/mp4'::text,
  constraint lessons_course_id_fkey
    foreign key (course_id) references public.courses(id) on delete cascade,
  constraint lessons_course_id_slug_key unique (course_id, slug)
);

create index if not exists lessons_course_id_idx
  on public.lessons (course_id);

create table if not exists public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null,
  title text not null,
  description text,
  resource_type text not null default 'file'::text,
  resource_url text,
  is_required boolean not null default false,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  resource_object_key text,
  original_file_name text,
  constraint lesson_resources_lesson_id_fkey
    foreign key (lesson_id) references public.lessons(id) on delete cascade,
  constraint lesson_resources_deleted_by_fkey
    foreign key (deleted_by) references public.profiles(id),
  constraint lesson_resources_type_check
    check (resource_type = any (array['file'::text, 'link'::text, 'template'::text, 'checklist'::text, 'reference'::text]))
);

create index if not exists lesson_resources_lesson_id_idx
  on public.lesson_resources (lesson_id);

alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;

commit;
