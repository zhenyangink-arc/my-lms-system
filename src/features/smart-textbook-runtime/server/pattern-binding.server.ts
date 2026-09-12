import 'server-only';
import { capsuleSchema, type PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import { assemblePatternTokens, patternExecutionSchema, patternResponseSchema, patternCheckSchema, type PatternExecution } from '../core/patterns.ts';

function scopedPatterns(manifest: LessonManifestV1, bindings: PrivateBindings, ref: string) {
  const capsule = capsuleSchema.parse(bindings.capsules.find(c => c.id === ref));
  const block = manifest.blocks.find(b => b.type === 'compat.learning.v1' && b.props.capsuleRef === ref);
  if (capsule.kind !== 'learning' || block?.type !== 'compat.learning.v1') throw Error('PATTERN_CAPSULE_SCOPE');
  return capsule.activities.filter(a => block.props.activityRefs.includes(a.activityId)).filter(a => a.activityKey === 'pattern-choice' || a.activityKey === 'pattern-compose');
}
function frozenPart(bindings: PrivateBindings, owner: string, path: string) {
  const rows = bindings.identities.filter(i => i.owner === owner && i.legacyPath === path);
  if (rows.length !== 1) throw Error('FROZEN_PATTERN_ID_MISSING');
  return rows[0].partId;
}
export function patternExecutions(manifest: LessonManifestV1, bindings: PrivateBindings, ref: string, locale: 'zh-CN' | 'ko-KR'): PatternExecution[] {
  return scopedPatterns(manifest, bindings, ref).map(a => {
    const part = (path: string) => frozenPart(bindings, a.activityId, path);
    let value: unknown;
    if (a.activityKey === 'pattern-choice') {
      const c = a.settings.conversation;
      value = { ref: a.activityId, kind: 'conversation', title: c.title[locale], instruction: c.instruction[locale], turns: c.steps.map((s, i) => {
        const path = `public_config.conversation.steps[${i}]`;
        const base = { id: part(path), speaker: s.speaker[locale], side: s.side, afterMs: s.afterMs, typingSpeedMs: s.typingSpeedMs };
        if (s.kind === 'line' && typeof s.line === 'string') return { ...base, kind: 'line', text: s.line };
        if (s.kind === 'choice' && s.options && s.prompt && Number.isInteger(s.choiceIndex)) return {
          ...base, kind: 'choice', prompt: s.prompt[locale], options: s.options.map((text, j) => ({ id: part(`${path}.options[${j}]`), text })),
        };
        throw Error('UNSUPPORTED_PATTERN_TURN');
      }) };
    } else {
      const c = a.settings.composition;
      value = { ref: a.activityId, kind: 'composition', title: c.title[locale], instruction: c.instruction[locale], turns: c.steps.map((s, i) => {
        const path = `public_config.composition.steps[${i}]`;
        return { id: part(path), kind: 'composition', side: 'left', speaker: s.speaker[locale], prompt: s.prompt, task: s.task[locale], hint: s.hint[locale], tokens: s.tokens.map((text, j) => ({ id: part(`${path}.tokens[${j}]`), text })) };
      }) };
    }
    const checked = patternExecutionSchema.parse(value);
    const ids = checked.turns.flatMap(t => [t.id, ...(t.kind === 'choice' ? t.options : t.kind === 'composition' ? t.tokens : []).map(o => o.id)]);
    if (new Set(ids).size !== ids.length) throw Error('DUPLICATE_PATTERN_ID');
    return checked;
  });
}

/** Frozen identity → old check action coordinates. No caller index, grade or
 * persistence coordinate is accepted. The source snapshot is immutable. */
export function boundPatternCheck(manifest: LessonManifestV1, bindings: PrivateBindings, capsuleRef: string, activityRef: string, input: unknown) {
  const response = patternResponseSchema.parse(input);
  const descriptor = patternExecutions(manifest, bindings, capsuleRef, 'zh-CN').find(a => a.ref === activityRef);
  const activity = scopedPatterns(manifest, bindings, capsuleRef).find(a => a.activityId === activityRef);
  const binding = bindings.activities.find(a => a.ref === activityRef);
  if (!descriptor || !activity || binding?.versionId !== manifest.version.id || binding.activityId !== activityRef) throw Error('PATTERN_ACTIVITY_SCOPE');
  const turn = descriptor.turns.find(t => t.id === response.partId);
  if (!turn || turn.kind !== response.kind) throw Error('PATTERN_PART_SCOPE');
  if (activity.activityKey === 'pattern-choice' && turn.kind === 'choice' && response.kind === 'choice') {
    const choices = activity.settings.conversation.steps.filter(s => s.kind === 'choice');
    const indices = choices.map(s => s.choiceIndex);
    if (indices.some(i => !Number.isInteger(i) || i! < 0) || new Set(indices).size !== indices.length) throw Error('INVALID_LEGACY_CHOICE_INDEX');
    const legacy = activity.settings.conversation.steps.find((_, i) => frozenPart(bindings, activityRef, `public_config.conversation.steps[${i}]`) === response.partId)!;
    const index = turn.options.findIndex(o => o.id === response.optionId);
    if (index < 0) throw Error('PATTERN_OPTION_SCOPE');
    return { activityId: binding.activityId, itemIndices: [legacy.choiceIndex!], response: [index] };
  }
  if (activity.activityKey === 'pattern-compose' && turn.kind === 'composition' && response.kind === 'composition') {
    const index = activity.settings.composition.steps.findIndex((_, i) => frozenPart(bindings, activityRef, `public_config.composition.steps[${i}]`) === response.partId);
    if (index < 0) throw Error('PATTERN_PART_SCOPE');
    return { activityId: binding.activityId, itemIndices: [index], response: [assemblePatternTokens(turn.tokens, response.tokenIds)] };
  }
  throw Error('PATTERN_KIND_MISMATCH');
}

export async function checkBoundPattern(manifest: LessonManifestV1, bindings: PrivateBindings, capsuleRef: string, activityRef: string, input: unknown,
  check: (input: { activityId: string; itemIndices: number[]; response: Array<number | string> }) => Promise<{ ok: boolean; results?: boolean[] }>) {
  const response = patternResponseSchema.parse(input);
  const result = await check(boundPatternCheck(manifest, bindings, capsuleRef, activityRef, response));
  if (!result.ok || result.results?.length !== 1 || typeof result.results[0] !== 'boolean') throw Error('PATTERN_DOMAIN_CHECK_FAILED');
  return patternCheckSchema.parse({ activityRef, partId: response.partId, correct: result.results[0], formalCompletion: false, progressDelta: null });
}
