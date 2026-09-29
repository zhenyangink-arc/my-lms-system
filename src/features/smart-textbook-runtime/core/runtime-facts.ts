import type { NativeMediaController } from './native-media-controller.ts';
/** Read-only projection: client observation and authoritative service evidence
 * are explicitly different. This port is not an Agent Tool or a control port. */
export function createRuntimeFactsReadPort(owner:NativeMediaController){
  return Object.freeze({read(){
    const s=owner.snapshot(),m=owner.manifest,e=m.execution!;
    const activityBlock=m.blocks.find(b=>b.id===(s.visibleActivity??owner.cues[0]?.targetBlockId));
    return {contract:'lesson-runtime-facts/1' as const,source:'lesson-runtime' as const,
      snapshot:{id:m.snapshot.id,digest:m.snapshot.contentDigest},content:{lessonBinding:e.lessonBinding,scriptVersionBinding:e.scriptVersionBinding,scriptVersion:e.scriptVersion,targetAlias:e.targetAlias},
      generation:owner.lease.generation,stepId:owner.lease.stepId,
      availability:owner.lease.signal.aborted?'unavailable':s.restored?'available':'pending',
      currentTeachingNode:e.sourceNodes.find(n=>n.nodeNumber===5)?.binding??null,
      currentExecutionBlock:s.visibleActivity??owner.cues[0]?.sourceBlockId??null,
      currentActivity:activityBlock?.type==='multiple_choice'?activityBlock.props.activityRef:null,
      completion:{status:s.completedCueIds.length===owner.cues.length?'COMPLETED':s.unknown?'UNKNOWN':'INCOMPLETE',completedCueIds:[...s.completedCueIds]},
      runtimePhase:s.phase,allowedPresentationActions:s.phase==='ERROR'?[]:s.activeCueId?['pause']:['play','pause'],
      attemptSummary:s.evidence&&'attemptSequence'in s.evidence?{attemptSequence:s.evidence.attemptSequence,latestAttemptAt:s.evidence.latestAttemptAt}:null,
      stateEvidence:s.evidence,clientObservation:{source:'html-media-element' as const,positionSeconds:s.position,authoritativeProgress:false},
    };
  }});
}
