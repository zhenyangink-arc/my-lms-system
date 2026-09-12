import test from 'node:test';
import assert from 'node:assert/strict';
import {fullHistoryFixture,isolatedSessionFixture,manifest,compiled,scope,capsules,uuid} from './fixtures/runtime-4a10.mjs';
import {historyDb} from './fixtures/history-db.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
const {readAttemptHistory}=await import('../src/features/smart-textbook-runtime/server/history-pagination.server.ts');
const {restoreNativeChoice}=await import('../src/features/smart-textbook-runtime/server/native-choice-history.server.ts');
const {resolvePatternMedia}=await serverModule('src/features/smart-textbook-runtime/server/pattern-media.server.ts');
const {patternExecutions}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {auditLearningTargets}=await import('../src/features/smart-textbook-runtime/core/target-coverage.ts');
const {learningCapabilityReadiness,validateLearningActivation}=await import('../src/features/smart-textbook-runtime/core/learning-readiness.ts');
const signal=()=>new AbortController().signal;

test('keyset reads beyond 1000 using deterministic composite cursor and owner/version scope',async()=>{
  const rows=Array.from({length:1201},(_,n)=>({id:uuid(n+1),created_at:'2026-09-10T00:00:00.000001Z'})),calls=[];
  const result=await readAttemptHistory({db:historyDb({digital_textbook_attempts:rows},calls),...scope,activityIds:['isolated'],signal:signal()});
  assert.equal(result.length,1201);assert.equal(new Set(result.map(r=>r.id)).size,1201);
  assert(calls.filter(c=>!c.countOnly&&c.ors.length).slice(1).every(c=>c.ors.some(x=>x.startsWith('created_at.gt.'))));
  assert(calls.every(c=>c.filters.some(([k,v])=>k==='tenant_id'&&v===scope.tenantId)));
});
test('keyset detects duplicate, total cap, forged coordinate, abort and non-monotonic transport',async()=>{
  const row={id:uuid(1),created_at:'2026-09-10T00:00:00Z'};
  for(const [rows,pattern] of [[[row,row],/DUPLICATE/],[[{...row,id:'injection,or()'}],/UUID|uuid/]]){
    await assert.rejects(()=>readAttemptHistory({db:historyDb({digital_textbook_attempts:rows}),...scope,activityIds:[],signal:signal()}),pattern);
  }
  await assert.rejects(()=>readAttemptHistory({db:historyDb({digital_textbook_attempts:[row,{...row,id:uuid(2)}]}),...scope,activityIds:[],pageSize:1,totalCap:1,signal:signal()}),/TOTAL_CAP/);
  const c=new AbortController();c.abort();await assert.rejects(()=>readAttemptHistory({db:historyDb({}),...scope,activityIds:[],signal:c.signal}));
});
test('keyset initial fence excludes later ordinary append, next refresh includes it',async()=>{
  const tables={digital_textbook_attempts:[{id:uuid(1),created_at:'2026-09-10T00:00:00Z'}]};const base=historyDb(tables);let calls=0;
  const db={from(table){if(++calls===2)tables.digital_textbook_attempts.push({id:uuid(2),created_at:'2026-09-10T00:00:01Z'});return base.from(table);}};
  assert.equal((await readAttemptHistory({db,...scope,activityIds:[],signal:signal()})).length,1);
  assert.equal((await readAttemptHistory({db,...scope,activityIds:[],signal:signal()})).length,2);
});
test('late commit below the current cursor fails instead of silently missing a historical attempt',async()=>{
  const tables={digital_textbook_attempts:[{id:uuid(2),created_at:'2026-09-10T00:00:01Z'},{id:uuid(3),created_at:'2026-09-10T00:00:02Z'}]},base=historyDb(tables);let calls=0;
  const db={from(table){if(++calls===4)tables.digital_textbook_attempts.push({id:uuid(1),created_at:'2026-09-10T00:00:00Z'});return base.from(table);}};
  await assert.rejects(()=>readAttemptHistory({db,...scope,activityIds:[],pageSize:1,signal:signal()}),/CHANGED_DURING_SCAN/);
});
test('three native choices restore through frozen mapping, not presentation position',async()=>{
  const f=fullHistoryFixture(),r=await f.reader(signal());
  const blocks=manifest.blocks.filter(b=>b.type==='multiple_choice');assert.equal(blocks.length,3);
  for(const block of blocks){const a=r.server.attempts.find(a=>a.activityRef===block.props.activityRef);assert(a.selectedOptionId);assert.equal(a.result.attemptNumber,1);
    const shuffled=structuredClone(manifest);shuffled.activityRefs.find(a=>a.id===block.props.activityRef).publicPresentation.options.reverse();
    assert.equal(restoreNativeChoice(shuffled,compiled.bindings,block.props.activityRef,1),a.selectedOptionId);
    for(const response of [-1,100,'1',null])assert.throws(()=>restoreNativeChoice(manifest,compiled.bindings,block.props.activityRef,response));
    const bad=structuredClone(compiled.bindings),identity=bad.identities.find(i=>i.owner===block.props.activityRef&&i.legacyPath==='options[1]');bad.identities.push(identity);
    assert.throws(()=>restoreNativeChoice(manifest,bad,block.props.activityRef,1),/AMBIGUOUS/);
  }
});
test('latest qualifying native response remains paired with its feedback after unsuccessful retry',async()=>{
  const f=fullHistoryFixture(),original=f.tables.digital_textbook_attempts[0];f.tables.digital_textbook_attempts.push({...original,id:uuid(100),attempt_number:2,response:0,is_correct:false,meets_completion_requirements:false,created_at:'2026-09-10T00:01:00Z'});
  const r=await f.reader(signal()),a=r.server.attempts.find(a=>a.activityRef===original.activity_id);assert.equal(a.result.attemptNumber,1);assert.equal(a.result.correct,true);assert(r.server.activityProgress.find(a=>a.activityRef===original.activity_id).completed);
});
test('all-domain isolated SELECT reader restores 19 activities, 8 authoritative nodes, all pages/repeat/evidence',async()=>{
  const f=fullHistoryFixture(),r=await f.reader(signal());assert.equal(r.server.attempts.length,19);assert.equal(r.server.completedStepIds.length,8);assert.equal(r.capsules.length,8);assert.equal(r.server.guidedRepeat[0].segmentIds.length,14);assert(r.server.speakingEvidence.length>0);assert(r.capsules.some(c=>c.patterns.length===2));assert.equal(r.capsules.flatMap(c=>c.pages).length,8);
  assert(!/object_key|objectKey|answer_key|tenantId|studentId/.test(JSON.stringify(r)));
  f.tables.digital_textbook_node_progress=[];assert.equal((await f.reader(signal())).server.completedStepIds.length,0);
});
test('concrete opaque session resolver → actual history Reader, normal auth rechecked, locale trusted',async()=>{
  const f=await isolatedSessionFixture();assert.deepEqual(Object.keys(f.ref),['sessionRef']);const r=await f.reader(signal());assert.equal(r.server.completedStepIds.length,8);assert(r.server.attempts.every(a=>a.result.explanation==='서버에 저장된 답변을 복원했습니다.'));
  for(const extra of ['studentId','tenantId','versionId','sourceRevision','activityId'])await assert.rejects(()=>f.resolver.resolve({...f.ref,[extra]:'injected'}));
  const original=globalThis.__session10auth;globalThis.__session10auth={...original,user:{id:'foreign'}};await assert.rejects(()=>f.resolver.resolve(f.ref),/OWNER/);globalThis.__session10auth=original;
  const data=globalThis.__session10source;globalThis.__session10source={...data,result:{...data.result,report:{...data.result.report,sourceRevision:'other'}}};await assert.rejects(()=>f.resolver.resolve(f.ref),/REVISION/);globalThis.__session10source=data;
  f.expire();await assert.rejects(()=>f.resolver.resolve(f.ref),/EXPIRED/);
});
test('pattern frozen eight pending resources stay pending; separate synthetic ready contract and revision cases',()=>{
  const c=capsules.find(c=>c.activities.some(a=>a.activityKey==='pattern-choice')),p=patternExecutions(manifest,compiled.bindings,c.id,'zh-CN')[0];assert.equal(p.turns.length,8);
  for(const t of p.turns)assert.equal(resolvePatternMedia(manifest,compiled.bindings,c.id,t.id),null);
  const ready=structuredClone(manifest);for(const meta of compiled.bindings.mediaMetadata.filter(x=>x.purpose==='guided-conversation-line'))ready.mediaRefs.find(r=>r.id===meta.ref).readiness='ready';
  for(const t of p.turns)assert(resolvePatternMedia(ready,compiled.bindings,c.id,t.id)?.objectKey);
  assert.throws(()=>resolvePatternMedia(manifest,compiled.bindings,c.id,'foreign'),/TURN/);
  const owner=resolvePatternMedia(ready,compiled.bindings,c.id,p.turns[0].id),pending=structuredClone(manifest);pending.mediaRefs.find(m=>m.id===owner.ref).readiness='pending';assert.equal(resolvePatternMedia(pending,compiled.bindings,c.id,p.turns[0].id),null);
  const bad=structuredClone(compiled.bindings);bad.media.find(m=>m.ref===owner.ref).revision='wrong';assert.throws(()=>resolvePatternMedia(manifest,bad,c.id,p.turns[0].id),/BINDING/);
});
test('359 target enumeration never treats missing executable owners as optional; duplicates and incomplete commands block',()=>{
  const empty=auditLearningTargets(manifest,[]);assert.equal(empty.rows.length,359);const executable=empty.rows.filter(r=>manifest.runtimeTargets.find(t=>t.id===r.target).capabilities.length).length;assert.equal(empty.requiredUnsupported,executable);
  const t=manifest.runtimeTargets.find(t=>t.id===empty.rows[0].target),observation={target:t.id,stepId:t.stepId,stateId:'actual-mount',initial:false,ownerCount:1,successfulCommands:t.capabilities};
  assert.equal(auditLearningTargets(manifest,[observation]).rows[0].category,'mount-on-reveal');
  assert.equal(auditLearningTargets(manifest,[{...observation,ownerCount:2}]).duplicateOwners,1);
  assert.equal(auditLearningTargets(manifest,[{...observation,successfulCommands:[]}]).requiredUnsupported,executable);
});
test('strict learning activation ignores teacher ONLY; missing audit evidence still blocks readiness',()=>{
  const validation=validateLearningActivation(manifest);assert.equal(validation.success,true);
  const readiness=learningCapabilityReadiness(manifest,{targets:auditLearningTargets(manifest,[]),evidence:[],activities:[],requiredActivityRefs:compiled.bindings.activities.filter(a=>a.countsTowardCompletion).map(a=>a.ref)});
  assert.equal(readiness.compatLearning,'unsupported');assert.equal(readiness.runtimeReady,false);assert(readiness.blockers.includes('strict-learning-reload'));assert(!readiness.blockers.includes('renderer:compat.teacher.v1'));
});
test('server-only ready-audio positive contract returns bytes, rejects MIME/oversize, never transfers signed location',async()=>{
  const c=capsules.find(c=>c.activities.some(a=>a.activityKey==='pattern-choice')),turn=patternExecutions(manifest,compiled.bindings,c.id,'zh-CN')[0].turns[0];
  const ready=structuredClone(manifest);for(const meta of compiled.bindings.mediaMetadata.filter(x=>x.purpose==='guided-conversation-line'))ready.mediaRefs.find(r=>r.id===meta.ref).readiness='ready';
  const {patternAudioBytes}=await serverModule('src/features/smart-textbook-runtime/server/pattern-media.server.ts',{'../../../lib/r2':'export async function createR2SignedObjectUrl(){return "https://isolated.invalid/private-test";}'});
  const originalFetch=globalThis.fetch;let mime='audio/mpeg',size=4,calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://isolated.invalid/private-test');assert.equal(options.redirect,'error');return new Response(new Uint8Array(size),{headers:{'content-type':mime}});};
  try{
    assert.equal(await patternAudioBytes(manifest,compiled.bindings,c.id,turn.id,signal()),null);assert.equal(calls,0);
    const blob=await patternAudioBytes(ready,compiled.bindings,c.id,turn.id,signal());assert.equal(blob.size,4);assert.equal(blob.type,'audio/mpeg');assert(!('url'in blob));
    mime='text/html';await assert.rejects(()=>patternAudioBytes(ready,compiled.bindings,c.id,turn.id,signal()),/UNAVAILABLE/);
    mime='audio/mpeg';size=11*1024*1024;await assert.rejects(()=>patternAudioBytes(ready,compiled.bindings,c.id,turn.id,signal()),/SIZE/);
  }finally{globalThis.fetch=originalFetch;}
});
