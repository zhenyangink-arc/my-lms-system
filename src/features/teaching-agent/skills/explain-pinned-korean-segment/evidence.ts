import 'server-only';
import type { ToolResult } from '../../../agent-core/contracts/tool.ts';
import type { VerifiedStudentBinding } from '../../server/selection/selection-types.ts';
import { lessonOutputSchema, stateOutputSchema, type EvidenceRef } from '../../server/tools/contracts.ts';
import { teachingRef } from '../../server/selection/references.ts';

export type ExplainEvidence = { status: 'satisfied'; sourceRefs: string[]; evidenceRefs: EvidenceRef[];
  revision: string; segmentRef: string; completeness: 'complete' | 'partial'; truncated: boolean; asOf: string }
  | { status: 'missing' | 'invalid'; code: 'LESSON_EVIDENCE_REQUIRED' | 'INVALID_LESSON_EVIDENCE' };

/** Inputs are the private server execution ledger, never model-supplied references or JSON.
 * This checks evidence; it does not mint a Run terminal state or validate prose quality. */
export function checkExplainEvidence(binding: VerifiedStudentBinding, lesson?: ToolResult<unknown>, state?: ToolResult<unknown>): ExplainEvidence {
  if (!lesson) return { status: 'missing', code: 'LESSON_EVIDENCE_REQUIRED' };
  const invalid = { status: 'invalid' as const, code: 'INVALID_LESSON_EVIDENCE' as const };
  if (lesson.status !== 'ok' && lesson.status !== 'partial') return invalid;
  const parsed = lessonOutputSchema.safeParse(lesson.data);
  if (!parsed.success) return invalid;
  const d = parsed.data, s = binding.selection;
  const expectedSentence = Array.from(s.originalSentence).slice(0, 4000).join('');
  if (d.revision !== s.contentRevision || d.segmentRef !== s.segmentRef || d.locale !== s.locale || d.sourceLocale !== s.sourceLocale
    || d.originalSentence !== expectedSentence || !lesson.sourceRefs.length || lesson.sourceRefs.some(ref => ref !== s.segmentRef)
    || d.completeness !== (lesson.status === 'partial' ? 'partial' : 'complete')
    || d.truncated !== (d.truncatedFields.length > 0) || (d.truncated && d.completeness !== 'partial')
    || Date.parse(d.asOf) < Date.parse(s.resolvedAt) || Date.parse(d.asOf) > Date.now()
    || !d.evidenceRefs.some(ref => ref.kind === 'lesson_sentence')
    || (d.objectives.length > 0) !== d.evidenceRefs.some(ref => ref.kind === 'learning_objectives')
    || d.evidenceRefs.some(ref => ref.kind === 'saved_teaching_state' || ref.sourceRef !== s.segmentRef || ref.revision !== s.contentRevision)) return invalid;
  const evidenceRefs = [...d.evidenceRefs];
  let partial = d.completeness === 'partial';
  if (state && (state.status === 'ok' || state.status === 'partial') && binding.scope.teachingSessionId) {
    const parsedState = stateOutputSchema.safeParse(state.data);
    const sessionRef = teachingRef('session', [binding.scope.tenantId, binding.scope.actorId, binding.scope.teachingSessionId]);
    if (parsedState.success) {
      const sd = parsedState.data;
      if (sd.scriptVersionRef === s.scriptVersionRef && sd.teachingSessionRef === sessionRef && sd.stateRevision === sd.revision
        && state.sourceRefs.length > 0 && state.sourceRefs.every(ref => ref === sessionRef)
        && sd.completeness === (state.status === 'partial' ? 'partial' : 'complete')
        && Date.parse(sd.asOf) >= Date.parse(s.resolvedAt) && Date.parse(sd.asOf) <= Date.now()
        && sd.evidenceRefs.length === 1 && sd.evidenceRefs.every(ref => ref.kind === 'saved_teaching_state' && ref.sourceRef === sessionRef && ref.revision === sd.revision)) {
        evidenceRefs.push(...sd.evidenceRefs); partial ||= sd.completeness === 'partial';
      }
    }
  }
  return { status: 'satisfied', sourceRefs: [...new Set(evidenceRefs.map(ref => ref.sourceRef))], evidenceRefs,
    revision: d.revision, segmentRef: d.segmentRef, completeness: partial ? 'partial' : 'complete', truncated: d.truncated, asOf: d.asOf };
}
