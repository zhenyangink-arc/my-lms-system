import type { RuntimeServices,ActivityResult } from './services';
import type { PageCheck,PageResponse } from './activity-pages';
import type { PatternCheck } from './patterns';
import { acceptLearningRestore } from './learning-flow';

/** Shared transport wiring. Server actions/isolated HTTP can carry the same
 * strict request; no client selectable persistence mode or learner identity. */
export function withLearningFlow(services:RuntimeServices,call:(input:unknown,signal:AbortSignal)=>Promise<unknown>):RuntimeServices{
  const {context}=services;
  const run=async(capsuleRef:string,request:object,signal:AbortSignal)=>{signal.throwIfAborted();const value=await call({sessionId:context.runtimeSessionId,snapshotId:context.snapshotId,capsuleRef,...request},signal);signal.throwIfAborted();return value;};
  return {...services,
    learningFlow:{
      restore:async(c,signal)=>acceptLearningRestore(await run(c,{operation:'restore'},signal),context.snapshotId,c),
      revealPage:async(c,pageId,signal)=>await run(c,{operation:'reveal',pageId},signal) as {response:PageResponse;check:PageCheck},
      finishPages:async(c,activityRef,signal)=>await run(c,{operation:'finish-pages',activityRef},signal) as ActivityResult,
      finishPattern:async(c,activityRef,responses,signal)=>await run(c,{operation:'finish-pattern',activityRef,responses},signal) as ActivityResult,
    },
    // Activity submit needs the capsule from the caller; bind during load, not
    // from title/index. Only refs actually returned by that service are allowed.
    activities:services.activities?(()=>{const refs=new Map<string,string>();return {load:async(c:string,s:AbortSignal)=>{const rows=await services.activities!.load(c,s);rows.forEach(r=>refs.set(r.ref,c));return rows;},submit:async(ref:string,response:import('./activity').ActivityResponse,s:AbortSignal)=>{const c=refs.get(ref);if(!c)throw Error('FLOW_REF_NOT_LOADED');return await run(c,{operation:'submit',activityRef:ref,response},s) as ActivityResult;}};})():undefined,
    pages:services.pages?{...services.pages,check:async(c,pageId,response,s)=>await run(c,{operation:'page-check',pageId,response},s) as PageCheck}:undefined,
    patterns:services.patterns?{...services.patterns,check:async(c,activityRef,response,s)=>await run(c,{operation:'pattern-check',activityRef,response},s) as PatternCheck}:undefined,
  };
}
