-- Historical baseline for the course catalog tables that predate the tracked
-- migration series. Final tenant scoping, content_scope checks, policies and
-- tenant triggers are added by 202607210001/002/008 and later migrations.

begin;

create extension if not exists pgcrypto;

create table if not exists public.course_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid,
  slug text not null,
  title text not null,
  description text,
  icon_name text,
  cover_url text,
  accent_color text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_categories_parent_id_fkey
    foreign key (parent_id) references public.course_categories(id) on delete cascade,
  constraint course_categories_slug_key unique (slug)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid,
  category text,
  slug text not null,
  title text not null,
  description text,
  level text default 'beginner'::text,
  icon_name text,
  cover_url text,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  support_teacher_name text,
  support_teacher_status text not null default 'offline'::text,
  ai_support_enabled boolean not null default true,
  support_message text,
  constraint courses_category_id_fkey
    foreign key (category_id) references public.course_categories(id) on delete set null,
  constraint courses_slug_key unique (slug),
  constraint courses_support_teacher_status_check
    check (support_teacher_status = any (array['online'::text, 'busy'::text, 'away'::text, 'offline'::text]))
);

create index if not exists courses_category_id_idx
  on public.courses (category_id);

alter table public.course_categories enable row level security;
alter table public.courses enable row level security;

commit;
