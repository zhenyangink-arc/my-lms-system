-- R7D-C34b. Forward-only native publication admission. Isolated validation only.
-- No rows, new stores, pointer/CAS rewrite, or Agent completion DDL.
begin;
create function runtime_publish_private.publication_version_admitted(b jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(case b->>'revision'
 when 'publish-foundation/1' then not b ? 'publicationKind'
 when 'publish-foundation/2' then
  b->>'publicationKind'='canonical-native' and b->>'compilerVersion'='native-publication-1'
  and b#>>'{manifest,snapshot,compilerVersion}'=b->>'compilerVersion'
  and b#>>'{privatePayload,contract}'='canonical-native-publication/1'
  and b->>'schemaVersion'='1.0.0' and b->>'runtimeContract'='uply-runtime/1'
  and b#>>'{manifest,compatibility,profile}'='native'
  and b#>'{manifest,compatibility,adapterRevision}'='null'::jsonb
  and not (b->'manifest') ? 'execution'
 else false end,false);
$$;
-- Keep the historical v1 CHECK semantics and add a disjoint native tuple.
-- Detect the exact historical constraint; an unexpected schema fails closed.
do $$declare names text[];begin
 select array_agg(conname) into names from pg_constraint
 where conrelid='runtime_publish_private.snapshots'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%publish-foundation/1%' and pg_get_constraintdef(oid) like '%snapshotId%';
 if array_length(names,1) is distinct from 1 then raise exception 'PUBLICATION_SCHEMA_DRIFT';end if;
 execute format('alter table runtime_publish_private.snapshots drop constraint %I',names[1]);
end $$;
alter table runtime_publish_private.snapshots add constraint snapshot_version_kind check (
 coalesce(document->>'snapshotId'=id and (
 (document->>'revision'='publish-foundation/1' and not document ? 'publicationKind') or
 (document->>'revision'='publish-foundation/2' and document->>'publicationKind'='canonical-native'
  and document->>'compilerVersion'='native-publication-1'
  and document#>>'{manifest,snapshot,compilerVersion}'='native-publication-1')),false));

-- SQL admission supplements the official server certifier; it never reinterprets
-- historical digests or derives a public identifier from private grading data.
create function runtime_publish_private.native_admission(b jsonb,c jsonb) returns void
language plpgsql set search_path='' as $$
declare a jsonb; n jsonb; t jsonb; s jsonb; l jsonb; secret jsonb; link jsonb; k text;
begin
 if not runtime_publish_private.publication_version_admitted(b)
 or jsonb_typeof(b#>'{privatePayload,bindings}') is distinct from 'array'
 or jsonb_array_length(b#>'{privatePayload,bindings}') is distinct from jsonb_array_length(c->'digital_textbook_activities')
 or c#>>'{digital_textbook_chapters,0,chapter_test_id}' is not null
 or b#>'{manifest,mediaRefs}' is distinct from '[]'::jsonb
 then raise exception 'NATIVE_PUBLICATION_CONTRACT';end if;
 foreach k in array array['digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_script_audio_assets','learning_agent_node_interaction_secrets','chapter_tests'] loop
  if c->k is distinct from '[]'::jsonb then raise exception 'NATIVE_PUBLICATION_UNSUPPORTED_MEDIA';end if;
 end loop;
 foreach k in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters'] loop
  if jsonb_array_length(c->k) is distinct from 1 or c#>>array[k,'0','status'] is distinct from 'published' then raise exception 'NATIVE_PUBLICATION_PUBLISHED_SCOPE';end if;
 end loop;
 for t in select value from jsonb_array_elements(c->'learning_agent_script_nodes') loop
  if t->'configuration' is distinct from '{}'::jsonb
   or coalesce(t->>'action_type','') not in ('none','focus_activity')
   or coalesce(t->>'video_mode','legacy')<>'legacy'
   or coalesce(t->'segments','[]'::jsonb)<>'[]'::jsonb
   or t->>'remediation_node_key' is not null then raise exception 'NATIVE_PUBLICATION_UNSUPPORTED_MEDIA';end if;
  foreach k in array array['video_asset_id','video_url','audio_asset_id','audio_url','cue_points','cues','interaction','interaction_config','required_video','required_audio','required_speech','required_listening','required_cue'] loop
   if t ? k and t->k not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb) then raise exception 'NATIVE_PUBLICATION_UNSUPPORTED_MEDIA';end if;
  end loop;
 end loop;
 for n in select value from jsonb_array_elements(c->'digital_textbook_nodes') loop
  if (select count(*) from jsonb_array_elements(c->'digital_textbook_activities') x where x->>'node_id'=n->>'id' and x->'counts_toward_completion'='true'::jsonb)>1 then raise exception 'NATIVE_PUBLICATION_NODE_AGGREGATION';end if;
 end loop;
 for a in select value from jsonb_array_elements(c->'digital_textbook_activities') loop
  if a->>'activity_type' is distinct from 'single_choice' or jsonb_typeof(a->'options') is distinct from 'array' then raise exception 'NATIVE_PUBLICATION_ACTIVITY';end if;
  if jsonb_array_length(a->'options') not between 2 and 100
   or (a->>'max_attempts')::int not between 1 and 20
   or jsonb_typeof(a->'counts_toward_completion') is distinct from 'boolean'
   or ((a->'public_config')-'shuffle'-'showScore') is distinct from '{}'::jsonb
   then raise exception 'NATIVE_PUBLICATION_ACTIVITY';end if;
  if (select count(*) from jsonb_array_elements(c->'learning_agent_script_nodes') x where x->>'reference_activity_id'=a->>'id')<>1
   or (select count(*) from jsonb_array_elements(b#>'{privatePayload,bindings}') x where x->>'activityId'=a->>'id')<>1
   or (select count(*) from jsonb_array_elements(c->'digital_textbook_activity_secrets') x where x->>'activity_id'=a->>'id')<>1
   then raise exception 'NATIVE_PUBLICATION_ASSOCIATION';end if;
  select value into t from jsonb_array_elements(c->'learning_agent_script_nodes') where value->>'reference_activity_id'=a->>'id';
  select value into n from jsonb_array_elements(c->'digital_textbook_nodes') where value->>'id'=a->>'node_id';
  select value into s from jsonb_array_elements(c->'learning_agent_script_versions') where value->>'id'=t->>'script_version_id';
  select value into l from jsonb_array_elements(c->'learning_agent_lessons') where value->>'id'=s->>'lesson_id';
  select value into link from jsonb_array_elements(b#>'{privatePayload,bindings}') where value->>'activityId'=a->>'id';
  select value into secret from jsonb_array_elements(c->'digital_textbook_activity_secrets') where value->>'activity_id'=a->>'id';
  if n is null or s is null or l is null or l->>'module_id' is distinct from n->>'module_id'
   or s->>'status' is distinct from 'published' or l->>'status' is distinct from 'published'
   or link->>'executionNodeId' is distinct from n->>'id'
   or link->>'sourceTeachingNodeId' is distinct from t->>'id'
   or link->>'scriptVersionId' is distinct from s->>'id'
   or link->>'teachingLessonId' is distinct from l->>'id'
   or link->>'moduleId' is distinct from n->>'module_id'
   or link->'countsTowardCompletion' is distinct from a->'counts_toward_completion'
   or secret#>>'{answer_key,kind}' is distinct from 'index'
   or not coalesce((secret#>>'{answer_key,value}')::int between 0 and jsonb_array_length(a->'options')-1,false)
   then raise exception 'NATIVE_PUBLICATION_ASSOCIATION';end if;
 end loop;
end $$;
create or replace function public.publish_runtime_snapshot_v1(p_actor uuid,p_scope jsonb,p_expected jsonb,p_operation text,p_bundle jsonb,p_target text)
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
    if p_bundle is null or p_bundle->'scope' is distinct from p_scope or not runtime_publish_private.publication_version_admitted(p_bundle) or jsonb_typeof(p_bundle->'privatePayload') is distinct from 'object' then raise exception 'PUBLICATION_BUNDLE'; end if;
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
create or replace function public.publish_runtime_snapshot_base_v2(
  p_actor uuid,
  p_scope jsonb,
  p_expected jsonb,
  p_operation text,
  p_bundle jsonb,
  p_target text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  captured jsonb;
begin
  perform runtime_publish_private.owner_guard(p_actor);
  perform runtime_publish_private.authoring_lock();

  if p_operation = 'publish' then
    captured := runtime_publish_private.capture(p_scope);
    if p_bundle #> '{privatePayload,dependencies}' is distinct from captured then
      raise exception 'PUBLICATION_SOURCE_CAPTURE_CONFLICT' using errcode = '40001';
    end if;

    if p_bundle->>'revision'='publish-foundation/2' then
      perform runtime_publish_private.native_admission(p_bundle,captured);
    end if;
    if exists (
      select 1
      from jsonb_array_elements(captured -> 'digital_textbook_activities') as activity
      where not (
        activity ->> 'activity_key' = 'dialogue-roleplay'
        and activity ->> 'activity_type' = 'speaking'
      )
      and (
        select count(*)
        from jsonb_array_elements(captured -> 'digital_textbook_activity_secrets') as secret
        where secret ->> 'activity_id' = activity ->> 'id'
      ) <> 1
    ) then
      raise exception 'PUBLICATION_GRADER_DEPENDENCY_MISSING';
    end if;
  else
    if not exists (
      select 1
      from runtime_publish_private.dependency_fences
      where snapshot_id = p_target
    ) then
      raise exception 'PUBLICATION_UNFENCED_ROLLBACK';
    end if;
  end if;

  result := public.publish_runtime_snapshot_v1(
    p_actor, p_scope, p_expected, p_operation, p_bundle, p_target
  );
  if p_operation = 'publish' then
    insert into runtime_publish_private.dependency_fences
    values (p_bundle ->> 'snapshotId', p_scope, captured)
    on conflict (snapshot_id) do nothing;
  end if;
  return result;
end
$$;
-- No change to the outer single-version wrapper, semantic capture, PT409 authoring
-- fence, retirement/session policy, pointer CAS or request leases.
revoke all on function runtime_publish_private.publication_version_admitted(jsonb) from public,anon,authenticated,service_role;
revoke all on function runtime_publish_private.native_admission(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
commit;
