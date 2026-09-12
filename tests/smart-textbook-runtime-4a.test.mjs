import {previousTargetContractDigest} from './fixtures/runtime-target-contract-history.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { compiled,manifest,content,context,state,flatten,gradePreview } from './fixtures/runtime-4a.mjs';
import { minimalManifest,blockManifest } from './fixtures/smart-textbook-runtime-v1/samples.mjs';
import { StepController } from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import { RuntimeTargetRegistry,elementTargetHandle } from '../src/features/smart-textbook-runtime/core/target-registry.ts';
import { rendererRegistry,runtimeReadiness,validateRuntimeActivation } from '../src/features/smart-textbook-runtime/core/block-registry.ts';
import { acceptServerState } from '../src/features/smart-textbook-runtime/core/services.ts';
const {projectLearningContent}=await import('../src/lib/smart-textbook-legacy-adapter/runtime-content.server.ts');
const {learningRequest,submitRequest,turnRequest}=await import('../src/features/smart-textbook-runtime/server/audit-requests.server.ts');
const file=p=>readFileSync(p,'utf8');

test('non UI proof intact; proven chapter capabilities activate, unimplemented video remains refused',()=>{
  assert.equal(compiled.nonUiRuntimeReady,true);assert.equal(runtimeReadiness(manifest,true).runtimeReady,true);
  assert.equal(validateRuntimeActivation(minimalManifest()).success,true);
  assert.equal(Object.keys(rendererRegistry).length,25);
  assert.deepEqual(Object.values(rendererRegistry).filter(r=>r.rendererStatus==='implemented').map(r=>r.type),['text','multiple_choice','compat.teacher.v1','compat.learning.v1']);
  assert.equal(validateRuntimeActivation(blockManifest('video')).success,false);
});
test('first chapter inventory, original semantic digest and v23 stay fixed',()=>{
  assert.equal(manifest.steps.length,8);assert.equal(manifest.activityRefs.length,19);assert.equal(manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.equal(previousTargetContractDigest(manifest),'sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f');
  assert.equal(manifest.teachingRefs[0].mode,'legacy');assert.equal(manifest.teachingRefs[0].revision,'feb30ba7-0a5e-4e9f-83e6-8970f715ddd5');assert.ok(!manifest.blocks.some(b=>b.type==='video'));
});
for(const step of manifest.steps)test(`scoped ${step.key}: actual content, frozen parts, no other Step payload`,()=>{
  const block=manifest.blocks.find(b=>b.stepId===step.id&&b.type==='compat.learning.v1'),c=content[block.props.capsuleRef],cards=flatten(c.cards);
  assert.equal(c.stepId,step.id);assert.ok(cards.length);assert.equal(new Set(cards.map(c=>c.partId)).size,cards.length);
  for(const card of cards)assert.ok(manifest.runtimeTargets.some(t=>t.blockId===block.id&&t.partId===card.partId),card.partId);
  assert.ok(!JSON.stringify(c).includes('answer_key'));assert.ok(!JSON.stringify(c).includes('object_key'));
});
test('vocabulary and grammar retain actual card counts and examples',()=>{
  const get=k=>content[manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.steps.find(s=>s.key===k).id).props.capsuleRef];
  assert.equal(get('vocabulary').cards.find(c=>c.title==='核心词汇').children.length,12);
  assert.equal(get('grammar').cards.find(c=>c.title==='语法理解').children.length,3);
  assert.equal(get('orientation').cards.find(c=>c.title==='对话练习').children.length,4);
});
test('missing frozen nested identity rejects instead of positional fallback',()=>{
  const b=structuredClone(compiled.bindings);b.identities=[];
  assert.throws(()=>projectLearningContent(b,Object.keys(content)[0],'zh-CN'),/FROZEN/);
});
test('Step entry/resume/next/previous/free navigation never completes',()=>{
  const s=new StepController(manifest);assert.equal(s.activeStepId,manifest.navigation.entryStep);s.next();assert.equal(s.activeStepId,manifest.steps[1].id);s.previous();assert.equal(s.activeStepId,manifest.steps[0].id);
  assert.equal(new StepController(manifest,[],manifest.steps[5].id).activeStepId,manifest.steps[5].id);
  assert.equal(new StepController(manifest,[],'page:5').activeStepId,manifest.steps[0].id);assert.throws(()=>s.go('unknown'));
});
test('completed-prefix uses only supplied server state; snapshot invalidates completion updates',()=>{
  const m=structuredClone(manifest);m.navigation.access='completed-prefix';const s=new StepController(m);
  assert.throws(()=>s.next());const before=s.snapshot();s.serverCompletion([m.steps[0].id]);assert.notEqual(s.snapshot(),before);s.next();assert.throws(()=>s.next());
});
test('Step switch aborts lease, invokes every disposer exactly once; exceptions do not stop release',()=>{
  const s=new StepController(manifest),lease=s.lease();let count=0;s.onDispose(()=>{count++;throw Error('one');});s.onDispose(()=>count++);s.next();assert.equal(count,2);assert.equal(lease.signal.aborted,true);assert.equal(s.isCurrent(lease),false);s.dispose();assert.equal(count,2);
});
test('targets mount only current declared identities and allowed commands; duplicate/unavailable refused',async()=>{
  const s=new StepController(manifest),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s),t=manifest.runtimeTargets[0];let calls=0;
  const off=r.mount(t.id,{focus:()=>calls++,dispose:()=>calls++});
  assert.throws(()=>r.mount(t.id,{dispose(){}}));await r.command(t.id,'focus');assert.equal(calls,1);
  await assert.rejects(r.command(t.id,'play'));await assert.rejects(r.command('#css-selector','focus'));
  off();off();assert.equal(calls,2);await assert.rejects(r.command(t.id,'focus'));
});
test('target generation stale promise rejects and Step disposes mounted handles',async()=>{
  const s=new StepController(manifest),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s),t=manifest.runtimeTargets[0];let resolve,disposed=0;
  r.mount(t.id,{focus:()=>new Promise(r=>resolve=r),dispose:()=>disposed++});const pending=r.command(t.id,'focus');s.next();resolve();await assert.rejects(pending,/STALE/);assert.equal(disposed,1);assert.equal(r.has(t.id),false);
});
test('element reveal/focus/highlight use handles, bounded highlight cancels on dispose/abort',()=>{
  const attrs=new Set();let reveal=0,focus=0;const el={setAttribute:k=>attrs.add(k),removeAttribute:k=>attrs.delete(k),focus:()=>focus++,scrollIntoView(){}};
  const h=elementTargetHandle(el,['reveal','focus','highlight','open'],()=>reveal++),a=new AbortController();h.reveal(a.signal);h.focus(a.signal);h.highlight(a.signal);assert.ok(attrs.has('data-runtime-highlight'));assert.equal(focus,1);assert.equal(reveal,3);a.abort();assert.equal(attrs.size,0);h.dispose();
});
test('server state refuses wrong snapshot, private injection; copies all domain projections',()=>{
  assert.deepEqual(acceptServerState(context,state),state);assert.throws(()=>acceptServerState(context,{...state,snapshotId:'wrong'}));
  assert.throws(()=>acceptServerState(context,{...state,object_key:'private'}));const copy=acceptServerState(context,state);copy.completedStepIds.push('x');assert.equal(state.completedStepIds.length,0);
});
for(const block of manifest.blocks.filter(b=>b.type==='multiple_choice'))test(`orientation ${block.id}: original server grader, attempt feedback, no write transport`,async()=>{
  const a=manifest.activityRefs.find(a=>a.id===block.props.activityRef),r=await gradePreview(a.id,a.publicPresentation.options[0].id);
  assert.equal(r.ok,true);assert.equal(r.correct,true);assert.equal(r.attemptNumber,1);assert.equal(r.preview,true);assert.equal(r.nodeCompleted,false);assert.equal(r.completionPercent,0);
  assert.equal((await gradePreview(a.id,a.publicPresentation.options[1].id)).correct,false);
  await assert.rejects(gradePreview(a.id,'unbound-response'));
});
test('public display payload contains no binding secrets or internal media locations',()=>{
  const value=JSON.stringify({manifest,content,state});assert.doesNotMatch(value,/answer_key|object_key|service_role|privateTranscript|audio_object_key|signedUrl/);
});
test('owner guard precedes audit read; every action has owner guard and strict requests',()=>{
  const page=file('src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/runtime-v1-preview/page.tsx');assert.ok(page.indexOf('await requirePlatformOwner')<page.indexOf('await readAuditSource'));
  const actions=file('src/features/smart-textbook-runtime/server/audit-actions.ts');assert.equal((actions.match(/await requirePlatformOwner\(\)/g)||[]).length,(actions.match(/export async function/g)||[]).length);assert.match(actions,/preview:true/);assert.match(actions,/submitRequest.parse/);
});
test('audit request accepts real prefixed capsule/teaching IDs; rejects client completion/score/owner injection',()=>{
  const common={sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',locale:'zh-CN'},capsuleRef=manifest.blocks.find(b=>b.type==='compat.learning.v1').props.capsuleRef;
  assert.equal(learningRequest.safeParse({...common,capsuleRef}).success,true);
  assert.equal(turnRequest.safeParse({...common,teachingRef:manifest.teachingRefs[0].id,generation:0,intent:'start'}).success,true);
  const ref=manifest.blocks.find(b=>b.type==='multiple_choice').props.activityRef;
  const a=manifest.activityRefs.find(a=>a.id===ref),request={...common,activityRef:a.id,response:a.publicPresentation.options[0].id};
  assert.equal(submitRequest.safeParse(request).success,true);
  for(const key of ['score','completion','tenantId','userId','preview','object_key','answer_key'])assert.equal(submitRequest.safeParse({...request,[key]:'injected'}).success,false);
  assert.equal(learningRequest.safeParse({...common,capsuleRef:'#dom'}).success,false);
});
test('no second navigation or old Shell embedded; compatibility remains scoped and visibly incomplete',()=>{
  for(const path of ['learning-content','teacher-block']){const code=file(`src/features/smart-textbook-runtime/components/${path}.tsx`);assert.doesNotMatch(code,/\bSmartTextbookShell\b|\bContentRenderer\b|<nav|new StepController|create.*Session/);}
  assert.match(file('src/features/smart-textbook-runtime/server/audit-teacher.server.ts'),/resolveScriptStep/);
  assert.match(file('src/features/smart-textbook-runtime/server/audit-teacher.server.ts'),/resolveBufferLineSpeechAssetId/);
  assert.doesNotMatch(file('src/features/smart-textbook-runtime/components/teacher-block.tsx'),/audio_completed|onend\s*=/);
});
