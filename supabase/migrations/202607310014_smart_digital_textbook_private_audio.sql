begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'digital-textbook-audio',
  'digital-textbook-audio',
  false,
  10485760,
  array['audio/mpeg', 'audio/mp3']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

update public.digital_textbook_activity_secrets as secret
set audio_object_key = 'korean-level-one/chapter-01/listening-identity.mp3',
    updated_at = now()
from public.digital_textbook_activities as activity
where activity.id = secret.activity_id
  and activity.activity_key = 'listening-identity';

update public.digital_textbook_activities
set public_config = public_config || jsonb_build_object(
      'audioStatus', 'ready',
      'replayLimit', 2
    ),
    updated_at = now()
where activity_key = 'listening-identity';

comment on column public.digital_textbook_activity_secrets.audio_object_key is
  'Object key in the private digital-textbook-audio bucket. The browser receives only a short-lived signed redirect.';

commit;
