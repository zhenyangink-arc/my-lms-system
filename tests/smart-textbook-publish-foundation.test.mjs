import test from 'node:test';
import assert from 'node:assert/strict';
import {compiled,source,evidence,manifest} from './fixtures/runtime-4a.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {publicationPostgres,json,literal,service} from './fixtures/publish-foundation-postgres.mjs';
const {packageSnapshot,validateSnapshotBundle,draftFromSnapshot,assertPublishableSnapshot}=await serverModule('src/lib/smart-textbook-publishing/artifact.server.ts');
const {publicationRepository}=await serverModule('src/lib/smart-textbook-publishing/repository.server.ts');
const A=packageSnapshot(source,evidence,compiled);
const owner='00000000-0000-4000-8000-000000000011',student='00000000-0000-4000-8000-000000000012',tenant='00000000-0000-4000-8000-000000000013';
const secondOwner='00000000-0000-4000-8000-000000000014';
const {digest}=await import('../src/lib/smart-textbook-legacy-adapter/identity.server.ts');
const reseal=b=>{const {seal,...body}=b;return {...body,seal:digest(body)};};
// A second compiled artifact: a COW chapter title revision, not target identity edits.
const {finalizeChapterOneNonUiReadiness}=await serverModule('src/lib/smart-textbook-legacy-adapter/final-readiness.server.ts');
const {default:ids}=await import('../src/lib/smart-textbook-publishing/assets/v1/chapter-one-identities.server.ts');
const {default:history}=await import('../src/lib/smart-textbook-publishing/assets/v1/chapter-one-service-identities.server.ts');
const draft=draftFromSnapshot(A);draft.source.chapter.title['zh-CN']+='（隔离新修订）';
const B=packageSnapshot(draft.source,evidence,finalizeChapterOneNonUiReadiness(draft.source,ids,history,evidence));
const secondDraft=draftFromSnapshot(B);secondDraft.source.chapter.title['ko-KR']+=' (isolated C)';
const C=packageSnapshot(secondDraft.source,evidence,finalizeChapterOneNonUiReadiness(secondDraft.source,ids,history,evidence));
// Direct service-role SQL transport for STORAGE tests only. This does not claim
// the frozen candidate passes application publication admission (it does not).
function storageTransport(admin){
  const rpc=async(name,args)=>{const r=await admin.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;};
  return {
    publish:(actor,bundle,expected)=>rpc('publish_runtime_snapshot_v1',{p_actor:actor,p_scope:bundle.scope,p_expected:expected,p_operation:'publish',p_bundle:bundle,p_target:null}),
    rollback:(actor,scope,target,expected)=>rpc('publish_runtime_snapshot_v1',{p_actor:actor,p_scope:scope,p_expected:expected,p_operation:'rollback',p_bundle:null,p_target:target}),
    current:async scope=>{const r=await rpc('read_runtime_publication_v1',{p_scope:scope});if(!r)throw Error('MISSING');validateSnapshotBundle(r.bundle);return r;},
    history:(actor,scope)=>rpc('read_runtime_publication_v1',{p_scope:scope,p_history_actor:actor}),
    session:(op,actor,tenant,opts={})=>rpc('runtime_publication_session_v1',{p_operation:op,p_actor:actor,p_tenant:tenant,p_ref:opts.ref??null,p_scope:opts.scope??null,p_expected:opts.expected??null,p_locale:'zh-CN'})
  };
}
async function setup(){const db=await publicationPostgres();await db.query(`insert into public.profiles values('${owner}','platform_owner','active'),('${secondOwner}','platform_owner','active'),('${student}',null,'active');insert into public.digital_textbooks values('${A.scope.textbookId}');insert into public.digital_textbook_versions values('${A.scope.versionId}','${A.scope.textbookId}');insert into public.digital_textbook_chapters values('${A.scope.chapterId}','${A.scope.versionId}');`);return{...db,repo:storageTransport(db.admin)};}

test('4B1A frozen compile + versioned identity + exact Manifest/private pins',()=>{
  assert.equal(A.manifestDigest,'sha256:19bb72f491ae7f460d83867b09562e079e8bf1dfb3ee62b3de04775f88471f2e');
  assert.equal(A.manifest.steps.length,8);assert.equal(A.manifest.activityRefs.length,19);
  assert.equal(A.manifest.blocks.filter(b=>b.type==='multiple_choice').length,3);
  assert.deepEqual(A.pins.teachingRevisions.map(x=>x.number),[23]);
  assert.deepEqual(B.manifest.runtimeTargets,A.manifest.runtimeTargets);
  assert.notEqual(B.snapshotId,A.snapshotId);assert.equal(validateSnapshotBundle(A).snapshotId,manifest.snapshot.id);
  assert(!JSON.stringify(A.manifest).match(/object_key|answer_key|private_transcript|service_role|proofKey/));
});
test('4B1A corruption fails closed: schema, digest, private association, pins, target contract and preview',()=>{
  const edits=[b=>b.schemaVersion='2',b=>b.manifest.chapter.title['zh-CN']='corrupt',b=>b.privatePayload.result.manifest.snapshot.id='other',
    b=>b.pins.targetDigest='bad',b=>b.pins.identityAsset.digest='bad',b=>b.privatePayload.result.bindings.activities.pop(),
    b=>b.manifest.runtimeTargets[0].capabilities=['open'],b=>b.manifest.snapshot.scope='step-preview'];
  for(const edit of edits){const b=structuredClone(A);edit(b);assert.throws(()=>validateSnapshotBundle(reseal(b)));}
});
test('4B1A real SQL immutable A → B → rollback; concurrent CAS + ABA conflict; atomic failure',async()=>{
  const db=await setup();try{
    await assert.rejects(()=>db.repo.current(A.scope),/MISSING/);
    const pA=await db.repo.publish(owner,A,null);assert.equal((await db.repo.current(A.scope)).bundle.manifestDigest,A.manifestDigest);
    const before=await db.query(`select document::text from runtime_publish_private.snapshots where id=${literal(A.snapshotId)}`);
    const races=await Promise.allSettled([db.repo.publish(owner,B,pA),db.repo.publish(secondOwner,B,pA)]);
    assert.equal(races.filter(x=>x.status==='fulfilled').length,1);assert.match(races.find(x=>x.status==='rejected').reason.message,/CONFLICT/);
    const pB=(await db.repo.current(A.scope)).pointer;
    assert.equal((await db.repo.current(A.scope)).bundle.manifestDigest,B.manifestDigest);
    assert.equal(await db.query(`select document::text from runtime_publish_private.snapshots where id=${literal(A.snapshotId)}`),before);
    const rollback=await db.repo.rollback(owner,A.scope,A.snapshotId,pB);assert.equal(rollback.generation,3);
    assert.equal((await db.repo.current(A.scope)).bundle.manifestDigest,A.manifestDigest);
    await assert.rejects(()=>db.repo.publish(owner,B,pA),/CONFLICT/); // A → B → A, stale expected A rejected
    assert.equal((await db.repo.history(owner,A.scope)).length,3);
    for(const table of ['snapshots','bindings','history'])assert.notEqual((await db.raw(`delete from runtime_publish_private.${table}`)).code,0);
    assert.notEqual((await db.raw(`update runtime_publish_private.snapshots set document=document`)).code,0);
    const corrupt=structuredClone(B);corrupt.privatePayload.result.manifest.snapshot.id='wrong';
    const result=await db.admin.rpc('publish_runtime_snapshot_v1',{p_actor:owner,p_scope:A.scope,p_expected:rollback,p_operation:'publish',p_bundle:corrupt,p_target:null});assert(result.error);
    assert.equal((await db.repo.current(A.scope)).pointer.generation,3);
    await db.query(`create function public.fail_history() returns trigger language plpgsql as $$begin raise exception 'isolated failure after pointer';end$$;create trigger fail_history before insert on runtime_publish_private.history for each row execute function public.fail_history();`);
    await assert.rejects(()=>db.repo.publish(owner,C,rollback),/isolated failure/);
    assert.equal((await db.repo.current(A.scope)).pointer.generation,3); // UPDATE pointer rolled back
    assert.equal(await db.query(`select count(*) from runtime_publish_private.snapshots where id=${literal(C.snapshotId)}`),'0');
    assert.equal(await db.query(`select count(*) from runtime_publish_private.bindings where snapshot_id=${literal(C.snapshotId)}`),'0');
  }finally{await db.stop();}
});
test('4B1A real SQL permissions: no browser RPC/table/read/private/draft/history, owner-only publish',async()=>{
  const db=await setup();try{
    for(const role of ['anon','authenticated']){
      assert.notEqual((await db.raw(`set role ${role};select public.read_runtime_publication_v1(${json(A.scope)})`)).code,0);
      assert.notEqual((await db.raw(`set role ${role};select * from runtime_publish_private.bindings`)).code,0);
    }
    await assert.rejects(()=>db.repo.publish(student,A,null),/OWNER_ONLY/);
    await assert.rejects(()=>db.repo.history(student,A.scope),/OWNER_ONLY/);
    await db.query(`update public.profiles set global_role='organization_owner' where id='${student}'`);
    await assert.rejects(()=>db.repo.publish(student,A,null),/OWNER_ONLY/);
    await db.repo.publish(owner,A,null);
    assert.notEqual((await db.raw(service('update runtime_publish_private.pointers set generation=99'))).code,0);
  }finally{await db.stop();}
});
test('4B1A durable opaque session: restart/new repository stays A after publish B; owner/tenant/expiry/revoke',async()=>{
  const db=await setup();try{
    const p=await db.repo.publish(owner,A,null);
    const s=await db.repo.session('issue',student,tenant,{scope:A.scope,expected:p});
    await db.repo.publish(owner,B,p);
    const replica=storageTransport(db.admin),ref=s.sessionRef.slice(17);
    const restored=await replica.session('resolve',student,tenant,{ref});assert.equal(restored.bundle.snapshotId,A.snapshotId);
    assert.equal(restored.bundle.privateDigest,A.privateDigest);
    for(const [who,where] of [[owner,tenant],[student,owner]])await assert.rejects(()=>replica.session('resolve',who,where,{ref}),/OWNER/);
    await assert.rejects(()=>replica.session('issue',student,tenant,{scope:A.scope,expected:p}),/CONFLICT/);
    await replica.session('revoke',student,tenant,{ref});await assert.rejects(()=>replica.session('resolve',student,tenant,{ref}),/EXPIRED/);
    const next=await replica.session('issue',student,tenant,{scope:A.scope,expected:(await replica.current(A.scope)).pointer});
    await db.query(`update runtime_publish_private.sessions set expires_at=now()-interval '1 second'`);
    await assert.rejects(()=>replica.session('resolve',student,tenant,{ref:next.sessionRef.slice(17)}),/EXPIRED/);
  }finally{await db.stop();}
});

test('4B1A existing published validator blocks frozen pending media: no fake ready, no live fallback',async()=>{
  assert.throws(()=>assertPublishableSnapshot(A),/Published scope\/media not ready/);
  const db=await setup();try{
    const real=publicationRepository(db.admin);
    await assert.rejects(()=>real.publish(owner,A,null),/PUBLICATION_ADMISSION/);
    assert.equal(await db.query('select count(*) from runtime_publish_private.pointers'),'0');
    // Even if a privileged faulty caller stored it, production Loader rejects it.
    await db.repo.publish(owner,A,null);
    await assert.rejects(()=>real.current(A.scope),/PUBLICATION_ADMISSION/);
    assert.equal(A.manifestDigest,manifest.snapshot.contentDigest);
  }finally{await db.stop();}
});

test('4B1A authenticated production Loader and session admission: SQL pointer → published rejection, never recompile',async()=>{
  const db=await setup();try{
    await db.repo.publish(owner,A,null);let reads=0;
    const visible={from(table){let filters={};return {select(){return this;},eq(k,v){filters[k]=v;return this;},async maybeSingle(){
      reads++;if(table==='digital_textbook_chapters')return {error:null,data:filters.id===A.scope.chapterId?{id:A.scope.chapterId,version_id:A.scope.versionId}:null};
      if(table==='digital_textbook_versions')return {error:null,data:filters.id===A.scope.versionId?{id:A.scope.versionId,textbook_id:A.scope.textbookId}:null};
      throw Error('Unexpected live content/compile read');
    }};}};
    globalThis.__publishAuth={user:{id:student},tenant:{id:tenant},profile:{role:'student'},supabase:visible};globalThis.__publishAdmin=db.admin;
    const overrides={
      '../auth':'export async function requireActiveUser(){return globalThis.__publishAuth;}',
      '../../../lib/auth':'export async function requireActiveUser(){return globalThis.__publishAuth;}',
      '../supabase/admin':'export function createAdminClient(){return globalThis.__publishAdmin;}',
      '../../../lib/supabase/admin':'export function createAdminClient(){return globalThis.__publishAdmin;}',
      '../student-permissions':'export function canUseStudentFeature(){return true;}export function normalizeMembershipTier(){return "test";}',
    };
    const {loadPublishedRuntimeSnapshot}=await serverModule('src/lib/smart-textbook-publishing/loader.server.ts',overrides);
    await assert.rejects(()=>loadPublishedRuntimeSnapshot(A.scope),/PUBLICATION_ADMISSION/);assert.equal(reads,2);
    await assert.rejects(()=>loadPublishedRuntimeSnapshot({...A.scope,snapshotId:A.snapshotId}));
    await assert.rejects(()=>loadPublishedRuntimeSnapshot({...A.scope,chapterId:owner}),/CHAPTER_FORBIDDEN/);
    const {createRuntimeLearningSessionResolver}=await serverModule('src/features/smart-textbook-runtime/server/learning-session.server.ts',overrides);
    const resolver=createRuntimeLearningSessionResolver();
    await assert.rejects(()=>resolver.issue(),/PUBLICATION_ADMISSION/);
    assert.equal(await db.query('select count(*) from runtime_publish_private.sessions'),'0');
    await assert.rejects(()=>resolver.resolve({sessionRef:'learning-session-'+student,tenantId:tenant}));
    globalThis.__publishAuth={...globalThis.__publishAuth,tenant:null};await assert.rejects(()=>loadPublishedRuntimeSnapshot(A.scope),/FORBIDDEN/);
  }finally{delete globalThis.__publishAuth;delete globalThis.__publishAdmin;await db.stop();}
});

test('4B1A actual SQL payload corruption/private association/digest cannot be admitted',async()=>{
  const db=await setup();try{
    await db.repo.publish(owner,A,null);
    // Superuser fault injection ONLY inside this disposable container. No
    // ordinary service/browser role can disable the immutable trigger.
    await db.query('alter table runtime_publish_private.bindings disable trigger immutable_binding');
    await db.query(`update runtime_publish_private.bindings set payload=jsonb_set(payload,'{source,chapter,title,zh-CN}','"隔离损坏"')`);
    await assert.rejects(()=>publicationRepository(db.admin).current(A.scope),/SEAL_MISMATCH/);
    await db.query(`update runtime_publish_private.bindings set payload=${json(A.privatePayload)},digest=repeat('0',64)`);
    await assert.rejects(()=>publicationRepository(db.admin).current(A.scope),/POINTER_MISSING/);
  }finally{await db.stop();}
});

test('4B1A compile/validate/history/draft/rollback app DAL excludes organization owner and member before DB',async()=>{
  const publishing=await serverModule('src/lib/smart-textbook-publishing/publisher.server.ts',{
    '../auth':'export async function requireActiveUser(){return {user:{id:"isolated"},profile:{global_role:globalThis.__publishRole}};}',
    '../supabase/admin':'export function createAdminClient(){throw Error("Unexpected database access");}'
  });
  for(const role of ['organization_owner','organization_member','platform_deputy',null]){
    globalThis.__publishRole=role;
    for(const op of [()=>publishing.compileChapterOnePublication(),()=>publishing.validatePublication(A),()=>publishing.newPublicationDraft(A),()=>publishing.publicationHistory(A.scope),()=>publishing.rollbackPublication(A.scope,A.snapshotId,{snapshotId:B.snapshotId,generation:2}),()=>publishing.publishChapterOne(null)])await assert.rejects(op,/OWNER_ONLY/);
  }
  delete globalThis.__publishRole;
});

test('4B1A Teacher scope uses the same published private capture and pinned v23; no alternate audit source',async()=>{
  const {publishedTeacherScope}=await serverModule('src/features/smart-textbook-runtime/server/published-teacher-scope.server.ts');
  const data={source:A.privatePayload.source,result:A.privatePayload.result,admin:{from(table){return{select(){return this;},eq(){return this;},async maybeSingle(){return{error:null,data:table==='learning_agent_lessons'?{agent_profile_id:owner}:{agent_code:'uply-korean-teacher'}};}};}}};
  const authority={publishedData:data,manifest:A.manifest,snapshotId:A.snapshotId,scope:{actorId:student,tenantId:tenant,sourceRevision:A.sourceRevision},locale:'zh-CN',expiresAt:Date.now()+60000,admin:data.admin};
  const ports=publishedTeacherScope({resolve:async input=>{assert.equal(input.sessionRef,'opaque');return authority;}},{resume:async()=>({activeStepId:A.manifest.steps[0].id,generation:4})});
  assert.equal((await ports.resolveScope('opaque')).data,data);
  const s=await ports.domainScope('opaque');assert.equal(s.snapshot,A.snapshotId);assert.equal(s.scriptVersionId,A.pins.teachingRevisions[0].id);assert.equal(s.generation,4);
  const bad=publishedTeacherScope({resolve:async()=>authority},{resume:async()=>({activeStepId:'foreign-step',generation:4})});await assert.rejects(()=>bad.resolveScope('opaque'),/STEP/);
});

test('4B1A old precheck cannot admit an unfenced artifact; durable fence RPC must affirm exact capture',async()=>{
  const {assertPublishedDomainDependencies}=await serverModule('src/lib/smart-textbook-publishing/domain-guard.server.ts');
  await assert.rejects(()=>assertPublishedDomainDependencies({},A),/FENCE_REQUIRED/);
  const b=structuredClone(A);b.privatePayload.dependencies={isolated:'unit transport only'};
  let accepted=false;
  const admin={async rpc(name,args){assert.equal(name,'assert_runtime_dependency_fence_v1');assert.equal(args.p_snapshot,A.snapshotId);assert.deepEqual(args.p_capture,b.privatePayload.dependencies);return {data:accepted,error:null};}};
  await assert.rejects(()=>assertPublishedDomainDependencies(admin,b),/FENCE_REQUIRED/);
  accepted=true;await assertPublishedDomainDependencies(admin,b);
  // Real concurrent publication/authoring/attempt transaction tests are in
  // smart-textbook-publication-closure.test.mjs, not replaced by this unit port.
});
