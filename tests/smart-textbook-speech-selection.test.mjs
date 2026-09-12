import {previousTargetContractDigest,previousTargetProofDigest} from './fixtures/runtime-target-contract-history.mjs';
import './fixtures/smart-textbook-legacy-adapter/register-server-only.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
const {selectBufferSpeech,selectBufferSpeechIds,BUFFER_CANDIDATE_COLUMNS,bufferTextHash}=await import('../src/lib/learning-agent-buffer-selection.server.ts');
const {bufferPairForStage,bufferSpeechAssetForRequest}=await import('../src/lib/learning-agent-buffer-state.ts');
const {LEARNING_AGENT_BUFFER_PRESETS}=await import('../src/lib/learning-agent-buffer-presets.ts');
const fixture=async n=>(await import(`./fixtures/smart-textbook-legacy-adapter/chapter-one-${n}.server.ts`)).default;
const source=await fixture('source'),ledger=await fixture('identities'),history=await fixture('service-identities'),evidence=await fixture('service-evidence');
const {finalizeChapterOneNonUiReadiness}=await import('../src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
const {validatePrivateBindings}=await import('../src/lib/smart-textbook-legacy-adapter/bindings.server.ts');
const base=finalizeChapterOneNonUiReadiness(source,ledger,history,evidence);
const frozenProof=await fixture('speech-selection-proof');
const version={id:'version',status:'published'},node={id:'node',scriptVersionId:'version',configuration:{bufferLine:{'zh-CN':'  已有自定义台词。  ','ko-KR':'한국어'}}};
const asset={id:'asset',script_node_id:'node',locale:'zh-CN',segment_index:199,production_status:'ready',content_hash:bufferTextHash('已有自定义台词。')};
const select=(changes={})=>selectBufferSpeech({version,node,locale:'zh-CN',candidates:[asset],...changes});
test('exact normalized text/hash selects verified asset',()=>{
  const s=select();assert.equal(s.kind,'verified-asset');assert.equal(s.selectedSpeechAssetId,'asset');assert.equal(s.expectedText,'已有自定义台词。');
});
for(const [field,value] of Object.entries({content_hash:'0'.repeat(64),script_node_id:'other',locale:'ko-KR',segment_index:0,production_status:'pending'}))test(`candidate wrong ${field} rejected, null uses existing fallback`,()=>{
  const s=select({candidates:[{...asset,[field]:value}]});assert.equal(s.kind,'existing-browser-tts-fallback');assert.equal(s.selectedSpeechAssetId,null);assert.deepEqual(s.rejectedCandidateIds,['asset']);
});
for(const changes of [{version:{id:'other',status:'published'}},{version:{id:'version',status:'draft'}},{node:{...node,scriptVersionId:'other'}},{expectedText:'different text'}])test(`unverified context rejected: ${JSON.stringify(changes)}`,()=>assert.equal(select(changes).kind,'unsupported'));
test('draft is accepted only with explicit already-authorized owner preview context',()=>{
  assert.equal(select({version:{...version,status:'draft'},audience:'authorized-owner-preview'}).kind,'verified-asset');
});
test('existing owner archived-version preview remains supported, never exposed as student published',()=>{
  assert.equal(select({version:{...version,status:'archived'},audience:'authorized-owner-preview'}).kind,'verified-asset');
  assert.equal(select({version:{...version,status:'archived'}}).kind,'unsupported');
});
test('exact preset wins over wrong hash and matching asset alike',()=>{
  const preset=LEARNING_AGENT_BUFFER_PRESETS.find(p=>p.id==='teacher-introduction');
  const n={...node,configuration:{bufferLine:preset.text,bufferPresetId:preset.id}};
  for(const content_hash of ['0'.repeat(64),bufferTextHash(preset.text['zh-CN'])]){
    const s=select({node:n,candidates:[{...asset,content_hash}]});assert.equal(s.kind,'preset');assert.equal(s.selectedSpeechAssetId,'buffer-preset:teacher-introduction:zh-CN');
  }
});
test('configured preset/text conflict never guesses or selects an asset',()=>{
  const s=select({node:{...node,configuration:{...node.configuration,bufferPresetId:'teacher-introduction'}}});
  assert.equal(s.kind,'existing-browser-tts-fallback');assert.equal(s.selectedSpeechAssetId,null);assert.match(s.reason,/conflict/);
});
test('none with nonempty text also refuses asset and preset',()=>assert.equal(select({node:{...node,configuration:{...node.configuration,bufferPresetId:'none'}}}).selectedSpeechAssetId,null));
test('missing asset enters existing null-ID fallback',()=>assert.equal(select({candidates:[]}).kind,'existing-browser-tts-fallback'));
test('empty buffer remains silent despite ready asset',()=>assert.equal(select({node:{...node,configuration:{bufferLine:{'zh-CN':''},bufferPresetId:'none'}}}).kind,'silent'));
test('multiple valid assets are ambiguous, never depend on query row order',()=>assert.equal(select({candidates:[asset,{...asset,id:'second'}]}).kind,'unsupported'));

const loader=readFileSync('src/lib/smart-digital-textbook.ts','utf8');
const uiPath='src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx';
const ui=readFileSync(uiPath,'utf8');
// Execute the actual production query/projection blocks with SELECT-only fake DB results.
// No reimplementation of the loader policy or React renderer in tests.
async function executeLoaderBlock(active,nodes,rows){
  const statements=active?loader.slice(loader.indexOf('    const resolvedSessionNodeIds ='),loader.indexOf('    for (const { session, resolvedNode, segmentIndex }'))
    :loader.slice(loader.indexOf('  const openingNodeIds ='),loader.indexOf('  const openingLessonModuleById ='));
  const calls=[];
  const admin={from(table){assert.equal(table,'learning_agent_script_audio_assets');const query={select(columns){calls.push(columns);return query;},in(){return query;},eq(){return query;},then(resolve){return Promise.resolve({data:rows}).then(resolve);}};return query;}};
  const input={admin,BUFFER_CANDIDATE_COLUMNS,selectBufferSpeechIds,
    openingNodeIdByVersionId:new Map(nodes.map(n=>[n.script_version_id,n.id])),openingFirstNodes:nodes,openingScriptVersions:[version],
    resolvedSessionStages:nodes.map(n=>({resolvedNode:{id:n.id,scriptVersionId:n.script_version_id,configuration:n.configuration}}))};
  const name=active?'activeSessionBufferSpeechAssetIdsByNodeId':'bufferSpeechAssetIdsByNodeId';
  const code=stripTypeScriptTypes(`async function run(){${statements}\n return ${name};}`);
  const run=new Function(...Object.keys(input),`${code};return run();`);
  const result=await run(...Object.values(input));assert.deepEqual(calls,[BUFFER_CANDIDATE_COLUMNS]);return result;
}
for(const path of ['opening','active-session','resume','re-entry','restart','reset','terminal-restore'])test(`${path}: real loader query never forwards wrong-hash ready 199`,async()=>{
  const active=!['opening','restart'].includes(path);
  const n={id:'node',script_version_id:'version',configuration:path==='terminal-restore'?{bufferLine:{'zh-CN':''},terminal:true}:node.configuration};
  const rows=await executeLoaderBlock(active,[n],[{...asset,content_hash:'0'.repeat(64)}]);
  const stage={bufferLine:n.configuration.bufferLine,bufferSpeechAssetId:rows.get('node')};
  const pair=bufferPairForStage('zh-CN',stage,active?stage:null);
  assert.equal(pair.assetId,null);assert.equal(pair.text,path==='terminal-restore'?'':'已有自定义台词。');
});
test('opening loader publishes preset ahead of mismatched ready 199',async()=>{
  const p=LEARNING_AGENT_BUFFER_PRESETS[1];const n={id:'node',script_version_id:'version',configuration:{bufferLine:p.text,bufferPresetId:p.id}};
  const rows=await executeLoaderBlock(false,[n],[asset]);assert.equal(rows.get('node')['zh-CN'],'buffer-preset:teacher-introduction:zh-CN');
});
test('restored empty or missing media never inherits opening asset or another locale',()=>{
  const opening={bufferLine:{'zh-CN':'opening'},bufferSpeechAssetId:{'zh-CN':'opening-id'}};
  const resumed={bufferLine:{'zh-CN':'custom'},bufferSpeechAssetId:{'ko-KR':'other-language'}};
  assert.deepEqual(bufferPairForStage('zh-CN',opening,resumed),{text:'custom',assetId:null});
  resumed.bufferLine['zh-CN']='';assert.deepEqual(bufferPairForStage('zh-CN',opening,resumed),{text:'',assetId:null});
  assert.equal(bufferSpeechAssetForRequest(null,'opening-id'),null);
});
test('transition resolver executes shared selector and validates actual version query',async()=>{
  const runtime=readFileSync('src/lib/learning-agent-script-runtime.ts','utf8');
  const statement=runtime.slice(runtime.indexOf('export async function resolveBufferLineSpeechAssetId('),runtime.indexOf('export function taskEventKey'));
  const code=stripTypeScriptTypes(statement.replace('export async','async'));
  const resolve=new Function('selectBufferSpeech','BUFFER_CANDIDATE_COLUMNS','BUFFER_LINE_SEGMENT_INDEX',`${code};return resolveBufferLineSpeechAssetId;`)(selectBufferSpeech,BUFFER_CANDIDATE_COLUMNS,199);
  const calls=[];
  const admin={from(table){calls.push(table);const q={select(){return q},eq(){return q},maybeSingle(){return Promise.resolve({data:version})},then(f){return Promise.resolve({data:[{...asset,content_hash:'0'.repeat(64)}]}).then(f)}};return q;}};
  assert.equal(await resolve(admin,{...node,script_version_id:'version'},'zh-CN','已有自定义台词。'),null);
  assert.deepEqual(calls,['learning_agent_script_versions','learning_agent_script_audio_assets']);
});
test('current null-ID fallback is executable TTS/text, no client preset or locale re-selection',()=>{
  assert.match(ui,/const activeBufferSpeechAssetId = requestedBufferSpeechAssetId;/);
  assert.match(ui,/: browserSpeechFallback\(\);/);
  assert.match(ui,/catch\(\(\) => requestAbortController.signal.aborted \? undefined : browserSpeechFallback\(\)\)/);
  assert.match(ui,/audio.onerror = \(\) => finish\("error"\)/);
  assert.doesNotMatch(ui,/bufferPresetAssetRef|learningAgentBufferPresetAssetRef/);
});
test('terminal completion stays separate from activity progress and loader restores only active sessions',()=>{
  const respond=readFileSync('src/app/api/learning-agent/respond/route.ts','utf8');
  assert.match(respond,/scriptedSessionCompleted = resolved.isFinalStep/);
  assert.match(respond,/scriptedSessionCompleted \? "completed" : "active"/);
  assert.match(loader,/eq\("status", "active"\)/);
  const terminal=source.teachingNodes.find(n=>n.configuration.terminal);
  assert.equal(terminal.node_key,'ready-for-practice');
  assert.ok(base.speech.proofs.filter(p=>p.nodeId===terminal.id&&p.segment===199).every(p=>p.selectionMode==='silent'));
});
test('8 Steps, 19 Activities, orientation three, published v23 and legacy mode preserved',()=>{
  assert.equal(base.manifest.steps.length,8);assert.equal(base.manifest.activityRefs.length,19);assert.equal(base.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.equal(source.teachingVersions[0].version_number,23);assert.equal(base.manifest.teachingRefs[0].mode,'legacy');assert.equal(base.manifest.blocks.some(b=>b.type==='video'),false);
  assert.equal(previousTargetContractDigest(base.manifest),'sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f');
});
test('all current paths covered and only Renderer continues to block Runtime',()=>{
  assert.equal(base.remainingNonUiUnsupported.length,0);assert.equal(base.nonUiRuntimeReady,true);assert.equal(base.runtimeReady,false);
  assert.deepEqual(base.report.unsupported.map(p=>p.source.path),['runtime.capabilities']);
  assert.equal(base.speech.proofs.filter(p=>p.segment===199).length,70);
  assert.equal(base.speech.proofs.some(p=>p.proofStatus==='unsupported'),false);
  for(const n of source.teachingNodes)for(const locale of ['zh-CN','ko-KR'])for(const path of ['resume-loader','resume-reentry','reset',...(n.sort_order===1?['opening-loader','restart']:['buffer-transition']),...(n.configuration.terminal?['terminal-restore','terminal-completed']:[])])
    assert.equal(base.speech.proofs.filter(p=>p.nodeId===n.id&&p.locale===locale&&p.path===path).length,1);
});
test('16 old candidates rejected, not deleted/stale; 28 verified non-199 unchanged',()=>{
  assert.equal(base.speech.historical199.length,16);assert.ok(base.speech.historical199.every(p=>p.classification==='candidate-but-rejected'));
  assert.equal(base.speech.selectableAssetIds.length,28);
  assert.ok(base.speech.historical199.every(p=>!base.speech.selectableAssetIds.includes(p.assetId)));
  assert.equal(base.speech.proofs.filter(p=>p.segment!==199&&p.proofStatus==='verified-asset').length,28);
});
for(const [label,mutate] of [
  ['missing reachable cue',s=>s.proofs.pop()],['duplicate selection',s=>s.proofs.push(s.proofs[0])],
  ['hash mismatch',s=>s.proofs[0].expectedTextHash='0'.repeat(64)],['preset mismatch',s=>s.proofs.find(p=>p.preset).preset='fake'],
  ['invented fallback',s=>s.proofs[0].fallbackMode='new-product-fallback'],
  ['unvalidated candidate selected',s=>{s.proofs.find(p=>p.segment===199).selectedAssetId=s.historical199[0].assetId;}],
  ['rejected asset in catalog',s=>s.selectableAssetIds.push(s.historical199[0].assetId)],
])test(`private bindings reject ${label}`,()=>{
  const speech=structuredClone(base.speech);mutate(speech);
  assert.ok(validatePrivateBindings(base.manifest,base.bindings,{services:base.services,source,history,evidence,sourceRevision:base.report.sourceRevision,finalProof:{tts:base.tts,speech}}).length);
});
test('unresolved current revision still blocks readiness',()=>{
  const s=structuredClone(source);s.teachingNodes[0].script_version_id='00000000-0000-4000-8000-000000000099';
  const r=finalizeChapterOneNonUiReadiness(s,ledger,history,evidence);assert.equal(r.nonUiRuntimeReady,false);assert.equal(r.runtimeReady,false);
});
test('same evidence/revision reproduces all proofs, TTS binding, classifications and digest',()=>{
  const before=JSON.stringify({source,evidence,history,ledger});
  assert.deepEqual(finalizeChapterOneNonUiReadiness(source,ledger,history,evidence),base);
  const e=structuredClone(evidence);e.speech.reverse();assert.deepEqual(finalizeChapterOneNonUiReadiness(source,ledger,history,e),base);
  assert.equal(JSON.stringify({source,evidence,history,ledger}),before);
  assert.deepEqual({sourceRevision:base.report.sourceRevision,readinessRevision:base.readinessRevision,proofDigest:previousTargetProofDigest(base),speech:base.speech},frozenProof);
});
test('Manifest contains no secret, object key, selection internals or fake video',()=>{
  assert.doesNotMatch(JSON.stringify(base.manifest),/answer_key|object_key|service.role|expectedTextHash|selectedAssetId|buffer-preset/);
  for(const row of source.media)if(row.object_key)assert.equal(JSON.stringify(base.manifest).includes(row.object_key),false);
});
test('production Agent/events/speech authorization and old Shell unchanged; recording caller is now separately tested by 4A7',()=>{
  const prefix='src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/';
  const files={
    'src/app/api/learning-agent/respond/route.ts':'7569e1aa7cbc9f3f7dc2a4fea73063cd7d2f090ba6dec533a475b310ce52fe51',
    'src/app/api/learning-agent/events/route.ts':'c91cfdbd2c10f1f1416429fd4c5470529daa03c5ac605ff54c810f42d44d0816',
    'src/app/api/learning-agent/speech/[assetId]/route.ts':'fd1ce1cdf5ebcefe547ac721c94a285ccd5a512c52ac2cb2ef1eb54e7979c1f5',
    // Phase 4A7 explicitly authorizes this Action's recording-domain wiring.
    // Its old/v2 behavior is exercised by 4A4 and real-SQL 4A7 rehearsal, not a
    // Phase 3E whole-file freeze. Agent/event/speech protection remains intact.
    [prefix+'SmartTextbookShell.tsx']:'334bdb7f395d77f15128dee7ef1d0c0580b492a17672c4334094dbccca9aafe5',
  };
  for(const [path,hash] of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);
});
