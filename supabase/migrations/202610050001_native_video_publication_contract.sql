-- Task17 Packet A. Forward-only; no source creation, content or pointer updates.
begin;
do $guard$ begin
 if (select prosrc from pg_proc where oid=to_regprocedure('runtime_publish_private.publication_version_admitted(jsonb)')) is distinct from $expected$
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
$expected$ then raise exception 'PUBLICATION_SCHEMA_DRIFT'; end if;
 if (select prosrc from pg_proc where oid=to_regprocedure('public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text)')) is distinct from $expected$
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
$expected$ then raise exception 'PUBLICATION_SCHEMA_DRIFT'; end if;
 if not exists(select 1 from pg_constraint where conrelid='runtime_publish_private.snapshots'::regclass and conname='snapshot_version_kind' and contype='c' and md5(pg_get_constraintdef(oid))='fb19569b7ff59dffb829c717b5e0b3c6') then raise exception 'PUBLICATION_SCHEMA_DRIFT';end if;
end $guard$;
create or replace function runtime_publish_private.publication_version_admitted(b jsonb) returns boolean
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
 when 'publish-foundation/3' then
  b->>'publicationKind'='canonical-native-video' and b->>'compilerVersion'='native-video-publication-1'
  and b#>>'{manifest,snapshot,compilerVersion}'=b->>'compilerVersion'
  and b#>>'{privatePayload,contract}'='canonical-native-video-publication/1'
  and b->>'schemaVersion'='1.0.0' and b->>'runtimeContract'='uply-runtime/1'
  and b#>'{manifest,compatibility}'='{"profile":"native","adapterRevision":null}'::jsonb
  and b#>>'{manifest,execution,contract}'='native-execution/2'
 else false end,false);
$$;
alter table runtime_publish_private.snapshots drop constraint snapshot_version_kind;
alter table runtime_publish_private.snapshots add constraint snapshot_version_kind check (
 coalesce(document->>'snapshotId'=id and (
 (document->>'revision'='publish-foundation/1' and not document ? 'publicationKind') or
 (document->>'revision'='publish-foundation/2' and document->>'publicationKind'='canonical-native'
  and document->>'compilerVersion'='native-publication-1'
  and document#>>'{manifest,snapshot,compilerVersion}'='native-publication-1') or
 (document->>'revision'='publish-foundation/3' and document->>'publicationKind'='canonical-native-video'
  and document->>'compilerVersion'='native-video-publication-1'
  and document#>>'{manifest,snapshot,compilerVersion}'='native-video-publication-1'
  and document->>'schemaVersion'='1.0.0' and document->>'runtimeContract'='uply-runtime/1'
  and document#>'{manifest,compatibility}'='{"profile":"native","adapterRevision":null}'::jsonb
  and document#>>'{manifest,execution,contract}'='native-execution/2')),false));

-- Independent SQL projection: never trusts a self-consistent client seal.
create function runtime_publish_private.native_video_admission(b jsonb,c jsonb) returns void
language plpgsql set search_path='' as $$
declare
 book jsonb; ver jsonb; ch jsonb; mo jsonb; n jsonb; a jsonb; l jsonb; sv jsonb; t jsonb; pr jsonb; secret jsonb;
 source jsonb; proof jsonb; link jsonb; expected_link jsonb; expected_source jsonb; projected jsonb;
 approval_year integer; approval_month integer; approval_day integer; approval_days integer;
 text_value text;
 m jsonb; e jsonb; sn jsonb; cue jsonb; expected_cue jsonb; expected jsonb; options jsonb;
 k text; item jsonb; pair record; fields text[]; subject text;
 vid text; choice text; vt text; ct text; ar text; mr text;
 uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
begin
 if b->>'revision' is distinct from 'publish-foundation/3' or not runtime_publish_private.publication_version_admitted(b) then raise exception 'NATIVE_VIDEO_CONTRACT';end if;
 if (b-'revision'-'publicationKind'-'snapshotId'-'scope'-'schemaVersion'-'runtimeContract'-'manifestDigest'-'sourceRevision'-'compilerVersion'-'manifest'-'privatePayload'-'privateDigest'-'pins'-'seal') is distinct from '{}'::jsonb
  or not coalesce(b->>'manifestDigest' ~ '^sha256:[a-f0-9]{64}$',false)
  or not coalesce(b->>'sourceRevision' ~ '^[a-f0-9]{64}$',false)
  or not coalesce(b->>'privateDigest' ~ '^[a-f0-9]{64}$',false)
  or not coalesce(b->>'seal' ~ '^[a-f0-9]{64}$',false)
  or not coalesce(b#>>'{pins,captureDigest}' ~ '^[a-f0-9]{64}$',false)
  or b->'pins' is distinct from jsonb_build_object('captureDigest',b#>'{pins,captureDigest}','sourceRevision',b->'sourceRevision')
  then raise exception 'NATIVE_VIDEO_ENVELOPE';end if;
 foreach k in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','learning_agent_lessons','learning_agent_profiles','learning_agent_script_versions','learning_agent_script_nodes'] loop
  if jsonb_typeof(c->k) is distinct from 'array' or jsonb_array_length(c->k) is distinct from 1 then raise exception 'NATIVE_VIDEO_CARDINALITY';end if;
 end loop;
 foreach k in array array['digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_script_audio_assets','learning_agent_node_interaction_secrets','chapter_tests'] loop
  if c->k is distinct from '[]'::jsonb then raise exception 'NATIVE_VIDEO_UNSUPPORTED_MEDIA';end if;
 end loop;
 book:=c#>'{digital_textbooks,0}';ver:=c#>'{digital_textbook_versions,0}';ch:=c#>'{digital_textbook_chapters,0}';mo:=c#>'{digital_textbook_modules,0}';n:=c#>'{digital_textbook_nodes,0}';a:=c#>'{digital_textbook_activities,0}';l:=c#>'{learning_agent_lessons,0}';sv:=c#>'{learning_agent_script_versions,0}';t:=c#>'{learning_agent_script_nodes,0}';pr:=c#>'{learning_agent_profiles,0}';secret:=c#>'{digital_textbook_activity_secrets,0}';
 foreach item in array array[book,ver,ch,l,sv,pr] loop
  if item->>'status' is distinct from 'published' then raise exception 'NATIVE_VIDEO_PUBLISHED_SCOPE';end if;
 end loop;
 foreach item in array array[book,ver,ch,mo,n,a,l,sv,t,pr] loop
  if not coalesce(item->>'id' ~ uuid_pattern,false) then raise exception 'NATIVE_VIDEO_ID';end if;
 end loop;
 if b->'scope' is distinct from jsonb_build_object('textbookId',book->'id','versionId',ver->'id','chapterId',ch->'id')
  or ver->'textbook_id' is distinct from book->'id' or ch->'version_id' is distinct from ver->'id' or mo->'chapter_id' is distinct from ch->'id'
  or n->'module_id' is distinct from mo->'id' or a->'node_id' is distinct from n->'id' or l->'module_id' is distinct from mo->'id'
  or sv->'lesson_id' is distinct from l->'id' or t->'script_version_id' is distinct from sv->'id' or t->'reference_activity_id' is distinct from a->'id'
  or l->'agent_profile_id' is distinct from pr->'id' or book->'agent_profile_id' is distinct from pr->'id' or secret->'activity_id' is distinct from a->'id'
  or ch->>'chapter_test_id' is not null or n->'content' is distinct from '{}'::jsonb then raise exception 'NATIVE_VIDEO_ASSOCIATION';end if;
 if not coalesce(book->>'lesson_id' ~ uuid_pattern,false) or not coalesce(book->>'student_app_id' ~ uuid_pattern,false)
  or not coalesce(book->>'slug' ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$',false)
  or not coalesce(ch->>'slug' ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$',false)
  or jsonb_typeof(ch->'chapter_number') is distinct from 'number' or not coalesce(ch->>'chapter_number' ~ '^[0-9]+$',false)
  or not coalesce(n->>'node_type' in ('learn','practice','mission','review'),false)
  or not coalesce(t->>'node_type' in ('opening','explanation','example','question','instruction','summary'),false)
  or jsonb_typeof(t->'is_required') is distinct from 'boolean'
  or jsonb_typeof(t->'node_key') is distinct from 'string' or length(t->>'node_key')=0
  or jsonb_typeof(a->'activity_key') is distinct from 'string' or length(a->>'activity_key')=0
  then raise exception 'NATIVE_VIDEO_ROW_SHAPE';end if;
 foreach item in array array[book->'title',ch->'title',ch->'scenario',ch->'goal',t->'title',t->'teacher_script',a->'prompt',a->'instruction'] loop
  if jsonb_typeof(item) is distinct from 'object' then raise exception 'NATIVE_VIDEO_LOCALIZATION';end if;
 end loop;
 foreach item in array array[book->'title',ch->'title',t->'title',a->'prompt'] loop
  if not item ? 'zh-CN' then raise exception 'NATIVE_VIDEO_DEFAULT_LOCALE';end if;
 end loop;
 foreach item in array array[book,l,pr] loop
  if item->>'subject' is not null then
   if jsonb_typeof(item->'subject')<>'string' or (subject is not null and subject<>item->>'subject') then raise exception 'NATIVE_VIDEO_SUBJECT';end if;
   subject:=item->>'subject';
  end if;
 end loop;
 for item in select value from jsonb_array_elements(c->'learning_agent_profile_secrets') loop
  if item->'agent_profile_id' is distinct from pr->'id' then raise exception 'NATIVE_VIDEO_PROFILE_SECRET';end if;
 end loop;
 foreach item in array array[ver,sv] loop
  if jsonb_typeof(item->'version_number') is distinct from 'number' or not coalesce(item->>'version_number' ~ '^[1-9][0-9]*$',false) then raise exception 'NATIVE_VIDEO_SEQUENCE';end if;
 end loop;
 foreach item in array array[mo,n,t] loop
  if jsonb_typeof(item->'sort_order') is distinct from 'number' or not coalesce(item->>'sort_order' ~ '^[1-9][0-9]*$',false) then raise exception 'NATIVE_VIDEO_SEQUENCE';end if;
 end loop;
 if t->>'action_type' is distinct from 'focus_activity' or t->>'next_node_key' is not null or t->>'remediation_node_key' is not null
  or (t ? 'video_mode' and t->'video_mode' is distinct from '"legacy"'::jsonb)
  or (t ? 'segments' and t->'segments' is distinct from '[]'::jsonb)
  or jsonb_typeof(t->'configuration') is distinct from 'object' or (t->'configuration')-'videoPilotPublication' is distinct from '{}'::jsonb
  then raise exception 'NATIVE_VIDEO_SOURCE';end if;
 foreach k in array array['video_asset_id','video_url','audio_asset_id','audio_url','cue_points','cues','interaction','interaction_config','required_video','required_audio','required_speech','required_listening','required_cue'] loop
  if t ? k and t->k not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb) then raise exception 'NATIVE_VIDEO_UNSUPPORTED_MEDIA';end if;
 end loop;
 source:=t#>'{configuration,videoPilotPublication}';proof:=source->'media';
 if source is null or source is distinct from jsonb_build_object('contract','video-pilot-publication-source/1','mode','video','state','promoted','origin',source->'origin','approvedBy',source->'approvedBy','approvedAt',source->'approvedAt','media',proof,'cue',source->'cue','captions',null)
  or source->'origin' is distinct from jsonb_build_object('teachingNodeId',source#>'{origin,teachingNodeId}','scriptVersionId',source#>'{origin,scriptVersionId}','draftDigest',source#>'{origin,draftDigest}')
  or not coalesce(source#>>'{origin,teachingNodeId}' ~ uuid_pattern,false) or not coalesce(source#>>'{origin,scriptVersionId}' ~ uuid_pattern,false)
  or not coalesce(source#>>'{origin,draftDigest}' ~ '^[a-f0-9]{64}$',false) or not coalesce(source->>'approvedBy' ~ uuid_pattern,false)
  or jsonb_typeof(source->'approvedAt') is distinct from 'string'
  or length(source->>'approvedAt') is distinct from 24
  or not coalesce(source->>'approvedAt' ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$',false)
  then raise exception 'NATIVE_VIDEO_PROMOTION';end if;
 -- Shape/type/length have passed before any integer extraction. Never normalize captured metadata.
 approval_year:=substring(source->>'approvedAt' from 1 for 4)::integer;
 approval_month:=substring(source->>'approvedAt' from 6 for 2)::integer;
 approval_day:=substring(source->>'approvedAt' from 9 for 2)::integer;
 approval_days:=(array[31,28,31,30,31,30,31,31,30,31,30,31])[approval_month];
 if approval_month=2 and approval_year%4=0 and (approval_year%100<>0 or approval_year%400=0) then approval_days:=29;end if;
 if approval_year=0 or approval_day>approval_days then raise exception 'NATIVE_VIDEO_PROMOTION';end if;
 if proof is distinct from '{"adapter":"fixed-selected-host/1","assetId":"course-video-sample01","sha256":"68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe","sizeBytes":5487747,"mime":"video/mp4","videoDurationSeconds":30,"containerDurationSeconds":30.016,"revision":"media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe"}'::jsonb then raise exception 'NATIVE_VIDEO_FIXED_PROOF';end if;
 if source->'cue' is distinct from jsonb_build_object('id','pause-1','atSeconds',source#>'{cue,atSeconds}','activityId',a->'id')
  or jsonb_typeof(source#>'{cue,atSeconds}') is distinct from 'number'
  or not coalesce((source#>>'{cue,atSeconds}')::numeric>=0 and (source#>>'{cue,atSeconds}')::numeric<30,false) then raise exception 'NATIVE_VIDEO_CUE';end if;
 if a->>'activity_type' is distinct from 'single_choice' or jsonb_typeof(a->'options') is distinct from 'array'
  or jsonb_array_length(a->'options') not between 2 and 100 or a->'counts_toward_completion' is distinct from 'true'::jsonb
  or jsonb_typeof(a->'max_attempts') is distinct from 'number' or not coalesce(a->>'max_attempts' ~ '^[0-9]+$',false)
  or (a->>'max_attempts')::numeric not between 1 and 20 or jsonb_typeof(a->'public_config') is distinct from 'object'
  or (a->'public_config')-'shuffle'-'showScore' is distinct from '{}'::jsonb
  or (a->'public_config' ? 'shuffle' and jsonb_typeof(a#>'{public_config,shuffle}') is distinct from 'boolean')
  or (a->'public_config' ? 'showScore' and jsonb_typeof(a#>'{public_config,showScore}') is distinct from 'boolean')
  or secret->'answer_key' is distinct from jsonb_build_object('kind','index','value',secret#>'{answer_key,value}')
  or jsonb_typeof(secret#>'{answer_key,value}') is distinct from 'number' or not coalesce(secret#>>'{answer_key,value}' ~ '^[0-9]+$',false)
  or not coalesce((secret#>>'{answer_key,value}')::numeric between 0 and jsonb_array_length(a->'options')-1,false)
  then raise exception 'NATIVE_VIDEO_ACTIVITY';end if;
 -- All localized authored text is inert, with the same bounded supported locale keys.
 for item in select value from jsonb_array_elements(jsonb_build_array(book->'title',ch->'title',ch->'scenario',ch->'goal',t->'title',t->'teacher_script',a->'prompt',a->'instruction') || a->'options') loop
  if jsonb_typeof(item)='string' then
   if length(item#>>'{}') not between 1 and 20000 then raise exception 'NATIVE_VIDEO_TEXT';end if;
   item:=jsonb_build_object('zh-CN',item);
  elsif jsonb_typeof(item)='object' and item<>'{}'::jsonb and item-'zh-CN'-'ko-KR'='{}'::jsonb then
   for pair in select * from jsonb_each(item) loop
    if jsonb_typeof(pair.value) is distinct from 'string' or length(pair.value#>>'{}') not between 1 and 20000 then raise exception 'NATIVE_VIDEO_TEXT';end if;
   end loop;
  else raise exception 'NATIVE_VIDEO_TEXT';end if;
  for text_value in select value#>>'{}' from jsonb_each(item) loop
   if text_value ~* '(<\/?[a-z!]|javascript\s*:|data\s*:|=>|[{}]|@import|expression\s*\(|\mfunction\s*\(|\m(eval|Function)\s*\()' then raise exception 'NATIVE_VIDEO_EXECUTABLE_TEXT';end if;
  end loop;
 end loop;
 vid:='video-'||(t->>'id');choice:='choice-'||(a->>'id');vt:='step:'||(t->>'id')||'/block:'||vid;ct:='step:'||(t->>'id')||'/block:'||choice;
 m:=b->'manifest';e:=m->'execution';sn:=e#>'{sourceNodes,0}';link:=b#>'{privatePayload,bindings,0}';ar:=link->>'activityRevision';mr:=proof->>'revision';
 if not coalesce(ar ~ '^activity-[a-f0-9]{64}$',false) then raise exception 'NATIVE_VIDEO_REVISION';end if;
 expected_link:=jsonb_build_object('activityId',a->'id','activityAlias',a->'activity_key','executionNodeId',n->'id','sourceTeachingNodeId',t->'id','moduleId',mo->'id','teachingLessonId',l->'id','scriptVersionId',sv->'id','scriptVersion',sv->'version_number','countsTowardCompletion',true,'activityRevision',ar,'mediaRef',vid,'mediaRevision',mr,'cueId','pause-1');
 if b#>'{privatePayload,bindings}' is distinct from jsonb_build_array(expected_link) then raise exception 'NATIVE_VIDEO_BINDING';end if;
 expected_source:='{}'::jsonb;
 -- Match the compiler's private typed projection, including optional absent keys.
 for k, item, fields in select * from (values
 ('book',book,array['id','lesson_id','student_app_id','agent_profile_id','slug','title','status']),
 ('version',ver,array['id','textbook_id','version_number','status']),
 ('chapter',ch,array['id','version_id','slug','chapter_number','title','scenario','goal','status','chapter_test_id']),
 ('modules',mo,array['id','chapter_id','sort_order']),('nodes',n,array['id','module_id','sort_order','node_type','content']),
 ('activities',a,array['id','node_id','activity_key','activity_type','prompt','instruction','options','public_config','max_attempts','counts_toward_completion']),
 ('lessons',l,array['id','module_id','agent_profile_id','status']),('scripts',sv,array['id','lesson_id','version_number','status']),
 ('teachingNodes',t,array['id','script_version_id','sort_order','title','teacher_script','node_key','node_type','is_required','configuration','reference_activity_id','action_type','next_node_key','remediation_node_key','video_mode','segments'])
 ) as projection(name,row,keys) loop
  select jsonb_object_agg(key,value) into projected from jsonb_each(item) where key=any(fields);
  expected_source:=expected_source||jsonb_build_object(k,case when k in ('book','version','chapter') then projected else jsonb_build_array(projected) end);
 end loop;
 if b#>'{privatePayload,source}' is distinct from expected_source
  or (b->'privatePayload')-'contract'-'source'-'bindings'-'dependencies'-'result' is distinct from '{}'::jsonb
  or b#>'{privatePayload,result}' is distinct from jsonb_build_object('manifest',m,'report',jsonb_build_object('sourceRevision',b->'sourceRevision')) then raise exception 'NATIVE_VIDEO_PRIVATE_SOURCE';end if;
 expected_cue:=jsonb_build_object('id','pause-1','stepId',t->'id','sourceBlockId',vid,'mediaRevision',mr,'triggerType','time','triggerTime',source#>'{cue,atSeconds}','action','show_activity','targetBlockId',choice,'pauseSource',true,'mandatory',true,'resumePolicy','after_authoritative_activity_completion','sortOrder',1);
 if not coalesce(e->>'lessonBinding' ~ '^[a-f0-9]{64}$',false) or not coalesce(e->>'scriptVersionBinding' ~ '^[a-f0-9]{64}$',false)
  or not coalesce(sn->>'binding' ~ '^[a-f0-9]{64}$',false) or not coalesce(sn->>'rowHash' ~ '^[a-f0-9]{64}$',false) then raise exception 'NATIVE_VIDEO_EXECUTION_HASH';end if;
 select jsonb_agg(jsonb_build_object('id','option-'||(ordinality-1),'text',case when jsonb_typeof(value)='string' then jsonb_build_object('zh-CN',value,'ko-KR',value) else value end) order by ordinality) into options from jsonb_array_elements(a->'options') with ordinality;
 expected:=jsonb_build_object(
  'schemaVersion','1.0.0','runtimeContract','uply-runtime/1',
  'requiredCapabilities','["layout.v1","navigation.linear.v1","progress.server.v1","block.video","block.multiple_choice","timeline.cue.v1"]'::jsonb,
  'textbook',jsonb_build_object('id',book->'id','slug',book->'slug','title',book->'title','appId',book->'student_app_id'),
  'version',jsonb_build_object('id',ver->'id','number',ver->'version_number'),
  'chapter',jsonb_build_object('id',ch->'id','key',ch->'slug','number',ch->'chapter_number','title',ch->'title','scenario',ch->'scenario','goal',ch->'goal'),
  'localization','{"defaultLocale":"zh-CN","locales":["zh-CN","ko-KR"]}'::jsonb,
  'template','{"id":"native-classroom","key":"native-classroom","revision":"native-video-publication-1"}'::jsonb,
  'layout','{"preset":"split-classroom","desktopRatio":"40-60","splitBreakpoint":"xl","narrowOrder":["teaching","interaction"],"teachingCollapsible":true,"focusPolicy":"manual","supportPresentation":"inline","navigationPlacement":"bottom","density":"comfortable"}'::jsonb,
  'regions','[{"id":"teaching","role":"teaching","parent":null,"content":"blocks","allowedBlockTypes":["video"]},{"id":"interaction","role":"interaction","parent":null,"content":"regions","allowedBlockTypes":[]},{"id":"interaction.main","role":"main","parent":"interaction","content":"blocks","allowedBlockTypes":["multiple_choice"]},{"id":"navigation","role":"navigation","parent":null,"content":"runtime-navigation","allowedBlockTypes":[]}]'::jsonb,
  'steps',jsonb_build_array(jsonb_build_object('id',t->'id','key',t->'id','title',t->'title','order',1,'regions',jsonb_build_array(jsonb_build_object('region','teaching','blockIds',jsonb_build_array(vid)),jsonb_build_object('region','interaction.main','blockIds',jsonb_build_array(choice))),'completion',jsonb_build_object('kind','server','policyRef','node-'||(n->>'id')),'nextStep',null,'teachingRef',null)),
  'blocks',jsonb_build_array(
   jsonb_build_object('id',vid,'stepId',t->'id','region','teaching','order',1,'type','video','props',jsonb_build_object('mediaRef',vid,'role','content','fallback','retry','startPaused',true),'completion',jsonb_build_object('kind','none'),'runtimeTarget',vt),
   jsonb_build_object('id',choice,'stepId',t->'id','region','interaction.main','order',1,'type','multiple_choice','props',jsonb_build_object('activityRef',a->'id','presentation','single'),'completion',jsonb_build_object('kind','server','policyRef','activity-'||(a->>'id')),'runtimeTarget',ct)),
  'navigation',jsonb_build_object('region','navigation','entryStep',t->'id','items',jsonb_build_array(t->'id'),'mode','linear','access','free','previous','allowed','autoAdvance',false,'resume','stable-id'),
  'completion',jsonb_build_object('authority','server','chapterPolicyRef','chapter-'||(ch->>'id')),
  'runtimeTargets',jsonb_build_array(jsonb_build_object('id',vt,'stepId',t->'id','blockId',vid,'partId',null,'capabilities','["play","focus"]'::jsonb,'acceptedEvents','["media-ended"]'::jsonb,'verification','playback-observation'),jsonb_build_object('id',ct,'stepId',t->'id','blockId',choice,'partId',null,'capabilities','["reveal","focus"]'::jsonb,'acceptedEvents','["response-submitted"]'::jsonb,'verification','server-attempt')),
  'mediaRefs',jsonb_build_array(jsonb_build_object('id',vid,'kind','video','revision',mr,'readiness','ready','access','lesson','language',null,'alt',t->'title')),
  'activityRefs',jsonb_build_array(jsonb_build_object('id',a->'id','activityId',a->'id','revision',ar,'type','single_choice','publicPresentation',jsonb_build_object('prompt',a->'prompt','instruction',a->'instruction','options',options,'settings',jsonb_build_object('shuffle',coalesce(a#>'{public_config,shuffle}','false'::jsonb),'showScore',coalesce(a#>'{public_config,showScore}','false'::jsonb))))),
  'progressRefs',jsonb_build_array(jsonb_build_object('id','chapter-'||(ch->>'id'),'kind','chapter'),jsonb_build_object('id','node-'||(n->>'id'),'kind','node'),jsonb_build_object('id','activity-'||(a->>'id'),'kind','activity')),
  'teachingRefs','[]'::jsonb,'compatibility','{"profile":"native","adapterRevision":null}'::jsonb,
  'execution',jsonb_build_object('contract','native-execution/2','targetAlias','native-video-'||(ch->>'id'),'lessonBinding',e->'lessonBinding','scriptVersionBinding',e->'scriptVersionBinding','scriptVersion',sv->'version_number','sourceNodes',jsonb_build_array(jsonb_build_object('nodeNumber',t->'sort_order','binding',sn->'binding','rowHash',sn->'rowHash','blockIds',jsonb_build_array(vid,choice))),'media',jsonb_build_array(jsonb_build_object('blockId',vid,'revision',mr,'durationSeconds',30)),'cues',jsonb_build_array(expected_cue),'initialLayout','split')
 );
 if m-'snapshot' is distinct from expected then raise exception 'NATIVE_VIDEO_MANIFEST_PROJECTION';end if;
 if m->'snapshot' is distinct from jsonb_build_object('id',b->'snapshotId','contentDigest',b->'manifestDigest','compiledAt',m#>'{snapshot,compiledAt}','compilerVersion','native-video-publication-1','scope','chapter')
  or not coalesce(substring(b->>'snapshotId' from 23) ~ uuid_pattern,false) or left(b->>'snapshotId',22)<>'snapshot-native-video-'
  or jsonb_typeof(m#>'{snapshot,compiledAt}') is distinct from 'string'
  or not coalesce(m#>>'{snapshot,compiledAt}' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$',false)
  then raise exception 'NATIVE_VIDEO_SNAPSHOT';end if;
 perform (m#>>'{snapshot,compiledAt}')::timestamptz;
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
    elsif p_bundle->>'revision'='publish-foundation/3' then
      perform runtime_publish_private.native_video_admission(p_bundle,captured);
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
revoke all on function runtime_publish_private.publication_version_admitted(jsonb) from public,anon,authenticated,service_role;
revoke all on function runtime_publish_private.native_video_admission(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text) to service_role;
commit;
