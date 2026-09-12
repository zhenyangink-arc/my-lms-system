import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { rendererRegistry, executableCapabilities } from './block-registry.ts';
import type { auditLearningTargets } from './target-coverage.ts';
import { validateLessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/validator.ts';

export const learningChecks = ['pattern-audio','orientation-restore','recording-group-integrated','history-pagination','session-binding','full-chapter-restore','server-authority','lifecycle','unified-browser-boundary','strict-learning-mount','strict-learning-reload'] as const;
export type LearningCheck = typeof learningChecks[number];
export type LearningEvidence = { check: LearningCheck; snapshotId: string; status: 'passed' | 'failed' | 'unverified'; test: string };

/** Report calculation, not a client permission or an executable capability flag.
 * Missing/repeated/stale test evidence cannot be turned into a hand-written true. */
export function learningCapabilityReadiness(m: LessonManifestV1, input: {
  targets: ReturnType<typeof auditLearningTargets>; evidence: LearningEvidence[];
  activities: ReadonlyArray<{ ref: string; status: 'equivalent' | 'partial' | 'unsupported'; test: string }>;
  requiredActivityRefs: readonly string[];
}) {
  const blockers: string[] = [];
  const required=new Set(input.requiredActivityRefs);
  if(required.size!==m.activityRefs.length||input.requiredActivityRefs.length!==required.size||m.activityRefs.some(a=>!required.has(a.id)))blockers.push('learning.activity-coverage');
  if (input.targets.snapshotId !== m.snapshot.id || input.targets.requiredUnsupported || input.targets.duplicateOwners || input.targets.danglingCommands || input.targets.unknownObservations.length) blockers.push('learning.targets');
  for (const check of learningChecks) {
    const rows = input.evidence.filter(e => e.check === check);
    if (rows.length !== 1 || rows[0].status !== 'passed' || rows[0].snapshotId !== m.snapshot.id || !rows[0].test.trim()) blockers.push(check);
  }
  for (const ref of input.requiredActivityRefs) {
    const rows = input.activities.filter(a => a.ref === ref);
    if (!m.activityRefs.some(a => a.id === ref) || rows.length !== 1 || rows[0].status !== 'equivalent' || !rows[0].test.trim()) blockers.push(`activity:${ref}`);
  }
  for (const block of m.blocks.filter(b => b.type !== 'compat.teacher.v1'))
    if (rendererRegistry[block.type].rendererStatus !== 'implemented') blockers.push(`renderer:${block.type}`);
  return { snapshotId: m.snapshot.id, blockers: [...new Set(blockers)], learningReady: blockers.length === 0,
    compatLearning: blockers.length ? 'unsupported' as const : 'implemented' as const, runtimeReady: false as const };
}

/** Strict learning mode omits ONLY the teacher capability from the unsupported
 * capability check. It does not register a fake teacher or ignore learning. */
export function validateLearningActivation(manifest: unknown) {
  return validateLessonManifestV1(manifest, { supportedCapabilities: [...executableCapabilities, rendererRegistry['compat.teacher.v1'].capability] });
}
