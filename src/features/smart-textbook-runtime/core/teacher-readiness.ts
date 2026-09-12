import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { rendererRegistry } from './block-registry.ts';
import type { TargetCommand } from './target-registry.ts';

export const teacherChecks = [
  'renderer', 'character', 'normal-speech', 'buffer-speech', 'browser-fallback',
  'tts-observation', 'blackboard', 'student-task', 'visual-cue', 'question',
  'feedback', 'remediation', 'terminal', 'target-commands', 'timeline',
  'lifecycle', 'session-isolation', 'reload', 'owner-exclusion', 'strict-complete-runtime',
] as const;
export type TeacherCheck = typeof teacherChecks[number];
export type TeacherEvidence = {
  check: TeacherCheck; snapshotId: string; teachingRevision: string;
  status: 'passed' | 'failed' | 'unverified'; test: string;
};
export type TeacherTargetRequirement = {
  source: string; snapshotId: string; stepId: string; target: string;
  commands: TargetCommand[];
};
export type TeacherTargetWitness = {
  source: string; snapshotId: string; stepId: string; target: string;
  command: TargetCommand; ownerCount: number;
  result: 'executed' | 'controlled-refusal'; test: string;
};

/** Requirements come from frozen server-side script references; witnesses from
 * mounted commands. A controlled refusal is recorded but is NOT an executable
 * owner witness. Empty/partial observations can never certify a real command. */
export function auditTeacherTargets(m: LessonManifestV1, requirements: readonly TeacherTargetRequirement[], witnesses: readonly TeacherTargetWitness[]) {
  const rows = requirements.map(r => {
    const declaration = m.runtimeTargets.find(t => t.id === r.target);
    const seen = witnesses.filter(w => w.source === r.source && w.target === r.target);
    const invalid = r.snapshotId !== m.snapshot.id || !r.commands.length ||
      new Set(r.commands).size !== r.commands.length || !declaration || declaration.stepId !== r.stepId ||
      r.commands.some(c => !declaration.capabilities.includes(c)) ||
      seen.some(w => w.snapshotId !== m.snapshot.id || w.stepId !== r.stepId || !r.commands.includes(w.command) ||
        !Number.isInteger(w.ownerCount) || w.ownerCount < 0 || !w.test.trim());
    const duplicateOwner = seen.some(w => w.ownerCount > 1);
    const missingCommands = r.commands.filter(command => !seen.some(w =>
      w.command === command && w.ownerCount === 1 && w.result === 'executed' && w.test.trim()));
    return { ...r, invalid: !!invalid, duplicateOwner, missingCommands,
      status: invalid || duplicateOwner || missingCommands.length ? 'unsupported' as const : 'verified' as const };
  });
  const unknownWitnesses = witnesses.filter(w => !requirements.some(r => r.source === w.source && r.target === w.target));
  const duplicateRequirements = requirements.length - new Set(requirements.map(r => `${r.source}\n${r.target}`)).size;
  return { snapshotId: m.snapshot.id, rows, unknownWitnesses, duplicateRequirements,
    requiredUnsupported: rows.filter(r => r.status === 'unsupported').length,
    danglingCommands: rows.reduce((n, r) => n + r.missingCommands.length, 0),
    duplicateOwners: rows.filter(r => r.duplicateOwner).length };
}

/** Evidence evaluator only, never a permission or a client-controlled registry
 * switch. A complete node inventory and exact source-reference inventory are
 * necessary in addition to passing component/browser evidence. */
export function teacherCapabilityReadiness(m: LessonManifestV1, input: {
  teachingRevision: string; requiredNodeKeys: readonly string[];
  sourceUnsupported: readonly string[];
  nodes: readonly { key: string; status: 'passed' | 'failed' | 'unverified'; test: string }[];
  requiredTargets: readonly TeacherTargetRequirement[];
  targets: ReturnType<typeof auditTeacherTargets>;
  evidence: readonly TeacherEvidence[];
}) {
  const blockers: string[] = [];
  if (input.sourceUnsupported.length) blockers.push('teacher.source-unmapped');
  if (!m.teachingRefs.length || m.teachingRefs.some(r => r.revision !== input.teachingRevision)) blockers.push('teacher.revision');
  if (!input.requiredNodeKeys.length || new Set(input.requiredNodeKeys).size !== input.requiredNodeKeys.length ||
    input.nodes.length !== input.requiredNodeKeys.length || input.nodes.some(n => !input.requiredNodeKeys.includes(n.key))) blockers.push('teacher.node-inventory');
  for (const key of input.requiredNodeKeys) {
    const rows = input.nodes.filter(n => n.key === key);
    if (rows.length !== 1 || rows[0].status !== 'passed' || !rows[0].test.trim()) blockers.push(`teacher.node:${key}`);
  }
  const targetAudit = input.targets;
  if (targetAudit.snapshotId !== m.snapshot.id || targetAudit.requiredUnsupported || targetAudit.danglingCommands ||
    targetAudit.duplicateOwners || targetAudit.duplicateRequirements || targetAudit.unknownWitnesses.length ||
    targetAudit.rows.length !== input.requiredTargets.length || input.requiredTargets.some(r =>
      !targetAudit.rows.some(a => a.source === r.source && a.target === r.target && a.stepId === r.stepId &&
        a.snapshotId === r.snapshotId && JSON.stringify(a.commands) === JSON.stringify(r.commands)))) blockers.push('teacher.targets');
  for (const check of teacherChecks) {
    const rows = input.evidence.filter(e => e.check === check);
    if (rows.length !== 1 || rows[0].status !== 'passed' || !rows[0].test.trim() ||
      rows[0].snapshotId !== m.snapshot.id || rows[0].teachingRevision !== input.teachingRevision) blockers.push(`teacher.${check}`);
  }
  if (rendererRegistry['compat.teacher.v1'].rendererStatus !== 'implemented') blockers.push('teacher.renderer-registry');
  return { snapshotId: m.snapshot.id, teachingRevision: input.teachingRevision,
    teacherReady: blockers.length === 0, compatTeacher: blockers.length ? 'unsupported' as const : 'implemented' as const,
    blockers: [...new Set(blockers)] };
}

/** Pre-promotion gate: validates ALL implementation evidence but cannot claim a
 * complete Runtime before the registry has enabled strict activation. Resolves
 * the ordering dependency explicitly; final teacherReady still requires the
 * separate, post-promotion strict-complete evidence and registry checks above. */
export function teacherImplementationReadiness(m:LessonManifestV1,input:Parameters<typeof teacherCapabilityReadiness>[1]){
  const result=teacherCapabilityReadiness(m,input);
  const activationChecks=new Set(['teacher.strict-complete-runtime','teacher.renderer-registry']);
  const blockers=result.blockers.filter(b=>!activationChecks.has(b));
  return{snapshotId:m.snapshot.id,readyForRegistryPromotion:blockers.length===0,blockers,
    pendingActivationChecks:result.blockers.filter(b=>activationChecks.has(b)),teacherReady:result.teacherReady};
}
