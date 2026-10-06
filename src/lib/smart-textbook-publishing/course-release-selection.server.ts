import 'server-only';
import { z } from 'zod';

const uuid = z.uuid();
export const courseReleaseSelectionSchema = z.strictObject({
  contract: z.literal('course-release-selection/1'),
  textbookId: uuid, textbookSlug: z.string().min(1), lessonId: uuid, legacyVersionId: uuid,
  phase: z.enum(['prepared', 'active']), chapterNumber: z.number().int().nonnegative(), chapterSlug: z.string().min(1),
  reserved: z.strictObject({versionId:uuid, chapterId:uuid, moduleId:uuid, executionNodeId:uuid,
    activityId:uuid, teachingLessonId:uuid, scriptVersionId:uuid, sourceTeachingNodeId:uuid}),
  sourceDraft: z.strictObject({scriptVersionId:uuid, teachingNodeId:uuid}),
}).superRefine((entry, ctx) => {
  const reserved = Object.values(entry.reserved);
  if (new Set(reserved).size !== reserved.length || reserved.some(id =>
    [entry.textbookId, entry.lessonId, entry.legacyVersionId, ...Object.values(entry.sourceDraft)].includes(id)))
    ctx.addIssue({code:'custom',message:'RELEASE_IDS_NOT_FRESH'});
});
export type CourseReleaseSelection = z.infer<typeof courseReleaseSelectionSchema>;

// Intentionally EMPTY. Installing a reviewed prepared entry on EVERY serving
// replica (including the full legacy pin) is a prerequisite to source promotion.
// This local check cannot prove that other replicas run the same binary.
const installed: readonly CourseReleaseSelection[] = [];
const registry = installed.map(entry => courseReleaseSelectionSchema.parse(entry));
for (const entry of registry) {
  if (registry.some(other => other !== entry && (
    (other.textbookId === entry.textbookId && other.legacyVersionId !== entry.legacyVersionId)
    || (other.lessonId === entry.lessonId && other.chapterNumber === entry.chapterNumber)
    || Object.values(other.reserved).some(id => Object.values(entry.reserved).includes(id)))))
    throw Error('RELEASE_REGISTRY_CONFLICT');
}
export function getLegacyVersionPin(textbookId:string):string|null {
  return registry.find(entry => entry.textbookId === textbookId)?.legacyVersionId ?? null;
}
export function getNativeVideoReleaseSelection(input:{lessonId:string;chapterNumber:number}):CourseReleaseSelection|null {
  const entry = registry.find(entry => entry.lessonId === input.lessonId && entry.chapterNumber === input.chapterNumber);
  return entry ? courseReleaseSelectionSchema.parse(entry) : null;
}
/** Owner promotion resolves the registered origin, never a browser target. */
export function getNativeVideoPromotionSelection(sourceNodeId:string,sourceScriptVersionId:string):CourseReleaseSelection|null {
  const matches = registry.filter(entry => entry.sourceDraft.teachingNodeId === sourceNodeId
    && entry.sourceDraft.scriptVersionId === sourceScriptVersionId);
  return matches.length === 1 ? courseReleaseSelectionSchema.parse(matches[0]) : null;
}
