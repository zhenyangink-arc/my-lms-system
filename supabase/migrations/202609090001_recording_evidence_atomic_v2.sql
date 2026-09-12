begin;

-- Side-by-side v2 protocol. No old RPC, evidence, attempt or object is replaced.
create schema if not exists recording_private;
revoke all on schema recording_private from public, anon, authenticated, service_role;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Earlier migrations install pgcrypto on the default path; managed Supabase
-- may already place it in extensions. Bind to its actual catalog namespace,
-- without moving the extension or depending on a caller-controlled search_path.
do $migration$
declare ns text;
begin
  select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  execute format('create function recording_private.sha256(value bytea) returns bytea language sql immutable set search_path = '''' as %L',
    format('select %I.digest(value, ''sha256'')', ns));
  execute format('create function recording_private.mac(value bytea, key bytea) returns bytea language sql immutable set search_path = '''' as %L',
    format('select %I.hmac(value, key, ''sha256'')', ns));
end $migration$;

-- Provision separately through an operator-only secret channel. An empty keyring
-- fails closed. Never insert a deployment secret in a migration or client config.
create table recording_private.proof_keys (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,64}$'),
  secret bytea not null check (octet_length(secret) >= 32),
  enabled boolean not null default true
);
revoke all on recording_private.proof_keys from public, anon, authenticated, service_role;
alter table recording_private.proof_keys enable row level security;

create function recording_private.canonical(v jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare result text;
begin
  case jsonb_typeof(v)
    when 'object' then
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || recording_private.canonical(value), ',' order by key collate "C"), '') || '}'
      into result from jsonb_each(v);
    when 'array' then
      select '[' || coalesce(string_agg(recording_private.canonical(value), ',' order by ord), '') || ']'
      into result from jsonb_array_elements(v) with ordinality a(value, ord);
    when 'number' then result := trim_scale((v::text)::numeric)::text;
    else result := v::text;
  end case;
  return result;
end $$;

create function recording_private.hash(v jsonb) returns text
language sql immutable set search_path = '' as $$
  select encode(recording_private.sha256(convert_to(recording_private.canonical(v), 'UTF8')), 'hex')
$$;

create function recording_private.require_service() returns void
language plpgsql set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'RECORDING_SERVICE_ONLY' using errcode = '42501';
  end if;
end $$;

-- JSON is interpreted as known historical variants, never a backend fallback.
create function recording_private.identity(e public.digital_textbook_speaking_evidence)
returns jsonb language plpgsql set search_path = '' as $$
declare m jsonb := e.metadata; base text; backend text; kind text; extra text[];
begin
  if jsonb_typeof(m) is distinct from 'object' or e.byte_size not between 2048 and 10485760
    or e.mime_type not in ('audio/webm','audio/ogg','audio/mp4','audio/mpeg') then
    raise exception 'RECORDING_METADATA_INVALID';
  end if;
  if (m ? 'lifecycle' and m->'lifecycle' not in ('"active"'::jsonb,'"delete-pending"'::jsonb,'"consumed"'::jsonb))
    or (m ? 'storage' and m->'storage' <> '"r2"'::jsonb) then raise exception 'RECORDING_METADATA_INVALID'; end if;
  if m ? 'sceneId' then
    kind := 'roleplay-turn'; extra := array['sceneId','roleSide','turnIndex','transcript','transcriptSource'];
    if jsonb_typeof(m->'sceneId') is distinct from 'string' or length(m->>'sceneId') not between 1 and 80
      or coalesce(m->>'roleSide','') not in ('left','right')
      or jsonb_typeof(m->'turnIndex') is distinct from 'number'
      or coalesce(m->>'turnIndex','') !~ '^(0|[1-9][0-9]{0,2})$' then raise exception 'RECORDING_ROLE_INVALID'; end if;
    if (m ? 'transcript' and m->'transcript' <> 'null'::jsonb and
      (jsonb_typeof(m->'transcript') <> 'string' or length(m->>'transcript')>500))
      or (m ? 'transcriptSource' and m->'transcriptSource' not in ('null'::jsonb,'"browser_speech_recognition"'::jsonb)) then
      raise exception 'RECORDING_ROLE_INVALID'; end if;
  elsif m ? 'practiceKey' then
    kind := case m->>'practiceKey' when 'repeat-line' then 'guided-repeat-line' when 'full-recall' then 'full-recall' end;
    extra := array['practiceKey','trackIndex','segmentIndex','durationSeconds'];
    if kind is null or jsonb_typeof(m->'trackIndex') is distinct from 'number'
      or jsonb_typeof(m->'segmentIndex') is distinct from 'number' or coalesce(m->>'trackIndex','') !~ '^[0-8]$'
      or coalesce(m->>'segmentIndex','') !~ '^(100|[1-9]?[0-9])$' then raise exception 'RECORDING_REPEAT_INVALID'; end if;
  elsif m ? 'durationSeconds' then
    kind := 'independent-output'; extra := array['durationSeconds'];
  else
    kind := 'legacy-speaking'; extra := array[]::text[];
  end if;
  if (m - (extra || array['storage','runtimeBinding','lifecycle'])) <> '{}'::jsonb
    or (m ? 'durationSeconds' and (jsonb_typeof(m->'durationSeconds') is distinct from 'number' or (m->>'durationSeconds')::numeric <= 0)) then
    raise exception 'RECORDING_METADATA_UNKNOWN';
  end if;
  base := e.tenant_id::text || '/' || e.student_id::text || '/' || e.activity_id::text || '/' || e.id::text ||
    case e.mime_type when 'audio/ogg' then '.ogg' when 'audio/mp4' then '.m4a' when 'audio/mpeg' then '.mp3' else '.webm' end;
  if e.object_key = 'student-recordings/' || base and kind <> 'legacy-speaking'
    and (not (m ? 'storage') or m->>'storage' = 'r2') then backend := 'r2';
  elsif e.object_key = base and kind = 'legacy-speaking' and not (m ? 'storage') then backend := 'legacy-supabase';
  else raise exception 'RECORDING_BACKEND_PATH_MISMATCH'; end if;
  return jsonb_build_object('backend', backend, 'kind', kind, 'objectDigest', recording_private.hash(jsonb_build_object('backend',backend,'key',e.object_key)));
end $$;

create function recording_private.check_scope(e public.digital_textbook_speaking_evidence,
  tenant uuid, student uuid, activity uuid, version uuid, binding jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  if tenant is null or student is null or activity is null or version is null
    or e.id is null or e.tenant_id <> tenant or e.student_id <> student or e.activity_id <> activity
    or not exists (select 1 from public.digital_textbook_activities a
      join public.digital_textbook_nodes n on n.id=a.node_id
      join public.digital_textbook_modules m on m.id=n.module_id
      join public.digital_textbook_chapters c on c.id=m.chapter_id
      where a.id=activity and a.activity_type='speaking' and c.version_id=version) then
    raise exception 'RECORDING_OWNER_ACTIVITY_VERSION_MISMATCH';
  end if;
  if binding is not null then
    if jsonb_typeof(binding) <> 'object' or (binding - array['snapshot','sourceRevision','versionId','activityRef','recordingKind']) <> '{}'
      or (select count(*) from jsonb_each(binding)) <> 5
      or exists (select 1 from jsonb_each(binding) where jsonb_typeof(value) <> 'string' or length(value #>> '{}')=0)
      or binding->>'versionId' <> version::text
      or binding->>'recordingKind' <> recording_private.identity(e)->>'kind' then
      raise exception 'RECORDING_RUNTIME_BINDING_INVALID';
    end if;
  end if;
  -- NULL is only the unbound legacy domain, never an escape hatch for Runtime.
  if (e.metadata->'runtimeBinding') is distinct from binding then raise exception 'RECORDING_RUNTIME_BINDING_MISMATCH'; end if;
end $$;

create function recording_private.verify(e public.digital_textbook_speaking_evidence,
  version uuid, binding jsonb, purpose text, response jsonb, proof jsonb)
returns void language plpgsql set search_path = '' as $$
declare claims jsonb; identity jsonb; expected jsonb; key bytea; now_epoch bigint;
begin
  identity := recording_private.identity(e);
  if e.consumed_at is not null or e.consumed_attempt_number is not null
    or coalesce(e.metadata->>'lifecycle','active') <> 'active'
    or e.created_at < clock_timestamp() - interval '24 hours' or e.created_at > clock_timestamp() then
    raise exception 'RECORDING_NOT_CONSUMABLE';
  end if;
  if jsonb_typeof(proof) is distinct from 'object' or (proof - array['keyId','payload','signature']) <> '{}'
    or coalesce(proof->>'signature','') !~ '^[0-9a-f]{64}$' then raise exception 'RECORDING_PROOF_INVALID'; end if;
  select secret into key from recording_private.proof_keys where id=proof->>'keyId' and enabled;
  if key is null or encode(recording_private.mac(convert_to(proof->>'payload','UTF8'),key),'hex') is distinct from proof->>'signature' then
    raise exception 'RECORDING_PROOF_SIGNATURE';
  end if;
  claims := (proof->>'payload')::jsonb;
  now_epoch := floor(extract(epoch from clock_timestamp()));
  if coalesce(claims->>'issuedAt','') !~ '^[0-9]{10}$' or coalesce(claims->>'expiresAt','') !~ '^[0-9]{10}$'
    or coalesce(claims->>'nonce','') !~ '^[0-9a-f]{64}$' then raise exception 'RECORDING_PROOF_TIME'; end if;
  if (claims->>'issuedAt')::bigint > now_epoch or (claims->>'expiresAt')::bigint <= now_epoch
    or (claims->>'expiresAt')::bigint - (claims->>'issuedAt')::bigint not between 1 and 60 then raise exception 'RECORDING_PROOF_EXPIRED'; end if;
  expected := jsonb_build_object('protocol','recording-object-proof.v2','purpose',purpose,
    'evidenceId',e.id,'tenantId',e.tenant_id,'studentId',e.student_id,'activityId',e.activity_id,
    'versionId',version,'runtimeBinding',binding,'backend',identity->>'backend','recordingKind',identity->>'kind',
    'objectDigest',identity->>'objectDigest','metadataDigest',recording_private.hash(e.metadata),
    'byteSize',e.byte_size,'mimeType',e.mime_type,'responseDigest',recording_private.hash(response),
    'issuedAt',claims->'issuedAt','expiresAt',claims->'expiresAt','nonce',claims->'nonce');
  if claims is distinct from expected then raise exception 'RECORDING_PROOF_BINDING_MISMATCH'; end if;
  if identity->>'backend' = 'legacy-supabase' and not exists (
    select 1 from storage.objects o where o.bucket_id='digital-textbook-student-recordings' and o.name=e.object_key
      and o.metadata->>'size'=e.byte_size::text
      and split_part(coalesce(o.metadata->>'mimetype',o.metadata->>'contentType',''),';',1)=e.mime_type
  ) then raise exception 'RECORDING_LEGACY_OBJECT_INVALID'; end if;
end $$;

create function public.record_smart_textbook_speaking_attempt_v2(
  p_tenant_id uuid, p_student_id uuid, p_activity_id uuid, p_version_id uuid,
  p_response jsonb, p_evidence_id uuid, p_runtime_binding jsonb, p_proof jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.digital_textbook_speaking_evidence; result jsonb; kind text;
begin
  perform recording_private.require_service();
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_student_id::text||':'||p_activity_id::text,0));
  select * into e from public.digital_textbook_speaking_evidence where id=p_evidence_id for update;
  perform recording_private.check_scope(e,p_tenant_id,p_student_id,p_activity_id,p_version_id,p_runtime_binding);
  kind := recording_private.identity(e)->>'kind';
  if kind not in ('independent-output','legacy-speaking') then raise exception 'RECORDING_SPEAKING_KIND'; end if;
  perform recording_private.verify(e,p_version_id,p_runtime_binding,'speaking-completion',p_response,p_proof);
  -- Qualification is issued by the existing application grader, bound into the
  -- signed response. This RPC does not invent a second score or grading policy.
  select to_jsonb(r) into result from public.record_smart_textbook_attempt(
    p_tenant_id,p_student_id,p_activity_id,p_version_id,p_response,null,null,true) r;
  update public.digital_textbook_speaking_evidence set consumed_at=clock_timestamp(),
    consumed_attempt_number=(result->>'attempt_number')::integer,
    metadata=jsonb_set(metadata,'{lifecycle}','"consumed"') where id=e.id;
  return result;
end $$;

create function public.complete_smart_textbook_roleplay_v2(
  p_tenant_id uuid, p_student_id uuid, p_activity_id uuid, p_version_id uuid,
  p_scene_id text, p_role_side text, p_evidence_proofs jsonb, p_runtime_binding jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare scene jsonb; turns integer[]; seen integer[] := '{}'; ids uuid[]; item jsonb;
  e public.digital_textbook_speaking_evidence; result jsonb; response jsonb;
begin
  perform recording_private.require_service();
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_student_id::text||':'||p_activity_id::text,0));
  if p_role_side is null or p_role_side not in ('left','right') then raise exception 'RECORDING_ROLE_INVALID'; end if;
  select s into scene from public.digital_textbook_activities a
    join public.digital_textbook_nodes n on n.id=a.node_id
    join public.digital_textbook_modules m on m.id=n.module_id
    join public.digital_textbook_chapters c on c.id=m.chapter_id
    cross join lateral jsonb_array_elements(n.content->'dialogueScenes') s
    where a.id=p_activity_id and a.activity_type='speaking' and a.public_config->>'practiceKind'='dialogue_roleplay'
      and c.version_id=p_version_id and s->>'id'=p_scene_id;
  if scene is null or jsonb_typeof(scene->'lines') <> 'array' then raise exception 'RECORDING_SCENE_INVALID'; end if;
  select array_agg(i order by i) into turns from generate_series(0,jsonb_array_length(scene->'lines')-1) i
    where i%2=case p_role_side when 'left' then 0 else 1 end;
  if coalesce(cardinality(turns),0)=0 then raise exception 'RECORDING_TURNS_EMPTY'; end if;
  -- Deliberate conflict, not success: stale/new-snapshot callers cannot use an
  -- old completed attempt as proof of their own submitted evidence.
  if exists(select 1 from public.digital_textbook_attempts where tenant_id=p_tenant_id and student_id=p_student_id
    and activity_id=p_activity_id and version_id=p_version_id and meets_completion_requirements) then
    raise exception 'RECORDING_ROLEPLAY_ALREADY_COMPLETED' using errcode='23505';
  end if;
  if jsonb_typeof(p_evidence_proofs) is distinct from 'array' or jsonb_array_length(p_evidence_proofs) <> cardinality(turns)
    or exists(select 1 from jsonb_array_elements(p_evidence_proofs) x where jsonb_typeof(x)<>'object' or (x-array['evidenceId','proof'])<>'{}') then
    raise exception 'RECORDING_COVERAGE_INVALID';
  end if;
  select array_agg((x->>'evidenceId')::uuid order by (x->>'evidenceId')::uuid) into ids from jsonb_array_elements(p_evidence_proofs) x;
  if (select count(distinct id) from unnest(ids) id) <> cardinality(turns) then raise exception 'RECORDING_DUPLICATE_EVIDENCE'; end if;
  response := jsonb_build_object('sceneId',p_scene_id,'roleSide',p_role_side,'recordedTurns',to_jsonb(turns));
  -- Activity lock first, UUID row order second, node lock inside the old RPC last.
  for e in select * from public.digital_textbook_speaking_evidence where id=any(ids) order by id for update loop
    perform recording_private.check_scope(e,p_tenant_id,p_student_id,p_activity_id,p_version_id,p_runtime_binding);
    if recording_private.identity(e)->>'kind'<>'roleplay-turn' or e.metadata->>'sceneId' is distinct from p_scene_id
      or e.metadata->>'roleSide' is distinct from p_role_side or not ((e.metadata->>'turnIndex')::integer=any(turns)) then
      raise exception 'RECORDING_ROLE_BINDING_MISMATCH';
    end if;
    select x->'proof' into item from jsonb_array_elements(p_evidence_proofs) x where x->>'evidenceId'=e.id::text;
    perform recording_private.verify(e,p_version_id,p_runtime_binding,'roleplay-completion',response,item);
    seen := array_append(seen,(e.metadata->>'turnIndex')::integer);
  end loop;
  if cardinality(seen) <> cardinality(turns) or (select count(distinct t) from unnest(seen) t) <> cardinality(turns) then
    raise exception 'RECORDING_COVERAGE_INVALID';
  end if;
  select to_jsonb(r) into result from public.record_smart_textbook_attempt(
    p_tenant_id,p_student_id,p_activity_id,p_version_id,response,null,null,true) r;
  update public.digital_textbook_speaking_evidence set consumed_at=clock_timestamp(),
    consumed_attempt_number=(result->>'attempt_number')::integer,
    metadata=jsonb_set(metadata,'{lifecycle}','"consumed"') where id=any(ids);
  return result;
end $$;

-- Same claim for explicit DELETE and replacement cleanup. Never delete a newly
-- uploaded object through this protocol without first creating its evidence row.
create function public.claim_smart_textbook_recording_delete_v2(
  p_tenant_id uuid,p_student_id uuid,p_activity_id uuid,p_version_id uuid,p_evidence_id uuid,p_runtime_binding jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.digital_textbook_speaking_evidence; identity jsonb;
begin
  perform recording_private.require_service();
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_student_id::text||':'||p_activity_id::text,0));
  select * into e from public.digital_textbook_speaking_evidence where id=p_evidence_id for update;
  perform recording_private.check_scope(e,p_tenant_id,p_student_id,p_activity_id,p_version_id,p_runtime_binding);
  identity := recording_private.identity(e);
  if e.consumed_at is not null or coalesce(e.metadata->>'lifecycle','active') not in ('active','delete-pending') then
    raise exception 'RECORDING_DELETE_CONFLICT';
  end if;
  update public.digital_textbook_speaking_evidence set metadata=jsonb_set(metadata,'{lifecycle}','"delete-pending"') where id=e.id;
  -- Server-private DTO; never return this object identity to the browser.
  return jsonb_build_object('evidenceId',e.id,'backend',identity->>'backend','objectKey',e.object_key,'state','delete-pending');
end $$;

create function public.finalize_smart_textbook_recording_delete_v2(
  p_tenant_id uuid,p_student_id uuid,p_activity_id uuid,p_version_id uuid,p_evidence_id uuid,p_runtime_binding jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.digital_textbook_speaking_evidence;
begin
  perform recording_private.require_service();
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text||':'||p_student_id::text||':'||p_activity_id::text,0));
  select * into e from public.digital_textbook_speaking_evidence where id=p_evidence_id for update;
  if e.id is null then return jsonb_build_object('state','already-absent'); end if;
  perform recording_private.check_scope(e,p_tenant_id,p_student_id,p_activity_id,p_version_id,p_runtime_binding);
  if e.consumed_at is not null or e.metadata->>'lifecycle' is distinct from 'delete-pending' then raise exception 'RECORDING_DELETE_NOT_CLAIMED'; end if;
  delete from public.digital_textbook_speaking_evidence where id=e.id;
  return jsonb_build_object('state','deleted');
end $$;

revoke all on all functions in schema recording_private from public, anon, authenticated, service_role;
revoke all on function public.record_smart_textbook_speaking_attempt_v2(uuid,uuid,uuid,uuid,jsonb,uuid,jsonb,jsonb),
  public.complete_smart_textbook_roleplay_v2(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb),
  public.claim_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb),
  public.finalize_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_smart_textbook_speaking_attempt_v2(uuid,uuid,uuid,uuid,jsonb,uuid,jsonb,jsonb),
  public.complete_smart_textbook_roleplay_v2(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb),
  public.claim_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb),
  public.finalize_smart_textbook_recording_delete_v2(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

commit;
