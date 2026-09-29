import 'server-only';
import { createHash } from 'node:crypto';
import { teachingScriptSegments } from '../../../../lib/teaching-video.ts';
import type { PublishedNode, StudentContentRecord } from '../repositories/contracts.ts';
import type { TeachingLocale } from './selection-types.ts';

// Not a DB primary key and not a bearer credential. Policy is always rechecked.
export function teachingRef(kind: string, parts: unknown): string {
  return `ta1:${kind}:${createHash('sha256').update(JSON.stringify(parts)).digest('hex')}`;
}
export function nodeSegments(node: PublishedNode, locale: TeachingLocale) {
  return teachingScriptSegments(node.script, {
    scriptSegments: node.segments, teacherVideo: { mode: node.videoMode },
  }, locale);
}
export function authoredLocale(node: PublishedNode, locale: TeachingLocale): TeachingLocale {
  return node.videoMode === 'video' || node.script[locale] === undefined ? 'zh-CN' : locale;
}
export function contentRevision(content: StudentContentRecord): string {
  return teachingRef('revision', [content.revisionParts, content.node]);
}
/** Future authorized page projection can expose these pins; no UI is wired in 1A. */
export function selectionPins(content: StudentContentRecord, locale: TeachingLocale, index: number) {
  const node = content.node;
  if (!node || !Number.isInteger(index) || index < 0) return null;
  const originalSentence = nodeSegments(node, locale)[index];
  if (!originalSentence) return null;
  const revision = contentRevision(content);
  return {
    expectedRevision: revision,
    segmentRef: teachingRef('segment', [revision, node.versionId, node.id, locale,
      authoredLocale(node, locale), index, originalSentence]),
    originalSentence,
  };
}
