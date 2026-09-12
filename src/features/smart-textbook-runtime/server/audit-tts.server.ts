import 'server-only';
import { createTtsObservationGrantService } from '../../../lib/smart-textbook-legacy-adapter/tts-observation-grant.server.ts';
import { studentTask,taskEventKey } from '../../../lib/learning-agent-script-runtime';
import type { AuditSession } from './audit-session.server';
import type { TtsPlaybackOwner } from '../core/playback';
import { teacherConfigurationSchema } from '../../../lib/smart-textbook-legacy-adapter/chapter-one-shapes.server.ts';

export function auditTtsOwner(session:AuditSession):TtsPlaybackOwner|null {
  const binding=session.data.result.tts;
  if(!binding||session.lastTurn?.phase!=='task'||session.lastTurn.cueId!==binding.cueId||session.lastTurn.task?.target!==binding.target||session.generation<=session.revokedThrough)return null;
  return {kind:'authorized-browser-tts-owner/1',target:binding.target,snapshotId:binding.snapshotId,teachingRevision:binding.teachingRevision,utteranceId:binding.utteranceId,generation:session.generation};
}
export function auditTtsService(session:AuditSession,sessionId:string){
  if(session.tts)return session.tts;
  const binding=session.data.result.tts;if(!binding)throw Error('NO_TTS_BINDING');
  // Production authority binds its actual tenant. Audit uses a separate
  // namespace, never interpreted as a database tenant ID.
  const tenantId=session.authorityTenantId??`owner-audit:${session.ownerId}`;
  session.tts=createTtsObservationGrantService({binding,authorizeSession:async(caller,id)=>{
    const owner=auditTtsOwner(session);
    return {actorId:session.ownerId,tenantId,sessionId,active:!!owner&&id===sessionId&&caller.actorId===session.ownerId&&Date.now()<session.expiresAt,
      sourceRevision:binding.sourceRevision,snapshotId:binding.snapshotId,teachingRevision:binding.teachingRevision,stepId:binding.stepId,cueId:session.lastTurn?.cueId??'',
      target:binding.target,textHash:binding.textHash,locale:binding.locale,utteranceId:binding.utteranceId,generation:session.generation,phase:owner?'waiting-playback':'other'};
  }});
  return session.tts;
}
export async function observeAuditTts(session:AuditSession,sessionId:string,grantId:string){
  const result=await auditTtsService(session,sessionId).observe({actorId:session.ownerId,tenantId:session.authorityTenantId??`owner-audit:${session.ownerId}`},{grantId});
  if(result.teachingPlaybackWaitSatisfied){
    const node=session.data.source.teachingNodes.find(n=>n.id===session.data.result.tts?.cueId);
    const task=node?studentTask(teacherConfigurationSchema.parse(node.configuration)):null;if(!node||!task)throw Error('TTS_TASK_BINDING_MISSING');
    const key=taskEventKey(node.id,task);
    if(!session.state.completedTaskEvents.includes(key))session.state.completedTaskEvents.push(key);
  }
  return result;
}
