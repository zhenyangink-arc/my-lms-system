import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {compiled,manifest,source} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const api=await serverModule('tests/fixtures/recording-4a8.server.ts');
const plans=compiled.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>api.recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
const speaking=plans.find(p=>p.kind==='speaking-introduction'),role=plans.find(p=>p.kind==='dialogue-roleplay'),recall=plans.find(p=>p.kind==='full-recall');
const signal=()=>new AbortController().signal,blob=()=>new Blob([new Uint8Array(4096)],{type:'audio/webm'});
const scope=(plan,slot)=>({capsuleRef:plan.capsuleRef,activityRef:plan.activityRef,target:slot.target});
function setup(t,limits){let now=1000;const store=api.createPreviewRecordingStore(()=>now,limits);t.after(()=>store.dispose());const auth={ownerId:'synthetic-owner',sessionId:randomUUID(),snapshotId:manifest.snapshot.id,revision:compiled.report.sourceRevision,expiresAt:1000000,plans};const services=store.services(async()=>auth);return {store,auth,services,tick:n=>{now=n;}};}
const complete=(id,criteria=speaking.criteria.slice(0,4).map(c=>c.id))=>({kind:'speaking-introduction',capsuleRef:speaking.capsuleRef,activityRef:speaking.activityRef,recordingId:id,criteriaIds:criteria});
test('4A8 real first chapter remains 8 Steps / 19 activities / orientation three / v23 legacy',()=>{
  assert.equal(manifest.steps.length,8);assert.equal(source.activities.length,19);assert.equal(source.activities.filter(a=>a.activity_key.startsWith('orientation')).length,3);
  assert.equal(source.teachingNodes.length,8);assert.equal(source.teachingNodes.filter(n=>n.configuration.teacherVideo).length,0);
});
test('4A8 actual speaking criteria/duration + two scenes, 14 frozen turns + two full recall tracks',()=>{
  assert.equal(speaking.requiredCriteria,4);assert.equal(speaking.slot.minimumSeconds,15);assert.equal(speaking.criteria.length,5);
  assert.deepEqual(role.scenes.map(s=>s.turns.length),[8,6]);assert.equal(recall.tracks.length,2);
  for(const plan of plans){const slots=plan.slot?[plan.slot]:plan.tracks??plan.scenes.flatMap(s=>s.turns);for(const slot of slots)assert.ok(manifest.runtimeTargets.some(t=>t.id===slot.target&&t.partId===slot.partId));}
});
test('4A8 frozen private coordinates, never public indices; ledger reorder is harmless',()=>{
  const bindings={...compiled.bindings,identities:[...compiled.bindings.identities].reverse()};
  for(const plan of plans)assert.deepEqual(api.recordingPlans(manifest,bindings,plan.capsuleRef,'zh-CN'),api.recordingPlans(manifest,compiled.bindings,plan.capsuleRef,'zh-CN'));
  assert.deepEqual(api.legacyRecordingCoordinates(bindings,role,role.scenes[1].turns[3].partId),{sceneId:'introduce-and-correct',roleSide:'right',turnIndex:'3'});
  assert.deepEqual(api.legacyRecordingCoordinates(bindings,recall,recall.tracks[1].partId),{practiceKey:'full-recall',trackIndex:'1',segmentIndex:'0'});
});
test('4A8 preview upload / byte playback / restore / replacement / delete',async t=>{
  const {services}=setup(t),s=scope(speaking,speaking.slot),a=await services.upload(s,blob(),16,signal());assert.match(a.id,/^preview-recording:/);
  assert.equal((await services.audio(s,a.id,signal())).size,4096);assert.equal((await services.restore(s.capsuleRef,s.activityRef,signal())).recordings[0].durationSeconds,16);
  const b=await services.upload(s,blob(),17,signal());assert.notEqual(a.id,b.id);await assert.rejects(services.audio(s,a.id,signal()));
  await services.remove(s,b.id,signal());assert.equal((await services.restore(s.capsuleRef,s.activityRef,signal())).recordings.length,0);
});
for(const [name,mutate]of [['owner',a=>a.ownerId='other'],['session',a=>a.sessionId=randomUUID()],['snapshot',a=>a.snapshotId='other'],['revision',a=>a.revision='other']])test(`4A8 ${name} isolation`,async t=>{
  const {services,auth}=setup(t),s=scope(speaking,speaking.slot),r=await services.upload(s,blob(),16,signal());mutate(auth);await assert.rejects(services.audio(s,r.id,signal()));await assert.rejects(services.complete(complete(r.id),signal()));
});
test('4A8 expiry sweep and revoked authorization reject restore/play',async t=>{
  const {services,tick}=setup(t),r=await services.upload(scope(speaking,speaking.slot),blob(),16,signal());tick(1000001);await assert.rejects(services.audio(scope(speaking,speaking.slot),r.id,signal()));
});
for(const [name,file,duration]of [['empty',new Blob([],{type:'audio/webm'}),16],['mime',new Blob([new Uint8Array(4096)],{type:'text/html'}),16],['short',blob(),2],['long',blob(),61],['nan',blob(),NaN]])test(`4A8 rejects ${name} recording`,async t=>{const {services}=setup(t);await assert.rejects(services.upload(scope(speaking,speaking.slot),file,duration,signal()));});
for(const [name,limits]of [['file',{fileBytes:2048,totalBytes:99999,sessionBytes:99999,entries:20}],['total',{fileBytes:99999,totalBytes:2048,sessionBytes:99999,entries:20}],['session',{fileBytes:99999,totalBytes:99999,sessionBytes:2048,entries:20}],['count',{fileBytes:99999,totalBytes:99999,sessionBytes:99999,entries:0}]])test(`4A8 ${name} capacity is enforced`,async t=>{const {services}=setup(t,limits);await assert.rejects(services.upload(scope(speaking,speaking.slot),blob(),16,signal()));});
test('4A8 speaking uses original unscored grader; criteria reject/accept/duplicate; no formal progress',async t=>{
  const {services}=setup(t),s=scope(speaking,speaking.slot),r=await services.upload(s,blob(),16,signal());
  await assert.rejects(services.complete(complete(r.id,speaking.criteria.slice(0,3).map(c=>c.id)),signal()));
  const results=await Promise.all([services.complete(complete(r.id),signal()),services.complete(complete(r.id),signal())]);
  assert.deepEqual(results.map(r=>r.status),['preview-accepted','already-completed']);for(const r of results){assert.equal(r.formalCompletion,false);assert.equal(r.score,null);assert.equal(r.correct,null);assert.equal(r.progressDelta,null);}
  assert.equal((await services.restore(s.capsuleRef,s.activityRef,signal())).completion,'preview-accepted');
  await services.upload(s,blob(),16,signal());assert.equal((await services.restore(s.capsuleRef,s.activityRef,signal())).completion,'none');
});
for(const side of ['left','right'])for(const scene of role.scenes)test(`4A8 role ${side} / ${scene.id}: all required evidence, restore midway, retry, duplicate`,async t=>{
  const {services}=setup(t),input={kind:role.kind,capsuleRef:role.capsuleRef,activityRef:role.activityRef,sceneId:scene.id,side};
  const required=scene.turns.filter(turn=>turn.side===side);
  for(const turn of required){await assert.rejects(services.complete(input,signal()));await services.upload(scope(role,turn),blob(),2,signal());}
  const state=await services.restore(role.capsuleRef,role.activityRef,signal());assert.equal(state.recordings.length,required.length);
  const r=await services.complete(input,signal());assert.equal(r.formalCompletion,false);assert.equal((await services.complete(input,signal())).status,'already-completed');
  await services.remove(scope(role,required[0]),state.recordings[0].id,signal());await assert.rejects(services.complete(input,signal()));
  await services.upload(scope(role,required[0]),blob(),2,signal());assert.equal((await services.complete(input,signal())).status,'preview-accepted');
});
test('4A8 full recall shares recording port but cannot satisfy speaking or role completion',async t=>{
  const {services}=setup(t),r=await services.upload(scope(recall,recall.tracks[0]),blob(),2,signal());await assert.rejects(services.complete(complete(r.id),signal()));
  assert.equal((await services.restore(recall.capsuleRef,recall.activityRef,signal())).completion,'none');
});
for(const field of ['tenantId','studentId','objectKey','proof','score','completion','mode','trackIndex','segmentIndex'])test(`4A8 private/index injection ${field} rejected`,async t=>{const {services}=setup(t);await assert.rejects(services.upload({...scope(speaking,speaking.slot),[field]:'injected'},blob(),16,signal()));});
test('4A8 cross activity/target rejects bytes and deletion; aborted operation cannot persist',async t=>{
  const {services}=setup(t),r=await services.upload(scope(speaking,speaking.slot),blob(),16,signal());for(const op of ['audio','remove'])await assert.rejects(services[op](scope(role,role.scenes[0].turns[0]),r.id,signal()));
  const c=new AbortController();c.abort();await assert.rejects(services.upload(scope(speaking,speaking.slot),blob(),16,c.signal));
});
test('4A8 public plans/results have no secrets, coordinates or storage URLs; no new production importer',async t=>{
  const {services}=setup(t),r=await services.upload(scope(speaking,speaking.slot),blob(),16,signal()),payload=JSON.stringify([plans,r,await services.restore(speaking.capsuleRef,speaking.activityRef,signal())]);
  for(const forbidden of ['objectKey','object_key','tenantId','studentId','proof','service_role','answer_key','signedUrl','trackIndex','turnIndex'])assert.ok(!payload.includes(forbidden),forbidden);
  assert.ok(!readFileSync('src/features/smart-textbook-runtime/components/recording-executor.tsx','utf8').includes('serverConfirmedCompletion'));
  assert.ok(!readFileSync('src/features/smart-textbook-runtime/server/audit-recording.server.ts','utf8').includes('productionRecordingServices'));
});
test('4A8 actual audit reload continuation: same owner/snapshot/revision, fixed TTL; new teacher generation',async()=>{
  const sessions=await serverModule('src/features/smart-textbook-runtime/server/audit-session.server.ts'),data={source,result:compiled};
  const first=sessions.createRecordingAuditContinuation('owner-a',data),original=sessions.auditSession('owner-a',first);original.generation=9;original.revokedThrough=8;
  const next=sessions.createRecordingAuditContinuation('owner-a',data,first),resumed=sessions.auditSession('owner-a',next);
  assert.notEqual(first,next);assert.deepEqual(resumed.recordingScope,original.recordingScope);assert.equal(resumed.generation,-1);assert.equal(resumed.revokedThrough,-1);assert.equal(resumed.tts,undefined);
  assert.throws(()=>sessions.createRecordingAuditContinuation('owner-b',data,first));
  const changed=structuredClone(data);changed.result.report.sourceRevision='other';assert.throws(()=>sessions.createRecordingAuditContinuation('owner-a',changed,first));
  const other=sessions.createRecordingAuditContinuation('owner-a',data);assert.notDeepEqual(sessions.auditSession('owner-a',other).recordingScope,original.recordingScope);
  original.expiresAt=0;assert.throws(()=>sessions.createRecordingAuditContinuation('owner-a',data,first));
});
