-- Task17 Packet C. Additive owner promotion; no table, policy, history or pointer edits.
begin;
-- Require the real authoring lock/fence triggers; fixtures must install them too.
do $guard$
declare t text;
begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('runtime_publish_private.authoring_lock()')) is distinct from '3f362b56abf59e4b8d20830bb4646a1c' then raise exception 'NATIVE_PROMOTION_PREREQUISITE_BODY';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('runtime_publish_private.lock_authoring_statement()')) is distinct from '2eaec57266f0add8c3822f7a00b7dd58' then raise exception 'NATIVE_PROMOTION_PREREQUISITE_BODY';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('runtime_publish_private.check_authoring_statement()')) is distinct from '2beae5de9e4090cbf3d6f7b2646c00df' then raise exception 'NATIVE_PROMOTION_PREREQUISITE_BODY';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('public.teaching_script_publish_snapshot(uuid)')) is distinct from '6efcb0ba0c0094e8cc360c120813b7d1' then raise exception 'NATIVE_PROMOTION_PREREQUISITE_BODY';end if;
 if to_regprocedure('auth.uid()') is null or to_regprocedure('private.is_platform_owner()') is null
 or to_regprocedure('runtime_publish_private.native_video_session_guard(uuid,uuid,uuid,uuid,jsonb)') is null
 or to_regprocedure('public.teaching_script_publish_snapshot(uuid)') is null
 or to_regprocedure('runtime_publish_private.native_video_admission(jsonb,jsonb)') is null
 or to_regprocedure('public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text)') is null
 or to_regclass('runtime_publish_private.dependency_fences') is null then raise exception 'NATIVE_PROMOTION_PREREQUISITE';end if;
 foreach t in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','learning_agent_lessons','learning_agent_profiles','learning_agent_script_versions','learning_agent_script_nodes','learning_agent_node_interaction_secrets'] loop
  if not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='runtime_publish_lock' and tgtype=62 and tgenabled in ('O','A') and tgfoid=to_regprocedure('runtime_publish_private.lock_authoring_statement()'))
  or not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||t) and tgname='runtime_publish_fence' and tgtype=60 and tgenabled in ('O','A') and tgfoid=to_regprocedure('runtime_publish_private.check_authoring_statement()')) then raise exception 'NATIVE_PROMOTION_PREREQUISITE: %',t;end if;
 end loop;
end $guard$;

-- Origin digest v1: SHA256(UTF8(canonical({node,activity,secret,associations}))).
-- Full saved rows (including timestamps) participate. Object keys are ASCII and
-- sorted with C collation, arrays keep order, strings retain Unicode. Numbers
-- use IEEE754 shortest decimal with JSON.stringify's fixed/exponent cutovers.
-- This helper is PRIVATE and never replaces the historical digest functions.
create function runtime_publish_private.native_promotion_canonical(v jsonb) returns text
language plpgsql immutable set search_path='' set extra_float_digits=3 as $$
declare result text; num double precision; spelling text;
begin
 case jsonb_typeof(v)
 when 'object' then
  if exists(select 1 from jsonb_object_keys(v) k where k !~ '^[ -~]+$') then raise exception 'NATIVE_PROMOTION_CANONICAL_KEY';end if;
  select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||runtime_publish_private.native_promotion_canonical(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(v);
 when 'array' then
  select '['||coalesce(string_agg(runtime_publish_private.native_promotion_canonical(value),',' order by ord),'')||']' into result from jsonb_array_elements(v) with ordinality a(value,ord);
 when 'number' then
  num:=(v#>>'{}')::double precision;
  if num=0 then return '0';end if;
  if abs(num)>=9007199254740992 then raise exception 'NATIVE_PROMOTION_CANONICAL_NUMBER';end if;
  spelling:=num::text;
  if abs(num)>=0.000001 and abs(num)<1e21 then result:=trim_scale(spelling::numeric)::text;
  else result:=regexp_replace(spelling,'e([+-])0+','e\1');end if;
 else result:=v::text;
 end case;
 if result is null then raise exception 'NATIVE_PROMOTION_CANONICAL_NULL';end if;
 return result;
end $$;

create function public.promote_native_video_source_v1(
 p_source_node uuid,p_source_version uuid,p_expected_token text,p_target jsonb,p_media jsonb,p_change_note text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); snap jsonb; t jsonb; a jsonb; secret jsonb; n jsonb; mo jsonb; ch jsonb; ver jsonb; book jsonb; lesson jsonb; script jsonb; profile jsonb;
 draft jsonb; origin jsonb; source jsonb; targets jsonb; row_value jsonb; existing jsonb; k text; item jsonb; pair record; txt text;
 fresh_ids uuid[]; target_id uuid; table_name text; next_number integer; is_retry boolean; approved text; made_at timestamptz;
 scope jsonb; digest_value text; source_existing jsonb; expected_rows jsonb:='{}'::jsonb;
begin
 if actor is null or not coalesce(private.is_platform_owner(),false) then raise exception 'NATIVE_PROMOTION_OWNER_ONLY' using errcode='42501';end if;
 perform runtime_publish_private.authoring_lock();
 if p_expected_token is null or p_expected_token !~ '^[a-f0-9]{32}$' or p_change_note is null or length(p_change_note)>500 then raise exception 'NATIVE_PROMOTION_INPUT';end if;
 if p_target is distinct from jsonb_build_object('textbookId',p_target->'textbookId','legacyVersionId',p_target->'legacyVersionId','chapterNumber',p_target->'chapterNumber','chapterSlug',p_target->'chapterSlug','reserved',p_target->'reserved')
 or p_target->'reserved' is distinct from jsonb_build_object('versionId',p_target#>'{reserved,versionId}','chapterId',p_target#>'{reserved,chapterId}','moduleId',p_target#>'{reserved,moduleId}','executionNodeId',p_target#>'{reserved,executionNodeId}','activityId',p_target#>'{reserved,activityId}','teachingLessonId',p_target#>'{reserved,teachingLessonId}','scriptVersionId',p_target#>'{reserved,scriptVersionId}','sourceTeachingNodeId',p_target#>'{reserved,sourceTeachingNodeId}')
 then raise exception 'NATIVE_PROMOTION_TARGET';end if;
 targets:=p_target->'reserved';
 for k, item in select key,value from jsonb_each(targets) loop
  if jsonb_typeof(item)<>'string' or (item#>>'{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'NATIVE_PROMOTION_TARGET';end if;
  fresh_ids:=array_append(fresh_ids,(item#>>'{}')::uuid);
 end loop;
 if (select count(distinct x) from unnest(fresh_ids) x)<>8 or p_source_node=any(fresh_ids) or p_source_version=any(fresh_ids) then raise exception 'NATIVE_PROMOTION_TARGET';end if;
 if p_media is distinct from '{"adapter":"fixed-selected-host/1","assetId":"course-video-sample01","sha256":"68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe","sizeBytes":5487747,"mime":"video/mp4","videoDurationSeconds":30,"containerDurationSeconds":30.016,"revision":"media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe"}'::jsonb then raise exception 'NATIVE_PROMOTION_MEDIA';end if;
 -- The existing editor acquires its version row lock BEFORE its statement
 -- advisory lock. Do not wait for that row here: the global authoring lock and
 -- before-statement triggers already serialize every source mutation.
 snap:=public.teaching_script_publish_snapshot(p_source_version);
 if snap->>'token' is distinct from p_expected_token then raise exception 'NATIVE_PROMOTION_STALE_DRAFT' using errcode='40001';end if;
 select value into t from jsonb_array_elements(snap->'nodes') where value->>'id'=p_source_node::text;
 if t is null or t->>'script_version_id' is distinct from p_source_version::text then raise exception 'NATIVE_PROMOTION_SOURCE';end if;
 draft:=t#>'{configuration,videoPilot}';
 if draft is null or draft is distinct from jsonb_build_object('contract','video-pilot-authoring/1','mode','video','state','draft','media','{"kind":"selected-local","assetId":"course-video-sample01","state":"pending-ingestion"}'::jsonb,'cue',draft->'cue','captions',null)
 or draft->'cue' is distinct from jsonb_build_object('id','pause-1','atSeconds',draft#>'{cue,atSeconds}','activityId',t->'reference_activity_id')
 or jsonb_typeof(draft#>'{cue,atSeconds}') is distinct from 'number'
 then raise exception 'NATIVE_PROMOTION_DRAFT';end if;
 if (draft#>>'{cue,atSeconds}')::numeric<0 or (draft#>>'{cue,atSeconds}')::numeric>=30 then raise exception 'NATIVE_PROMOTION_CUE';end if;
 if (t->'configuration') ? 'videoPilotPublication'
 or coalesce(t#>>'{configuration,interaction,kind}','none') not in ('none','')
 or coalesce(t#>>'{configuration,studentTask,kind}','none') not in ('none','')
 or exists(select 1 from public.learning_agent_node_interaction_secrets where node_id=p_source_node)
 then raise exception 'NATIVE_PROMOTION_UNSUPPORTED_SOURCE';end if;
 foreach k in array array['video_asset_id','video_url','audio_asset_id','audio_url','cue_points','cues','interaction','interaction_config','required_video','required_audio','required_speech','required_listening','required_cue'] loop
  if t ? k and t->k not in ('null'::jsonb,'false'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb) then raise exception 'NATIVE_PROMOTION_UNSUPPORTED_SOURCE';end if;
 end loop;
 if (t ? 'video_mode' and t->>'video_mode' is distinct from 'legacy') or (t ? 'segments' and t->'segments' is distinct from '[]'::jsonb) then raise exception 'NATIVE_PROMOTION_UNSUPPORTED_SOURCE';end if;
 select to_jsonb(x) into script from public.learning_agent_script_versions x where id=p_source_version;
 select to_jsonb(x) into lesson from public.learning_agent_lessons x where id=(script->>'lesson_id')::uuid;
 select to_jsonb(x) into a from public.digital_textbook_activities x where id=(t->>'reference_activity_id')::uuid;
 select to_jsonb(x) into secret from public.digital_textbook_activity_secrets x where activity_id=(a->>'id')::uuid;
 select to_jsonb(x) into n from public.digital_textbook_nodes x where id=(a->>'node_id')::uuid;
 select to_jsonb(x) into mo from public.digital_textbook_modules x where id=(lesson->>'module_id')::uuid;
 select to_jsonb(x) into ch from public.digital_textbook_chapters x where id=(mo->>'chapter_id')::uuid;
 select to_jsonb(x) into ver from public.digital_textbook_versions x where id=(ch->>'version_id')::uuid;
 select to_jsonb(x) into book from public.digital_textbooks x where id=(ver->>'textbook_id')::uuid;
 select to_jsonb(x) into profile from public.learning_agent_profiles x where id=(book->>'agent_profile_id')::uuid;
 if a is null or secret is null or lesson is null or n->'module_id' is distinct from mo->'id'
 or lesson->'agent_profile_id' is distinct from profile->'id' or book->'id' is distinct from p_target->'textbookId'
 or ver->'id' is distinct from p_target->'legacyVersionId' or ch->'chapter_number' is distinct from p_target->'chapterNumber'
 or ch->'slug' is distinct from p_target->'chapterSlug' or script->>'status' is distinct from 'draft'
 or book->>'status' is distinct from 'published' or ver->>'status' is distinct from 'published' or profile->>'status' is distinct from 'published'
 then raise exception 'NATIVE_PROMOTION_ASSOCIATION';end if;
 if (book->>'subject' is not null and profile->>'subject' is not null and book->>'subject'<>profile->>'subject')
 or (book->>'subject' is not null and lesson->>'subject' is not null and book->>'subject'<>lesson->>'subject')
 or (profile->>'subject' is not null and lesson->>'subject' is not null and profile->>'subject'<>lesson->>'subject') then raise exception 'NATIVE_PROMOTION_SUBJECT';end if;
 if a->>'activity_type' is distinct from 'single_choice' or a->'counts_toward_completion' is distinct from 'true'::jsonb
 or jsonb_typeof(a->'options') is distinct from 'array' then raise exception 'NATIVE_PROMOTION_ACTIVITY';end if;
 if jsonb_array_length(a->'options') not between 2 and 100 or (a->>'max_attempts')::integer not between 1 and 20
 or jsonb_typeof(a->'public_config') is distinct from 'object' or (a->'public_config')-'shuffle'-'showScore'<>'{}'::jsonb
 or (a->'public_config' ? 'shuffle' and jsonb_typeof(a#>'{public_config,shuffle}')<>'boolean')
 or (a->'public_config' ? 'showScore' and jsonb_typeof(a#>'{public_config,showScore}')<>'boolean')
 or secret->'answer_key' is distinct from jsonb_build_object('kind','index','value',secret#>'{answer_key,value}')
 or jsonb_typeof(secret#>'{answer_key,value}') is distinct from 'number' or not coalesce(secret#>>'{answer_key,value}' ~ '^[0-9]+$',false)
 then raise exception 'NATIVE_PROMOTION_ACTIVITY';end if;
 if (secret#>>'{answer_key,value}')::numeric not between 0 and jsonb_array_length(a->'options')-1
 or secret->>'transcript_ko' is not null or secret->>'audio_object_key' is not null then raise exception 'NATIVE_PROMOTION_SECRET';end if;
 for item in select value from jsonb_array_elements(jsonb_build_array(book->'title',ch->'title',ch->'scenario',ch->'goal',t->'title',t->'teacher_script',a->'prompt',a->'instruction')||a->'options') loop
  if jsonb_typeof(item)='string' then item:=jsonb_build_object('zh-CN',item);
  elsif jsonb_typeof(item) is distinct from 'object' or item='{}'::jsonb or item-'zh-CN'-'ko-KR'<>'{}'::jsonb then raise exception 'NATIVE_PROMOTION_TEXT';end if;
  for pair in select * from jsonb_each(item) loop
   txt:=pair.value#>>'{}';
   if jsonb_typeof(pair.value)<>'string' or length(txt) not between 1 and 20000 or txt ~* '(<\/?[a-z!]|javascript\s*:|data\s*:|=>|[{}]|@import|expression\s*\(|\mfunction\s*\(|\m(eval|Function)\s*\()' then raise exception 'NATIVE_PROMOTION_TEXT';end if;
  end loop;
 end loop;
 foreach item in array array[book->'title',ch->'title',t->'title',a->'prompt'] loop
  if not item ? 'zh-CN' then raise exception 'NATIVE_PROMOTION_LOCALE';end if;
 end loop;
 origin:=jsonb_build_object('node',t,'activity',a,'secret',secret,'associations',jsonb_build_object('book',book,'version',ver,'chapter',ch,'module',mo,'executionNode',n,'lesson',lesson,'script',script,'profile',profile));
 digest_value:=encode(sha256(convert_to(runtime_publish_private.native_promotion_canonical(origin),'UTF8')),'hex');
 scope:=jsonb_build_object('textbookId',book->'id','versionId',targets->'versionId','chapterId',targets->'chapterId');
 select to_jsonb(x) into source_existing from public.learning_agent_script_nodes x where id=(targets->>'sourceTeachingNodeId')::uuid;
 is_retry:=source_existing is not null;
 if is_retry then
  source:=source_existing#>'{configuration,videoPilotPublication}';
  if source#>'{origin}' is distinct from jsonb_build_object('teachingNodeId',p_source_node,'scriptVersionId',p_source_version,'draftDigest',digest_value)
  or source->>'approvedBy' is distinct from actor::text then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT';end if;
  made_at:=(source_existing->>'created_at')::timestamptz; approved:=source->>'approvedAt';
  select version_number into next_number from public.digital_textbook_versions where id=(targets->>'versionId')::uuid;
 else
  -- Every reserved ID must be fresh across all graph tables, not just its own.
  foreach table_name in array array['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','learning_agent_lessons','learning_agent_profiles','learning_agent_script_versions','learning_agent_script_nodes'] loop
   execute format('select to_jsonb(x) from public.%I x where id=any($1) limit 1',table_name) into existing using fresh_ids;
   if existing is not null then raise exception 'NATIVE_PROMOTION_ID_COLLISION';end if;
  end loop;
  made_at:=clock_timestamp();
  approved:=to_char(date_trunc('milliseconds',made_at at time zone 'UTC'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  select coalesce(max(version_number),0)+1 into next_number from public.digital_textbook_versions where textbook_id=(book->>'id')::uuid;
 end if;
 source:=jsonb_build_object('contract','video-pilot-publication-source/1','mode','video','state','promoted','origin',jsonb_build_object('teachingNodeId',p_source_node,'scriptVersionId',p_source_version,'draftDigest',digest_value),'approvedBy',actor,'approvedAt',approved,'media',p_media,'cue',jsonb_build_object('id','pause-1','atSeconds',draft#>'{cue,atSeconds}','activityId',targets->'activityId'),'captions',null);
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_versions,ver||jsonb_build_object('id',targets->'versionId','textbook_id',book->'id','version_number',next_number,'status','published','created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_versions x where id=(targets->>'versionId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_versions';end if;
 else
  insert into public.digital_textbook_versions select * from jsonb_populate_record(null::public.digital_textbook_versions,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_chapters,ch||jsonb_build_object('id',targets->'chapterId','version_id',targets->'versionId','chapter_test_id',null,'status','published','created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_chapters x where id=(targets->>'chapterId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_chapters';end if;
 else
  insert into public.digital_textbook_chapters select * from jsonb_populate_record(null::public.digital_textbook_chapters,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_modules,mo||jsonb_build_object('id',targets->'moduleId','chapter_id',targets->'chapterId','sort_order',1,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_modules x where id=(targets->>'moduleId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_modules';end if;
 else
  insert into public.digital_textbook_modules select * from jsonb_populate_record(null::public.digital_textbook_modules,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_nodes,n||jsonb_build_object('id',targets->'executionNodeId','module_id',targets->'moduleId','content','{}'::jsonb,'authoring_grammar_identities','[]'::jsonb,'sort_order',1,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_nodes x where id=(targets->>'executionNodeId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_nodes';end if;
 else
  insert into public.digital_textbook_nodes select * from jsonb_populate_record(null::public.digital_textbook_nodes,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_activities,a||jsonb_build_object('id',targets->'activityId','node_id',targets->'executionNodeId','sort_order',1,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_activities x where id=(targets->>'activityId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_activities';end if;
 else
  insert into public.digital_textbook_activities select * from jsonb_populate_record(null::public.digital_textbook_activities,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.digital_textbook_activity_secrets,secret||jsonb_build_object('activity_id',targets->'activityId','created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.digital_textbook_activity_secrets x where activity_id=(targets->>'activityId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: digital_textbook_activity_secrets';end if;
 else
  insert into public.digital_textbook_activity_secrets select * from jsonb_populate_record(null::public.digital_textbook_activity_secrets,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.learning_agent_lessons,lesson||jsonb_build_object('id',targets->'teachingLessonId','module_id',targets->'moduleId','status','published','revision',1,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.learning_agent_lessons x where id=(targets->>'teachingLessonId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: learning_agent_lessons';end if;
 else
  insert into public.learning_agent_lessons select * from jsonb_populate_record(null::public.learning_agent_lessons,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.learning_agent_script_versions,script||jsonb_build_object('id',targets->'scriptVersionId','lesson_id',targets->'teachingLessonId','version_number',1,'status','published','change_note',p_change_note,'created_by',actor,'published_by',actor,'published_at',made_at,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.learning_agent_script_versions x where id=(targets->>'scriptVersionId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: learning_agent_script_versions';end if;
 else
  insert into public.learning_agent_script_versions select * from jsonb_populate_record(null::public.learning_agent_script_versions,row_value);
 end if;
 row_value:=to_jsonb(jsonb_populate_record(null::public.learning_agent_script_nodes,t||jsonb_build_object('id',targets->'sourceTeachingNodeId','script_version_id',targets->'scriptVersionId','sort_order',1,'reference_activity_id',targets->'activityId','configuration',jsonb_build_object('videoPilotPublication',source),'action_type','focus_activity','is_required',true,'next_node_key',null,'remediation_node_key',null,'created_at',made_at,'updated_at',made_at)));
 if is_retry then
  select to_jsonb(x) into existing from public.learning_agent_script_nodes x where id=(targets->>'sourceTeachingNodeId')::uuid;
  if existing is distinct from row_value then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT: learning_agent_script_nodes';end if;
 else
  insert into public.learning_agent_script_nodes select * from jsonb_populate_record(null::public.learning_agent_script_nodes,row_value);
 end if;
 -- Recheck exact graph cardinality, including no extra media/secret descendants.
 existing:=runtime_publish_private.capture(scope);
 foreach k in array array['digital_textbook_versions','digital_textbook_chapters','digital_textbook_modules','digital_textbook_nodes','digital_textbook_activities','digital_textbook_activity_secrets','learning_agent_lessons','learning_agent_script_versions','learning_agent_script_nodes'] loop
  if jsonb_array_length(existing->k)<>1 then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT';end if;
 end loop;
 foreach k in array array['digital_textbook_media_assets','digital_textbook_listening_tracks','learning_agent_script_audio_assets','learning_agent_node_interaction_secrets','chapter_tests'] loop
  if existing->k is distinct from '[]'::jsonb then raise exception 'NATIVE_PROMOTION_RETRY_DRIFT';end if;
 end loop;
 return jsonb_build_object('scope',scope,'originDigest',digest_value,'sourceCreated',not is_retry);
end $$;
revoke all on function runtime_publish_private.native_promotion_canonical(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.promote_native_video_source_v1(uuid,uuid,text,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function public.promote_native_video_source_v1(uuid,uuid,text,jsonb,jsonb,text) to authenticated;
commit;
