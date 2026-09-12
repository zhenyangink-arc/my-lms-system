import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {teacherBoundaryFixture} from './fixtures/teacher-boundary-4a14.mjs';
import {serverModule} from './fixtures/runtime-4a2.server.mjs';
import {manifest} from './fixtures/runtime-4a.mjs';
const {teacherBoundaryRequest}=await serverModule('src/features/smart-textbook-runtime/server/teacher-boundary.server.ts');
const {teacherRuntimeHttp}=await serverModule('src/features/smart-textbook-runtime/core/teacher-http.ts');

test('4A14 only opaque Teacher boundary fields; authority/revision/media/command injection rejected',()=>{
  const base={operation:'advance',session:'teacher-session-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
  assert(teacherBoundaryRequest.safeParse(base).success);
  for(const field of ['generation','teacherRef','scriptVersionId','nodeId','userId','tenantId','snapshotId','sourceRevision','speechAssetId','pose','target','command','score','completion','agentAdvance'])assert(!teacherBoundaryRequest.safeParse({...base,[field]:'injected'}).success,field);
  for(const operation of ['restart','set-node','complete','skip','unsafe-play'])assert(!teacherBoundaryRequest.safeParse({...base,operation}).success);
});

test('4A14 mounted session authorizes each operation and rejects another owner / non-owner',async()=>{
  const f=await teacherBoundaryFixture();try{
    const {session}=await f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef});
    f.setAuthority({actorId:'another-owner',role:'platform_owner'});await assert.rejects(f.boundary.dispatch({session,operation:'current'}),/SCOPE/);
    f.setAuthority({actorId:'isolated-owner',role:'student'});await assert.rejects(f.boundary.dispatch({session,operation:'current'}),/AUTHORITY/);
    await assert.rejects(f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef}),/AUTHORITY/);
  }finally{f.dispose();}
});

test('4A14 pause blocks advance; resume preserves exact current cue, no resolver reset',async()=>{
  const f=await teacherBoundaryFixture();try{
    const {session}=await f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef});
    const first=await f.boundary.dispatch({session,operation:'current'});
    await f.boundary.dispatch({session,operation:'pause'});await assert.rejects(f.boundary.dispatch({session,operation:'advance'}),/PAUSED/);
    assert.deepEqual(await f.boundary.dispatch({session,operation:'current'}),first);
    await f.boundary.dispatch({session,operation:'resume'});const next=await f.boundary.dispatch({session,operation:'advance'});assert.notEqual(next.cue,first.cue);
  }finally{f.dispose();}
});

test('4A14 changed source/snapshot/teaching revision invalidates opaque session rather than silently rebinding',async t=>{
  for(const field of ['snapshot','source','revision'])await t.test(field,async()=>{
    const f=await teacherBoundaryFixture();try{
      const {session}=await f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef});
      await f.boundary.dispatch({session,operation:'current'});
      if(field==='snapshot')f.data.result.manifest.snapshot.id='changed';
      if(field==='source')f.data.result.report.sourceRevision='changed';
      if(field==='revision')f.data.result.manifest.teachingRefs[0].revision='changed';
      await assert.rejects(f.boundary.dispatch({session,operation:'advance'}),/REVISION|STALE/);
    }finally{f.dispose();}
  });
});

test('4A14 unissued TTS observation cannot advance; authorized grant consumes once and is not learning completion',async()=>{
  const f=await teacherBoundaryFixture();try{
    const {session}=await f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef});
    let cue=await f.boundary.dispatch({session,operation:'current'});
    for(let n=0;!cue.task&&n<20;n++)cue=await f.boundary.dispatch({session,operation:'advance'});
    assert(cue.task);await assert.rejects(f.boundary.dispatch({session,operation:'observeTts',grantId:crypto.randomUUID()}),/Unissued/);
    const grant=await f.boundary.dispatch({session,operation:'issueTts'}),observation=await f.boundary.dispatch({session,operation:'observeTts',grantId:grant.grantId});
    assert(observation.teachingPlaybackWaitSatisfied);assert.equal(observation.agentAdvance,false);
    assert.equal(observation.formalCompletion,false);assert.equal(observation.score,null);assert.equal(observation.progressDelta,null);
    assert.equal((await f.boundary.dispatch({session,operation:'observeTts',grantId:grant.grantId})).duplicate,true);
    assert.equal((await f.boundary.dispatch({session,operation:'current'})).cue,cue.cue);
    assert.equal((await f.boundary.dispatch({session,operation:'advance'})).phase,'task_feedback');
    assert.equal(f.learning.state.attempts.length,0);assert.equal(f.learning.state.completedStepIds.length,0);
  }finally{f.dispose();}
});

test('4A14 HTTP adapter closes a late open and refuses stale response after cancellation',async()=>{
  let finish,entered;const started=new Promise(r=>entered=r),calls=[];
  const port=teacherRuntimeHttp('learning-session-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',async input=>{
    calls.push(input);if(input.operation==='open'){entered();return new Promise(r=>finish=r);}return{cancelled:true};
  });
  const abort=new AbortController(),work=port.open(abort.signal);await started;abort.abort();await port.close();
  finish({session:'teacher-session-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'});await assert.rejects(work,/STALE_OPEN/);
  assert(calls.some(c=>c.operation==='close'&&c.session==='teacher-session-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));
  await assert.rejects(port.current(new AbortController().signal),/NOT_OPEN/);
});

test('4A14 cue DTO and media proxy output never contains server identity or URLs',async()=>{
  const f=await teacherBoundaryFixture();try{
    const {session}=await f.boundary.dispatch({operation:'open',scope:f.learning.sessionRef}),cue=await f.boundary.dispatch({session,operation:'current'});
    assert.doesNotMatch(JSON.stringify(cue),/objectKey|object_key|signedUrl|https?:|tenantId|userId|scriptVersionId|speechAssetId|answer_key/);
    const speech=await f.boundary.dispatch({session,operation:'speech',cue:cue.cue}),character=await f.boundary.dispatch({session,operation:'character',cue:cue.cue});
    assert(speech instanceof Blob&&speech.type.startsWith('audio/'));assert(character instanceof Blob&&character.type.startsWith('image/'));
  }finally{f.dispose();}
});

test('4A14 audit client uses one complete Root and opaque Teacher transport; unsupported remains fail-closed',async()=>{
  const client=await readFile('src/features/smart-textbook-runtime/components/audit-client.tsx','utf8');
  assert.equal((client.match(/<LessonRuntime\b/g)||[]).length,1);assert.match(client,/validationMode="complete"/);
  assert.doesNotMatch(client,/auditTurn|auditIssueTts|auditObserveTts/);
  const registry=await import('../src/features/smart-textbook-runtime/core/block-registry.ts');
  assert.equal(registry.rendererRegistry['compat.teacher.v1'].rendererStatus,'implemented');
  assert.equal(registry.runtimeReadiness(manifest,true).runtimeReady,true);
  assert.equal(registry.rendererRegistry.video.rendererStatus,'unsupported');
});
