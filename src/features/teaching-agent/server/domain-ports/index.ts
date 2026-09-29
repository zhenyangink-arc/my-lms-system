import 'server-only';
import type { ContextSource, RunAuthority, RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import type { VerifiedStudentBinding } from '../selection/selection-types.ts';
export type SegmentBinding = 'verified_selection' | 'verified_current'; // verified_current: NOT YET VERIFIED FOR PRODUCT USE.
export type StudentMvpSegmentBinding = 'verified_selection';
export type ReadProjection<T> =
  | { status: 'ok' | 'partial'; data: T; sourceRevision: string; sources: ContextSource[] }
  | { status: 'stale' | 'not_found_or_not_visible' | 'unavailable' };
export interface CurrentLessonReadPort {
  read(input: { binding: VerifiedStudentBinding; lessonRef: string; segmentRef: string; expectedRevision: string; segmentBinding: StudentMvpSegmentBinding }, authority: RunAuthority, execution: RuntimeExecutionContext): Promise<ReadProjection<LessonProjection>>;
}
export interface TeachingStateReadPort {
  read(input: { binding: VerifiedStudentBinding; teachingSessionRef: string; expectedRevision: string; expectedStateRevision?: string }, authority: RunAuthority, execution: RuntimeExecutionContext): Promise<ReadProjection<TeachingStateProjection>>;
}
export interface LessonProjection {
  lessonTitle: string; moduleTitle: string; originalSentence: string;
  authoredExplanation?: string; objectives: string[];
  contentVersion: number; segmentRef: string; locale: string; sourceLocale: string;
  omittedFields: string[]; truncatedFields: string[];
}
export interface TeachingStateProjection {
  semantic: 'last_saved_teaching_position'; teachingSessionRef: string; scriptVersionRef: string;
  nodeRef: string | null; segmentRef: string | null; segmentIndex: number | null;
  phase: string; stateRevision: string; status: 'active'; omittedFields: string[];
}

/** A read-only server capability; not a Student admission or a B3 write scope. */
export interface LessonExecutionFactsReadPort {
 read(handle:import('./lesson-execution-facts-binding.ts').LessonFactsHandle,
 context:import('../../../agent-core/contracts/tool.ts').ToolExecutionContext):
 Promise<import('../../../agent-core/contracts/tool.ts').ToolResult<import('../tools/contracts.ts').LessonExecutionFacts>>;
}

export interface ProductionLessonExecutionFactsReadPort {
 read(handle:import('./lesson-execution-facts-binding.ts').ProductionLessonFactsHandle,
 context:import('../../../agent-core/contracts/tool.ts').ToolExecutionContext):
 Promise<import('../../../agent-core/contracts/tool.ts').ToolResult<import('../tools/contracts.ts').ProductionLessonExecutionFacts>>;
}
