import { z } from 'zod';
import { parseRuntimeTarget, stableIdPattern } from './targets.ts';

export const idSchema = z.string().regex(stableIdPattern);
// All strings are inert text. Markup/code has no escape hatch in v1.
export const textSchema = z.string().min(1).max(20000).refine(v => !/<\/?[a-z!]|javascript\s*:|data\s*:|=>|\b(?:eval|Function)\s*\(|\bfunction\s*\(|[{}]\s*;?|@import|expression\s*\(/i.test(v), 'Executable text/markup/style is forbidden');
export const localeSchema = z.enum(['zh-CN', 'ko-KR']);
export const localizedTextSchema = z.strictObject({ 'zh-CN': textSchema.optional(), 'ko-KR': textSchema.optional() }).refine(v => Object.keys(v).length > 0, 'Empty localized text');
const L = localizedTextSchema, I = idSchema, T = textSchema;
const panel = z.strictObject({ id: I, title: L });
const panels = z.array(panel);
const line = z.strictObject({ id: I, speaker: L, text: L, translation: L.optional(), mediaRef: I.optional() });
const group = z.strictObject({ id: I, title: L, lines: z.array(line).min(1) });
const example = z.strictObject({ id: I, text: L, translation: L.optional(), mediaRef: I.optional() });
const segment = z.strictObject({ id: I, text: L, mediaRef: I });
const tracks = z.array(z.strictObject({ id: I, segments: z.array(segment).min(1) })).min(1);
const returns = z.array(z.strictObject({ itemId: I, target: z.string().refine(v => parseRuntimeTarget(v) !== null) }));
export type RichNodeV1 = { kind: 'text'; text: string } | { kind: 'paragraph' | 'list' | 'strong' | 'em'; children: RichNodeV1[] } | { kind: 'lang'; locale: 'zh-CN' | 'ko-KR'; children: RichNodeV1[] } | { kind: 'link'; href: string; children: RichNodeV1[] };
function richNode(depth: number): z.ZodType<RichNodeV1> {
  const leaf = z.strictObject({ kind: z.literal('text'), text: T });
  if (depth >= 4) return leaf;
  const children = z.array(richNode(depth + 1)).min(1);
  return z.union([leaf, z.strictObject({ kind: z.enum(['paragraph','list','strong','em']), children }), z.strictObject({ kind: z.literal('lang'), locale: localeSchema, children }), z.strictObject({ kind: z.literal('link'), href: z.url().refine(v => v.startsWith('https://') && !/[<>]/.test(v)), children })]);
}
export const propsSchemas = {
  video: z.strictObject({ mediaRef: I, posterRef: I.optional(), captionsRef: I.optional(), safeTranscript: L.optional(), role: z.enum(['teacher','content']), fallback: z.enum(['text','retry']), startPaused: z.boolean() }),
  image: z.strictObject({ mediaRef: I, alt: L, fit: z.enum(['contain','cover']) }),
  text: z.strictObject({ paragraphs: z.array(L).min(1) }),
  rich_text: z.strictObject({ document: z.array(richNode(1)).min(1) }),
  audio: z.strictObject({ mediaRef: I, safeTranscript: L.optional(), playbackPolicyRef: I.optional() }),
  dialogue: z.strictObject({ groups: z.array(group).min(1) }),
  multiple_choice: z.strictObject({ activityRef: I, presentation: z.enum(['single','cards']) }),
  multiple_select: z.strictObject({ activityRef: I, presentation: z.literal('single') }),
  fill_blank: z.strictObject({ activityRef: I, presentation: z.enum(['inline','form']) }),
  ordering: z.strictObject({ activityRef: I, presentation: z.enum(['list','expression']) }),
  listening: z.strictObject({ activityRef: I, tracks: z.array(z.strictObject({ id: I, mediaRef: I, exercisePartIds: z.array(I) })).min(1), playbackPolicyRef: I }),
  shadowing: z.strictObject({ practiceRef: I, tracks }),
  pronunciation: z.strictObject({ activityRef: I, modelMediaRef: I.optional(), rubric: z.array(L) }),
  role_play: z.strictObject({ activityRef: I, scenes: z.array(z.strictObject({ id: I, roles: z.array(panel).min(1), turns: z.array(line).min(1) })).min(1), recognition: z.literal('optional') }),
  writing: z.strictObject({ activityRef: I, scaffold: z.array(L).optional(), rubric: z.array(L) }),
  self_check: z.strictObject({ activityRef: I, returnTargets: returns }),
  supplemental_visual: z.strictObject({ slides: z.array(z.strictObject({ id: I, title: L, items: z.array(z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('text'), texts: z.array(L).min(1) }), z.strictObject({ kind: z.literal('list'), texts: z.array(L).min(1) }), z.strictObject({ kind: z.literal('image'), mediaRef: I })])).min(1) })).min(1) }),
  vocabulary_practice: z.strictObject({ entries: z.array(z.strictObject({ id: I, word: L, meaning: L, phonetic: T.optional(), mediaRef: I.optional() })).min(1), activityRefs: z.array(I), panels }),
  grammar_practice: z.strictObject({ sections: z.array(z.strictObject({ id: I, title: L, explanation: L, examples: z.array(example) })).min(1), activityRefs: z.array(I), panels }),
  pattern_practice: z.strictObject({ patterns: z.array(example).min(1), groups: z.array(group), activityRefs: z.array(I), panels }),
  listen_speak: z.strictObject({ listeningRef: I, speakingRef: I, practiceRef: I, tracks, panels }),
  read_write: z.strictObject({ readingRef: I, writingRef: I, source: z.array(L).min(1), scaffold: z.array(L), panels }),
  review: z.strictObject({ activityRefs: z.array(I), progressRefs: z.array(I), returnTargets: returns, panels }),
  'compat.teacher.v1': z.strictObject({ teachingRef: I, capsuleRef: I }),
  'compat.learning.v1': z.strictObject({ capsuleRef: I, activityRefs: z.array(I), progressRefs: z.array(I), parts: panels }),
} as const;
export type BlockTypeV1 = keyof typeof propsSchemas;
export const blockTypes = Object.keys(propsSchemas) as BlockTypeV1[];
export const blockTypeSchema = z.enum(blockTypes);
export const regionIdSchema = z.enum(['teaching','interaction','navigation','interaction.main','interaction.support','interaction.feedback']);
export const completionSchema = z.discriminatedUnion('kind', [z.strictObject({ kind: z.literal('none') }), z.strictObject({ kind: z.literal('server'), policyRef: I })]);
const baseBlock = { id: I, stepId: I, region: regionIdSchema, order: z.number().int().positive(), title: L.optional(), hint: L.optional(), completion: completionSchema, runtimeTarget: z.string().refine(v => parseRuntimeTarget(v) !== null) };
function blockSchema<K extends BlockTypeV1>(type: K) { return z.strictObject({ ...baseBlock, type: z.literal(type), props: propsSchemas[type] }); }
export type BlockV1 = { [K in BlockTypeV1]: z.infer<ReturnType<typeof blockSchema<K>>> }[BlockTypeV1];
// The explicit tuple preserves the discriminator and each props type at compile time.
export const blockSchemaV1 = z.discriminatedUnion('type', [
  blockSchema('video'),blockSchema('image'),blockSchema('text'),blockSchema('rich_text'),blockSchema('audio'),blockSchema('dialogue'),blockSchema('multiple_choice'),blockSchema('multiple_select'),blockSchema('fill_blank'),blockSchema('ordering'),blockSchema('listening'),blockSchema('shadowing'),blockSchema('pronunciation'),blockSchema('role_play'),blockSchema('writing'),blockSchema('self_check'),blockSchema('supplemental_visual'),blockSchema('vocabulary_practice'),blockSchema('grammar_practice'),blockSchema('pattern_practice'),blockSchema('listen_speak'),blockSchema('read_write'),blockSchema('review'),blockSchema('compat.teacher.v1'),blockSchema('compat.learning.v1'),
]);
export const layoutSchema = z.strictObject({ preset: z.enum(['split-classroom','stacked-classroom']), desktopRatio: z.enum(['30-70','40-60','50-50']), splitBreakpoint: z.literal('xl'), narrowOrder: z.tuple([z.literal('teaching'),z.literal('interaction')]), teachingCollapsible: z.boolean(), focusPolicy: z.enum(['manual','teaching-phase']), supportPresentation: z.enum(['inline','drawer']), navigationPlacement: z.literal('bottom'), density: z.literal('comfortable') });
export const regionSchema = z.strictObject({ id: regionIdSchema, role: z.enum(['teaching','interaction','navigation','main','support','feedback']), parent: z.literal('interaction').nullable(), content: z.enum(['blocks','regions','runtime-navigation']), allowedBlockTypes: z.array(blockTypeSchema) });
export const stepSchema = z.strictObject({ id: I, key: I, title: L, hint: L.optional(), order: z.number().int().positive(), regions: z.array(z.strictObject({ region: regionIdSchema, blockIds: z.array(I) })), completion: completionSchema, nextStep: I.nullable(), teachingRef: I.nullable() });
export const navigationSchema = z.strictObject({ region: z.literal('navigation'), entryStep: I, items: z.array(I).min(1), mode: z.literal('linear'), access: z.enum(['free','completed-prefix']), previous: z.literal('allowed'), autoAdvance: z.literal(false), resume: z.literal('stable-id') });
export const runtimeTargetSchema = z.strictObject({ id: z.string().refine(v => parseRuntimeTarget(v) !== null), stepId: I, blockId: I, partId: I.nullable(), capabilities: z.array(z.enum(['reveal','focus','highlight','play','open'])), acceptedEvents: z.array(z.enum(['opened','media-ended','response-submitted','practice-confirmed'])), verification: z.enum(['ui-only','server-attempt','server-practice','playback-observation']) });
// This does not grant playback of an unready asset. Private publication evidence
// must certify the exact existing owner/fallback for every exceptional reference.
export const mediaAdmissionSchema = z.strictObject({ revision: z.literal('chapter-one-media/1'), rule: z.enum(['existing-browser-tts','unused-reservation']), evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/) });
export const mediaRefSchema = z.strictObject({ id: I, kind: z.enum(['image','audio','video','captions']), revision: I, readiness: z.enum(['ready','pending','rejected']), access: z.enum(['lesson','teaching-turn','after-attempt']), language: localeSchema.nullable(), alt: L, admission: mediaAdmissionSchema.optional() });
const presentation = { prompt: L, instruction: L, options: z.array(z.strictObject({ id: I, text: L })) };
const choiceSettings = z.strictObject({ shuffle: z.boolean(), showScore: z.boolean() });
const activityBase = { id: I, activityId: I, revision: I };
function activity<K extends string, S extends z.ZodType>(type: K, settings: S) { return z.strictObject({ ...activityBase, type: z.literal(type), publicPresentation: z.strictObject({ ...presentation, settings }) }); }
export const activityRefSchema = z.discriminatedUnion('type', [activity('single_choice',choiceSettings), activity('multiple_choice',choiceSettings), activity('fill_blank',z.strictObject({ showScore: z.boolean() })), activity('ordering',choiceSettings), activity('listening',z.strictObject({ maxPlays: z.number().int().positive().optional(), showScore: z.boolean() })), activity('speaking',z.strictObject({ rubric: z.array(L) })), activity('writing',z.strictObject({ rubric: z.array(L) })), activity('self_check',z.strictObject({ items: z.array(panel) }))]);
export const progressRefSchema = z.strictObject({ id: I, kind: z.enum(['activity','node','activity-page','guided-repeat','chapter','teaching']) });
export const teachingRefSchema = z.strictObject({ id: I, revision: I, mode: z.enum(['legacy','video-first']), entryCueId: I });
export const runtimeContextSchema = z.strictObject({ runtimeSessionId: I, snapshotId: I, sourceState: z.enum(['draft','published']), trackingDisabled: z.boolean(), locale: localeSchema, supportMode: z.enum(['chinese','bilingual','immersion']) }).refine(v => v.sourceState !== 'draft' || v.trackingDisabled, 'Draft tracking must be disabled');
export const manifestStructureSchema = z.strictObject({ schemaVersion: z.literal('1.0.0'), runtimeContract: z.literal('uply-runtime/1'), requiredCapabilities: z.array(I), snapshot: z.strictObject({ id: I, contentDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/), compiledAt: z.iso.datetime(), compilerVersion: I, scope: z.enum(['chapter','step-preview']) }), textbook: z.strictObject({ id:I,slug:I,title:L,appId:I }), version: z.strictObject({ id:I,number:z.number().int().positive() }), chapter: z.strictObject({ id:I,key:I,number:z.number().int().nonnegative(),title:L,scenario:L,goal:L }), localization: z.strictObject({ defaultLocale:localeSchema,locales:z.array(localeSchema).min(1) }), template:z.strictObject({id:I,key:I,revision:I}),layout:layoutSchema,regions:z.array(regionSchema).min(4).max(6),steps:z.array(stepSchema).min(1),blocks:z.array(blockSchemaV1).min(1),navigation:navigationSchema,completion:z.strictObject({authority:z.literal('server'),chapterPolicyRef:I}),runtimeTargets:z.array(runtimeTargetSchema),mediaRefs:z.array(mediaRefSchema),activityRefs:z.array(activityRefSchema),progressRefs:z.array(progressRefSchema),teachingRefs:z.array(teachingRefSchema),compatibility:z.strictObject({profile:z.enum(['native','legacy-adapted','mixed']),adapterRevision:I.nullable()}) });
export type LessonManifestV1 = z.infer<typeof manifestStructureSchema>;
export type LayoutV1 = z.infer<typeof layoutSchema>;
export type RegionV1 = z.infer<typeof regionSchema>;
export type StepV1 = z.infer<typeof stepSchema>;
export type NavigationV1 = z.infer<typeof navigationSchema>;
export type RuntimeTargetV1 = z.infer<typeof runtimeTargetSchema>;
export type MediaRefV1 = z.infer<typeof mediaRefSchema>;
export type ActivityRefV1 = z.infer<typeof activityRefSchema>;
export type ProgressRefV1 = z.infer<typeof progressRefSchema>;
export type TeachingRefV1 = z.infer<typeof teachingRefSchema>;
export type RuntimeContextV1 = z.infer<typeof runtimeContextSchema>;
