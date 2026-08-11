-- Cloudflare Realtime SFU room state for group live classes.
-- Provider session/track identifiers are server-managed and never exposed through
-- direct table grants. Students only read their own speaking grant on the member row.

begin;

alter table public.live_class_members
  add column if not exists voice_granted_at timestamptz;

create table if not exists public.live_class_voice_connections (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_kind text not null check (connection_kind in ('publisher', 'subscriber')),
  provider_session_id text not null,
  track_name text,
  track_mid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (session_id, user_id, connection_kind)
);

create index if not exists live_class_voice_connections_active_room_idx
  on public.live_class_voice_connections (session_id, connection_kind)
  where closed_at is null;

alter table public.live_class_voice_connections enable row level security;

revoke all on table public.live_class_voice_connections from public, anon, authenticated;
revoke all on sequence public.live_class_voice_connections_id_seq from public, anon, authenticated;
grant all on table public.live_class_voice_connections to service_role;
grant all on sequence public.live_class_voice_connections_id_seq to service_role;

comment on column public.live_class_members.voice_granted_at is
  'Teacher-controlled microphone grant. Null means the student cannot publish audio.';
comment on table public.live_class_voice_connections is
  'Server-only mapping between an LMS class participant and Cloudflare Realtime SFU sessions/tracks.';

commit;
