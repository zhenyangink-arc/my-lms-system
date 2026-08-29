begin;

create table public.learning_agent_script_audio_assets (
  id uuid primary key default gen_random_uuid(),
  script_node_id uuid not null references public.learning_agent_script_nodes(id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'ko-KR')),
  segment_index integer not null check (segment_index between 0 and 199),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  object_key text not null check (
    object_key ~ '^learning-agent/speech/teacher-kim/v1/[a-z0-9-]+/(zh-CN|ko-KR)/[0-9]+-[a-f0-9]{16}\.mp3$'
  ),
  duration_ms integer not null check (duration_ms > 0),
  cue_timeline jsonb not null default '[]'::jsonb check (jsonb_typeof(cue_timeline) = 'array'),
  voice_manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(voice_manifest) = 'object'),
  production_status text not null default 'pending' check (production_status in ('pending', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (script_node_id, locale, segment_index)
);

create index learning_agent_script_audio_assets_node_idx
  on public.learning_agent_script_audio_assets(script_node_id, locale, segment_index);

drop trigger if exists learning_agent_script_audio_assets_set_updated_at
  on public.learning_agent_script_audio_assets;
create trigger learning_agent_script_audio_assets_set_updated_at
before update on public.learning_agent_script_audio_assets
for each row execute function private.set_updated_at();

alter table public.learning_agent_script_audio_assets enable row level security;

-- Audio object keys and alignment metadata stay behind authenticated API routes.
-- Students receive only a short-lived R2 URL for an asset belonging to a
-- currently published script version.
revoke all on table public.learning_agent_script_audio_assets from public, anon, authenticated;
grant all on table public.learning_agent_script_audio_assets to service_role;

comment on table public.learning_agent_script_audio_assets is
  'R2 speech assets for exact learning-agent script segments, guarded by content hashes.';
comment on column public.learning_agent_script_audio_assets.content_hash is
  'SHA-256 of the exact normalized teacher-script segment used to generate this audio.';
comment on column public.learning_agent_script_audio_assets.cue_timeline is
  'Character-index timing cues used to reveal the matching teacher line during playback.';

commit;
