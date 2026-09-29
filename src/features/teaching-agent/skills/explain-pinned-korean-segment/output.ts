import 'server-only';
import { z } from 'zod';
import { localeSchema } from '../../server/tools/contracts.ts';
import type { ExplainEvidence } from './evidence.ts';

/** Runtime envelope, NOT a requirement for Provider structured output. References are
 * attached by the server from the execution ledger; the model cannot submit them. */
export const explanationTextSchema = z.strictObject({
  responseText: z.string().trim().min(1).max(6000), locale: localeSchema,
  completeness: z.enum(['complete', 'partial']), limitation: z.string().trim().min(1).max(500).optional(),
  checkQuestion: z.string().trim().min(1).max(300).optional(),
  supplements: z.array(z.strictObject({ text: z.string().trim().min(1).max(1000), provenance: z.literal('model_generated') })).max(3).optional(),
});
// A basic guard for explicit state-write claims. Arbitrary paraphrases and teaching
// correctness still require 1C/product evaluation; text never becomes an executable action.
const stateWriteClaim = /(?:已(?:经)?(?:为你|帮你|替你)?(?:更新|修改|保存|推进|完成|解锁|评分|判分|提交)|(?:我|系统)(?:为你|帮你|替你)?(?:更新|修改|保存|推进|完成|解锁|评分|判分|提交)|\b(?:I|we)\s+(?:(?:have|already)\s+)*(?:updated|saved|advanced|completed|unlocked|graded|submitted)\b|(?:진도를|상태를|점수를|수업을|답안을)\s*(?:저장|수정|완료|채점|제출)했)/i;

export function validateExplainOutput(input: unknown, evidence: ExplainEvidence, locale: 'zh-CN' | 'ko-KR') {
  if (evidence.status !== 'satisfied') return { status: 'rejected' as const, code: 'LESSON_EVIDENCE_REQUIRED' as const };
  const parsed = explanationTextSchema.safeParse(input);
  if (!parsed.success) return { status: 'rejected' as const, code: 'INVALID_EXPLANATION' as const };
  const d = parsed.data;
  const text = [d.responseText, d.checkQuestion, d.limitation, ...(d.supplements?.map(item => item.text) ?? [])].filter(Boolean).join('\n');
  if (d.locale !== locale || stateWriteClaim.test(text)
    || (evidence.completeness === 'partial' && (d.completeness !== 'partial' || !d.limitation)))
    return { status: 'rejected' as const, code: 'INVALID_EXPLANATION' as const };
  return { status: 'accepted' as const, output: { ...d, sourceRefs: [...evidence.sourceRefs], evidenceRefs: structuredClone(evidence.evidenceRefs),
    revision: evidence.revision, segmentRef: evidence.segmentRef, asOf: evidence.asOf, truncated: evidence.truncated } };
}
