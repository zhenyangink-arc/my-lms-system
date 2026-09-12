import {compiled,manifest,source,scope,capsules} from './runtime-4a9.mjs';
import {historyDb} from './history-db.mjs';
import {serverModule} from './runtime-4a2.server.mjs';
const {activityExecutions}=await import('../../src/features/smart-textbook-runtime/server/activity-binding.server.ts');
const {activityPages}=await import('../../src/features/smart-textbook-runtime/server/activity-pages.server.ts');
const {patternExecutions,boundPatternCheck}=await import('../../src/features/smart-textbook-runtime/server/pattern-binding.server.ts');
const {recordingPlans}=await serverModule('src/features/smart-textbook-runtime/server/recording-binding.server.ts');
const {recordingSlots}=await import('../../src/features/smart-textbook-runtime/core/recording.ts');
const {createLearningHistoryReader}=await import('../../src/features/smart-textbook-runtime/server/learning-history.server.ts');
export {compiled,manifest,source,scope,capsules};
export const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

/** Fully synthetic learner persistence, NOT real student's rows. Actual frozen
 * lesson identities and actual Reader/projection; no grader secrets exported. */
export function fullHistoryFixture() {
  const attempts=[],pages=[],plans=capsules.flatMap(c=>recordingPlans(manifest,compiled.bindings,c.id,'zh-CN'));
  for(const c of capsules){
    const descriptors=activityExecutions(manifest,compiled.bindings,c.id,'zh-CN');
    const patterns=patternExecutions(manifest,compiled.bindings,c.id,'zh-CN');
    for(const a of c.activities){
      const d=descriptors.find(d=>d.ref===a.activityId),pattern=patterns.find(p=>p.ref===a.activityId);
      let response=1;
      if(pattern)response=pattern.turns.filter(t=>t.kind!=='line').flatMap(t=>boundPatternCheck(manifest,compiled.bindings,c.id,a.activityId,t.kind==='choice'?{kind:'choice',partId:t.id,optionId:t.options[0].id}:{kind:'composition',partId:t.id,tokenIds:t.tokens.map(x=>x.id)}).response);
      else if(d?.kind==='choice-group')response=d.items.map(()=>0);
      else if(d?.kind==='fill-group')response=d.items.map(()=>'학습');
      else if(d?.kind==='ordering'||d?.kind==='multiple')response=d.options.map((_,i)=>i);
      else if(d?.kind==='writing')response={text:'저는 학생입니다.',informationKinds:d.checklist.map(()=>true),rubricConfirmed:true};
      else if(d?.kind==='self-check')response={checks:d.items.map(()=>'can'),returnNodes:[a.settings.returnNodes[0].value],note:'복습'};
      else if(a.activityKey==='listening-identity')response=a.settings.items.map(()=>0);
      const speaking=['speaking-introduction','dialogue-roleplay'].includes(a.activityKey);
      attempts.push({id:uuid(attempts.length+1),activity_id:a.activityId,response,attempt_number:1,is_correct:speaking?null:true,score:speaking?null:100,meets_completion_requirements:true,created_at:'2026-09-10T00:00:00.000001Z'});
    }
    for(const p of activityPages(compiled.bindings,compiled.services,c.id,'zh-CN')){
      const frozen=compiled.services.activityPages.find(f=>f.pageId===p.pageId);
      pages.push({activity_id:p.activityRef,page_index:frozen.legacyPage,item_indices:frozen.items.map(x=>x.legacyItem),response:p.items.map(x=>x.kind==='fill'?'학습':0),results:p.items.map(()=>true)});
    }
  }
  const tables={digital_textbook_attempts:attempts,digital_textbook_node_progress:capsules.map(c=>({node_id:c.nodeId,status:'completed',completion_percent:100})),digital_textbook_activity_page_progress:pages,
    digital_textbook_guided_repeat_progress:compiled.services.guidedRepeat.map(r=>({activity_id:r.activityId,practice_key:'repeat-line',track_index:r.legacyTrack,segment_index:r.legacySegment}))};
  const calls=[],db=historyDb(tables,calls);
  const recording={load:async c=>plans.filter(p=>p.capsuleRef===c),restore:async(c,ref)=>({recordings:plans.filter(p=>p.capsuleRef===c&&p.activityRef===ref).flatMap(recordingSlots).map(s=>({id:`isolated-evidence:${s.partId}`,partId:s.partId,durationSeconds:20,mimeType:'audio/webm',state:'consumed',reusable:false})),completion:'already-completed',currentTurnId:null})};
  const authority={db,manifest,bindings:compiled.bindings,services:compiled.services,nodes:source.nodes,scope,locale:'zh-CN',sessionId:'trusted',snapshotId:manifest.snapshot.id,recording};
  return {tables,calls,db,recording,authority,reader:createLearningHistoryReader(async()=>authority,{sessionId:'trusted',snapshotId:manifest.snapshot.id})};
}
export async function isolatedSessionFixture(){
  const history=fullHistoryFixture();
  const db={from(table){if(!['digital_textbook_chapters','digital_textbook_preferences'].includes(table))return history.db.from(table);return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='digital_textbook_chapters'?{id:manifest.chapter.id,version_id:manifest.version.id}:{interface_locale:globalThis.__session10locale??'ko-KR'},error:null};}};}};
  globalThis.__session10auth={user:{id:scope.actorId},tenant:{id:scope.tenantId},profile:null,supabase:db};
  globalThis.__session10source={admin:db,source,result:compiled};
  // Legacy 4A behavior tests substitute the persistence/auth transport only.
  // Publication admission itself is covered by real SQL 4B1A tests (including
  // the frozen pending-media rejection); this is not production publish proof.
  const saved=new Map();
  globalThis.__session10publication={session:async(op,actor,tenant,options={})=>{
    if(op==='issue'){
      const id=`learning-session-${crypto.randomUUID()}`,s={sessionRef:id,actor,tenant,expiresAt:Date.now()+1800000,locale:options.locale,
        bundle:{scope:{textbookId:manifest.textbook.id,versionId:manifest.version.id,chapterId:manifest.chapter.id},manifestDigest:manifest.snapshot.contentDigest,privateDigest:'isolated',sourceRevision:compiled.report.sourceRevision,
          privatePayload:{source,result:compiled}}};saved.set(id,s);return s;
    }
    const id=`learning-session-${options.ref}`,s=saved.get(id);if(!s||s.actor!==actor||s.tenant!==tenant)throw Error('LEARNING_SESSION_OWNER');
    if(op==='revoke'){saved.delete(id);return null;}return s;
  }};
  const {createRuntimeLearningSessionResolver}=await serverModule('src/features/smart-textbook-runtime/server/learning-session.server.ts',{
    '../../../lib/auth':'export async function requireActiveUser(){return globalThis.__session10auth;}',
    '../../../lib/supabase/admin':'export function createAdminClient(){return globalThis.__session10source.admin;}',
    '../../../lib/smart-textbook-publishing/repository.server':'export function publicationRepository(){return globalThis.__session10publication;}',
    '../../../lib/smart-textbook-publishing/loader.server':`export const chapterOnePublicationScope={};
      export async function authorizePublishedCourse(){const auth=globalThis.__session10auth;return {auth,tenantId:auth.tenant.id};}
      export async function loadPublishedRuntimeSnapshot(){const d=globalThis.__session10source,m=d.result.manifest;return {auth:globalThis.__session10auth,tenantId:globalThis.__session10auth.tenant.id,admin:d.admin,bundle:{scope:{textbookId:m.textbook.id}},pointer:{snapshotId:m.snapshot.id,generation:1}};}`,
    '../../../lib/smart-textbook-publishing/domain-guard.server':`export async function assertPublishedDomainDependencies(admin,b){const r=globalThis.__session10source.result;if(r.manifest.snapshot.contentDigest!==b.manifestDigest||r.report.sourceRevision!==b.sourceRevision)throw Error('LEARNING_SESSION_DEPENDENCY_REVISION_CHANGED');}`,
  });
  let now=Date.now();const resolver=createRuntimeLearningSessionResolver(()=>now),ref=await resolver.issue();
  // Advance past the ISSUED expiry, not the pre-issue clock. Parallel SQL/browser
  // tests can take >1ms between those instants; the security assertion is unchanged.
  return {history,resolver,ref,expire(){now=saved.get(ref.sessionRef).expiresAt+1;},reader:createLearningHistoryReader(async()=>({...await resolver.resolve(ref),recording:history.recording}),{sessionId:ref.sessionRef,snapshotId:manifest.snapshot.id})};
}
