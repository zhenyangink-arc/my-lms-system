import test from 'node:test';
import assert from 'node:assert/strict';
import {historyDb} from './fixtures/history-db.mjs';
import {capsule,capsules,compiled,manifest,source,scope,flowFixture,state} from './fixtures/runtime-4a9.mjs';
const {activityPages}=await import('../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {activityExecutions,boundActivityResponse}=await import('../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {patternExecutions,boundPatternCheck}=await import('../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {restoreActivityResponse,restorePatternResponses}=await import('../src/features/smart-textbook-runtime/server/history-response.server.ts');
const {createLearningHistoryReader}=await import('../src/features/smart-textbook-runtime/server/learning-history.server.ts');
const {createLearningFlow,createLearningPracticeStore}=await import('../src/features/smart-textbook-runtime/server/learning-flow.server.ts');
const {learningTools,openLearningDestination}=await import('../src/features/smart-textbook-runtime/server/learning-tools.server.ts');
const {serverModule}=await import('./fixtures/runtime-4a2.server.mjs');
const {recordingPlans}=await serverModule('src/features/smart-textbook-runtime/server/recording-binding.server.ts');
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import {RuntimeTargetRegistry} from '../src/features/smart-textbook-runtime/core/target-registry.ts';
import {runtimeReadiness} from '../src/features/smart-textbook-runtime/core/block-registry.ts';
const pages=key=>activityPages(compiled.bindings,compiled.services,capsule(key).id,'zh-CN');
const response=(page,wrong=false)=>page.items.map(i=>i.kind==='fill'?{kind:'fill',partId:i.partId,text:wrong?'틀림':'학습'}:{kind:'choice',partId:i.partId,optionId:i.options[wrong?1:0].id});

test('frozen 8 / 19 / three orientation, legacy v23, optional completion flags unchanged',()=>{
  assert.equal(manifest.steps.length,8);assert.equal(manifest.activityRefs.length,19);assert.equal(capsule('orientation').activities.length,3);assert.deepEqual(source.activities.filter(a=>!a.counts_toward_completion).map(a=>a.activity_key).sort(),['self-check','write-profile']);assert.equal(source.teachingVersions[0].version_number,23);
});
for(const key of ['grammar','listen_speak'])test(`${key}: every page check, correction, continue, aggregation and reload use existing grader`,async()=>{
  const {flow,authority,store}=await flowFixture(),c=capsule(key);
  for(const id of new Set(pages(key).map(p=>p.activityRef))){
    await assert.rejects(()=>flow.finishPages(c.id,id),/INCOMPLETE/);
    for(const p of pages(key).filter(p=>p.activityRef===id)){
      await assert.rejects(()=>flow.revealPage(c.id,p.pageId),/REQUIRES_CHECK/);
      assert.equal((await flow.pageCheck(c.id,p.pageId,response(p,true))).items.every(i=>i.correct),false);
      assert.equal((await flow.revealPage(c.id,p.pageId)).check.items.every(i=>i.correct),true);
    }
    const result=await flow.finishPages(c.id,id);assert.equal(result.ok,true);assert.equal(result.correct,true);assert.equal(result.preview,true);assert.equal(result.nodeCompleted,false);
  }
  const restored=await createLearningFlow(async()=>authority,store).restore(c.id);assert.equal(restored.pages.length,pages(key).length);assert(restored.pages.every(p=>p.ready));assert(restored.activities.every(a=>!a.completed));assert.equal(restored.practiceAcceptedRefs.length,new Set(pages(key).map(p=>p.activityRef)).size);
});
test('preview cannot persist pageIndex, scores or identities; unknown page refused',async()=>{
  const {flow,authority}=await flowFixture(),original=authority.check;authority.check=async input=>{assert(!('pageIndex'in input));return original(input);};const p=pages('grammar')[0];
  await flow.pageCheck(capsule('grammar').id,p.pageId,response(p));await assert.rejects(()=>flow.pageCheck(capsule('grammar').id,'missing',response(p)));
  await assert.rejects(()=>flow.pageCheck(capsule('grammar').id,p.pageId,[{...response(p)[0],score:100}]));
});
for(const key of ['pattern-choice','pattern-compose'])test(`${key}: wrong stays, accepted turns restore, complete original response vector`,async()=>{
  const {flow}=await flowFixture(),c=capsule('patterns'),id=c.activities.find(a=>a.activityKey===key).activityId,pattern=patternExecutions(manifest,compiled.bindings,c.id,'zh-CN').find(p=>p.ref===id);
  const responses=[];
  for(const t of pattern.turns.filter(t=>t.kind!=='line')){const r=t.kind==='choice'?{kind:'choice',partId:t.id,optionId:t.options[0].id}:{kind:'composition',partId:t.id,tokenIds:t.tokens.map(x=>x.id)};assert.equal((await flow.patternCheck(c.id,id,r)).correct,true);responses.push(r);}
  assert.equal((await flow.restore(c.id)).patterns[0].responses.length,responses.length);
  assert.equal((await flow.finishPattern(c.id,id,responses)).ok,true);
  await assert.rejects(()=>flow.finishPattern(c.id,id,responses.slice(1)),/COVERAGE/);
  const legacy=responses.flatMap(r=>boundPatternCheck(manifest,compiled.bindings,c.id,id,r).response);
  assert.deepEqual(restorePatternResponses(pattern,legacy),responses);
});
test('all supported activity responses round trip without private JSON',()=>{
  for(const c of capsules)for(const d of activityExecutions(manifest,compiled.bindings,c.id,'zh-CN')){
    let raw;if(d.kind==='single')raw=0;else if(d.kind==='ordering'||d.kind==='multiple')raw=d.options.map((_,n)=>n);else if(d.kind==='choice-group')raw=d.items.map(()=>0);else if(d.kind==='fill-group')raw=d.items.map(()=>'학습');else if(d.kind==='writing')raw={text:'안녕하세요. 저는 학생이에요.',informationKinds:d.checklist.map(()=>true),rubricConfirmed:true};else if(d.kind==='self-check'){const a=c.activities.find(x=>x.activityId===d.ref);raw={checks:d.items.map(()=>'can'),returnNodes:[a.settings.returnNodes.at(-1).value],note:''};}else continue;
    const restored=restoreActivityResponse(d,raw,compiled.bindings);assert.deepEqual(boundActivityResponse(d,restored,compiled.bindings),raw);
  }
});
function historyFixture(overrides={}){
  const c=capsule('grammar'),p=pages('grammar')[0],f=compiled.services.activityPages.find(x=>x.pageId===p.pageId),calls=[];
  const tables={digital_textbook_attempts:[{activity_id:p.activityRef,response:source.activities.find(x=>x.id===p.activityRef).public_config.items.map(()=>0),attempt_number:1,is_correct:true,score:100,meets_completion_requirements:true,created_at:'2026-09-10T00:00:00Z'}],digital_textbook_node_progress:[{node_id:c.nodeId,status:'completed',completion_percent:100}],digital_textbook_activity_page_progress:[{activity_id:p.activityRef,page_index:f.legacyPage,item_indices:f.items.map(x=>x.legacyItem),response:f.items.map(()=>0),results:f.items.map(()=>true)}],digital_textbook_guided_repeat_progress:compiled.services.guidedRepeat.map(r=>({activity_id:r.activityId,practice_key:'repeat-line',track_index:r.legacyTrack,segment_index:r.legacySegment})),...overrides};
  tables.digital_textbook_attempts=tables.digital_textbook_attempts.map((row,n)=>({id:`00000000-0000-4000-8000-${String(n+1).padStart(12,'0')}`,...row}));
  const db=historyDb(tables,calls);
  const authority={db,manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,scope,locale:'zh-CN',sessionId:'trusted',snapshotId:manifest.snapshot.id,recording:{load:async()=>[],restore:async()=>{throw Error('unexpected');}}};
  return {authority,calls,reader:createLearningHistoryReader(async()=>authority,{sessionId:'trusted',snapshotId:manifest.snapshot.id})};
}
test('real SELECT reader → private identities → authoritative state and stable page/repeat restore',async()=>{
  const {reader,calls}=historyFixture(),r=await reader(new AbortController().signal);assert.equal(r.capsules.length,8);assert.equal(r.server.completedStepIds.length,1);assert.equal(r.server.guidedRepeat[0].segmentIds.length,14);assert.equal(r.server.pageProgress.flatMap(p=>p.partIds).length,pages('grammar')[0].items.length);
  for(const call of calls){assert(call.filters.some(([k,v])=>k==='student_id'&&v===scope.actorId));assert(call.filters.some(([k,v])=>k==='tenant_id'&&v===scope.tenantId));assert(!/object|metadata|answers/.test(call.columns));}
  assert(!/answer_key|object_key|tenantId|studentId/.test(JSON.stringify(r)));
});
test('reader rejects unknown historical page, unknown node, wrong session/snapshot and errors',async()=>{
  for(const overrides of [{digital_textbook_node_progress:[{node_id:'unknown',status:'completed',completion_percent:100}]},{digital_textbook_activity_page_progress:[{activity_id:'unknown',page_index:0,item_indices:[],response:[],results:[]}]}])await assert.rejects(()=>historyFixture(overrides).reader(new AbortController().signal));
  for(const key of ['sessionId','snapshotId']){const f=historyFixture();f.authority[key]='wrong';await assert.rejects(()=>f.reader(new AbortController().signal),/SCOPE/);}
});
test('recording restore consumed rows are evidence only; no attempt or completion inferred',async()=>{
  const f=historyFixture({digital_textbook_attempts:[],digital_textbook_node_progress:[]}),c=capsule('dialogue'),plans=recordingPlans(manifest,compiled.bindings,c.id,'zh-CN');f.authority.recording={load:async ref=>ref===c.id?plans:[],restore:async()=>({recordings:[{id:'evidence-test',partId:plans[0].scenes[0].turns[0].partId,durationSeconds:3,mimeType:'audio/webm',state:'consumed',reusable:false}],completion:'already-completed',currentTurnId:null})};
  const r=await f.reader(new AbortController().signal);assert.equal(r.server.speakingEvidence.length,1);assert.equal(r.server.completedStepIds.length,0);assert.equal(r.server.attempts.length,0);
});
test('grammar nine pending assets stay TTS; two listening owners exactly bound',()=>{
  const g=learningTools(manifest,compiled.bindings,compiled.services,capsule('grammar').id),l=learningTools(manifest,compiled.bindings,compiled.services,capsule('listen_speak').id);
  assert.equal(g.playback.length,9);assert(g.playback.every(x=>x.kind==='browser-tts'&&!('mediaRef'in x)));assert.equal(l.playback.filter(x=>x.kind==='listening').length,2);assert([...g.playback,...l.playback].every(p=>manifest.runtimeTargets.find(t=>t.id===p.target)?.capabilities.includes('play')));
});
test('mounted real learning owner plays, disposed owner and wrong media rejected',async()=>{
  const tools=learningTools(manifest,compiled.bindings,compiled.services,capsule('listen_speak').id),owner=tools.playback[0],steps=new StepController(manifest,[],capsule('listen_speak').stepId),targets=new RuntimeTargetRegistry(manifest.runtimeTargets,steps);let count=0;
  targets.mount(owner.target,{dispose(){}});targets.mountLearningOwner(tools,owner.partId,async()=>{count++;});await targets.command(owner.target,'play');assert.equal(count,1);steps.next();await assert.rejects(()=>targets.command(owner.target,'play'));
  steps.go(capsule('listen_speak').stepId);const bad=structuredClone(tools);bad.playback[0].mediaRef='fake';assert.throws(()=>targets.mountLearningOwner(bad,owner.partId,async()=>{}),/MEDIA_SCOPE/);
});
test('chapter-test exact private binding + formal nodes + required activities + legacy gate',()=>{
  const c=capsule('review'),tools=learningTools(manifest,compiled.bindings,compiled.services,c.id,source.nodes),target=tools.navigation.find(n=>n.kind==='chapter-test').target;
  const ready={...state,revision:scope.sourceRevision,completedStepIds:manifest.steps.map(x=>x.id),activityProgress:compiled.bindings.activities.filter(x=>x.countsTowardCompletion).map(x=>({activityRef:x.ref,completed:true}))};
  assert.equal(openLearningDestination(manifest,compiled.bindings,compiled.services,scope,c.id,target,ready,true,source.nodes).path,'/dashboard/assignments/korean/korean-level-one-01');
  for(const [t,r,gate]of [['https://outside.test',ready,true],[target,state,true],[target,ready,false],[target,{...ready,activityProgress:[]},true]])assert.throws(()=>openLearningDestination(manifest,compiled.bindings,compiled.services,scope,c.id,t,r,gate,source.nodes));
});
test('preview store TTL/capacity fail closed; non-UI readiness still gates executable Renderer',async()=>{
  let now=1;const store=createLearningPracticeStore(()=>now);store('one',2);now=3;assert.throws(()=>store('one',2));for(let n=0;n<32;n++)store(String(n),100);assert.throws(()=>store('overflow',100));
  const r=runtimeReadiness(manifest,false);assert.equal(r.runtimeReady,false);
});
test('Korean-only legacy options stay visible in Chinese locale',()=>{
  for(const key of ['patterns','dialogue','review'])for(const d of activityExecutions(manifest,compiled.bindings,capsule(key).id,'zh-CN'))if('options'in d)assert(d.options.every(o=>o.text.trim()));
});
test('partial page history retains per-item result rather than inventing all-wrong feedback',async()=>{
  const p=pages('grammar')[0],f=compiled.services.activityPages.find(x=>x.pageId===p.pageId),r=await historyFixture({digital_textbook_activity_page_progress:[{activity_id:p.activityRef,page_index:f.legacyPage,item_indices:f.items.map(x=>x.legacyItem),response:f.items.map(()=>0),results:f.items.map((_,i)=>i===0)}]}).reader(new AbortController().signal);
  assert.deepEqual(r.capsules.find(c=>c.capsuleRef===capsule('grammar').id).pages[0].items.map(i=>i.correct),f.items.map((_,i)=>i===0));
});
test('return map frozen items resolve only server-owned current chapter nodes',()=>{
  const c=capsule('review'),tools=learningTools(manifest,compiled.bindings,compiled.services,c.id,source.nodes);
  const destinations=tools.navigation.filter(t=>t.kind==='step').map(t=>openLearningDestination(manifest,compiled.bindings,compiled.services,scope,c.id,t.target,state,false,source.nodes));
  assert.deepEqual(destinations.map(d=>d.stepId),['vocabulary','grammar','dialogue','listen_speak'].map(k=>capsule(k).stepId));
  assert.throws(()=>learningTools(manifest,compiled.bindings,compiled.services,c.id,[]),/RETURN_NODE_UNRESOLVED/);
});
test('unmounted production adapter executes real authorized Reader, rejects scope drift and reuses existing listening routes',async()=>{
  const h=historyFixture({digital_textbook_attempts:[],digital_textbook_node_progress:[]}),mediaCalls=[];
  const authDb={from(table){assert.equal(table,'digital_textbook_chapters');return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:manifest.chapter.id},error:null};}};}};
  globalThis.__learning9auth={user:{id:scope.actorId},tenant:{id:scope.tenantId},profile:null,supabase:authDb};
  globalThis.__learning9media=async(input,kind)=>{mediaCalls.push({input,kind});return kind==='audio'?new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/wav'}}):Response.json({transcript:'已授权隔离母稿'});};
  const overrides={
    '../../../lib/auth':'export async function requireActiveUser(){return globalThis.__learning9auth;}',
    '../../../lib/student-permissions':'export function canUseStudentFeature(){return true;}export function normalizeMembershipTier(){return "test";}',
    '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions':'export async function checkSmartTextbookActivityPageAction(){throw Error("unexpected check");}export async function saveGuidedRepeatProgressAction(){throw Error("unexpected write");}',
    '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission':'export async function submitSmartTextbookActivityForContext(){throw Error("unexpected mutation");}',
    '../../../app/api/digital-textbook/audio/[activityId]/route':'export async function GET(req,ctx){return globalThis.__learning9media({page:new URL(req.url).searchParams.get("page"),...(await ctx.params)},"audio");}',
    '../../../app/api/digital-textbook/transcript/[activityId]/route':'export async function GET(req,ctx){return globalThis.__learning9media({page:new URL(req.url).searchParams.get("page"),...(await ctx.params)},"transcript");}',
  };
  try{
    const {productionLearningPorts}=await serverModule('src/features/smart-textbook-runtime/server/production-learning.server.ts',overrides);
    let authorizationCount=0;const a={...h.authority,admin:h.authority.db,expiresAt:Date.now()+60000,request:new Request('http://isolated.test/runtime')};
    const ports=productionLearningPorts(async(user,tenant)=>{assert.equal(user,scope.actorId);assert.equal(tenant,scope.tenantId);authorizationCount++;return a;},{sessionId:'trusted',snapshotId:manifest.snapshot.id}),signal=new AbortController().signal;
    const projected=await ports.refresh(signal);assert.equal(projected.completedStepIds.length,0);assert.equal(projected.guidedRepeat[0].segmentIds.length,14);
    const c=capsule('listen_speak');for(const p of pages('listen_speak'))assert.equal((await ports.pages.audio(c.id,p.pageId,signal)).size,3);assert.deepEqual(mediaCalls.map(c=>c.input.page),['0','1']);
    await assert.rejects(()=>ports.pages.transcript(c.id,pages('listen_speak')[0].pageId,signal),/REQUIRES_CHECK/);
    for(const [key,value]of [['sessionId','wrong'],['snapshotId','wrong'],['expiresAt',0]]){const before=a[key];a[key]=value;await assert.rejects(()=>ports.refresh(signal),/SESSION_SCOPE/);a[key]=before;}
    globalThis.__learning9auth={...globalThis.__learning9auth,tenant:null};await assert.rejects(()=>ports.refresh(signal),/FORBIDDEN/);assert(authorizationCount>=6);
  }finally{delete globalThis.__learning9auth;delete globalThis.__learning9media;}
});
