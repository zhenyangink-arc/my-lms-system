import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { compiled,manifest,context,source } from './fixtures/runtime-4a.mjs';
import { StepController } from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import { RuntimeTargetRegistry } from '../src/features/smart-textbook-runtime/core/target-registry.ts';
import { speakAuthorizedUtterance } from '../src/features/smart-textbook-runtime/core/playback.ts';
import { gradeComposite,existingPageChecker,teacherSession,serverModule } from './fixtures/runtime-4a2.server.mjs';
const {activityExecutions,boundActivityResponse}=await import('../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {projectPersistedHistory}=await import('../src/features/smart-textbook-runtime/server/progress-projection.server.ts');
const {activityPageServiceInput,guidedRepeatServiceInput}=await import('../src/lib/smart-textbook-legacy-adapter/compatibility-services.server.ts');
const {auditSpeechSelection,proxyAuthorizedSpeech,auditCharacterSelection,proxyAuthorizedCharacter}=await import('../src/features/smart-textbook-runtime/server/audit-speech.server.ts');
const {activityPages,boundPageResponse,checkBoundPage}=await import('../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {resolveAuditListening}=await import('../src/features/smart-textbook-runtime/server/listening-binding.server.ts');
const all=manifest.blocks.filter(b=>b.type==='compat.learning.v1').flatMap(b=>activityExecutions(manifest,compiled.bindings,b.props.capsuleRef,'zh-CN'));

test('all sixteen composite-owned activities scanned; three native orientation questions not duplicated',()=>{
  assert.equal(all.length,16);assert.equal(new Set(all.map(a=>a.ref)).size,16);assert.equal(all.length+manifest.blocks.filter(b=>b.type==='multiple_choice').length,19);
  assert.doesNotMatch(JSON.stringify(all),/answer_key|object_key|service_role|audioAssetKey|transcript/);
});
for(const key of ['vocabulary-check','grammar-choice','grammar-judgment','grammar-fill','pattern-order','dialogue-fact-check','dialogue-response','reading-profile','review-multiple'])test(`${key}: frozen response identities convert without a second grader`,()=>{
  const row=source.activities.find(a=>a.activity_key===key),a=all.find(a=>a.ref===row.id);assert.notEqual(a.kind,'unavailable');let response;
  if(a.kind==='single')response={kind:a.kind,optionId:a.options[0].id};
  else if(a.kind==='ordering'||a.kind==='multiple')response={kind:a.kind,optionIds:a.options.map(o=>o.id)};
  else if(a.kind==='choice-group')response={kind:a.kind,items:a.items.map(i=>({partId:i.id,optionId:i.options[0].id})).reverse()};
  else response={kind:a.kind,items:a.items.map(i=>({partId:i.id,text:'학습'})).reverse()};
  const value=boundActivityResponse(a,response);assert.ok(typeof value==='number'||Array.isArray(value));assert.throws(()=>boundActivityResponse(a,{...response,score:100}));
  if(response.items){const bad=structuredClone(response);bad.items[0].partId='unknown';assert.throws(()=>boundActivityResponse(a,bad));}
});
for(const a of all.filter(a=>!['unavailable','writing','self-check'].includes(a.kind)))test(`actual existing grader preview for ${source.activities.find(r=>r.id===a.ref).activity_key}`,async()=>{
  const response=a.kind==='single'?{kind:a.kind,optionId:a.options[0].id}:a.kind==='multiple'||a.kind==='ordering'?{kind:a.kind,optionIds:a.options.map(o=>o.id)}:a.kind==='choice-group'?{kind:a.kind,items:a.items.map(i=>({partId:i.id,optionId:i.options[0].id}))}:{kind:a.kind,items:a.items.map(i=>({partId:i.id,text:'학습'}))};
  const result=await gradeComposite(a.ref,response);assert.equal(result.ok,true);assert.equal(result.correct,true);assert.equal(result.preview,true);assert.equal(result.attemptNumber,1);assert.equal(result.nodeCompleted,false);assert.equal(result.completionPercent,0);
});

const historyScope={sourceRevision:compiled.services.sourceRevision,versionId:manifest.version.id,actorId:'history-test-student',tenantId:'history-test-tenant',authorized:true};
function persisted(){
  const identity={student_id:historyScope.actorId,tenant_id:historyScope.tenantId};
  return {attempts:[{...identity,activity_id:manifest.activityRefs[0].activityId,version_id:manifest.version.id,attempt_number:1,is_correct:true,score:100,meets_completion_requirements:true}],
    nodes:compiled.bindings.capsules.filter(c=>c.kind==='learning').map(c=>({...identity,node_id:c.nodeId,version_id:manifest.version.id,status:'in_progress',completion_percent:20})),
    pages:compiled.services.activityPages.map(p=>({...identity,activity_id:p.activityId,version_id:manifest.version.id,page_index:p.legacyPage,item_indices:p.items.map(i=>i.legacyItem),response:p.items.map(()=>0),results:p.items.map(()=>false),answers:p.items.map(()=>1)})),
    repeats:compiled.services.guidedRepeat.map(r=>({...identity,activity_id:r.activityId,practice_key:'repeat-line',track_index:r.legacyTrack,segment_index:r.legacySegment})),
    evidence:compiled.services.guidedRepeat.map(r=>({...identity,id:`evidence-${r.segmentId}`,activity_id:r.activityId,metadata:{practiceKey:'repeat-line',trackIndex:r.legacyTrack,segmentIndex:r.legacySegment}}))};
}
test('history subset: eight nodes, eight saved pages, two repeat tracks / fourteen segments and evidence; no private answers returned',()=>{
  const result=projectPersistedHistory(manifest,compiled.bindings,compiled.services,historyScope,persisted());
  assert.equal(result.nodes.length,8);assert.equal(result.pageProgress.length,8);assert.equal(result.guidedRepeat.length,14);assert.equal(new Set(result.speakingEvidence.map(e=>e.trackId)).size,2);assert.equal(result.speakingEvidence.length,14);assert.equal(result.attempts.length,1);assert.deepEqual(result.completedStepIds,[]);
  assert.doesNotMatch(JSON.stringify(result),/answers|object_key|student_id|tenant_id|transcript/);
});
test('history part → old page service and stable track/segment round trip survives private binding reordering',()=>{
  const rows=persisted(),a=projectPersistedHistory(manifest,compiled.bindings,compiled.services,historyScope,rows),reordered=structuredClone(compiled.services);reordered.activityPages.reverse();reordered.guidedRepeat.reverse();
  assert.deepEqual(projectPersistedHistory(manifest,compiled.bindings,reordered,historyScope,rows),a);
  for(const page of a.pageProgress){const call=activityPageServiceInput(reordered,historyScope,page.pageId,page.items.map(i=>({partId:i.partId,response:i.response})).reverse());const old=rows.pages.find(p=>p.activity_id===call.activityId&&p.page_index===call.pageIndex);assert.deepEqual(call.itemIndices,old.item_indices);assert.deepEqual(call.response,old.response);}
  for(const e of a.speakingEvidence){const call=guidedRepeatServiceInput(reordered,historyScope,e.trackId,e.segmentId);assert.ok(rows.repeats.some(r=>r.activity_id===call.activityId&&r.track_index===call.trackIndex&&r.segment_index===call.segmentIndex));}
});
for(const [name,mutate] of [
  ['wrong owner',r=>{r.attempts[0].student_id='other';}],['wrong version',r=>{r.nodes[0].version_id='other';}],
  ['unknown incomplete node',r=>{r.nodes[0].node_id='other';}],['unknown segment',r=>{r.repeats[0].segment_index=999;}],
  ['duplicate page',r=>r.pages.push(r.pages[0])],['private evidence object key',r=>{r.evidence[0].object_key='private';}],
])test(`history rejects ${name}`,()=>{const rows=persisted();mutate(rows);assert.throws(()=>projectPersistedHistory(manifest,compiled.bindings,compiled.services,historyScope,rows));});
test('unknown/missing capsule refuses, complex flow is not called implemented merely for displaying',()=>{
  assert.throws(()=>activityExecutions(manifest,compiled.bindings,'unknown','zh-CN'));
  assert.ok(all.some(a=>a.kind==='unavailable'));assert.throws(()=>boundActivityResponse(all.find(a=>a.kind==='unavailable'),{kind:'single',optionId:'x'}));
});
function owner(){return {kind:'authorized-browser-tts-owner/1',target:compiled.tts.target,snapshotId:compiled.tts.snapshotId,teachingRevision:compiled.tts.teachingRevision,utteranceId:compiled.tts.utteranceId,generation:0};}
test('real TTS owner temporarily owns play; generic handle remains rejected; Step dispose removes capability',async()=>{
  const s=new StepController(manifest),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s);let played=0;
  await assert.rejects(r.command(compiled.tts.target,'play'));
  const off=r.mountTtsOwner(owner(),async()=>{played++;});await assert.rejects(r.command(compiled.tts.target,'play'));
  r.mount(compiled.tts.target,{dispose(){}});await r.command(compiled.tts.target,'play');assert.equal(played,1);
  assert.throws(()=>r.mountTtsOwner(owner(),async()=>{}));s.next();await assert.rejects(r.command(compiled.tts.target,'play'));off();
});
for(const [key,value] of Object.entries({snapshotId:'wrong',teachingRevision:'wrong',generation:9,target:'step:x/block:y/part:z'}))test(`play owner wrong ${key} refuses`,()=>{
  const s=new StepController(manifest),r=new RuntimeTargetRegistry(manifest.runtimeTargets,s);assert.throws(()=>r.mountTtsOwner({...owner(),[key]:value},async()=>{}));
});
test('browser authorized onend produces only observation; cancellation/error never observes',async()=>{
  let utterance,observations=0;const services={issue:async()=>({grantId:'grant',text:'안녕하세요?',locale:'ko-KR',expiresAt:Date.now()+60000}),observe:async()=>{observations++;return {playbackObserved:true,duplicate:false,formalCompletion:false,progressDelta:null,score:null,agentAdvance:false,teachingPlaybackWaitSatisfied:true};}};
  const host={create:text=>({text}),speak:u=>utterance=u,cancel(){}};
  const a=new AbortController(),promise=speakAuthorizedUtterance(services,a.signal,host);await new Promise(r=>setTimeout(r,0));assert.equal(utterance.text,'안녕하세요?');utterance.onend();const result=await promise;assert.equal(result.formalCompletion,false);assert.equal(result.progressDelta,null);
  const b=new AbortController(),cancelled=speakAuthorizedUtterance(services,b.signal,host);await new Promise(r=>setTimeout(r,0));b.abort();await assert.rejects(cancelled);assert.equal(observations,1);
  const c=new AbortController(),failed=speakAuthorizedUtterance(services,c.signal,host);await new Promise(r=>setTimeout(r,0));utterance.onerror();await assert.rejects(failed);assert.equal(observations,1);
});
test('audit Teaching Bridge consumes Phase 3D grant once, satisfies only actual v23 task, and revokes stale generation',async()=>{
  const bundle=await build({entryPoints:['src/features/smart-textbook-runtime/server/audit-tts.server.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'test-marker',setup(b){b.onResolve({filter:/^server-only$/},()=>({path:'marker',namespace:'marker'}));b.onLoad({filter:/.*/,namespace:'marker'},()=>({contents:'export {};'}));}}]});
  const {auditTtsService,auditTtsOwner,observeAuditTts}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const session={ownerId:'test-owner',expiresAt:Date.now()+60000,data:{source,result:compiled},generation:0,revokedThrough:-1,busy:false,state:{scriptVersionId:compiled.tts.teachingRevision,currentNodeKey:'model-dialogue',teachingState:{},completedTaskEvents:[]},lastTurn:{phase:'task',cueId:compiled.tts.cueId,task:{target:compiled.tts.target}}};
  assert.deepEqual(auditTtsOwner(session),owner());const service=auditTtsService(session,'session'),caller={actorId:'test-owner',tenantId:'owner-audit:test-owner'};
  const grant=await service.issue(caller,{sessionId:'session'});assert.deepEqual(Object.keys(grant).sort(),['expiresAt','grantId','locale','text']);
  const result=await observeAuditTts(session,'session',grant.grantId);assert.equal(result.teachingPlaybackWaitSatisfied,true);assert.equal(session.state.completedTaskEvents.length,1);assert.equal(result.score,null);
  assert.equal((await observeAuditTts(session,'session',grant.grantId)).duplicate,true);assert.equal(session.state.completedTaskEvents.length,1);
  session.revokedThrough=0;assert.equal(auditTtsOwner(session),null);await assert.rejects(observeAuditTts(session,'session',grant.grantId));
});

test('speech slot is current server-selected turn only; rejects asset/URL injection and expired generation',()=>{
  const input={sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',cueId:compiled.tts.cueId,generation:0,kind:'buffer'};
  const session={expiresAt:Date.now()+60000,generation:0,revokedThrough:-1,lastTurn:{cueId:input.cueId,speechAssetId:'safe-normal',buffer:{assetId:'safe-buffer'}}};
  assert.equal(auditSpeechSelection(session,input),'safe-buffer');assert.equal(auditSpeechSelection(session,{...input,kind:'speech'}),'safe-normal');
  for(const change of [{assetId:'bad'},{object_key:'private'},{url:'https://evil.example'},{generation:2},{cueId:manifest.chapter.id}])assert.throws(()=>auditSpeechSelection(session,{...input,...change}));
  assert.throws(()=>auditSpeechSelection({...session,revokedThrough:0},input));assert.throws(()=>auditSpeechSelection({...session,expiresAt:0},input));
});
test('speech proxy preserves existing authorization and streams bytes, never signed URLs/private response metadata',async()=>{
  let authorized=0,requested;
  const request=new Request('http://local/speech',{headers:{Range:'bytes=0-2'}});
  const response=await proxyAuthorizedSpeech(request,async()=>{authorized++;return Response.json({audioUrl:'https://r2.example/private/key?signature=private',voiceManifest:{private:'metadata'}});},'https://r2.example',async(url,options)=>{
    requested=options;return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':'bytes 0-2/20',Location:'https://private.example','Set-Cookie':'secret=secret'}});
  });
  assert.equal(authorized,1);assert.equal(requested.redirect,'error');assert.equal(requested.headers.Range,'bytes=0-2');assert.equal(response.status,206);assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);
  assert.doesNotMatch(JSON.stringify([...response.headers]),/signature|key|private.example|Set-Cookie|secret/);
});
for(const [name,authorize,fetcher] of [
  ['unauthorized',async()=>new Response(null,{status:403}),async()=>{throw Error('Must not fetch');}],
  ['wrong origin',async()=>Response.json({audioUrl:'https://evil.example/a'}),async()=>{throw Error('Must not fetch');}],
  ['HTML body',async()=>Response.json({audioUrl:'https://r2.example/a'}),async()=>new Response('<script/>',{headers:{'Content-Type':'text/html'}})],
  ['upstream redirect',async()=>Response.json({audioUrl:'https://r2.example/a'}),async()=>new Response(null,{status:302})],
])test(`speech proxy rejects ${name}`,async()=>{await assert.rejects(proxyAuthorizedSpeech(new Request('http://local'),authorize,'https://r2.example',fetcher));});

test('all eight frozen activity pages → actual existing page action; no answers, indices or completion in returned check',async()=>{
  const check=await existingPageChecker(),pages=compiled.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>activityPages(compiled.bindings,compiled.services,c.id,'zh-CN'));
  assert.equal(pages.length,8);assert.equal(pages.filter(p=>p.listening).length,2);
  for(const page of pages){
    const input=page.items.map(i=>i.kind==='choice'?{kind:i.kind,partId:i.partId,optionId:i.options[0].id}:{kind:i.kind,partId:i.partId,text:'학습'}).reverse();
    const result=await checkBoundPage(compiled.services,historyScope,page,input,check);assert.equal(result.items.every(i=>i.correct),true);assert.equal(result.formalCompletion,false);assert.equal(result.progressDelta,null);
    assert.doesNotMatch(JSON.stringify(result),/answer|index|object_key|tenant|student/);
    assert.throws(()=>boundPageResponse(compiled.services,historyScope,page,[{...input[0],score:100},...input.slice(1)]));
    assert.throws(()=>boundPageResponse(compiled.services,historyScope,page,input.slice(1)));
  }
});
test('two listening tracks require current private binding, transcript gate requires server page check',()=>{
  const session=teacherSession(),capsule=compiled.bindings.capsules.find(c=>c.kind==='learning'&&c.activities.some(a=>a.activityKey==='listening-identity'));
  const pages=activityPages(compiled.bindings,compiled.services,capsule.id,'zh-CN');assert.equal(pages.length,2);
  for(const page of pages){
    const input={sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',capsuleRef:capsule.id,pageId:page.pageId,kind:'audio'};
    const result=resolveAuditListening(session,input);assert.equal(result.trackId,page.listening.trackId);
    assert.throws(()=>resolveAuditListening(session,{...input,kind:'transcript'}));
    session.pageChecks??=new Map();session.pageChecks.set(page.pageId,{pageId:page.pageId,items:[],formalCompletion:false,progressDelta:null});
    assert.equal(resolveAuditListening(session,{...input,kind:'transcript'}).trackId,result.trackId);
    for(const change of [{pageId:'unknown'},{capsuleRef:'unknown'},{object_key:'private'},{activityId:result.activityId}])assert.throws(()=>resolveAuditListening(session,{...input,...change}));
  }
  const changed=structuredClone(compiled);changed.services.listeningAliases.forEach(a=>a.revision='wrong');session.data.result=changed;
  assert.throws(()=>resolveAuditListening(session,{sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',capsuleRef:capsule.id,pageId:pages[0].pageId,kind:'audio'}));
});
test('legacy character pose is server-owned; redirect is resolved privately and never returns an object path',async()=>{
  const input={sessionId:'724b0b30-0e25-4f1e-b5e1-f0d2f2503483',cueId:compiled.tts.cueId,generation:0};
  const session={expiresAt:Date.now()+60000,generation:0,revokedThrough:-1,lastTurn:{cueId:input.cueId,character:{pose:'greeting'}}};
  assert.equal(auditCharacterSelection(session,input),'greeting');assert.throws(()=>auditCharacterSelection(session,{...input,pose:'listening'}));
  const response=await proxyAuthorizedCharacter(new Request('http://local'),async()=>new Response(null,{status:302,headers:{Location:'https://r2.example/private/object?signature=private'}}),'https://r2.example',async()=>new Response(new Uint8Array([1]),{headers:{'Content-Type':'image/png',Location:'private'}}));
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1]);assert.equal(response.headers.has('location'),false);assert.doesNotMatch(JSON.stringify([...response.headers]),/signature|object/);
  await assert.rejects(proxyAuthorizedCharacter(new Request('http://local'),async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/private'}}),'https://r2.example',async()=>{throw Error('No fetch');}));
});
for(const kind of ['speech','character','listening'])test(`non-owner ${kind} audit Route refuses before private reader or old media authorization`,async()=>{
  const overrides={
    '@/lib/admin':'export async function requirePlatformOwner(){throw Error("Not owner");}',
    '@/features/smart-textbook-runtime/server/audit-session.server':'export function auditSession(){throw Error("Reader must not run");}',
    '@/app/api/learning-agent/speech/[assetId]/route':'export function GET(){throw Error("Must not run");}',
    '@/app/api/learning-agent/characters/[pose]/route':'export function GET(){throw Error("Must not run");}',
    '@/app/api/digital-textbook/audio/[activityId]/route':'export function GET(){throw Error("Must not run");}',
    '@/app/api/digital-textbook/transcript/[activityId]/route':'export function GET(){throw Error("Must not run");}',
  };
  const {GET}=await serverModule(`src/app/api/smart-textbook-runtime-audit/${kind}/route.ts`,overrides);
  assert.equal((await GET(new Request('http://local'))).status,403);
});
test('audit private session cannot be used by a different authenticated owner',async()=>{
  const {createAuditSession,auditSession}=await serverModule('src/features/smart-textbook-runtime/server/audit-session.server.ts');
  const id=createAuditSession('authorized-owner',teacherSession().data);assert.ok(auditSession('authorized-owner',id));assert.throws(()=>auditSession('other-owner',id));
});
for(const kind of ['writing','self-check'])test(`${kind} uses unchanged open grader with stable responses, never objective score or preview completion`,async()=>{
  const a=all.find(a=>a.kind===kind);
  const input=kind==='writing'?{kind,text:'저는 학생입니다.',information:a.checklist.map(i=>({partId:i.id,checked:true})),rubricConfirmed:true}:{kind,checks:a.items.map(i=>({partId:i.id,value:'can'})),returnTargetIds:[a.returnTargets[0].id],note:''};
  const result=await gradeComposite(a.ref,input);assert.equal(result.ok,true);assert.equal(result.score,null);assert.equal(result.correct,null);assert.equal(result.nodeCompleted,false);assert.equal(result.preview,true);
  assert.throws(()=>boundActivityResponse(a,{...input,completionPercent:100},compiled.bindings));
  const bad=structuredClone(input);if(kind==='writing')bad.information[0].partId='unknown';else bad.returnTargetIds=['unknown'];assert.throws(()=>boundActivityResponse(a,bad,compiled.bindings));
  assert.doesNotMatch(JSON.stringify(a),/requiredPhraseGroups|minimumPhraseGroups|minimumHangulCharacters|returnNodes|answer_key/);
});
test('tracking-disabled omission of persistence pageIndex prevents old page action writes even after an auth-role change',async()=>{
  const check=await existingPageChecker({preview:false}),page=compiled.services.activityPages[0];
  const result=await check({activityId:page.activityId,itemIndices:page.items.map(i=>i.legacyItem),response:page.items.map(()=>0)});assert.equal(result.ok,true);
  await assert.rejects(check({activityId:page.activityId,pageIndex:page.legacyPage,itemIndices:page.items.map(i=>i.legacyItem),response:page.items.map(()=>0)}),/Unexpected table\/mutation/);
});
