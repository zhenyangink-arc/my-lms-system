import { z } from 'zod';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { parseRuntimeTarget } from '../../../lib/smart-textbook-runtime-v1/targets.ts';

/** Ephemeral authorized service capability, not a fake mediaRef or Manifest field. */
export const ttsOwnerSchema=z.strictObject({
  kind:z.literal('authorized-browser-tts-owner/1'),target:z.string().refine(v=>parseRuntimeTarget(v)?.partId!=null),
  snapshotId:idSchema,teachingRevision:idSchema,utteranceId:idSchema,generation:z.number().int().nonnegative(),
});
export type TtsPlaybackOwner=z.infer<typeof ttsOwnerSchema>;
export type TtsObservationResult={playbackObserved:true;duplicate:boolean;formalCompletion:false;progressDelta:null;score:null;agentAdvance:false;teachingPlaybackWaitSatisfied:boolean};
export interface TtsPlaybackServices {
  issue(signal:AbortSignal):Promise<{grantId:string;text:string;locale:'ko-KR';expiresAt:number}>;
  observe(grantId:string,signal:AbortSignal):Promise<TtsObservationResult>;
}

/** Reports browser onend honestly; cancellation/error never submits an observation. */
export async function speakAuthorizedUtterance(services:TtsPlaybackServices,signal:AbortSignal,host:{
  create(text:string):SpeechSynthesisUtterance;speak(utterance:SpeechSynthesisUtterance):void;cancel():void;
}) {
  signal.throwIfAborted();const grant=await services.issue(signal);signal.throwIfAborted();
  if(grant.expiresAt<=Date.now())throw Error('TTS_GRANT_EXPIRED');
  await new Promise<void>((resolve,reject)=>{
    const utterance=host.create(grant.text);utterance.lang=grant.locale;
    let settled=false;
    const finish=(error?:Error)=>{if(settled)return;settled=true;signal.removeEventListener('abort',cancel);utterance.onend=null;utterance.onerror=null;error?reject(error):resolve();};
    const cancel=()=>{finish(new Error('TTS_CANCELLED'));host.cancel();};
    utterance.onend=()=>finish();utterance.onerror=()=>finish(new Error('TTS_PLAYBACK_FAILED'));
    signal.addEventListener('abort',cancel,{once:true});
    if(signal.aborted)return cancel();
    try{host.speak(utterance);}catch{finish(new Error('TTS_PLAYBACK_FAILED'));}
  });
  signal.throwIfAborted();const result=await services.observe(grant.grantId,signal);signal.throwIfAborted();
  if(result.formalCompletion!==false||result.progressDelta!==null||result.score!==null||result.agentAdvance!==false)throw Error('INVALID_OBSERVATION_SEMANTICS');
  return result;
}
