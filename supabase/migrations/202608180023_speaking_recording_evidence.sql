begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'digital-textbook-student-recordings',
  'digital-textbook-student-recordings',
  false,
  10485760,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

create table public.digital_textbook_speaking_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.digital_textbook_activities(id) on delete cascade,
  object_key text not null unique,
  byte_size bigint not null check (byte_size >= 2048 and byte_size <= 10485760),
  mime_type text not null check (mime_type in ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_attempt_number integer check (consumed_attempt_number is null or consumed_attempt_number > 0),
  check (
    (consumed_at is null and consumed_attempt_number is null)
    or (consumed_at is not null and consumed_attempt_number is not null)
  )
);

create index digital_textbook_speaking_evidence_owner_idx
  on public.digital_textbook_speaking_evidence(
    tenant_id, student_id, activity_id, created_at desc
  );

alter table public.digital_textbook_speaking_evidence enable row level security;
revoke all on public.digital_textbook_speaking_evidence from anon, authenticated;
grant select, insert, update, delete
  on public.digital_textbook_speaking_evidence
  to service_role;

create function public.record_smart_textbook_speaking_attempt(
  p_tenant_id uuid,
  p_student_id uuid,
  p_activity_id uuid,
  p_version_id uuid,
  p_response jsonb,
  p_evidence_id uuid
)
returns table (
  attempt_number integer,
  node_completed boolean,
  completion_percent integer,
  mastery_score integer,
  node_attempt_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  evidence public.digital_textbook_speaking_evidence%rowtype;
  stored_size bigint;
  stored_mime text;
  recorded_attempt_number integer;
  recorded_node_completed boolean;
  recorded_completion_percent integer;
  recorded_mastery_score integer;
  recorded_node_attempt_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'SMART_TEXTBOOK_SERVICE_ROLE_REQUIRED'
      using errcode = '42501';
  end if;

  select * into evidence
  from public.digital_textbook_speaking_evidence
  where id = p_evidence_id
  for update;

  if evidence.id is null
    or evidence.tenant_id <> p_tenant_id
    or evidence.student_id <> p_student_id
    or evidence.activity_id <> p_activity_id
    or evidence.consumed_at is not null
    or evidence.created_at < now() - interval '24 hours'
    or evidence.byte_size < 2048
    or evidence.object_key <> (
      p_tenant_id::text || '/' || p_student_id::text || '/' ||
      p_activity_id::text || '/' || p_evidence_id::text ||
      case evidence.mime_type
        when 'audio/ogg' then '.ogg'
        when 'audio/mp4' then '.m4a'
        when 'audio/mpeg' then '.mp3'
        else '.webm'
      end
    )
  then
    raise exception 'SMART_TEXTBOOK_RECORDING_EVIDENCE_INVALID'
      using errcode = '22023';
  end if;

  select
    case
      when object.metadata->>'size' ~ '^[0-9]+$'
        then (object.metadata->>'size')::bigint
      else 0
    end,
    coalesce(object.metadata->>'mimetype', object.metadata->>'contentType')
  into stored_size, stored_mime
  from storage.objects as object
  where object.bucket_id = 'digital-textbook-student-recordings'
    and object.name = evidence.object_key;

  if coalesce(stored_size, 0) < 2048
    or stored_size <> evidence.byte_size
    or split_part(coalesce(stored_mime, ''), ';', 1) <> evidence.mime_type
  then
    raise exception 'SMART_TEXTBOOK_RECORDING_OBJECT_INVALID'
      using errcode = '22023';
  end if;

  select
    result.attempt_number,
    result.node_completed,
    result.completion_percent,
    result.mastery_score,
    result.node_attempt_count
  into
    recorded_attempt_number,
    recorded_node_completed,
    recorded_completion_percent,
    recorded_mastery_score,
    recorded_node_attempt_count
  from public.record_smart_textbook_attempt(
    p_tenant_id,
    p_student_id,
    p_activity_id,
    p_version_id,
    p_response,
    null,
    null,
    true
  ) as result;

  update public.digital_textbook_speaking_evidence
  set consumed_at = now(),
      consumed_attempt_number = recorded_attempt_number
  where id = evidence.id;

  return query select
    recorded_attempt_number,
    recorded_node_completed,
    recorded_completion_percent,
    recorded_mastery_score,
    recorded_node_attempt_count;
end;
$$;

revoke all on function public.record_smart_textbook_speaking_attempt(
  uuid, uuid, uuid, uuid, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_speaking_attempt(
  uuid, uuid, uuid, uuid, jsonb, uuid
) to service_role;

comment on table public.digital_textbook_speaking_evidence is
  'Server-created metadata for private student recordings. A qualifying speaking attempt atomically consumes one verified object.';

commit;
