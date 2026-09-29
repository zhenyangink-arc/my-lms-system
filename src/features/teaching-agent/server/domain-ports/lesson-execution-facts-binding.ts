import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ToolExecutionContext } from '../../../agent-core/contracts/tool.ts';
import { assertExecution } from '../../../agent-core/runtime/deadline.ts';
import { executionBindingSchema,acceptCompletion,type CompletionRequest } from '../../../smart-textbook-runtime/core/execution-contracts.ts';
import { nativeActivityScopeSchema,safeDigest } from '../../../smart-textbook-runtime/server/native-activity-binding.server.ts';
import type { readDurableActivityFacts } from '../../../smart-textbook-runtime/server/durable-activity-completion.server.ts';
import { lessonFactsContentSchema } from '../tools/contracts.ts';

export const factsGrantSchema=z.strictObject({domain:nativeActivityScopeSchema,binding:executionBindingSchema,
 content:lessonFactsContentSchema,definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),
 storage:z.enum(['CURRENT_DEVELOPMENT_DB','isolated-test-db'])});
export type FactsGrant=z.infer<typeof factsGrantSchema>;
export type FactsSnapshot=Awaited<ReturnType<typeof readDurableActivityFacts>>;
export type LessonFactsHandle=Readonly<{kind:'lesson-execution-facts-read'}>;
export class FactsReadError extends Error {
 readonly status:'not_found_or_not_visible'|'stale'|'unavailable';
 constructor(status:FactsReadError['status']){super('READ_UNAVAILABLE');this.status=status;}
}
/** Trusted server composition only. The callbacks are not model/browser inputs.
 * Production must supply Run-authorized readers; dev uses Owner-authorized fixed
 * DB composition. A serialized handle or a receipt storage string grants nothing. */
export function createLessonFactsBindingIssuer(input:{
 authorize:()=>Promise<FactsGrant>;
 read:(grant:FactsGrant,request:CompletionRequest)=>Promise<FactsSnapshot>;
}){
 const issued=new WeakMap<LessonFactsHandle,{grant:FactsGrant;context:ToolExecutionContext}>();
 function check(handle:LessonFactsHandle,context:ToolExecutionContext){
  const entry=issued.get(handle),c=entry?.context;
  if(!c||context.authority!==c.authority||context.runId!==c.runId||context.skillRunId!==c.skillRunId||context.deadlineAt!==c.deadlineAt||Date.parse(c.authority.expiresAt)<=Date.now())throw new FactsReadError('not_found_or_not_visible');
  assertExecution(context.signal,context.deadlineAt);return entry!;
 }
 async function current(entry:{grant:FactsGrant}){
  const g=factsGrantSchema.parse(await input.authorize()),p=entry.grant;
  if(g.domain.actorId!==p.domain.actorId||g.domain.tenantId!==p.domain.tenantId||g.domain.activityId!==p.domain.activityId||g.content.lessonRef!==p.content.lessonRef)throw new FactsReadError('not_found_or_not_visible');
  if(g.storage!==p.storage)throw new FactsReadError('unavailable');
  if(safeDigest(g)!==safeDigest(p))throw new FactsReadError('stale');
  return g;
 }
 return {
  async issue(context:ToolExecutionContext){
   assertExecution(context.signal,context.deadlineAt);
   const grant=factsGrantSchema.parse(await input.authorize());
   if(Date.parse(context.authority.expiresAt)<=Date.now())throw new FactsReadError('not_found_or_not_visible');
   const handle=Object.freeze({kind:'lesson-execution-facts-read' as const});
   issued.set(handle,{grant:structuredClone(grant),context:{...context}});return handle;
  },
  async revalidate(handle:LessonFactsHandle,context:ToolExecutionContext){await current(check(handle,context));check(handle,context);},
  async read(handle:LessonFactsHandle,context:ToolExecutionContext){
   const entry=check(handle,context),grant=await current(entry),started=Date.now();
   const request={binding:grant.binding,requestId:randomUUID(),generation:0};
   let facts:FactsSnapshot;
   try{facts=await input.read(structuredClone(grant),request);}catch(error){
    if(error instanceof Error && ['DURABLE_CONTENT_CHANGED','DURABLE_ATTEMPT_BINDING','NATIVE_ACTIVITY_EXECUTION_SCOPE'].includes(error.message))throw new FactsReadError('stale');
    if(error instanceof Error && error.message==='DURABLE_PROGRESS_SCOPE')throw new FactsReadError('not_found_or_not_visible');
    throw new FactsReadError('unavailable');
   }
   check(handle,context);await current(entry);check(handle,context);
   const r=acceptCompletion(facts.receipt,request);
   if(r.contract!=='activity-completion/2'||r.status==='UNKNOWN'||r.evidence.storage!==grant.storage)throw new FactsReadError('unavailable');
   const observed=Date.parse(r.evidence.observedAt),now=Date.now();
   if(observed<started||observed>now||now-observed>30000)throw new FactsReadError('stale');
   if(facts.attemptCount!==r.attemptNumber||r.attemptNumber!==r.evidence.attemptSequence)throw new FactsReadError('unavailable');
   return {content:structuredClone(grant.content),facts,receipt:r};
  },
 };
}
export type LessonFactsBindingIssuer=ReturnType<typeof createLessonFactsBindingIssuer>;

/** Distinct handle family: development grants cannot satisfy production ports. */
export type ProductionLessonFactsHandle=Readonly<{kind:'published-lesson-execution-facts-read'}>;
