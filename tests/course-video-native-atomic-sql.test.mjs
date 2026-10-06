import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {serverModule,nativeCapture,uid} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
// This file NEVER starts, pulls or removes a container. A separately owned,
// inspected fixed-image PG17.6 container is the only optional SQL input.
const container=process.env.COURSE_VIDEO_B_SQL_CONTAINER;
const compiler=await serverModule('src/lib/smart-textbook-publishing/native-video-publication.server.ts');
const q=x=>`'${String(x).replaceAll("'","''")}'`,j=x=>`${q(JSON.stringify(x))}::jsonb`;
const historicalChain=['202609100001_runtime_publish_foundation.sql','202609100002_runtime_publication_dependency_fence.sql','202609100003_runtime_admission_control.sql','202609100004_runtime_single_version_authoring.sql','202609100005_chapter_publish_semantic_compatibility.sql','202609110001_allow_evidence_graded_roleplay_publication.sql','202609110002_restore_single_version_publish_wrapper.sql','202609130001_textbook_grammar_authoring.sql','202609130002_textbook_grammar_practice_binding.sql','202609130003_runtime_authoring_nonretryable_error.sql','202609140000_agent_core_foundation.sql','202609140001_agent_runtime_completion_evidence.sql','202609140002_agent_run_cancel_request.sql'];
const historicalAclFixture='tests/fixtures/chapter-practice-acl/historical-environment.sql';
function testNativeBundle(){const f=nativeCapture(),t=f.c.learning_agent_script_nodes[0];t.configuration={videoPilotPublication:{contract:'video-pilot-publication-source/1',mode:'video',state:'promoted',origin:{teachingNodeId:uid(),scriptVersionId:uid(),draftDigest:'a'.repeat(64)},approvedBy:uid(),approvedAt:'2026-10-05T00:00:00.000Z',media:{adapter:'fixed-selected-host/1',assetId:'course-video-sample01',sha256:'68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',sizeBytes:5487747,mime:'video/mp4',videoDurationSeconds:30,containerDurationSeconds:30.016,revision:'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'},cue:{id:'pause-1',atSeconds:12.5,activityId:t.reference_activity_id},captions:null}};return compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(f.c,f.scope),f.scope);}
const migration='supabase/migrations/202610050002_native_video_session_activity.sql';
test('isolated native atomic RPC, live leases, history, immutable guard and independent SQL facts',{skip:!container,timeout:120000},async t=>{
 assert.match(container,/^course-video-packet-b-17-[0-9a-f-]+$/);
 const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:30e6});
 const info=JSON.parse(docker(['inspect',container]))[0];
 assert.equal(info.Config.Labels['uply.task'],'course-video-packet-b-17');assert.equal(info.HostConfig.NetworkMode,'none');assert.deepEqual(info.Mounts,[]);assert.equal(info.Image,'sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f');assert.equal(Object.keys(info.HostConfig.PortBindings??{}).length,0);
 const db='course_video_b_'+uid().replaceAll('-',''),base=['exec','-i',container,'/usr/lib/postgresql/bin/psql','-h','/tmp','-U','postgres'];
 const root=s=>docker([...base,'-d','postgres','-XqAt','-v','ON_ERROR_STOP=1'],s).trim();assert.equal(root('show server_version_num'),'170006');root(`create database ${db}`);
 const args=[...base,'-d',db,'-XqAt','-v','ON_ERROR_STOP=1'],sql=s=>docker(args,s).trim();
 const asyncSql=s=>new Promise((resolve,reject)=>{const child=execFile('docker',args,{encoding:'utf8',maxBuffer:30e6},(error,out,err)=>error?reject(Error(err)):resolve(out.trim()));child.stdin.end(s);});
 const reject=(text,pattern)=>assert.throws(()=>sql(text),e=>pattern.test(e.stderr?.toString()??e.message));
 try{
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
 const seed=c=>{for(const [table,rows]of Object.entries(c))for(const row of rows){const val=v=>v===null?'null':typeof v==='object'?j(v):typeof v==='boolean'||typeof v==='number'?String(v):q(v);sql(`insert into public.${table}(${Object.keys(row).map(k=>`"${k}"`).join(',')}) values(${Object.values(row).map(val).join(',')});`);}};
 const owner=uid(),actor=uid(),tenant=uid();sql(`insert into public.profiles values(${q(owner)},'platform_owner','active'),(${q(actor)},'student','active')`);
 const initial=testNativeBundle();seed(initial.privatePayload.dependencies);
 const capture=()=>JSON.parse(sql(`set role service_role;select public.capture_runtime_publication_v1(${q(owner)},${j(initial.scope)})`));
 const compile=()=>compiler.packageNativeVideoPublication(compiler.projectNativeVideoPublicationCapture(capture(),initial.scope),initial.scope);
 let b=compile(),pointer;
 const publish=(bundle,expected)=>JSON.parse(sql(`set role service_role;select public.publish_runtime_snapshot_v2(${q(owner)},${j(bundle.scope)},${j(expected)},'publish',${j(bundle)},null)`));
 pointer=publish(b,null);
 const binding=b.privatePayload.bindings[0],session=(who=actor,space=tenant)=>JSON.parse(sql(`set role service_role;select public.runtime_publication_session_v1('issue',${q(who)},${q(space)},null,${j(b.scope)},${j(pointer)},'zh-CN')`));
 const lease=(who=actor,space=tenant)=>{const id=uid();sql(`set role service_role;select public.runtime_publication_request_v1('enter',${q(who)},${q(space)},${q(b.scope.textbookId)},${q(id)})`);return id;};
 const expected=bundle=>({snapshotId:bundle.snapshotId,manifestDigest:bundle.manifestDigest,privateDigest:bundle.privateDigest,cueId:'pause-1',activityRevision:binding.activityRevision,mediaRevision:binding.mediaRevision});
 const saved=session(),activeLease=lease(),ref=saved.sessionRef.slice(17);
 const read=(s=ref,l=activeLease,who=actor,space=tenant,e=expected(b))=>`select public.read_native_video_session_v1(${q(who)},${q(space)},${q(s)},${q(l)},${j(e)})`;
 const write=(requestId,option,generation=0,s=ref,l=activeLease,e=expected(b),who=actor)=>`select public.record_native_video_attempt_v1(${q(who)},${q(tenant)},${q(s)},${q(l)},${j(e)},${j({requestId,generation})},${option},${option===2},${option===2?100:0})`;
 // Malformed storage is seeded BEFORE the new guard exists, under isolated
 // setup ownership. It is never a successful-write substitute or a bypass.
 const corrupt=[];
 for(const kind of ['missing','malformed','foreignActor','foreignTenant','snapshotMismatch','missingBinding','digestLink','oversize','overMax']){
  const who=uid();sql(`insert into public.profiles values(${q(who)},'student','active')`);const current=session(who),currentLease=lease(who);
  let origin=kind==='foreignActor'?saved:kind==='foreignTenant'?session(who,uid()):current;
  if(kind==='missingBinding'||kind==='digestLink'){
   const bad=compile(),{privatePayload,...document}=bad,originalId=uid();
   sql(`insert into runtime_publish_private.snapshots(id,textbook_id,version_id,chapter_id,document,created_by) values(${q(bad.snapshotId)},${q(bad.scope.textbookId)},${q(bad.scope.versionId)},${q(bad.scope.chapterId)},${j(document)},${q(owner)})`);
   if(kind==='digestLink')sql(`insert into runtime_publish_private.bindings(snapshot_id,payload,digest) values(${q(bad.snapshotId)},${j(privatePayload)},${q('a'.repeat(64))})`);
   sql(`insert into runtime_publish_private.sessions(id,actor_id,tenant_id,snapshot_id,locale) values(${q(originalId)},${q(who)},${q(tenant)},${q(bad.snapshotId)},'zh-CN')`);
   origin={sessionRef:'learning-session-'+originalId,bundle:bad};
  }
  let originRef=kind==='missing'?'learning-session-'+uid():kind==='malformed'?'legacy-locator':origin.sessionRef;
  const response={contract:'native-video-choice-response/1',requestId:uid(),sessionRef:originRef,snapshotId:kind==='snapshotMismatch'?'wrong':origin.bundle?.snapshotId??b.snapshotId,activityRevision:binding.activityRevision,mediaRevision:binding.mediaRevision,cueId:'pause-1',optionIndex:0,generation:0};
  for(let n=1;n<=(kind==='oversize'?21:kind==='overMax'?6:1);n++)sql(`insert into public.digital_textbook_attempts(tenant_id,student_id,version_id,activity_id,attempt_number,is_correct,score,response) values(${q(tenant)},${q(who)},${q(b.scope.versionId)},${q(binding.activityId)},${n},false,0,${j({...response,requestId:uid()})})`);
  corrupt.push({kind,who,current,currentLease});
 }
 const oldRpc=sql("select pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure)");
 await t.test('new SQL installs without changing original atomic body',()=>{sql(readFileSync(migration,'utf8'));assert.equal(sql("select pg_get_functiondef('public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric)'::regprocedure)"),oldRpc);});
 await t.test('current zero-attempt read works under repeatable-read READ ONLY and has exact result',()=>{const r=JSON.parse(sql(`begin isolation level repeatable read read only;set local role service_role;set local request.jwt.claim.role='service_role';${read()};commit;`));assert.deepEqual(Object.keys(r).sort(),['attemptOrigins','bundle']);assert.deepEqual(r.attemptOrigins,[]);assert.equal(r.bundle.snapshotId,b.snapshotId);});
 for(const item of corrupt)await t.test('historical integrity rejects '+item.kind,()=>reject(`set role service_role;${read(item.current.sessionRef.slice(17),item.currentLease,item.who)}`,/NATIVE_HISTORY_(OWNER|LOCATOR|COUNT|ARTIFACT)/));
 await t.test('ACL service can call RPC but never read private tables; anon/authenticated cannot call',()=>{for(const role of ['anon','authenticated'])reject(`set role ${role};${read()}`,/permission denied/);reject('set role service_role;select * from runtime_publish_private.sessions',/permission denied/);reject('set role authenticated;insert into public.digital_textbook_attempts default values',/permission denied/);});
 await t.test('foreign actor/tenant, absent lease, expected drift all reject',()=>{reject(`set role service_role;${read(ref,activeLease,uid())}`,/NATIVE_SESSION_AUTH|NATIVE_SESSION_EXPIRED/);reject(`set role service_role;${read(ref,activeLease,actor,uid())}`,/NATIVE_SESSION_EXPIRED/);reject(`set role service_role;${read(ref,uid())}`,/NATIVE_SESSION_LEASE/);reject(`set role service_role;${read(ref,activeLease,actor,tenant,{...expected(b),mediaRevision:'wrong'})}`,/NATIVE_SESSION_EXPECTED/);});
 await t.test('live profile, finished lease, authoring drain, grade and strict request gates reject',()=>{
  reject(`begin;update public.profiles set status='inactive' where id=${q(actor)};set local role service_role;${read()};rollback;`,/NATIVE_SESSION_AUTH/);
  reject(`begin;update runtime_publish_private.runtime_requests set finished_at=clock_timestamp() where id=${q(activeLease)};set local role service_role;${read()};rollback;`,/NATIVE_SESSION_LEASE/);
  reject(`begin;insert into runtime_publish_private.authoring_control(textbook_id,state) values(${q(b.scope.textbookId)},'draining');set local role service_role;${read()};rollback;`,/NATIVE_SESSION_FENCE/);
  reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),9)};rollback;`,/NATIVE_OPTION_INVALID/);
  reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),0).replace(',0,false,0)',',0,true,100)')};rollback;`,/NATIVE_GRADE_INVALID/);
  reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),0).replace('"generation":0','"generation":0,"actorId":"extra"')};rollback;`,/NATIVE_REQUEST_INVALID/);
  reject(`begin isolation level repeatable read;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),0)};rollback;`,/NATIVE_WRITE_ISOLATION/);
 });
 const r1=uid(),r2=uid();
 await t.test('old scalar RPC and direct fallback INSERT cannot write native Activity',()=>{const before=sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(actor)}`);reject(`set role service_role;set request.jwt.claim.role='service_role';select * from public.record_smart_textbook_attempt(${q(tenant)},${q(actor)},${q(binding.activityId)},${q(b.scope.versionId)},'0',false,0)`,/NATIVE_ATOMIC_REQUIRED/);reject(`set role service_role;insert into public.digital_textbook_attempts(tenant_id,student_id,version_id,activity_id,attempt_number,is_correct,score,response) values(${q(tenant)},${q(actor)},${q(b.scope.versionId)},${q(binding.activityId)},1,false,0,'0')`,/NATIVE_ATOMIC_REQUIRED/);assert.equal(sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(actor)}`),before);});
 const run=text=>JSON.parse(sql(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${text};commit;`));
 await t.test('actual existing RPC records wrong attempt/progress, same request new generation replays once',()=>{const first=run(write(r1,0)),again=run(write(r1,0,10));assert.equal(first.status,'RECORDED');assert.equal(first.atomicResult.attempt_number,1);assert.equal(first.isCorrect,false);assert.equal(again.status,'REPLAYED');assert.equal(again.atomicResult.attempt_number,1);assert.equal(again.response.generation,0);});
 await t.test('changed option or session on same request conflicts',()=>{reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(r1,1)};commit;`,/NATIVE_REQUEST_CONFLICT/);const other=session();reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(r1,0,0,other.sessionRef.slice(17))};commit;`,/NATIVE_REQUEST_CONFLICT/);});
 const secondSaved=session(),secondLease=lease();
 await t.test('concurrent identical delivery consumes exactly one extra attempt',async()=>{const text=`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(r2,1,0,secondSaved.sessionRef.slice(17),secondLease)};commit;`;const values=await Promise.all([asyncSql(text),asyncSql(text)]);assert.deepEqual(values.map(v=>JSON.parse(v).status).sort(),['RECORDED','REPLAYED']);assert.equal(sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(actor)}`),'2');});
 await t.test('missing atomic RPC and thrown post-write transaction roll back',()=>{const before=sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(actor)}`);reject(`begin;alter function public.record_smart_textbook_attempt(uuid,uuid,uuid,uuid,jsonb,boolean,numeric) rename to test_missing_atomic;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),1)};commit;`,/does not exist/);reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),1)};select 1/0;commit;`,/division by zero/);assert.equal(sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(actor)}`),before);});
 await t.test('lost correct response resolved by independent durable read; already-complete returns original recorded answer',()=>{run(write(uid(),2));const fresh=JSON.parse(sql(`set role service_role;${read()}`));assert.equal(fresh.attemptOrigins.length,2);assert.equal(fresh.attemptOrigins.some(o=>o.sessionRef===saved.sessionRef),true);const result=run(write(uid(),0));assert.equal(result.status,'ALREADY_COMPLETED');assert.equal(result.response.optionIndex,2);assert.equal(result.isCorrect,true);assert.equal(sql(`select status from public.digital_textbook_node_progress where student_id=${q(actor)}`),'completed');});
 await t.test('native UPDATE including rebind-to-historical denied',()=>{reject(`set role service_role;update public.digital_textbook_attempts set score=0 where student_id=${q(actor)}`,/NATIVE_ATTEMPT_IMMUTABLE/);});
 await t.test('original revoked/expired locator remains invalid, fresh locator restores prior origin',()=>{sql(`set role service_role;select public.runtime_publication_session_v1('revoke',${q(actor)},${q(tenant)},${q(ref)},null,null,'zh-CN')`);const current=session(),l=lease();reject(`set role service_role;${read()}`,/NATIVE_SESSION_EXPIRED/);reject(`set role service_role;select public.runtime_publication_session_v1('resolve',${q(actor)},${q(tenant)},${q(ref)},null,null,'zh-CN')`,/LEARNING_SESSION_EXPIRED/);let restored=JSON.parse(sql(`set role service_role;${read(current.sessionRef.slice(17),l)}`));assert.equal(restored.attemptOrigins.some(o=>o.sessionRef===saved.sessionRef),true);sql(`update runtime_publish_private.sessions set revoked=false,expires_at=clock_timestamp()-interval '1 second' where id=${q(ref)}`);restored=JSON.parse(sql(`set role service_role;${read(current.sessionRef.slice(17),l)}`));assert.equal(restored.attemptOrigins.length,2);});
 await t.test('pointer move preserves valid pinned sessions and identical-source recompiled snapshot imports attempts',()=>{const pinned=session(),pinLease=lease(),old=b;b=compile();pointer=publish(b,pointer);const current=session(),l=lease();const before=JSON.parse(sql(`set role service_role;${read(pinned.sessionRef.slice(17),pinLease,actor,tenant,expected(old))}`));assert.equal(before.bundle.snapshotId,old.snapshotId);const after=JSON.parse(sql(`set role service_role;${read(current.sessionRef.slice(17),l)}`));assert.equal(after.bundle.snapshotId,b.snapshotId);assert.equal(after.attemptOrigins[0].bundle.snapshotId,old.snapshotId);});
 await t.test('original max-attempt policy remains atomic and no progress is granted for exhaustion',()=>{
  const who=uid();sql(`insert into public.profiles values(${q(who)},'student','active')`);const current=session(who),l=lease(who);
  for(let n=1;n<=5;n++){const result=run(write(uid(),0,0,current.sessionRef.slice(17),l,expected(b),who));assert.equal(result.atomicResult.attempt_number,n);assert.equal(result.atomicResult.node_completed,false);}
  reject(`begin;set local role service_role;set local request.jwt.claim.role='service_role';${write(uid(),0,0,current.sessionRef.slice(17),l,expected(b),who)};commit;`,/MAX_ATTEMPTS_REACHED/);
  assert.equal(sql(`select count(*) from public.digital_textbook_attempts where student_id=${q(who)}`),'5');
 });
 await t.test('historical Activity still uses unchanged original RPC',()=>{const f=nativeCapture();seed(f.c);const a=f.c.digital_textbook_activities[0];const result=JSON.parse(sql(`set role service_role;set request.jwt.claim.role='service_role';select row_to_json(r) from public.record_smart_textbook_attempt(${q(tenant)},${q(actor)},${q(a.id)},${q(f.scope.versionId)},'2',true,100) r`));assert.equal(result.attempt_number,1);assert.equal(result.node_completed,true);reject(`set role service_role;update public.digital_textbook_attempts set activity_id=${q(a.id)},version_id=${q(f.scope.versionId)} where student_id=${q(actor)} and activity_id=${q(binding.activityId)}`,/NATIVE_ATTEMPT_IMMUTABLE/);});
 }finally{root(`drop database ${db} with(force)`);}
});
