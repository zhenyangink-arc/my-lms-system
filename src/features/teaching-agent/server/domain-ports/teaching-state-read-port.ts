import 'server-only';
import type { TeachingStateReadPort, TeachingStateProjection, ReadProjection } from './index.ts';
import { safeDomainFailure, type StudentSelectionVerifier } from '../selection/verify-student-selection.ts';
import type { StudentTeachingReadRepository } from '../repositories/contracts.ts';
import { selectionPins, teachingRef } from '../selection/references.ts';
import { emitTeachingTrace, type TeachingTraceSink } from '../context/trace.ts';

export function createTeachingStateReadPort(verifier: StudentSelectionVerifier,
  repository: StudentTeachingReadRepository, trace?: TeachingTraceSink): TeachingStateReadPort {
  return { async read(input, authority, execution) {
    let result: ReadProjection<TeachingStateProjection>;
    try {
      const binding = input.binding;
      if (!binding || authority !== binding.authority || !binding.scope.teachingSessionId
        || input.teachingSessionRef !== teachingRef('session', [binding.scope.tenantId, binding.scope.actorId, binding.scope.teachingSessionId])) {
        result = { status: 'not_found_or_not_visible' };
      } else if (input.expectedRevision !== binding.selection.contentRevision) result = { status: 'stale' };
      else {
        const checked = await verifier.revalidate(binding, execution);
        if (!('data' in checked)) result = checked;
        else {
          const session = await repository.readOwnSession(checked.data.scope, execution);
          if (!session) result = { status: 'not_found_or_not_visible' };
          else if (session.scriptVersionId !== checked.data.scope.scriptVersionId) result = { status: 'stale' };
          else {
            const node = session.nodeId ? await repository.readPublishedNode(checked.data.scope, session.nodeId, execution) : null;
            if (session.nodeId && !node) result = { status: 'stale' };
            else {
              const index = node && session.segmentNodeId === node.id && session.segmentIndex !== null && session.segmentIndex >= 0
                ? session.segmentIndex : null;
              const pins = node && index !== null ? selectionPins({ ...checked.data, node }, binding.scope.locale, index) : null;
              const phase = node && session.phaseNodeId === node.id
                && ['explanation', 'task', 'task_feedback', 'question'].includes(session.phase ?? '') ? session.phase! : 'unknown';
              const stateRevision = teachingRef('state', [session, node, checked.sourceRevision]);
              if (input.expectedStateRevision && input.expectedStateRevision !== stateRevision) result = { status: 'stale' };
              else {
                const partial = !pins || phase === 'unknown';
                const source = { ref: teachingRef('session', [binding.scope.tenantId, binding.scope.actorId, session.id]),
                  revision: stateRevision, provenance: 'trusted_database' as const, privacyClass: 'personal' as const,
                  scopeRef: binding.scope.scopeRef, retrievedAt: new Date().toISOString(), completeness: partial ? 'partial' as const : 'complete' as const };
                result = { status: partial ? 'partial' : 'ok', sourceRevision: stateRevision, sources: [source], data: {
                  semantic: 'last_saved_teaching_position', teachingSessionRef: source.ref,
                  scriptVersionRef: binding.selection.scriptVersionRef, nodeRef: node ? teachingRef('node', node.id) : null,
                  segmentRef: pins?.segmentRef ?? null, segmentIndex: pins ? index : null, phase, stateRevision, status: 'active',
                  omittedFields: ['requiredTask', 'fullTeachingState', 'gradingKeys', 'visualPlaybackPosition'],
                } };
              }
            }
          }
        }
      }
    } catch (error) { result = safeDomainFailure(error); }
    emitTeachingTrace(trace, { kind: 'domain.read', operation: 'state', phase: 'completed', runId: execution.runId,
      at: new Date().toISOString(), status: result.status, ...('sources' in result ? { sources: result.sources } : {}) });
    return result;
  } };
}
