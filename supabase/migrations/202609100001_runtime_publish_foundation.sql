-- Independent, forward-only Publish Foundation. NO Recording DDL/content seed.
begin;
create schema runtime_publish_private;
revoke all on schema runtime_publish_private from public, anon, authenticated, service_role;

create table runtime_publish_private.snapshots (
  id text primary key,
  textbook_id uuid not null references public.digital_textbooks(id),
  version_id uuid not null references public.digital_textbook_versions(id),
  chapter_id uuid not null references public.digital_textbook_chapters(id),
  document jsonb not null check (jsonb_typeof(document)='object'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  unique(id,textbook_id,version_id,chapter_id),
  check (document->>'snapshotId'=id and document->>'revision'='publish-foundation/1'),
  check (document->>'schemaVersion'='1.0.0' and document->>'runtimeContract'='uply-runtime/1'),
  check (document#>>'{manifest,snapshot,scope}'='chapter'),
  check (not document ? 'privatePayload')
);
create table runtime_publish_private.bindings (
  snapshot_id text primary key references runtime_publish_private.snapshots(id),
  payload jsonb not null check(jsonb_typeof(payload)='object'),
  digest text not null check(digest ~ '^[a-f0-9]{64}$'),
  check(payload#>>'{result,manifest,snapshot,id}'=snapshot_id)
);
create table runtime_publish_private.pointers (
  textbook_id uuid not null, version_id uuid not null, chapter_id uuid not null,
  snapshot_id text not null, generation bigint not null check(generation>0),
  primary key(textbook_id,version_id,chapter_id),
  foreign key(snapshot_id,textbook_id,version_id,chapter_id) references runtime_publish_private.snapshots(id,textbook_id,version_id,chapter_id)
);
create table runtime_publish_private.history (
  id bigint generated always as identity primary key,
  textbook_id uuid not null, version_id uuid not null, chapter_id uuid not null,
  from_snapshot text references runtime_publish_private.snapshots(id),
  to_snapshot text not null references runtime_publish_private.snapshots(id),
  generation bigint not null, operation text not null check(operation in ('publish','rollback')),
  actor_id uuid not null references public.profiles(id), at timestamptz not null default clock_timestamp(),
  unique(textbook_id,version_id,chapter_id,generation)
);
-- Only an opaque durable locator, not a second Learning/Agent state database.
create table runtime_publish_private.sessions (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id), tenant_id uuid not null,
  snapshot_id text not null references runtime_publish_private.snapshots(id),
  locale text not null check(locale in ('zh-CN','ko-KR')),
  expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  revoked boolean not null default false
);
create index runtime_publication_session_expiry on runtime_publish_private.sessions(expires_at);

create function runtime_publish_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'RUNTIME_SNAPSHOT_IMMUTABLE'; end $$;
create trigger immutable_snapshot before update or delete on runtime_publish_private.snapshots for each row execute function runtime_publish_private.immutable();
create trigger immutable_binding before update or delete on runtime_publish_private.bindings for each row execute function runtime_publish_private.immutable();
create trigger immutable_history before update or delete on runtime_publish_private.history for each row execute function runtime_publish_private.immutable();

create function runtime_publish_private.owner_guard(p_actor uuid) returns void language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=p_actor and global_role='platform_owner' and status='active') then
    raise exception 'PUBLICATION_OWNER_ONLY' using errcode='42501';
  end if;
end $$;

-- Called ONLY by the authenticated server DAL; actor is never a browser field.
-- One transaction stores BOTH halves and CAS pointer/history, including failures.
create function public.publish_runtime_snapshot_v1(p_actor uuid,p_scope jsonb,p_expected jsonb,p_operation text,p_bundle jsonb,p_target text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  t uuid := (p_scope->>'textbookId')::uuid; v uuid := (p_scope->>'versionId')::uuid; c uuid := (p_scope->>'chapterId')::uuid;
  old runtime_publish_private.pointers%rowtype; doc jsonb; dest text; gen bigint;
begin
  perform runtime_publish_private.owner_guard(p_actor);
  if p_operation not in ('publish','rollback') or p_operation is null then raise exception 'PUBLICATION_OPERATION'; end if;
  if not exists(select 1 from public.digital_textbook_chapters ch join public.digital_textbook_versions ver on ver.id=ch.version_id where ch.id=c and ver.id=v and ver.textbook_id=t) then raise exception 'PUBLICATION_SCOPE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t::text||'/'||v::text||'/'||c::text, 4171));
  select * into old from runtime_publish_private.pointers where textbook_id=t and version_id=v and chapter_id=c for update;
  if (old.snapshot_id is null and p_expected is not null and p_expected<>'null'::jsonb) or
     (old.snapshot_id is not null and (p_expected->>'snapshotId' is distinct from old.snapshot_id or p_expected->>'generation' is distinct from old.generation::text)) then
    raise exception 'PUBLICATION_CONFLICT' using errcode='40001';
  end if;
  if p_operation='publish' then
    if p_bundle is null or p_bundle->'scope' is distinct from p_scope or p_bundle->>'revision' is distinct from 'publish-foundation/1' or jsonb_typeof(p_bundle->'privatePayload') is distinct from 'object' then raise exception 'PUBLICATION_BUNDLE'; end if;
    dest:=p_bundle->>'snapshotId'; doc:=p_bundle-'privatePayload';
    if p_bundle#>>'{privatePayload,result,manifest}' is distinct from (p_bundle->'manifest')::text or
       p_bundle#>>'{privatePayload,result,report,sourceRevision}' is distinct from p_bundle->>'sourceRevision' then raise exception 'PUBLICATION_ASSOCIATION'; end if;
    if exists(select 1 from runtime_publish_private.snapshots where id=dest) then
      if not exists(select 1 from runtime_publish_private.snapshots s join runtime_publish_private.bindings b on b.snapshot_id=s.id where s.id=dest and s.document=doc and b.payload=p_bundle->'privatePayload' and b.digest=p_bundle->>'privateDigest') then raise exception 'PUBLICATION_ID_COLLISION'; end if;
    else
      insert into runtime_publish_private.snapshots(id,textbook_id,version_id,chapter_id,document,created_by) values(dest,t,v,c,doc,p_actor);
      insert into runtime_publish_private.bindings(snapshot_id,payload,digest) values(dest,p_bundle->'privatePayload',p_bundle->>'privateDigest');
    end if;
  else
    dest:=p_target;
    if not exists(select 1 from runtime_publish_private.history where textbook_id=t and version_id=v and chapter_id=c and to_snapshot=dest) then raise exception 'ROLLBACK_NOT_PUBLISHED'; end if;
  end if;
  gen:=coalesce(old.generation,0)+1;
  insert into runtime_publish_private.pointers values(t,v,c,dest,gen)
    on conflict(textbook_id,version_id,chapter_id) do update set snapshot_id=excluded.snapshot_id,generation=excluded.generation;
  insert into runtime_publish_private.history(textbook_id,version_id,chapter_id,from_snapshot,to_snapshot,generation,operation,actor_id)
    values(t,v,c,old.snapshot_id,dest,gen,p_operation,p_actor);
  return jsonb_build_object('snapshotId',dest,'generation',gen);
end $$;

-- All read RPCs are service-only. The DAL reauthenticates and enforces course RLS.
-- There is deliberately NO browser-selectable snapshot lookup operation.
create function public.read_runtime_publication_v1(p_scope jsonb,p_history_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if p_history_actor is not null then
    perform runtime_publish_private.owner_guard(p_history_actor);
    select coalesce(jsonb_agg(to_jsonb(h) order by generation),'[]'::jsonb) into result from runtime_publish_private.history h
      where textbook_id=(p_scope->>'textbookId')::uuid and version_id=(p_scope->>'versionId')::uuid and chapter_id=(p_scope->>'chapterId')::uuid;
  else
    select jsonb_build_object('pointer',jsonb_build_object('snapshotId',p.snapshot_id,'generation',p.generation),'bundle',s.document||jsonb_build_object('privatePayload',b.payload)) into result
      from runtime_publish_private.pointers p join runtime_publish_private.snapshots s on s.id=p.snapshot_id join runtime_publish_private.bindings b on b.snapshot_id=s.id and b.digest=s.document->>'privateDigest'
      where p.textbook_id=(p_scope->>'textbookId')::uuid and p.version_id=(p_scope->>'versionId')::uuid and p.chapter_id=(p_scope->>'chapterId')::uuid;
  end if;
  return result;
end $$;

create function public.read_runtime_snapshot_for_owner_v1(p_actor uuid,p_scope jsonb,p_snapshot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare artifact jsonb;
begin
  perform runtime_publish_private.owner_guard(p_actor);
  select s.document||jsonb_build_object('privatePayload',b.payload) into artifact
    from runtime_publish_private.snapshots s join runtime_publish_private.bindings b on b.snapshot_id=s.id and b.digest=s.document->>'privateDigest'
    where s.id=p_snapshot and s.textbook_id=(p_scope->>'textbookId')::uuid and s.version_id=(p_scope->>'versionId')::uuid and s.chapter_id=(p_scope->>'chapterId')::uuid
    and exists(select 1 from runtime_publish_private.history h where h.to_snapshot=s.id);
  if artifact is null then raise exception 'ROLLBACK_NOT_PUBLISHED'; end if;
  return artifact;
end $$;

create function public.runtime_publication_session_v1(p_operation text,p_actor uuid,p_tenant uuid,p_ref uuid default null,p_scope jsonb default null,p_expected jsonb default null,p_locale text default 'zh-CN')
returns jsonb language plpgsql security definer set search_path='' as $$
declare s runtime_publish_private.sessions%rowtype; ptr runtime_publish_private.pointers%rowtype; artifact jsonb;
begin
  if p_actor is null or p_tenant is null or not exists(select 1 from public.profiles where id=p_actor and status='active') then raise exception 'LEARNING_SESSION_AUTH'; end if;
  if p_operation='issue' then
    -- Lock serializes issue versus publication: validation's expected pointer cannot race.
    select * into ptr from runtime_publish_private.pointers where textbook_id=(p_scope->>'textbookId')::uuid and version_id=(p_scope->>'versionId')::uuid and chapter_id=(p_scope->>'chapterId')::uuid for share;
    if ptr.snapshot_id is null or p_expected->>'snapshotId' is distinct from ptr.snapshot_id or p_expected->>'generation' is distinct from ptr.generation::text then raise exception 'PUBLICATION_CONFLICT'; end if;
    insert into runtime_publish_private.sessions(actor_id,tenant_id,snapshot_id,locale) values(p_actor,p_tenant,ptr.snapshot_id,p_locale) returning * into s;
  elsif p_operation in ('resolve','revoke') then
    select * into s from runtime_publish_private.sessions where id=p_ref and actor_id=p_actor and tenant_id=p_tenant and not revoked and expires_at>clock_timestamp();
    if s.id is null then raise exception 'LEARNING_SESSION_EXPIRED_OR_OWNER'; end if;
    if p_operation='revoke' then update runtime_publish_private.sessions set revoked=true where id=s.id; return '{}'::jsonb; end if;
  else raise exception 'LEARNING_SESSION_OPERATION'; end if;
  select document||jsonb_build_object('privatePayload',b.payload) into artifact from runtime_publish_private.snapshots a join runtime_publish_private.bindings b on b.snapshot_id=a.id and b.digest=a.document->>'privateDigest' where a.id=s.snapshot_id;
  if artifact is null then raise exception 'LEARNING_SESSION_SNAPSHOT_MISSING'; end if;
  return jsonb_build_object('sessionRef','learning-session-'||s.id::text,'expiresAt',extract(epoch from s.expires_at)*1000,'locale',s.locale,'bundle',artifact);
end $$;

alter table runtime_publish_private.snapshots enable row level security;
alter table runtime_publish_private.bindings enable row level security;
alter table runtime_publish_private.pointers enable row level security;
alter table runtime_publish_private.history enable row level security;
alter table runtime_publish_private.sessions enable row level security;
revoke all on all tables in schema runtime_publish_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema runtime_publish_private from public,anon,authenticated,service_role;
revoke all on all functions in schema runtime_publish_private from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.read_runtime_publication_v1(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.read_runtime_snapshot_for_owner_v1(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text) to service_role;
grant execute on function public.read_runtime_publication_v1(jsonb,uuid) to service_role;
grant execute on function public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
grant execute on function public.read_runtime_snapshot_for_owner_v1(uuid,jsonb,text) to service_role;
commit;
