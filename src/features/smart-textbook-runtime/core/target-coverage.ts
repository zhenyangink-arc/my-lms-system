import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { parseRuntimeTarget } from '../../../lib/smart-textbook-runtime-v1/targets.ts';
import type { TargetCommand } from './target-registry.ts';

export type TargetObservation = {
  target: string; stepId: string; stateId: string; initial: boolean;
  ownerCount: number; successfulCommands: TargetCommand[];
};
export type TargetCategory = 'mounted-owner' | 'mount-on-reveal' | 'commandless-identity' | 'optional-hidden' | 'invalid' | 'unsupported';

/** Enumerates ALL declared learning targets, not just DOM hits. Evidence must
 * come from mounted Runtime commands in legal UI states. Static descriptors or
 * a matching text label alone are deliberately insufficient to claim ownership. */
export function auditLearningTargets(m: LessonManifestV1, observations: readonly TargetObservation[]) {
  const blocks = m.blocks.filter(b => b.type === 'compat.learning.v1');
  const declarations = m.runtimeTargets.filter(t => blocks.some(b => b.id === t.blockId));
  const rows = declarations.map(t => {
    const parsed = parseRuntimeTarget(t.id);
    const states = observations.filter(o => o.target === t.id);
    const duplicateOwner = states.some(o => o.ownerCount > 1);
    const invalid = !parsed || parsed.stepId !== t.stepId || parsed.blockId !== t.blockId || parsed.partId !== t.partId ||
      states.some(o => o.stepId !== t.stepId || o.ownerCount < 0 || !Number.isInteger(o.ownerCount) || o.successfulCommands.some(c => !t.capabilities.includes(c)));
    const witness = states.find(o => o.ownerCount === 1 && t.capabilities.every(c => o.successfulCommands.includes(c)));
    const category: TargetCategory = invalid || duplicateOwner ? 'invalid' : !t.capabilities.length ? 'commandless-identity' :
      witness ? witness.initial ? 'mounted-owner' : 'mount-on-reveal' : 'unsupported';
    // V1 has no explicit optional target flag: do not invent optional-hidden
    // exemptions for a required command just because its UI state was not visited.
    const missing = t.capabilities.filter(c => !states.some(o => o.ownerCount === 1 && o.successfulCommands.includes(c)));
    return { target: t.id, stepId: t.stepId, partId: t.partId ?? null, category, duplicateOwner,
      missingCommands: missing, witnessState: witness?.stateId ?? null };
  });
  const unknownObservations = observations.filter(o => !declarations.some(t => t.id === o.target)).map(o => o.target);
  return { snapshotId: m.snapshot.id, rows, unknownObservations,
    requiredUnsupported: rows.filter(r => r.category === 'invalid' || r.category === 'unsupported').length,
    duplicateOwners: rows.filter(r => r.duplicateOwner).length,
    danglingCommands: rows.reduce((sum, r) => sum + r.missingCommands.length, 0) };
}
