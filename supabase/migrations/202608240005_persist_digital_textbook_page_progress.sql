create table if not exists public.digital_textbook_activity_page_progress (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  version_id uuid not null references public.digital_textbook_versions(id) on delete cascade,
  page_index integer not null check (page_index >= 0),
  item_indices jsonb not null default '[]'::jsonb,
  response jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  answers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, activity_id, version_id, page_index)
);

alter table public.digital_textbook_activity_page_progress enable row level security;

revoke all on table public.digital_textbook_activity_page_progress from anon, authenticated;
grant all on table public.digital_textbook_activity_page_progress to service_role;

drop trigger if exists digital_textbook_activity_page_progress_set_updated_at
  on public.digital_textbook_activity_page_progress;
create trigger digital_textbook_activity_page_progress_set_updated_at
before update on public.digital_textbook_activity_page_progress
for each row execute function private.set_updated_at();

comment on table public.digital_textbook_activity_page_progress is
  'Server-managed resumable state for checked smart-textbook activity pages; not learner-queryable directly.';
