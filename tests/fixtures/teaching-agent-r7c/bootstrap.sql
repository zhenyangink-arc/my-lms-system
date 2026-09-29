-- ISOLATED TEST ONLY. Existing business DDL extracted from 202607310013.
-- Auth/catalog dependencies below are synthetic FK fixtures, NOT real users.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create table public.tenants(id uuid primary key);
create table public.lessons(id uuid primary key);
create table public.chapter_tests(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
create function private.current_tenant_id() returns uuid language sql stable as $$ select null::uuid $$;
create table if not exists public.digital_textbooks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons(id) on delete restrict,
  slug text not null unique,
  level_code text not null,
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_versions (
  id uuid primary key default gen_random_uuid(),
  textbook_id uuid not null references public.digital_textbooks(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  release_notes text not null default '',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (textbook_id, version_number)
);

create table if not exists public.digital_textbook_chapters (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.digital_textbook_versions(id) on delete cascade,
  chapter_test_id uuid references public.chapter_tests(id) on delete set null,
  slug text not null,
  chapter_number integer not null check (chapter_number > 0),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  scenario jsonb not null default '{}'::jsonb check (jsonb_typeof(scenario) = 'object'),
  goal jsonb not null default '{}'::jsonb check (jsonb_typeof(goal) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, slug),
  unique (version_id, chapter_number)
);

create table if not exists public.digital_textbook_modules (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.digital_textbook_chapters(id) on delete cascade,
  module_code text not null check (module_code in (
    'orientation', 'vocabulary', 'grammar', 'patterns',
    'dialogue', 'listen_speak', 'read_write', 'review'
  )),
  sort_order integer not null check (sort_order between 1 and 8),
  accent_role text not null check (accent_role in ('jade', 'iris', 'coral', 'sky')),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  description jsonb not null default '{}'::jsonb check (jsonb_typeof(description) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chapter_id, module_code),
  unique (chapter_id, sort_order)
);

create table if not exists public.digital_textbook_nodes (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.digital_textbook_modules(id) on delete cascade,
  node_code text not null,
  node_type text not null check (node_type in ('learn', 'practice', 'mission', 'review')),
  sort_order integer not null check (sort_order > 0),
  estimated_minutes integer not null default 5 check (estimated_minutes between 1 and 90),
  title jsonb not null check (jsonb_typeof(title) = 'object'),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, node_code),
  unique (module_id, sort_order)
);

create table if not exists public.digital_textbook_activities (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.digital_textbook_nodes(id) on delete cascade,
  activity_key text not null,
  activity_type text not null check (activity_type in (
    'single_choice', 'multiple_choice', 'fill_blank', 'ordering',
    'listening', 'speaking', 'writing', 'self_check'
  )),
  sort_order integer not null check (sort_order > 0),
  prompt jsonb not null check (jsonb_typeof(prompt) = 'object'),
  instruction jsonb not null default '{}'::jsonb check (jsonb_typeof(instruction) = 'object'),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  public_config jsonb not null default '{}'::jsonb check (jsonb_typeof(public_config) = 'object'),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (node_id, activity_key),
  unique (node_id, sort_order)
);

-- This table is deliberately separated from browser-readable content.
create table if not exists public.digital_textbook_activity_secrets (
  activity_id uuid primary key references public.digital_textbook_activities(id) on delete cascade,
  answer_key jsonb not null default '{}'::jsonb check (jsonb_typeof(answer_key) = 'object'),
  explanation jsonb not null default '{}'::jsonb check (jsonb_typeof(explanation) = 'object'),
  transcript_ko text,
  audio_object_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_textbook_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  version_id uuid not null references public.digital_textbook_versions(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  score numeric(5,2) check (score is null or score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (tenant_id, student_id, activity_id, attempt_number)
);

create table if not exists public.digital_textbook_node_progress (
  tenant_id uuid not null default private.current_tenant_id() references public.tenants(id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  node_id uuid not null references public.digital_textbook_nodes(id) on delete cascade,
  version_id uuid not null references public.digital_textbook_versions(id) on delete restrict,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  completion_percent integer not null default 0 check (completion_percent between 0 and 100),
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, node_id, version_id)
);


-- Current chapter0 constraint from existing skeleton migration.
alter table public.digital_textbook_chapters drop constraint digital_textbook_chapters_chapter_number_check;
alter table public.digital_textbook_chapters add constraint digital_textbook_chapters_chapter_number_check check(chapter_number >= 0);
-- Existing 202608180006 and 202608180008 columns.
alter table public.digital_textbook_activities add column counts_toward_completion boolean not null default true;
alter table public.digital_textbook_attempts add column meets_completion_requirements boolean not null default false;
-- Mirror server-only progress/secret boundaries; never expose private row reads.
alter table public.digital_textbook_activity_secrets enable row level security;
alter table public.digital_textbook_attempts enable row level security;
alter table public.digital_textbook_node_progress enable row level security;
revoke all on public.digital_textbook_activity_secrets,public.digital_textbook_attempts,public.digital_textbook_node_progress from anon,authenticated;
grant usage on schema public,auth,private to service_role;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema auth,private to service_role;

-- Existing 202609130001 / 202608180005 current columns.
alter table public.digital_textbook_nodes add column authoring_grammar_identities jsonb not null default '[]' check(jsonb_typeof(authoring_grammar_identities)='array');
alter table public.digital_textbook_activity_secrets add column audio_status text not null default 'pending' check(audio_status in ('pending','ready','rejected'));
