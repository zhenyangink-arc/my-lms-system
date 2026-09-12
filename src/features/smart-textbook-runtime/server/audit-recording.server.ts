import 'server-only';
import {z} from 'zod';
import {requirePlatformOwner} from '../../../lib/admin';
import {auditSession} from './audit-session.server';
import {recordingPlans} from './recording-binding.server';
import {createPreviewRecordingStore} from './preview-recording.server';
import {recordingCompletionInput,recordingScopeSchema} from '../core/recording';
const store=createPreviewRecordingStore();
const id=z.string().min(1).max(240),base={sessionId:z.uuid(),snapshotId:id};
export const auditRecordingRequest=z.discriminatedUnion('op',[
  z.strictObject({...base,op:z.literal('load'),capsuleRef:id}),
  z.strictObject({...base,op:z.literal('restore'),capsuleRef:id,activityRef:id}),
  z.strictObject({...base,op:z.literal('upload'),scope:recordingScopeSchema,durationSeconds:z.number().positive().max(300)}),
  z.strictObject({...base,op:z.literal('audio'),scope:recordingScopeSchema,recordingId:id}),
  z.strictObject({...base,op:z.literal('remove'),scope:recordingScopeSchema,recordingId:id}),
  z.strictObject({...base,op:z.literal('complete'),input:recordingCompletionInput}),
]);
export async function auditRecording(input:unknown,signal:AbortSignal,blob?:Blob){
  const r=auditRecordingRequest.parse(input);
  const services=store.services(async()=>{
    const {user}=await requirePlatformOwner(),s=auditSession(user.id,r.sessionId),{manifest,bindings,report}=s.data.result;
    if(manifest.snapshot.id!==r.snapshotId)throw Error('RECORDING_SNAPSHOT');
    return {ownerId:user.id,sessionId:s.recordingScope?.id??r.sessionId,snapshotId:r.snapshotId,revision:report.sourceRevision,expiresAt:Math.min(s.expiresAt,s.recordingScope?.expiresAt??s.expiresAt),
      plans:bindings.capsules.filter(c=>c.kind==='learning').flatMap(c=>recordingPlans(manifest,bindings,c.id,'zh-CN'))};
  });
  switch(r.op){
    case 'load':return services.load(r.capsuleRef,signal);
    case 'restore':return services.restore(r.capsuleRef,r.activityRef,signal);
    case 'audio':return services.audio(r.scope,r.recordingId,signal);
    case 'remove':await services.remove(r.scope,r.recordingId,signal);return {ok:true};
    case 'complete':return services.complete(r.input,signal);
    case 'upload':if(!blob)throw Error('RECORDING_BYTES');return services.upload(r.scope,blob,r.durationSeconds,signal);
  }
}
