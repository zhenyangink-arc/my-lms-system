-- Native video uses existing sessions, request leases and atomic Activity storage.
-- Forward-only support; no content, sessions, permissions or historical RPC body changes.
begin;
create function runtime_publish_private.native_video_session_guard(p_actor uuid,p_tenant uuid,p_session uuid,p_lease uuid,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s runtime_publish_private.sessions%rowtype; b jsonb; binding jsonb;
begin
 if p_actor is null or p_tenant is null or p_session is null or p_lease is null
  or not exists(select 1 from public.profiles where id=p_actor and status='active') then raise exception 'NATIVE_SESSION_AUTH'; end if;
 select * into s from runtime_publish_private.sessions where id=p_session and actor_id=p_actor and tenant_id=p_tenant and not revoked and expires_at>clock_timestamp();
 if s.id is null then raise exception 'NATIVE_SESSION_EXPIRED_OR_OWNER'; end if;
 select a.document||jsonb_build_object('privatePayload',k.payload) into b from runtime_publish_private.snapshots a
  join runtime_publish_private.bindings k on k.snapshot_id=a.id and k.digest=a.document->>'privateDigest' where a.id=s.snapshot_id;
 if b is null or b->>'revision' is distinct from 'publish-foundation/3' or b->>'publicationKind' is distinct from 'canonical-native-video'
  or b->>'compilerVersion' is distinct from 'native-video-publication-1' or b#>>'{privatePayload,contract}' is distinct from 'canonical-native-video-publication/1'
  or b#>>'{manifest,execution,contract}' is distinct from 'native-execution/2' then raise exception 'NATIVE_SESSION_ARTIFACT'; end if;
 binding:=b#>'{privatePayload,bindings,0}';
 if p_expected is distinct from jsonb_build_object('snapshotId',b->'snapshotId','manifestDigest',b->'manifestDigest','privateDigest',b->'privateDigest',
  'cueId',binding->'cueId','activityRevision',binding->'activityRevision','mediaRevision',binding->'mediaRevision') then raise exception 'NATIVE_SESSION_EXPECTED'; end if;
 if not exists(select 1 from runtime_publish_private.runtime_requests r where r.id=p_lease and r.actor_id=p_actor and r.tenant_id=p_tenant
  and r.textbook_id=(b#>>'{scope,textbookId}')::uuid and r.finished_at is null) then raise exception 'NATIVE_SESSION_LEASE'; end if;
 if exists(select 1 from runtime_publish_private.authoring_control c where c.textbook_id=(b#>>'{scope,textbookId}')::uuid and c.state<>'open')
  or exists(select 1 from runtime_publish_private.retired_snapshots r where r.snapshot_id=s.snapshot_id)
  or not public.assert_runtime_dependency_fence_v1(s.snapshot_id,b#>'{privatePayload,dependencies}') then raise exception 'NATIVE_SESSION_FENCE'; end if;
 -- A live fence must agree with actual captured rows as well as its saved marker.
 if runtime_publish_private.capture(b->'scope') is distinct from b#>'{privatePayload,dependencies}' then raise exception 'NATIVE_SESSION_DEFINITION'; end if;
 return b;
end $$;
create function public.read_native_video_session_v1(p_actor uuid,p_tenant uuid,p_session uuid,p_lease uuid,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; original jsonb; origins jsonb:='[]'; seen text[]:='{}'; item record; saved runtime_publish_private.sessions%rowtype; count_attempts integer;
begin
 b:=runtime_publish_private.native_video_session_guard(p_actor,p_tenant,p_session,p_lease,p_expected);
 select count(*) into count_attempts from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor
  and a.version_id=(b#>>'{scope,versionId}')::uuid and a.activity_id=(b#>>'{privatePayload,bindings,0,activityId}')::uuid;
 if count_attempts>20 or count_attempts>(b#>>'{privatePayload,source,activities,0,max_attempts}')::integer then raise exception 'NATIVE_HISTORY_COUNT'; end if;
 for item in select a.response from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor
  and a.version_id=(b#>>'{scope,versionId}')::uuid and a.activity_id=(b#>>'{privatePayload,bindings,0,activityId}')::uuid order by a.response->>'sessionRef',a.attempt_number loop
  if jsonb_typeof(item.response->'sessionRef') is distinct from 'string' or (item.response->>'sessionRef') !~ '^learning-session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(item.response->'snapshotId') is distinct from 'string' or length(item.response->>'snapshotId')=0 then raise exception 'NATIVE_HISTORY_LOCATOR'; end if;
  select * into saved from runtime_publish_private.sessions where id=substring(item.response->>'sessionRef' from 18)::uuid and actor_id=p_actor and tenant_id=p_tenant;
  if saved.id is null or saved.snapshot_id is distinct from item.response->>'snapshotId' then raise exception 'NATIVE_HISTORY_OWNER'; end if;
  select a.document||jsonb_build_object('privatePayload',k.payload) into original from runtime_publish_private.snapshots a
   join runtime_publish_private.bindings k on k.snapshot_id=a.id and k.digest=a.document->>'privateDigest'
   where a.id=saved.snapshot_id and a.document->>'snapshotId'=a.id;
  if original is null or original->>'revision' is distinct from 'publish-foundation/3' or original->>'publicationKind' is distinct from 'canonical-native-video'
   or original->>'compilerVersion' is distinct from 'native-video-publication-1' or original#>>'{privatePayload,contract}' is distinct from 'canonical-native-video-publication/1'
   or original#>>'{manifest,execution,contract}' is distinct from 'native-execution/2' or original->'scope' is distinct from b->'scope' then raise exception 'NATIVE_HISTORY_ARTIFACT'; end if;
  if not (item.response->>'sessionRef'=any(seen)) then
   seen:=array_append(seen,item.response->>'sessionRef');origins:=origins||jsonb_build_array(jsonb_build_object('sessionRef',item.response->'sessionRef','actorId',saved.actor_id,'tenantId',saved.tenant_id,'bundle',original));
  end if;
 end loop;
 return jsonb_build_object('bundle',b,'attemptOrigins',origins);
end $$;

create function runtime_publish_private.guard_native_video_attempt() returns trigger
language plpgsql security definer set search_path='' as $$
declare b jsonb; binding jsonb; e jsonb; r jsonb; session_id uuid; lease_id uuid; option_index integer; answer_index integer;
begin
 -- Exact source/Activity/new-version association, not a global historical filter.
 if not exists(select 1 from public.learning_agent_script_nodes t
  join public.learning_agent_script_versions sv on sv.id=t.script_version_id and sv.status='published'
  join public.learning_agent_lessons l on l.id=sv.lesson_id and l.status='published'
  join public.digital_textbook_activities a on a.id=t.reference_activity_id
  join public.digital_textbook_nodes n on n.id=a.node_id and n.module_id=l.module_id
  join public.digital_textbook_modules m on m.id=n.module_id
  join public.digital_textbook_chapters c on c.id=m.chapter_id
  join public.digital_textbook_versions v on v.id=c.version_id and v.status='published'
  where (a.id=new.activity_id or (tg_op='UPDATE' and a.id=old.activity_id))
   and t.configuration#>>'{videoPilotPublication,contract}'='video-pilot-publication-source/1'
   and t.configuration#>>'{videoPilotPublication,cue,activityId}'=a.id::text) then return new; end if;
 if tg_op<>'INSERT' then raise exception 'NATIVE_ATTEMPT_IMMUTABLE'; end if;
 begin
  session_id:=nullif(current_setting('uply.native_video_session',true),'')::uuid;
  lease_id:=nullif(current_setting('uply.native_video_lease',true),'')::uuid;
 exception when others then raise exception 'NATIVE_ATOMIC_REQUIRED'; end;
 if session_id is null or lease_id is null then raise exception 'NATIVE_ATOMIC_REQUIRED'; end if;
 select a.document||jsonb_build_object('privatePayload',k.payload) into b from runtime_publish_private.sessions s
  join runtime_publish_private.snapshots a on a.id=s.snapshot_id join runtime_publish_private.bindings k on k.snapshot_id=a.id where s.id=session_id;
 binding:=b#>'{privatePayload,bindings,0}';
 e:=jsonb_build_object('snapshotId',b->'snapshotId','manifestDigest',b->'manifestDigest','privateDigest',b->'privateDigest','cueId',binding->'cueId','activityRevision',binding->'activityRevision','mediaRevision',binding->'mediaRevision');
 b:=runtime_publish_private.native_video_session_guard(new.student_id,new.tenant_id,session_id,lease_id,e);
 r:=new.response;
 if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'optionIndex') is distinct from 'number'
  or (r->>'optionIndex') !~ '^(0|[1-9][0-9]?)$' then raise exception 'NATIVE_ATTEMPT_RESPONSE'; end if;
 option_index:=(r->>'optionIndex')::integer;
 if jsonb_typeof(r->'generation') is distinct from 'number' or (r->>'generation') !~ '^(0|[1-9][0-9]*)$'
  or (r->>'generation')::numeric>9007199254740991 or jsonb_typeof(r->'requestId') is distinct from 'string'
  or (r->>'requestId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'NATIVE_ATTEMPT_RESPONSE'; end if;
 if r is distinct from jsonb_build_object('contract','native-video-choice-response/1','requestId',r->'requestId','sessionRef','learning-session-'||session_id::text,
  'snapshotId',b->'snapshotId','activityRevision',binding->'activityRevision','mediaRevision',binding->'mediaRevision','cueId','pause-1','optionIndex',option_index,'generation',r->'generation')
  or new.activity_id is distinct from (binding->>'activityId')::uuid or new.version_id is distinct from (b#>>'{scope,versionId}')::uuid
  or option_index>=jsonb_array_length(b#>'{privatePayload,source,activities,0,options}') then raise exception 'NATIVE_ATTEMPT_BINDING'; end if;
 answer_index:=(b#>>'{privatePayload,dependencies,digital_textbook_activity_secrets,0,answer_key,value}')::integer;
 if new.is_correct is distinct from (option_index=answer_index) or new.score is distinct from (case when option_index=answer_index then 100 else 0 end) then raise exception 'NATIVE_ATTEMPT_GRADE'; end if;
 return new;
end $$;
create trigger native_video_attempt_guard before insert or update on public.digital_textbook_attempts
for each row execute function runtime_publish_private.guard_native_video_attempt();

create function public.record_native_video_attempt_v1(p_actor uuid,p_tenant uuid,p_session uuid,p_lease uuid,p_expected jsonb,p_request jsonb,p_option integer,p_is_correct boolean,p_score numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb; binding jsonb; response jsonb; prior public.digital_textbook_attempts%rowtype; atomic_result jsonb; state text; v_activity_id uuid; v_node_id uuid; v_version_id uuid; answer_index integer; copies integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'NATIVE_WRITE_ISOLATION'; end if;
 perform 1 from runtime_publish_private.sessions where id=p_session for share;
 b:=runtime_publish_private.native_video_session_guard(p_actor,p_tenant,p_session,p_lease,p_expected);binding:=b#>'{privatePayload,bindings,0}';
 v_activity_id:=(binding->>'activityId')::uuid;v_node_id:=(binding->>'executionNodeId')::uuid;v_version_id:=(b#>>'{scope,versionId}')::uuid;
 if jsonb_typeof(p_request) is distinct from 'object' or p_request is distinct from jsonb_build_object('requestId',p_request->'requestId','generation',p_request->'generation')
  or jsonb_typeof(p_request->'requestId') is distinct from 'string' or (p_request->>'requestId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or jsonb_typeof(p_request->'generation') is distinct from 'number' or (p_request->>'generation') !~ '^(0|[1-9][0-9]*)$'
  or (p_request->>'generation')::numeric>9007199254740991 then raise exception 'NATIVE_REQUEST_INVALID'; end if;
 if p_option is null or p_option<0 or p_option>=jsonb_array_length(b#>'{privatePayload,source,activities,0,options}')
  or b#>>'{privatePayload,dependencies,digital_textbook_activity_secrets,0,answer_key,kind}' is distinct from 'index' then raise exception 'NATIVE_OPTION_INVALID'; end if;
 answer_index:=(b#>>'{privatePayload,dependencies,digital_textbook_activity_secrets,0,answer_key,value}')::integer;
 if p_is_correct is distinct from (p_option=answer_index) or p_score is distinct from (case when p_option=answer_index then 100 else 0 end) then raise exception 'NATIVE_GRADE_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_actor::text||':'||v_activity_id::text,0));
 -- Separate READ COMMITTED statements after this lock see a concurrent winner.
 b:=runtime_publish_private.native_video_session_guard(p_actor,p_tenant,p_session,p_lease,p_expected);
 response:=jsonb_build_object('contract','native-video-choice-response/1','requestId',p_request->'requestId','sessionRef','learning-session-'||p_session::text,
  'snapshotId',b->'snapshotId','activityRevision',binding->'activityRevision','mediaRevision',binding->'mediaRevision','cueId','pause-1','optionIndex',p_option,'generation',p_request->'generation');
 select count(*) into copies from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor and a.activity_id=v_activity_id and a.version_id=v_version_id and a.response->>'requestId'=p_request->>'requestId';
 if copies>1 then raise exception 'NATIVE_REQUEST_CONFLICT'; end if;
 select a.* into prior from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor and a.activity_id=v_activity_id and a.version_id=v_version_id and a.response->>'requestId'=p_request->>'requestId';
 if prior.id is not null then
  if prior.response-'generation' is distinct from response-'generation' then raise exception 'NATIVE_REQUEST_CONFLICT'; end if;state:='REPLAYED';
 else
  select a.* into prior from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor and a.activity_id=v_activity_id and a.version_id=v_version_id and a.is_correct order by a.attempt_number limit 1;
  if prior.id is not null then state:='ALREADY_COMPLETED';
  else
   perform set_config('uply.native_video_lease',p_lease::text,true);perform set_config('uply.native_video_session',p_session::text,true);
   select to_jsonb(r) into atomic_result from public.record_smart_textbook_attempt(p_tenant,p_actor,v_activity_id,v_version_id,response,p_is_correct,p_score) r;
   perform set_config('uply.native_video_lease','',true);perform set_config('uply.native_video_session','',true);
   select a.* into prior from public.digital_textbook_attempts a where a.tenant_id=p_tenant and a.student_id=p_actor and a.activity_id=v_activity_id and a.version_id=v_version_id and a.response->>'requestId'=p_request->>'requestId';
   if prior.id is null then raise exception 'NATIVE_ATOMIC_RESULT'; end if;state:='RECORDED';
  end if;
 end if;
 if atomic_result is null then
  select jsonb_build_object('attempt_number',prior.attempt_number,'node_completed',p.status='completed','completion_percent',p.completion_percent,'mastery_score',p.mastery_score,'node_attempt_count',p.attempt_count)
   into atomic_result from public.digital_textbook_node_progress p where p.tenant_id=p_tenant and p.student_id=p_actor and p.node_id=v_node_id and p.version_id=v_version_id;
 end if;
 if atomic_result is null then raise exception 'NATIVE_PROGRESS_MISSING'; end if;
 return jsonb_build_object('status',state,'activityId',v_activity_id,'nodeId',v_node_id,'versionId',v_version_id,'response',prior.response,'isCorrect',prior.is_correct,'score',prior.score,'atomicResult',atomic_result);
end $$;
revoke all on function runtime_publish_private.native_video_session_guard(uuid,uuid,uuid,uuid,jsonb),runtime_publish_private.guard_native_video_attempt() from public,anon,authenticated,service_role;
revoke all on function public.read_native_video_session_v1(uuid,uuid,uuid,uuid,jsonb),public.record_native_video_attempt_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,integer,boolean,numeric) from public,anon,authenticated;
grant execute on function public.read_native_video_session_v1(uuid,uuid,uuid,uuid,jsonb),public.record_native_video_attempt_v1(uuid,uuid,uuid,uuid,jsonb,jsonb,integer,boolean,numeric) to service_role;
commit;
