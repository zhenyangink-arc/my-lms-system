import { z } from 'zod';
import { teacherRuntimeCueSchema, type TeacherRuntimeServices } from './teacher-runtime';
import type { TtsObservationResult } from './playback';

export function teacherRuntimeHttp(scope:string,send: (body:unknown,signal:AbortSignal)=>Promise<unknown> = async(body,signal)=>{
  const response=await fetch('/api/smart-textbook-runtime-audit/teacher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,cache:'no-store'});
  if(!response.ok)throw Error('TEACHER_REQUEST_REJECTED');
  return response.headers.get('content-type')?.startsWith('application/json')?response.json():response.blob();
}):TeacherRuntimeServices {
  let session:string|null=null,epoch=0;
  const call=async(operation:string,signal:AbortSignal,extra:object={})=>{signal.throwIfAborted();const current=session,e=epoch;if(!current)throw Error('TEACHER_SESSION_NOT_OPEN');
    const value=await send({operation,session:current,...extra},signal);signal.throwIfAborted();if(e!==epoch||session!==current)throw Error('TEACHER_STALE_HTTP');return value;};
  const close=async()=>{const old=session;session=null;epoch++;if(old)await send({operation:'close',session:old},AbortSignal.timeout(15000));};
  const blob=async(operation:string,cue:string,signal:AbortSignal)=>{const value=await call(operation,signal,{cue});if(!(value instanceof Blob))throw Error('TEACHER_BYTES');return value;};
  return {
    open:async signal=>{await close();const e=epoch;signal.throwIfAborted();
      // Let the server acknowledge open, even if the component unmounts meanwhile;
      // otherwise its opaque reference could be lost and the grant scope orphaned.
      const value=z.strictObject({session:z.string().regex(/^teacher-session-[0-9a-f-]{36}$/)}).parse(await send({operation:'open',scope},AbortSignal.timeout(15000)));
      if(signal.aborted||epoch!==e){await send({operation:'close',session:value.session},AbortSignal.timeout(15000));throw Error('TEACHER_STALE_OPEN');}session=value.session;
    },
    current:async s=>teacherRuntimeCueSchema.parse(await call('current',s)),advance:async s=>teacherRuntimeCueSchema.parse(await call('advance',s)),
    answer:async(answer,s)=>teacherRuntimeCueSchema.parse(await call('answer',s,{answer})),
    pause:async s=>{await call('pause',s);},resume:async s=>{await call('resume',s);},cancel:close,close,
    speech:(cue,kind,s)=>blob(kind,cue,s),character:(cue,s)=>blob('character',cue,s),
    tts:{issue:async s=>z.strictObject({grantId:z.string().uuid(),text:z.string(),locale:z.literal('ko-KR'),expiresAt:z.number()}).parse(await call('issueTts',s)),
      observe:async(grantId,s)=>{const value=z.object({playbackObserved:z.literal(true),duplicate:z.boolean(),formalCompletion:z.literal(false),progressDelta:z.null(),score:z.null(),agentAdvance:z.literal(false),teachingPlaybackWaitSatisfied:z.boolean()}).parse(await call('observeTts',s,{grantId}));return value as TtsObservationResult;}},
  };
}
