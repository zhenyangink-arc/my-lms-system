create table if not exists public.digital_textbook_guided_repeat_progress (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  practice_key text not null check (practice_key = 'repeat-line'),
  track_index integer not null check (track_index between 0 and 8),
  segment_index integer not null check (segment_index between 0 and 100),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, student_id, activity_id, practice_key, track_index, segment_index)
);

alter table public.digital_textbook_guided_repeat_progress enable row level security;

revoke all on table public.digital_textbook_guided_repeat_progress from anon, authenticated;
grant all on table public.digital_textbook_guided_repeat_progress to service_role;

drop trigger if exists digital_textbook_guided_repeat_progress_set_updated_at
  on public.digital_textbook_guided_repeat_progress;
create trigger digital_textbook_guided_repeat_progress_set_updated_at
before update on public.digital_textbook_guided_repeat_progress
for each row execute function private.set_updated_at();

comment on table public.digital_textbook_guided_repeat_progress is
  'Server-managed per-line completion state for guided smart-textbook repeat practice.';
