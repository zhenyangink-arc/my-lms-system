import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {serverModule,nativeCapture,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
// No implicit container factory. SQL executes only inside an explicitly supplied,
// independently inspected/owned full container ID. This entry never creates one.
const container=process.env.COURSE_VIDEO_C_SQL_CONTAINER;
const q=x=>`'${String(x).replaceAll("'","''")}'`,j=x=>`${q(JSON.stringify(x))}::jsonb`;
const canonical=x=>Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`:JSON.stringify(x);
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const proof={adapter:'fixed-selected-host/1',assetId:'course-video-sample01',sha256:'68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',sizeBytes:5487747,mime:'video/mp4',videoDurationSeconds:30,containerDurationSeconds:30.016,revision:'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'};
const compiler=await serverModule('src/lib/smart-textbook-publishing/native-video-publication.server.ts');
const legacyCompiler=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
const promotion=await serverModule('src/features/learning-agent-script-studio/video-pilot-publication.server.ts',{
 '../../lib/admin':`export async function requirePlatformOwner(){const m=globalThis.__promotion;if(m.denied)throw Error('denied');return m.auth;}`,
 '../../lib/supabase/admin':`export const createAdminClient=()=>globalThis.__promotion.admin;`,
 '../../lib/smart-textbook-publishing/course-release-selection.server.ts':`export const getNativeVideoPromotionSelection=()=>globalThis.__promotion.selection;export const getLegacyVersionPin=()=>globalThis.__promotion.pin;`,
 '../../lib/smart-textbook-publishing/fixed-selected-media.server.ts':`export async function readFixedSelectedVideoSnapshot(){if(globalThis.__promotion.mediaBad)throw Error('bad');return {proof:globalThis.__promotion.proof};}`,
 '../../lib/smart-textbook-publishing/publisher.server.ts':`export const compileNativeVideoPublication=()=>globalThis.__promotion.compile();`,
 '../../lib/smart-textbook-publishing/repository.server.ts':`export function publicationRepository(){return {current:()=>globalThis.__promotion.current(),publish:(...a)=>globalThis.__promotion.publish(...a)};}`,
});
function setup(){const f=nativeCapture(),node=f.c.learning_agent_script_nodes[0],script=f.c.learning_agent_script_versions[0];script.status='draft';node.configuration={teacherVideo:{mode:'legacy'},videoPilot:{contract:'video-pilot-authoring/1',mode:'video',state:'draft',media:{kind:'selected-local',assetId:'course-video-sample01',state:'pending-ingestion'},cue:{id:'pause-1',atSeconds:8.125,activityId:node.reference_activity_id},captions:null}};
 const reserved=Object.fromEntries(['versionId','chapterId','moduleId','executionNodeId','activityId','teachingLessonId','scriptVersionId','sourceTeachingNodeId'].map(k=>[k,uid()]));const selection={contract:'course-release-selection/1',textbookId:f.id.textbook,textbookSlug:f.c.digital_textbooks[0].slug,lessonId:f.id.catalogLesson,legacyVersionId:f.id.version,chapterNumber:4,chapterSlug:'chapter-fixture',phase:'prepared',reserved,sourceDraft:{scriptVersionId:script.id,teachingNodeId:node.id}};
 const m={f,selection,pin:f.id.version,proof,calls:[],token:'a'.repeat(32),input:{sourceNodeId:node.id,sourceScriptVersionId:script.id,expectedToken:'a'.repeat(32),changeNote:'TEST ONLY'},auth:{user:{id:uid()},supabase:{async rpc(name,args){m.calls.push([name,args]);if(name==='teaching_script_publish_snapshot')return {data:{token:m.token,nodes:[node]},error:null};if(name==='promote_native_video_source_v1'){m.promoteArgs=args;return {data:{scope:{textbookId:f.id.textbook,versionId:reserved.versionId,chapterId:reserved.chapterId},originDigest:m.originDigest,sourceCreated:true},error:null};}throw Error('unexpected');}}},admin:{from(table){let rows=f.c[table]??[];const query={select(){return query;},eq(key,value){rows=rows.filter(r=>r[key]===value);return query;},async single(){return {data:rows[0],error:rows.length===1?null:{}};},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve);}};return query;}},async current(){throw Error('PUBLICATION_POINTER_MISSING');},async compile(){throw Error('TEST_ONLY_COMPILE_FAILURE');},async publish(scope,expected){m.calls.push(['publish',scope,expected]);}};
 const c=f.c;m.originDigest=hash({node,activity:c.digital_textbook_activities[0],secret:c.digital_textbook_activity_secrets[0],associations:{book:c.digital_textbooks[0],version:c.digital_textbook_versions[0],chapter:c.digital_textbook_chapters[0],module:c.digital_textbook_modules[0],executionNode:c.digital_textbook_nodes[0],lesson:c.learning_agent_lessons[0],script,profile:c.learning_agent_profiles[0]}});globalThis.__promotion=m;return m;}
test('owner inspection requires prepared installed pin, exact saved token, complete selected media and existing same-module secret',async()=>{
 const m=setup();assert.equal((await promotion.inspectNativeVideoPromotion(m.input)).state,'ready');assert.equal(m.calls.some(([n])=>n==='promote_native_video_source_v1'),false);
 for(const mode of ['registry','pin','token','media','incomplete','foreign','secret','counts','options']){const x=setup();if(mode==='registry')x.selection=null;if(mode==='pin')x.pin=uid();if(mode==='token')x.token='b'.repeat(32);if(mode==='media')x.mediaBad=true;if(mode==='incomplete')x.f.c.learning_agent_script_nodes[0].configuration.videoPilot.cue.atSeconds=null;if(mode==='foreign')x.f.c.digital_textbook_nodes[0].module_id=uid();if(mode==='secret')x.f.c.digital_textbook_activity_secrets[0].answer_key={kind:'index',value:99};if(mode==='counts')x.f.c.digital_textbook_activities[0].counts_toward_completion=false;if(mode==='options')x.f.c.digital_textbook_activities[0].options=['<script>bad</script>','second'];assert.equal((await promotion.inspectNativeVideoPromotion(x.input)).state,'blocked',mode);assert(!x.calls.some(([n])=>n==='promote_native_video_source_v1'));}
 const x=setup();x.denied=true;await assert.rejects(promotion.inspectNativeVideoPromotion(x.input),/denied/);
});
test('source success plus compiler failure is reported prepared; exact reserved targets go through authenticated RPC',async()=>{const m=setup();const result=await promotion.promoteAndPublishNativeVideoRelease(m.input);assert.equal(result.state,'source-created');assert.deepEqual(m.promoteArgs.p_target.reserved,m.selection.reserved);assert.equal(m.promoteArgs.p_expected_token,m.input.expectedToken);assert.deepEqual(m.promoteArgs.p_media,proof);assert.equal(m.selection.phase,'prepared');assert(!m.calls.some(([n])=>n==='publish'));});
test('one formal compiler capture publishes its SAME certified bundle through expected-null CAS; retry only inspects exact existing graph',async()=>{
 const m=setup(),c=structuredClone(m.f.c),ids=m.selection.reserved,scope={textbookId:m.f.id.textbook,versionId:ids.versionId,chapterId:ids.chapterId};
 c.digital_textbook_versions[0]={...c.digital_textbook_versions[0],id:ids.versionId,version_number:10};
 c.digital_textbook_chapters[0]={...c.digital_textbook_chapters[0],id:ids.chapterId,version_id:ids.versionId};
 c.digital_textbook_modules[0]={...c.digital_textbook_modules[0],id:ids.moduleId,chapter_id:ids.chapterId};
 c.digital_textbook_nodes[0]={...c.digital_textbook_nodes[0],id:ids.executionNodeId,module_id:ids.moduleId};
 c.digital_textbook_activities[0]={...c.digital_textbook_activities[0],id:ids.activityId,node_id:ids.executionNodeId};c.digital_textbook_activity_secrets[0].activity_id=ids.activityId;
 c.learning_agent_lessons[0]={...c.learning_agent_lessons[0],id:ids.teachingLessonId,module_id:ids.moduleId};
 c.learning_agent_script_versions[0]={...c.learning_agent_script_versions[0],id:ids.scriptVersionId,lesson_id:ids.teachingLessonId,status:'published',version_number:1};
 c.learning_agent_script_nodes[0]={...c.learning_agent_script_nodes[0],id:ids.sourceTeachingNodeId,script_version_id:ids.scriptVersionId,reference_activity_id:ids.activityId,configuration:{videoPilotPublication:{contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',origin:{teachingNodeId:m.input.sourceNodeId,scriptVersionId:m.input.sourceScriptVersionId,draftDigest:m.originDigest},approvedBy:m.auth.user.id,approvedAt:'2026-10-06T00:00:00.000Z',media:proof,cue:{id:'pause-1',atSeconds:8.125,activityId:ids.activityId},captions:null}}};
 const bundle=compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(c,scope),scope);let compilations=0,publishes=0;
 m.compile=async()=>{compilations++;return bundle;};m.publish=async(actor,candidate,expected)=>{publishes++;assert.equal(actor,m.auth.user.id);assert.equal(candidate,bundle);assert.equal(expected,null);return {snapshotId:bundle.snapshotId,generation:1};};
 assert.equal((await promotion.promoteAndPublishNativeVideoRelease(m.input)).state,'published');assert.equal(compilations,1);assert.equal(publishes,1);
 m.current=async()=>({bundle,pointer:{snapshotId:bundle.snapshotId,generation:1}});
 assert.equal((await promotion.promoteAndPublishNativeVideoRelease(m.input)).state,'published');assert.equal(compilations,2);assert.equal(publishes,1);assert.equal(m.selection.phase,'prepared');
 m.current=async()=>({bundle:{...bundle,sourceRevision:'changed'}});assert.equal((await promotion.promoteAndPublishNativeVideoRelease(m.input)).state,'source-created');assert.equal(publishes,1);
});
const migration='supabase/migrations/202610050003_native_video_source_promotion.sql';
const historicalChain=['202609100001_runtime_publish_foundation.sql','202609100002_runtime_publication_dependency_fence.sql','202609100003_runtime_admission_control.sql','202609100004_runtime_single_version_authoring.sql','202609100005_chapter_publish_semantic_compatibility.sql','202609110001_allow_evidence_graded_roleplay_publication.sql','202609110002_restore_single_version_publish_wrapper.sql','202609130001_textbook_grammar_authoring.sql','202609130002_textbook_grammar_practice_binding.sql','202609130003_runtime_authoring_nonretryable_error.sql','202609140000_agent_core_foundation.sql','202609140001_agent_runtime_completion_evidence.sql','202609140002_agent_run_cancel_request.sql'];
const historicalAclFixture='tests/fixtures/chapter-practice-acl/historical-environment.sql';
test('actual isolated owner promotion, canonical source, old fences/sessions and expected-null publication',{skip:!container,timeout:120000},async t=>{
 assert.match(container,/^[a-f0-9]{64}$/);
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:30e6});
 const info=JSON.parse(docker(['inspect',container]))[0];assert.equal(info.Id,container);assert.equal(info.Config.Labels['uply.task'],'course-video-packet-c-17');assert.equal(info.Image,'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f');assert.equal(info.HostConfig.NetworkMode,'none');assert.deepEqual(info.Mounts,[]);assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
 const db='course_video_c_'+uid().replaceAll('-','');const base=['exec','-i',container,'/usr/lib/postgresql/bin/psql','-h','/tmp','-U','postgres'];
 const root=s=>docker([...base,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],s).trim();assert.equal(root('show server_version_num'),'170006');root(`create database ${db}`);
 const sql=s=>docker([...base,'-d',db,'-XqAt','-v','ON_ERROR_STOP=1'],s).trim();const reject=(s,pattern)=>assert.throws(()=>sql(s),e=>pattern.test(e.stderr?.toString()??e.message));
 try {
  sql(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end $$;create schema auth;create schema private;
   create table auth.users(id uuid primary key);
   create table public.profiles(id uuid primary key,global_role text,status text);
   create table public.tenants(id uuid primary key,status text);
   create table public.tenant_memberships(tenant_id uuid,user_id uuid,status text,role text);
   create table public.ai_token_usage(id uuid primary key default gen_random_uuid(),user_id uuid,tenant_id uuid,provider text not null,model text not null,feature_code text not null,agent_code text,input_tokens integer not null default 0,output_tokens integer not null default 0,total_tokens integer not null default 0,created_at timestamptz default now());alter table public.ai_token_usage enable row level security;`);
  const fixture=nativeCapture(2),extra={digital_textbook_media_assets:{id:uid(),node_id:uid()},digital_textbook_listening_tracks:{id:uid(),activity_id:uid()},learning_agent_profile_secrets:{agent_profile_id:uid(),system_prompt:'synthetic'},learning_agent_node_interaction_secrets:{node_id:uid()},learning_agent_script_audio_assets:{id:uid(),script_node_id:uid()},chapter_tests:{id:uid(),status:'published'}};
  for(const [table,rows]of Object.entries(fixture.c)){
   const row=rows[0]??extra[table];const columns=Object.entries(row).map(([k,v])=>`"${k}" ${k==='id'||k.endsWith('_id')?'uuid':typeof v==='number'?'integer':typeof v==='boolean'?'boolean':typeof v==='object'&&v!==null?'jsonb':'text'}${k==='id'?' primary key':''}`);
   sql(`create table public.${table} (${columns.join(',')});`);
  }
  sql(`grant usage on schema public,auth to service_role,authenticated,anon;
   create table public.digital_textbook_attempts(id uuid default gen_random_uuid(),tenant_id uuid,student_id uuid,version_id uuid,activity_id uuid,attempt_number int,is_correct boolean,score int,response jsonb,created_at timestamptz default clock_timestamp());
   create table public.digital_textbook_node_progress(tenant_id uuid,student_id uuid,version_id uuid,node_id uuid,status text,completion_percent int,mastery_score int,attempt_count int,updated_at timestamptz,last_activity_at timestamptz);
   alter table public.digital_textbook_node_progress add unique(tenant_id,student_id,node_id,version_id);
   grant all on all tables in schema public to service_role;
   revoke insert,update,delete on public.digital_textbook_attempts from anon,authenticated;
   create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;`);

 for(const file of historicalChain)sql(readFileSync('supabase/migrations/'+file,'utf8'));
 sql(readFileSync(historicalAclFixture,'utf8'));sql(readFileSync('supabase/migrations/202609180002_native_publication_contract.sql','utf8'));
 sql(readFileSync('supabase/migrations/202610050001_native_video_publication_contract.sql','utf8'));
 sql(readFileSync('supabase/migrations/202608180027_restore_objective_activity_recording.sql','utf8'));
 sql(`create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function private.is_platform_owner() returns boolean language sql stable security definer as $$select exists(select 1 from public.profiles where id=auth.uid() and global_role='platform_owner' and status='active')$$;
 grant usage on schema private to authenticated;
 alter table public.learning_agent_script_versions add column created_at timestamptz default now(),add column updated_at timestamptz default now(),add column title jsonb default '{"zh-CN":"测试脚本"}',add column change_note text default '',add column created_by uuid,add column published_by uuid,add column published_at timestamptz;
 alter table public.learning_agent_script_nodes add column created_at timestamptz default now(),add column updated_at timestamptz default now();
 alter table public.learning_agent_script_versions add unique(lesson_id,version_number);
 alter table public.digital_textbook_versions add unique(textbook_id,version_number);
 alter table public.digital_textbook_activity_secrets add primary key(activity_id);
 alter table public.digital_textbook_activities add foreign key(node_id) references public.digital_textbook_nodes(id);
 alter table public.digital_textbook_activity_secrets add foreign key(activity_id) references public.digital_textbook_activities(id);
 alter table public.learning_agent_script_nodes add foreign key(script_version_id) references public.learning_agent_script_versions(id);`);
 // Use the EXACT installed historical snapshot function body (not a success stub).
 const snapshotSql=readFileSync('supabase/migrations/202609070001_teaching_script_atomic_video.sql','utf8');
 sql(snapshotSql.slice(snapshotSql.indexOf('create function public.teaching_script_publish_snapshot'),snapshotSql.indexOf('-- Keep existing graph validation')));
 sql(snapshotSql.slice(snapshotSql.indexOf('create function public.save_teaching_script_node_atomic'),snapshotSql.indexOf('-- A single SQL statement')));
 const foundation=readFileSync('supabase/migrations/202607200002_multi_tenant_foundation.sql','utf8');
 sql(foundation.slice(foundation.indexOf('create or replace function private.set_updated_at()'),foundation.indexOf('drop trigger if exists tenants_set_updated_at')));
 const studio=readFileSync('supabase/migrations/202608260006_learning_agent_script_studio.sql','utf8');
 sql(studio.slice(studio.indexOf('drop trigger if exists learning_agent_script_versions_set_updated_at'),studio.indexOf('alter table public.learning_agent_script_versions enable row level security')));
 sql(readFileSync('supabase/migrations/202610050002_native_video_session_activity.sql','utf8'));
 await t.test('migration fails closed if required authoring trigger is disabled',()=>{sql('alter table public.digital_textbook_activities disable trigger runtime_publish_lock');try{reject(readFileSync(migration,'utf8'),/NATIVE_PROMOTION_PREREQUISITE/);}finally{sql('alter table public.digital_textbook_activities enable trigger runtime_publish_lock');}});
 sql(readFileSync(migration,'utf8'));
 const seed=c=>{for(const [table,rows]of Object.entries(c))for(const row of rows){const val=v=>v===null?'null':typeof v==='object'?j(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);sql(`insert into public.${table}(${Object.keys(row).map(k=>`"${k}"`).join(',')}) values(${Object.values(row).map(val).join(',')});`);}};
 const owner=uid(),actor=uid(),tenant=uid();sql(`insert into public.profiles values(${q(owner)},'platform_owner','active'),(${q(actor)},'student','active')`);
 const old=nativeCapture();seed(old.c);
 // A second existing chapter in the FULL legacy version stays available.
 const second={...old.c.digital_textbook_chapters[0],id:uid(),chapter_number:5,slug:'chapter-five'};seed({digital_textbook_chapters:[second]});
 const capture=scope=>JSON.parse(sql(`set role service_role;select public.capture_runtime_publication_v1(${q(owner)},${j(scope)})`));
 const oldCapture=capture(old.scope),oldBundle=legacyCompiler.packageNativePublication(legacyCompiler.projectNativePublicationCapture(oldCapture,old.scope),old.scope);
 const publish=(bundle,expected=null)=>JSON.parse(sql(`set role service_role;select public.publish_runtime_snapshot_v2(${q(owner)},${j(bundle.scope)},${j(expected)},'publish',${j(bundle)},null)`));
 const oldPointer=publish(oldBundle),oldSession=JSON.parse(sql(`set role service_role;select public.runtime_publication_session_v1('issue',${q(actor)},${q(tenant)},null,${j(old.scope)},${j(oldPointer)},'zh-CN')`));
 const oldDocument=sql(`select document::text from runtime_publish_private.snapshots where id=${q(oldBundle.snapshotId)}`),oldFence=sql(`select capture::text from runtime_publish_private.dependency_fences where snapshot_id=${q(oldBundle.snapshotId)}`);
 const draftScript={...old.c.learning_agent_script_versions[0],id:uid(),version_number:8,status:'draft'},draftNode={...old.c.learning_agent_script_nodes[0],id:uid(),script_version_id:draftScript.id,configuration:{teacherVideo:{mode:'legacy'},videoPilot:{contract:'video-pilot-authoring/1',mode:'video',state:'draft',media:{kind:'selected-local',assetId:'course-video-sample01',state:'pending-ingestion'},cue:{id:'pause-1',atSeconds:8.125,activityId:old.c.digital_textbook_activities[0].id},captions:null}}};
 seed({learning_agent_script_versions:[draftScript],learning_agent_script_nodes:[draftNode]});
 const asOwner=`set role authenticated;select set_config('request.jwt.claim.sub',${q(owner)},false);`;
 const snapshot=()=>JSON.parse(sql(`${asOwner}select public.teaching_script_publish_snapshot(${q(draftScript.id)})`).split('\n').at(-1));
 let saved=snapshot();const reserved=Object.fromEntries(['versionId','chapterId','moduleId','executionNodeId','activityId','teachingLessonId','scriptVersionId','sourceTeachingNodeId'].map(k=>[k,uid()]));
 const target={textbookId:old.id.textbook,legacyVersionId:old.id.version,chapterNumber:4,chapterSlug:'chapter-fixture',reserved};
 const promote=(token=saved.token,targ=target,media=proof,who=owner)=>`set role authenticated;select set_config('request.jwt.claim.sub',${q(who)},false);select public.promote_native_video_source_v1(${q(draftNode.id)},${q(draftScript.id)},${q(token)},${j(targ)},${j(media)},'TEST ONLY')`;
 await t.test('owner/token/target/fixed proof negatives insert no graph',()=>{
  reject(promote('f'.repeat(32)),/NATIVE_PROMOTION_STALE_DRAFT/);reject(promote(saved.token,target,proof,actor),/NATIVE_PROMOTION_OWNER_ONLY/);
  reject(promote(saved.token,{...target,unknown:true}),/NATIVE_PROMOTION_TARGET/);reject(promote(saved.token,{...target,legacyVersionId:uid()}),/NATIVE_PROMOTION_ASSOCIATION/);
  reject(promote(saved.token,target,{...proof,sha256:'f'.repeat(64)}),/NATIVE_PROMOTION_MEDIA/);
  reject(promote(saved.token,{...target,reserved:{...reserved,versionId:old.id.version}}),/NATIVE_PROMOTION_ID_COLLISION/);
  assert.equal(sql(`select count(*) from public.digital_textbook_versions where id=${q(reserved.versionId)}`),'0');
 });
 await t.test('incomplete/unsupported saved cues rejected without modifying old capture',()=>{
  for(const change of [{...draftNode.configuration.videoPilot,media:null},{...draftNode.configuration.videoPilot,cue:{id:'pause-1',atSeconds:null,activityId:old.c.digital_textbook_activities[0].id}},{...draftNode.configuration.videoPilot,cue:{id:'pause-1',atSeconds:30,activityId:old.c.digital_textbook_activities[0].id}},{...draftNode.configuration.videoPilot,media:{kind:'r2-library',objectKey:'teacher-video/test.mp4',title:'测试',state:'unverified'}}]){
   sql(`update public.learning_agent_script_nodes set configuration=${j({videoPilot:change})} where id=${q(draftNode.id)}`);reject(promote(snapshot().token),/NATIVE_PROMOTION_DRAFT|NATIVE_PROMOTION_CUE/);
  }
  sql(`update public.learning_agent_script_nodes set configuration=${j(draftNode.configuration)} where id=${q(draftNode.id)}`);
  assert.deepEqual(snapshot().nodes[0].configuration,draftNode.configuration);saved=snapshot();assert.deepEqual(capture(old.scope),oldCapture);
 });
 await t.test('canonical helper matches TS for complete saved projection and numeric/Unicode boundaries',()=>{
  for(const value of [{a:1e-7,b:0.000001,c:29.999999999999996,d:-0,e:'한글中文😀\n"\\'},[null,true,false,0,1,1.25],{z:{a:[3,2,1]},a:'x'}])assert.equal(sql(`select runtime_publish_private.native_promotion_canonical(${j(value)})`),canonical(value));
 });
 await t.test('actual concurrent editor row lock then advisory wait never blocks promotion (deterministic two-session regression)',async sub=>{
  const events=[];const stamp=name=>events.push({name,atMs:performance.now()});
  const processArgs=[...base,'-d',db,'-XqAt','-v','ON_ERROR_STOP=1'];
  function session(name){let text='',done;const waiters=[];const complete=new Promise(resolve=>{done=resolve;});
   const child=execFile('docker',processArgs,{encoding:'utf8',maxBuffer:30e6},(error,stdout,stderr)=>{done({error,stdout,stderr});});
   child.stdout.on('data',chunk=>{text+=chunk;for(const waiter of [...waiters])if(text.includes(waiter.marker)){clearTimeout(waiter.timer);waiters.splice(waiters.indexOf(waiter),1);waiter.resolve();}});
   child.stdin.write(`set application_name=${q(name)};set lock_timeout='2s';set statement_timeout='5s';begin;`);
   return {child,complete,write:s=>child.stdin.write(s+'\n'),wait(marker){if(text.includes(marker))return Promise.resolve();return new Promise((resolve,reject)=>{const waiter={marker,resolve,timer:setTimeout(()=>reject(Error('sentinel missing: '+marker+' '+text)),6000)};waiters.push(waiter);});},end(s){child.stdin.end(s+'\n');},cleanup(){for(const w of waiters)clearTimeout(w.timer);if(!child.stdin.destroyed&&!child.stdin.writableEnded)child.stdin.end('rollback;\n');}};
  }
  const editorName='task17-editor-'+uid(),promotionName='task17-promotion-'+uid(),editor=session(editorName),promoter=session(promotionName);
  try {
   editor.write(`select id from public.learning_agent_script_versions where id=${q(draftScript.id)} for update;select 'EDITOR_ROW_LOCKED';`);await editor.wait('EDITOR_ROW_LOCKED');stamp('editor-row-locked');
   promoter.write(`select runtime_publish_private.authoring_lock();select 'PROMOTION_ADVISORY_LOCKED';`);await promoter.wait('PROMOTION_ADVISORY_LOCKED');stamp('promotion-advisory-locked');
   editor.write(`${asOwner}select public.save_teaching_script_node_atomic(${q(draftNode.id)},${q(saved.nodes[0].updated_at)},${j(saved.nodes[0])},null);commit;select 'EDITOR_SAVED';`);
   const deadline=Date.now()+3000;let observed=false;while(Date.now()<deadline){const state=sql(`select coalesce(wait_event,'') from pg_stat_activity where datname=${q(db)} and application_name=${q(editorName)}`);if(state==='advisory'){observed=true;break;}}
   assert.equal(observed,true,'actual editor is waiting for promotion advisory, not guessed by delay');stamp('editor-advisory-wait-observed');
   promoter.end(`${promote()};select 'PROMOTION_CREATED';rollback;`);const pr=await promoter.complete;assert.equal(pr.error,null,pr.stderr);assert.match(pr.stdout,/PROMOTION_CREATED/);stamp('promotion-complete-and-rollback');
   await editor.wait('EDITOR_SAVED');editor.end('');const er=await editor.complete;assert.equal(er.error,null,er.stderr);stamp('editor-save-completed');
   const prior=saved;saved=snapshot();assert.notEqual(saved.token,prior.token,'real updated_at trigger changes saved token; establish fresh post-editor baseline');assert.deepEqual(saved.nodes[0].configuration,prior.nodes[0].configuration);assert.deepEqual(capture(old.scope),oldCapture);
   assert.equal(sql(`select count(*) from public.digital_textbook_versions where id=${q(reserved.versionId)}`),'0','concurrency probe graph rolled back');
  } finally {editor.cleanup();promoter.cleanup();await Promise.all([editor.complete,promoter.complete]);sub.diagnostic(JSON.stringify({events}));}
 });
 const originalRows=JSON.parse(sql(`select jsonb_build_object('node',(select to_jsonb(x) from public.learning_agent_script_nodes x where id=${q(draftNode.id)}),'activity',(select to_jsonb(x) from public.digital_textbook_activities x where id=${q(draftNode.reference_activity_id)}),'secret',(select to_jsonb(x) from public.digital_textbook_activity_secrets x where activity_id=${q(draftNode.reference_activity_id)}),'associations',jsonb_build_object('book',(select to_jsonb(x) from public.digital_textbooks x where id=${q(old.id.textbook)}),'version',(select to_jsonb(x) from public.digital_textbook_versions x where id=${q(old.id.version)}),'chapter',(select to_jsonb(x) from public.digital_textbook_chapters x where id=${q(old.id.chapter)}),'module',(select to_jsonb(x) from public.digital_textbook_modules x where id=${q(old.id.module)}),'executionNode',(select to_jsonb(x) from public.digital_textbook_nodes x where id=${q(old.c.digital_textbook_nodes[0].id)}),'lesson',(select to_jsonb(x) from public.learning_agent_lessons x where id=${q(old.id.teachingLesson)}),'script',(select to_jsonb(x) from public.learning_agent_script_versions x where id=${q(draftScript.id)}),'profile',(select to_jsonb(x) from public.learning_agent_profiles x where id=${q(old.id.profile)})))`));
 const promoted=JSON.parse(sql(promote()).split('\n').at(-1));
 await t.test('fresh graph binds new IDs, exact original digest/private secret and script version one',()=>{
  assert.equal(promoted.sourceCreated,true);assert.equal(promoted.originDigest,hash(originalRows));const c=capture(promoted.scope),t=c.learning_agent_script_nodes[0],source=t.configuration.videoPilotPublication;
  assert.deepEqual(source.origin,{teachingNodeId:draftNode.id,scriptVersionId:draftScript.id,draftDigest:hash(originalRows)});assert.equal(source.approvedBy,owner);assert.match(source.approvedAt,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);assert.equal(source.cue.activityId,reserved.activityId);assert.deepEqual(source.media,proof);
  assert.equal(c.digital_textbook_versions[0].version_number,10);assert.equal(c.learning_agent_script_versions[0].version_number,1);assert.equal(c.digital_textbook_activities[0].activity_key,old.c.digital_textbook_activities[0].activity_key);assert.deepEqual(c.digital_textbook_activity_secrets[0].answer_key,old.c.digital_textbook_activity_secrets[0].answer_key);assert.equal(c.digital_textbook_activity_secrets[0].activity_id,reserved.activityId);assert.deepEqual(c.digital_textbook_nodes[0].content,{});assert.deepEqual(snapshot(),saved);
  assert.equal(JSON.parse(sql(promote()).split('\n').at(-1)).sourceCreated,false);
 });
 const captured=capture(promoted.scope),bundle=compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(captured,promoted.scope),promoted.scope);
 const pointer=publish(bundle);
 await t.test('real capture/compiler/publication/CAS/fence and old session survive independent release',()=>{
  assert.equal(pointer.generation,1);assert.equal(sql(`select document::text from runtime_publish_private.snapshots where id=${q(oldBundle.snapshotId)}`),oldDocument);assert.equal(sql(`select capture::text from runtime_publish_private.dependency_fences where snapshot_id=${q(oldBundle.snapshotId)}`),oldFence);assert.deepEqual(capture(old.scope),oldCapture);
  const resolved=JSON.parse(sql(`set role service_role;select public.runtime_publication_session_v1('resolve',${q(actor)},${q(tenant)},${q(oldSession.sessionRef.slice(17))},null,null,'zh-CN')`));assert.equal(resolved.bundle.snapshotId,oldBundle.snapshotId);
  assert.equal(sql(`select count(*) from public.digital_textbook_chapters where version_id=${q(old.id.version)}`),'2');
  reject(`set role service_role;select public.publish_runtime_snapshot_v2(${q(owner)},${j(bundle.scope)},null,'publish',${j(bundle)},null)`,/PUBLICATION_CONFLICT/);
  reject(`update public.digital_textbook_activities set prompt='{"zh-CN":"改变"}'::jsonb where id=${q(reserved.activityId)}`,/PUBLISHED_DEPENDENCY_IMMUTABLE/);
  assert.equal(JSON.parse(sql(promote()).split('\n').at(-1)).sourceCreated,false);
 });
 } finally {root(`drop database ${db} with (force)`);}
});
