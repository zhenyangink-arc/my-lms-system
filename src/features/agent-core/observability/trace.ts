import 'server-only';
import type { CoreErrorCode } from '../contracts/public.ts';
import { z } from 'zod';
const ref = z.object({ name: z.string().min(1).max(100), version: z.string().min(1).max(100) }).strict();
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const opaque = z.string().regex(/^ta1:[a-z_]+:[a-f0-9]{64}$/);
const evidenceBase={toolRef:ref,skillRef:ref,runId:z.uuid(),skillRunId:z.uuid(),modelCallId:z.uuid(),toolCallId:z.string().min(1).max(200),subjectRef:opaque,tenantRef:opaque,scopeRef:opaque,lessonRef:opaque,versionRef:opaque,contentBinding:opaque,revision:opaque,asOf:z.iso.datetime(),readStartedAt:z.iso.datetime(),deadlineAt:z.iso.datetime()};
export const typedTraceEvidenceSchema=z.discriminatedUnion('kind',[
 z.object({...evidenceBase,kind:z.literal('durable_execution_facts'),facts:z.object({completionStatus:z.enum(['COMPLETED','INCOMPLETE']),attemptCount:z.number().int().min(0).max(20),latestResult:z.enum(['CORRECT','INCORRECT','UNKNOWN']),nodeProgress:z.object({status:z.enum(['not_started','in_progress','completed']),completionPercent:z.number().min(0).max(100),masteryScore:z.number().min(0).max(100),attemptCount:z.number().int().min(0).max(10000)}).strict().nullable(),currentTeachingNode:z.null(),currentPositionAvailability:z.literal('unavailable')}).strict(),activityRef:opaque,snapshotRef:opaque,receiptRef:opaque,executionNodeRef:opaque,sourceTeachingNodeRef:opaque,storage:z.literal('CURRENT_PUBLISHED_DB'),receiptContract:z.literal('activity-completion/3')}).strict(),
 z.object({...evidenceBase,kind:z.literal('lesson_context'),segmentRef:opaque,sourceRefs:z.array(opaque).min(1).max(3)}).strict()
]);
export type TypedTraceEvidence=z.infer<typeof typedTraceEvidenceSchema>;
export const traceDetailsSchema = z.object({
  outputDigest:hash.optional(),
  evidenceSet:z.array(typedTraceEvidenceSchema).min(1).max(8).optional(),
  definitionDigest: hash.optional(), authorityDigest: hash.optional(), promptDigest: hash.optional(),
  profileRef: ref.optional(), skillRef: ref.optional(), toolRef: ref.optional(), promptVersion: ref.optional(),
  contextVersion: ref.optional(), policyVersion: ref.optional(), modelConfigVersion: z.string().max(100).optional(),
  stage: z.enum(['intake','admission','context','planning','corrective','tool','final','persistence']).optional(),
  status: z.enum(['pass','fail','ok','partial','stale','denied','unavailable']).optional(),
  revision: opaque.optional(), segmentRef: opaque.optional(), sourceRefs: z.array(opaque).max(3).optional(),
  completeness: z.enum(['complete','partial']).optional(), asOf: z.iso.datetime().optional(),
  byteEstimate: z.number().int().nonnegative().max(1000000).optional(),
  sections: z.array(z.enum(['base','role','persona','skill','constraints','context','history','question'])).max(8).optional(),
}).strict();
// Metadata only. No arbitrary spread, prompt, arguments, response, or reasoning field.
export interface TraceEvent {
  kind: 'run.started' | 'permission.checked' | 'context.resolved' | 'skill.selected'
    | 'model.started' | 'model.usage' | 'tool.started' | 'tool.completed' | 'run.completed' | 'run.failed' | 'run.cancelled'
    | 'tool.requested' | 'evidence.checked' | 'output.checked' | 'definition.pinned' | 'prompt.assembled' | 'run.failure';
  runId: string; at: string; modelCallId?: string; toolCallId?: string; skillRunId?: string;
  contextSnapshotId?: string;
  errorCode?: CoreErrorCode;
  details?: z.infer<typeof traceDetailsSchema>;
}
export function traceMetadata(event: TraceEvent): TraceEvent {
  return { kind: event.kind, runId: event.runId, at: event.at,
    ...(event.modelCallId ? { modelCallId: event.modelCallId } : {}),
    ...(event.toolCallId ? { toolCallId: event.toolCallId } : {}),
    ...(event.skillRunId ? { skillRunId: event.skillRunId } : {}),
    ...(event.contextSnapshotId ? { contextSnapshotId: event.contextSnapshotId } : {}),
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
    ...(event.details ? { details: traceDetailsSchema.parse(event.details) } : {}) };
}
export interface TraceSink { write(event: TraceEvent): Promise<void> }
export const noopTraceSink: TraceSink = { async write() {} };
export interface StructuredLogger { error(entry: { runId: string; errorCode: CoreErrorCode; stage: string }): void }
export const noopLogger: StructuredLogger = { error() {} };
