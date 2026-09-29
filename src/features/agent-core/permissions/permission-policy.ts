import 'server-only';
import type { PermissionDecision, RunAuthority, VersionRef } from '../contracts/server.ts';
export interface PermissionPolicy {
  evaluate(authority: RunAuthority, action: { kind: 'run' | 'tool'; ref: VersionRef; requiredPermissions: readonly string[] }): Promise<PermissionDecision>;
}
export const denyAllPolicy: PermissionPolicy = { async evaluate() { return { effect: 'deny', code: 'DEFAULT_DENY' }; } };
export function decisionAllows(decision: PermissionDecision, authority: RunAuthority): boolean {
  return decision.effect === 'allow' && decision.scopeRef === authority.scopeRef
    && decision.policyVersion.name === authority.policyVersion.name
    && decision.policyVersion.version === authority.policyVersion.version
    && Date.parse(decision.expiresAt) > Date.now() && Date.parse(authority.expiresAt) > Date.now();
}
