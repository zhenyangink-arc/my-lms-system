import 'server-only';
import { z } from 'zod';

export const DEVELOPMENT_BINDING = Object.freeze({
  environment: 'canonical-uply-development-8443',
  databaseIdentity: 'cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673',
  apiOriginSha256: 'ff8db3ba3da8be9b994619fb66af48143c9ea9236e6454d2c59705d7b3279ea3',
  tenantAlias: 'uply-domain-execution-dev',
  actorAlias: 'development-domain-execution',
  email: 'development-domain-execution@synthetic.invalid',
  banDuration: '876000h',
});
export type ProvisioningEnvironment = {
  enabled: boolean; environment: string; databaseIdentity: string;
  /** End of this provisioning authorization, NOT an attempt scope. */
  expiresAt: string;
};
const member = z.object({ tenantId: z.uuid(), role: z.string(), status: z.string(), isDefault: z.boolean() });
export const snapshotSchema = z.object({
  databaseIdentity: z.string(), observedAt: z.iso.datetime({ offset: true }), canonicalValid: z.boolean(),
  tenants: z.array(z.object({ id: z.uuid(), alias: z.string(), plan: z.string() })).max(2),
  actors: z.array(z.object({
    id: z.uuid(), email: z.string(), purpose: z.string().nullable(), human: z.boolean().nullable(),
    productionAllowed: z.boolean().nullable(), banUntil: z.iso.datetime({ offset: true }).nullable(),
    sessions: z.number().int().nonnegative(), refreshTokens: z.number().int().nonnegative(),
    identityCount: z.number().int().nonnegative(), emailIdentityCount: z.number().int().nonnegative(),
    provisionedProductionAccount: z.boolean(),
    profile: z.object({ role: z.string(), globalRole: z.string(), status: z.string() }).nullable(),
    memberships: z.array(member),
  })).max(2),
});
export type ProvisioningSnapshot = z.infer<typeof snapshotSchema>;
export type ProvisioningStage = 'TENANT' | 'ACTOR' | 'PROFILE' | 'MEMBERSHIP';
export type Classification = 'EMPTY' | 'PARTIAL' | 'COMPLETE' | 'INVALID' | 'UNKNOWN';
export type ProvisioningResult = {
  contract: 'development-domain-execution/1';
  status: 'CREATED' | 'EXISTING' | 'DENIED' | 'VERIFY_REQUIRED';
  classification: Classification; stage: ProvisioningStage | null;
  /** No IDs, credentials, login links or raw API errors cross the action boundary. */
  scope: 'DISABLED';
};
export type ProvisioningReadPort = { read(): Promise<unknown> };
/** Structural subset of the existing trusted transaction transport. No driver,
 * credentials or write operation is implemented by this read-only seam. */
export type ProvisioningReadOnlyTransport = { transaction(sql: string): Promise<unknown> };
export type ProvisioningWritePort = {
  createTenant(): Promise<void>; createInitiallyBannedActor(password: string): Promise<void>;
  deactivateProfile(actorId: string): Promise<void>;
  createSuspendedMembership(actorId: string, tenantId: string): Promise<void>;
};
export type ProvisioningJournal = {
  /** Atomic durable claim. A previous claim is never automatically released. */
  claim(): Promise<boolean>;
  dispatched(stage: ProvisioningStage): Promise<void>;
  finish(result: ProvisioningResult): Promise<void>;
};
export function assertEnvironment(e: ProvisioningEnvironment, now: number) {
  if (!e.enabled || e.environment !== DEVELOPMENT_BINDING.environment ||
      e.databaseIdentity !== DEVELOPMENT_BINDING.databaseIdentity ||
      !Number.isFinite(Date.parse(e.expiresAt)) || Date.parse(e.expiresAt) <= now ||
      Date.parse(e.expiresAt) > now + 30 * 60_000) throw Error('DEVELOPMENT_PROVISIONING_DENIED');
}
export function assertSnapshot(s: ProvisioningSnapshot, e: ProvisioningEnvironment, now: number) {
  assertEnvironment(e, now);
  if (s.databaseIdentity !== e.databaseIdentity || !s.canonicalValid ||
      Math.abs(now - Date.parse(s.observedAt)) > 30_000) throw Error('PROVISIONING_READBACK_INVALID');
}
export function actorIsSafe(a: ProvisioningSnapshot['actors'][number], e: ProvisioningEnvironment) {
  return a.email === DEVELOPMENT_BINDING.email && a.purpose === DEVELOPMENT_BINDING.actorAlias &&
    a.human === false && a.productionAllowed === false && a.banUntil !== null &&
    Date.parse(a.banUntil) > Date.parse(e.expiresAt) + 24 * 60 * 60_000 &&
    a.sessions === 0 && a.refreshTokens === 0 && a.identityCount === 1 && a.emailIdentityCount === 1 &&
    !a.provisionedProductionAccount && a.profile?.role === 'student' && a.profile.globalRole === 'member';
}
export function classify(s: ProvisioningSnapshot, e: ProvisioningEnvironment): Classification {
  if (s.tenants.length > 1 || s.actors.length > 1) return 'INVALID';
  if (!s.tenants.length && !s.actors.length) return 'EMPTY';
  const tenant = s.tenants[0], actor = s.actors[0];
  if (tenant && (tenant.alias !== DEVELOPMENT_BINDING.tenantAlias || tenant.plan !== 'starter')) return 'INVALID';
  if (actor && !actorIsSafe(actor, e)) return 'INVALID';
  if (tenant && actor && actor.profile?.status === 'inactive' && actor.memberships.length === 1) {
    const m = actor.memberships[0];
    return m.tenantId === tenant.id && m.role === 'student' && m.status === 'suspended' && !m.isDefault ? 'COMPLETE' : 'INVALID';
  }
  return 'PARTIAL';
}
