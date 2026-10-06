import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeMediaController} from '../src/features/smart-textbook-runtime/core/native-media-controller.ts';
import {StepController} from '../src/features/smart-textbook-runtime/core/step-controller.ts';
import {createRuntimeFactsReadPort} from '../src/features/smart-textbook-runtime/core/runtime-facts.ts';
import {createFixture} from './fixtures/teaching-agent-r7b/fixture.server.mjs';
import {clone,controlledClock,createPublishedFixture,deferred,fakeMedia,flush,makeTestEnvelope} from './fixtures/course-video-published-media.mjs';

async function setup(t,{fixture=createPublishedFixture(),overrides={},media=fakeMedia(),restore=true}={}){
  const steps=new StepController(fixture.manifest),ports=fixture.ports(overrides);
  const owner=new NativeMediaController(fixture.manifest,fixture.context,steps,ports);
  const detach=owner.attach(media,'test-video');t.after(()=>steps.dispose());
  if(restore)await owner.restore();return {fixture,steps,ports,owner,media,detach};
}
async function trigger(x,time=6){
  await x.owner.play();x.media.currentTime=time;x.owner.observe(time);await flush();
  assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');assert.equal(x.media.paused,true);
}
function held(x,plays=1){assert.equal(x.media.plays,plays);assert.equal(x.media.paused,true);assert.equal(x.owner.snapshot().completedCueIds.length,0);}
function confirmed(x,plays=2){assert.equal(x.media.plays,plays);assert.equal(x.media.paused,false);assert.equal(x.owner.snapshot().phase,'PLAYING');assert.equal(x.owner.snapshot().unknown,false);}

test('explicit published/3 consumes preserved /3 while facts/1 keeps null server evidence',async t=>{
  const f=createPublishedFixture();let actual;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{actual=f.readback(r);return actual;}}}),stepBefore=x.steps.snapshot();await trigger(x);await x.owner.submit('test-activity','option-1');await flush();confirmed(x);
  const state=x.owner.snapshot(),facts=createRuntimeFactsReadPort(x.owner).read();
  assert.equal(state.publishedReceipt.contract,'activity-completion/3');assert.equal(state.evidence,null);
  assert.deepEqual(state.publishedReceipt,actual.receipt);
  assert.equal(facts.stateEvidence,null);assert.equal(facts.attemptSummary,null);assert.equal(facts.clientObservation.authoritativeProgress,false);
  assert.equal(facts.completion.status,'COMPLETED');assert.equal(x.steps.snapshot(),stepBefore);
  assert.equal(x.fixture.metrics.submits,1);assert.equal(x.fixture.metrics.readbacks,1);
  const submit=x.fixture.calls.submit[0],read=x.fixture.calls.readback[0],checkpoint=x.fixture.calls.checkpoint[0];
  assert.equal(read.requestId,submit.requestId);assert.equal(read.operation,'readback');assert.equal('readId' in submit,false);
  assert.notEqual(read.readId,checkpoint.readId);assert.notEqual(read.requestId,checkpoint.requestId);
});
test('mode selection is explicit; unknown modes and inconsistent published contexts reject',t=>{
  for(const mode of ['published','activity-completion/3','UNKNOWN','',null]){
    const fixture=createPublishedFixture(),steps=new StepController(fixture.manifest);t.after(()=>steps.dispose());
    assert.throws(()=>new NativeMediaController(fixture.manifest,fixture.context,steps,fixture.ports({completionMode:mode})),/COMPLETION_MODE/);
  }
  for(const patch of [{sourceState:'draft'},{trackingDisabled:true},{snapshotId:'wrong'}]){
    const fixture=createPublishedFixture(),steps=new StepController(fixture.manifest);t.after(()=>steps.dispose());
    assert.throws(()=>new NativeMediaController(fixture.manifest,{...fixture.context,...patch},steps,fixture.ports()),/PUBLISHED_CONTEXT/);
  }
});
test('missing mode and explicit legacy preserve /1 behavior without published sniffing',async t=>{
  for(const completionMode of [undefined,'legacy']){
    const fixture=createFixture(),steps=new StepController(fixture.manifest);t.after(()=>steps.dispose());
    const ports={...fixture.ports(),completionMode},owner=new NativeMediaController(fixture.manifest,fixture.context,steps,ports),media=fakeMedia();
    owner.attach(media,'test-video');await owner.restore();await trigger({owner,media});await owner.submit('test-activity','option-1');await flush();
    assert.equal(media.plays,2);assert.equal(owner.snapshot().publishedReceipt,null);assert.equal(owner.snapshot().evidence.source,'isolated-fixture');
  }
  const f=createFixture(),p=createPublishedFixture(),steps=new StepController(f.manifest);t.after(()=>steps.dispose());
  const owner=new NativeMediaController(f.manifest,f.context,steps,{...f.ports(),restore:async r=>({ ...r,pending:false,receipt:makeTestEnvelope(p.bindings[0],{...r,operation:'restore',readId:crypto.randomUUID()}).receipt})});
  const media=fakeMedia();owner.attach(media,'test-video');await owner.restore();assert.equal(owner.snapshot().phase,'ERROR');await owner.play();assert.equal(media.plays,0);
});
test('constructor rejects missing, duplicate and extra cue bindings',t=>{
  for(const variation of ['missing','duplicate','extra']){
    const f=createPublishedFixture({twoCues:true}),steps=new StepController(f.manifest);t.after(()=>steps.dispose());
    const bindings=variation==='missing'?f.bindings.slice(1):variation==='duplicate'?[f.bindings[0],f.bindings[0]]:[...f.bindings,clone(f.bindings[0])];
    assert.throws(()=>new NativeMediaController(f.manifest,f.context,steps,f.ports({publishedBindings:bindings})),/PUBLISHED_CUE_SET/);
  }
});
test('caller mutation cannot change captured execution, opaque identity, cue time, context or option scope',async t=>{
  const fixture=createPublishedFixture(),expected=clone(fixture.bindings[0]),calls=[];
  const read=async r=>{calls.push(r);return makeTestEnvelope(expected,r);};
  const steps=new StepController(fixture.manifest);t.after(()=>steps.dispose());
  const owner=new NativeMediaController(fixture.manifest,fixture.context,steps,fixture.ports({restore:read,checkpoint:read,readback:read}));
  fixture.context.runtimeSessionId='changed';fixture.context.snapshotId='changed';fixture.context.sourceState='draft';
  fixture.bindings[0].execution.sessionId='changed';fixture.bindings[0].published.scopeRef='changed';fixture.bindings.push(clone(expected));
  fixture.manifest.execution.cues[0].id='changed-cue';fixture.manifest.execution.cues[0].triggerTime=25;fixture.manifest.execution.cues[0].targetBlockId='changed-block';
  fixture.manifest.activityRefs[0].revision='changed';fixture.manifest.activityRefs[0].publicPresentation.options.push({id:'unbound-option',text:{'zh-CN':'test','ko-KR':'test'}});
  const media=fakeMedia();owner.attach(media,'test-video');await owner.restore();await trigger({owner,media});
  assert.equal(owner.snapshot().activeCueId,expected.execution.cueId);assert.equal(owner.snapshot().visibleActivity,expected.execution.blockId);
  assert.deepEqual(calls[1].binding,expected.execution);assert.equal(owner.context.runtimeSessionId,expected.execution.sessionId);
  assert.equal(Object.isFrozen(owner.cues),true);assert.equal(Object.isFrozen(owner.cues[0]),true);assert.equal(Object.isFrozen(fixture.manifest.execution.cues[0]),false);
  await assert.rejects(owner.submit('test-activity','unbound-option'),/OPTION_NOT_BOUND/);held({owner,media});
});
test('correct submit feedback cannot unlock before an independent readback',async t=>{
  const f=createPublishedFixture(),gate=deferred();let readRequest,actual;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{readRequest=r;actual=f.readback(r);return gate.promise;}}});await trigger(x);
  const pending=x.owner.submit('test-activity','option-1');await flush();
  assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');assert.equal(x.owner.snapshot().publishedReceipt.status,'INCOMPLETE');held(x);
  assert.equal(readRequest.operation,'readback');assert.equal(readRequest.requestId,f.calls.submit[0].requestId);
  gate.resolve(actual);await pending;await flush();confirmed(x);assert.deepEqual(x.owner.snapshot().publishedReceipt,actual.receipt);
});
test('COMPLETED feedback with independent INCOMPLETE holds; wrong feedback with COMPLETED read can resume',async t=>{
  const f=createPublishedFixture(),x=await setup(t,{fixture:f,overrides:{readback:async r=>{f.metrics.readbacks++;return f.envelope(r,{status:'INCOMPLETE'});}}});
  await trigger(x);const result=await x.owner.submit('test-activity','option-1');assert.equal(result.correct,true);assert.equal(result.nodeCompleted,true);
  assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');held(x);assert.equal(x.owner.snapshot().publishedReceipt.status,'INCOMPLETE');
  const f2=createPublishedFixture(),y=await setup(t,{fixture:f2,overrides:{readback:async r=>f2.envelope(r,{status:'COMPLETED',sequence:1})}});
  await trigger(y);const wrong=await y.owner.submit('test-activity','option-0');await flush();assert.equal(wrong.correct,false);confirmed(y);
});
test('wrong answer stays paused; next deliberate write can complete',async t=>{
  const x=await setup(t);await trigger(x);await x.owner.submit('test-activity','option-0');held(x);assert.equal(x.owner.snapshot().unknown,false);
  await x.owner.submit('test-activity','option-1');await flush();confirmed(x);assert.equal(x.fixture.metrics.submits,2);
});
test('write in flight blocks duplicate submit and external readback until settlement',async t=>{
  const f=createPublishedFixture(),gate=deferred();let feedback;
  const x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{feedback=f.submit(r,o);return gate.promise;}}});await trigger(x);
  const pending=x.owner.submit('test-activity','option-0');await flush();
  for(let i=0;i<3;i++){await x.owner.readback();assert.equal(await x.owner.submit('test-activity','option-1'),null);}
  assert.equal(f.metrics.submits,1);assert.equal(f.metrics.readbacks,0);assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');held(x);
  gate.resolve(feedback);await pending;assert.equal(f.metrics.readbacks,1);assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');held(x);
});
test('lost or malformed submit feedback still independently reads, with no repeated write',async t=>{
  for(const malformed of [false,true]){
    const f=createPublishedFixture(),x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{f.submit(r,o);if(malformed)return {result:{correct:true}};throw Error('lost response');}}});
    await trigger(x);assert.equal(await x.owner.submit('test-activity','option-1'),null);await flush();confirmed(x);
    assert.equal(f.metrics.submits,1);assert.equal(f.metrics.readbacks,1);
  }
});
test('submit timeout retires the write and starts a separately bounded fresh readback',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),gate=deferred();let feedback;
  const x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{feedback=f.submit(r,o);return gate.promise;}}});await trigger(x);
  const pending=x.owner.submit('test-activity','option-1');await flush();clock.advance(9_999);await flush();held(x);assert.equal(f.metrics.readbacks,0);
  clock.advance(1);await flush();await pending;confirmed(x);assert.equal(f.metrics.submits,1);assert.equal(f.metrics.readbacks,1);
  const state=x.owner.snapshot();gate.resolve(feedback);await flush();assert.deepEqual(x.owner.snapshot(),state);assert.equal(f.metrics.readbacks,1);
});
test('monotonic elapsed rejects overdue successful read even before delayed timer fires',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),gate=deferred();let request;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{request=r;return gate.promise;}}});await trigger(x);
  const read=x.owner.readback();await flush();clock.advance(10_001,false);
  gate.resolve(f.envelope(request,{status:'COMPLETED',sequence:1}));await read;held(x);assert.equal(x.owner.snapshot().unknown,true);assert.equal(x.owner.snapshot().publishedReceipt,null);
});
test('monotonic submit bound rejects overdue feedback yet permits its fresh independent read',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),gate=deferred();let feedback;
  const x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{feedback=f.submit(r,o);return gate.promise;}}});await trigger(x);
  const write=x.owner.submit('test-activity','option-1');await flush();clock.advance(10_001,false);gate.resolve(feedback);
  assert.equal(await write,null);await flush();confirmed(x);assert.equal(f.metrics.submits,1);assert.equal(f.metrics.readbacks,1);
});
test('current read timeout is local UNKNOWN; late success is retired and only a new read can recover',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),gate=deferred();let request,count=0;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{if(++count===1){request=r;return gate.promise;}return f.envelope(r,{status:'COMPLETED',sequence:1});}}});await trigger(x);
  const read=x.owner.readback();await flush();clock.advance(10_000);await flush();await read;
  held(x);assert.equal(x.owner.snapshot().unknown,true);assert.equal(await x.owner.submit('test-activity','option-1'),null);
  gate.resolve(f.envelope(request,{status:'COMPLETED',sequence:20}));await flush();held(x);assert.equal(x.owner.snapshot().unknown,true);
  await x.owner.readback();await flush();confirmed(x);assert.equal(x.fixture.metrics.submits,0);
});
test('two readbacks use different read IDs; newer completed success retires older rejection',async t=>{
  const f=createPublishedFixture(),a=deferred(),b=deferred(),requests=[];
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{requests.push(r);return requests.length===1?a.promise:b.promise;}}});await trigger(x);
  const first=x.owner.readback(),second=x.owner.readback();await flush();
  assert.notEqual(requests[0].readId,requests[1].readId);assert.equal(requests[0].requestId,requests[1].requestId);
  b.resolve(f.envelope(requests[1],{status:'COMPLETED',sequence:2}));await second;await flush();confirmed(x);
  const state=x.owner.snapshot();a.reject(Error('old rejected'));await first;assert.deepEqual(x.owner.snapshot(),state);confirmed(x);
});
test('older high-sequence COMPLETED cannot override newer INCOMPLETE or advance its sequence bound',async t=>{
  const f=createPublishedFixture(),a=deferred(),b=deferred(),requests=[];
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{requests.push(r);return requests.length===1?a.promise:requests.length===2?b.promise:f.envelope(r,{status:'COMPLETED',sequence:2});}}});await trigger(x);
  const first=x.owner.readback(),second=x.owner.readback();await flush();b.resolve(f.envelope(requests[1],{sequence:1}));await second;
  a.resolve(f.envelope(requests[0],{status:'COMPLETED',sequence:20}));await first;held(x);assert.equal(x.owner.snapshot().unknown,false);
  assert.equal(x.owner.snapshot().publishedReceipt.evidence.attemptSequence,1);await x.owner.readback();await flush();confirmed(x);
});
test('older failure cannot change newer pending read to UNKNOWN',async t=>{
  const f=createPublishedFixture(),a=deferred(),b=deferred(),requests=[];
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{requests.push(r);return requests.length===1?a.promise:b.promise;}}});await trigger(x);
  const first=x.owner.readback(),second=x.owner.readback();a.reject(Error('stale failure'));await first;
  assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');assert.equal(x.owner.snapshot().unknown,false);held(x);
  b.resolve(f.envelope(requests[1]));await second;assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');held(x);
});
test('older timeout cannot poison a newer read; older eventual success cannot revive',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),a=deferred(),b=deferred(),requests=[];
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{requests.push(r);return requests.length===1?a.promise:b.promise;}}});await trigger(x);
  const first=x.owner.readback();await flush();clock.advance(6_000);const second=x.owner.readback();await flush();clock.advance(4_000);await flush();await first;
  assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');assert.equal(x.owner.snapshot().unknown,false);held(x);
  b.resolve(f.envelope(requests[1],{status:'COMPLETED',sequence:1}));await second;await flush();confirmed(x);
  const state=x.owner.snapshot();a.resolve(f.envelope(requests[0],{status:'COMPLETED',sequence:20}));await flush();assert.deepEqual(x.owner.snapshot(),state);
});
test('new submit replaces the logical request and invalidates an older read while the write remains single flight',async t=>{
  const f=createPublishedFixture(),a=deferred(),writeGate=deferred();let oldRead,readCount=0,feedback;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{if(++readCount===1){oldRead=r;return a.promise;}return f.envelope(r);},submit:async(r,o)=>{feedback=f.submit(r,o);return writeGate.promise;}}});await trigger(x);
  const first=x.owner.readback();await flush();await x.owner.readback();
  const write=x.owner.submit('test-activity','option-0');await flush();assert.notEqual(oldRead.requestId,f.calls.submit[0].requestId);
  a.resolve(f.envelope(oldRead,{status:'COMPLETED',sequence:20}));await first;held(x);assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');
  assert.equal(await x.owner.submit('test-activity','option-1'),null);writeGate.resolve(feedback);await write;held(x);
  assert.equal(x.owner.snapshot().publishedReceipt.evidence.attemptSequence,1);assert.equal(f.metrics.submits,1);
});
test('late checkpoint failure is fenced after independent readback completes',async t=>{
  const f=createPublishedFixture(),checkpointGate=deferred();let checkpoint;
  const x=await setup(t,{fixture:f,overrides:{checkpoint:async r=>{checkpoint=r;f.checkpoint(r);return checkpointGate.promise;},readback:async r=>f.envelope(r,{status:'COMPLETED',sequence:1})}});
  await x.owner.play();x.media.currentTime=6;x.owner.observe(6);await flush();assert.equal(x.owner.snapshot().phase,'CUE_PENDING');held(x);
  await x.owner.readback();await flush();confirmed(x);checkpointGate.reject(Error('late checkpoint error'));await flush();confirmed(x);assert.equal(checkpoint.operation,'checkpoint');
});
test('invalid read has local UNKNOWN, does not advance sequence, and valid new read can clear it',async t=>{
  const f=createPublishedFixture();let count=0;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{const e=f.envelope(r,{status:'COMPLETED',sequence:++count===1?20:1});if(count===1)e.authority.published.scopeRef='wrong';return e;}}});await trigger(x);
  await x.owner.readback();held(x);assert.equal(x.owner.snapshot().unknown,true);assert.equal(x.owner.snapshot().publishedReceipt,null);
  await x.owner.readback();await flush();confirmed(x);assert.equal(x.owner.snapshot().publishedReceipt.evidence.attemptSequence,1);
});
test('descending accepted sequence fails closed for the immutable complete binding',async t=>{
  const f=createPublishedFixture();let count=0;
  const x=await setup(t,{fixture:f,overrides:{checkpoint:async r=>f.envelope(r,{sequence:3}),readback:async r=>f.envelope(r,{status:'COMPLETED',sequence:++count===1?2:3})}});await trigger(x);
  await x.owner.readback();held(x);assert.equal(x.owner.snapshot().unknown,true);await x.owner.readback();await flush();confirmed(x);
});
test('raw /3 checkpoint or expired valid-shaped /3 cannot authorize media',async t=>{
  for(const variation of ['raw','expired','wrong-operation','wrong-read-id']){
    const f=createPublishedFixture(),x=await setup(t,{fixture:f,overrides:{checkpoint:async r=>{
      const e=f.envelope(r,{status:'COMPLETED',sequence:1});
      if(variation==='raw')return e.receipt;
      if(variation==='expired')e.receipt.provenance.deadlineAt=new Date(Date.now()-1).toISOString();
      if(variation==='wrong-operation')e.request.operation='readback';
      if(variation==='wrong-read-id')e.request.readId=crypto.randomUUID();return e;
    }}});await trigger(x);held(x);assert.equal(x.owner.snapshot().unknown,true);
  }
});
test('restore is single flight, reentrant-safe and a successful repeat makes no additional read',async t=>{
  const f=createPublishedFixture(),gate=deferred();let request,owner;
  const steps=new StepController(f.manifest);t.after(()=>steps.dispose());
  owner=new NativeMediaController(f.manifest,f.context,steps,f.ports({restore:async r=>{request=r;f.metrics.restores++;assert.equal(owner.restore(),owner.restore());return gate.promise;}}));
  const media=fakeMedia();owner.attach(media,'test-video');const x={owner,media};
  const first=owner.restore(),second=owner.restore();assert.equal(first,second);await flush();assert.equal(f.metrics.restores,1);
  await owner.play();assert.equal(await owner.submit('test-activity','option-1'),null);held(x,0);
  gate.resolve(f.envelope(request));await first;await owner.restore();assert.equal(f.metrics.restores,1);assert.equal(owner.snapshot().restored,true);held(x,0);
});
test('multi-cue restore never exposes partial completion and a later failure leaves non-playable ERROR',async t=>{
  const f=createPublishedFixture({twoCues:true}),second=deferred();let n=0;
  const x=await setup(t,{fixture:f,restore:false,overrides:{restore:async r=>++n===1?f.envelope(r,{status:'COMPLETED',sequence:10}):second.promise}});
  const restore=x.owner.restore();await flush();assert.equal(n,2);assert.equal(x.owner.snapshot().restored,false);assert.deepEqual(x.owner.snapshot().completedCueIds,[]);
  await x.owner.play();held(x,0);second.reject(Error('restore failed'));await restore;
  assert.equal(x.owner.snapshot().phase,'ERROR');assert.equal(x.owner.snapshot().restored,false);assert.deepEqual(x.owner.snapshot().completedCueIds,[]);
  await x.owner.restore();await x.owner.play();assert.equal(n,2);held(x,0);
});
test('completed restore has no autoplay and INCOMPLETE pending restores UI without inventing position',async t=>{
  const completed=createPublishedFixture();completed.setState('vowel-cue',{completed:true,attempts:1});
  const x=await setup(t,{fixture:completed});assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue']);assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
  await x.owner.play();confirmed(x,1);
  const pending=createPublishedFixture();pending.setState('vowel-cue',{pending:true});const y=await setup(t,{fixture:pending});
  assert.equal(y.owner.snapshot().activeCueId,'vowel-cue');assert.equal(y.owner.snapshot().position,0);await y.owner.play();held(y,0);
  await y.owner.submit('test-activity','option-1');assert.equal(y.owner.snapshot().phase,'RESUME_READY');assert.equal(y.media.plays,0);assert.equal(y.media.paused,true);
});
test('a reconstructed owner with INCOMPLETE read does not borrow old client completion',async t=>{
  const f=createPublishedFixture(),x=await setup(t,{fixture:f});await trigger(x);await x.owner.submit('test-activity','option-1');await flush();confirmed(x);x.steps.dispose();
  const incomplete=createPublishedFixture(),y=await setup(t,{fixture:incomplete,media:fakeMedia({currentTime:10})});
  assert.deepEqual(y.owner.snapshot().completedCueIds,[]);await y.owner.play();await flush();held(y,0);assert.equal(y.owner.snapshot().activeCueId,'vowel-cue');
});
test('detach while restore is pending forces new restore; old completed success or rejection has no effect',async t=>{
  for(const rejection of [false,true]){
    const f=createPublishedFixture(),old=deferred();let firstRequest,n=0;
    const x=await setup(t,{fixture:f,restore:false,overrides:{restore:async r=>{if(++n===1){firstRequest=r;return old.promise;}return f.restore(r);}}});
    const oldRestore=x.owner.restore();await flush();x.detach();const fresh=fakeMedia();x.owner.attach(fresh,'test-video');await x.owner.restore();
    assert.equal(n,2);assert.equal(x.owner.snapshot().restored,true);assert.deepEqual(x.owner.snapshot().completedCueIds,[]);assert.notEqual(firstRequest.readId,f.calls.restore[0].readId);
    const state=x.owner.snapshot();if(rejection)old.reject(Error('old restore failed'));else old.resolve(f.envelope(firstRequest,{status:'COMPLETED',sequence:20}));
    await oldRestore;assert.deepEqual(x.owner.snapshot(),state);assert.equal(fresh.plays,0);assert.equal(fresh.paused,true);
  }
});
test('detach discards completion permission and reattach must reconfirm independently',async t=>{
  const f=createPublishedFixture();f.setState('vowel-cue',{completed:true,attempts:2});const x=await setup(t,{fixture:f});
  assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue']);x.detach();assert.equal(x.owner.snapshot().restored,false);assert.deepEqual(x.owner.snapshot().completedCueIds,[]);
  f.setState('vowel-cue',{completed:false,pending:false,attempts:2});const fresh=fakeMedia({currentTime:10});x.owner.attach(fresh,'test-video');await x.owner.restore();
  assert.equal(f.metrics.restores,2);await x.owner.play();await flush();assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');assert.equal(fresh.plays,0);assert.equal(fresh.paused,true);
});
test('same-binding sequence lower bound survives detach and rejects descending restore',async t=>{
  const f=createPublishedFixture();f.setState('vowel-cue',{attempts:3});const x=await setup(t,{fixture:f});x.detach();f.setState('vowel-cue',{attempts:2});
  const fresh=fakeMedia();x.owner.attach(fresh,'test-video');await x.owner.restore();assert.equal(x.owner.snapshot().phase,'ERROR');await x.owner.play();assert.equal(fresh.plays,0);
});
test('old submit settlement after reattach never reads or drives the new activity',async t=>{
  const f=createPublishedFixture(),gate=deferred();let feedback;
  const x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{feedback=f.submit(r,o);return gate.promise;}}});await trigger(x);
  const write=x.owner.submit('test-activity','option-0');await flush();x.detach();const fresh=fakeMedia();x.owner.attach(fresh,'test-video');await x.owner.restore();
  assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');gate.resolve(feedback);assert.equal(await write,null);assert.equal(f.metrics.readbacks,0);
  assert.equal(fresh.plays,0);assert.equal(fresh.paused,true);assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');
});
test('Step disposal and generation release fence successful and failed published callbacks',async t=>{
  for(const rejection of [false,true]){
    const f=createPublishedFixture(),gate=deferred();let read;
    const x=await setup(t,{fixture:f,overrides:{readback:async r=>{read=r;return gate.promise;}}});await trigger(x);const pending=x.owner.readback();await flush();
    const state=x.owner.snapshot(),generation=x.steps.generation;x.steps.dispose();assert.equal(x.steps.generation,generation+1);
    if(rejection)gate.reject(Error('late'));else gate.resolve(f.envelope(read,{status:'COMPLETED',sequence:1}));await pending;
    assert.deepEqual(x.owner.snapshot(),state);assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);
  }
});
test('seek before restore and initially crossed position both gate before any media.play',async t=>{
  for(const initial of [false,true]){
    const f=createPublishedFixture(),gate=deferred();let request;
    const x=await setup(t,{fixture:f,media:fakeMedia({currentTime:initial?20:0}),restore:false,overrides:{restore:async r=>{request=r;return gate.promise;}}});
    const restore=x.owner.restore();await flush();if(!initial)x.owner.seek(20);await x.owner.play();held(x,0);
    gate.resolve(f.envelope(request));await restore;await x.owner.play();await flush();held(x,0);assert.equal(f.metrics.checkpoints,1);assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');
  }
});
test('direct currentTime crossing without observe is checked before an explicit play call',async t=>{
  const x=await setup(t);x.media.currentTime=20;await x.owner.play();await flush();held(x,0);assert.equal(x.owner.snapshot().position,20);assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');
});
test('two crossed cues are handled in order, with no intermediate play and original resume intent retained',async t=>{
  const x=await setup(t,{fixture:createPublishedFixture({twoCues:true})});await x.owner.play();x.owner.seek(20);await flush();held(x);assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');
  await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);
  assert.deepEqual(x.fixture.calls.checkpoint.map(r=>r.binding.cueId),['vowel-cue','second-test-cue']);
  await x.owner.submit('second-test-activity','option-1');await flush();confirmed(x);assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue','second-test-cue']);
  x.owner.seek(2);x.media.currentTime=20;x.owner.observe(20);assert.equal(x.fixture.metrics.checkpoints,2);assert.equal(x.media.plays,2);
});
test('two crossed cues from already paused seek do not manufacture auto-resume intent',async t=>{
  const x=await setup(t,{fixture:createPublishedFixture({twoCues:true})});x.owner.seek(20);await flush();held(x,0);
  await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.media.plays,0);
  await x.owner.submit('second-test-activity','option-1');await flush();assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
});
test('restored later pending cue yields to the earliest crossed incomplete cue without a play action or losing user pause',async t=>{
  for(const positionMode of ['initial','seek-during-restore','seek-after-restore'])for(const userPaused of [false,true])await t.test(`${positionMode}, userPaused=${userPaused}`,async t=>{
    const f=createPublishedFixture({twoCues:true}),gate=deferred();f.setState('second-test-cue',{pending:true});
    const x=await setup(t,{fixture:f,restore:false,media:fakeMedia({currentTime:positionMode==='initial'?20:0}),overrides:{restore:async r=>{
      const data=f.restore(r);return r.binding.cueId==='second-test-cue'?gate.promise.then(()=>data):data;
    }}});
    const restore=x.owner.restore();await flush();assert.equal(x.owner.snapshot().restored,false);assert.deepEqual(x.owner.snapshot().completedCueIds,[]);held(x,0);
    if(userPaused)x.owner.userPause();
    if(positionMode==='seek-during-restore')x.owner.seek(20);
    gate.resolve();await restore;await flush();
    if(positionMode==='seek-after-restore'){
      assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.owner.snapshot().position,0);assert.equal(f.metrics.checkpoints,0);
      x.owner.seek(20);
    }
    await flush();
    assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');assert.equal(x.owner.snapshot().position,20);
    assert.equal(x.owner.snapshot().userPaused,userPaused);assert.deepEqual(f.calls.checkpoint.map(r=>r.binding.cueId),['vowel-cue']);held(x,0);
    await x.owner.submit('test-activity','option-1');await flush();
    assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue']);
    assert.deepEqual(f.calls.checkpoint.map(r=>r.binding.cueId),['vowel-cue','second-test-cue']);assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);assert.equal(x.owner.snapshot().userPaused,userPaused);
    await x.owner.submit('second-test-activity','option-1');await flush();
    assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue','second-test-cue']);assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
    assert.equal(x.owner.snapshot().userPaused,userPaused);assert.equal(f.metrics.submits,2);
    await x.owner.play();confirmed(x,1);assert.equal(x.owner.snapshot().userPaused,false);assert.equal(f.metrics.checkpoints,2);
  });
});
test('seek immediately retires later pending UI and direct stale submit cannot write it without play',async t=>{
  for(const userPaused of [false,true])await t.test(`userPaused=${userPaused}`,async t=>{
    const f=createPublishedFixture({twoCues:true});f.setState('second-test-cue',{pending:true});const x=await setup(t,{fixture:f});
    assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.owner.snapshot().position,0);assert.equal(f.metrics.checkpoints,0);
    if(userPaused)x.owner.userPause();x.owner.seek(20);
    assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');assert.equal(x.owner.snapshot().visibleActivity,null);
    assert.equal(await x.owner.submit('second-test-activity','option-1'),null);await flush();
    assert.deepEqual(f.calls.submit,[]);assert.deepEqual(f.calls.checkpoint.map(r=>r.binding.cueId),['vowel-cue']);held(x,0);
    assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');assert.equal(x.owner.snapshot().visibleActivity,'test-activity');assert.equal(x.owner.snapshot().userPaused,userPaused);
    await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');
    assert.deepEqual(f.calls.submit.map(r=>r.binding.cueId),['vowel-cue']);assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
    await x.owner.submit('second-test-activity','option-1');await flush();
    assert.deepEqual(f.calls.submit.map(r=>r.binding.cueId),['vowel-cue','second-test-cue']);assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue','second-test-cue']);
    assert.equal(x.owner.snapshot().userPaused,userPaused);assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
  });
});
test('submit itself checks actual crossed position before dispatching a restored later cue',async t=>{
  const f=createPublishedFixture({twoCues:true});f.setState('second-test-cue',{pending:true});const x=await setup(t,{fixture:f});
  x.media.currentTime=20;assert.equal(await x.owner.submit('second-test-activity','option-1'),null);await flush();
  assert.deepEqual(f.calls.submit,[]);assert.equal(x.owner.snapshot().activeCueId,'vowel-cue');assert.deepEqual(f.calls.checkpoint.map(r=>r.binding.cueId),['vowel-cue']);held(x,0);
});
test('pending hint remains legitimate when the earlier cue has not been crossed',async t=>{
  const f=createPublishedFixture({twoCues:true});f.setState('second-test-cue',{pending:true});const x=await setup(t,{fixture:f});
  x.owner.seek(4);await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.owner.snapshot().position,4);assert.equal(f.metrics.checkpoints,0);
  assert.equal((await x.owner.submit('second-test-activity','option-0')).correct,false);assert.deepEqual(f.calls.submit.map(r=>r.binding.cueId),['second-test-cue']);
  assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');assert.equal(x.owner.snapshot().position,4);held(x,0);
});
test('read success or failure for a displaced later cue cannot change the earlier cue or its accepted sequence',async t=>{
  for(const rejected of [false,true])await t.test(`rejected=${rejected}`,async t=>{
    const f=createPublishedFixture({twoCues:true}),gate=deferred();let oldRequest,first=true;f.setState('second-test-cue',{pending:true});
    const x=await setup(t,{fixture:f,overrides:{readback:async r=>{
      if(first&&r.binding.cueId==='second-test-cue'){first=false;oldRequest=r;return gate.promise;}return f.readback(r);
    }}});
    const oldRead=x.owner.readback();await flush();assert.equal(x.owner.snapshot().phase,'CHECKING_COMPLETION');
    x.owner.seek(20);await flush();const state=x.owner.snapshot();assert.equal(state.activeCueId,'vowel-cue');assert.equal(state.unknown,false);held(x,0);
    if(rejected)gate.reject(Error('displaced later read failed'));else gate.resolve(f.envelope(oldRequest,{status:'COMPLETED',sequence:20}));
    await oldRead;assert.deepEqual(x.owner.snapshot(),state);assert.equal(f.metrics.submits,0);held(x,0);
    await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');
    await x.owner.submit('second-test-activity','option-1');await flush();
    assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue','second-test-cue']);assert.equal(x.owner.snapshot().publishedReceipt.evidence.attemptSequence,1);
    assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.owner.snapshot().unknown,false);assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
  });
});
test('displaced later write stays single flight and its late settlement never reads or drives the earlier cue',async t=>{
  for(const rejected of [false,true])await t.test(`rejected=${rejected}`,async t=>{
    const f=createPublishedFixture({twoCues:true}),gate=deferred();let feedback,first=true;f.setState('second-test-cue',{pending:true});
    const x=await setup(t,{fixture:f,overrides:{submit:async(r,o)=>{
      const result=f.submit(r,o);if(first){first=false;feedback=result;return gate.promise;}return result;
    }}});
    const oldWrite=x.owner.submit('second-test-activity','option-0');await flush();assert.equal(f.metrics.submits,1);
    x.owner.seek(20);await flush();const state=x.owner.snapshot();assert.equal(state.activeCueId,'vowel-cue');assert.equal(state.phase,'AWAITING_ACTIVITY');held(x,0);
    assert.equal(await x.owner.submit('test-activity','option-1'),null);assert.equal(await x.owner.submit('second-test-activity','option-1'),null);await x.owner.readback();
    assert.equal(f.metrics.submits,1);assert.equal(f.metrics.readbacks,0);
    if(rejected)gate.reject(Error('displaced later write failed'));else gate.resolve(feedback);
    assert.equal(await oldWrite,null);assert.deepEqual(x.owner.snapshot(),state);assert.equal(f.metrics.readbacks,0);
    await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.owner.snapshot().activeCueId,'second-test-cue');
    await x.owner.submit('second-test-activity','option-1');await flush();
    assert.deepEqual(f.calls.submit.map(r=>r.binding.cueId),['second-test-cue','vowel-cue','second-test-cue']);assert.equal(f.metrics.submits,3);assert.equal(f.metrics.readbacks,2);
    assert.deepEqual(x.owner.snapshot().completedCueIds,['vowel-cue','second-test-cue']);assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
  });
});
test('user pause at second crossed cue cancels the entire original resume intent',async t=>{
  const x=await setup(t,{fixture:createPublishedFixture({twoCues:true})});await x.owner.play();x.owner.seek(20);await flush();await x.owner.submit('test-activity','option-1');await flush();
  x.owner.userPause();await x.owner.submit('second-test-activity','option-1');await flush();assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);assert.equal(x.owner.snapshot().userPaused,true);
});
test('user pause wins against delayed correct readback and explicit later play can resume',async t=>{
  const f=createPublishedFixture(),gate=deferred();let request;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{request=r;return gate.promise;}}});await trigger(x);
  const read=x.owner.readback();await flush();x.owner.userPause();gate.resolve(f.envelope(request,{status:'COMPLETED',sequence:1}));await read;await flush();
  assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.owner.snapshot().userPaused,true);assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);
  await x.owner.play();confirmed(x);
});
test('late play fulfillment after user pause physically pauses media and never overwrites pause state',async t=>{
  const x=await setup(t),gate=deferred();x.media.play=()=>{x.media.plays++;return gate.promise.then(()=>{x.media.paused=false;});};
  const play=x.owner.play();await flush();x.owner.userPause();gate.resolve();await play;
  assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);assert.equal(x.owner.snapshot().userPaused,true);assert.equal(x.owner.snapshot().event,'USER_PAUSED');
});
test('late play after a cue holds the activity and pauses any late physical start',async t=>{
  const x=await setup(t),gate=deferred();x.media.play=()=>{x.media.plays++;return gate.promise.then(()=>{x.media.paused=false;});};
  const play=x.owner.play();x.media.currentTime=8;x.owner.observe(8);await flush();gate.resolve();await play;held(x);assert.equal(x.owner.snapshot().phase,'AWAITING_ACTIVITY');
});
test('old attachment play is paused on the old media without pausing current legal play',async t=>{
  const x=await setup(t),gate=deferred(),old=x.media;old.play=()=>{old.plays++;return gate.promise.then(()=>{old.paused=false;});};
  const play=x.owner.play();await flush();x.detach();const fresh=fakeMedia();x.owner.attach(fresh,'test-video');await x.owner.restore();await x.owner.play();
  gate.resolve();await play;assert.equal(old.paused,true);assert.equal(fresh.paused,false);assert.equal(fresh.plays,1);assert.equal(x.owner.snapshot().phase,'PLAYING');
});
test('reused media object with a new legal attachment play is not paused by its old promise',async t=>{
  const x=await setup(t),gate=deferred();x.media.play=()=>{x.media.plays++;if(x.media.plays===1)return gate.promise.then(()=>{x.media.paused=false;});x.media.paused=false;return Promise.resolve();};
  const play=x.owner.play();await flush();x.detach();x.owner.attach(x.media,'test-video');await x.owner.restore();await x.owner.play();
  gate.resolve();await play;assert.equal(x.media.plays,2);assert.equal(x.media.paused,false);assert.equal(x.owner.snapshot().phase,'PLAYING');
});
test('autoplay rejection clears automatic retry; a subsequent cue completion does not retry until explicit play',async t=>{
  const x=await setup(t);x.media.play=async()=>{x.media.plays++;if(x.media.plays===1)throw Error('NotAllowedError');x.media.paused=false;};
  await x.owner.play();assert.equal(x.owner.snapshot().event,'AUTOPLAY_BLOCKED');assert.equal(x.owner.snapshot().phase,'RESUME_READY');assert.equal(x.media.paused,true);
  x.owner.seek(10);await flush();await x.owner.submit('test-activity','option-1');await flush();assert.equal(x.media.plays,1);assert.equal(x.media.paused,true);
  await x.owner.play();confirmed(x);
});
test('late rejected play cannot overwrite user pause or a new attachment state',async t=>{
  const x=await setup(t),gate=deferred();x.media.play=()=>{x.media.plays++;return gate.promise;};
  const play=x.owner.play();x.owner.userPause();const state=x.owner.snapshot();gate.reject(Error('old autoplay denial'));await play;
  assert.deepEqual(x.owner.snapshot(),state);assert.equal(x.media.paused,true);assert.equal(x.media.plays,1);
});
test('mediaError is terminal across late read/play success, restore calls and reattach',async t=>{
  const f=createPublishedFixture(),readGate=deferred();let request;
  const x=await setup(t,{fixture:f,overrides:{readback:async r=>{request=r;return readGate.promise;}}});await trigger(x);const read=x.owner.readback();await flush();x.owner.mediaError();
  readGate.resolve(f.envelope(request,{status:'COMPLETED',sequence:1}));await read;assert.equal(x.owner.snapshot().phase,'ERROR');held(x);
  await x.owner.restore();await x.owner.play();assert.equal(f.metrics.restores,1);x.detach();const fresh=fakeMedia();x.owner.attach(fresh,'test-video');await x.owner.restore();await x.owner.play();
  assert.equal(x.owner.snapshot().phase,'ERROR');assert.equal(f.metrics.restores,1);assert.equal(fresh.plays,0);assert.equal(fresh.paused,true);
  const y=await setup(t),playGate=deferred();y.media.play=()=>{y.media.plays++;return playGate.promise.then(()=>{y.media.paused=false;});};
  const play=y.owner.play();y.owner.mediaError();playGate.resolve();await play;assert.equal(y.owner.snapshot().phase,'ERROR');assert.equal(y.media.paused,true);
});
test('restored and checkpoint completed cues skip replay with no new answer or expiry of already accepted binding',async t=>{
  const clock=controlledClock(t),f=createPublishedFixture(),x=await setup(t,{fixture:f,overrides:{checkpoint:async r=>f.envelope(r,{status:'COMPLETED',sequence:1})}});
  await x.owner.play();x.media.currentTime=6;x.owner.observe(6);await flush();confirmed(x);assert.equal(f.metrics.submits,0);
  x.owner.userPause();clock.advance(60_000,false);x.owner.seek(2);await x.owner.play();x.media.currentTime=8;x.owner.observe(8);
  assert.equal(x.media.plays,3);assert.equal(x.media.paused,false);assert.equal(x.owner.snapshot().activeCueId,null);assert.equal(f.metrics.submits,0);
});
test('media-ended and invalid duration are presentation/error events, never domain completion',async t=>{
  const x=await setup(t),before=x.steps.snapshot();x.media.currentTime=4;x.owner.ended();assert.equal(x.owner.snapshot().event,'MEDIA_ENDED');assert.deepEqual(x.owner.snapshot().completedCueIds,[]);
  assert.equal(x.fixture.metrics.submits,0);assert.equal(x.steps.snapshot(),before);assert.equal(x.media.plays,0);
  x.owner.metadata(4);assert.equal(x.owner.snapshot().phase,'ERROR');await x.owner.play();assert.equal(x.media.plays,0);assert.equal(x.media.paused,true);
});
