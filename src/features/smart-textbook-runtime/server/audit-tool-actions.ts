'use server';
import {z} from 'zod';
import {requirePlatformOwner} from '../../../lib/admin';
import {auditSession} from './audit-session.server';
import {idSchema} from '../../../lib/smart-textbook-runtime-v1/contracts';
import {learningTools,openLearningDestination} from './learning-tools.server';
const request=z.strictObject({sessionId:z.uuid(),snapshotId:idSchema,capsuleRef:idSchema,target:z.string().optional()});
export async function auditLearningTools(input:unknown){
  const {user}=await requirePlatformOwner(),r=request.parse(input),session=auditSession(user.id,r.sessionId),{manifest,bindings,services}=session.data.result;
  if(manifest.snapshot.id!==r.snapshotId)throw Error('TOOLS_SNAPSHOT');
  if(!r.target)return learningTools(manifest,bindings,services,r.capsuleRef,session.data.source.nodes);
  // Owner audit has no student's completion authority. No fake success/open.
  const state={snapshotId:manifest.snapshot.id,revision:services.sourceRevision,completedStepIds:[],attempts:[],activityProgress:[],pageProgress:[],guidedRepeat:[],speakingEvidence:[]};
  return openLearningDestination(manifest,bindings,services,{authorized:true,actorId:user.id,tenantId:`owner-audit:${user.id}`,versionId:manifest.version.id,sourceRevision:services.sourceRevision},r.capsuleRef,r.target,state,false,session.data.source.nodes);
}
