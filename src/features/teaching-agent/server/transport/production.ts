import 'server-only';
import { getAuthContext } from '../../../../lib/auth';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { SupabaseAgentRepositories } from '../../../agent-core/persistence/supabase/repositories.ts';
import { SupabaseStudentTeachingReadRepository } from '../repositories/supabase-student-teaching-repository.ts';
import { createStudentAiTeacherRuntime } from '../runtime/create-student-ai-teacher-runtime.ts';
import { createStudentRunStore } from './run-store.ts';
import { createStudentTransportHandlers } from './student-handlers.ts';
import { activeRunAbortRegistry } from './active-run-abort-registry.ts';
import { studentTransportEnabled } from './transport-config.ts';
import { createStudentRolloutAdmission } from './rollout-policy.ts';
export const studentTransport = createStudentTransportHandlers({ enabled: studentTransportEnabled, registry: activeRunAbortRegistry,
 authenticate: async () => {
  const auth = await getAuthContext().catch(() => { throw new CoreError('FORBIDDEN'); });
  if (auth.status === 'unauthenticated') throw new CoreError('UNAUTHENTICATED');
  if (auth.status !== 'active' || !auth.tenant || auth.tenant.status !== 'active' || auth.tenant.role !== 'student') throw new CoreError('FORBIDDEN');
  const owner = { actorId: auth.user.id, tenantId: auth.tenant.id };
  const infrastructure = createAdminClient(), store = createStudentRunStore(infrastructure, owner);
  return { owner, store, allowAdmission: createStudentRolloutAdmission(auth.supabase, owner),
   runtime: createStudentAiTeacherRuntime({ authenticate: async () => owner,
   repository: new SupabaseStudentTeachingReadRepository(auth.supabase),
   persistence: authority => new SupabaseAgentRepositories(infrastructure, authority), checkCancellation: store.checkCancellation,
  }) };
 },
});
