import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes,randomUUID } from 'node:crypto';
import { serverModule } from './fixtures/runtime-4a2.server.mjs';
import { source,manifest,compiled } from './fixtures/runtime-4a.mjs';
import {historyDb} from './fixtures/history-db.mjs';
import { isolatedRecordingPostgres,literal as q,json,service } from './fixtures/recording-v2-postgres.mjs';
import { installRecordingWriteChain,readMigration } from './fixtures/recording-4a7-schema.mjs';
import { recordingSqlTransport } from './fixtures/recording-4a7-transport.mjs';

const mockR2=`export async function checkR2ObjectExists(k){return globalThis.__r7Objects.head(k);}
export async function createR2SignedUploadUrl(k,m,s){globalThis.__r7Objects.pending.set(k,{mime:m,size:s});return 'https://recording-isolated.invalid/'+encodeURIComponent(k);}
export async function createR2SignedObjectUrl(k){return 'https://recording-isolated.invalid/'+encodeURIComponent(k);}
export async function deleteR2Object(k){return globalThis.__r7Objects.remove(k);}
export async function assertR2ObjectUpload(k,s){const r=await checkR2ObjectExists(k);if(!r.exists||r.size!==s)throw Error('isolated upload missing');}`;
const api=await serverModule('tests/fixtures/recording-4a7-entry.ts',{
  'next/server':'export class NextResponse extends Response { static json(body,init){return Response.json(body,init);} }',
  '@/lib/auth':'export async function requireActiveUser(){return globalThis.__r7Auth;}',
  '@/lib/admin':'export function isPlatformCourseAuditorRole(r){return r==="platform_owner";}',
  '@/lib/supabase/admin':'export function createAdminClient(){return globalThis.__r7Auth.supabase;}',
  '@/lib/student-permissions':'export function canUseStudentFeature(){return true;}export function normalizeMembershipTier(){return "isolated";}',
  '@/features/student-home-learning/api/refresh':'export function refreshStudentHomeLearningData(){}',
  './r2':mockR2,'@/lib/r2':mockR2,
});
const tenant=randomUUID(),student=randomUUID(),other=randomUUID(),app=randomUUID(),testId=randomUUID();
const speaking=source.activities.find(a=>a.activity_key==='speaking-introduction');
const role=source.activities.find(a=>a.activity_key==='dialogue-roleplay');
const scene=source.nodes.find(n=>n.id===role.node_id).content.dialogueScenes[0];
const auditLearner=randomUUID();
const owner={tenantId:tenant,studentId:student},cohort=[owner,{tenantId:tenant,studentId:auditLearner}];
const env=(epoch=1,enabled=false,instance='app-a')=>({RECORDING_EVIDENCE_V2_ENABLED:String(enabled),RECORDING_EVIDENCE_V2_EPOCH:String(epoch),RECORDING_EVIDENCE_INSTANCE_ID:instance,RECORDING_EVIDENCE_V2_SCOPE:JSON.stringify(cohort)});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('4A-7 isolated release rehearsal: real PostgreSQL write chain, two instances, no external storage',{timeout:180000},async t=>{
  const savedEnv={...process.env},savedFetch=globalThis.fetch,secret=randomBytes(32);let db,admin;
  const objects=new Map(),pending=new Map(),legacy=new Map();let holdPut=null,holdDelete=null,failDelete=false,failPut=false,unknownPut=false,wrongHead=false;
  const fake={objects,pending,head:async k=>({exists:objects.has(k),size:wrongHead?7:objects.get(k)?.size,contentType:objects.get(k)?.mime}),
    remove:async k=>{if(holdDelete){holdDelete.entered.resolve();await holdDelete.release.promise;}if(failDelete)throw Error('isolated delete failed');objects.delete(k);}};
  globalThis.__r7Objects=fake;
  globalThis.fetch=async(url,init={})=>{
    const u=new URL(url);assert.equal(u.origin,'https://recording-isolated.invalid','NO real network allowed');const k=decodeURIComponent(u.pathname.slice(1));
    if(init.method==='PUT'){
      if(unknownPut)throw Error('isolated uncertain PUT transport failure');
      if(holdPut){holdPut.entered.resolve();await holdPut.release.promise;}
      if(failPut)return new Response(null,{status:503});
      const meta=pending.get(k);assert.ok(meta);objects.set(k,{size:init.body.byteLength,mime:meta.mime});return new Response(null,{status:200});
    }
    const m=objects.get(k)||legacy.get(k);return new Response(m?new Uint8Array(m.size):null,{status:m?200:404,headers:{'Content-Type':m?.mime??'audio/webm'}});
  };
  const storage=()=>({
    async list(prefix,{search}){const m=legacy.get(`${prefix}/${search}`);return {data:m?[{name:search,metadata:{size:m.size,mimetype:m.mime}}]:[],error:null};},
    async createSignedUrl(k){return {data:{signedUrl:'https://recording-isolated.invalid/'+encodeURIComponent(k)},error:null};},
    async remove(keys){keys.forEach(k=>legacy.delete(k));return {error:null};},
    async upload(k,bytes,{contentType}){legacy.set(k,{size:bytes.byteLength,mime:contentType});return {error:null};},
  });
  const setEnv=e=>{for(const k of Object.keys(process.env))if(k.startsWith('RECORDING_EVIDENCE_'))delete process.env[k];Object.assign(process.env,e);};
  const form=(fields={})=>{const f=new FormData();f.set('recording',new Blob([new Uint8Array(4096)],{type:'audio/webm'}),'isolated.webm');f.set('durationSeconds','20');Object.entries(fields).forEach(([k,v])=>f.set(k,String(v)));return f;};
  const route=(method,activity=speaking.id,{fields={},query=''}={})=>api[method](new Request('https://recording-isolated.invalid/recording'+query,{method,...(method==='POST'?{body:form(fields)}:{})}),{params:Promise.resolve({activityId:activity})});
  const upload=async(activity=speaking.id,fields={})=>{const r=await route('POST',activity,{fields});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();};
  const submit=id=>api.submitSmartTextbookActivityForContext({activityId:speaking.id,locale:'zh-CN',response:{recorded:true,durationSeconds:20,criteria:[true,true,true,true],turns:0,recordingEvidenceId:id}},
    {admin,supabase:admin,userId:student,tenantId:tenant,canSubmit:true,preview:false});
  const rows=async(sql)=>JSON.parse(await db.query(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${sql})r`));
  const count=async(table)=>Number(await db.query(`select count(*) from public.${table}`));
  const control=async(operation,epoch,enabled=false,selected=cohort)=>db.query(`select recording_private.transition_domain(${q(operation)},${epoch},${enabled},${json(selected)});`);
  const switchDomain=async(epoch,enabled)=>{await control('drain',epoch-1);await control('fence',epoch-1);await db.query(`update recording_private.domain_instances set acknowledged_epoch=${epoch}`);await control('switch',epoch,enabled);await control('open',epoch);setEnv({...env(epoch,enabled),RECORDING_EVIDENCE_PROOF_KEY_ID:'isolated',RECORDING_EVIDENCE_PROOF_SECRET_HEX:secret.toString('hex')});};
  try{
    setEnv({});
    db=await isolatedRecordingPostgres(secret,{beforeV2:async isolated=>{
      await installRecordingWriteChain(isolated);
      await isolated.query(`insert into public.tenants values(${q(tenant)});insert into auth.users values(${q(student)}),(${q(other)});insert into public.profiles values(${q(student)}),(${q(other)});
        insert into public.student_applications values(${q(app)});insert into public.digital_textbook_versions values(${q(manifest.version.id)});
        insert into public.chapter_tests values(${q(testId)},'isolated-chapter-test',${q(app)},'published');
        insert into public.digital_textbook_chapters values(${q(manifest.chapter.id)},${q(manifest.version.id)},${q(testId)});`);
      for(const m of source.modules)await isolated.query(`insert into public.digital_textbook_modules values(${q(m.id)},${q(manifest.chapter.id)});`);
      for(const n of source.nodes)await isolated.query(`insert into public.digital_textbook_nodes values(${q(n.id)},${q(n.module_id)},${json(n.content)});`);
      for(const a of source.activities)await isolated.query(`insert into public.digital_textbook_activities values(${q(a.id)},${q(a.node_id)},${q(a.activity_type)},100,${a.counts_toward_completion!==false},${json(a.public_config)});
        insert into public.digital_textbook_activity_secrets values(${q(a.id)},'{"kind":"open"}','{"zh-CN":"隔离测试反馈"}');`);
      admin=recordingSqlTransport(isolated,storage);globalThis.__r7Auth={supabase:admin,user:{id:student},tenant:{id:tenant},profile:{role:'student'},platformProfile:{role:'student'}};
      const id=randomUUID(),key=`${tenant}/${student}/${speaking.id}/${id}.webm`;legacy.set(key,{size:4096,mime:'audio/webm'});
      await isolated.query(`insert into public.digital_textbook_speaking_evidence(id,tenant_id,student_id,activity_id,object_key,byte_size,mime_type) values(${q(id)},${q(tenant)},${q(student)},${q(speaking.id)},${q(key)},4096,'audio/webm');
        insert into storage.objects values('digital-textbook-student-recordings',${q(key)},'{"size":4096,"mimetype":"audio/webm"}');`);
      const baseline=await submit(id);assert.equal(baseline.ok,true,`v1 baseline: ${JSON.stringify(baseline)}; ${admin.log.join('\n')}`);
      assert.equal(await isolated.query('select count(*) from public.digital_textbook_attempts'),'1');
    }});
    // The real old RPCs and 4A5 migration are now installed; add shared fence.
    await db.query(readMigration('202609090002_recording_domain_coordination.sql'));
    await db.query("insert into recording_private.domain_instances values('app-a',1),('app-b',1)");
    await control('open',1);setEnv(env());
    await t.test('real SQL coordinator ACL/search_path: application cannot operate control tables or operator transition; anonymous cannot enter',async()=>{
      assert.notEqual((await db.raw(service('select * from recording_private.domain_control;'))).code,0);
      assert.notEqual((await db.raw(service("select recording_private.transition_domain('drain',1);"))).code,0);
      const args=[q('enter'),q(randomUUID()),q('app-a'),'1',q(tenant),q(student),q('v1')].join(',');
      assert.notEqual((await db.raw(`set role anon;set request.jwt.claim.role='anon';select public.recording_domain_request_v1(${args});`)).code,0);
      assert.equal(await db.query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('recording_domain_request_v1','recording_domain_upload_v1') and p.prosecdef and array_to_string(p.proconfig,',')='search_path=\"\"'"),'2');
    });
    await t.test('gate=false release: old UI shape, legacy branch, new coordinator checks/release',async()=>{
      const r=await upload();assert.ok(r.evidenceId);assert.equal(await db.query('select count(*) from recording_private.domain_requests'),'0');
      assert.equal((await rows(`select metadata from public.digital_textbook_speaking_evidence where id=${q(r.evidenceId)}`))[0].metadata.lifecycle,undefined);
    });
    await t.test('two instances: drain blocks new entry; admitted work finishes; no fence/epoch switch while lease active',async()=>{
      const entered=deferred(),release=deferred();let old;
      const request=api.withRecordingDomain(admin,owner,async ctx=>{old=ctx;entered.resolve();await release.promise;await ctx.beforeWrite();},env(1,false,'app-a'));
      await entered.promise;await control('drain',1);
      await assert.rejects(api.withRecordingDomain(admin,owner,async()=>{},env(1,false,'app-b')),/fenced/);
      await assert.rejects(control('fence',1),/NOT_DRAINED/);
      release.resolve();await request;await control('fence',1);
      await db.query("update recording_private.domain_instances set acknowledged_epoch=2 where id='app-a'");
      await assert.rejects(control('switch',2,true),/NOT_ACKNOWLEDGED/);
      await db.query("update recording_private.domain_instances set acknowledged_epoch=2 where id='app-b'");
      await control('switch',2,true);await control('open',2);
      await assert.rejects(old.beforeWrite(),/fenced/);
      await assert.rejects(api.withRecordingDomain(admin,owner,async()=>{},env(1,false,'app-b')),/fenced/);
      setEnv({...env(2,true),RECORDING_EVIDENCE_PROOF_KEY_ID:'isolated',RECORDING_EVIDENCE_PROOF_SECRET_HEX:secret.toString('hex')});
    });
    let recording;
    await t.test('v2 old UI POST -> real row with frozen binding -> HEAD -> GET/restore; no object identity in response',async()=>{
      recording=await upload();
      assert.ok(!JSON.stringify(recording).includes('object'));
      const row=(await rows(`select * from public.digital_textbook_speaking_evidence where id=${q(recording.evidenceId)}`))[0];
      assert.equal(row.metadata.storage,'r2');assert.equal(row.metadata.lifecycle,'active');assert.equal(row.metadata.runtimeBinding.versionId,manifest.version.id);
      const get=await route('GET',speaking.id,{query:`?evidenceId=${recording.evidenceId}`});assert.equal(get.status,200);assert.equal((await get.arrayBuffer()).byteLength,4096);
      const restore=await route('GET');assert.equal((await restore.json()).recording.evidenceId,recording.evidenceId);
    });
    await t.test('non-qualified attempt uses R2 verifier and shared lease; no consumption or score',async()=>{
      const result=await api.submitSmartTextbookActivityForContext({activityId:speaking.id,locale:'zh-CN',response:{recorded:true,durationSeconds:20,criteria:[true],turns:0,recordingEvidenceId:recording.evidenceId}},
        {admin,supabase:admin,userId:student,tenantId:tenant,canSubmit:true,preview:false});
      assert.equal(result.ok,true);assert.equal(result.score,null);assert.equal(result.correct,null);
      assert.equal((await rows(`select consumed_at from public.digital_textbook_speaking_evidence where id=${q(recording.evidenceId)}`))[0].consumed_at,null);
    });
    await t.test('v2 legacy Storage historical consumed/expired recording remains playable; full recall uses R2 lifecycle without formal attempt',async()=>{
      const old=(await rows("select id from public.digital_textbook_speaking_evidence where metadata='{}'::jsonb"))[0];
      await db.query(`update public.digital_textbook_speaking_evidence set created_at=now()-interval '30 days' where id=${q(old.id)}`);
      assert.equal((await route('GET',speaking.id,{query:`?evidenceId=${old.id}`})).status,200);
      assert.equal((await submit(old.id)).ok,false);
      const before=await count('digital_textbook_attempts');
      const repeat=await upload(speaking.id,{practiceKey:'full-recall',trackIndex:1,segmentIndex:0});
      const restored=await route('GET',speaking.id,{query:'?practiceKey=full-recall&trackIndex=1&segmentIndex=0'});
      assert.equal((await restored.json()).recording.evidenceId,repeat.evidenceId);
      assert.equal((await route('DELETE',speaking.id,{query:`?evidenceId=${repeat.evidenceId}`})).status,200);
      assert.equal(await count('digital_textbook_attempts'),before);
    });
    await t.test('real qualified speaking concurrent callers produce one attempt; duplicate evidence cannot consume twice',async()=>{
      const before=await count('digital_textbook_attempts');const results=await Promise.all([submit(recording.evidenceId),submit(recording.evidenceId)]);
      assert.equal(results.filter(r=>r.ok).length,1);assert.equal(await count('digital_textbook_attempts'),before+1);
      assert.equal((await route('GET',speaking.id,{query:`?evidenceId=${recording.evidenceId}`})).status,200,'consumed playback allowed');
      assert.equal((await route('DELETE',speaking.id,{query:`?evidenceId=${recording.evidenceId}`})).status,409);
    });
    await t.test('real roleplay old forms -> required turn proof set -> parallel atomic completion; mount retry is trusted read',async()=>{
      for(let turn=0;turn<scene.lines.length;turn+=2)await upload(role.id,{sceneId:scene.id,roleSide:'left',turnIndex:turn});
      const before=await count('digital_textbook_attempts'),input={activityId:role.id,sceneId:scene.id,roleSide:'left'};
      const results=await Promise.all([api.completeDialogueRoleplayAction(input),api.completeDialogueRoleplayAction(input)]);
      assert.ok(results.every(r=>r.ok),JSON.stringify(results));assert.equal(await count('digital_textbook_attempts'),before+1);
      assert.equal((await api.completeDialogueRoleplayAction(input)).ok,true);assert.equal(await count('digital_textbook_attempts'),before+1);
      const consumed=await rows(`select consumed_attempt_number from public.digital_textbook_speaking_evidence where activity_id=${q(role.id)}`);
      assert.ok(consumed.every(r=>r.consumed_attempt_number===1));
    });
    await t.test('4A12 mounted Chromium recording → real v2 SQL → Reader → same Runtime state and reload',async()=>{
      const learner=auditLearner;await db.query(`insert into auth.users values(${q(learner)});insert into public.profiles values(${q(learner)});`);
      const previousScope=process.env.RECORDING_EVIDENCE_V2_SCOPE;
      process.env.RECORDING_EVIDENCE_V2_SCOPE=JSON.stringify(cohort);
      try{
        const plans=compiled.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>api.recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
        const domainRevisions=new Map();for(const ref of new Set(plans.map(p=>p.activityRef)))domainRevisions.set(ref,(await api.recordingActivityBinding(admin,ref)).sourceRevision);
        const authority={admin,owner:{tenantId:tenant,studentId:learner},sessionId:`learning-session-${learner}`,snapshotId:manifest.snapshot.id,sourceRevision:compiled.report.sourceRevision,versionId:manifest.version.id,trackingDisabled:false,plans,bindings:compiled.bindings,domainRevisions};
        const recordingPort=api.productionRecordingServices(async()=>authority,{sessionId:authority.sessionId,snapshotId:authority.snapshotId}),signal=new AbortController().signal;
        const {createLearningHistoryReader}=await import('../src/features/smart-textbook-runtime/server/learning-history.server.ts');
        const refresh=async()=>{
          // A fresh SELECT of real isolated SQL rows on every refresh. The
          // PostgREST transport adapter only supplies filtering/pagination, never
          // fabricates attempts, evidence or node completion.
          const tables={};for(const name of ['digital_textbook_attempts','digital_textbook_node_progress'])tables[name]=await rows(`select * from public.${name} where tenant_id=${q(tenant)} and student_id=${q(learner)}`);
          // This newly-created isolated learner has no page/repeat writes;
          // those unrelated tables are not installed in the recording harness.
          tables.digital_textbook_activity_page_progress=[];tables.digital_textbook_guided_repeat_progress=[];
          return createLearningHistoryReader(async()=>({db:historyDb(tables),manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,
            scope:{authorized:true,actorId:learner,tenantId:tenant,versionId:manifest.version.id,sourceRevision:compiled.report.sourceRevision},locale:'zh-CN',sessionId:authority.sessionId,snapshotId:manifest.snapshot.id,recording:recordingPort}),{sessionId:authority.sessionId,snapshotId:manifest.snapshot.id})(signal);
        };
        const before=await refresh();assert.equal(before.server.attempts.length,0);assert.equal(before.server.completedStepIds.length,0);
        const {mountedRecordingIntegration}=await import('./fixtures/mounted-recording-4a12.mjs');
        const witness=await mountedRecordingIntegration({recording:recordingPort,refresh,authority});
        assert.equal(witness.mountedRecording,true);assert.equal(witness.reload,true);
        assert.equal((await refresh()).server.attempts.length,2);
      }finally{process.env.RECORDING_EVIDENCE_V2_SCOPE=previousScope;}
    });
    await t.test('late upload holds lease through HEAD and cleanup; drain cannot switch beneath external PUT',async()=>{
      holdPut={entered:deferred(),release:deferred()};const post=route('POST');await holdPut.entered.promise;
      const uploading=await db.query('select uploading_evidence_id from recording_private.domain_requests where uploading_evidence_id is not null');
      assert.equal((await route('DELETE',speaking.id,{query:`?evidenceId=${uploading}`})).status,409,'in-flight PUT identity cannot be deleted');
      assert.equal((await route('GET',speaking.id,{query:`?evidenceId=${uploading}`})).status,409,'in-flight upload not restored as ready');
      await control('drain',2);await assert.rejects(control('fence',2),/NOT_DRAINED/);
      holdPut.release.resolve();const r=await post;holdPut=null;assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
      await control('fence',2);await control('open',2);
    });
    await t.test('failed DELETE durable pending + retry; failed PUT compensation is claimed, no phantom successful upload',async()=>{
      const r=await upload();failDelete=true;
      assert.equal((await route('DELETE',speaking.id,{query:`?evidenceId=${r.evidenceId}`})).status,503);
      assert.equal((await rows(`select metadata from public.digital_textbook_speaking_evidence where id=${q(r.evidenceId)}`))[0].metadata.lifecycle,'delete-pending');
      assert.equal((await route('GET',speaking.id,{query:`?evidenceId=${r.evidenceId}`})).status,409);
      failDelete=false;assert.equal((await route('DELETE',speaking.id,{query:`?evidenceId=${r.evidenceId}`})).status,200);
      const before=await count('digital_textbook_speaking_evidence');failPut=true;
      assert.equal((await route('POST')).status,503);failPut=false;assert.equal(await count('digital_textbook_speaking_evidence'),before);
    });
    await t.test('late re-record cleanup remains in drain; explicit delete races use same lifecycle gateway',async()=>{
      const r=await upload();holdDelete={entered:deferred(),release:deferred()};const post=route('POST');await holdDelete.entered.promise;
      await control('drain',2);await assert.rejects(control('fence',2),/NOT_DRAINED/);
      holdDelete.release.resolve();const response=await post;holdDelete=null;assert.equal(response.status,200);
      await control('fence',2);await control('open',2);
      assert.equal((await rows(`select id from public.digital_textbook_speaking_evidence where id=${q(r.evidenceId)}`)).length,0);
    });
    await t.test('HEAD wrong size rejected and compensation removes row; forbidden client metadata fails before insert',async()=>{
      const before=await count('digital_textbook_speaking_evidence');wrongHead=true;assert.equal((await route('POST')).status,503);wrongHead=false;
      assert.equal(await count('digital_textbook_speaking_evidence'),before);
      for(const field of ['backend','objectKey','runtimeBinding','lifecycle','tenantId','studentId','score','completion'])assert.equal((await route('POST',speaking.id,{fields:{[field]:'attacker'}})).status,400);
    });
    await t.test('key provider + SQL keyring: missing/wrong/rotated/disabled; never produce attempt for rejected proofs',async()=>{
      const r=await upload(),before=await count('digital_textbook_attempts');delete process.env.RECORDING_EVIDENCE_PROOF_SECRET_HEX;
      assert.equal((await submit(r.evidenceId)).ok,false);
      process.env.RECORDING_EVIDENCE_PROOF_SECRET_HEX=randomBytes(32).toString('hex');assert.equal((await submit(r.evidenceId)).ok,false);
      const rotated=randomBytes(32);await db.query(`insert into recording_private.proof_keys values('rotated',decode(${q(rotated.toString('hex'))},'hex'),true)`);
      process.env.RECORDING_EVIDENCE_PROOF_KEY_ID='rotated';process.env.RECORDING_EVIDENCE_PROOF_SECRET_HEX=rotated.toString('hex');
      await db.query("update recording_private.proof_keys set enabled=false where id='rotated'");assert.equal((await submit(r.evidenceId)).ok,false);
      assert.equal(await count('digital_textbook_attempts'),before);
      await db.query("update recording_private.proof_keys set enabled=true where id='rotated'");assert.equal((await submit(r.evidenceId)).ok,true);
    });
    await t.test('real chapter completion downstream: eight node completion + required activities -> ebook test unlock',async()=>{
      for(const a of source.activities)await db.query(service(`select public.record_smart_textbook_attempt(${q(tenant)},${q(student)},${q(a.id)},${q(manifest.version.id)},'{}',${['speaking','writing','self_check'].includes(a.activity_type)?'null,null,true':'true,100'});`));
      assert.equal(await db.query(`select count(*) from public.digital_textbook_node_progress where status='completed'`),'8');
      assert.equal(await db.query('select progress_percent from public.course_ebook_progress'),'100');
      assert.equal(await db.query('select completion_source from public.course_ebook_progress'),'smart_textbook');
      assert.equal(await count('digital_textbook_activities'),19);
    });
    await t.test('rollback rehearsal: gate=false does not grant legacy access to runtime-bound/consumed state; unaffected learner stays v1',async()=>{
      await switchDomain(3,false);
      await assert.rejects(api.withRecordingDomain(admin,owner,async()=>{throw Error('MUST NOT ENTER');},env(3,false)),/fenced/);
      assert.equal((await route('POST')).status,503);
      assert.equal(await api.withRecordingDomain(admin,{tenantId:tenant,studentId:other},async r=>{await r.beforeWrite();return r.domain;},env(3,false)),'v1');
      assert.equal(await db.query('select count(*) from recording_private.domain_requests'),'0');
    });
    await t.test('uncertain PUT strands its shared reservation; no automatic lease expiry or unsafe cutover',async()=>{
      await switchDomain(4,true);unknownPut=true;
      assert.equal((await route('POST')).status,503);unknownPut=false;
      assert.equal(await db.query('select count(*) from recording_private.domain_requests where uploading_evidence_id is not null'),'1');
      await control('drain',4);await assert.rejects(control('fence',4),/NOT_DRAINED/);
    });
  } finally {
    if(db)await db.stop();globalThis.fetch=savedFetch;delete globalThis.__r7Objects;delete globalThis.__r7Auth;
    for(const k of Object.keys(process.env))if(k.startsWith('RECORDING_EVIDENCE_'))delete process.env[k];
    for(const [k,v] of Object.entries(savedEnv))if(k.startsWith('RECORDING_EVIDENCE_'))process.env[k]=v;
  }
});
