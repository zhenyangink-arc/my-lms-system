import 'server-only';
import type { CurrentLessonReadPort, LessonProjection, ReadProjection } from './index.ts';
import type { StudentSelectionVerifier } from '../selection/verify-student-selection.ts';
import { emitTeachingTrace, type TeachingTraceSink } from '../context/trace.ts';

/** Strings are bounded by Unicode code points; metadata states exactly what was omitted. */
export function boundedLessonProjection(input: Omit<LessonProjection, 'omittedFields' | 'truncatedFields'>): LessonProjection {
  const truncatedFields: string[] = [];
  const bounded = (value: string, max: number, field: string) => {
    const points = Array.from(value);
    if (points.length <= max) return value;
    truncatedFields.push(field); return points.slice(0, max).join('');
  };
  const objectives = input.objectives.slice(0, 6).map((text, index) => bounded(text, 400, `objectives.${index}`));
  if (input.objectives.length > 6) truncatedFields.push('objectives');
  return { lessonTitle: bounded(input.lessonTitle, 200, 'lessonTitle'), moduleTitle: bounded(input.moduleTitle, 200, 'moduleTitle'),
    originalSentence: bounded(input.originalSentence, 4000, 'originalSentence'), objectives,
    contentVersion: input.contentVersion, segmentRef: input.segmentRef, locale: input.locale, sourceLocale: input.sourceLocale,
    omittedFields: ['authoredExplanation', 'adjacentExplanation', 'nodeConfiguration', 'answerKeys', 'privateMetadata'], truncatedFields };
}
export function createCurrentLessonReadPort(verifier: StudentSelectionVerifier, trace?: TeachingTraceSink): CurrentLessonReadPort {
  return { async read(input, authority, execution) {
    let result: ReadProjection<LessonProjection>;
    const selection = input.binding?.selection;
    if (!selection || authority !== input.binding.authority || input.segmentBinding !== 'verified_selection'
      || input.lessonRef !== selection.lessonRef || input.segmentRef !== selection.segmentRef)
      result = { status: 'not_found_or_not_visible' };
    else if (input.expectedRevision !== selection.contentRevision) result = { status: 'stale' };
    else {
      const checked = await verifier.revalidate(input.binding, execution);
      if (!('data' in checked)) result = checked;
      else {
        const data = boundedLessonProjection({ lessonTitle: checked.data.lessonTitle, moduleTitle: checked.data.moduleTitle,
          objectives: checked.data.objectives, originalSentence: selection.originalSentence,
          contentVersion: checked.data.scriptVersionNumber, segmentRef: selection.segmentRef,
          locale: selection.locale, sourceLocale: selection.sourceLocale });
        result = { status: data.truncatedFields.length ? 'partial' : 'ok', data, sourceRevision: checked.sourceRevision,
          sources: checked.sources.map(s => ({ ...s, completeness: data.truncatedFields.length ? 'partial' : 'complete' })) };
      }
    }
    emitTeachingTrace(trace, { kind: 'domain.read', operation: 'lesson', phase: 'completed', runId: execution.runId,
      at: new Date().toISOString(), status: result.status, ...('sources' in result ? { sources: result.sources } : {}) });
    return result;
  } };
}
