import 'server-only';
import type { RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import { createDeadlineSignal, withSignal } from '../../../agent-core/runtime/deadline.ts';
import type { StudentAuthentication, StudentTeachingReadRepository } from '../repositories/contracts.ts';
import { StudentTeachingPolicy } from '../policies/student-teaching-policy.ts';
import { StudentSelectionVerifier } from '../selection/verify-student-selection.ts';
import { createCurrentLessonReadPort } from '../domain-ports/current-lesson-read-port.ts';
import { createTeachingStateReadPort } from '../domain-ports/teaching-state-read-port.ts';
import { StudentTeachingContextResolver } from '../context/student-teaching-context-resolver.ts';
import type { TeachingTraceSink } from '../context/trace.ts';

/** Trusted server composition seam. Tests inject only synthetic identity/data. */
export function createStudentDomainRuntime(input: {
  authenticate: StudentAuthentication; repository: StudentTeachingReadRepository; trace?: TeachingTraceSink;
}) {
  const policy = new StudentTeachingPolicy(input.authenticate, input.repository, input.trace);
  const selection = new StudentSelectionVerifier(policy, input.repository, input.trace);
  const currentLesson = createCurrentLessonReadPort(selection, input.trace);
  const teachingState = createTeachingStateReadPort(selection, input.repository, input.trace);
  const context = new StudentTeachingContextResolver(currentLesson, teachingState, input.trace);
  return {
    policy, selection, currentLesson, teachingState, context,
    async resolve(locator: unknown, execution: RuntimeExecutionContext) {
      const deadline = createDeadlineSignal(execution.signal, execution.deadlineAt);
      const boundedExecution = { ...execution, signal: deadline.signal };
      try {
        return await withSignal((async () => {
          const verified = await selection.verify(locator, boundedExecution);
          if (!('data' in verified)) return verified;
          return context.resolveBinding(verified.data, boundedExecution);
        })(), deadline.signal);
      } finally { deadline.dispose(); }
    },
  };
}
