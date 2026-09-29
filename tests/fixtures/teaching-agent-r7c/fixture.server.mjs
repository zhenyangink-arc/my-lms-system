import {projectionInput} from '../teaching-agent-r7b/fixture.server.mjs';
const {projectFrozenExecution}=await import('../../../src/features/smart-textbook-runtime/server/native-execution-projection.server.ts');
const {createDurableActivityRepository}=await import('../../../src/features/smart-textbook-runtime/server/durable-activity-repository.server.ts');
const {createDurableActivityCompletion}=await import('../../../src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts');
const {validateNativeActivity,publicNativeActivity,safeDigest}=await import('../../../src/features/smart-textbook-runtime/server/native-activity-binding.server.ts');
const {executionBinding}=await import('../../../src/features/smart-textbook-runtime/core/execution-contracts.ts');
export async function createDurableFixture(db,ids){
 const scope=Object.fromEntries(['tenantId','actorId','versionId','nodeId','activityId'].map(k=>[k,ids[k]]));
 const repository=createDurableActivityRepository(db),raw=await repository.read(scope),definition=validateNativeActivity(raw.definition,scope);
 const manifest=projectFrozenExecution({...projectionInput,activity:publicNativeActivity(definition)});
 const context={runtimeSessionId:'isolated-session-'+safeDigest(scope).slice(0,24),snapshotId:manifest.snapshot.id,sourceState:'draft',trackingDisabled:true,locale:'zh-CN',supportMode:'bilingual'};
 const binding=executionBinding(manifest,context,manifest.execution.cues[0]);
 let mode='normal';const metrics={submits:0,readbacks:0,restores:0,checkpoints:0};
 const checkedRepository={...repository,read:async s=>{if(mode==='unknown')throw Error('ISOLATED_READ_UNAVAILABLE');return repository.read(s);}};
 const completion=await createDurableActivityCompletion({repository:checkedRepository,authorize:async()=>scope,binding,definitionDigest:definition.digest});
 const api={manifest,context,binding,repository,scope,definition,metrics,
  initialState:{snapshotId:manifest.snapshot.id,revision:manifest.snapshot.contentDigest,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]},
  setMode(v){if(!['normal','lost-completed','lost-no-commit','unknown'].includes(v))throw Error('INVALID_TEST_MODE');mode=v;},
  restore(r,hint){metrics.restores++;return completion.restore(r,hint==='waiting');},
  checkpoint(r){metrics.checkpoints++;return completion.checkpoint(r);},
  async submit(r,option){metrics.submits++;if(mode==='lost-no-commit')throw Error('SIMULATED_NO_COMMIT');const value=await completion.submit(r,option);if(mode==='lost-completed')throw Error('SIMULATED_LOST_RESPONSE');return value;},
  readback(r){metrics.readbacks++;return completion.readback(r);},
  ports(pendingHint=false){return {mediaSource:()=>'/media',restore:r=>api.restore(r,pendingHint?'waiting':undefined),checkpoint:r=>api.checkpoint(r),submit:(r,o)=>api.submit(r,o),readback:r=>api.readback(r)};},
 };
 return api;
}
