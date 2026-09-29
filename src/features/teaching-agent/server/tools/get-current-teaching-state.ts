import 'server-only';
import { z } from 'zod';
import type { ToolRegistration } from '../../../agent-core/contracts/tool.ts';
import { stateToolRef } from '../../profiles/student-ai-teacher.ts';
import { teachingRef } from '../selection/references.ts';
import { safeDomainFailure } from '../selection/verify-student-selection.ts';
import { isBoundExecution, stateInputSchema, stateOutputSchema, type StudentToolBinding } from './contracts.ts';

export function createCurrentTeachingStateTool(input: StudentToolBinding): ToolRegistration {
  return { definition: { ...stateToolRef, status: 'enabled', riskLevel: 0,
    description: '读取本次 Run 绑定学生会话已持久化的最近课堂位置安全投影，semantic=last_saved_teaching_position；不是当前可见句子或当前播放位置。无 active session 时不可用。',
    inputSchema: z.toJSONSchema(stateInputSchema), inputValidator: stateInputSchema, outputValidator: stateOutputSchema,
    requiredPermissions: ['teaching.state.self.read'], timeoutMs: 12000, maxResultBytes: 8000,
  }, executor: { async execute(args, context) {
    if (!stateInputSchema.safeParse(args).success || !isBoundExecution(input, context)) return { status: 'not_found_or_not_visible', code: 'READ_UNAVAILABLE' };
    try {
      const scope = input.binding.scope;
      const ref = teachingRef('session', [scope.tenantId, scope.actorId, scope.teachingSessionId]);
      const result = await input.domain.teachingState.read({ binding: input.binding, teachingSessionRef: ref,
        expectedRevision: input.binding.selection.contentRevision }, context.authority, context);
      if (!('data' in result)) return { status: result.status, code: 'READ_UNAVAILABLE' };
      const d = result.data;
      const data = stateOutputSchema.parse({ semantic: d.semantic, teachingSessionRef: d.teachingSessionRef,
        scriptVersionRef: d.scriptVersionRef, lastSavedNodeRef: d.nodeRef, lastSavedSegmentRef: d.segmentRef,
        lastSavedSegmentIndex: d.segmentIndex, phase: d.phase, stateRevision: d.stateRevision, status: d.status, omissions: d.omittedFields,
        revision: result.sourceRevision, asOf: result.sources[0]?.retrievedAt,
        completeness: result.status === 'partial' ? 'partial' : 'complete', truncated: false,
        evidenceRefs: [{ kind: 'saved_teaching_state', sourceRef: ref, revision: result.sourceRevision }],
      });
      const sourceRefs = result.sources.map(source => source.ref);
      if (!sourceRefs.length || sourceRefs.some(source => source !== ref) || data.teachingSessionRef !== ref
        || data.scriptVersionRef !== input.binding.selection.scriptVersionRef || data.stateRevision !== data.revision)
        return { status: 'unavailable', code: 'READ_UNAVAILABLE' };
      return { status: result.status, data, sourceRefs };
    } catch (error) { return { ...safeDomainFailure(error), code: 'READ_UNAVAILABLE' }; }
  } } };
}
