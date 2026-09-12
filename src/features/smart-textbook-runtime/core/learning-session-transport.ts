import type {LessonManifestV1} from '../../../lib/smart-textbook-runtime-v1/contracts';
import type {RuntimeServices} from './services';

export type LearningSessionTransport=(envelope:unknown,signal:AbortSignal,upload?:Blob)=>Promise<unknown>;
/** One browser protocol. Capsule/DB identities are local lookup keys only; they
 * are never serialized. Every server operation reauthorizes the opaque session. */
export function withLearningSession(base:RuntimeServices,m:LessonManifestV1,sessionRef:string,
  catalog:ReadonlyArray<{runtimeRef:string;serviceRef:string}>,send:LearningSessionTransport,
  enter:(input:{sessionRef:string;generation:number;target:string},signal:AbortSignal)=>Promise<{generation:number}>,continuation?:{generation:number;activeStepId:string}):RuntimeServices{
  if(continuation&&(!Number.isSafeInteger(continuation.generation)||continuation.generation<0||!m.steps.some(s=>s.id===continuation.activeStepId)))throw Error('SESSION_CONTINUATION');
  let generation=continuation?.generation??0,activeStep=continuation?.activeStepId??m.navigation.entryStep,serial=Promise.resolve();
  const root=(c:string)=>{const b=m.blocks.find(b=>b.type==='compat.learning.v1'&&b.props.capsuleRef===c);const t=m.runtimeTargets.find(t=>t.blockId===b?.id&&!t.partId);if(!b||!t)throw Error('SESSION_CAPSULE');return t;};
  const capsule=(ref:string)=>{const native=m.blocks.find(b=>b.type==='multiple_choice'&&b.props.activityRef===ref);const b=m.blocks.find(b=>b.type==='compat.learning.v1'&&(b.props.activityRefs.includes(ref)||b.stepId===native?.stepId));if(!b||b.type!=='compat.learning.v1')throw Error('SESSION_ACTIVITY');return b.props.capsuleRef;};
  const token=(ref:string)=>{const row=catalog.find(x=>x.runtimeRef===ref);if(!row||!/^activity-ref-[0-9a-f]{32}$/.test(row.serviceRef))throw Error('SESSION_ACTIVITY_TOKEN');return row.serviceRef;};
  async function run<T>(c:string,request:object,s:AbortSignal,target?:string,blob?:Blob):Promise<T>{
    const r=root(c),address=target??r.id;
    if(!m.runtimeTargets.some(t=>t.id===address&&t.blockId===r.blockId))throw Error('SESSION_TARGET');
    const prepare=serial.then(async()=>{s.throwIfAborted();if(activeStep!==r.stepId){
      // Enter is a serialized server generation transition, not a cancellable
      // content read. Retain its acknowledgement even if this Step unmounts;
      // otherwise the next Step would reuse a generation already superseded.
      const next=await enter({sessionRef,generation,target:r.id},AbortSignal.timeout(15000));generation=next.generation;activeStep=r.stepId;
    }s.throwIfAborted();});
    serial=prepare.catch(()=>{});await prepare;const g=generation;
    const value=await send({sessionRef,generation:g,target:address,request},s,blob);s.throwIfAborted();if(g!==generation)throw Error('STALE_GENERATION');return value as T;
  }
  const first=()=>{const b=m.blocks.find(b=>b.stepId===activeStep&&b.type==='compat.learning.v1');if(!b||b.type!=='compat.learning.v1')throw Error('SESSION_STEP');return b.props.capsuleRef;};
  return {...base,
    sceneImage:(c,s)=>run(c,{op:'scene-image'},s),
    learning:(c,s)=>run(c,{op:'content'},s),submit:(a,response,s)=>run(capsule(a),{op:'native-submit',activity:token(a),response},s),
    refresh:s=>run(first(),{op:'refresh'},s),
    activities:{load:(c,s)=>run(c,{op:'activities'},s),submit:(a,response,s)=>run(capsule(a),{op:'submit',activity:token(a),response},s)},
    pages:{load:(c,s)=>run(c,{op:'pages'},s),check:(c,pageId,response,s)=>run(c,{op:'page-check',pageId,response},s),audio:(c,pageId,s)=>run(c,{op:'audio',pageId},s),transcript:(c,pageId,s)=>run(c,{op:'transcript',pageId},s)},
    patterns:{load:(c,s)=>run(c,{op:'patterns'},s),check:(c,a,response,s)=>run(c,{op:'pattern-check',activity:token(a),response},s),audio:(c,turnId,s)=>run(c,{op:'pattern-audio',turnId},s)},
    guidedRepeat:{load:(c,s)=>run(c,{op:'repeat'},s),mark:(c,trackId,segmentId,s)=>run(c,{op:'repeat-mark',trackId,segmentId},s)},
    learningFlow:{restore:(c,s)=>run(c,{op:'restore'},s),revealPage:(c,pageId,s)=>run(c,{op:'page-reveal',pageId},s),finishPages:(c,a,s)=>run(c,{op:'pages-finish',activity:token(a)},s),finishPattern:(c,a,responses,s)=>run(c,{op:'pattern-finish',activity:token(a),responses},s)},
    learningTools:{load:(c,s)=>run(c,{op:'tools'},s),open:(c,target,s)=>run(c,{op:'open'},s,target)},
    recording:{load:(c,s)=>run(c,{op:'recording-load'},s),restore:(c,a,s)=>run(c,{op:'recording-restore',activity:token(a)},s),
      upload:(scope,blob,durationSeconds,s)=>run(scope.capsuleRef,{op:'recording-upload',activity:token(scope.activityRef),durationSeconds},s,scope.target,blob),
      audio:(scope,recordingId,s)=>run(scope.capsuleRef,{op:'recording-audio',activity:token(scope.activityRef),recordingId},s,scope.target),
      remove:(scope,recordingId,s)=>run(scope.capsuleRef,{op:'recording-delete',activity:token(scope.activityRef),recordingId},s,scope.target),
      complete:(r,s)=>run(r.capsuleRef,r.kind==='speaking-introduction'?{op:'speaking-complete',activity:token(r.activityRef),recordingId:r.recordingId,criteriaIds:r.criteriaIds}:{op:'roleplay-complete',activity:token(r.activityRef),sceneId:r.sceneId,side:r.side},s),
    },
  };
}
