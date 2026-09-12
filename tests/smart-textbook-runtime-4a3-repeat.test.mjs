import assert from 'node:assert/strict';
import test from 'node:test';
import {compiled,manifest} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const {repeatLesson,readGuidedRepeatHistory,saveBoundGuidedRepeat,createPreviewRepeatStore,repeatState}=await import('../src/features/smart-textbook-runtime/server/guided-repeat.server.ts');
import {acceptRepeatState} from '../src/features/smart-textbook-runtime/core/guided-repeat.ts';
import {playRepeatLine} from '../src/features/smart-textbook-runtime/core/repeat-playback.ts';
const capsule=compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.sections.some(s=>s.slot==='repeatTracks'));
const lesson=repeatLesson(manifest,compiled.bindings,compiled.services,capsule.id,'zh-CN');
const scope={sourceRevision:compiled.services.sourceRevision,versionId:manifest.version.id,authorized:true,actorId:'synthetic-student',tenantId:'synthetic-tenant'};
test('repeat public DTO: 2 tracks / 14 segments, every frozen target, no private fields or legacy indexes',()=>{
  assert.equal(lesson.tracks.length,2);assert.deepEqual(lesson.tracks.map(t=>t.segments.length),[6,8]);
  assert.deepEqual(lesson.tracks.flatMap(t=>t.segments.map(s=>s.id)).sort(),compiled.services.guidedRepeat.map(r=>r.segmentId).sort());
  assert.doesNotMatch(JSON.stringify(lesson),/object_key|objectKey|answer_key|studentId|tenantId|trackIndex|segmentIndex|legacyTrack|service_role/);
  for(const t of lesson.tracks)for(const s of t.segments)assert.ok(manifest.runtimeTargets.some(r=>r.id===s.target&&r.partId===s.id));
});
test('frozen registry reorder changes neither identity nor public DTO; content change fails fingerprint',()=>{
  const b=structuredClone(compiled.bindings),s=structuredClone(compiled.services);b.identities.reverse();s.guidedRepeat.reverse();
  assert.deepEqual(repeatLesson(manifest,b,s,capsule.id,'zh-CN'),lesson);
  b.capsules.find(c=>c.id===capsule.id).sections.find(s=>s.slot==='repeatTracks').body[0].lines.reverse();
  assert.throws(()=>repeatLesson(manifest,b,s,capsule.id,'zh-CN'),/REPEAT_FROZEN_SEGMENT/);
});
test('missing / duplicate mapping, wrong activity/version and missing target fail closed',()=>{
  for(const mutate of [s=>s.guidedRepeat.pop(),s=>s.guidedRepeat.push(s.guidedRepeat[0]),s=>{s.versionId='wrong';},s=>{s.guidedRepeat[0].activityId='other';}]){
    const s=structuredClone(compiled.services);mutate(s);assert.throws(()=>repeatLesson(manifest,compiled.bindings,s,capsule.id,'zh-CN'));
  }
  const m=structuredClone(manifest);m.runtimeTargets=m.runtimeTargets.filter(t=>t.id!==lesson.tracks[0].segments[0].target);assert.throws(()=>repeatLesson(m,compiled.bindings,compiled.services,capsule.id,'zh-CN'));
});
test('isolated preview: repeat is idempotent; reload survives new lesson object; owner and snapshot partition; expiry resets only preview',()=>{
  let now=0;const store=createPreviewRepeatStore(()=>now),t=lesson.tracks[0],s=t.segments[0];
  const a=store.mark('owner',lesson,t.id,s.id);assert.deepEqual(store.mark('owner',lesson,t.id,s.id),a);
  assert.deepEqual(store.read('owner',structuredClone(lesson)),a);assert.equal(store.read('another-owner',lesson).practicedSegmentIds.length,0);
  assert.equal(store.read('owner',{...lesson,snapshotId:'other'}).practicedSegmentIds.length,0);
  assert.equal(a.mode,'preview-isolated');assert.equal(a.formalCompletion,false);assert.equal(a.progressDelta,null);assert.equal(a.score,null);
  assert.throws(()=>store.mark('owner',lesson,lesson.tracks[1].id,s.id));assert.throws(()=>store.mark('owner',lesson,t.id,'unknown'));
  now=1800001;assert.equal(store.read('owner',lesson).practicedSegmentIds.length,0);
});
function historyTransport(rows,error=null){
  const calls=[];
  return {calls,db:{from(table){assert.equal(table,'digital_textbook_guided_repeat_progress');const filters=[];return {
    select(fields){calls.push(['select',fields]);assert.doesNotMatch(fields,/object|metadata|transcript|\*/);return this;},
    eq(k,v){calls.push([k,v]);filters.push(r=>r[k]===v);return this;},
    then(resolve,reject){return Promise.resolve({data:rows.filter(r=>filters.every(f=>f(r))),error}).then(resolve,reject);},
  };}}};
}
test('actual SELECT Reader restores all 14 from synthetic DB transport, filters another student/tenant/activity; no write interface exists',async()=>{
  const rows=compiled.services.guidedRepeat.map(r=>({tenant_id:scope.tenantId,student_id:scope.actorId,activity_id:r.activityId,practice_key:'repeat-line',track_index:r.legacyTrack,segment_index:r.legacySegment}));
  rows.push({...rows[0],student_id:'other',segment_index:999},{...rows[0],tenant_id:'other',segment_index:999},{...rows[0],activity_id:'other',segment_index:999});
  const {db,calls}=historyTransport(rows),state=await readGuidedRepeatHistory(db,compiled.services,scope,lesson);
  assert.equal(state.practicedSegmentIds.length,14);assert.equal(state.mode,'production-domain');assert.equal(state.formalCompletion,false);assert.ok(calls.some(c=>c[0]==='student_id'&&c[1]===scope.actorId));
  assert.deepEqual(state.practicedSegmentIds,lesson.tracks.flatMap(t=>t.segments.map(s=>s.id)).sort());
});
test('Reader refuses authorization/revision, unknown historical segment, and database error rather than clearing history',async()=>{
  const {db}=historyTransport([]);
  await assert.rejects(readGuidedRepeatHistory(db,compiled.services,{...scope,authorized:false},lesson));
  await assert.rejects(readGuidedRepeatHistory(db,compiled.services,scope,{...lesson,revision:'other'}));
  const bad=historyTransport([{tenant_id:scope.tenantId,student_id:scope.actorId,activity_id:compiled.services.guidedRepeat[0].activityId,practice_key:'repeat-line',track_index:0,segment_index:999}]);
  await assert.rejects(readGuidedRepeatHistory(bad.db,compiled.services,scope,lesson));
  await assert.rejects(readGuidedRepeatHistory(historyTransport([],{message:'unavailable'}).db,compiled.services,scope,lesson));
});
test('service binding delegates historical coordinates for every stable segment; unknown/cross-track rejected before service',async()=>{
  const calls=[];for(const t of lesson.tracks)for(const s of t.segments){
    await saveBoundGuidedRepeat(compiled.services,scope,lesson,t.id,s.id,async input=>{calls.push(input);return {ok:true};});
    const mapping=compiled.services.guidedRepeat.find(r=>r.segmentId===s.id);assert.deepEqual(calls.at(-1),{activityId:mapping.activityId,practiceKey:'repeat-line',trackIndex:mapping.legacyTrack,segmentIndex:mapping.legacySegment});
  }
  await assert.rejects(saveBoundGuidedRepeat(compiled.services,scope,lesson,lesson.tracks[1].id,lesson.tracks[0].segments[0].id,async()=>{throw Error('MUST_NOT_CALL');}));assert.equal(calls.length,14);
  await assert.rejects(saveBoundGuidedRepeat(compiled.services,scope,lesson,lesson.tracks[0].id,lesson.tracks[0].segments[0].id,async()=>({ok:false})));
});
test('client state rejects score/completion, unknown IDs, duplicates and wrong snapshot',()=>{
  const state=repeatState(lesson,'preview-isolated',[]);
  for(const change of [{score:1},{formalCompletion:true},{progressDelta:1},{snapshotId:'wrong'},{practicedSegmentIds:['unknown']},{practicedSegmentIds:[lesson.tracks[0].segments[0].id,lesson.tracks[0].segments[0].id]}])assert.throws(()=>acceptRepeatState(lesson,{...state,...change}));
});
test('original-rate browser TTS onend resolves once; abort/error never report playback success',async()=>{
  let utterance,cancelled=0;const host={create:text=>({text}),speak:u=>{utterance=u;},cancel:()=>{cancelled++;}};
  const c=new AbortController(),p=playRepeatLine('안녕하세요?',c.signal,host);assert.equal(utterance.rate,0.82);assert.equal(utterance.lang,'ko-KR');const end=utterance.onend;end();end();await p;
  const q=playRepeatLine('안녕하세요?',c.signal,host);const stale=utterance.onend;c.abort();stale();await assert.rejects(q,/CANCELLED/);assert.equal(cancelled,1);
  const r=playRepeatLine('안녕하세요?',new AbortController().signal,host);utterance.onerror();await assert.rejects(r,/FAILED/);
});
test('owner audit actions reject non-owner before session lookup; request cannot select domain mode or legacy coordinates',async()=>{
  const path='src/features/smart-textbook-runtime/server/audit-repeat-actions.ts';
  const denied=await serverModule(path,{'../../../lib/admin':'export async function requirePlatformOwner(){throw Error("NOT_OWNER");}','./audit-session.server':'export function auditSession(){throw Error("LOOKUP_NOT_ALLOWED");}'});
  await assert.rejects(denied.auditRepeatLoad({}),/NOT_OWNER/);await assert.rejects(denied.auditRepeatMark({}),/NOT_OWNER/);
  const allowed=await serverModule(path,{'../../../lib/admin':'export async function requirePlatformOwner(){return {user:{id:"synthetic-owner"}};}','./audit-session.server':'export function auditSession(){return globalThis.__repeatSession;}'});
  globalThis.__repeatSession={data:{result:compiled}};
  try{
    const input={sessionId:'10000000-0000-4000-8000-000000000001',snapshotId:lesson.snapshotId,capsuleRef:lesson.capsuleRef,trackId:lesson.tracks[0].id,segmentId:lesson.tracks[0].segments[0].id};
    const ok=await allowed.auditRepeatMark(input);assert.equal(ok.mode,'preview-isolated');
    for(const inject of [{studentId:'x'},{tenantId:'x'},{trackIndex:0},{segmentIndex:0},{score:1},{completion:true},{mode:'production-domain'},{objectKey:'x'}])await assert.rejects(allowed.auditRepeatMark({...input,...inject}));
    await assert.rejects(allowed.auditRepeatMark({...input,snapshotId:'wrong'}));
  }finally{delete globalThis.__repeatSession;}
});
