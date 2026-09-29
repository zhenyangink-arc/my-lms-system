import 'server-only';
import { getAuthContext } from '../../../../lib/auth';
import { SupabaseStudentTeachingReadRepository } from '../repositories/supabase-student-teaching-repository.ts';
import { createStudentDomainRuntime } from './create-student-domain-runtime.ts';
import type { TeachingTraceSink } from '../context/trace.ts';

/** Request-local; never cache a runtime across users. No route or product UI in 1A. */
export async function createAuthenticatedStudentDomain(trace?: TeachingTraceSink) {
  const auth = await getAuthContext();
  return createStudentDomainRuntime({
    repository: new SupabaseStudentTeachingReadRepository(auth.supabase), trace,
    authenticate: async () => {
      // Repository additionally re-reads current profile, membership and tenant on every operation.
      if (auth.status !== 'active' || !auth.tenant || auth.tenant.status !== 'active'
        || auth.tenant.role !== 'student') return null;
      return { actorId: auth.user.id, tenantId: auth.tenant.id };
    },
  });
}
