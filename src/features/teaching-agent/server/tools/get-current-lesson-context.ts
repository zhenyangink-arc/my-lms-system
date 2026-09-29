import 'server-only';
import { z } from 'zod';
import type { ToolRegistration } from '../../../agent-core/contracts/tool.ts';
import { lessonToolRef } from '../../profiles/student-ai-teacher.ts';
import { safeDomainFailure } from '../selection/verify-student-selection.ts';
import { isBoundExecution, lessonInputSchema, lessonOutputSchema, type StudentToolBinding } from './contracts.ts';

export function createCurrentLessonContextTool(input: StudentToolBinding): ToolRegistration {
  return { definition: { ...lessonToolRef, status: 'enabled', riskLevel: 0,
    description: '读取本次 Run 已验证选句的已发布课程原句及目标。只读绑定 selection；不代表当前播放画面，不返回相邻讲解或其它片段。',
    inputSchema: z.toJSONSchema(lessonInputSchema), inputValidator: lessonInputSchema, outputValidator: lessonOutputSchema,
    requiredPermissions: ['teaching.content.read'], timeoutMs: 12000, maxResultBytes: 48000,
  }, executor: { async execute(args, context) {
    const parsed = lessonInputSchema.safeParse(args);
    if (!parsed.success || !isBoundExecution(input, context)) return { status: 'not_found_or_not_visible', code: 'READ_UNAVAILABLE' };
    try {
      const result = await input.domain.currentLesson.read({ binding: input.binding, ...parsed.data,
        expectedRevision: input.binding.selection.contentRevision, segmentBinding: 'verified_selection' }, context.authority, context);
      if (!('data' in result)) return { status: result.status, code: 'READ_UNAVAILABLE' };
      const d = result.data;
      const sourceRefs = result.sources.map(source => source.ref);
      const data = lessonOutputSchema.parse({
        lessonTitle: d.lessonTitle, moduleTitle: d.moduleTitle, originalSentence: d.originalSentence, objectives: d.objectives,
        contentVersion: d.contentVersion, segmentRef: d.segmentRef, locale: d.locale, sourceLocale: d.sourceLocale,
        omittedFields: d.omittedFields, truncatedFields: d.truncatedFields,
        revision: result.sourceRevision, asOf: result.sources[0]?.retrievedAt,
        completeness: result.status === 'partial' ? 'partial' : 'complete', truncated: d.truncatedFields.length > 0,
        evidenceRefs: [{ kind: 'lesson_sentence', sourceRef: d.segmentRef, revision: result.sourceRevision },
          ...(d.objectives.length ? [{ kind: 'learning_objectives', sourceRef: d.segmentRef, revision: result.sourceRevision }] : [])],
      });
      if (!sourceRefs.length || sourceRefs.some(ref => ref !== input.binding.selection.segmentRef)
        || data.segmentRef !== input.binding.selection.segmentRef || data.revision !== input.binding.selection.contentRevision)
        return { status: 'unavailable', code: 'READ_UNAVAILABLE' };
      return { status: result.status, data, sourceRefs };
    } catch (error) { return { ...safeDomainFailure(error), code: 'READ_UNAVAILABLE' }; }
  } } };
}
