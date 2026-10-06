import { z } from 'zod';
import { manifestStructureSchema, runtimeContextSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { completionRequestSchema, sameBinding, type CompletionRequest } from './execution-contracts.ts';
import { nativePublishedCueBindingSchema, nativePublishedReadRequestSchema, freezeNativePublishedCueBindings, acceptNativeMediaRead, type NativePublishedExecutionServices, type NativePublishedReadRequest } from './native-published-media-contracts.ts';
import { activityResultSchema } from './services.ts';

const serverStateSchema=z.strictObject({snapshotId:z.string(),revision:z.string(),completedStepIds:z.array(z.string()),
 attempts:z.array(z.strictObject({activityRef:z.string(),result:activityResultSchema,selectedOptionId:z.string().optional()})),
 activityProgress:z.array(z.strictObject({activityRef:z.string(),completed:z.boolean()})),pageProgress:z.array(z.strictObject({progressRef:z.string(),partIds:z.array(z.string())})),
 guidedRepeat:z.array(z.strictObject({progressRef:z.string(),segmentIds:z.array(z.string())})),speakingEvidence:z.array(z.strictObject({activityRef:z.string(),evidenceId:z.string()}))});
export const nativeSessionBootstrapSchema=z.strictObject({contract:z.literal('native-learning-session/1'),
 sessionRef:z.string().refine(v=>v.startsWith('learning-session-')&&z.uuid().safeParse(v.slice(17)).success),expiresAt:z.number().finite(),
 manifest:manifestStructureSchema,context:runtimeContextSchema,nativeBindings:z.array(nativePublishedCueBindingSchema),initialState:serverStateSchema,
}).superRefine((b,ctx)=>{if(b.context.runtimeSessionId!==b.sessionRef||b.context.snapshotId!==b.manifest.snapshot.id||b.initialState.snapshotId!==b.manifest.snapshot.id||b.context.sourceState!=='published'||b.context.trackingDisabled||b.manifest.execution?.contract!=='native-execution/2')ctx.addIssue({code:'custom',message:'NATIVE_BOOTSTRAP_BINDING'});});
export type NativeSessionBootstrap=z.infer<typeof nativeSessionBootstrapSchema>;
/** Fixed same-origin endpoint. No supplied URL, scope, actor or private state. */
export function createNativeLearningSessionTransport(value:unknown){
 const bootstrap=nativeSessionBootstrapSchema.parse(value),bindings=freezeNativePublishedCueBindings(bootstrap.manifest,bootstrap.context,bootstrap.manifest.execution!.cues,bootstrap.nativeBindings);
 async function call(body:object,signal:AbortSignal){
  signal.throwIfAborted();if(Date.now()>=bootstrap.expiresAt)throw Error('NATIVE_SESSION_EXPIRED');
  const response=await fetch('/api/smart-textbook-runtime/native',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,sessionRef:bootstrap.sessionRef}),signal});
  if(!response.ok)throw Error('NATIVE_SERVICE_UNAVAILABLE');return response.json();
 }
 function bound(raw:CompletionRequest){const request=completionRequestSchema.extend({requestId:z.uuid()}).parse(raw);
  const binding=bindings.find(b=>sameBinding(b.execution,request.binding));if(!binding)throw Error('NATIVE_REQUEST_BINDING');return {request,binding};}
 async function read(op:NativePublishedReadRequest['operation'],raw:NativePublishedReadRequest,signal:AbortSignal){
  const r=nativePublishedReadRequestSchema.parse(raw),{binding}=bound({binding:r.binding,requestId:r.requestId,generation:r.generation});if(r.operation!==op)throw Error('NATIVE_OPERATION');
  const result=acceptNativeMediaRead(await call({op,request:r},signal),r,binding);
  if(Date.parse(result.receipt.provenance.deadlineAt)>bootstrap.expiresAt)throw Error('NATIVE_SESSION_DEADLINE');return result;
 }
 const nativeExecution:NativePublishedExecutionServices={completionMode:'native-published/4',nativeBindings:bindings,
  mediaSource(mediaRef,revision){const media=bootstrap.manifest.mediaRefs.find(m=>m.id===mediaRef);if(!media||media.revision!==revision||!bindings.some(b=>b.mediaRef===mediaRef))throw Error('NATIVE_MEDIA_BINDING');return `/api/smart-textbook-runtime/native-media?${new URLSearchParams({sessionRef:bootstrap.sessionRef,mediaRef,revision:media.revision})}`;},
  restore:(r,s)=>read('restore',r,s),checkpoint:(r,s)=>read('checkpoint',r,s),readback:(r,s)=>read('readback',r,s),
  async submit(raw,optionId,signal){const {request,binding}=bound(raw),activity=bootstrap.manifest.activityRefs.find(a=>a.id===binding.execution.activityRef);
   if(!activity?.publicPresentation.options.some(o=>o.id===optionId))throw Error('NATIVE_OPTION_BINDING');
   return z.strictObject({result:activityResultSchema}).parse(await call({op:'submit',request,optionId},signal));},
 };
 return {bootstrap,nativeExecution,async refresh(signal:AbortSignal){const state=serverStateSchema.parse(await call({op:'refresh'},signal));if(state.snapshotId!==bootstrap.manifest.snapshot.id)throw Error('NATIVE_STATE_BINDING');return state;},
  async revoke(signal:AbortSignal){return z.strictObject({revoked:z.literal(true)}).parse(await call({op:'revoke'},signal));}};
}
