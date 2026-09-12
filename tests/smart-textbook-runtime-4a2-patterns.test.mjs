import assert from 'node:assert/strict';
import test from 'node:test';
import { compiled,manifest } from './fixtures/runtime-4a.mjs';
import { existingPageChecker,serverModule } from './fixtures/runtime-4a2.server.mjs';
const {patternExecutions,boundPatternCheck,checkBoundPattern}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {patternCheckRequest}=await import('../src/features/smart-textbook-runtime/server/audit-requests.server.ts');
const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===manifest.steps[3].id),capsuleRef=block.props.capsuleRef;
const patterns=patternExecutions(manifest,compiled.bindings,capsuleRef,'zh-CN');

test('pattern DTO preserves eight conversation turns / four choices and six compositions with frozen IDs only',()=>{
  assert.equal(patterns.length,2);assert.equal(patterns[0].turns.length,8);assert.equal(patterns[0].turns.filter(t=>t.kind==='choice').length,4);assert.equal(patterns[1].turns.length,6);
  assert.doesNotMatch(JSON.stringify(patterns),/answer_key|object_key|audioAssetKey|choiceIndex|pageIndex|service_role/);
  const reordered=structuredClone(compiled.bindings);reordered.identities.reverse();assert.deepEqual(patternExecutions(manifest,reordered,capsuleRef,'zh-CN'),patterns);
  for(const p of patterns)for(const t of p.turns)assert.ok(compiled.bindings.identities.some(i=>i.owner===p.ref&&i.partId===t.id));
});
const check=await existingPageChecker();
for(const p of patterns)for(const [position,t] of p.turns.filter(t=>t.kind!=='line').entries())test(`${p.kind} frozen turn ${position+1}: real old checker, bool-only feedback, no persistence coordinates`,async()=>{
  const response=t.kind==='choice'?{kind:t.kind,partId:t.id,optionId:t.options[0].id}:{kind:t.kind,partId:t.id,tokenIds:t.tokens.map(t=>t.id)};
  const input=boundPatternCheck(manifest,compiled.bindings,capsuleRef,p.ref,response);
  assert.deepEqual(input.itemIndices,[position]);assert.deepEqual(Object.keys(input).sort(),['activityId','itemIndices','response']);
  const result=await checkBoundPattern(manifest,compiled.bindings,capsuleRef,p.ref,response,check);
  assert.deepEqual(result,{activityRef:p.ref,partId:t.id,correct:true,formalCompletion:false,progressDelta:null});
});
test('pattern binding rejects wrong capsule/activity/part/option/token and client score/index/completion injection',()=>{
  const p=patterns[0],t=p.turns.find(t=>t.kind==='choice'),valid={kind:'choice',partId:t.id,optionId:t.options[0].id};
  for(const change of [{partId:'unknown'},{optionId:'unknown'},{partId:p.turns[0].id},{score:1},{completion:true},{choiceIndex:0},{userId:'someone'}])assert.throws(()=>boundPatternCheck(manifest,compiled.bindings,capsuleRef,p.ref,{...valid,...change}));
  assert.throws(()=>boundPatternCheck(manifest,compiled.bindings,'unknown',p.ref,valid));assert.throws(()=>boundPatternCheck(manifest,compiled.bindings,capsuleRef,'unknown',valid));
  assert.throws(()=>boundPatternCheck(manifest,compiled.bindings,capsuleRef,patterns[1].ref,{kind:'composition',partId:patterns[1].turns[0].id,tokenIds:['unknown']}));
  const request={sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',capsuleRef,activityRef:p.ref,response:valid};
  for(const change of [{tenantId:'someone'},{pageIndex:0},{completionPercent:100},{preview:false}])assert.throws(()=>patternCheckRequest.parse({...request,...change}));
});
test('incorrect original check stays false; malformed domain result fails closed and private answers never escape',async()=>{
  const p=patterns[0],t=p.turns.find(t=>t.kind==='choice'),input={kind:'choice',partId:t.id,optionId:t.options[1].id};
  assert.equal((await checkBoundPattern(manifest,compiled.bindings,capsuleRef,p.ref,input,check)).correct,false);
  for(const value of [{ok:false},{ok:true,results:[]},{ok:true,results:['true']},{ok:true,results:[true,true]}])await assert.rejects(checkBoundPattern(manifest,compiled.bindings,capsuleRef,p.ref,input,async()=>value));
  const safe=await checkBoundPattern(manifest,compiled.bindings,capsuleRef,p.ref,input,async()=>({ok:true,results:[false],answers:['private-answer']}));assert.doesNotMatch(JSON.stringify(safe),/answers|private-answer/);
});
test('missing/duplicate frozen identity and wrong version reject before domain service',()=>{
  const p=patterns[0],t=p.turns.find(t=>t.kind==='choice'),response={kind:'choice',partId:t.id,optionId:t.options[0].id};
  for(const mutate of [b=>b.identities.splice(b.identities.findIndex(i=>i.partId===t.id),1),b=>b.identities.push(b.identities.find(i=>i.partId===t.id)),b=>{b.activities.find(a=>a.ref===p.ref).versionId='wrong';}]){
    const b=structuredClone(compiled.bindings);mutate(b);assert.throws(()=>boundPatternCheck(manifest,b,capsuleRef,p.ref,response));
  }
});
test('pattern check omits pageIndex even with non-preview auth; original write branch remains unreachable',async()=>{
  const studentCheck=await existingPageChecker({preview:false}),p=patterns[1],t=p.turns[0];
  const result=await checkBoundPattern(manifest,compiled.bindings,capsuleRef,p.ref,{kind:'composition',partId:t.id,tokenIds:t.tokens.map(t=>t.id)},studentCheck);assert.equal(result.correct,true);assert.equal(result.progressDelta,null);
});
test('new pattern audit actions reject non-owner before session access or delegated checks',async()=>{
  const actions=await serverModule('src/features/smart-textbook-runtime/server/audit-actions.ts',{
    '../../../lib/admin':'export async function requirePlatformOwner(){throw Error("NOT_PLATFORM_OWNER");}',
    './audit-session.server':'export function auditSession(){throw Error("UNAUTHORIZED_SESSION_ACCESS");}',
    './audit-teacher.server':'export async function auditTeacherTurn(){throw Error("UNEXPECTED_TEACHER_CALL");}',
    '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission':'export async function submitSmartTextbookActivityForContext(){throw Error("UNEXPECTED_SUBMIT");}',
    '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions':'export async function checkSmartTextbookActivityPageAction(){throw Error("UNEXPECTED_CHECK");}',
  });
  await assert.rejects(actions.auditPatterns({}),/NOT_PLATFORM_OWNER/);
  await assert.rejects(actions.auditCheckPattern({}),/NOT_PLATFORM_OWNER/);
});
