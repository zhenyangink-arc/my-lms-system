import assert from 'node:assert/strict';
import test, { before, after, beforeEach } from 'node:test';
import { randomBytes, createHmac } from 'node:crypto';
import { isolatedRecordingPostgres, literal as q, json, service } from './fixtures/recording-v2-postgres.mjs';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';

const api = await serverModule('src/lib/recording-evidence-v2.server.ts');
const secret=randomBytes(32),uuid=n=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=uuid(1),student=uuid(2),activity=uuid(3),version=uuid(4),node=uuid(5),moduleId=uuid(6),chapter=uuid(7);
const binding={snapshot:'isolated-snapshot',sourceRevision:'isolated-source',versionId:version,activityRef:'isolated-activity-ref',recordingKind:'independent-output'};
const scope={tenantId:tenant,studentId:student,activityId:activity,versionId:version,runtimeBinding:binding};
const config={answerKey:{kind:'open'},publicConfig:{enforceCompletionRequirements:true,minimumSeconds:15,requiredCriteria:4}};
const head=async()=>({exists:true,size:4096,contentType:'audio/webm;codecs=opus'});
const proofServices={keyId:'isolated',secret,headR2:head,headLegacy:head};
const scene={id:'greeting',lines:['a','b','c','d']};
let db;
before(async()=>{db=await isolatedRecordingPostgres(secret);}, {timeout:30000});
after(async()=>{if(db)await db.stop();});
beforeEach(async()=>{
  await db.query(`truncate public.digital_textbook_attempts,public.digital_textbook_node_progress,public.digital_textbook_speaking_evidence,storage.objects;
    insert into public.tenants values(${q(tenant)}) on conflict do nothing;insert into auth.users values(${q(student)}) on conflict do nothing;
    insert into public.digital_textbook_chapters values(${q(chapter)},${q(version)}) on conflict do nothing;
    insert into public.digital_textbook_modules values(${q(moduleId)},${q(chapter)}) on conflict do nothing;
    insert into public.digital_textbook_nodes values(${q(node)},${q(moduleId)},${json({dialogueScenes:[scene]})}) on conflict do nothing;
    insert into public.digital_textbook_activities values(${q(activity)},${q(node)},'speaking',20,true,'{}')
      on conflict(id) do update set public_config='{}';`);
});
function evidence(n=100,metadata={durationSeconds:20,storage:'r2',runtimeBinding:binding}) {
  const id=uuid(n);return {id,tenant_id:tenant,student_id:student,activity_id:activity,
    object_key:`student-recordings/${tenant}/${student}/${activity}/${id}.webm`,byte_size:4096,mime_type:'audio/webm',
    created_at:new Date(Date.now()-1000).toISOString(),consumed_at:null,consumed_attempt_number:null,metadata};
}
async function insert(e) {
  await db.query(`insert into public.digital_textbook_speaking_evidence(id,tenant_id,student_id,activity_id,object_key,byte_size,mime_type,created_at,metadata)
    values(${[e.id,e.tenant_id,e.student_id,e.activity_id,e.object_key].map(q).join(',')},${e.byte_size},${q(e.mime_type)},${q(e.created_at)},${json(e.metadata)});`);
}
const response=e=>({recorded:true,durationSeconds:20,turns:0,criteria:[true,true,true,true],recordingEvidenceId:e.id});
const proof=(e,s=scope)=>api.issueSpeakingCompletionProof(s,e,response(e),config,proofServices);
const scopeSql=s=>[s.tenantId,s.studentId,s.activityId,s.versionId].map(q).join(',');
const consume=(e,p,s=scope)=>`select public.record_smart_textbook_speaking_attempt_v2(${scopeSql(s)},${json(response(e))},${q(e.id)},${json(s.runtimeBinding)},${json(p)});`;
const deletion=(e,s=scope,finalize=false)=>`select public.${finalize?'finalize':'claim'}_smart_textbook_recording_delete_v2(${scopeSql(s)},${q(e.id)},${json(s.runtimeBinding)});`;
const count=async()=>Number(await db.query('select count(*) from public.digital_textbook_attempts'));
async function rejects(sql,pattern=/RECORDING_/) {const r=await db.raw(service(sql));assert.notEqual(r.code,0);assert.match(r.stderr,pattern);assert.equal(await count(),0);}
function resign(p,patch) {const claims={...JSON.parse(p.payload),...patch},payload=api.canonicalRecordingJson(claims);return {...p,payload,signature:createHmac('sha256',secret).update(payload).digest('hex')};}
async function roleFixture() {
  await db.query(`update public.digital_textbook_activities set public_config='{"practiceKind":"dialogue_roleplay"}',counts_toward_completion=false;`);
  const s={...scope,runtimeBinding:{...binding,recordingKind:'roleplay-turn'}};
  const rows=[0,2].map((turn,i)=>evidence(200+i,{sceneId:scene.id,roleSide:'left',turnIndex:turn,runtimeBinding:s.runtimeBinding}));
  for(const e of rows)await insert(e);
  const proofs=await api.issueRoleplayCompletionProofs(s,rows,scene,'left',proofServices);
  const sql=`select public.complete_smart_textbook_roleplay_v2(${scopeSql(s)},'greeting','left',${json(proofs)},${json(s.runtimeBinding)});`;
  return {s,rows,proofs,sql};
}

test('4A-5 real SQL: R2 signed HEAD -> atomic speaking attempt/progress/consumption',async()=>{
  const e=evidence();await insert(e);const result=JSON.parse(await db.query(service(consume(e,await proof(e)))));
  assert.equal(result.attempt_number,1);assert.equal(result.node_completed,true);assert.equal(await count(),1);
  assert.equal(await db.query(`select metadata->>'lifecycle' from public.digital_textbook_speaking_evidence`),'consumed');
  assert.equal(await db.query('select score is null and is_correct is null from public.digital_textbook_attempts'),'t');
});
test('4A-5 real SQL: same speaking evidence parallel sessions create only one attempt',async()=>{
  const e=evidence();await insert(e);const sql=service(consume(e,await proof(e)));
  const results=await Promise.all([db.raw(sql),db.raw(sql)]);
  assert.equal(results.filter(r=>r.code===0).length,1);assert.equal(await count(),1);
  assert.equal(await db.query('select consumed_attempt_number from public.digital_textbook_speaking_evidence'),'1');
});
test('4A-5 real SQL: roleplay concurrent completion consumes all turns in one attempt',async()=>{
  const f=await roleFixture(),results=await Promise.all([db.raw(service(f.sql)),db.raw(service(f.sql))]);
  assert.equal(results.filter(r=>r.code===0).length,1);assert.match(results.find(r=>r.code).stderr,/ALREADY_COMPLETED/);assert.equal(await count(),1);
  assert.equal(await db.query('select count(*) from public.digital_textbook_speaking_evidence where consumed_attempt_number=1'),'2');
});

for(const role of [false,true])test(`4A-5 real SQL: ${role?'roleplay':'speaking'} failure after attempt insert rolls EVERYTHING back`,async()=>{
  const e=evidence();let sql;
  if(role)sql=(await roleFixture()).sql;else {await insert(e);sql=consume(e,await proof(e));}
  await db.query(`create function public.test_fail_consume() returns trigger language plpgsql as $$begin
    if new.consumed_at is not null ${role?`and new.id=${q(uuid(201))}`:''} then
      if not exists(select 1 from public.digital_textbook_attempts) then raise exception 'TEST_DID_NOT_REACH_ATTEMPT';end if;
      raise exception 'TEST_CONSUMPTION_FAILURE_AFTER_ATTEMPT';end if;return new;end$$;
    create trigger test_fail_consume before update on public.digital_textbook_speaking_evidence for each row execute function public.test_fail_consume();`);
  try{await rejects(sql,/TEST_CONSUMPTION_FAILURE_AFTER_ATTEMPT/);
    assert.equal(await db.query('select count(*) from public.digital_textbook_node_progress'),'0');
    assert.equal(await db.query('select count(*) from public.digital_textbook_speaking_evidence where consumed_at is not null'),'0');
  }finally{await db.query('drop trigger test_fail_consume on public.digital_textbook_speaking_evidence;drop function public.test_fail_consume();');}
});

for(const [name,patch] of [
  ['wrong evidence',{evidenceId:uuid(999)}],['wrong student',{studentId:uuid(999)}],['wrong tenant',{tenantId:uuid(999)}],
  ['wrong activity',{activityId:uuid(999)}],['wrong version',{versionId:uuid(999)}],['wrong snapshot',{runtimeBinding:{...binding,snapshot:'wrong'}}],
  ['wrong source revision',{runtimeBinding:{...binding,sourceRevision:'wrong'}}],['wrong size',{byteSize:8000}],['wrong MIME',{mimeType:'audio/ogg'}],
  ['object digest mismatch',{objectDigest:'0'.repeat(64)}],['metadata digest mismatch',{metadataDigest:'0'.repeat(64)}],['backend mismatch',{backend:'legacy-supabase'}],
  ['wrong purpose',{purpose:'roleplay-completion'}],['wrong response',{responseDigest:'0'.repeat(64)}],['unknown claim',{verified:true}],
  ['expired',{issuedAt:1000000000,expiresAt:1000000045}],['excess TTL',{issuedAt:Math.floor(Date.now()/1000)-1,expiresAt:Math.floor(Date.now()/1000)+3600}],
])test(`4A-5 real SQL proof rejects ${name}`,async()=>{const e=evidence();await insert(e);await rejects(consume(e,resign(await proof(e),patch)));});
test('4A-5 real SQL: fake proof signature rejected',async()=>{const e=evidence();await insert(e);await rejects(consume(e,{...await proof(e),signature:'0'.repeat(64)}));});
test('4A-5 real SQL: consumed proof replay cannot create another attempt',async()=>{
  const e=evidence();await insert(e);const p=await proof(e);await db.query(service(consume(e,p)));
  assert.notEqual((await db.raw(service(consume(e,p)))).code,0);assert.equal(await count(),1);
});
for(const field of ['tenantId','studentId','activityId','versionId'])test(`4A-5 real SQL scope rejects ${field}`,async()=>{
  const e=evidence();await insert(e);await rejects(consume(e,await proof(e),{...scope,[field]:uuid(999)}));
});
test('4A-5 real SQL scope: cannot omit Runtime binding or silently rebind historical evidence',async()=>{
  const e=evidence();await insert(e);await rejects(consume(e,await proof(e),{...scope,runtimeBinding:null}));
  await db.query(`update public.digital_textbook_speaking_evidence set metadata=metadata-'runtimeBinding'`);
  await rejects(consume(e,await proof(e)));
});
for(const [label,sql] of [
  ['expired evidence',"created_at=now()-interval '25 hours'"],['future evidence',"created_at=now()+interval '1 day'"],
  ['object path mismatch',"object_key='wrong/path'"],['unknown metadata',"metadata=metadata||'{\"unexpected\":true}'::jsonb"],
  ['delete-pending',"metadata=jsonb_set(metadata,'{lifecycle}','\"delete-pending\"')"],
])test(`4A-5 real SQL locked row rejects ${label}`,async()=>{
  const e=evidence();await insert(e);const p=await proof(e);await db.query(`update public.digital_textbook_speaking_evidence set ${sql}`);await rejects(consume(e,p));
});
test('4A-5 real SQL: legacy Storage remains explicit and checks storage.objects inside transaction',async()=>{
  const e=evidence(100,{});e.object_key=e.object_key.replace('student-recordings/','');const s={...scope,runtimeBinding:null};await insert(e);
  const p=await proof(e,s);await rejects(consume(e,p,s),/LEGACY_OBJECT_INVALID/);
  await db.query(`insert into storage.objects values('digital-textbook-student-recordings',${q(e.object_key)},'{"size":4096,"mimetype":"audio/webm"}')`);
  await db.query(service(consume(e,p,s)));assert.equal(await count(),1);
});
for(const mutation of ['scene','role','turn','missing','duplicate'])test(`4A-5 real SQL roleplay rejects ${mutation}`,async()=>{
  const f=await roleFixture();
  if(mutation==='missing')await db.query(`delete from public.digital_textbook_speaking_evidence where id=${q(f.rows[0].id)}`);
  else await db.query(`update public.digital_textbook_speaking_evidence set metadata=metadata||${json(mutation==='scene'?{sceneId:'wrong'}:mutation==='role'?{roleSide:'right'}:{turnIndex:mutation==='duplicate'?2:99})} where id=${q(f.rows[0].id)}`);
  await rejects(f.sql);
});

test('4A-5 real SQL: two delete claims idempotent; pending blocks consume; retry/finalize',async()=>{
  const e=evidence();await insert(e);const p=await proof(e);
  const r=await Promise.all([db.raw(service(deletion(e))),db.raw(service(deletion(e)))]);assert.ok(r.every(x=>x.code===0));
  await rejects(consume(e,p));assert.equal(JSON.parse(await db.query(service(deletion(e)))).state,'delete-pending');
  assert.equal(JSON.parse(await db.query(service(deletion(e,scope,true)))).state,'deleted');
  assert.equal(JSON.parse(await db.query(service(deletion(e,scope,true)))).state,'already-absent');
});
test('4A-5 real SQL: unclaimed finalize rejected',async()=>{const e=evidence();await insert(e);await rejects(deletion(e,scope,true));});
for(const label of ['explicit delete','re-record cleanup'])test(`4A-5 real SQL: concurrent consume versus ${label} mutually exclusive`,async()=>{
  const e=evidence();await insert(e);const p=await proof(e);
  const results=await Promise.all([db.raw(service(consume(e,p))),db.raw(service(deletion(e)))]);
  assert.equal(results.filter(r=>r.code===0).length,1);
  const state=await db.query("select metadata->>'lifecycle' from public.digital_textbook_speaking_evidence");
  assert.equal(await count(),state==='consumed'?1:0);assert.ok(['consumed','delete-pending'].includes(state));
});
test('4A-5 real SQL: consumed evidence cannot be claimed or finalized for deletion',async()=>{
  const e=evidence();await insert(e);await db.query(service(consume(e,await proof(e))));
  for(const finalize of [false,true])assert.notEqual((await db.raw(service(deletion(e,scope,finalize)))).code,0);
  assert.equal(await count(),1);
});
test('4A-5 real PostgreSQL: evidence FOR UPDATE genuinely blocks another session',async()=>{
  const e=evidence();await insert(e);
  const hold=db.raw(`set application_name='recording-4a5-row-lock';begin;select * from public.digital_textbook_speaking_evidence where id=${q(e.id)} for update;select pg_sleep(2);commit;`);
  // Observe the test transaction reaching pg_sleep before launching contention.
  let locked=false;
  for(let i=0;i<40;i++){if(await db.query("select count(*) from pg_stat_activity where application_name='recording-4a5-row-lock' and wait_event='PgSleep'")!=='0'){locked=true;break;}}
  assert.ok(locked);const blocked=await db.raw(service(`set lock_timeout='100ms';${deletion(e)}`));
  assert.notEqual(blocked.code,0);assert.match(blocked.stderr,/lock timeout/);assert.equal((await hold).code,0);
});
test('4A-5 migration security: no anon/authenticated RPC execution or keyring access; no public helper access',async()=>{
  const functions=await db.query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_smart_textbook_speaking_attempt_v2','complete_smart_textbook_roleplay_v2','claim_smart_textbook_recording_delete_v2','finalize_smart_textbook_recording_delete_v2') and p.prosecdef and p.proconfig @> array['search_path=\"\"']");
  assert.equal(functions,'4');
  for(const role of ['anon','authenticated','service_role'])assert.notEqual((await db.raw(`set role ${role};select * from recording_private.proof_keys`)).code,0);
  const e=evidence();await insert(e);const p=await proof(e);
  for(const role of ['anon','authenticated'])assert.notEqual((await db.raw(`set role ${role};set request.jwt.claim.role='service_role';${consume(e,p)}`)).code,0);
  assert.notEqual((await db.raw(`set role service_role;set request.jwt.claim.role='authenticated';${consume(e,p)}`)).code,0);
  assert.equal(await db.query("select count(*) from pg_proc where proname='record_smart_textbook_speaking_attempt'"),'1');
});

test('4A-5 real SQL: HMAC/canonical JSON interoperates for Korean, Chinese, escaped text and decimal metadata',async()=>{
  const f=await roleFixture();
  f.rows[0].metadata.transcript='你好\\n안녕 "quoted"';
  f.rows[0].metadata.transcriptSource='browser_speech_recognition';
  await db.query(`update public.digital_textbook_speaking_evidence set metadata=${json(f.rows[0].metadata)} where id=${q(f.rows[0].id)}`);
  const ps=await api.issueRoleplayCompletionProofs(f.s,f.rows,scene,'left',proofServices);
  await db.query(service(`select public.complete_smart_textbook_roleplay_v2(${scopeSql(f.s)},'greeting','left',${json(ps)},${json(f.s.runtimeBinding)})`));
  assert.equal(await count(),1);
  assert.equal(await db.query(`select recording_private.hash(${json({a:20.5,z:'你好',arr:[true,null,2]})})`),api.recordingDigest({a:20.5,z:'你好',arr:[true,null,2]}));
});
test('4A-5 real SQL: revoked signing key fails closed',async()=>{
  const e=evidence();await insert(e);const p=await proof(e);
  await db.query("update recording_private.proof_keys set enabled=false");
  try{await rejects(consume(e,p),/SIGNATURE/);}finally{await db.query("update recording_private.proof_keys set enabled=true");}
});

test('4A-5 migration: fresh second empty database also installs with pgcrypto in extensions',async()=>{
  const second=await isolatedRecordingPostgres(secret,{existingPgcrypto:false});
  try{
    assert.equal(await second.query("select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto'"),'extensions');
    assert.equal(await second.query(`select recording_private.hash(${json({a:'안녕',b:42.5})})`),api.recordingDigest({a:'안녕',b:42.5}));
  }finally{await second.stop();}
});
test('4A-5 backwards compatibility: actual old legacy speaking RPC still executes after migration',async()=>{
  const e=evidence(100,{});e.object_key=e.object_key.replace('student-recordings/','');await insert(e);
  await db.query(`insert into storage.objects values('digital-textbook-student-recordings',${q(e.object_key)},'{"size":4096,"mimetype":"audio/webm"}')`);
  await db.query(service(`select * from public.record_smart_textbook_speaking_attempt(${scopeSql(scope)},${json(response(e))},${q(e.id)})`));
  assert.equal(await count(),1);
});
test('4A-5 existing max attempts rule still rolls v2 evidence consumption back',async()=>{
  const e=evidence();await insert(e);const p=await proof(e);
  await db.query('update public.digital_textbook_activities set max_attempts=0');
  try{await rejects(consume(e,p),/MAX_ATTEMPTS_REACHED/);assert.equal(await db.query('select consumed_at is null from public.digital_textbook_speaking_evidence'),'t');}
  finally{await db.query('update public.digital_textbook_activities set max_attempts=20');}
});
for(const first of ['consume','delete'])test(`4A-5 real overlap: ${first} holds activity lock; competing transaction waits and conflicts`,async()=>{
  const e=evidence();await insert(e);const p=await proof(e);
  const consumeSql=consume(e,p),deleteSql=deletion(e);
  const firstSql=first==='consume'?consumeSql:deleteSql,secondSql=first==='consume'?deleteSql:consumeSql;
  const winner=db.raw(service(`set application_name='recording-4a5-winner';begin;${firstSql}select pg_sleep(1);commit;`));
  let sleeping=false;
  for(let i=0;i<30;i++){if(await db.query("select count(*) from pg_stat_activity where application_name='recording-4a5-winner' and wait_event='PgSleep'")!=='0'){sleeping=true;break;}}
  assert.ok(sleeping,'winner must be inside uncommitted transaction');
  const loser=db.raw(service(`set application_name='recording-4a5-loser';${secondSql}`));
  let waiting=false;
  for(let i=0;i<20;i++){if(await db.query("select count(*) from pg_stat_activity where application_name='recording-4a5-loser' and wait_event_type='Lock'")!=='0'){waiting=true;break;}}
  assert.ok(waiting,'second connection must actually contend, not merely execute sequentially');
  assert.equal((await winner).code,0);assert.notEqual((await loser).code,0);assert.equal(await count(),first==='consume'?1:0);
});

test('4A-5 real SQL + gateway: external delete failure persists pending; retry finalizes only after delete',async()=>{
  const e=evidence();await insert(e);let fail=true,externalCalls=0;
  const rpc=async name=>JSON.parse(await db.query(service(deletion(e,scope,name.startsWith('finalize')))));
  const storage={r2:async key=>{assert.equal(key,e.object_key);externalCalls++;if(fail)throw new Error('isolated DELETE failure');},legacy:async()=>{throw new Error('wrong backend');}};
  await assert.rejects(api.deleteRecordingV2(rpc,scope,e.id,storage),/isolated DELETE failure/);
  assert.equal(await db.query("select metadata->>'lifecycle' from public.digital_textbook_speaking_evidence"),'delete-pending');
  fail=false;await api.deleteRecordingV2(rpc,scope,e.id,storage);
  assert.equal(externalCalls,2);assert.equal(await db.query('select count(*) from public.digital_textbook_speaking_evidence'),'0');assert.equal(await count(),0);
});
for(const [label,m] of [
  ['roleplay missing storage',{sceneId:'greeting',roleSide:'left',turnIndex:0}],
  ['repeat missing storage',{practiceKey:'repeat-line',trackIndex:0,segmentIndex:0}],
  ['full recall missing storage',{practiceKey:'full-recall',trackIndex:1,segmentIndex:3}],
])test(`4A-5 real SQL: ${label} delete explicitly resolves R2`,async()=>{
  const e=evidence(100,m);await insert(e);const result=JSON.parse(await db.query(service(deletion(e,{...scope,runtimeBinding:null}))));
  assert.equal(result.backend,'r2');assert.equal(result.state,'delete-pending');
});
