import 'server-only';
import { randomBytes } from 'node:crypto';
import { actorIsSafe, assertEnvironment, assertSnapshot, classify, snapshotSchema } from './provisioning-contract.ts';
import type { ProvisioningEnvironment, ProvisioningReadPort, ProvisioningWritePort, ProvisioningJournal, ProvisioningStage, ProvisioningResult, ProvisioningSnapshot } from './provisioning-contract.ts';

/** No admission, attempt scope, Agent, login, retry or compensating delete. */
export async function provisionDevelopmentExecution(input: {
  environment: ProvisioningEnvironment; reader: ProvisioningReadPort;
  writer: ProvisioningWritePort; journal: ProvisioningJournal; now?: () => number;
}): Promise<ProvisioningResult> {
  const { environment: e, reader, writer, journal } = input;
  const now = input.now ?? Date.now;
  let stage: ProvisioningStage | null = null;
  const result = (status: ProvisioningResult['status'], classification: ProvisioningResult['classification']): ProvisioningResult =>
    ({ contract: 'development-domain-execution/1', status, classification, stage, scope: 'DISABLED' });
  async function read() {
    const s = snapshotSchema.parse(await reader.read()); assertSnapshot(s, e, now()); return s;
  }
  let claimed = false;
  try { assertEnvironment(e, now()); } catch { return result('DENIED', 'UNKNOWN'); }
  try {
    assertEnvironment(e, now());
    const before = await read(), prior = classify(before, e);
    if (prior === 'COMPLETE') return result('EXISTING', prior);
    if (prior !== 'EMPTY') return result('VERIFY_REQUIRED', prior);
    claimed = await journal.claim();
    if (!claimed) return result('VERIFY_REQUIRED', classify(await read(), e));
    // Re-read AFTER the exclusive claim; aliases must still be absent.
    if (classify(await read(), e) !== 'EMPTY') throw Error('PROVISIONING_STATE_CHANGED');
    async function write(which: ProvisioningStage, operation: () => Promise<void>) {
      assertEnvironment(e, now()); stage = which;
      await journal.dispatched(which); // fsync precedes dispatch; unknown journal state never writes.
      assertEnvironment(e, now()); // Journal I/O cannot extend an expired authorization.
      await operation(); // Any error stops this invocation; NEVER retry or continue after readback.
      return read(); // Independent fresh read is authority, not mutation response.
    }
    const tenantState = await write('TENANT', () => writer.createTenant());
    if (tenantState.tenants.length !== 1 || tenantState.actors.length || classify(tenantState, e) !== 'PARTIAL') throw Error('TENANT_READBACK');
    const tenantId = tenantState.tenants[0].id;
    const actorState = await write('ACTOR', async () => {
      const password = randomBytes(36).toString('base64url');
      await writer.createInitiallyBannedActor(password); // Never journal, log or return the password.
    });
    function sameTenant(s: ProvisioningSnapshot) { return s.tenants.length === 1 && s.tenants[0].id === tenantId; }
    const actor = actorState.actors[0];
    if (!sameTenant(actorState) || actorState.actors.length !== 1 || !actor || !actorIsSafe(actor, e) || actor.memberships.length) throw Error('ACTOR_READBACK');
    const actorId = actor.id;
    const profileState = await write('PROFILE', () => writer.deactivateProfile(actorId));
    const inactive = profileState.actors[0];
    if (!sameTenant(profileState) || profileState.actors.length !== 1 || inactive?.id !== actorId ||
        !actorIsSafe(inactive, e) || inactive.profile?.status !== 'inactive' || inactive.memberships.length) throw Error('PROFILE_READBACK');
    const complete = await write('MEMBERSHIP', () => writer.createSuspendedMembership(actorId, tenantId));
    if (!sameTenant(complete) || complete.actors[0]?.id !== actorId || classify(complete, e) !== 'COMPLETE') throw Error('FINAL_READBACK');
    const out = result('CREATED', 'COMPLETE'); await journal.finish(out); return out;
  } catch {
    let real: ProvisioningResult['classification'] = 'UNKNOWN';
    try { real = classify(await read(), e); } catch { /* Remain UNKNOWN; never repeat writes. */ }
    const out = result(claimed ? 'VERIFY_REQUIRED' : 'DENIED', real);
    if (claimed) { try { await journal.finish(out); } catch { /* Existing durable claim remains closed. */ } }
    return out;
  }
}
