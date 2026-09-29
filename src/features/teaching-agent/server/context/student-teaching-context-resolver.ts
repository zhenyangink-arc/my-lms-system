import 'server-only';
import { randomUUID } from 'node:crypto';
import type { ContextResolver, CoreContext, ContextSource, RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import type { CurrentLessonReadPort, ReadProjection, TeachingStateReadPort } from '../domain-ports/index.ts';
import type { VerifiedStudentBinding } from '../selection/selection-types.ts';
import { teachingRef } from '../selection/references.ts';
import { emitTeachingTrace, type TeachingTraceSink } from './trace.ts';

export class StudentTeachingContextResolver {
  private readonly lessonPort: CurrentLessonReadPort;
  private readonly statePort: TeachingStateReadPort;
  private readonly trace?: TeachingTraceSink;
  constructor(lessonPort: CurrentLessonReadPort, statePort: TeachingStateReadPort, trace?: TeachingTraceSink) {
    this.lessonPort = lessonPort; this.statePort = statePort; this.trace = trace;
  }

  async resolveBinding(binding: VerifiedStudentBinding, execution: RuntimeExecutionContext): Promise<ReadProjection<CoreContext>> {
    emitTeachingTrace(this.trace, { kind: 'context.resolve', phase: 'started', runId: execution.runId, at: new Date().toISOString() });
    const finish = (result: ReadProjection<CoreContext>) => {
      emitTeachingTrace(this.trace, { kind: 'context.resolve', phase: 'completed', runId: execution.runId,
        at: new Date().toISOString(), status: result.status, ...('sources' in result ? { sources: result.sources } : {}) });
      return result;
    };
    const selection = binding.selection;
    const lesson = await this.lessonPort.read({ binding, lessonRef: selection.lessonRef, segmentRef: selection.segmentRef,
      expectedRevision: selection.contentRevision, segmentBinding: 'verified_selection' }, binding.authority, execution);
    if (!('data' in lesson)) return finish(lesson);
    const state = binding.scope.teachingSessionId ? await this.statePort.read({ binding,
      teachingSessionRef: teachingRef('session', [binding.scope.tenantId, binding.scope.actorId, binding.scope.teachingSessionId]),
      expectedRevision: selection.contentRevision }, binding.authority, execution) : null;
    if (state && !('data' in state)) return finish(state);
    const identitySource: ContextSource = { ref: teachingRef('identity', [binding.scope.scopeRef, binding.authority.policyVersion]),
      revision: teachingRef('policy', binding.authority.policyVersion), provenance: 'trusted_server', privacyClass: 'personal',
      scopeRef: binding.scope.scopeRef, retrievedAt: new Date().toISOString(), completeness: 'partial' };
    const sources = [identitySource, ...lesson.sources, ...(state?.sources ?? [])];
    const values: CoreContext['values'] = {
      identity: { value: { role: 'student', relationship: 'self' }, provenance: 'trusted_server', sourceRefs: [identitySource.ref] },
      scope: { value: { courseRef: teachingRef('course', binding.scope.courseId), lessonRef: selection.lessonRef,
        moduleRef: selection.moduleRef }, provenance: 'trusted_database', sourceRefs: [identitySource.ref, ...selection.sourceRefs] },
      selection: { value: { binding: 'verified_selection', nodeRef: selection.nodeRef, scriptVersionRef: selection.scriptVersionRef,
        segmentIndex: selection.segmentIndex, contentRevision: selection.contentRevision, ...lesson.data },
      provenance: 'verified_selection', sourceRefs: [...selection.sourceRefs] },
      snapshot: { value: { resolvedAt: new Date().toISOString(), persisted: false,
        omittedFields: ['profile', 'grades', 'progress', 'teacher', 'assignment', 'clientSelectedText',
          ...(!state ? ['teachingState'] : [])] }, provenance: 'trusted_server', sourceRefs: sources.map(source => source.ref) },
    };
    if (state) values.teachingState = { value: state.data, provenance: 'trusted_database', sourceRefs: state.sources.map(source => source.ref) };
    return finish({ status: lesson.status === 'partial' || state?.status === 'partial' ? 'partial' : 'ok',
      data: { snapshotId: randomUUID(), sources, values }, sources, sourceRevision: selection.contentRevision });
  }

  /** Bound Core adapter; request hints cannot replace a previously verified locator. */
  forBinding(binding: VerifiedStudentBinding): ContextResolver {
    return { resolve: async (request, authority, execution) => {
      if (authority !== binding.authority || request.scope.kind !== 'lesson'
        || request.scope.lessonId !== binding.scope.lessonId || request.scope.moduleId !== binding.scope.moduleId
        || request.scope.teachingSessionId !== binding.scope.teachingSessionId
        || (request.clientContext?.locale && request.clientContext.locale !== binding.scope.locale)) throw new CoreError('FORBIDDEN');
      const result = await this.resolveBinding(binding, execution);
      if (!('data' in result)) throw new CoreError(result.status === 'unavailable' ? 'PERSISTENCE_FAILED' : 'FORBIDDEN');
      return result.data;
    } };
  }
}
