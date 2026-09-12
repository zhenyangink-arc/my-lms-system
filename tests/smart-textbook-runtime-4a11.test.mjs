import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compiled,manifest} from './fixtures/runtime-4a.mjs';
import {previousTargetContractDigest,previousTargetProofDigest} from './fixtures/runtime-target-contract-history.mjs';
import {validateLessonManifestV1} from '../src/lib/smart-textbook-runtime-v1/validator.ts';
const {learningTargetSemantics,projectLearningTargetCapabilities}=await import('../src/lib/smart-textbook-legacy-adapter/target-semantics.server.ts');
const {validatePrivateBindings}=await import('../src/lib/smart-textbook-legacy-adapter/bindings.server.ts');
import {RuntimeTargetRegistry,elementTargetHandle} from '../src/features/smart-textbook-runtime/core/target-registry.ts';
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
const {digest}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
import {auditLearningTargets} from '../src/features/smart-textbook-runtime/core/target-coverage.ts';
const rows=learningTargetSemantics(manifest,compiled.bindings);
test('4A11 empty identity denies every command, handle and service-play bypass',async()=>{
  const t=manifest.runtimeTargets.find(t=>!t.capabilities.length),steps=new StepController(manifest,[],t.stepId),registry=new RuntimeTargetRegistry(manifest.runtimeTargets,steps);
  assert.deepEqual(t.acceptedEvents,[]);
  for(const command of ['reveal','focus','highlight','play','open']){
    await assert.rejects(()=>registry.command(t.id,command),/CAPABILITY_DENIED/);
    assert.throws(()=>registry.mount(t.id,{[command](){throw Error('must not execute');},dispose(){}}),/CAPABILITY_DENIED/);
  }
  const block=manifest.blocks.find(b=>b.id===t.blockId);
  assert.throws(()=>registry.mountLearningOwner({snapshotId:manifest.snapshot.id,capsuleRef:block.props.capsuleRef,playback:[{kind:'browser-tts',partId:t.partId,target:t.id,text:'안녕하세요',locale:'ko-KR'}],navigation:[]},t.partId,async()=>{}),/CAPABILITY_DENIED/);steps.dispose();
});
test('4A11 identity-only cannot accept events or server evidence',()=>{
  for(const change of [t=>t.acceptedEvents=['opened'],t=>t.verification='server-attempt']){
    const m=structuredClone(manifest);change(m.runtimeTargets.find(t=>!t.capabilities.length));const v=validateLessonManifestV1(m);
    assert.equal(v.success,false);assert(v.issues.some(i=>i.message.includes('Identity-only')));
  }
});
test('4A11 no generic element open/play and no competing TTS/media owners',()=>{
  const handle=elementTargetHandle({removeAttribute(){}},['open','play']);assert.equal(handle.open,undefined);assert.equal(handle.play,undefined);handle.dispose();
  const t=manifest.runtimeTargets.find(t=>t.id===compiled.tts.target),block=manifest.blocks.find(b=>b.id===t.blockId);
  const tools={snapshotId:manifest.snapshot.id,capsuleRef:block.props.capsuleRef,playback:[{kind:'browser-tts',partId:t.partId,target:t.id,text:'안녕하세요',locale:'ko-KR'}],navigation:[]};
  const owner={kind:'authorized-browser-tts-owner/1',target:t.id,snapshotId:manifest.snapshot.id,teachingRevision:manifest.teachingRefs[0].revision,utteranceId:'test-utterance',generation:0};
  for(const ttsFirst of [true,false]){
    const s=new StepController(manifest,[],t.stepId),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s);
    if(ttsFirst){r.mountTtsOwner(owner,async()=>{});assert.throws(()=>r.mountLearningOwner(tools,t.partId,async()=>{}),/OWNER_SCOPE/);}
    else{r.mountLearningOwner(tools,t.partId,async()=>{});assert.throws(()=>r.mountTtsOwner(owner,async()=>{}),/OWNER_SCOPE/);}
    s.dispose();
  }
});
test('4A11 359 semantic rows retain real controls and reject unknown families',()=>{
  assert.equal(rows.length,359);assert.equal(new Set(rows.map(r=>r.address)).size,359);assert(!rows.some(r=>r.classification==='unreachable-invalid'));
  for(const family of ['panel','block/activity','orientation-dialogue-task','chapter-test','review-return','content.targets[]','content.vocabulary[]','content.grammarCards[].examples[]','content.repeatTracks[].lines[]','content.dialogueScenes[].lines[]','speakingFrame']){
    const matches=rows.filter(r=>r.sourceFamily===family);assert(matches.length,family);assert(matches.every(r=>r.capabilities.length),family);
  }
  const b=structuredClone(compiled.bindings),i=b.identities.find(i=>i.legacyPath==='content.vocabulary[0]');i.legacyPath='content.future[0]';
  const r=learningTargetSemantics(manifest,b).find(r=>r.address.endsWith(`/part:${i.partId}`));assert.equal(r.classification,'unreachable-invalid');assert(r.capabilities.length);
  assert(validatePrivateBindings(manifest,b).some(e=>e.includes('unknown semantics')));
});
test('4A11 private proof rejects clearing real commands or adding invented play',()=>{
  for(const clear of [true,false]){
    const m=structuredClone(manifest),t=m.runtimeTargets.find(t=>clear?rows.find(r=>r.address===t.id)?.sourceFamily==='review-return':!t.capabilities.length);
    t.capabilities=clear?[]:['play'];t.acceptedEvents=[];assert(validatePrivateBindings(m,compiled.bindings).some(e=>e.includes('capability projection mismatch')));
  }
});
test('4A11 only target semantics change: frozen content, IDs, 8 steps, 19 activities, v23 and 3E proof preserved',()=>{
  assert.equal(previousTargetContractDigest(manifest),'sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f');
  const {snapshot,...semantic}=manifest;assert.equal(snapshot.contentDigest,`sha256:${digest(semantic)}`);assert.notEqual(snapshot.contentDigest,previousTargetContractDigest(manifest));
  const rerun=structuredClone(manifest);projectLearningTargetCapabilities(rerun,compiled.bindings);assert.deepEqual(rerun,manifest);
  assert.equal(validateLessonManifestV1(manifest).success,true);assert.deepEqual(validatePrivateBindings(manifest,compiled.bindings),[]);
  assert.equal(manifest.steps.length,8);assert.equal(manifest.activityRefs.length,19);assert.equal(manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.notEqual(manifest.snapshot.id,'snapshot-32603dd11ecc8762ccee25187a39ac0e');
  assert.equal(previousTargetProofDigest(compiled),'2e6d6c871116a1be3e800ddfead33b1cc85d1400af083281f82bad880813c594');assert.equal(compiled.nonUiRuntimeReady,true);assert.equal(compiled.runtimeReady,false);
});
test('4A11 coverage exempts commandless identities, not unmounted executable controls',()=>{
  const audit=auditLearningTargets(manifest,[]),identities=rows.filter(r=>r.classification==='identity-only');
  assert.equal(audit.rows.filter(r=>r.category==='commandless-identity').length,identities.length);assert.equal(audit.requiredUnsupported,359-identities.length);
  const t=manifest.runtimeTargets.find(t=>!t.capabilities.length),bad=auditLearningTargets(manifest,[{target:t.id,stepId:t.stepId,stateId:'forged',initial:true,ownerCount:1,successfulCommands:['play']}]);assert.equal(bad.rows.find(r=>r.target===t.id).category,'invalid');
});
test('4A11 committed 359-row semantic audit matches the current compiler and coverage totals',()=>{
  const artifact=JSON.parse(readFileSync(new URL('../docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A11_TARGET_SEMANTICS.json',import.meta.url),'utf8'));
  assert.equal(artifact.snapshotId,manifest.snapshot.id);assert.equal(artifact.manifestDigest,manifest.snapshot.contentDigest);assert.equal(artifact.proofDigest,compiled.proofDigest);
  assert.deepEqual(artifact.rows.map(({coverage,...semantic})=>semantic),rows);
  assert.equal(artifact.total,359);
  assert.equal(artifact.requiredUnsupported,artifact.rows.filter(r=>['unsupported','invalid'].includes(r.coverage.category)).length);
  assert.equal(artifact.danglingCommands,artifact.rows.reduce((n,r)=>n+r.coverage.missingCommands.length,0));
  assert(artifact.rows.every(r=>r.coverage.target===r.address));
});
