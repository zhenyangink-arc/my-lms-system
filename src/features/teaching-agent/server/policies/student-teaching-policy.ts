import 'server-only';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import { assertExecution } from '../../../agent-core/runtime/deadline.ts';
import type { StudentAuthentication, StudentContentRecord, StudentTeachingReadRepository } from '../repositories/contracts.ts';
import type { StudentSelectionLocator } from '../selection/selection-types.ts';
import { emitTeachingTrace, type TeachingTraceSink } from '../context/trace.ts';

export const studentTeachingPolicyVersion = Object.freeze({ name: 'student-teaching-read', version: '1.0.0' } as const);
export class StudentTeachingPolicy {
  private readonly authenticate: StudentAuthentication;
  private readonly repository: StudentTeachingReadRepository;
  private readonly trace?: TeachingTraceSink;
  constructor(authenticate: StudentAuthentication, repository: StudentTeachingReadRepository, trace?: TeachingTraceSink) {
    this.authenticate = authenticate; this.repository = repository; this.trace = trace;
  }

  /** Re-evaluate on every operation, including after an earlier successful selection. */
  async resolve(locator: StudentSelectionLocator, execution: RuntimeExecutionContext): Promise<StudentContentRecord | null> {
    assertExecution(execution.signal, execution.deadlineAt);
    const identity = await this.authenticate();
    let content: StudentContentRecord | null = null;
    if (identity?.actorId && identity.tenantId) {
      content = await this.repository.readAuthorizedContent(identity, locator, execution);
      if (content && locator.teachingSessionId) {
        const session = await this.repository.readOwnSession(content.scope, execution);
        if (!session) content = null;
        // A different persisted script is detected as stale by the validator.
      }
    }
    assertExecution(execution.signal, execution.deadlineAt);
    emitTeachingTrace(this.trace, { kind: 'policy.decision', phase: 'completed', runId: execution.runId,
      at: new Date().toISOString(), status: content ? 'ok' : 'not_found_or_not_visible' });
    return content;
  }
}
