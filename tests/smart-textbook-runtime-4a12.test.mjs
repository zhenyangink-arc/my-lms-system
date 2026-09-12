import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manifest,compiled,context,state} from './fixtures/runtime-4a.mjs';
import {withLearningSession} from '../src/features/smart-textbook-runtime/core/learning-session-transport.ts';
import {RuntimeTargetRegistry} from '../src/features/smart-textbook-runtime/core/target-registry.ts';
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import {learningChecks,learningCapabilityReadiness} from '../src/features/smart-textbook-runtime/core/learning-readiness.ts';
import {auditLearningTargets} from '../src/features/smart-textbook-runtime/core/target-coverage.ts';
const {identity}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');

test('4A12 state preparation must mount an actual owner before command success; no hidden DOM or identity grant',async()=>{
  const t=manifest.runtimeTargets.find(t=>t.capabilities.includes('reveal')&&t.stepId===manifest.navigation.entryStep),steps=new StepController(manifest),r=new RuntimeTargetRegistry(manifest.runtimeTargets,steps);let commands=0;
  let off=r.prepare(t.id,async()=>{});await assert.rejects(r.command(t.id,'reveal'),/UNAVAILABLE/);off();
  off=r.prepare(t.id,async()=>{r.mount(t.id,{reveal:()=>{commands++;},dispose(){}});});await r.command(t.id,'reveal');assert.equal(commands,1);
  steps.next();await assert.rejects(r.command(t.id,'reveal'),/UNAVAILABLE/);off();steps.dispose();
});
test('4A12 authorized open can deliberately dispose its source Step; stale ordinary commands still fail',async()=>{
  const t=manifest.runtimeTargets.find(t=>t.capabilities.includes('open')),s=new StepController(manifest,[],t.stepId),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s);
  r.mount(t.id,{open:()=>{s.go(manifest.navigation.entryStep);return 'navigated';},dispose(){}});await r.command(t.id,'open');assert.equal(s.activeStepId,manifest.navigation.entryStep);s.dispose();
});
test('4A12 every browser learning port serializes only session/stable refs, not capsule or DB activity identities',async()=>{
  const calls=[],enters=[],sessionRef='learning-session-00000000-0000-4000-8000-000000000012';
  const base={context,initialState:state,teacher:{turn:async()=>{throw Error('not in learning');},cancel:async()=>{}},learning:async()=>{throw Error('old transport');},submit:async()=>{throw Error('old transport');}};
  const s=withLearningSession(base,manifest,sessionRef,manifest.activityRefs.map(a=>({runtimeRef:a.id,serviceRef:identity('activity-ref',a.id)})),async(r,signal,blob)=>{signal.throwIfAborted();calls.push({r,blob});return {};},async r=>{enters.push(r);return {generation:r.generation+1};});
  const c=compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.activities.some(a=>a.activityKey==='speaking-introduction')),ref=c.activities.find(a=>a.activityKey==='speaking-introduction').activityId,target=manifest.runtimeTargets.find(t=>t.stepId===c.stepId&&!t.partId&&manifest.blocks.find(b=>b.id===t.blockId)?.type==='compat.learning.v1').id;
  const a=ref,signal=new AbortController().signal,p='stable-page',response=[{kind:'fill',partId:'stable-part',text:'학습'}];
  await s.learning(c.id,signal);await s.activities.load(c.id,signal);await s.activities.submit(a,{kind:'single',optionId:'stable-option'},signal);
  await s.pages.load(c.id,signal);await s.pages.check(c.id,p,response,signal);await s.pages.audio(c.id,p,signal);await s.pages.transcript(c.id,p,signal);
  await s.learningFlow.restore(c.id,signal);await s.learningFlow.revealPage(c.id,p,signal);await s.learningFlow.finishPages(c.id,a,signal);
  await s.patterns.load(c.id,signal);await s.patterns.check(c.id,a,{kind:'choice',partId:'turn',optionId:'option'},signal);await s.patterns.audio(c.id,'turn',signal);await s.learningFlow.finishPattern(c.id,a,[],signal);
  await s.guidedRepeat.load(c.id,signal);await s.guidedRepeat.mark(c.id,'track','segment',signal);await s.learningTools.load(c.id,signal);await s.learningTools.open(c.id,target,signal);await s.refresh(signal);
  await s.recording.load(c.id,signal);await s.recording.restore(c.id,a,signal);
  const scope={capsuleRef:c.id,activityRef:a,target};await s.recording.upload(scope,new Blob(['isolated']),20,signal);await s.recording.audio(scope,'recording',signal);await s.recording.remove(scope,'recording',signal);
  await s.recording.complete({kind:'speaking-introduction',capsuleRef:c.id,activityRef:a,recordingId:'recording',criteriaIds:[]},signal);
  await s.recording.complete({kind:'dialogue-roleplay',capsuleRef:c.id,activityRef:a,sceneId:'scene',side:'left'},signal);
  const native=manifest.blocks.find(b=>b.type==='multiple_choice');await s.submit(native.props.activityRef,native.props.options?.[0]?.id??'option',signal);
  assert.equal(calls.length,27);assert(enters.length>=1);
  for(const {r}of calls){assert.deepEqual(Object.keys(r),['sessionRef','generation','target','request']);const text=JSON.stringify(r);assert(!/capsuleRef|activityRef|tenantId|studentId|snapshotId|versionId|sourceRevision|proof/.test(text));for(const ref of manifest.activityRefs)assert(!text.includes(ref.activityId));}
  const n=calls.length,cancel=new AbortController();cancel.abort();await assert.rejects(s.refresh(cancel.signal));assert.equal(calls.length,n);
});
test('4A12 readiness cannot omit strict mount/reload or unified browser boundary evidence',()=>{
  assert(learningChecks.includes('unified-browser-boundary'));assert(learningChecks.includes('strict-learning-mount'));assert(learningChecks.includes('strict-learning-reload'));
  const r=learningCapabilityReadiness(manifest,{targets:auditLearningTargets(manifest,[]),evidence:[],activities:[],requiredActivityRefs:manifest.activityRefs.map(a=>a.id)});
  assert.equal(r.learningReady,false);assert(r.blockers.includes('strict-learning-mount'));assert(r.blockers.includes('strict-learning-reload'));
});
test('4A12 Step disposal retains committed enter acknowledgement; next transition uses the new generation',async()=>{
  const sent=[],entered=[],c=compiled.bindings.capsules.filter(c=>c.kind==='learning');let release;
  const base={context,initialState:state},s=withLearningSession(base,manifest,'learning-session-00000000-0000-4000-8000-000000000012',[],async r=>{sent.push(r);return {};},async(r,signal)=>{entered.push(r);assert.equal(signal.aborted,false);if(entered.length===1)await new Promise(resolve=>{release=resolve;});return {generation:r.generation+1};});
  const abort=new AbortController(),first=s.learning(c[1].id,abort.signal);const rejected=assert.rejects(first);while(!release)await new Promise(r=>setImmediate(r));abort.abort();release();await rejected;
  await s.learning(c[2].id,new AbortController().signal);assert.equal(entered[1].generation,1);assert.equal(sent.length,1);assert.equal(sent[0].generation,2);
});
test('4A12 native preview uses original grader + TTL practice restore, not formal attempts; cross-Step binding denied',async()=>{
  const {learningSessionFixture}=await import('./fixtures/learning-session-4a12.mjs'),f=await learningSessionFixture();try{
    const catalog=await f.boundary.catalog({sessionRef:f.sessionRef}),target=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.navigation.entryStep).runtimeTarget;
    for(const b of manifest.blocks.filter(b=>b.type==='multiple_choice')){const activity=catalog.find(a=>a.runtimeRef===b.props.activityRef).serviceRef,response=manifest.activityRefs.find(a=>a.id===b.props.activityRef).publicPresentation.options[0].id;
      const result=await f.boundary.dispatch({sessionRef:f.sessionRef,generation:0,target,request:{op:'native-submit',activity,response}},new AbortController().signal);assert(result.ok&&result.preview);assert.equal(result.nodeCompleted,false);
    }
    const restored=await f.boundary.dispatch({sessionRef:f.sessionRef,generation:0,target,request:{op:'restore'}},new AbortController().signal);assert.equal(restored.activities.filter(a=>a.response?.kind==='single'&&a.feedback?.preview).length,3);assert(restored.activities.every(a=>!a.completed));assert.equal(f.state.attempts.length,0);
    const c=compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.stepId!==manifest.navigation.entryStep),activity=catalog.find(a=>a.runtimeRef===c.activities[0].activityId).serviceRef;
    await assert.rejects(f.boundary.dispatch({sessionRef:f.sessionRef,generation:0,target,request:{op:'native-submit',activity,response:'wrong'}},new AbortController().signal),/ACTIVITY/);
  }finally{f.dispose();}
});
test('4A12 unified owner Route rejects unauthenticated/cross-origin/oversize requests before domain dispatch',async()=>{
  const {serverModule}=await import('./fixtures/runtime-4a2.server.mjs');globalThis.__owner4a12=false;globalThis.__calls4a12=0;
  const {POST}=await serverModule('src/app/api/smart-textbook-runtime-audit/learning/route.ts',{
    '@/lib/admin':'export async function requirePlatformOwner(){if(!globalThis.__owner4a12)throw Error("Forbidden");return {user:{id:"isolated"}};}',
    '@/features/smart-textbook-runtime/server/audit-learning-boundary.server':'export async function auditLearningBoundary(){globalThis.__calls4a12++;throw Error("not authorized for this test");}',
  });
  const call=(body,origin='http://isolated')=>POST(new Request('http://isolated/api/learning',{method:'POST',headers:{origin,'content-type':'application/json'},body}));
  assert.equal((await call('{}')).status,403);globalThis.__owner4a12=true;assert.equal((await call('{}','https://external.invalid')).status,403);
  assert.equal((await call(' '.repeat(11*1024*1024+1))).status,413);assert.equal((await call(' '.repeat(65537))).status,400);assert.equal(globalThis.__calls4a12,0);
});
test('4A12 saved integration evidence recomputes learning readiness; omissions/stale snapshots cannot promote',()=>{
  const read=name=>JSON.parse(readFileSync(new URL(`../docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A12_${name}.json`,import.meta.url),'utf8'));
  const data=read('READINESS'),targets=read('TARGET_COVERAGE');assert.equal(data.manifestDigest,manifest.snapshot.contentDigest);assert.equal(data.proofDigest,compiled.proofDigest);
  assert.equal(targets.rows.length,359);assert.equal(targets.rows.filter(r=>r.category==='commandless-identity').length,163);assert.equal(targets.requiredUnsupported,0);assert.equal(targets.danglingCommands,0);assert.equal(targets.duplicateOwners,0);assert.deepEqual(targets.unknownObservations,[]);
  assert.deepEqual(targets.rows.map(r=>r.target),auditLearningTargets(manifest,[]).rows.map(r=>r.target));
  const input={targets,evidence:data.evidence,activities:data.activities,requiredActivityRefs:manifest.activityRefs.map(a=>a.id)};
  assert.deepEqual(learningCapabilityReadiness(manifest,input),data.readiness);assert.equal(data.readiness.learningReady,true);
  for(const e of data.evidence){assert(readFileSync(e.test,'utf8').length);const broken={...input,evidence:input.evidence.filter(x=>x.check!==e.check)};assert.equal(learningCapabilityReadiness(manifest,broken).learningReady,false);}
  assert.equal(learningCapabilityReadiness(manifest,{...input,requiredActivityRefs:[]}).learningReady,false);
  assert.equal(learningCapabilityReadiness(manifest,{...input,targets:{...targets,snapshotId:'wrong'}}).learningReady,false);
  assert.equal(data.runtime.runtimeReady,false);assert.deepEqual(data.runtime.unsupported,[{path:'requiredCapabilities',message:'Unsupported capability block.compat.teacher.v1'}]);
});
