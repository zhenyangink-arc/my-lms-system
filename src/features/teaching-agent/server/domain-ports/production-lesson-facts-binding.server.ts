import 'server-only';
import type { StudentTeachingScope } from '../selection/selection-types.ts';
import type { StudentToolBinding } from '../tools/contracts.ts';
import type { ToolExecutionContext } from '../../../agent-core/contracts/tool.ts';
import { assertExecution } from '../../../agent-core/runtime/deadline.ts';
import type { PublishedReadSnapshot } from '../../../smart-textbook-runtime/server/published-native-activity-read.server.ts';
import { FactsReadError,type ProductionLessonFactsHandle } from './lesson-execution-facts-binding.ts';
// An actual per-call authorization, never a structurally copyable context token.
const activeReads=new WeakMap<ToolExecutionContext,{scope:StudentTeachingScope;active:boolean}>();
export function assertProductionFactsReadAuthorized(scope:StudentTeachingScope,context:ToolExecutionContext){
 if(activeReads.get(context)?.scope!==scope||!activeReads.get(context)?.active)throw new FactsReadError('not_found_or_not_visible');
}
/** No injected read/source/DB/Owner capability. A request-local verifier must
 * recognize the exact original binding before every read and finalization. */
export function createProductionLessonFactsBinding(input:StudentToolBinding){
 const issued=new WeakSet<ProductionLessonFactsHandle>();
 let last: {context:ToolExecutionContext;snapshot:PublishedReadSnapshot}|undefined;
 const {binding,domain,execution,skillRunId}=input;
 const frozenAuthority=JSON.stringify(binding.authority),frozenScope=JSON.stringify(binding.scope);
 async function validate(context:Omit<ToolExecutionContext,'callId'|'modelCallId'>){
  if(context.authority!==binding.authority||context.runId!==execution.runId||context.skillRunId!==skillRunId||context.deadlineAt!==execution.deadlineAt||JSON.stringify(binding.authority)!==frozenAuthority||JSON.stringify(binding.scope)!==frozenScope||binding.authority.membershipRole!=='student'||Date.parse(binding.authority.expiresAt)<=Date.now())throw new FactsReadError('not_found_or_not_visible');
  assertExecution(context.signal,context.deadlineAt);
  const read=await domain.selection.revalidate(binding,context);
  if(read.status!=='ok')throw new FactsReadError(read.status==='stale'?'stale':read.status==='unavailable'?'unavailable':'not_found_or_not_visible');
 }
 async function readAuthorized(context:ToolExecutionContext){
  await validate(context);const admitted={...context},lease={scope:binding.scope,active:true};activeReads.set(admitted,lease);
  try{
   const {readPublishedNativeActivity,isPublishedReadSnapshot}=await import('../../../smart-textbook-runtime/server/published-native-activity-read.server.ts');
   const snapshot=await readPublishedNativeActivity(binding.scope,admitted);
   if(!isPublishedReadSnapshot(snapshot))throw new FactsReadError('unavailable');
   return snapshot;
  }finally{lease.active=false;}
 }
 return {
  async issue(context:Omit<ToolExecutionContext,'callId'|'modelCallId'>){await validate(context);const handle=Object.freeze({kind:'published-lesson-execution-facts-read' as const});issued.add(handle);return handle;},
  async revalidate(handle:ProductionLessonFactsHandle,context:Omit<ToolExecutionContext,'callId'|'modelCallId'>){if(!issued.has(handle))throw new FactsReadError('not_found_or_not_visible');await validate(context);},
  async validateSnapshot(handle:ProductionLessonFactsHandle,context:Omit<ToolExecutionContext,'callId'|'modelCallId'>){
   if(!issued.has(handle)||!last)throw new FactsReadError('unavailable');await validate(context);
   const previous=last;last=undefined;
   const fresh=await readAuthorized(previous.context);await validate(context);
   if(fresh.authority!==binding.authority||fresh.receipt.provenance.revision!==previous.snapshot.receipt.provenance.revision||fresh.receipt.provenance.contentRef!==previous.snapshot.receipt.provenance.contentRef)throw new FactsReadError('stale');
   // Revalidation never refreshes the original receipt's asOf or observation bound.
   if(Date.now()-Date.parse(previous.snapshot.receipt.provenance.asOf)>30000)throw new FactsReadError('stale');
   last=previous;
  },
  async read(handle:ProductionLessonFactsHandle,context:ToolExecutionContext){
   last=undefined;
   if(!issued.has(handle))throw new FactsReadError('not_found_or_not_visible');await validate(context);
   const started=Date.now(),snapshot=await readAuthorized(context);await validate(context);
   const p=snapshot.receipt.provenance;
   if(snapshot.authority!==binding.authority||p.runId!==context.runId||p.skillRunId!==context.skillRunId||p.modelCallId!==context.modelCallId||p.toolCallId!==context.callId||p.scopeRef!==binding.scope.scopeRef||p.deadlineAt!==context.deadlineAt)throw new FactsReadError('not_found_or_not_visible');
   if(Date.parse(p.readStartedAt)<started||Date.parse(p.asOf)>Date.now()||Date.now()-Date.parse(p.asOf)>30000)throw new FactsReadError('stale');
   last={context,snapshot};return snapshot;
  }
 };
}
export type ProductionLessonFactsBinding=ReturnType<typeof createProductionLessonFactsBinding>;
