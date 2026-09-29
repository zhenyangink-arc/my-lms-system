import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEVELOPMENT_BINDING as B } from './provisioning-contract.ts';
import type { ProvisioningWritePort } from './provisioning-contract.ts';

/** Owner caller creates the tenant; only server-side Admin handles the banned
 * Auth subject and bounded profile/membership writes. No returned Auth payload. */
export function createSupabaseProvisioningWriter(caller: SupabaseClient, admin: SupabaseClient): ProvisioningWritePort {
  const check = (error: unknown) => { if (error) throw Error('PROVISIONING_WRITE_UNKNOWN'); };
  return {
    async createTenant() {
      const { error } = await caller.rpc('create_tenant', { requested_name: 'Development domain execution', requested_slug: B.tenantAlias, requested_plan_key: 'starter' }); check(error);
    },
    async createInitiallyBannedActor(password) {
      const { error } = await admin.auth.admin.createUser({ email: B.email, password, email_confirm: true, ban_duration: B.banDuration,
        app_metadata: { human: false, production_allowed: false, purpose: B.actorAlias }, user_metadata: { full_name: 'Development execution actor' } }); check(error);
    },
    async deactivateProfile(actorId) { const { error } = await admin.from('profiles').update({ status: 'inactive' }).eq('id', actorId); check(error); },
    async createSuspendedMembership(actorId, tenantId) {
      const { error } = await admin.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: actorId, role: 'student', status: 'suspended', is_default: false }); check(error);
    },
  };
}
