import {recordingItemSchema,recordingPlanSchema,recordingRestoreSchema,recordingCompletionSchema,type RecordingRuntimeServices} from './recording';
/** Only same-origin byte proxy; no storage URLs or database identities. */
export function recordingTransport(sessionId:string,snapshotId:string,endpoint='/api/smart-textbook-runtime-audit/recording'):RecordingRuntimeServices{
  const call=async(op:string,fields:object,signal:AbortSignal)=>{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,snapshotId,op,...fields}),signal});if(!r.ok)throw Error('RECORDING_SERVICE_REJECTED');return r;};
  return {
    load:async(capsuleRef,signal)=>(await(await call('load',{capsuleRef},signal)).json() as unknown[]).map(p=>recordingPlanSchema.parse(p)),
    restore:async(capsuleRef,activityRef,signal)=>recordingRestoreSchema.parse(await(await call('restore',{capsuleRef,activityRef},signal)).json()),
    complete:async(input,signal)=>recordingCompletionSchema.parse(await(await call('complete',{input},signal)).json()),
    remove:async(scope,recordingId,signal)=>{await call('remove',{scope,recordingId},signal);},
    audio:async(scope,recordingId,signal)=>(await call('audio',{scope,recordingId},signal)).blob(),
    upload:async(scope,blob,durationSeconds,signal)=>{const form=new FormData();form.set('request',JSON.stringify({sessionId,snapshotId,op:'upload',scope,durationSeconds}));form.set('recording',blob,'recording');const r=await fetch(endpoint,{method:'POST',body:form,signal});if(!r.ok)throw Error('RECORDING_UPLOAD_REJECTED');return recordingItemSchema.parse(await r.json());},
  };
}
