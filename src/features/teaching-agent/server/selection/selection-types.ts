import 'server-only';
import { z } from 'zod';
import type { ContextSource, RunAuthority } from '../../../agent-core/contracts/server.ts';

const ref = z.string().regex(/^ta1:[a-z_]+:[a-f0-9]{64}$/);
/** Locators, never identity or authorization. Pins must come from a server read. */
export const studentSelectionLocatorSchema = z.object({
  lessonId: z.string().uuid(), moduleId: z.string().uuid(),
  teachingSessionId: z.string().uuid().optional(), scriptVersionId: z.string().uuid(),
  nodeId: z.string().uuid(), segmentIndex: z.number().int().min(0).max(1999),
  locale: z.enum(['zh-CN', 'ko-KR']), expectedRevision: ref, segmentRef: ref,
  selectedText: z.string().max(8000).optional(),
}).strict();
export type StudentSelectionLocator = z.infer<typeof studentSelectionLocatorSchema>;
export type TeachingLocale = StudentSelectionLocator['locale'];
/** Server-only IDs support authorization; this object must never be a model projection. */
export interface StudentTeachingScope {
  readonly actorId: string; readonly tenantId: string; readonly appId: string;
  readonly courseId: string; readonly lessonId: string; readonly moduleId: string;
  readonly textbookId: string; readonly textbookVersionId: string; readonly chapterId: string;
  readonly teachingLessonId: string; readonly agentProfileId: string;
  readonly scriptVersionId: string; readonly nodeId: string; readonly segmentIndex: number;
  readonly teachingSessionId?: string; readonly locale: TeachingLocale;
  readonly scopeRef: string;
}
export interface VerifiedTeachingSelection {
  readonly binding: 'verified_selection'; readonly lessonRef: string; readonly moduleRef: string;
  readonly scriptVersionRef: string; readonly nodeRef: string; readonly segmentRef: string;
  readonly segmentIndex: number; readonly locale: TeachingLocale; readonly sourceLocale: TeachingLocale;
  readonly originalSentence: string; readonly contentRevision: string;
  readonly sourceRefs: readonly string[]; readonly resolvedAt: string;
}
export interface VerifiedStudentBinding {
  readonly authority: RunAuthority; readonly scope: StudentTeachingScope;
  readonly selection: VerifiedTeachingSelection; readonly sources: readonly ContextSource[];
}
