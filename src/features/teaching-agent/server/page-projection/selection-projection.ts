import 'server-only';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import type { PublicSelectionPin } from '../../client/selection-state.ts';
import { StudentTeachingPolicy } from '../policies/student-teaching-policy.ts';
import type { StudentAuthentication, StudentTeachingReadRepository } from '../repositories/contracts.ts';
import { nodeSegments, selectionPins } from '../selection/references.ts';
import { assertExecution } from '../../../agent-core/runtime/deadline.ts';
export interface SegmentCandidate { lessonId: string; moduleId: string; nodeId: string; scriptVersionId: string }
/** Page-only read projection. Never serializes a VerifiedBinding or mints authority.
 * Candidates are locators only; each gets the same complete StudentPolicy read. */
export async function projectStudentSelectionPins(input: {
 candidates: readonly SegmentCandidate[]; authenticate: StudentAuthentication;
 repository: StudentTeachingReadRepository; execution: RuntimeExecutionContext;
}): Promise<PublicSelectionPin[]> {
 const policy = new StudentTeachingPolicy(input.authenticate, input.repository), result: PublicSelectionPin[] = [];
 for (const candidate of input.candidates.slice(0, 32)) {
  for (const locale of ['zh-CN','ko-KR'] as const) {
   assertExecution(input.execution.signal, input.execution.deadlineAt);
   // Dummy pins are not trusted/verified: policy resolves authorization and current content only.
   const content = await policy.resolve({ ...candidate, segmentIndex: 0, locale,
    expectedRevision: 'ta1:revision:' + '0'.repeat(64), segmentRef: 'ta1:segment:' + '0'.repeat(64) }, input.execution);
   if (!content?.node || content.scope.scriptVersionId !== candidate.scriptVersionId) continue;
   const segments = nodeSegments(content.node, locale);
   for (let segmentIndex = 0; segmentIndex < Math.min(segments.length, 2000); segmentIndex++) {
    const pins = selectionPins(content, locale, segmentIndex);
    // Only Korean-containing authored units, with bounded safe display text.
    if (!pins || !/[\uac00-\ud7af\u3131-\u318e]/u.test(pins.originalSentence) || pins.originalSentence.length > 2000) continue;
    result.push({ lessonId: content.scope.lessonId, moduleId: content.scope.moduleId,
     scriptVersionId: content.scope.scriptVersionId, nodeId: content.node.id, segmentIndex, locale,
     expectedRevision: pins.expectedRevision, segmentRef: pins.segmentRef, displayText: pins.originalSentence });
    if (result.length >= 128) return result;
   }
  }
 }
 return result;
}
