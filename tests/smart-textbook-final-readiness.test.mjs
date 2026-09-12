import {previousTargetContractDigest} from './fixtures/runtime-target-contract-history.mjs';
import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const fixture=async n=>(await import(`./fixtures/smart-textbook-legacy-adapter/chapter-one-${n}.server.ts`)).default;
const source=await fixture('source'),ledger=await fixture('identities'),history=await fixture('service-identities'),evidence=await fixture('service-evidence');
// Keep the Phase 3D historical characterization; Phase 3E tests exercise the current finalizer.
const {auditPhase3DNonUiReadiness:finalizeChapterOneNonUiReadiness}=await import('../src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
const {buildSpeechReachability,validateFinalProof,utteranceHash}=await import('../src/lib/smart-textbook-legacy-adapter/final-proof.server.ts');
const {validatePrivateBindings}=await import('../src/lib/smart-textbook-legacy-adapter/bindings.server.ts');
const {createTtsObservationGrantService}=await import('../src/lib/smart-textbook-legacy-adapter/tts-observation-grant.server.ts');
const base=finalizeChapterOneNonUiReadiness(source,ledger,history,evidence),binding=base.tts;
const caller={actorId:'authorized-student',tenantId:'authorized-tenant'};
function setup(){
  let clock=1000;
  const state={...caller,sessionId:'runtime-session',active:true,sourceRevision:binding.sourceRevision,snapshotId:binding.snapshotId,teachingRevision:binding.teachingRevision,stepId:binding.stepId,cueId:binding.cueId,target:binding.target,textHash:binding.textHash,locale:binding.locale,utteranceId:binding.utteranceId,generation:1,phase:'waiting-playback'};
  const service=createTtsObservationGrantService({binding,authorizeSession:async()=>({...state}),now:()=>clock,ttlMs:5000});
  return {service,state,setClock:x=>{clock=x;},issue:()=>service.issue(caller,{sessionId:state.sessionId})};
}
test('Phase 3D resolves only TTS; unsafe loader selections keep nonUi and Runtime false',()=>{
  assert.deepEqual(base.resolvedInPhase3D,['configuration.studentTask']);assert.equal(base.remainingNonUiUnsupported.length,1);
  assert.equal(base.remainingNonUiUnsupported[0].source.path,'speech.voiceTimeline');
  assert.equal(base.nonUiRuntimeReady,false);assert.equal(base.runtimeReady,false);assert.equal(base.report.runtimeReady,false);
  assert.ok(base.report.unsupported.some(x=>x.source.path==='runtime.capabilities'));
});
test('8 Steps, 19 activities, 3 orientation questions, v23 legacy and unchanged Phase 3C Manifest',()=>{
  assert.equal(base.manifest.steps.length,8);assert.equal(base.manifest.activityRefs.length,19);
  assert.equal(base.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.equal(base.manifest.teachingRefs[0].mode,'legacy');assert.equal(base.manifest.teachingRefs[0].revision,binding.teachingRevision);
  assert.equal(previousTargetContractDigest(base.manifest),'sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f');
  assert.equal(base.manifest.blocks.some(b=>b.type==='video'),false);
});
test('correct server grant reports browser observation, no score/progress or automatic advancement',async()=>{
  const x=setup(),grant=await x.issue();assert.equal(grant.text,'안녕하세요?');assert.equal(grant.locale,'ko-KR');
  assert.deepEqual(Object.keys(grant).sort(),['expiresAt','grantId','locale','text']);
  const response=await x.service.observe(caller,{grantId:grant.grantId});
  assert.deepEqual(response,{playbackObserved:true,observation:'authorized-browser-tts-ended-report',duplicate:false,formalCompletion:false,progressDelta:null,score:null,agentAdvance:false,teachingPlaybackWaitSatisfied:true,teachingEffect:'eligible-for-task-feedback'});
});
test('same logical issue reuses grant; replay/new eventId cannot consume again or repeat teaching effect',async()=>{
  const x=setup(),grant=await x.issue();assert.equal((await x.issue()).grantId,grant.grantId);
  await x.service.observe(caller,{grantId:grant.grantId});
  const replay=await x.service.observe(caller,{grantId:grant.grantId,eventId:'b631ccac-4338-48df-9ef5-e0a6b550f2bc'});
  assert.equal(replay.duplicate,true);assert.equal(replay.teachingPlaybackWaitSatisfied,false);assert.equal(replay.teachingEffect,'none');
  assert.equal(replay.formalCompletion,false);assert.equal(replay.progressDelta,null);
  await assert.rejects(x.issue(),/already consumed/);
});
test('concurrent observations have one teaching-wait effect',async()=>{
  const x=setup(),grant=await x.issue();const rows=await Promise.all(Array.from({length:8},()=>x.service.observe(caller,{grantId:grant.grantId})));
  assert.equal(rows.filter(r=>r.teachingPlaybackWaitSatisfied).length,1);
});
for(const [field,value] of Object.entries({sessionId:'wrong',snapshotId:'wrong',sourceRevision:'wrong',teachingRevision:'wrong',target:'wrong',textHash:'0'.repeat(64),generation:2,stepId:'old-step',cueId:'wrong',utteranceId:'wrong',locale:'zh-CN',phase:'other',active:false}))test(`grant refuses changed server ${field}`,async()=>{
  const x=setup(),grant=await x.issue();x.state[field]=value;await assert.rejects(x.service.observe(caller,{grantId:grant.grantId}));
});
test('unauthorized caller/session cannot issue or consume',async()=>{
  const x=setup(),grant=await x.issue();
  await assert.rejects(x.service.issue({...caller,tenantId:'wrong'},{sessionId:'runtime-session'}));
  await assert.rejects(x.service.issue(caller,{sessionId:'wrong'}));
  await assert.rejects(x.service.observe({...caller,actorId:'wrong'},{grantId:grant.grantId}));
});
test('expired grant and revoked old Step grant are refused',async()=>{
  const x=setup(),g=await x.issue();x.setClock(g.expiresAt);await assert.rejects(x.service.observe(caller,{grantId:g.grantId}),/Expired/);
  const y=setup(),h=await y.issue();y.service.revokeSession(caller,y.state.sessionId);await assert.rejects(y.service.observe(caller,{grantId:h.grantId}),/revoked/);
});
test('revocation while authorization awaits cannot race consume',async()=>{
  const x=setup();let release;let delay=false;
  const service=createTtsObservationGrantService({binding,now:()=>1000,authorizeSession:async()=>{if(delay)await new Promise(r=>release=r);return x.state;}});
  const grant=await service.issue(caller,{sessionId:x.state.sessionId});delay=true;
  const pending=service.observe(caller,{grantId:grant.grantId});service.revokeSession(caller,x.state.sessionId);release();await assert.rejects(pending,/revoked/);
});
test('revocation during issuance prevents a grant from escaping cancellation',async()=>{
  const x=setup();let release;
  const service=createTtsObservationGrantService({binding,authorizeSession:async()=>{await new Promise(r=>release=r);return x.state;}});
  const pending=service.issue(caller,{sessionId:x.state.sessionId});service.revokeSession(caller,x.state.sessionId);release();await assert.rejects(pending,/revoked during/);
});
for(const field of ['score','completion','formalCompletion','progressDelta','agentAdvance','studentId','tenant','expectedText','textHash','target'])test(`client ${field} injection is rejected`,async()=>{
  const x=setup(),g=await x.issue();await assert.rejects(x.service.observe(caller,{grantId:g.grantId,[field]:'injected'}));
});
test('unissued onend and client-authored grant issuance fields are rejected',async()=>{
  const x=setup();await assert.rejects(x.service.observe(caller,{grantId:'b631ccac-4338-48df-9ef5-e0a6b550f2bc'}),/Unissued/);
  await assert.rejects(x.service.issue(caller,{sessionId:'runtime-session',expectedText:'fake',studentId:'fake'}));
});
test('TTS binding hash mismatch cannot construct the grant service',()=>{
  assert.throws(()=>createTtsObservationGrantService({binding:{...binding,text:'another phrase'},authorizeSession:async()=>setup().state}),/hash/);
});
test('complete buffer path coverage with no invented transition into opening node',()=>{
  assert.equal(base.speech.proofs.filter(p=>p.segment===199).length,48);
  for(const n of source.teachingNodes)for(const locale of ['zh-CN','ko-KR'])for(const path of ['resume-loader','resume-reentry',...(n.sort_order===1?[]:['buffer-transition'])])assert.equal(base.speech.proofs.filter(p=>p.nodeId===n.id&&p.locale===locale&&p.path===path).length,1);
  assert.equal(base.speech.proofs.filter(p=>p.path==='opening-loader').length,2);
});
test('14 old mismatches reachable-invalid; two terminal rows unresolved, NONE assumed stale',()=>{
  assert.equal(base.speech.historical199.length,16);
  assert.equal(base.speech.historical199.filter(a=>a.classification==='reachable-but-invalid').length,14);
  assert.equal(base.speech.historical199.filter(a=>a.classification==='unresolved').length,2);
  for(const a of base.speech.historical199){assert.notEqual(a.classification,'unreachable-stale');assert.equal(base.speech.selectableAssetIds.includes(a.assetId),false);}
});
test('respond preset priority differs from loader asset-first priority',()=>{
  const node=source.teachingNodes.find(n=>n.node_key==='observe-scene');
  const transition=base.speech.proofs.find(p=>p.nodeId===node.id&&p.locale==='zh-CN'&&p.path==='buffer-transition');
  const loader=base.speech.proofs.find(p=>p.nodeId===node.id&&p.locale==='zh-CN'&&p.path==='resume-loader');
  assert.equal(transition.legacyCandidateAssetId,'buffer-preset:focus-learning:zh-CN');assert.equal(transition.selectionMode,'preset-first');
  assert.equal(loader.selectionMode,'loader-ready-first');assert.equal(loader.proofStatus,'unsupported');assert.notEqual(loader.legacyCandidateAssetId,transition.legacyCandidateAssetId);
});
test('verified assets match node/revision/locale/hash and exclude quarantined 199',()=>{
  assert.equal(base.speech.selectableAssetIds.length,28);
  for(const p of base.speech.proofs.filter(p=>p.proofStatus==='verified-asset')){
    const a=evidence.speech.find(a=>a.id===p.selectedAssetId);assert.equal(a.script_node_id,p.nodeId);assert.equal(a.locale,p.locale);assert.equal(a.content_hash,p.expectedTextHash);assert.equal(p.teachingRevision,binding.teachingRevision);
  }
});
test('existing fallbacks include intentional silent and preset request TTS/text, never success-with-wrong-audio',()=>{
  const proofs=base.speech.proofs.filter(p=>p.proofStatus==='verified-existing-fallback');assert.equal(proofs.length,24);
  assert.equal(proofs.filter(p=>p.fallbackMode==='existing-silent').length,22);
  assert.equal(proofs.filter(p=>p.fallbackMode==='existing-browser-tts-or-text').length,2);
  assert.ok(base.speech.proofs.filter(p=>p.legacyCandidateAssetId&&evidence.speech.some(a=>a.id===p.legacyCandidateAssetId&&a.segment_index===199)).every(p=>p.proofStatus==='unsupported'));
});
for(const [name,mutate] of [
  ['wrong TTS target',(t,s)=>{t.target='step:missing/block:missing'}],
  ['wrong TTS hash',(t,s)=>{t.textHash='0'.repeat(64)}],
  ['wrong cue',(t,s)=>{t.cueId='wrong'}],
  ['injected progress',(t,s)=>{t.progressDelta=1}],
  ['missing cue',(t,s)=>{s.proofs.pop()}],
  ['duplicate proof',(t,s)=>{s.proofs.push(s.proofs[0])}],
  ['wrong asset hash',(t,s)=>{s.proofs[0].expectedTextHash='0'.repeat(64)}],
  ['wrong preset',(t,s)=>{s.proofs.find(p=>p.preset).preset='wrong'}],
  ['invented fallback',(t,s)=>{s.proofs[0].fallbackMode='new-fallback'}],
  ['fake stale',(t,s)=>{s.historical199[0].classification='unreachable-stale';s.selectableAssetIds.push(s.historical199[0].assetId)}],
])test(`private final proof validator refuses ${name}`,()=>{
  const t=structuredClone(binding),s=structuredClone(base.speech);mutate(t,s);
  assert.ok(validateFinalProof(source,evidence,base,t,s).length>0);
  assert.ok(validatePrivateBindings(base.manifest,base.bindings,{services:base.services,source,history,evidence,sourceRevision:base.report.sourceRevision,finalProof:{tts:t,speech:s}}).length>0);
});
test('unresolved current speech and changed configured preset continue to block readiness',()=>{
  const s=structuredClone(source);s.teachingNodes.find(n=>n.configuration.bufferPresetId==='focus-learning').configuration.bufferPresetId='teacher-introduction';
  const r=finalizeChapterOneNonUiReadiness(s,ledger,history,evidence);assert.equal(r.nonUiRuntimeReady,false);assert.ok(r.speech.proofs.some(p=>p.reason==='Configured preset and actual buffer text disagree'));
});
test('proofs, bindings, classifications and digest deterministic; input not mutated',()=>{
  const before=JSON.stringify({source,evidence,ledger,history});assert.deepEqual(finalizeChapterOneNonUiReadiness(source,ledger,history,evidence),base);
  const e=structuredClone(evidence);e.speech.reverse();assert.deepEqual(finalizeChapterOneNonUiReadiness(source,ledger,history,e),base);
  assert.equal(JSON.stringify({source,evidence,ledger,history}),before);
});
test('private proof/grant details never enter public Manifest; no fake TTS media ref',()=>{
  const json=JSON.stringify(base.manifest);assert.doesNotMatch(json,/grantId|expectedTextHash|buffer-preset|object_key|objectKey|answer_key|service.role|virtualCharacter/);
  assert.equal('mediaRef' in binding,false);for(const a of source.media)if(a.object_key)assert.equal(json.includes(a.object_key),false);
});
test('historical unsafe loader is now replaced; existing task and fallback semantics remain',()=>{
  const loader=readFileSync('src/lib/smart-digital-textbook.ts','utf8');assert.match(loader,/select\(BUFFER_CANDIDATE_COLUMNS\)/);assert.match(loader,/selectBufferSpeechIds/);
  const path='src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx';const ui=readFileSync(path,'utf8');
  assert.match(ui,/bufferPairForStage/);assert.match(ui,/setTutorNextBufferLine\(activeOpeningBufferLine\)/);assert.doesNotMatch(ui,/activeSessionBufferLine\?\.\[locale\][\s\S]*\|\| activeModule\?\.openingBufferLine/);
  assert.match(ui,/catch\(\(\) => requestAbortController.signal.aborted \? undefined : browserSpeechFallback\(\)\)/);
  assert.match(ui,/audio.onerror = \(\) => finish\("error"\)/);
  const event=readFileSync('src/app/api/learning-agent/events/route.ts','utf8');assert.doesNotMatch(event,/digital_textbook_attempts|record_smart_textbook_attempt|digital_textbook_node_progress/);
  const runtime=readFileSync('src/lib/learning-agent-script-runtime.ts','utf8');assert.match(runtime,/turnPhase === "task" && !requiredTaskPending/);assert.match(runtime,/teachingTurnPhase: "task_feedback"/);
});
