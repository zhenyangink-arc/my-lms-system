import { z } from 'zod';
import { idSchema } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';

const option = z.strictObject({ id: idSchema, text: z.string() });
const turn = { id: idSchema, speaker: z.string(), side: z.enum(['left', 'right']) };
const timing = { afterMs: z.number().int().min(0).max(10000), typingSpeedMs: z.number().int().min(1).max(1000) };
const base = { ref: idSchema, title: z.string(), instruction: z.string() };
export const patternExecutionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...base, kind: z.literal('conversation'), turns: z.array(z.discriminatedUnion('kind', [
    z.strictObject({ ...turn, ...timing, kind: z.literal('line'), text: z.string() }),
    z.strictObject({ ...turn, ...timing, kind: z.literal('choice'), prompt: z.string(), options: z.array(option).min(1) }),
  ])).min(1).max(100) }),
  z.strictObject({ ...base, kind: z.literal('composition'), turns: z.array(z.strictObject({
    ...turn, kind: z.literal('composition'), prompt: z.string(), task: z.string(), hint: z.string(), tokens: z.array(option).min(1),
  })).min(1).max(100) }),
]);
export type PatternExecution = z.infer<typeof patternExecutionSchema>;
export const patternResponseSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('choice'), partId: idSchema, optionId: idSchema }),
  // Repeated tokens remain allowed, matching the old composition controls.
  z.strictObject({ kind: z.literal('composition'), partId: idSchema, tokenIds: z.array(idSchema).min(1).max(100) }),
]);
export type PatternResponse = z.infer<typeof patternResponseSchema>;
export const patternCheckSchema = z.strictObject({
  activityRef: idSchema, partId: idSchema, correct: z.boolean(),
  formalCompletion: z.literal(false), progressDelta: z.null(),
});
export type PatternCheck = z.infer<typeof patternCheckSchema>;
export interface PatternServices {
  audio?(capsuleRef: string, turnId: string, signal: AbortSignal): Promise<Blob | null>;
  load(capsuleRef: string, signal: AbortSignal): Promise<PatternExecution[]>;
  check(capsuleRef: string, activityRef: string, response: PatternResponse, signal: AbortSignal): Promise<PatternCheck>;
}
/** Presentation assembly from learner-selected tokens, never a grader. */
export function assemblePatternTokens(tokens: Array<{ id: string; text: string }>, ids: string[]) {
  return ids.map(id => {
    const token = tokens.find(token => token.id === id);
    if (!token) throw Error('UNBOUND_PATTERN_TOKEN');
    return token.text;
  }).join(' ').replace(/\s+([?.!,])/g, '$1');
}
