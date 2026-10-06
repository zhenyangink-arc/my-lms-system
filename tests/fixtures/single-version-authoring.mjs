import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {serverModule} from './runtime-4a2.server.mjs';
import {literal as q,json,service} from './recording-v2-postgres.mjs';
import {source} from './runtime-4a.mjs';

// Actual app/Pub/Loader/domain services, only the fixture's DB/auth/bytes are
// isolated. No detached draft, fake compiler, direct pointer write or inspection.
export async function verifySingleVersionAuthoring({f,call,overrides}){
 const {db,publisher,loader}=f;
 const editing=await serverModule('src/lib/smart-textbook-publishing/authoring.server.ts',overrides);
 const before=await loader.loadPublishedRuntimeSnapshot();
 const bootResponse=await call({operation:'bootstrap'});assert.equal(bootResponse.status,200);
 const old=await bootResponse.json(),m=old.manifest;
 const activity=m.activityRefs.find(a=>a.activityId===source.activities.find(a=>a.activity_key==='orientation-check').id);
 const target=m.blocks.find(b=>b.type==='compat.learning.v1'&&b.stepId===old.continuation.activeStepId).runtimeTarget;
 const payload={sessionRef:old.sessionRef,generation:old.continuation.generation,target,
  request:{op:'native-submit',activity:old.catalog.find(c=>c.runtimeRef===activity.id).serviceRef,response:activity.publicPresentation.options[0].id}};
 const counts=async()=>db.query(`select jsonb_build_object('attempts',(select count(*) from public.digital_textbook_attempts),'evidence',(select count(*) from public.digital_textbook_speaking_evidence),'progress',(select count(*) from public.digital_textbook_node_progress))`);
 const immutable=await db.query(`select md5(document::text) from runtime_publish_private.snapshots where id=${q(before.bundle.snapshotId)}`);
 // Pure audit touches are allowed while semantic/status/profile/media edits
 // remain frozen; same scope can still be loaded after these timestamps move.
 for(const table of ['digital_textbooks','digital_textbook_versions','digital_textbook_chapters','chapter_tests'])await db.query(`update public.${table} set updated_at=clock_timestamp()`);
 assert.equal((await loader.loadPublishedRuntimeSnapshot()).bundle.snapshotId,before.bundle.snapshotId);
 assert.match((await db.raw(`update public.digital_textbooks set status='draft' where id=${q(source.textbook.id)}`)).stderr,/IMMUTABLE/);
 assert.match((await db.raw(`update public.learning_agent_profiles set display_name='{"zh-CN":"不允许原地改变"}'`)).stderr,/IMMUTABLE/);
 const profile=f.auth.profile.global_role;f.auth.profile.global_role='organization_owner';
 await assert.rejects(editing.beginChapterOneEditing(),/OWNER_ONLY/);f.auth.profile.global_role=profile;
 for(const role of ['anon','authenticated'])assert.notEqual((await db.raw(`set role ${role};select public.begin_runtime_textbook_edit_v1(${q(f.student)},${q(source.textbook.id)})`)).code,0);
 const nonOwner=randomUUID();await db.query(`insert into public.profiles values(${q(nonOwner)},'organization_owner','active')`);
 assert.match((await db.raw(service(`select public.begin_runtime_textbook_edit_v1(${q(nonOwner)},${q(source.textbook.id)})`))).stderr,/OWNER_ONLY/);
 await assert.rejects(editing.editChapterOneActivity({activityId:activity.id,prompt:{'zh-CN':'too early'},answerIndex:1}),/REJECTED/);

 // Real app request held in the actual attempt transaction. The edit window
 // sees the durable lease even though SQL grading uses a separate connection.
 await db.query(`create function public.pause_4b1c_attempt() returns trigger language plpgsql as $$begin perform pg_advisory_xact_lock(4171,99);perform pg_sleep(1.5);return new;end$$;
  create trigger pause_4b1c_attempt before insert on public.digital_textbook_attempts for each row execute function public.pause_4b1c_attempt();`);
 const submitting=call({operation:'dispatch',payload});
 let observed=false;
 for(let i=0;i<180;i++)if(await db.query("select count(*) from pg_locks where locktype='advisory' and classid=4171 and objid=99 and granted")!=='0'){observed=true;break;}
 assert(observed,'real application grader is in flight');
 const drain=await editing.beginChapterOneEditing();assert.equal(drain.state,'draining');assert(drain.inflight>0);
 await assert.rejects(editing.editChapterOneActivity({activityId:activity.id,prompt:{'zh-CN':'not yet'},answerIndex:1}),/REJECTED/);
 assert.equal((await call({operation:'bootstrap'})).status,409);
 await submitting;await db.query('drop trigger pause_4b1c_attempt on public.digital_textbook_attempts');
 assert.equal(await db.query('select count(*) from runtime_publish_private.runtime_requests where finished_at is null'),'0');
 const baseline=await counts();
 const stopped=await editing.beginChapterOneEditing();assert.equal(stopped.state,'editing');
 assert.equal((await call({operation:'bootstrap',sessionRef:old.sessionRef})).status,409);
 await assert.rejects(loader.loadPublishedRuntimeSnapshot(),/FENCE/);
 assert.equal(await counts(),baseline,'opening an edit window does not reset progress, attempts or evidence');
 assert.equal(await db.query(`select revoked from runtime_publish_private.sessions where id=${q(old.sessionRef.slice(17))}`),'t');

 await editing.editChapterOneActivity({activityId:activity.id,prompt:{'zh-CN':'修订后的见面问候检查','ko-KR':'수정된 인사 확인'},answerIndex:1});
 const saved=await counts();
 // Chapter source publication is the REAL existing owner RPC, after edit.
 await db.query(`select public.publish_digital_textbook_chapter(${q(source.chapter.id)})`);
 const compiled=await publisher.compileChapterOnePublication();
 assert.notEqual(compiled.snapshotId,before.bundle.snapshotId);
 assert.equal(compiled.manifest.steps.length,8);assert.equal(compiled.manifest.activityRefs.length,19);
 assert.deepEqual(compiled.manifest.runtimeTargets.map(t=>t.id),m.runtimeTargets.map(t=>t.id));
 assert.deepEqual(compiled.privatePayload.source.teachingNodes,before.bundle.privatePayload.source.teachingNodes);
 assert.equal(compiled.manifest.activityRefs.find(a=>a.id===activity.id).publicPresentation.prompt['zh-CN'],'修订后的见面问候检查');
 assert.equal(compiled.privatePayload.dependencies.digital_textbook_activity_secrets.find(a=>a.activity_id===activity.id).answer_key.value,1);
 // Two REAL publishers compete with the same CAS; only one advances.
 const races=await Promise.allSettled([publisher.publishChapterOne(before.pointer),publisher.publishChapterOne(before.pointer)]);
 assert.equal(races.filter(x=>x.status==='fulfilled').length,1);
 assert.match(races.find(x=>x.status==='rejected').reason.message,/CONFLICT/);
 const next=await loader.loadPublishedRuntimeSnapshot();assert.equal(next.bundle.snapshotId,compiled.snapshotId);
 assert.equal(await counts(),saved,'publication does not manufacture new learner state');
 assert.equal(await db.query(`select md5(document::text) from runtime_publish_private.snapshots where id=${q(before.bundle.snapshotId)}`),immutable);
 assert.equal(before.bundle.privatePayload.dependencies.digital_textbook_activity_secrets.find(a=>a.activity_id===activity.id).answer_key.value,0);
 assert.equal((await call({operation:'dispatch',payload})).status,409);
 assert.equal((await call({operation:'bootstrap',sessionRef:old.sessionRef})).status,409);
 await assert.rejects(publisher.rollbackPublication(next.bundle.scope,before.bundle.snapshotId,next.pointer),/RETIRED/);
 const fresh=await(await call({operation:'bootstrap'})).json();assert.equal(fresh.manifest.snapshot.id,next.bundle.snapshotId);assert.notEqual(fresh.sessionRef,old.sessionRef);
 const newPayload={...payload,sessionRef:fresh.sessionRef,generation:fresh.continuation.generation,
  request:{...payload.request,activity:fresh.catalog.find(c=>c.runtimeRef===activity.id).serviceRef,response:activity.publicPresentation.options[1].id}};
 const answered=await call({operation:'dispatch',payload:newPayload});assert.equal(answered.status,200);
 const result=await answered.json();assert.equal(result.correct,true,JSON.stringify(result));
 assert.match((await db.raw(`update public.digital_textbook_activity_secrets set answer_key='{"kind":"index","value":0}' where activity_id=${q(activity.id)}`)).stderr,/IMMUTABLE/);
 assert.equal(await db.query('select count(*) from runtime_publish_private.runtime_requests where finished_at is null'),'0');
 // No-op edit/cancel can also produce a fresh snapshot without resurrecting
 // old sessions or deleting old artifacts (capture authoring revision differs).
 assert.equal((await editing.beginChapterOneEditing()).state,'editing');
 const unchanged=await publisher.compileChapterOnePublication();assert.notEqual(unchanged.snapshotId,next.bundle.snapshotId);
 await publisher.publishChapterOne(next.pointer);
 assert.equal((await call({operation:'bootstrap',sessionRef:fresh.sessionRef})).status,409);
 await writeFile('/tmp/uply-4b1c-single-version-proof.json',JSON.stringify({before:before.bundle.manifestDigest,after:next.bundle.manifestDigest,
  beforeSnapshot:before.bundle.snapshotId,afterSnapshot:next.bundle.snapshotId,cancelEditSnapshot:unchanged.snapshotId,
  steps:compiled.manifest.steps.length,activities:compiled.manifest.activityRefs.length,orientation:compiled.manifest.blocks.filter(b=>b.type==='multiple_choice').length,
  teacherVersion:compiled.privatePayload.source.teachingVersions[0].version_number,stableTargetsUnchanged:true,oldSessionRejected:true,
  oldSnapshotPreserved:true,progressReset:false,recordingObjectsTouched:false,remainingInflight:Number(await db.query('select count(*) from runtime_publish_private.runtime_requests where finished_at is null'))},null,2));
}
