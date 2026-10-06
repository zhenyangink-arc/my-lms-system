import assert from 'node:assert/strict';
import test from 'node:test';
import {completionReceiptSchema,executionBinding,executionBindingSchema} from '../src/features/smart-textbook-runtime/core/execution-contracts.ts';
import {acceptPublishedMediaRead,freezePublishedCueBindings,publishedCueBindingSchema,publishedReadRequestSchema,publishedMediaReadEnvelopeSchema} from '../src/features/smart-textbook-runtime/core/published-media-contracts.ts';
import {clone,createPublishedFixture,makeTestEnvelope} from './fixtures/course-video-published-media.mjs';
import {createFixture} from './fixtures/teaching-agent-r7b/fixture.server.mjs';

const now=Date.parse('2026-10-05T01:00:00.000Z'),iso=ms=>new Date(ms).toISOString();
function sample(operation='readback',options={}){
  const fixture=createPublishedFixture(),authority=fixture.bindings[0];
  const request={binding:clone(authority.execution),requestId:crypto.randomUUID(),generation:2,readId:crypto.randomUUID(),operation};
  return {fixture,authority,request,envelope:makeTestEnvelope(authority,request,{wall:now,...options})};
}
function rejects(change,operation='readback',options={}){
  const x=sample(operation,options);change(x.envelope,x);
  assert.throws(()=>acceptPublishedMediaRead(x.envelope,x.request,x.authority,0,now));
}
test('published consumer preserves exact /3 and freezes copied envelope without authenticating opaque refs',()=>{
  const x=sample('readback',{status:'COMPLETED',sequence:2});
  const checked=acceptPublishedMediaRead(x.envelope,x.request,x.authority,1,now);
  assert.deepEqual(checked.receipt,x.envelope.receipt);
  assert.notEqual(checked.receipt,x.envelope.receipt);
  assert.equal(checked.receipt.contract,'activity-completion/3');
  assert.notEqual(checked.authority.published.activityRef,checked.authority.execution.activityRef);
  for(const object of [checked,checked.receipt,checked.receipt.evidence,checked.receipt.provenance,checked.request,checked.request.binding,checked.authority,checked.authority.execution,checked.authority.published])assert.equal(Object.isFrozen(object),true);
  x.envelope.receipt.evidence.attemptSequence=0;
  assert.equal(checked.receipt.evidence.attemptSequence,2);
});
test('raw /3, submit feedback, /1 and /2 cannot be published read envelopes; /3 cannot be legacy',()=>{
  const x=sample(),f=createFixture(),legacyRequest={binding:executionBinding(f.manifest,f.context,f.manifest.execution.cues[0]),requestId:'test-legacy-request',generation:0};
  const legacy=f.restore(legacyRequest).receipt;
  const durable={...legacy,contract:'activity-completion/2',evidence:{source:'activity-domain',storage:'isolated-test-db',kind:'durable-attempt-sequence',attemptSequence:0,stateDigest:'a'.repeat(64),observedAt:iso(now),latestAttemptAt:null,progressUpdatedAt:null}};
  assert.doesNotThrow(()=>completionReceiptSchema.parse(legacy));
  assert.doesNotThrow(()=>completionReceiptSchema.parse(durable));
  for(const raw of [x.envelope.receipt,legacy,durable,{result:{correct:true}}])assert.throws(()=>acceptPublishedMediaRead(raw,x.request,x.authority,0,now));
  for(const receipt of [legacy,durable])assert.throws(()=>publishedMediaReadEnvelopeSchema.parse({...x.envelope,receipt}));
  assert.throws(()=>completionReceiptSchema.parse(x.envelope.receipt));
});
test('strict schema rejects every missing envelope/nested field and unknown field',async t=>{
  const paths=[[],['request'],['request','binding'],['authority'],['authority','execution'],['authority','published'],['receipt'],['receipt','provenance'],['receipt','evidence']];
  for(const path of paths){
    const x=sample();let target=x.envelope;for(const key of path)target=target[key];
    for(const key of Object.keys(target))await t.test(`missing ${[...path,key].join('.')}`,()=>{
      rejects(envelope=>{let nested=envelope;for(const p of path)nested=nested[p];delete nested[key];});
    });
    await t.test(`extra ${path.join('.')||'envelope'}`,()=>rejects(envelope=>{let nested=envelope;for(const p of path)nested=nested[p];nested.extra=true;}));
  }
});
test('exact request and every execution field must match independently in request and authority',async t=>{
  for(const where of ['request','authority'])for(const key of Object.keys(executionBindingSchema.shape))await t.test(`${where}.${key}`,()=>{
    rejects(envelope=>{const b=where==='request'?envelope.request.binding:envelope.authority.execution;b[key]=key==='snapshotDigest'?`sha256:${'b'.repeat(64)}`:'other-test-value';});
  });
  for(const key of ['requestId','generation','readId','operation'])await t.test(key,()=>rejects(envelope=>{
    envelope.request[key]=key==='generation'?3:key==='readId'?crypto.randomUUID():key==='operation'?'checkpoint':'different-logical-request';
  }));
  assert.throws(()=>publishedReadRequestSchema.parse({...sample().request,readId:'not-a-uuid'}));
});
test('all ten opaque authority refs and all seven /3 provenance refs match expected authority',async t=>{
  for(const key of Object.keys(sample().authority.published))await t.test(`authority.${key}`,()=>rejects(envelope=>{envelope.authority.published[key]='other-opaque-ref';}));
  for(const key of ['snapshotRef','scopeRef','contentRef','activityRef','executionNodeRef','sourceTeachingNodeRef','versionRef'])await t.test(`receipt.${key}`,()=>rejects(envelope=>{envelope.receipt.provenance[key]='other-opaque-ref';}));
  for(const key of ['activityRevision','mediaRef','completionPolicy'])await t.test(key,()=>rejects(envelope=>{envelope.authority[key]='wrong-binding';}));
  for(const value of ['', 'a'.repeat(201)])assert.throws(()=>publishedCueBindingSchema.parse({...sample().authority,published:{...sample().authority.published,scopeRef:value}}));
});
test('pending only restores incomplete cues and never authorizes a completed cue',()=>{
  for(const operation of ['checkpoint','readback'])rejects(envelope=>{envelope.pending=true;},operation);
  rejects(envelope=>{envelope.pending=true;},'restore',{status:'COMPLETED'});
  const x=sample('restore',{pending:true});assert.equal(acceptPublishedMediaRead(x.envelope,x.request,x.authority,0,now).pending,true);
  assert.equal('position' in x.envelope,false);
  rejects(envelope=>{envelope.position=12;},'restore');
});
test('freshness enforces admission, read start, asOf equality, deadline and 30 second receive/read spans',async t=>{
  const cases={
    'read before admission':e=>{e.acceptedAt=iso(now-1);},
    'read starts after asOf':e=>{e.receipt.provenance.readStartedAt=iso(now+1);},
    'asOf differs from observedAt':e=>{e.receipt.provenance.observedAt=iso(now-1);},
    'deadline expired':e=>{e.receipt.provenance.deadlineAt=iso(now-1);},
    'future asOf':e=>{e.receipt.provenance.asOf=e.receipt.provenance.observedAt=iso(now+1);},
    'stale at receive':e=>{e.acceptedAt=iso(now-31_003);e.receipt.provenance.readStartedAt=iso(now-31_002);e.receipt.provenance.asOf=e.receipt.provenance.observedAt=iso(now-31_000);},
    'long read span':e=>{e.acceptedAt=iso(now-30_002);e.receipt.provenance.readStartedAt=iso(now-30_001);},
    'malformed timestamp':e=>{e.acceptedAt='not-a-time';},
    'asOf after deadline':e=>{e.receipt.provenance.deadlineAt=iso(now-1);},
  };
  for(const [name,change] of Object.entries(cases))await t.test(name,()=>rejects(change));
  const x=sample();x.envelope.acceptedAt=x.envelope.receipt.provenance.readStartedAt=iso(now-30_000);
  x.envelope.receipt.provenance.deadlineAt=iso(now);
  assert.doesNotThrow(()=>acceptPublishedMediaRead(x.envelope,x.request,x.authority,0,now));
  assert.throws(()=>acceptPublishedMediaRead(x.envelope,x.request,x.authority,0,NaN));
  // Server admission is in its clock domain, with no client-dispatch comparison.
  const skew=sample();skew.envelope.acceptedAt=iso(now-10_000);
  assert.doesNotThrow(()=>acceptPublishedMediaRead(skew.envelope,skew.request,skew.authority,0,now));
});
test('completed requires positive persisted attempts and every durable timestamp at or before asOf',async t=>{
  const changes={
    'zero attempts':e=>{e.receipt.attemptNumber=e.receipt.evidence.attemptSequence=0;},
    'missing latest attempt':e=>{e.receipt.evidence.latestAttemptAt=null;},
    'missing progress update':e=>{e.receipt.evidence.progressUpdatedAt=null;},
    'missing completedAt':e=>{e.receipt.completedAt=null;},
    'future latest attempt':e=>{e.receipt.evidence.latestAttemptAt=iso(now+1);},
    'future progress update':e=>{e.receipt.evidence.progressUpdatedAt=iso(now+1);},
    'future completedAt':e=>{e.receipt.completedAt=iso(now+1);},
    'attempt mismatch':e=>{e.receipt.evidence.attemptSequence=2;},
    'UNKNOWN is not /3':e=>{e.receipt.status='UNKNOWN';},
    'non Tool version':e=>{e.receipt.provenance.toolVersion='test';},
    'non published storage':e=>{e.receipt.provenance.storage='isolated-test-db';},
  };
  for(const [name,change] of Object.entries(changes))await t.test(name,()=>rejects(change,'readback',{status:'COMPLETED'}));
  const x=sample('readback',{status:'COMPLETED',sequence:3});
  assert.doesNotThrow(()=>acceptPublishedMediaRead(x.envelope,x.request,x.authority,3,now));
  assert.throws(()=>acceptPublishedMediaRead(x.envelope,x.request,x.authority,4,now));
});
test('constructor bindings copy/freeze exact owner cue set and validate every manifest field',async t=>{
  const fixture=createPublishedFixture({twoCues:true}),{manifest,context,bindings}=fixture;
  const result=freezePublishedCueBindings(manifest,context,manifest.execution.cues,bindings);
  assert.equal(Object.isFrozen(result),true);assert.notEqual(result[0],bindings[0]);assert.equal(Object.isFrozen(bindings[0]),false);
  for(const binding of result)for(const value of [binding,binding.execution,binding.published])assert.equal(Object.isFrozen(value),true);
  bindings[0].published.scopeRef='caller-mutated';assert.notEqual(result[0].published.scopeRef,bindings[0].published.scopeRef);
  for(const name of ['missing','duplicate','extra'])await t.test(name,()=>{
    const x=createPublishedFixture({twoCues:true});const raw=name==='missing'?x.bindings.slice(1):name==='duplicate'?[x.bindings[0],x.bindings[0]]:[...x.bindings,clone(x.bindings[0])];
    assert.throws(()=>freezePublishedCueBindings(x.manifest,x.context,x.manifest.execution.cues,raw));
  });
  for(const key of Object.keys(executionBindingSchema.shape))await t.test(`binding ${key}`,()=>{
    const x=createPublishedFixture();x.bindings[0].execution[key]=key==='snapshotDigest'?`sha256:${'b'.repeat(64)}`:'different';
    assert.throws(()=>freezePublishedCueBindings(x.manifest,x.context,x.manifest.execution.cues,x.bindings));
  });
  for(const key of ['activityRevision','mediaRef','completionPolicy'])await t.test(key,()=>{
    const x=createPublishedFixture();x.bindings[0][key]='different';assert.throws(()=>freezePublishedCueBindings(x.manifest,x.context,x.manifest.execution.cues,x.bindings));
  });
  for(const patch of [{sourceState:'draft'},{trackingDisabled:true},{snapshotId:'other-snapshot'}])assert.throws(()=>freezePublishedCueBindings(manifest,{...context,...patch},manifest.execution.cues,result));
  for(const target of ['cue','native-media','media-ref','source-media-ref','activity'])await t.test(`manifest ${target}`,()=>{
    const x=createPublishedFixture();
    if(target==='cue')x.manifest.execution.cues[0].mediaRevision='other-revision';
    if(target==='native-media')x.manifest.execution.media[0].revision='other-revision';
    if(target==='media-ref')x.manifest.mediaRefs[0].revision='other-revision';
    if(target==='source-media-ref')x.manifest.blocks.find(b=>b.type==='video').props.mediaRef='other-ref';
    if(target==='activity')x.manifest.activityRefs[0].revision='other-activity-revision';
    assert.throws(()=>freezePublishedCueBindings(x.manifest,x.context,x.manifest.execution.cues,x.bindings));
  });
});
