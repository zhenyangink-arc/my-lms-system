import 'server-only';
import { z } from 'zod';
import { agentRequestSchema, type RuntimeEvent } from '../../../agent-core/contracts/public.ts';
import type { RunAuthority } from '../../../agent-core/contracts/server.ts';
import type { AgentPersistence } from '../../../agent-core/persistence/ports.ts';
import type { ProviderAdapter } from '../../../agent-core/contracts/provider.ts';
import type { TraceSink } from '../../../agent-core/observability/trace.ts';
import { DeepSeekProviderAdapter } from '../../../agent-core/providers/deepseek/adapter.ts';
import { createDeadlineSignal, withSignal, assertExecution } from '../../../agent-core/runtime/deadline.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { createStudentDomainRuntime } from '../composition/create-student-domain-runtime.ts';
import type { StudentAuthentication, StudentTeachingReadRepository } from '../repositories/contracts.ts';
import { studentSelectionLocatorSchema } from '../selection/selection-types.ts';
import { pinStudentRuntimeDefinition, assertStudentModelCapabilities } from './student-runtime-definition.ts';
import { coordinateStudentRun } from './student-run-coordinator.ts';

const metadataSchema = z.object({ requestId: z.uuid(), receivedAt: z.iso.datetime() }).strict();
/** This factory is a trusted server seam: authenticate must be backed by AuthContext,
 * repository must be request-scoped. Browser input never supplies these dependencies.
 * Every execution creates a NEW verifier, remints authority and performs policy reads. */
export function createStudentAiTeacherRuntime(ports: {
  authenticate: StudentAuthentication; repository: StudentTeachingReadRepository;
  persistence: (authority: RunAuthority) => AgentPersistence;
  provider?: ProviderAdapter; trace?: TraceSink;
  checkCancellation?: (run: import('../../../agent-core/contracts/server.ts').AgentRun) => Promise<void>;
}) {
  return { async run(input: { request: unknown; selection: unknown; intent: unknown; metadata: unknown;
    signal: AbortSignal; onAdmitted?: (run: import('../../../agent-core/contracts/server.ts').AgentRun) => Promise<void>; emit?: (event: RuntimeEvent) => void }) {
    const metadata = metadataSchema.safeParse(input.metadata), request = agentRequestSchema.safeParse(input.request);
    const selection = studentSelectionLocatorSchema.safeParse(input.selection);
    if (!metadata.success || !request.success || !selection.success || (input.intent !== 'explain_segment' && input.intent !== 'summarize_execution')
      || request.data.agentCode !== 'student-ai-teacher' || request.data.scope.kind !== 'lesson') throw new CoreError('INVALID_REQUEST');
    const received = Date.parse(metadata.data.receivedAt);
    if (received > Date.now()) throw new CoreError('INVALID_REQUEST');
    const deadlineAt = new Date(received + 45000).toISOString();
    const deadline = createDeadlineSignal(input.signal, deadlineAt);
    try {
      const execution = { runId: metadata.data.requestId, deadlineAt, signal: deadline.signal };
      const definition = pinStudentRuntimeDefinition(undefined,input.intent), provider = ports.provider ?? new DeepSeekProviderAdapter();
      assertStudentModelCapabilities(provider, definition);
      const domain = createStudentDomainRuntime({ authenticate: ports.authenticate, repository: ports.repository });
      // Auth -> complete StudentPolicy -> scope -> minted authority + verified selection.
      const verified = await withSignal(domain.selection.verify(selection.data, execution), execution.signal);
      if (!('data' in verified)) throw new CoreError('FORBIDDEN');
      assertExecution(execution.signal, deadlineAt);
      return await coordinateStudentRun({ request: request.data, binding: verified.data, domain, definition, execution,
        persistence: ports.persistence(verified.data.authority), provider, trace: ports.trace, emit: input.emit, onAdmitted: input.onAdmitted, checkCancellation: ports.checkCancellation });
    } finally { deadline.dispose(); }
  } };
}
