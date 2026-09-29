import 'server-only';
import type { RuntimeExecutionContext, ContextSource } from '../../../agent-core/contracts/server.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import type { ReadProjection } from '../domain-ports/index.ts';
import { StudentTeachingPolicy, studentTeachingPolicyVersion } from '../policies/student-teaching-policy.ts';
import type { StudentContentRecord, StudentTeachingReadRepository } from '../repositories/contracts.ts';
import { emitTeachingTrace, type TeachingTraceSink } from '../context/trace.ts';
import { authoredLocale, selectionPins, teachingRef } from './references.ts';
import { studentSelectionLocatorSchema, type StudentSelectionLocator, type VerifiedStudentBinding } from './selection-types.ts';

export function safeDomainFailure(error: unknown): { status: 'unavailable' } {
  if (error instanceof CoreError && (error.code === 'RUN_CANCELLED' || error.code === 'DEADLINE_EXCEEDED')) throw error;
  return { status: 'unavailable' };
}
/** Runtime-local capabilities cannot be forged by JSON or transferred across requests. */
export class StudentSelectionVerifier {
  private readonly issued = new WeakMap<VerifiedStudentBinding, StudentSelectionLocator>();
  private readonly policy: StudentTeachingPolicy;
  private readonly repository: StudentTeachingReadRepository;
  private readonly trace?: TeachingTraceSink;
  constructor(policy: StudentTeachingPolicy, repository: StudentTeachingReadRepository, trace?: TeachingTraceSink) {
    this.policy = policy; this.repository = repository; this.trace = trace;
  }

  async verify(input: unknown, execution: RuntimeExecutionContext): Promise<ReadProjection<VerifiedStudentBinding>> {
    const parsed = studentSelectionLocatorSchema.safeParse(input);
    let result: ReadProjection<VerifiedStudentBinding>;
    if (!parsed.success) result = { status: 'not_found_or_not_visible' };
    else {
      // selectedText is deliberately discarded before authorization, hashing or tracing.
      const { selectedText: _hint, ...locator } = parsed.data;
      void _hint;
      try {
        const content = await this.policy.resolve(locator, execution);
        if (!content) result = { status: 'not_found_or_not_visible' };
        else {
          const pins = selectionPins(content, locator.locale, locator.segmentIndex);
          const session = locator.teachingSessionId ? await this.repository.readOwnSession(content.scope, execution) : null;
          if (locator.teachingSessionId && !session) result = { status: 'not_found_or_not_visible' };
          else if (content.scope.scriptVersionId !== locator.scriptVersionId || !pins
            || pins.expectedRevision !== locator.expectedRevision || pins.segmentRef !== locator.segmentRef
            || (session && session.scriptVersionId !== locator.scriptVersionId)) result = { status: 'stale' };
          else {
            const resolvedAt = new Date().toISOString();
            const sources: ContextSource[] = [{ ref: pins.segmentRef, provenance: 'verified_selection', privacyClass: 'tenant',
              revision: pins.expectedRevision, scopeRef: content.scope.scopeRef, retrievedAt: resolvedAt, completeness: 'complete' }];
            const binding: VerifiedStudentBinding = Object.freeze({
              scope: Object.freeze({ ...content.scope }),
              authority: Object.freeze({ actorId: content.scope.actorId, tenantId: content.scope.tenantId,
                appId: content.scope.appId, membershipRole: 'student', scopeRef: content.scope.scopeRef,
                scope: Object.freeze({ kind: 'lesson' as const, lessonId: locator.lessonId, moduleId: locator.moduleId,
                  ...(locator.teachingSessionId ? { teachingSessionId: locator.teachingSessionId } : {}) }),
                policyVersion: studentTeachingPolicyVersion, issuedAt: resolvedAt, expiresAt: execution.deadlineAt }),
              selection: Object.freeze({ binding: 'verified_selection' as const, lessonRef: teachingRef('lesson', locator.lessonId),
                moduleRef: teachingRef('module', locator.moduleId), scriptVersionRef: teachingRef('script', locator.scriptVersionId),
                nodeRef: teachingRef('node', locator.nodeId), segmentRef: pins.segmentRef, segmentIndex: locator.segmentIndex,
                locale: locator.locale, sourceLocale: authoredLocale(content.node!, locator.locale), originalSentence: pins.originalSentence,
                contentRevision: pins.expectedRevision, sourceRefs: Object.freeze([pins.segmentRef]), resolvedAt }),
              sources: Object.freeze(sources.map(source => Object.freeze(source))),
            });
            this.issued.set(binding, Object.freeze(locator));
            result = { status: 'ok', data: binding, sourceRevision: pins.expectedRevision, sources };
          }
        }
      } catch (error) { result = safeDomainFailure(error); }
    }
    emitTeachingTrace(this.trace, { kind: 'selection.verify', phase: 'completed', runId: execution.runId,
      at: new Date().toISOString(), status: result.status,
      ...('sources' in result ? { sources: result.sources } : {}) });
    return result;
  }

  async revalidate(binding: VerifiedStudentBinding, execution: RuntimeExecutionContext): Promise<ReadProjection<StudentContentRecord>> {
    const locator = this.issued.get(binding);
    if (!locator || Date.parse(binding.authority.expiresAt) <= Date.now()) return { status: 'not_found_or_not_visible' };
    try {
      // Re-read authorization and pinned content for every read; no cached decision.
      const content = await this.policy.resolve(locator, execution);
      if (!content) return { status: 'not_found_or_not_visible' };
      if (content.scope.actorId !== binding.authority.actorId || content.scope.tenantId !== binding.authority.tenantId
        || content.scope.scopeRef !== binding.scope.scopeRef) return { status: 'not_found_or_not_visible' };
      const pins = selectionPins(content, locator.locale, locator.segmentIndex);
      if (!pins || pins.expectedRevision !== locator.expectedRevision || pins.segmentRef !== locator.segmentRef) return { status: 'stale' };
      if (locator.teachingSessionId) {
        const session = await this.repository.readOwnSession(content.scope, execution);
        if (!session) return { status: 'not_found_or_not_visible' };
        if (session.scriptVersionId !== locator.scriptVersionId) return { status: 'stale' };
      }
      return { status: 'ok', data: content, sourceRevision: pins.expectedRevision,
        sources: binding.sources.map(source => ({ ...source, retrievedAt: new Date().toISOString() })) };
    } catch (error) { return safeDomainFailure(error); }
  }
}
