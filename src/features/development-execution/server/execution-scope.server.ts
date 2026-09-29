import 'server-only';
import { z } from 'zod';
import { requirePlatformOwner } from '@/lib/admin';
import { DEVELOPMENT_BINDING as B, actorIsSafe, snapshotSchema, type ProvisioningSnapshot } from './provisioning-contract.ts';
import { nativeActivityScopeSchema } from '../../smart-textbook-runtime/server/native-activity-binding.server.ts';
import { executionBindingSchema } from '../../smart-textbook-runtime/core/execution-contracts.ts';

export const SCENARIO = 'r7cb-b3-wrong-correct-recovery-1' as const;
export const B3_BUDGET = Object.freeze({ attemptInsert: 2, nodeInsert: 1, nodeUpdate: 1, otherWrites: 0, deletes: 0 });
export const executionScopeSchema = z.strictObject({
  contract: z.literal('development-domain-execution/1'), scenarioId: z.literal(SCENARIO),
  environment: z.literal(B.environment), databaseIdentity: z.literal(B.databaseIdentity),
  issuedAt: z.iso.datetime({ offset: true }), expiresAt: z.iso.datetime({ offset: true }),
  binding: executionBindingSchema, domain: nativeActivityScopeSchema,
  generation: z.number().int().nonnegative(), state: z.enum(['ACTIVE','DISABLED']),
  budget: z.strictObject({ attemptInsert:z.literal(2),nodeInsert:z.literal(1),nodeUpdate:z.literal(1),otherWrites:z.literal(0),deletes:z.literal(0) }),
});
export type ExecutionScope = z.infer<typeof executionScopeSchema>;
export function assertExecutionScope(value:unknown, now=Date.now(), mutation=true):ExecutionScope {
  const s=executionScopeSchema.parse(value),issued=Date.parse(s.issuedAt),expiry=Date.parse(s.expiresAt);
  if(issued>now || expiry<=issued || expiry-issued>15*60_000 || (mutation && (s.state!=='ACTIVE'||expiry<=now)))throw Error('EXECUTION_SCOPE_CLOSED');
  return s;
}
/** Fresh, server-only actor evidence, never global auth session counts. */
export function assertExecutionActor(raw:unknown,s:ExecutionScope,now=Date.now()):ProvisioningSnapshot {
  const v=snapshotSchema.parse(raw);
  const e={enabled:true,environment:s.environment,databaseIdentity:s.databaseIdentity,expiresAt:s.expiresAt};
  if(v.databaseIdentity!==s.databaseIdentity || !v.canonicalValid || Math.abs(now-Date.parse(v.observedAt))>5000 || v.actors.length!==1 || v.tenants.length!==1)throw Error('EXECUTION_BINDING_CHANGED');
  const a=v.actors[0],t=v.tenants[0],m=a.memberships[0];
  if(a.id!==s.domain.actorId || t.id!==s.domain.tenantId || t.alias!==B.tenantAlias || !actorIsSafe(a,e) || a.profile?.status!=='inactive' || a.memberships.length!==1 || !m || m.tenantId!==t.id || m.role!=='student' || m.status!=='suspended' || m.isDefault)throw Error('EXECUTION_ACTOR_UNSAFE');
  return v;
}
/** Issuance is owner-protected; fixed private activation configuration and DB
 * identity must already have been checked by the server composition. No JWT
 * is issued to the actor and no StudentPolicy admission is requested. */
export async function issueExecutionScope(candidate:unknown,read:()=>Promise<unknown>) {
  await requirePlatformOwner();
  const s=assertExecutionScope(candidate);assertExecutionActor(await read(),s);
  return Object.freeze(s);
}
