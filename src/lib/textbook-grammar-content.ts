import { z } from 'zod';

const text = z.string().max(12000);
export const grammarLocalizedSchema = z.strictObject({ 'zh-CN': text, 'ko-KR': text });
/** Current teaching cards and the independent/legacy grammar library are NOT
 * interchangeable persistence models. Never normalize a card into `grammar`. */
export const textbookGrammarCardSchema = z.strictObject({
  form: text.min(1), function: grammarLocalizedSchema,
  rules: z.array(text),
  examples: z.array(z.strictObject({ ko: text, zh: text, audioId: text, audioStatus: text })),
  caution: grammarLocalizedSchema, source: grammarLocalizedSchema,
  comparison: grammarLocalizedSchema.optional(),
});
export type TextbookGrammarCard = z.infer<typeof textbookGrammarCardSchema>;
export function readTextbookGrammarCards(content: Record<string, unknown> | null): TextbookGrammarCard[] {
  if (!content || !Object.hasOwn(content, 'grammarCards')) return [];
  // Unknown/malformed content is an error, never an empty inventory.
  return z.array(textbookGrammarCardSchema).parse(content.grammarCards);
}
export const grammarTextEditSchema = z.strictObject({
  form: text.trim().min(1), function: grammarLocalizedSchema,
  caution: grammarLocalizedSchema, source: grammarLocalizedSchema,
});
export type GrammarTextEdit = z.infer<typeof grammarTextEditSchema>;
