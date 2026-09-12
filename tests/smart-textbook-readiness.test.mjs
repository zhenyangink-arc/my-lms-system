import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const fixture=async name=>(await import(`./fixtures/smart-textbook-legacy-adapter/${name}.server.ts`)).default;
const source=await fixture('chapter-one-source'),ledger=await fixture('chapter-one-identities');
const history=await fixture('chapter-one-service-identities'),evidence=await fixture('chapter-one-service-evidence');
const {adaptChapterOneReadiness}=await import('../src/lib/smart-textbook-legacy-adapter/readiness.server.ts');
const {validatePrivateBindings}=await import('../src/lib/smart-textbook-legacy-adapter/bindings.server.ts');
const {validateLessonManifestV1}=await import('../src/lib/smart-textbook-runtime-v1/validator.ts');
const {readChapterOneServiceEvidence}=await import('../src/lib/smart-textbook-legacy-adapter/service-reader.server.ts');
const api=await import('../src/lib/smart-textbook-legacy-adapter/compatibility-services.server.ts');
const baseline=adaptChapterOneReadiness(source,ledger,history,evidence);
const b=baseline.services;
const scope={sourceRevision:b.sourceRevision,versionId:b.versionId,actorId:'student',tenantId:'tenant',authorized:true};
const validate=(services=b,manifest=baseline.manifest,bindings=baseline.bindings)=>validatePrivateBindings(manifest,bindings,{services,source,history,evidence,sourceRevision:b.sourceRevision});

test('14 original blockers: 11 resolved, three retained, both readiness flags false',()=>{
  assert.equal(baseline.originalUnsupported,14);assert.equal(baseline.resolved.length,11);
  assert.deepEqual(baseline.report.unsupported.map(e=>e.source.path).sort(),['configuration.studentTask','runtime.capabilities','speech.voiceTimeline']);
  assert.equal(baseline.nonUiRuntimeReady,false);assert.equal(baseline.report.runtimeReady,false);
  assert.deepEqual(validate(),[]);assert.equal(validateLessonManifestV1(baseline.manifest).success,true);
});
test('eight Steps, nineteen activities, orientation three questions and v23 legacy survive',()=>{
  assert.equal(baseline.manifest.steps.length,8);assert.equal(baseline.manifest.activityRefs.length,19);
  assert.equal(baseline.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.equal(baseline.manifest.teachingRefs[0].revision,'feb30ba7-0a5e-4e9f-83e6-8970f715ddd5');
  assert.equal(baseline.manifest.teachingRefs[0].mode,'legacy');assert.equal(baseline.manifest.blocks.some(b=>b.type==='video'),false);
});
test('all six accessibility fallbacks use explicit audioAssetKey-linked Korean text, stay pending',()=>{
  const node=source.nodes.find(n=>n.content.repeatLines);
  for(const asset of source.media.filter(a=>!Object.keys(a.alt_text).length)){
    const binding=baseline.bindings.media.find(b=>b.sourceId===asset.id);
    const media=baseline.manifest.mediaRefs.find(m=>m.id===binding.ref);
    const line=node.content.repeatLines.find(l=>l.audioAssetKey===asset.asset_key);
    assert.equal(media.alt['zh-CN'],`韩语跟读示范：${line.ko}`);
    assert.equal(media.readiness,'pending');assert.deepEqual(asset.alt_text,{});
  }
});
test('unlinked alt does not get a generic ready fallback',()=>{
  const s=structuredClone(source);s.media.find(a=>!Object.keys(a.alt_text).length).asset_key='not-linked';
  const r=adaptChapterOneReadiness(s,ledger,history,evidence);assert.ok(r.report.unsupported.some(x=>x.source.path==='alt_text'));
});
test('listening aliases resolve to explicit old activity/page and frozen domain track',()=>{
  for(const [alias,page] of [['chapter-01-listening-identity',0],['chapter-01-listening-dialogue-normal',1]]){
    const r=api.resolveListeningAlias(b,scope,alias);assert.equal(r.page,page);
    assert.ok(baseline.bindings.listening.some(t=>t.ref===r.trackId&&t.audioRef===r.mediaRef&&t.legacyPage===page));
  }
});
test('wrong alias, wrong revision and unauthorized listening scope rejected',()=>{
  assert.throws(()=>api.resolveListeningAlias(b,scope,'similar-listening-dialogue-normal'));
  assert.throws(()=>api.resolveListeningAlias(b,{...scope,sourceRevision:'wrong'},b.listeningAliases[0].alias));
  assert.throws(()=>api.resolveListeningAlias(b,{...scope,authorized:false},b.listeningAliases[0].alias));
});
test('adapter rejects mutated alias without silently resolving original path',()=>{
  const s=structuredClone(source);s.activities.find(a=>a.activity_type==='listening').public_config.audioId='unknown-alias';
  const r=adaptChapterOneReadiness(s,ledger,history,evidence);assert.ok(r.report.unsupported.some(x=>x.source.path==='public_config.audioId'));
});
for(const page of history.pages)test(`activity page/item roundtrip ${page.activityId}/${page.legacyPage}`,()=>{
  const row={activityId:page.activityId,versionId:history.versionId,pageIndex:page.legacyPage,itemIndices:page.items.map(i=>i.legacyItem),
    response:page.items.map((_,i)=>i),results:page.items.map(()=>false),answers:page.items.map(()=>0)};
  const projected=api.projectActivityPage(b,scope,row);
  assert.deepEqual(projected.items.map(i=>i.partId),page.items.map(i=>i.partId));
  const input=api.activityPageServiceInput(b,scope,projected.pageId,[...projected.items].reverse());
  assert.deepEqual(input,{activityId:row.activityId,pageIndex:row.pageIndex,itemIndices:row.itemIndices,response:row.response});
  assert.equal(api.projectPageChecks([projected]).formalCompletion,'existing-attempt-service');
});
test('page projection rejects unknown index, duplicate items and wrong version',()=>{
  const p=history.pages[0],row={activityId:p.activityId,versionId:history.versionId,pageIndex:p.legacyPage,itemIndices:p.items.map(i=>i.legacyItem),response:p.items.map(()=>0),results:p.items.map(()=>true),answers:p.items.map(()=>0)};
  assert.throws(()=>api.projectActivityPage(b,scope,{...row,versionId:'wrong'}));
  assert.throws(()=>api.projectActivityPage(b,scope,{...row,itemIndices:row.itemIndices.map(()=>999)}));
  assert.throws(()=>api.activityPageServiceInput(b,scope,p.pageId,p.items.map(()=>({partId:'missing',response:0}))));
});
test('activity item reorder leaves historical page/item identity and service semantics intact',()=>{
  const s=structuredClone(source);for(const a of s.activities.filter(a=>history.pages.some(p=>p.activityId===a.id)))a.public_config.items.reverse();
  const r=adaptChapterOneReadiness(s,ledger,history,evidence);assert.deepEqual(r.services.activityPages,b.activityPages);
  assert.equal(r.report.unsupported.some(e=>e.source.path==='progress.activity-page'),false);
});
test('all activity submission vectors preserve historical secret/grader positions',()=>{
  for(const activityId of new Set(history.pages.map(p=>p.activityId))){
    const items=history.pages.filter(p=>p.activityId===activityId).flatMap(p=>p.items);
    const responses=items.map(i=>({partId:i.partId,response:`response-${i.legacyItem}`})).reverse();
    const input=api.activitySubmissionInput(b,scope,activityId,responses,'zh-CN');
    assert.deepEqual(input.response,items.map(i=>`response-${i.legacyItem}`));
    assert.throws(()=>api.activitySubmissionInput(b,scope,activityId,responses.slice(1),'zh-CN'));
  }
});
test('page aggregation matches existing submit eligibility but never certifies completion',()=>{
  const input={isListening:true,isLastGrammarActivity:false,isLastPage:false,activityCompleted:false,currentResults:[true],checks:[{results:[true],revealed:false},{results:[false],revealed:false}]};
  assert.equal(api.legacyPageSubmitEligibility(input).maySubmit,false);
  assert.deepEqual(api.legacyPageSubmitEligibility({...input,checks:[{results:[true],revealed:false},{results:[false],revealed:true}]}),{maySubmit:true,formalCompletion:false});
  assert.equal(api.legacyPageSubmitEligibility({...input,isListening:false,isLastGrammarActivity:true,isLastPage:true}).maySubmit,true);
  assert.equal(api.legacyPageSubmitEligibility({...input,isLastPage:true,activityCompleted:true}).maySubmit,false);
});
test('guided repeat full track/segment roundtrip, restore historical rows and deduplicate completion',()=>{
  const rows=b.guidedRepeat.map(r=>api.guidedRepeatServiceInput(b,scope,r.trackId,r.segmentId));
  assert.deepEqual(api.projectGuidedRepeat(b,scope,[...rows,...rows]),b.guidedRepeat.map(r=>r.segmentId).sort());
  for(const [i,row] of rows.entries()){assert.equal(row.trackIndex,b.guidedRepeat[i].legacyTrack);assert.equal(row.segmentIndex,b.guidedRepeat[i].legacySegment);assert.equal(row.practiceKey,'repeat-line');}
});
test('guided repeat reorder preserves stable track/segment and old unique upsert key',()=>{
  const s=structuredClone(source),n=s.nodes.find(n=>n.content.repeatTracks);n.content.repeatTracks.reverse();for(const t of n.content.repeatTracks)t.lines.reverse();
  const r=adaptChapterOneReadiness(s,ledger,history,evidence);assert.deepEqual(r.services.guidedRepeat,b.guidedRepeat);
  assert.equal(r.report.unsupported.some(e=>e.source.path==='progress.guided-repeat'),false);
});
test('guided repeat unknown segment or practice rejected',()=>{
  const r=b.guidedRepeat[0];assert.throws(()=>api.guidedRepeatServiceInput(b,scope,r.trackId,'missing'));
  assert.throws(()=>api.projectGuidedRepeat(b,scope,[{activityId:r.activityId,practiceKey:'repeat-line',trackIndex:r.legacyTrack,segmentIndex:999}]));
  assert.throws(()=>api.projectGuidedRepeat(b,scope,[{activityId:r.activityId,practiceKey:'recording',trackIndex:r.legacyTrack,segmentIndex:r.legacySegment}]));
});
test('historical mapping edits fail explicit pinned digest certification',()=>{
  const h=structuredClone(history);h.pages[0].items[0].legacyItem=999;
  assert.ok(adaptChapterOneReadiness(source,ledger,h,evidence).report.unsupported.some(e=>e.source.path==='readiness.history'));
});
const playable=b.playback.find(p=>p.source==='authorized-listening');
const grant={...scope,sessionId:'session',snapshotId:baseline.manifest.snapshot.id,generation:1,target:playable.target,mediaRef:playable.mediaRef,expiresAt:2000};
const event={eventId:'b631ccac-4338-48df-9ef5-e0a6b550f2bc',sessionId:grant.sessionId,snapshotId:grant.snapshotId,generation:1,target:grant.target,mediaRef:grant.mediaRef,eventType:'media-ended'};
const memoryStore=()=>{const entries=new Map();return{async consumeOnce(key,hash){if(entries.has(key)){assert.equal(entries.get(key),hash);return'duplicate';}entries.set(key,hash);return'new';}};}; // test-only atomic store, not a renderer
test('teaching bridge media-ended is observation only; duplicate/replay cannot advance or score',async()=>{
  const store=memoryStore(),first=await api.observePlayback(b,grant,event,store,1000);
  assert.deepEqual(first,{accepted:true,duplicate:false,kind:'playback-observation',formalCompletion:false,progressDelta:null,agentAdvance:false});
  assert.equal((await api.observePlayback(b,grant,event,store,1000)).duplicate,true);
  assert.equal((await api.observePlayback(b,grant,{...event,eventId:'c631ccac-4338-48df-9ef5-e0a6b550f2bc'},store,1000)).duplicate,true);
});
test('TTS dialogue target exists but cannot play or certify audio_completed',()=>{
  const t=b.playback.find(p=>p.source==='browser-tts');assert.ok(baseline.manifest.runtimeTargets.some(x=>x.id===t.target));
  assert.throws(()=>api.resolvePlaybackTarget(b,scope,t.target),/no authorized media/);
});
for(const [name,patch] of Object.entries({media:{mediaRef:'wrong'},target:{target:'step:missing/block:missing'},generation:{generation:9},session:{sessionId:'wrong'},snapshot:{snapshotId:'wrong'},event:{eventType:'audio_completed'},score:{score:100}}))test(`playback rejects ${name} mismatch`,async()=>{
  await assert.rejects(api.observePlayback(b,grant,{...event,...patch},memoryStore(),1000));
});
test('playback expired grant rejected',async()=>{await assert.rejects(api.observePlayback(b,grant,event,memoryStore(),3000));});
test('speech 44 scanned; 28 verified and 16 stale segment-199 entries quarantined, not silently dropped',()=>{
  assert.equal(b.speech.length,28);assert.equal(b.speechRejected.length,16);
  assert.ok(b.speechRejected.every(s=>s.segment===199));
  for(const s of b.speech){assert.equal(api.resolveLegacySpeech(b,scope,{scriptVersionId:s.scriptVersionId,nodeId:s.nodeId,locale:s.locale,segment:s.segment}).assetId,s.assetId);}
});
test('speech wrong version/node/segment and rejected asset slots never resolve',()=>{
  const s=b.speech[0],q={scriptVersionId:s.scriptVersionId,nodeId:s.nodeId,locale:s.locale,segment:s.segment};
  for(const patch of [{scriptVersionId:'wrong'},{nodeId:'wrong'},{segment:199}])assert.throws(()=>api.resolveLegacySpeech(b,scope,{...q,...patch}));
  assert.doesNotMatch(JSON.stringify(api.resolveLegacySpeech(b,scope,q)),/object_key|objectKey|https:/);
});
test('speech hash corruption remains blocked with rejected diagnostics',()=>{
  const e=structuredClone(evidence);e.speech.find(x=>x.segment_index===0).cue_timeline[0].endMs=999999;
  const r=adaptChapterOneReadiness(source,ledger,history,e);assert.equal(r.services.speechRejected.length,17);
  assert.ok(r.report.unsupported.some(x=>x.source.path==='speech.voiceTimeline'));
});
test('private validator prevents laundering a rejected speech asset into verified bindings',async()=>{
  const {digest}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
  const s=structuredClone(b),rejected=s.speechRejected.shift(),asset=evidence.speech.find(a=>a.id===rejected.assetId);
  s.speech.push({assetId:asset.id,scriptVersionId:baseline.manifest.teachingRefs[0].revision,nodeId:asset.script_node_id,locale:asset.locale,segment:asset.segment_index,contentHash:asset.content_hash,timelineHash:digest(asset.cue_timeline),durationMs:asset.duration_ms,selectedByCurrentScript:true,authorization:'active-user-published-or-platform-owner'});
  assert.ok(validate(s).some(e=>/speech node\/segment\/revision mismatch/.test(e)));
});
test('review resolves only real internal chapter-test relation with server completion guard',()=>{
  const d=api.resolveChapterDestination(b,scope,'chapter-test:korean-level-one-01',true);
  assert.deepEqual(d,{kind:'chapter-test',testId:evidence.chapter.chapter_test_id,slug:'korean-level-one-01'});
  assert.throws(()=>api.resolveChapterDestination(b,scope,'chapter-test:korean-level-one-01',false));
  for(const k of ['https://example.com','javascript:alert(1)','/dashboard/evil','chapter-test:other'])assert.throws(()=>api.resolveChapterDestination(b,scope,k,true));
  assert.equal(baseline.manifest.steps.at(-1).nextStep,null);
});
for(const [name,mutate,pattern] of [
  ['revision',s=>s.sourceRevision='wrong',/revision/],
  ['listening-ref',s=>s.listeningAliases[0].mediaRef='missing',/listening alias/],
  ['listening-revision',s=>s.listeningAliases[0].revision='wrong',/revision/],
  ['missing-listening-alias',s=>s.listeningAliases.pop(),/coverage/],
  ['missing-playback-target',s=>s.playback.pop(),/coverage/],
  ['duplicate-identity',s=>s.guidedRepeat.push(s.guidedRepeat[0]),/duplicate/],
  ['progress-part',s=>s.activityPages[0].items[0].partId='missing',/part/],
  ['playback-media',s=>s.playback.find(x=>x.source==='authorized-listening').mediaRef='missing',/target\/media/],
  ['speech-node',s=>s.speech[0].nodeId='missing',/speech node/],
  ['speech-segment',s=>s.speech[0].segment=999,/speech node/],
  ['speech-version',s=>s.speech[0].scriptVersionId='wrong',/speech node/],
  ['navigation',s=>s.navigation[0].slug='https://example.com',/navigation/],
])test(`upgraded private validator rejects ${name}`,()=>{const s=structuredClone(b);mutate(s);assert.ok(validate(s).some(e=>pattern.test(e)));});
test('progress part removed from Manifest fails private validation',()=>{
  const m=structuredClone(baseline.manifest);m.runtimeTargets=m.runtimeTargets.filter(t=>t.partId!==b.activityPages[0].items[0].partId);
  assert.ok(validate(b,m).some(e=>/part missing/.test(e)));
});
test('semantic manifest, identity and conversion classification are deterministic with no input mutation',()=>{
  const before=JSON.stringify({source,ledger,history,evidence});assert.deepEqual(adaptChapterOneReadiness(source,ledger,history,evidence),baseline);
  const e=structuredClone(evidence);e.speech.reverse();assert.deepEqual(adaptChapterOneReadiness(source,ledger,history,e),baseline);
  assert.equal(JSON.stringify({source,ledger,history,evidence}),before);
});
test('public candidate has no secrets, object locations, transcripts or speech/capsule payload',()=>{
  const json=JSON.stringify(baseline.manifest);assert.doesNotMatch(json,/answer_key|object_key|objectKey|service.role|transcript|cue_timeline|teacher_script|virtualCharacter/);
  for(const a of source.media)if(a.object_key)assert.equal(json.includes(a.object_key),false);
});
test('supplemental Reader SELECTs only the current chapter and v23 audio identities',async()=>{
  const calls=[];const client={from(table){return{select(fields){calls.push({table,fields});return{eq(key,value){assert.equal(value,source.chapter.id);return{async single(){return{data:evidence.chapter,error:null}}}},async in(key,values){assert.deepEqual(values,source.teachingNodes.map(n=>n.id));return{data:evidence.speech,error:null}}}}}}};
  assert.deepEqual(await readChapterOneServiceEvidence(client,source),evidence);assert.equal(calls.length,2);
  assert.equal(calls.some(c=>/object_key|secret|transcript|voice_manifest/.test(c.fields)),false);
});
test('existing service evidence lines protect captured semantics (read only)',()=>{
  const base='src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/';
  const action=readFileSync(base+'smart-textbook-actions.ts','utf8');
  assert.match(action,/tenant_id,student_id,activity_id,version_id,page_index/);
  assert.match(action,/tenant_id,student_id,activity_id,practice_key,track_index,segment_index/);
  const ui=readFileSync(base+'KoreanLevelOneSmartTextbook.tsx','utf8');
  assert.match(ui,/String\(item.group \?\? item.groupKo \?\? "all"\)/);
  assert.match(ui,/new SpeechSynthesisUtterance\(text\)/);
  assert.match(ui,/chapterTestHref && progressPercent >= 100/);
});
