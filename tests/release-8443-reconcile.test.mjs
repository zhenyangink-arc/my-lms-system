// Pure regression boundary tests: synthetic ports only; no database, env loader or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serverModule} from './fixtures/teaching-agent-r7d-production/published-fixture.mjs';
import {source,evidence,compiled,manifest,context,state} from './fixtures/runtime-4a.mjs';
import {withLearningSession} from '../src/features/smart-textbook-runtime/core/learning-session-transport.ts';
import {courseContentSteps} from '../src/lib/course-content-workflow.ts';

const http=await serverModule('src/features/smart-textbook-runtime/server/application-http.server.ts',{
 './application-runtime.server':`export async function applicationRuntimeRequest(...args){globalThis.__reconcileHttp.push(args);return {ok:true};}`,
});
const request=(body='{}',headers={})=>new Request('http://127.0.0.1:49999/learning',{method:'POST',headers:{origin:'http://127.0.0.1:49999','content-type':'application/json',...headers},body});
test('legacy HTTP rejects cross-origin, malformed and oversize bodies before domain dispatch',async()=>{
 globalThis.__reconcileHttp=[];
 for(const r of [request('{}',{origin:'https://foreign.invalid'}),request('{}',{'sec-fetch-site':'cross-site'}),request('{'),request('x'.repeat(65537)),request('{}',{'content-type':'text/plain'})]){
  const result=await http.runtimeApplicationPost(r,'learning');assert(result.status>=400);assert.match(result.headers.get('cache-control'),/no-store/);
 }
 assert.equal(globalThis.__reconcileHttp.length,0);
 const ok=await http.runtimeApplicationPost(request(),'learning');assert.equal(ok.status,200);assert.equal(globalThis.__reconcileHttp.length,1);
});
test('canonical origin is server-owned and ignores forwarded headers',async()=>{
 process.env.SMART_TEXTBOOK_RELEASE_ORIGIN='https://canonical.invalid';globalThis.__reconcileHttp=[];
 try{assert.equal((await http.runtimeApplicationPost(request('{}',{'x-forwarded-host':'canonical.invalid','x-forwarded-proto':'https'}),'learning')).status,403);
 assert.equal((await http.runtimeApplicationPost(request('{}',{origin:'https://canonical.invalid'}),'learning')).status,200);assert.equal(globalThis.__reconcileHttp.length,1);
 }finally{delete process.env.SMART_TEXTBOOK_RELEASE_ORIGIN;}
});
const authoring=await serverModule('src/lib/smart-textbook-publishing/authoring.server.ts',{
 '../auth':`export async function requireActiveUser(){return globalThis.__reconcileAuthor.auth;}`,
 '../supabase/admin':`export function createAdminClient(){const f=globalThis.__reconcileAuthor;f.admin++;return {async rpc(name,args){f.calls.push({name,args});return f.result;}};}`,
 './loader.server':`export const chapterOnePublicationScope={textbookId:'fixed',versionId:'fixed-version',chapterId:'fixed-chapter'};`,
});
const owner=()=>({auth:{user:{id:'synthetic-owner'},profile:{global_role:'platform_owner'},tenant:{id:'synthetic-tenant'}},admin:0,calls:[],result:{data:{saved:true},error:null}});
test('authoring owner denial precedes admin access and closed payload rejects supplied scope',async()=>{
 const f=owner();globalThis.__reconcileAuthor=f;f.auth.profile.global_role='student';await assert.rejects(authoring.beginChapterOneEditing(),/OWNER_ONLY/);assert.equal(f.admin,0);
 f.auth.profile.global_role='platform_owner';await assert.rejects(authoring.editChapterOneActivity({activityId:'11111111-1111-4111-8111-111111111111',prompt:{'zh-CN':'合成题'},answerIndex:0,scope:{textbookId:'foreign'}}));assert.equal(f.admin,0);
});
test('authoring request lease surrounds operation and failed leave rejects success',async()=>{
 const f=owner();f.result={data:{ok:true},error:null};globalThis.__reconcileAuthor=f;
 assert.equal(await authoring.withChapterOneRuntimeRequest(async()=>{assert.equal(f.calls.length,1);assert.equal(f.calls[0].args.p_operation,'enter');return 42;}),42);
 assert.deepEqual(f.calls.map(c=>c.args.p_operation),['enter','leave']);assert.equal(f.calls[0].args.p_request,f.calls[1].args.p_request);
 f.calls=[];await assert.rejects(authoring.withChapterOneRuntimeRequest(async()=>{f.result={data:{ok:false},error:null};return 42;}),/FINISH_FAILED/);
});
const grammar=await serverModule('src/lib/smart-textbook-publishing/grammar-authoring.server.ts',{
 '../auth':`export async function requireActiveUser(){return globalThis.__reconcileAuthor.auth;}`,
 '../supabase/admin':`export function createAdminClient(){const f=globalThis.__reconcileAuthor;f.admin++;return {async rpc(name,args){f.calls.push({name,args});return f.result;}};}`,
 './capture.server':`export async function captureChapterOnePublication(){return {dependencies:globalThis.__reconcileGrammar};}`,
 './loader.server':`export const chapterOnePublicationScope={textbookId:'fixed',versionId:'fixed-version',chapterId:'fixed-chapter'};`,
});
test('grammar text CAS preserves stable IDs, content and identity expectations; stale/media patch rejected',async()=>{
 const f=owner();globalThis.__reconcileAuthor=f;globalThis.__reconcileGrammar={digital_textbook_nodes:structuredClone(source.nodes)};
 const [card]=grammar.grammarAuthoringCards(globalThis.__reconcileGrammar);assert(card);
 const patch={form:card.card.form,function:card.card.function,caution:card.card.caution,source:card.card.source};
 await assert.rejects(grammar.saveChapterOneGrammar({cardId:card.cardId,expected:'0'.repeat(64),patch:{...patch,form:'합성'}}),/CONFLICT/);assert.equal(f.calls.length,0);
 for(const patch of [{examples:[]},{audio:'x'},{order:0}])await assert.rejects(grammar.saveChapterOneGrammar({cardId:card.cardId,expected:card.expected,patch}));
 await grammar.saveChapterOneGrammar({cardId:card.cardId,expected:card.expected,patch:{...patch,form:'합성 문법'}});
 assert.equal(f.calls.length,1);const args=f.calls[0].args;assert.equal(f.calls[0].name,'edit_runtime_grammar_card_v1');assert.equal(args.p_node,card.nodeId);assert.deepEqual(args.p_old_card,card.card);assert.equal(args.p_identities[0].id,card.cardId);assert.deepEqual(args.p_expected_identities,[]);assert.deepEqual(args.p_expected_content,globalThis.__reconcileGrammar.digital_textbook_nodes.find(n=>n.id===card.nodeId).content);
 f.result={data:null,error:{code:'conflict'}};await assert.rejects(grammar.saveChapterOneGrammar({cardId:card.cardId,expected:card.expected,patch:{...patch,form:'再试'}}),/EDIT_REJECTED/);
});
test('content reads deduplicate only per session/generation while writes remain independent',async()=>{
 const block=manifest.blocks.find(b=>b.type==='compat.learning.v1'),calls=[];let release;
 const waiting=new Promise(r=>{release=r});const base={context,initialState:state,teacher:{turn:async()=>{},cancel:async()=>{}}};
 const send=async e=>{calls.push(e);await waiting;return [];};
 const a=withLearningSession(base,manifest,'session-a',[],send,async()=>({generation:1}));
 const b=withLearningSession(base,manifest,'session-b',[],send,async()=>({generation:1}));const signal=new AbortController().signal;
 const reads=[a.learning(block.props.capsuleRef,signal),a.learning(block.props.capsuleRef,signal),b.learning(block.props.capsuleRef,signal)];
 await new Promise(r=>setTimeout(r,0));assert.equal(calls.length,2);release();await Promise.all(reads);
 await Promise.all([a.learningFlow.revealPage(block.props.capsuleRef,'page',signal),a.learningFlow.revealPage(block.props.capsuleRef,'page',signal)]);assert.equal(calls.length,4);
});
test('subject navigation authority remains manifest-controlled with additive responsibility labels',()=>{
 const a={scope:'platform',globalRole:'platform_owner',capabilities:{manageContent:true}};
 assert.equal(courseContentSteps(a,true).length,4);assert.equal(courseContentSteps(a,false).length,0);assert.equal(courseContentSteps({...a,capabilities:{manageContent:false}},true).length,0);
 assert.equal(courseContentSteps({...a,globalRole:'platform_admin'},true).some(s=>s.key==='teaching-scripts'),false);
});
test('legacy admission follows terminal native branch and versioned overview through public facade',()=>{
 const page=readFileSync('src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx','utf8');
 assert(page.indexOf('const entry = await loadKoreanNativeVideoEntry')<page.indexOf('const runtimeAdmission = await runtimePageDecision'));
 const native=page.slice(page.indexOf('const entry = await loadKoreanNativeVideoEntry'),page.indexOf('const runtimeAdmission = await runtimePageDecision'));
 assert.match(native,/entry.kind !== "legacy"\) return/);assert.doesNotMatch(native,/<PublishedRuntimeEntry|loadSmartDigitalTextbook\(/);
 const access=readFileSync('src/features/smart-textbook-runtime/server/application-access.server.ts','utf8');assert.match(access,/getKoreanNativeProgressVersion\(lesson.id,0\)/);assert.match(access,/@\/features\/subjects\/native-video-entry.server/);
});
const workbenchService=await serverModule('src/features/digital-textbook/workbench/service.server.ts',{
 '@/lib/auth':`export async function requireActiveUser(){return globalThis.__reconcileAuthor.auth;}`,
 '@/lib/supabase/admin':`export function createAdminClient(){globalThis.__reconcileAuthor.admin++;throw Error('Unexpected admin');}`,
 '@/lib/smart-textbook-publishing/capture.server':`export const captureChapterOnePublication=()=>{throw Error('Unexpected capture')};export const chapterOneStepTitle=()=>'';`,
 '@/lib/smart-textbook-publishing/publisher.server':`export const compileChapterOnePublication=()=>{throw Error('Unexpected compile')};export const publishChapterOne=()=>{throw Error('Unexpected publish')};export const publicationHistory=()=>[];export const validatePublication=()=>{};`,
 '@/lib/smart-textbook-publishing/authoring.server':`export const beginChapterOneEditing=()=>{throw Error('Unexpected edit')};export const editChapterOneActivity=()=>{throw Error('Unexpected edit')};`,
});
test('workbench denies every operation before admin access and rejects extra identity fields',async()=>{
 const f=owner();f.auth.profile.global_role='student';globalThis.__reconcileAuthor=f;
 for(const operation of ['read','begin','save','save-grammar','check','publish']){const r=await workbenchService.chapterWorkbenchOperation({operation});assert.equal(r.ok,false);assert.match(r.message,/仅平台负责人/);}
 assert.equal(f.admin,0);f.auth.profile.global_role='platform_owner';const r=await workbenchService.chapterWorkbenchOperation({operation:'read',actorId:'foreign'});assert.equal(r.ok,false);assert.match(r.message,/格式/);assert.equal(f.admin,0);
});
const publisher=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{
 '../auth':`export async function requireActiveUser(){return globalThis.__reconcileAuthor.auth;}`,
 '../supabase/admin':`export const createAdminClient=()=>({});`,
 './native-publication.server.ts':`export const packageNativePublication=()=>{throw Error('not called')};`,
 './native-video-publication.server.ts':`export const packageNativeVideoPublication=()=>{throw Error('not called')};`,
 './capture.server.ts':`export async function captureChapterOnePublication(){globalThis.__reconcilePublish.captures++;return {source:{},evidence:{},dependencies:{digital_textbook_nodes:[]}};}export const captureNativePublication=()=>{throw Error('not called')};export const captureNativeVideoPublication=()=>{throw Error('not called')};`,
 './media-policy.server.ts':`export const withMediaPublicationPolicy=(_source,compiled)=>compiled;`,
 './loader.server.ts':`export const chapterOnePublicationScope={textbookId:'fixed'};`,
 '../smart-textbook-legacy-adapter/final-readiness.server.ts':`export const finalizeChapterOneNonUiReadiness=()=>({nonUiRuntimeReady:true});`,
 './artifact.server.ts':`export const packageSnapshot=()=>({manifestDigest:'sha256:'+'a'.repeat(64)});export const draftFromSnapshot=()=>{};export const validateSnapshotBundle=()=>{};`,
 './repository.server.ts':`export const publicationRepository=()=>({async publish(actor,bundle,expected){const p=globalThis.__reconcilePublish;p.calls.push({actor,bundle,expected});if(p.reject)throw Error('POINTER_CAS_CONFLICT');return {snapshotId:'synthetic',generation:2};}});`,
});
test('legacy checked digest is recomputed before original pointer CAS, stale and CAS failures never publish fallback',async()=>{
 globalThis.__reconcileAuthor=owner();const f={captures:0,calls:[],reject:false};globalThis.__reconcilePublish=f;
 await assert.rejects(publisher.publishChapterOne(null,'sha256:'+'b'.repeat(64)),/CHECK_STALE/);assert.equal(f.captures,1);assert.equal(f.calls.length,0);
 const pointer={snapshotId:'prior',generation:1};await publisher.publishChapterOne(pointer,'sha256:'+'a'.repeat(64));assert.equal(f.captures,2);assert.deepEqual(f.calls[0].expected,pointer);
 f.reject=true;await assert.rejects(publisher.publishChapterOne(pointer,'sha256:'+'a'.repeat(64)),/CAS_CONFLICT/);assert.equal(f.captures,3);assert.equal(f.calls.length,2);
});
const proof=await serverModule('src/lib/smart-textbook-publishing/grammar-media-proof.server.ts');
test('grammar media proof permits only frozen node/projection and rejects media/example/order changes',()=>{
 const node=source.nodes.find(n=>n.id==='e5078937-9a9d-4fb7-b92f-a6fe54fa7633');const original='8da8793aff849b949c25b84cc1040e1ef6fd18e3cb26322e666c23e27e7ad289';assert(node);
 assert.equal(proof.unchangedGrammarMedia(node,original),true);
 const wording=structuredClone(node);wording.content.grammarCards[0].form='合成修改';assert.equal(proof.unchangedGrammarMedia(wording,original),true);
 for(const change of [n=>n.id='foreign',n=>n.content.grammarCards.reverse(),n=>n.content.grammarCards[0].examples[0].ko='변경',n=>n.content.grammarCards[0].examples[0].audioId='foreign',n=>n.content.grammarCards[0].rules.push('foreign')]){const n=structuredClone(node);change(n);assert.equal(proof.unchangedGrammarMedia(n,original),false);}
 assert.equal(proof.unchangedGrammarMedia(node,'0'.repeat(64)),false);
});
const application=await serverModule('src/features/smart-textbook-runtime/server/application-runtime.server.ts',{
 './production-learning-boundary.server':`export const createProductionLearningBoundary=()=>({teacher:{resolveScope:()=>{},domainScope:()=>{}},catalog:async()=>{globalThis.__reconcileOps.push('catalog');return [];},resume:async()=>{globalThis.__reconcileOps.push('resume');return {};},enter:async()=>{globalThis.__reconcileOps.push('enter')},dispatch:async()=>{globalThis.__reconcileOps.push('dispatch')},revoke:async()=>{}});`,
 './learning-session.server':`export const createRuntimeLearningSessionResolver=()=>({resolve:async()=>{throw Error('not called')}});`,
 './teacher-boundary.server':`export const createTeacherRuntimeBoundary=()=>({dispatch:async()=>{throw Error('not called')}});`,
 './production-teacher-backend.server':`export const productionTeacherBackend=()=>({});`,
 './audit-speech.server':`export const proxyAuthorizedSpeech=()=>{};export const proxyAuthorizedCharacter=()=>{};`,
 '../../../app/api/learning-agent/speech/[assetId]/route':`export const GET=()=>{throw Error('provider forbidden')};`,
 '../../../app/api/learning-agent/characters/[pose]/route':`export const GET=()=>{throw Error('provider forbidden')};`,
 './application-admission.server':`export const assertRuntimeDependencies=async()=>({});export const runtimeAdmissionPolicy=async()=>({eligible:false,revision:1});`,
 './application-access.server':`export const authorizeRuntimeApplication=()=>{throw Error('not called')};`,
 '../../../lib/smart-textbook-publishing/authoring.server':`export const withChapterOneRuntimeRequest=async operation=>operation();`,
 '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions':`export const saveSmartTextbookPreferenceAction=()=>{throw Error('not called')};`,
});
test('legacy operation union refuses unknown fields, invalid sessions and unwanted upload before domain methods',async()=>{
 globalThis.__reconcileOps=[];const ref='learning-session-11111111-1111-4111-8111-111111111111';
 for(const input of [{operation:'delete-all'},{operation:'catalog',sessionRef:ref,tenantId:'foreign'},{operation:'resume',sessionRef:'foreign'},{operation:'language',sessionRef:ref,locale:'en-US'},{operation:'bootstrap',mode:'native'}])await assert.rejects(application.applicationRuntimeRequest(request(),'learning',input));
 await assert.rejects(application.applicationRuntimeRequest(request(),'learning',{operation:'catalog',sessionRef:ref},new Blob(['x'])));
 await assert.rejects(application.applicationRuntimeRequest(request(),'learning',{operation:'bootstrap'}),/ADMISSION_CLOSED/);
 assert.deepEqual(globalThis.__reconcileOps,[]);await application.applicationRuntimeRequest(request(),'learning',{operation:'catalog',sessionRef:ref});assert.deepEqual(globalThis.__reconcileOps,['catalog']);
});
const production=await serverModule('src/features/smart-textbook-runtime/server/production-learning-boundary.server.ts',{
 './learning-session.server':`export const createRuntimeLearningSessionResolver=()=>({issue:async()=>{globalThis.__reconcileGuard.push('issue')},resolve:async()=>{globalThis.__reconcileGuard.push('resolve')},revoke:async()=>{}});`,
 './learning-boundary.server':`export const createLearningBoundary=resolver=>({resolve:resolver.resolve});`,
 './production-learning.server':`export const productionLearningPorts=()=>({});`,
 './recording-production.server':`export const productionRecordingServices=()=>({});`,
 './recording-binding.server':`export const recordingPlans=()=>[];`,
 '../../../lib/recording-domain-gateway.server':`export const recordingActivityBinding=()=>({});`,
 '../../../lib/smart-textbook-legacy-adapter/runtime-content.server':`export const projectLearningContent=()=>({});`,
 './published-teacher-scope.server':`export const publishedTeacherScope=()=>({});`,
 './scene-image.server':`export const sceneImageBytes=()=>{throw Error('not called')};`,
 './scene-image-storage.server':`export const readSceneImage=()=>{throw Error('provider forbidden')};`,
});
test('optional server guard runs before every issue and resolve, fail-closed and unchanged without callback',async()=>{
 globalThis.__reconcileGuard=[];let denied=false;
 const b=production.createProductionLearningBoundary(async()=>request(),async()=>{globalThis.__reconcileGuard.push('guard');if(denied)throw Error('guard denied');});
 await b.issue();await b.resolve({sessionRef:'synthetic'});assert.deepEqual(globalThis.__reconcileGuard,['guard','issue','guard','resolve']);
 denied=true;await assert.rejects(b.issue(),/guard denied/);await assert.rejects(b.resolve({guard:'client cannot replace callback'}),/guard denied/);assert.equal(globalThis.__reconcileGuard.filter(v=>v==='issue'||v==='resolve').length,2);
 await production.createProductionLearningBoundary(async()=>request()).issue();assert.equal(globalThis.__reconcileGuard.at(-1),'issue');
});
const actualCapture=await serverModule('src/lib/smart-textbook-publishing/capture.server.ts');
function legacyDependencies(){
 const d=Object.fromEntries(actualCapture.dependencyTables.map(t=>[t,[]]));
 Object.assign(d,{digital_textbooks:[source.textbook],digital_textbook_versions:[source.version],digital_textbook_chapters:[{...source.chapter,chapter_test_id:evidence.chapter.chapter_test_id}],digital_textbook_modules:source.modules,digital_textbook_nodes:source.nodes,digital_textbook_activities:source.activities,digital_textbook_media_assets:source.media,digital_textbook_listening_tracks:source.tracks,learning_agent_lessons:source.lessons,learning_agent_script_versions:source.teachingVersions,learning_agent_script_nodes:source.teachingNodes,learning_agent_script_audio_assets:evidence.speech,chapter_tests:[evidence.chapter.chapter_tests],digital_textbook_activity_secrets:source.activities.filter(a=>a.activity_key!=='dialogue-roleplay').map(a=>({activity_id:a.id,answer_key:{kind:'index',value:0}}))});return structuredClone(d);
}
test('real capture exempts exactly evidence-graded speaking-roleplay; missing or duplicate grader secrets fail',async()=>{
 const d=legacyDependencies();const projected=await actualCapture.projectPublicationCapture(d);assert.deepEqual(projected.source,source);assert.deepEqual(projected.evidence,evidence);
 const graded=d.digital_textbook_activity_secrets[0];const missing=structuredClone(d);missing.digital_textbook_activity_secrets.shift();await assert.rejects(actualCapture.projectPublicationCapture(missing),/GRADER_SECRET_REQUIRED/);
 const duplicate=structuredClone(d);duplicate.digital_textbook_activity_secrets.push(graded);await assert.rejects(actualCapture.projectPublicationCapture(duplicate),/GRADER_SECRET_REQUIRED/);
 const changed=structuredClone(d);changed.digital_textbook_activities.find(a=>a.activity_key==='dialogue-roleplay').activity_type='single_choice';await assert.rejects(actualCapture.projectPublicationCapture(changed),/GRADER_SECRET_REQUIRED/);
});
const actualArtifact=await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
const actualMedia=await serverModule('src/lib/smart-textbook-publishing/media-policy.server.ts');
test('real legacy media policy and certifier preserve official /1 public manifest and discriminate native families',()=>{
 const adapted=actualMedia.withMediaPublicationPolicy(source,compiled);const b=actualArtifact.packageSnapshot(source,evidence,adapted);
 assert.equal(actualArtifact.assertPublishableSnapshot(b).revision,'publish-foundation/1');assert.equal(actualArtifact.requireLegacyPublication(b).snapshotId,b.snapshotId);assert.throws(()=>actualArtifact.requireNativeVideoPublication(b));
 assert.equal(b.manifest.steps.length,manifest.steps.length);assert.deepEqual(b.manifest.runtimeTargets,manifest.runtimeTargets);
 const tampered=structuredClone(b);tampered.manifest.steps[0].title['zh-CN']='tampered';assert.throws(()=>actualArtifact.validateSnapshotBundle(tampered));
});
const {historyDb}=await import('./fixtures/history-db.mjs');
const {createLearningHistoryReader}=await import('../src/features/smart-textbook-runtime/server/learning-history.server.ts');
test('scoped history keeps whole-runtime node authority while restoring only selected capsule; undefined preserves full audit',async()=>{
 const capsules=compiled.bindings.capsules.filter(c=>c.kind==='learning'),calls=[],restored=[];
 const db=historyDb({digital_textbook_node_progress:capsules.map(c=>({node_id:c.nodeId,status:'completed',completion_percent:100}))},calls);
 const a={db,manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,scope:{authorized:true,actorId:'synthetic',tenantId:'synthetic',versionId:manifest.version.id,sourceRevision:compiled.services.sourceRevision},locale:'zh-CN',sessionId:'synthetic',snapshotId:manifest.snapshot.id,recording:{load:async c=>{restored.push(c);return [];},restore:async()=>{throw Error('unexpected recording restore')}}};
 const reader=createLearningHistoryReader(async()=>a,{sessionId:'synthetic',snapshotId:manifest.snapshot.id}),signal=new AbortController().signal;
 const light=await reader(signal,null);assert.equal(light.server.completedStepIds.length,capsules.length);assert.equal(light.capsules.length,0);assert.equal(restored.length,0);assert(!calls.some(c=>c.table==='digital_textbook_activity_page_progress'));
 const scoped=await reader(signal,capsules[0].id);assert.equal(scoped.server.completedStepIds.length,capsules.length);assert.deepEqual(scoped.capsules.map(c=>c.capsuleRef),[capsules[0].id]);assert.deepEqual(restored,[capsules[0].id]);
 restored.length=0;const full=await reader(signal);assert.equal(full.capsules.length,capsules.length);assert.equal(restored.length,capsules.length);await assert.rejects(reader(signal,'foreign'),/CAPSULE_SCOPE/);
});
