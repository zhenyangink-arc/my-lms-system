import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { videoFixture, compileVideo, resign, approvalTimestampValid, approvalTimestampInvalid } from './course-video-native-publication.test.mjs';
import { serverModule, nativeCapture, uid } from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
import { q,j,historicalChain,publicationMigration,historicalAclFixture } from './fixtures/teaching-agent-r7d-production/postgres.mjs';
const migration='supabase/migrations/202610050001_native_video_publication_contract.sql';
// Explicit isolated harness only. Never infer a host, DB URL or production credential.
const container=process.env.COURSE_VIDEO_SQL_CONTAINER;
test('forward migration preserves explicit old version branches and base ordering',()=>{
 const sql=readFileSync(migration,'utf8');assert.doesNotMatch(sql,/create\s+table|alter\s+function.*rename|begin_runtime_textbook_edit_v1\(/i);
 assert.match(sql,/native_video_admission\(p_bundle,captured\)/);assert.match(sql,/PUBLICATION_SCHEMA_DRIFT/);assert.doesNotMatch(sql,/create or replace function public\.(?:runtime_publication_session_v1|publish_runtime_snapshot_v2)\(/i);
});
test('isolated PostgreSQL 17.6 actual outer RPC admission, fences, history and CAS',{skip:!container,timeout:120000},async t=>{
 assert.equal(container,'course-video-packet-a-17-20261005');
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:20e6});
 const info=JSON.parse(docker(['inspect',container]))[0];
 assert.equal(info.Config.Labels['uply.task'],'course-video-packet-a-17');assert.equal(info.HostConfig.NetworkMode,'none');assert.deepEqual(info.Mounts,[]);assert.equal(info.Image,'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f');assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
 const dbName='course_video_packet_a_17_'+uid().replaceAll('-','');
 const args=['exec','-i',container,'/usr/lib/postgresql/bin/psql','-h','/tmp','-U','postgres','-d',dbName,'-XqAt','-v','ON_ERROR_STOP=1'];
 const sql=s=>docker(args,s).trim();
 const asyncSql=s=>new Promise((resolve,reject)=>{const child=execFile('docker',args,{encoding:'utf8',maxBuffer:20e6},(e,out,err)=>e?reject(Error(err)):resolve(out.trim()));child.stdin.end(s);});
 const rootSql=s=>docker(['exec','-i',container,'/usr/lib/postgresql/bin/psql','-h','/tmp','-U','postgres','-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],s).trim();
 assert.equal(rootSql('show server_version_num'),'170006');rootSql(`create database ${dbName};`);
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
   grant all on all tables in schema public to service_role;`);

 for(const file of historicalChain)sql(readFileSync('supabase/migrations/'+file,'utf8'));
 sql(readFileSync(historicalAclFixture,'utf8'));sql(readFileSync('supabase/migrations/'+publicationMigration,'utf8'));
 const invariant=()=>sql("select string_agg(pg_get_functiondef(x::regprocedure),E'\n' order by x) from unnest(array['public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text)','public.runtime_publication_session_v1(text,uuid,uuid,uuid,jsonb,jsonb,text)','public.runtime_publication_request_v1(text,uuid,uuid,uuid,uuid)','runtime_publish_private.native_admission(jsonb,jsonb)']) x");
 const oldFunctions=invariant();
 const seed=f=>{for(const [table,rows] of Object.entries(f.c))for(const row of rows){const val=v=>v===null?'null':typeof v==='object'?j(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);sql(`insert into public.${table}(${Object.keys(row).map(k=>`"${k}"`).join(',')}) values(${Object.values(row).map(val).join(',')});`);}};
 const owner=uid(),tenant=uid();sql(`insert into public.profiles values(${q(owner)},'platform_owner','active');`);
 const capture=f=>JSON.parse(sql(`set role service_role;select public.capture_runtime_publication_v1(${q(owner)},${j(f.scope)});`));
 const publish=(f,b,expected=null,actor=owner)=>`set role service_role;select public.publish_runtime_snapshot_v2(${q(actor)},${j(f.scope)},${j(expected)},'publish',${j(b)},null);`;
 const reject=(s,pattern)=>assert.throws(()=>sql(s),e=>pattern.test(e.stderr?.toString()??e.message));
 const native=await serverModule('src/lib/smart-textbook-publishing/native-publication.server.ts');
 const history=[];
 for(const legacy of [true,false]){
  const f=nativeCapture();seed(f);const c=capture(f),b=native.packageNativePublication(native.projectNativePublicationCapture(c,f.scope),f.scope);
  // Synthetic DB-contract historical /1 document; never claimed a TS legacy certificate.
  if(legacy){b.revision='publish-foundation/1';delete b.publicationKind;}
  const pointer=JSON.parse(sql(publish(f,b)));
  const session=JSON.parse(sql(`set role service_role;select public.runtime_publication_session_v1('issue',${q(owner)},${q(tenant)},null,${j(f.scope)},${j(pointer)},'zh-CN');`));
  history.push({f,b,c,pointer,session,document:sql(`select document::text from runtime_publish_private.snapshots where id=${q(b.snapshotId)}`)});
 }
 await t.test('install exact forward migration, keep outer/session/lease and /2 admission byte identical',()=>{sql(readFileSync(migration,'utf8'));assert.equal(invariant(),oldFunctions);});
 const f=videoFixture(),prior=history[1];
 // New graph belongs to a NEW version of the SAME existing textbook/profile.
 f.c.digital_textbooks=structuredClone(prior.f.c.digital_textbooks);f.c.learning_agent_profiles=structuredClone(prior.f.c.learning_agent_profiles);
 f.c.digital_textbook_versions[0].textbook_id=prior.f.scope.textbookId;f.scope.textbookId=prior.f.scope.textbookId;
 f.c.learning_agent_lessons[0].agent_profile_id=prior.f.c.learning_agent_profiles[0].id;
 seed({c:{...f.c,digital_textbooks:[],learning_agent_profiles:[]}});const captured=capture(f);f.c=captured;const b=compileVideo(f);
 const before=sql('select count(*) from runtime_publish_private.snapshots');
 for(const [name,edit,pattern] of [
  ['cue',x=>{x.manifest.execution.cues[0].triggerTime=11;},/MANIFEST_PROJECTION/],
  ['title',x=>{x.manifest.steps[0].title={'zh-CN':'tampered'};},/MANIFEST_PROJECTION/],
  ['prompt',x=>{x.manifest.activityRefs[0].publicPresentation.prompt={'zh-CN':'tampered'};},/MANIFEST_PROJECTION/],
  ['instruction',x=>{x.manifest.activityRefs[0].publicPresentation.instruction={'zh-CN':'tampered'};},/MANIFEST_PROJECTION/],
  ['options',x=>{x.manifest.activityRefs[0].publicPresentation.options.reverse();},/MANIFEST_PROJECTION/],
  ['settings',x=>{x.manifest.activityRefs[0].publicPresentation.settings.shuffle=true;},/MANIFEST_PROJECTION/],
  ['duration',x=>{x.manifest.execution.media[0].durationSeconds=31;},/MANIFEST_PROJECTION/],
  ['media URL',x=>{x.manifest.mediaRefs[0].url='https://example.invalid';},/MANIFEST_PROJECTION/],
  ['private leak',x=>{x.manifest.answer_key={kind:'index',value:1};},/MANIFEST_PROJECTION/],
  ['private binding',x=>{x.privatePayload.bindings[0].sourceTeachingNodeId=uid();},/BINDING/],
  ['private source',x=>{x.privatePayload.source.activities[0].prompt={'zh-CN':'tampered'};},/PRIVATE_SOURCE/],
  ['mixed execution',x=>{x.manifest.execution.contract='native-execution/1';},/CONTRACT/],
  ['unknown revision',x=>{x.revision='publish-foundation/4';},/BUNDLE/],
  ['mixed compiler',x=>{x.compilerVersion='native-publication-1';},/CONTRACT/],
  ['capture tamper',x=>{x.privatePayload.dependencies.digital_textbook_activity_secrets[0].answer_key.value=1;},/CAPTURE_CONFLICT/],
 ])await t.test('outer SQL rejects re-signed '+name,()=>{const x=structuredClone(b);edit(x);reject(publish(f,resign(x)),pattern);assert.equal(sql('select count(*) from runtime_publish_private.snapshots'),before);});
 // Mutate only the unfenced synthetic new-version graph, then restore it.
 // Re-capture each time so SQL cannot rely solely on dependencies inequality.
 for(const [name,table,column,idKey,makeValue] of [
  ['draft source','learning_agent_script_nodes','configuration','id',()=>({videoPilot:{}})],
  ['unknown source key','learning_agent_script_nodes','configuration','id',old=>({...old,extra:true})],
  ['unknown proof key','learning_agent_script_nodes','configuration','id',old=>{old.videoPilotPublication.media.url='https://example.invalid';return old;}],
  ['wrong fixed hash','learning_agent_script_nodes','configuration','id',old=>{old.videoPilotPublication.media.sha256='f'.repeat(64);return old;}],
  ['cue at end','learning_agent_script_nodes','configuration','id',old=>{old.videoPilotPublication.cue.atSeconds=30;return old;}],
  ['foreign cue Activity','learning_agent_script_nodes','configuration','id',old=>{old.videoPilotPublication.cue.activityId=uid();return old;}],
  ['malformed approval','learning_agent_script_nodes','configuration','id',old=>{old.videoPilotPublication.approvedAt='2026-02-30T00:00:00Z';return old;}],
  ['secret out of range','digital_textbook_activity_secrets','answer_key','activity_id',()=>({kind:'index',value:99})],
  ['secret extra key','digital_textbook_activity_secrets','answer_key','activity_id',()=>({kind:'index',value:0,answer:0})],
  ['anonymous option','digital_textbook_activities','options','id',()=>[{},'second']],
  ['executable option','digital_textbook_activities','options','id',()=>['<script>bad</script>','second']],
  ['unknown public setting','digital_textbook_activities','public_config','id',()=>({answer:1})],
  ['nonempty execution content','digital_textbook_nodes','content','id',()=>({html:'unsafe'})],
 ])await t.test('outer SQL rejects malformed current capture: '+name,()=>{
  const row=f.c[table][0],original=row[column],changed=makeValue(structuredClone(original));
  const update=value=>sql(`update public.${table} set "${column}"=${j(value)} where "${idKey}"=${q(row[idKey])};`);
  try {update(changed);const x=structuredClone(b);x.privatePayload.dependencies=capture(f);reject(publish(f,resign(x)),/NATIVE_VIDEO|date\/time field value out of range/);assert.equal(sql('select count(*) from runtime_publish_private.snapshots'),before);}
  finally {update(original);}
 });
 // Approval cases deliberately bypass the TS producer for SQL negatives.
 // Every RPC sees its freshly matching unfenced capture, not a stale bundle.
 const sourceRow=f.c.learning_agent_script_nodes[0],originalConfiguration=sourceRow.configuration;
 const updateApproval=value=>{
  const configuration=structuredClone(originalConfiguration);
  if(value===undefined)delete configuration.videoPilotPublication.approvedAt;else configuration.videoPilotPublication.approvedAt=value;
  sql(`update public.learning_agent_script_nodes set configuration=${j(configuration)} where id=${q(sourceRow.id)};`);
  return capture(f);
 };
 const restoreApproval=()=>sql(`update public.learning_agent_script_nodes set configuration=${j(originalConfiguration)} where id=${q(sourceRow.id)};`);
 for(const value of approvalTimestampValid)await t.test('outer SQL approvedAt exact stored roundtrip '+value,()=>{
  try {
   const current=updateApproval(value),candidate=compileVideo({...f,c:current});
   const result=sql(`begin;${publish(f,candidate)} reset role;select to_jsonb(payload#>>'{source,teachingNodes,0,configuration,videoPilotPublication,approvedAt}')::text from runtime_publish_private.bindings where snapshot_id=${q(candidate.snapshotId)};rollback;`).split('\n');
   assert.equal(JSON.parse(result.at(-1)),value);
   assert.equal(sql('select count(*) from runtime_publish_private.snapshots'),before);
  }finally{restoreApproval();}
 });
 for(const [name,value] of approvalTimestampInvalid)await t.test('outer SQL approvedAt rejects '+name+' with NATIVE_VIDEO_PROMOTION',()=>{
  try {
   const current=updateApproval(value),candidate=structuredClone(b);
   candidate.privatePayload.dependencies=current;
   candidate.privatePayload.source.teachingNodes[0].configuration=structuredClone(current.learning_agent_script_nodes[0].configuration);
   reject(publish(f,resign(candidate)),/ERROR:\s+NATIVE_VIDEO_PROMOTION(?:\r?\n|$)/);
   assert.equal(sql('select count(*) from runtime_publish_private.snapshots'),before);
  }finally{restoreApproval();}
 });
 await t.test('SQL rejects nonowner',()=>reject(publish(f,b,null,uid()),/OWNER/));
 let pointer;
 await t.test('valid exact capture publishes and stores dependency fence',()=>{pointer=JSON.parse(sql(publish(f,b)));assert.equal(pointer.generation,1);assert.equal(sql(`select public.assert_runtime_dependency_fence_v1(${q(b.snapshotId)},${j(captured)});`),'t');});
 await t.test('stale CAS rejected and concurrent identical CAS exactly one winner',async()=>{reject(publish(f,b),/CONFLICT/);const r=await Promise.allSettled([asyncSql(publish(f,b,pointer)),asyncSql(publish(f,b,pointer))]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.match(r.find(x=>x.status==='rejected').reason.message,/PUBLICATION_CONFLICT/);pointer=JSON.parse(r.find(x=>x.status==='fulfilled').value);});
 await t.test('grading secret and source cue remain immutable under original fence',()=>{reject(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":0}' where activity_id=${q(f.c.digital_textbook_activities[0].id)}`,/PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW/);reject(`update public.learning_agent_script_nodes set configuration=jsonb_set(configuration,'{videoPilotPublication,cue,atSeconds}','29') where id=${q(f.c.learning_agent_script_nodes[0].id)}`,/PUBLISHED_DEPENDENCY_IMMUTABLE_USE_EDIT_WINDOW/);});
 await t.test('/1 and /2 snapshot/history/fence/session survive new sparse graph insertion without edit window',()=>{
  for(const h of history){assert.equal(sql(`select document::text from runtime_publish_private.snapshots where id=${q(h.b.snapshotId)}`),h.document);assert.equal(sql(`select public.assert_runtime_dependency_fence_v1(${q(h.b.snapshotId)},${j(h.c)});`),'t');const ref=h.session.sessionRef.slice(17);const resolved=JSON.parse(sql(`set role service_role;select public.runtime_publication_session_v1('resolve',${q(owner)},${q(tenant)},${q(ref)});`));assert.equal(resolved.bundle.snapshotId,h.b.snapshotId);assert.equal(sql(`select count(*) from runtime_publish_private.history where to_snapshot=${q(h.b.snapshotId)}`),'1');}
  assert.equal(sql('select count(*) from runtime_publish_private.authoring_control'),'0');assert.equal(sql('select count(*) from runtime_publish_private.retired_snapshots'),'0');
 });
 await t.test('private ACLs and service-only outer RPC remain closed',()=>{for(const fn of ['runtime_publish_private.native_video_admission(jsonb,jsonb)','public.publish_runtime_snapshot_base_v2(uuid,jsonb,jsonb,text,jsonb,text)','public.publish_runtime_snapshot_v1(uuid,jsonb,jsonb,text,jsonb,text)'])for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(fn)},'EXECUTE')`),'f');assert.equal(sql("select has_function_privilege('service_role','public.publish_runtime_snapshot_v2(uuid,jsonb,jsonb,text,jsonb,text)','EXECUTE')"),'t');});
 } finally { rootSql(`drop database ${dbName} with (force);`); }
});
