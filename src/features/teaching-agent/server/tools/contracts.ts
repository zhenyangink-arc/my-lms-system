import 'server-only';
import { z } from 'zod';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import type { ToolExecutionContext } from '../../../agent-core/contracts/tool.ts';
import type { VerifiedStudentBinding } from '../selection/selection-types.ts';
import type { createStudentDomainRuntime } from '../composition/create-student-domain-runtime.ts';

export const opaqueRef = (kind: string) => z.string().regex(new RegExp(`^ta1:${kind}:[a-f0-9]{64}(?![\\s\\S])`));
export const localeSchema = z.enum(['zh-CN', 'ko-KR']);
export const lessonInputSchema = z.strictObject({ lessonRef: opaqueRef('lesson'), segmentRef: opaqueRef('segment') });
export const stateInputSchema = z.strictObject({});
export const evidenceRefSchema = z.strictObject({
  kind: z.enum(['lesson_sentence', 'learning_objectives', 'saved_teaching_state']),
  sourceRef: opaqueRef('(segment|session)'), revision: opaqueRef('(revision|state)'),
});
const evidenceMetadata = {
  evidenceRefs: z.array(evidenceRefSchema).min(1).max(3), revision: opaqueRef('(revision|state)'),
  asOf: z.iso.datetime(), completeness: z.enum(['complete', 'partial']), truncated: z.boolean(),
};
export const lessonOutputSchema = z.strictObject({
  ...evidenceMetadata, lessonTitle: z.string().max(400), moduleTitle: z.string().max(400),
  originalSentence: z.string().min(1).max(8000), objectives: z.array(z.string().max(800)).max(6),
  contentVersion: z.number().int().positive(), segmentRef: opaqueRef('segment'),
  locale: localeSchema, sourceLocale: localeSchema,
  omittedFields: z.array(z.enum(['authoredExplanation', 'adjacentExplanation', 'nodeConfiguration', 'answerKeys', 'privateMetadata'])).max(5),
  truncatedFields: z.array(z.string().regex(/^(lessonTitle|moduleTitle|originalSentence|objectives(\.[0-5])?)$/)).max(10),
});
export const stateOutputSchema = z.strictObject({
  ...evidenceMetadata, semantic: z.literal('last_saved_teaching_position'), teachingSessionRef: opaqueRef('session'),
  scriptVersionRef: opaqueRef('script'), lastSavedNodeRef: opaqueRef('node').nullable(),
  lastSavedSegmentRef: opaqueRef('segment').nullable(), lastSavedSegmentIndex: z.number().int().min(0).max(1999).nullable(),
  phase: z.enum(['explanation', 'task', 'task_feedback', 'question', 'unknown']), stateRevision: opaqueRef('state'), status: z.literal('active'),
  omissions: z.array(z.enum(['requiredTask', 'fullTeachingState', 'gradingKeys', 'visualPlaybackPosition'])).max(4),
});
export type LessonToolData = z.infer<typeof lessonOutputSchema>;
export type StateToolData = z.infer<typeof stateOutputSchema>;
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;
export interface StudentToolBinding {
  domain: ReturnType<typeof createStudentDomainRuntime>; binding: VerifiedStudentBinding;
  execution: RuntimeExecutionContext; skillRunId: string;
}
export function isBoundExecution(input: StudentToolBinding, context: ToolExecutionContext) {
  return context.authority === input.binding.authority && context.runId === input.execution.runId
    && context.skillRunId === input.skillRunId && context.deadlineAt === input.execution.deadlineAt;
}

// Durable execution evidence is distinct from selected-sentence Explain evidence.
export const lessonFactsToolRef = Object.freeze({name:'get_current_lesson_execution_facts',version:'1.0.0'});
export const lessonFactsInputSchema = z.strictObject({});
export const lessonFactsContentSchema = z.strictObject({
 lessonRef:opaqueRef('lesson'),lessonTitle:z.string().min(1).max(400),
 scriptVersionRef:opaqueRef('script'),versionRef:opaqueRef('version'),version:z.number().int().positive(),
 contentBinding:opaqueRef('revision'),sourceTeachingNodeRef:opaqueRef('node'),executionNodeRef:opaqueRef('node'),
 activityRef:opaqueRef('activity'),activityAlias:z.literal('hangul-introduction-vowel-recognition'),
});
export const lessonFactsOutputSchema = z.strictObject({
 ...lessonFactsContentSchema.shape,currentTeachingNode:z.null(),currentPositionAvailability:z.literal('unavailable'),
 completionStatus:z.enum(['COMPLETED','INCOMPLETE']),attemptCount:z.number().int().min(0).max(20),
 latestResult:z.enum(['CORRECT','INCORRECT','UNKNOWN']),
 nodeProgress:z.strictObject({status:z.enum(['not_started','in_progress','completed']),completionPercent:z.number().min(0).max(100),masteryScore:z.number().min(0).max(100),attemptCount:z.number().int().min(0).max(20)}).nullable(),
 evidence:z.strictObject({source:z.literal('activity-domain'),storage:z.enum(['CURRENT_DEVELOPMENT_DB','isolated-test-db']),
  kind:z.literal('durable-attempt-sequence'),attemptSequence:z.number().int().min(0).max(20),
  observedAt:z.iso.datetime(),latestAttemptAt:z.iso.datetime({offset:true}).nullable(),progressUpdatedAt:z.iso.datetime({offset:true}).nullable()}),
 revision:opaqueRef('state'),asOf:z.iso.datetime(),completedAt:z.iso.datetime({offset:true}).nullable(),
 evidenceRefs:z.tuple([z.strictObject({kind:z.literal('durable_activity_completion'),sourceRef:opaqueRef('activity'),revision:opaqueRef('state')})]),
 completeness:z.literal('partial'),truncated:z.literal(false),
});
export type LessonExecutionFacts = z.infer<typeof lessonFactsOutputSchema>;

export const productionLessonFactsToolRef=Object.freeze({name:'get_current_lesson_execution_facts',version:'1.1.0'});
export const productionLessonFactsContentSchema=lessonFactsContentSchema.extend({activityAlias:z.string().min(1).max(200)});
export const productionLessonFactsOutputSchema=lessonFactsOutputSchema.extend({
 ...productionLessonFactsContentSchema.shape,
 nodeProgress:lessonFactsOutputSchema.shape.nodeProgress.unwrap().extend({attemptCount:z.number().int().min(0).max(10000)}).nullable(),
 evidence:z.strictObject({source:z.literal('activity-domain'),storage:z.literal('CURRENT_PUBLISHED_DB'),kind:z.literal('durable-attempt-sequence'),receiptContract:z.literal('activity-completion/3'),publicationRevision:z.literal('publish-foundation/2'),snapshotRef:opaqueRef('snapshot'),scopeRef:opaqueRef('scope'),receiptRef:opaqueRef('receipt'),readStartedAt:z.iso.datetime(),deadlineAt:z.iso.datetime(),attemptSequence:z.number().int().min(0).max(20),observedAt:z.iso.datetime(),latestAttemptAt:z.iso.datetime({offset:true}).nullable(),progressUpdatedAt:z.iso.datetime({offset:true}).nullable()})
});
export type ProductionLessonExecutionFacts=z.infer<typeof productionLessonFactsOutputSchema>;
