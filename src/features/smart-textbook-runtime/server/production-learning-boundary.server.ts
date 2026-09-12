import 'server-only';
import {createRuntimeLearningSessionResolver} from './learning-session.server';
import {createLearningBoundary} from './learning-boundary.server';
import {productionLearningPorts} from './production-learning.server';
import {productionRecordingServices} from './recording-production.server';
import {recordingPlans} from './recording-binding.server';
import {recordingActivityBinding} from '../../../lib/recording-domain-gateway.server';
import {projectLearningContent} from '../../../lib/smart-textbook-legacy-adapter/runtime-content.server';
import {publishedTeacherScope} from './published-teacher-scope.server';
import {sceneImageBytes} from './scene-image.server';
import {readSceneImage} from './scene-image-storage.server';

/** Concrete composition, NOT a deployed route. Request headers come from the
 * trusted server transport, never a client-supplied Request/identity envelope.
 * Recording writes retain the existing gateway's disabled-v2 fail-closed gate. */
export function createProductionLearningBoundary(request:()=>Promise<Request>){
  const resolver=createRuntimeLearningSessionResolver();
  const boundary=createLearningBoundary(resolver,async initial=>{
    const expected={sessionId:initial.sessionId,snapshotId:initial.snapshotId};
    const current=()=>resolver.resolve({sessionRef:initial.sessionId});
    const recording=productionRecordingServices(async()=>{
      const a=await current(),plans=a.bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>recordingPlans(a.manifest,a.bindings,c.id,a.locale));
      const domainRevisions=new Map<string,string>();
      for(const ref of new Set(plans.map(p=>p.activityRef))){
        const bound=a.bindings.activities.find(b=>b.ref===ref&&b.versionId===a.manifest.version.id);if(!bound)throw Error('RECORDING_ACTIVITY_BINDING');
        const domain=await recordingActivityBinding(a.admin,bound.activityId);
        if(domain.versionId!==a.manifest.version.id)throw Error('RECORDING_VERSION');domainRevisions.set(ref,domain.sourceRevision);
      }
      return {admin:a.admin,owner:{tenantId:a.scope.tenantId,studentId:a.scope.actorId},sessionId:a.sessionId,snapshotId:a.snapshotId,
        sourceRevision:a.scope.sourceRevision,versionId:a.manifest.version.id,trackingDisabled:false,plans,bindings:a.bindings,domainRevisions};
    },expected);
    const ports=productionLearningPorts(async(userId,tenantId)=>{
      const a=await current();if(a.scope.actorId!==userId||a.scope.tenantId!==tenantId)throw Error('LEARNING_SESSION_OWNER');
      return {...a,recording,request:await request()};
    },expected);
    return {...ports,recording,sceneImage:async(c,signal)=>{const a=await current();return sceneImageBytes(a.manifest,a.bindings,a.publishedData.source,c,signal,readSceneImage);},learning:async(capsuleRef,signal)=>{signal.throwIfAborted();const a=await current();signal.throwIfAborted();return projectLearningContent(a.bindings,capsuleRef,a.locale);}};
  });
  // Private installation ports; do not serialize these functions or their scope.
  return {issue:()=>resolver.issue(),revoke:(input:unknown)=>resolver.revoke(input),teacher:publishedTeacherScope(resolver,boundary),...boundary};
}
