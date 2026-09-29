import { z } from 'zod';
import type { LessonManifestV1, RuntimeContextV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { TimelineCue } from '../../../lib/smart-textbook-runtime-v1/execution.ts';
import type { ActivityResult } from './services.ts';
const text=z.string().min(1).max(200);
export const executionBindingSchema=z.strictObject({sessionId:text,snapshotId:text,snapshotDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),stepId:text,sourceBlockId:text,mediaRevision:text,cueId:text,blockId:text,activityRef:text});
export type ExecutionBinding=z.infer<typeof executionBindingSchema>;
export const completionRequestSchema=z.strictObject({binding:executionBindingSchema,requestId:text,generation:z.number().int().nonnegative()});
export type CompletionRequest=z.infer<typeof completionRequestSchema>;
const fixtureReceiptSchema=z.strictObject({
  ...completionRequestSchema.shape,contract:z.literal('activity-completion/1'),status:z.enum(['COMPLETED','INCOMPLETE','UNKNOWN']),attemptNumber:z.number().int().nonnegative(),
  evidence:z.strictObject({source:z.enum(['isolated-fixture','activity-domain']),stateRevision:z.number().int().nonnegative(),stateDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.iso.datetime()}),
  completedAt:z.iso.datetime().nullable(),
}).refine(r=>r.status!=='COMPLETED'||(r.attemptNumber>0&&r.completedAt!==null),'Completion requires attempt and evidence');
const durableReceiptSchema=z.strictObject({
 ...completionRequestSchema.shape,contract:z.literal('activity-completion/2'),status:z.enum(['COMPLETED','INCOMPLETE','UNKNOWN']),attemptNumber:z.number().int().nonnegative(),
 evidence:z.strictObject({source:z.literal('activity-domain'),storage:z.enum(['isolated-test-db','CURRENT_DEVELOPMENT_DB']),kind:z.literal('durable-attempt-sequence'),attemptSequence:z.number().int().nonnegative(),stateDigest:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.iso.datetime(),latestAttemptAt:z.iso.datetime({offset:true}).nullable(),progressUpdatedAt:z.iso.datetime({offset:true}).nullable()}),completedAt:z.iso.datetime({offset:true}).nullable(),
}).refine(r=>r.status!=='COMPLETED'||(r.attemptNumber>0&&r.completedAt!==null&&r.evidence.latestAttemptAt!==null&&r.evidence.progressUpdatedAt!==null),'Durable completion requires persisted evidence');
export const completionReceiptSchema=z.union([fixtureReceiptSchema,durableReceiptSchema]);
export type ActivityCompletionReceipt=z.infer<typeof completionReceiptSchema>;
/** Sequence is a freshness lower bound, NOT a content revision or CAS token. */
export function completionSequence(r:ActivityCompletionReceipt){return r.contract==='activity-completion/2'?r.evidence.attemptSequence:r.evidence.stateRevision;}
export const restoreSchema=z.strictObject({binding:executionBindingSchema,requestId:text,generation:z.number().int().nonnegative(),pending:z.boolean(),receipt:completionReceiptSchema});
export type ExecutionRestore=z.infer<typeof restoreSchema>;
export type NativeExecutionServices={
  onFactsPort?(port:ReturnType<typeof import('./runtime-facts.ts').createRuntimeFactsReadPort>|null):void;
  mediaSource(mediaRef:string,revision:string):string;
  restore(request:CompletionRequest,signal:AbortSignal):Promise<unknown>;
  checkpoint(request:CompletionRequest,signal:AbortSignal):Promise<unknown>;
  submit(request:CompletionRequest,optionId:string,signal:AbortSignal):Promise<{receipt:unknown;result:ActivityResult}>;
  readback(request:CompletionRequest,signal:AbortSignal):Promise<unknown>;
};
export function executionBinding(m:LessonManifestV1,context:RuntimeContextV1,c:TimelineCue):ExecutionBinding{
  const b=m.blocks.find(b=>b.id===c.targetBlockId);if(b?.type!=='multiple_choice'||context.snapshotId!==m.snapshot.id)throw Error('EXECUTION_BINDING');
  return {sessionId:context.runtimeSessionId,snapshotId:m.snapshot.id,snapshotDigest:m.snapshot.contentDigest,stepId:c.stepId,sourceBlockId:c.sourceBlockId,mediaRevision:c.mediaRevision,cueId:c.id,blockId:c.targetBlockId,activityRef:b.props.activityRef};
}
export function sameBinding(a:ExecutionBinding,b:ExecutionBinding){return (Object.keys(executionBindingSchema.shape) as Array<keyof ExecutionBinding>).every(k=>a[k]===b[k]);}
export function acceptCompletion(raw:unknown,request:CompletionRequest,minRevision=0){
  const r=completionReceiptSchema.parse(raw);
  if(!sameBinding(r.binding,request.binding)||r.requestId!==request.requestId||r.generation!==request.generation||completionSequence(r)<minRevision)throw Error('COMPLETION_BINDING_OR_FRESHNESS');
  return r;
}

/** Production read receipt is a separate namespace/shape. It cannot be consumed
 * by the legacy cue/development receipt parser or manufacture a media cursor. */
export const publishedCompletionReceiptSchema=z.strictObject({
 contract:z.literal('activity-completion/3'),status:z.enum(['COMPLETED','INCOMPLETE']),attemptNumber:z.number().int().min(0).max(20),completedAt:z.iso.datetime({offset:true}).nullable(),
 provenance:z.strictObject({storage:z.literal('CURRENT_PUBLISHED_DB'),source:z.literal('activity-domain'),publicationRevision:z.literal('publish-foundation/2'),snapshotRef:text,scopeRef:text,contentRef:text,activityRef:text,executionNodeRef:text,sourceTeachingNodeRef:text,versionRef:text,runId:z.uuid(),skillRunId:z.uuid(),modelCallId:text,toolCallId:text,toolVersion:z.literal('1.1.0'),skillVersion:z.literal('1.1.0'),readStartedAt:z.iso.datetime(),asOf:z.iso.datetime(),observedAt:z.iso.datetime(),deadlineAt:z.iso.datetime(),revision:text}),
 evidence:z.strictObject({kind:z.literal('durable-attempt-sequence'),attemptSequence:z.number().int().min(0).max(20),stateDigest:z.string().regex(/^[a-f0-9]{64}$/),latestAttemptAt:z.iso.datetime({offset:true}).nullable(),progressUpdatedAt:z.iso.datetime({offset:true}).nullable()})
}).refine(r=>r.attemptNumber===r.evidence.attemptSequence&&r.provenance.asOf===r.provenance.observedAt&&Date.parse(r.provenance.readStartedAt)<=Date.parse(r.provenance.asOf)&&Date.parse(r.provenance.asOf)<=Date.parse(r.provenance.deadlineAt)&&
 (r.status!=='COMPLETED'||(r.attemptNumber>0&&r.completedAt!==null&&r.evidence.progressUpdatedAt!==null)),'Published durable receipt consistency');
export type PublishedCompletionReceipt=z.infer<typeof publishedCompletionReceiptSchema>;
