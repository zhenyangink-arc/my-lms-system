import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createDeadlineSignal, withSignal } from '../../../agent-core/runtime/deadline.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { getAuthContext } from '../../../../lib/auth';
import { SupabaseAgentRepositories } from '../../../agent-core/persistence/supabase/repositories.ts';
import { SupabaseStudentTeachingReadRepository } from '../repositories/supabase-student-teaching-repository.ts';
import { createStudentAiTeacherRuntime } from './create-student-ai-teacher-runtime.ts';

/** Future transport calls this server factory with its infrastructure-only DB client.
 * It creates no endpoint and grants that client no teaching-domain read capability. */
export function createAuthenticatedStudentAiTeacherRuntime(agentPersistenceClient: SupabaseClient) {
  return { async run(input: Parameters<ReturnType<typeof createStudentAiTeacherRuntime>['run']>[0]) {
    const metadata = z.object({ requestId: z.uuid(), receivedAt: z.iso.datetime() }).strict().safeParse(input.metadata);
    if (!metadata.success || Date.parse(metadata.data.receivedAt) > Date.now()) throw new CoreError('INVALID_REQUEST');
    const deadline = createDeadlineSignal(input.signal, new Date(Date.parse(metadata.data.receivedAt) + 45000).toISOString());
    try {
      const auth = await withSignal(getAuthContext(), deadline.signal);
      return await createStudentAiTeacherRuntime({
      repository: new SupabaseStudentTeachingReadRepository(auth.supabase),
      authenticate: async () => {
        if (auth.status !== 'active' || !auth.tenant || auth.tenant.status !== 'active' || auth.tenant.role !== 'student') return null;
        return { actorId: auth.user.id, tenantId: auth.tenant.id };
      },
      persistence: authority => new SupabaseAgentRepositories(agentPersistenceClient, authority),
      }).run(input);
    } finally { deadline.dispose(); }
  } };
}
