// TEST APPARATUS ONLY. These synthetic /3 envelopes are neither real Tool
// receipts nor production issuers. No production file may import this fixture.
import {manifest as legacyManifest} from './teaching-agent-r7b/fixture.server.mjs';
import {executionBinding,sameBinding,completionRequestSchema} from '../../src/features/smart-textbook-runtime/core/execution-contracts.ts';
import {publishedReadRequestSchema} from '../../src/features/smart-textbook-runtime/core/published-media-contracts.ts';

export const clone=value=>structuredClone(value);
export function makeTestManifest(twoCues=false){
  const manifest=clone(legacyManifest);
  if(twoCues){
    // Two cues exercise the owner; they make no claim about orientation content.
    const cue=manifest.execution.cues[0],block=manifest.blocks.find(b=>b.id===cue.targetBlockId);
    const activity=manifest.activityRefs.find(a=>a.id===block.props.activityRef);
    const nextBlock={...clone(block),id:'second-test-activity',runtimeTarget:block.runtimeTarget.replace(block.id,'second-test-activity'),props:{...clone(block.props),activityRef:'second-test-activity-ref'}};
    manifest.blocks.push(nextBlock);
    manifest.activityRefs.push({...clone(activity),id:'second-test-activity-ref',activityId:'second-test-activity-ref',revision:'second-test-revision'});
    const target=manifest.runtimeTargets.find(t=>t.blockId===block.id);
    manifest.runtimeTargets.push({...clone(target),id:target.id.replace(block.id,nextBlock.id),blockId:nextBlock.id});
    manifest.execution.cues.push({...clone(cue),id:'second-test-cue',targetBlockId:nextBlock.id,triggerTime:12,sortOrder:20});
    manifest.execution.sourceNodes.find(n=>n.nodeNumber===7).blockIds.push(nextBlock.id);
  }
  return manifest;
}
export function makeTestBinding(manifest,context,cue){
  const execution=executionBinding(manifest,context,cue);
  return {execution,activityRevision:manifest.activityRefs.find(a=>a.id===execution.activityRef).revision,
    mediaRef:manifest.blocks.find(b=>b.id===cue.sourceBlockId).props.mediaRef,
    completionPolicy:'correct-durable-readback/1',
    published:{subjectRef:'test-only-subject',tenantRef:'test-only-tenant',lessonRef:'test-only-lesson',
      snapshotRef:'test-only-opaque-snapshot',scopeRef:'test-only-opaque-scope',contentRef:'test-only-opaque-content',
      activityRef:`test-only-opaque-activity-${cue.id}`,executionNodeRef:`test-only-opaque-node-${cue.id}`,
      sourceTeachingNodeRef:`test-only-opaque-source-${cue.id}`,versionRef:'test-only-opaque-version'}};
}
export function makeTestEnvelope(binding,request,{status='INCOMPLETE',sequence=status==='COMPLETED'?1:0,pending=false,wall=Date.now()}={}){
  const iso=time=>new Date(time).toISOString(),completed=status==='COMPLETED';
  const {snapshotRef,scopeRef,contentRef,activityRef,executionNodeRef,sourceTeachingNodeRef,versionRef}=binding.published;
  return {contract:'published-media-read/1',request:clone(request),authority:clone(binding),acceptedAt:iso(wall-3),pending,
    receipt:{contract:'activity-completion/3',status,attemptNumber:sequence,completedAt:completed?iso(wall-1):null,
      provenance:{storage:'CURRENT_PUBLISHED_DB',source:'activity-domain',publicationRevision:'publish-foundation/2',
        snapshotRef,scopeRef,contentRef,activityRef,executionNodeRef,sourceTeachingNodeRef,versionRef,
        runId:crypto.randomUUID(),skillRunId:crypto.randomUUID(),modelCallId:'test-only-model-call',toolCallId:'test-only-tool-call',
        toolVersion:'1.1.0',skillVersion:'1.1.0',readStartedAt:iso(wall-2),asOf:iso(wall),observedAt:iso(wall),deadlineAt:iso(wall+10_000),revision:'test-only-state-revision'},
      evidence:{kind:'durable-attempt-sequence',attemptSequence:sequence,stateDigest:'a'.repeat(64),
        latestAttemptAt:sequence?iso(wall-1):null,progressUpdatedAt:completed?iso(wall-1):null}}};
}
export function createPublishedFixture({twoCues=false}={}){
  const manifest=makeTestManifest(twoCues);
  const context={runtimeSessionId:'published-test-session',snapshotId:manifest.snapshot.id,sourceState:'published',trackingDisabled:false,locale:'zh-CN',supportMode:'bilingual'};
  const bindings=manifest.execution.cues.map(c=>makeTestBinding(manifest,context,c));
  const states=new Map(bindings.map(b=>[b.execution.cueId,{attempts:0,completed:false,pending:false}]));
  const metrics={restores:0,checkpoints:0,submits:0,readbacks:0};
  const calls={restore:[],checkpoint:[],submit:[],readback:[]};
  function validate(request,read=false){
    const parsed=(read?publishedReadRequestSchema:completionRequestSchema).parse(request);
    const binding=bindings.find(b=>b.execution.cueId===parsed.binding.cueId);
    if(!binding||!sameBinding(binding.execution,parsed.binding))throw Error('TEST_BINDING');
    return {binding,state:states.get(binding.execution.cueId)};
  }
  const fixture={manifest,context,bindings,states,metrics,calls,
    envelope(request,options={}){const {binding,state}=validate(request,true);return makeTestEnvelope(binding,request,{status:state.completed?'COMPLETED':'INCOMPLETE',sequence:state.attempts,...options});},
    setState(cueId,patch){Object.assign(states.get(cueId),patch);},
    restore(request){const {state}=validate(request,true);metrics.restores++;calls.restore.push(request);return fixture.envelope(request,{pending:state.pending&&!state.completed});},
    checkpoint(request){const {state}=validate(request,true);metrics.checkpoints++;calls.checkpoint.push(request);if(!state.completed)state.pending=true;return fixture.envelope(request);},
    submit(request,optionId){const {state}=validate(request);metrics.submits++;calls.submit.push(request);state.attempts++;state.completed=optionId==='option-1';state.pending=!state.completed;
      return {result:{ok:true,correct:state.completed,score:state.completed?100:0,explanation:'仅测试反馈',attemptNumber:state.attempts,
        preview:false,nodeId:null,nodeCompleted:state.completed,completionPercent:state.completed?100:0}};},
    readback(request){validate(request,true);metrics.readbacks++;calls.readback.push(request);return fixture.envelope(request);},
    ports(overrides={}){return {completionMode:'published/3',publishedBindings:bindings,mediaSource:()=>'/test-only-media',
      restore:async r=>fixture.restore(r),checkpoint:async r=>fixture.checkpoint(r),submit:async(r,o)=>fixture.submit(r,o),readback:async r=>fixture.readback(r),...overrides};},
  };
  return fixture;
}
export function fakeMedia({currentTime=0,duration=30}={}){
  return {paused:true,currentTime,duration,plays:0,pauses:0,async play(){this.plays++;this.paused=false;},pause(){this.pauses++;this.paused=true;}};
}
export function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
export async function flush(){for(let i=0;i<30;i++)await Promise.resolve();}
export function controlledClock(t,wall=Date.now()){
  const clock={wall,monotonic:0};
  t.mock.method(Date,'now',()=>clock.wall);
  t.mock.method(performance,'now',()=>clock.monotonic);
  t.mock.timers.enable({apis:['setTimeout']});
  clock.advance=(ms,fireTimers=true)=>{clock.monotonic+=ms;clock.wall+=ms;if(fireTimers)t.mock.timers.tick(ms);};
  return clock;
}
