-- Phase 4B-1C, prelaunch single-version authoring. Isolated deployment only.
-- No content, object, attempt, progress or immutable artifact is deleted.
begin;
create table runtime_publish_private.authoring_control (
 textbook_id uuid primary key references public.digital_textbooks(id),
 state text not null check(state in ('open','draining','editing')),
 revision bigint not null default 1 check(revision>0)
);
create table runtime_publish_private.runtime_requests (
 id uuid primary key, textbook_id uuid not null references public.digital_textbooks(id),
 actor_id uuid not null, tenant_id uuid not null,
 started_at timestamptz not null default clock_timestamp(), finished_at timestamptz
);
create table runtime_publish_private.retired_snapshots (
 snapshot_id text primary key references runtime_publish_private.snapshots(id),
 retired_by uuid not null references public.profiles(id), at timestamptz not null default clock_timestamp()
);
create trigger immutable_retirement before update or delete on runtime_publish_private.retired_snapshots
 for each row execute function runtime_publish_private.immutable();
alter table runtime_publish_private.authoring_control enable row level security;
alter table runtime_publish_private.runtime_requests enable row level security;
alter table runtime_publish_private.retired_snapshots enable row level security;
revoke all on runtime_publish_private.authoring_control,runtime_publish_private.runtime_requests,runtime_publish_private.retired_snapshots from public,anon,authenticated,service_role;
create index runtime_request_inflight on runtime_publish_private.runtime_requests(textbook_id) where finished_at is null;

-- Exact, deliberately narrow audit-only projection. No status, metadata,
-- profile configuration, learner history or permission field is exempted.
create function runtime_publish_private.semantic_capture(p_capture jsonb) returns jsonb
 language plpgsql immutable set search_path='' as $$
declare result jsonb:=p_capture; name text; rows jsonb;
begin
 foreach name in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','chapter_tests'] loop
  select coalesce(jsonb_agg(r-'updated_at' order by (r-'updated_at')::text),'[]'::jsonb)
   into rows from jsonb_array_elements(p_capture->name) r;
  result:=jsonb_set(result,array[name],rows);
 end loop;
 return result;
end $$;
alter function runtime_publish_private.capture(jsonb) rename to capture_rows;
create function runtime_publish_private.capture(p_scope jsonb) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rev bigint;
begin
 result:=runtime_publish_private.semantic_capture(runtime_publish_private.capture_rows(p_scope));
 select revision into rev from runtime_publish_private.authoring_control where textbook_id=(p_scope->>'textbookId')::uuid;
 -- Private capture provenance, not a content column or public Manifest field.
 -- Even cancelling an edit republishes a fresh immutable snapshot; a revoked
 -- locator can never become valid again through identical-content republication.
 if rev is not null then result:=jsonb_set(result,'{digital_textbooks,0,runtimeAuthoringRevision}',to_jsonb(rev)); end if;
 return result;
end;
$$;
create or replace function runtime_publish_private.check_authoring_statement() returns trigger
 language plpgsql security definer set search_path='' as $$
declare f runtime_publish_private.dependency_fences%rowtype;
begin
 for f in select d.* from runtime_publish_private.dependency_fences d
  where not exists(select 1 from runtime_publish_private.retired_snapshots r where r.snapshot_id=d.snapshot_id) order by d.snapshot_id loop
  if runtime_publish_private.capture(f.scope) is distinct from runtime_publish_private.semantic_capture(f.capture) then
   raise exception 'PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW' using errcode='40001';
  end if;
 end loop;
 return null;
end $$;
create or replace function public.assert_runtime_dependency_fence_v1(p_snapshot text,p_capture jsonb) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from runtime_publish_private.dependency_fences d
  where d.snapshot_id=p_snapshot and d.capture=p_capture
  and not exists(select 1 from runtime_publish_private.retired_snapshots r where r.snapshot_id=d.snapshot_id)
  and not exists(select 1 from runtime_publish_private.authoring_control c where c.textbook_id=(d.scope->>'textbookId')::uuid and c.state<>'open'));
$$;

-- Leases surround the WHOLE application request, including separate domain
-- transactions and object I/O. Never expire a lease while a worker may write.
-- A crashed worker fails closed; no automatic TTL/force-clear operation.
create function public.runtime_publication_request_v1(p_operation text,p_actor uuid,p_tenant uuid,p_textbook uuid,p_request uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform runtime_publish_private.authoring_lock();
 if p_actor is null or p_tenant is null or p_request is null or not exists(select 1 from public.profiles where id=p_actor and status='active') then raise exception 'RUNTIME_REQUEST_AUTH'; end if;
 if p_operation='enter' then
  if exists(select 1 from runtime_publish_private.authoring_control where textbook_id=p_textbook and state<>'open') then raise exception 'TEXTBOOK_TEST_RUN_STOPPED'; end if;
  insert into runtime_publish_private.runtime_requests(id,textbook_id,actor_id,tenant_id) values(p_request,p_textbook,p_actor,p_tenant);
 elsif p_operation='leave' then
  update runtime_publish_private.runtime_requests set finished_at=coalesce(finished_at,clock_timestamp())
   where id=p_request and textbook_id=p_textbook and actor_id=p_actor and tenant_id=p_tenant;
  if not found then raise exception 'RUNTIME_REQUEST_OWNER'; end if;
 else raise exception 'RUNTIME_REQUEST_OPERATION'; end if;
 return jsonb_build_object('ok',true);
end $$;

create function public.begin_runtime_textbook_edit_v1(p_actor uuid,p_textbook uuid) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare count_inflight bigint; rev bigint;
begin
 perform runtime_publish_private.owner_guard(p_actor);
 perform runtime_publish_private.authoring_lock();
 if not exists(select 1 from public.digital_textbooks where id=p_textbook) then raise exception 'TEXTBOOK_NOT_FOUND'; end if;
 insert into runtime_publish_private.authoring_control values(p_textbook,'draining',1)
  on conflict(textbook_id) do update set state=case when runtime_publish_private.authoring_control.state='editing' then 'editing' else 'draining' end,
   revision=runtime_publish_private.authoring_control.revision+1 returning revision into rev;
 select count(*) into count_inflight from runtime_publish_private.runtime_requests where textbook_id=p_textbook and finished_at is null;
 if count_inflight>0 then return jsonb_build_object('state','draining','inflight',count_inflight,'revision',rev); end if;
 -- Revocation is explicitly authorized; records remain intact. This affects
 -- only locators of this textbook, never attempts/progress/evidence/Agent rows.
 update runtime_publish_private.sessions set revoked=true where snapshot_id in(select id from runtime_publish_private.snapshots where textbook_id=p_textbook) and not revoked;
 insert into runtime_publish_private.retired_snapshots(snapshot_id,retired_by)
  select id,p_actor from runtime_publish_private.snapshots where textbook_id=p_textbook on conflict do nothing;
 update runtime_publish_private.authoring_control set state='editing' where textbook_id=p_textbook;
 return jsonb_build_object('state','editing','inflight',0,'revision',rev);
end $$;

-- The old session function remains private behind this serialized boundary.
alter function public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) rename to runtime_publication_session_base_v1;
revoke all on function public.runtime_publication_session_base_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create function public.runtime_publication_session_v1(p_operation text,p_actor uuid,p_tenant uuid,p_ref uuid default null,p_scope jsonb default null,p_expected jsonb default null,p_locale text default 'zh-CN')
 returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; book uuid;
begin
 perform runtime_publish_private.authoring_lock();
 result:=public.runtime_publication_session_base_v1(p_operation,p_actor,p_tenant,p_ref,p_scope,p_expected,p_locale);
 if p_operation<>'revoke' then
  book:=(result#>>'{bundle,scope,textbookId}')::uuid;
  if exists(select 1 from runtime_publish_private.authoring_control where textbook_id=book and state<>'open')
   or exists(select 1 from runtime_publish_private.retired_snapshots where snapshot_id=result#>>'{bundle,snapshotId}') then raise exception 'TEXTBOOK_SESSION_RETIRED'; end if;
 end if;
 return result;
end $$;

alter function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) rename to publish_runtime_snapshot_base_v2;
revoke all on function public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.publish_runtime_snapshot_v2(p_actor uuid,p_scope jsonb,p_expected jsonb,p_operation text,p_bundle jsonb,p_target text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; state_value text; book uuid:=(p_scope->>'textbookId')::uuid;
begin
 perform runtime_publish_private.owner_guard(p_actor);
 perform runtime_publish_private.authoring_lock();
 select state into state_value from runtime_publish_private.authoring_control where textbook_id=book;
 if state_value='draining' then raise exception 'TEXTBOOK_DRAIN_INCOMPLETE'; end if;
 if exists(select 1 from runtime_publish_private.retired_snapshots where snapshot_id=case when p_operation='publish' then p_bundle->>'snapshotId' else p_target end) then raise exception 'RETIRED_SNAPSHOT_NOT_EXECUTABLE'; end if;
 result:=public.publish_runtime_snapshot_base_v2(p_actor,p_scope,p_expected,p_operation,p_bundle,p_target);
 update runtime_publish_private.authoring_control set state='open' where textbook_id=book;
 return result;
end $$;

-- Closed owner editing DAL for current Chapter 1. Existing authoring screens
-- also remain protected by the same DB fence; this is not a parallel editor.
create function public.edit_runtime_chapter_activity_v1(p_actor uuid,p_scope jsonb,p_activity uuid,p_prompt jsonb,p_answer jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
begin
 perform runtime_publish_private.owner_guard(p_actor);
 perform runtime_publish_private.authoring_lock();
 if not exists(select 1 from runtime_publish_private.authoring_control where textbook_id=(p_scope->>'textbookId')::uuid and state='editing') then raise exception 'EDIT_WINDOW_REQUIRED'; end if;
 if not exists(select 1 from public.digital_textbook_activities a join public.digital_textbook_nodes n on n.id=a.node_id
  join public.digital_textbook_modules m on m.id=n.module_id join public.digital_textbook_chapters c on c.id=m.chapter_id
  join public.digital_textbook_versions v on v.id=c.version_id where a.id=p_activity and c.id=(p_scope->>'chapterId')::uuid
  and v.id=(p_scope->>'versionId')::uuid and v.textbook_id=(p_scope->>'textbookId')::uuid and a.activity_type='single_choice') then raise exception 'EDIT_ACTIVITY_SCOPE'; end if;
 if jsonb_typeof(p_prompt)<>'object' or (p_prompt-'zh-CN'-'ko-KR')<>'{}'::jsonb or not (p_prompt ? 'zh-CN') or jsonb_typeof(p_prompt->'zh-CN')<>'string'
  or length(btrim(p_prompt->>'zh-CN'))=0 or p_prompt is null then raise exception 'EDIT_PROMPT'; end if;
 if p_answer is null or (p_answer-'kind'-'value')<>'{}'::jsonb or p_answer->>'kind' is distinct from 'index' or jsonb_typeof(p_answer->'value')<>'number'
  or not exists(select 1 from public.digital_textbook_activities where id=p_activity and (p_answer->>'value')::numeric=trunc((p_answer->>'value')::numeric) and (p_answer->>'value')::numeric>=0 and (p_answer->>'value')::numeric<jsonb_array_length(options)) then raise exception 'EDIT_ANSWER'; end if;
 update public.digital_textbook_activities set prompt=p_prompt where id=p_activity;
 update public.digital_textbook_activity_secrets set answer_key=p_answer where activity_id=p_activity;
 if not found then raise exception 'EDIT_SECRET_MISSING'; end if;
 return jsonb_build_object('saved',true);
end $$;

revoke all on all functions in schema runtime_publish_private from public,anon,authenticated,service_role;
revoke all on function public.runtime_publication_request_v1(text,uuid,uuid,uuid,uuid),public.begin_runtime_textbook_edit_v1(uuid,uuid),public.edit_runtime_chapter_activity_v1(uuid,jsonb,uuid,jsonb,jsonb),public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text),public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.runtime_publication_request_v1(text,uuid,uuid,uuid,uuid),public.begin_runtime_textbook_edit_v1(uuid,uuid),public.edit_runtime_chapter_activity_v1(uuid,jsonb,uuid,jsonb,jsonb),public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text),public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text) to service_role;
commit;
