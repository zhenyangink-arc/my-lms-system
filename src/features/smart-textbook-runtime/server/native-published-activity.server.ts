import 'server-only';
import { z } from 'zod';
import { withNativeLearningSession, type NativeSessionAuthority } from './native-learning-session.server.ts';
import { readNativePublishedFacts, recordNativePublishedAttempt } from './native-published-transport.server.ts';
import { completionRequestSchema, sameBinding } from '../core/execution-contracts.ts';
import { nativePublishedReadRequestSchema, acceptNativeMediaRead } from '../core/native-published-media-contracts.ts';
import { nativeSessionBootstrapSchema } from '../core/native-learning-session-transport.ts';
const serverStateSchema=nativeSessionBootstrapSchema.shape.initialState;
import { submitSmartTextbookActivityForContext } from '../../../app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts';

function expected(a:NativeSessionAuthority){const b=a.bundle.privatePayload.bindings[0];return {snapshotId:a.bundle.snapshotId,manifestDigest:a.bundle.manifestDigest,privateDigest:a.bundle.privateDigest,cueId:b.cueId,activityRevision:b.activityRevision,mediaRevision:b.mediaRevision};}
async function visible(a:NativeSessionAuthority){
 const b=a.bundle.privatePayload.bindings[0];
 const activity=await a.auth.supabase.from('digital_textbook_activities').select('id,node_id').eq('id',b.activityId).eq('node_id',b.executionNodeId).maybeSingle();
 const node=await a.auth.supabase.from('digital_textbook_nodes').select('id,module_id').eq('id',b.executionNodeId).eq('module_id',b.moduleId).maybeSingle();
 if(activity.error||node.error||activity.data?.id!==b.activityId||activity.data.node_id!==b.executionNodeId||node.data?.id!==b.executionNodeId||node.data.module_id!==b.moduleId)throw Error('NATIVE_ACTIVITY_FORBIDDEN');
}
async function state(a:NativeSessionAuthority,signal:AbortSignal){
 await visible(a);const read=await readNativePublishedFacts(a,expected(a),signal),b=a.bundle.privatePayload.bindings[0],p=read.facts.nodeProgress;
 return serverStateSchema.parse({snapshotId:a.bundle.snapshotId,revision:read.receipt.provenance.revision,
  completedStepIds:p?.status==='completed'?[a.bundle.manifest.steps[0].id]:[],
  attempts:read.lastResponse?[{activityRef:b.activityId,selectedOptionId:a.bundle.manifest.activityRefs[0].publicPresentation.options[read.lastResponse.optionIndex].id,
   result:{ok:true,correct:read.facts.latestResult==='CORRECT',score:read.facts.latestResult==='CORRECT'?100:0,explanation:'',attemptNumber:read.facts.attemptCount,preview:false,nodeId:b.executionNodeId,nodeCompleted:p?.status==='completed',completionPercent:p?.completionPercent??0}}]:[],
  activityProgress:[{activityRef:b.activityId,completed:read.receipt.status==='COMPLETED'}],pageProgress:[],guidedRepeat:[],speakingEvidence:[]});
}
export async function bootstrapNativeLearningSession(sessionRef:unknown,signal:AbortSignal){
 return withNativeLearningSession(sessionRef,signal,async a=>nativeSessionBootstrapSchema.parse({contract:'native-learning-session/1',sessionRef:a.sessionRef,expiresAt:a.expiresAt,manifest:a.bundle.manifest,context:a.context,nativeBindings:a.nativeBindings,initialState:await state(a,signal)}));
}
export async function refreshNativeLearningState(sessionRef:unknown,signal:AbortSignal){return withNativeLearningSession(sessionRef,signal,a=>state(a,signal));}
export async function readNativeActivity(sessionRef:unknown,input:unknown,signal:AbortSignal){
 const request=nativePublishedReadRequestSchema.parse(input);
 return withNativeLearningSession(sessionRef,signal,async a=>{
  const binding=a.nativeBindings[0];if(!sameBinding(request.binding,binding.execution))throw Error('NATIVE_REQUEST_MISMATCH');
  await visible(a);const read=await readNativePublishedFacts(a,expected(a),signal);
  return acceptNativeMediaRead({contract:'native-media-read/1',request,authority:binding,acceptedAt:read.acceptedAt,receipt:read.receipt,pending:request.operation==='restore'&&read.receipt.status==='INCOMPLETE'&&read.facts.attemptCount>0},request,binding);
 });
}
export async function submitNativeActivity(sessionRef:unknown,input:unknown,signal:AbortSignal){
 const {request,optionId}=z.strictObject({request:completionRequestSchema.extend({requestId:z.uuid()}),optionId:z.string().min(1).max(200)}).parse(input);
 return withNativeLearningSession(sessionRef,signal,async a=>{
  const b=a.bundle.privatePayload.bindings[0],binding=a.nativeBindings[0];if(!sameBinding(request.binding,binding.execution))throw Error('NATIVE_REQUEST_MISMATCH');
  const optionIndex=a.bundle.manifest.activityRefs[0].publicPresentation.options.findIndex(o=>o.id===optionId);if(optionIndex<0)throw Error('NATIVE_OPTION_MISMATCH');
  await visible(a);
  const result=await submitSmartTextbookActivityForContext({activityId:b.activityId,response:optionIndex,locale:a.context.locale},{supabase:a.auth.supabase,admin:a.admin,userId:a.actorId,tenantId:a.tenantId,canSubmit:true,preview:false,
   nativeAtomic:{requireAtomic:true,expected:{activityId:b.activityId,nodeId:b.executionNodeId,versionId:a.bundle.scope.versionId},async persist(input){
    if(input.activityId!==b.activityId||input.nodeId!==b.executionNodeId||input.versionId!==a.bundle.scope.versionId||input.response!==optionIndex)throw Error('NATIVE_GRADE_BINDING');
    return {data:await recordNativePublishedAttempt(a,expected(a),{requestId:request.requestId,generation:request.generation,optionIndex},{correct:input.isCorrect,score:input.score},signal),error:null};
   }}});
  return {result};
 });
}
