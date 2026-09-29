import 'server-only';
import { createHash } from 'node:crypto';
import { agentRequestSchema } from '../contracts/public.ts';
import type { AgentRequest } from '../contracts/public.ts';
import type { RunAuthority } from '../contracts/server.ts';
import { CoreError } from '../runtime/errors.ts';
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}
export function requestDigest(request: AgentRequest): string { return createHash('sha256').update(canonical(request)).digest('hex'); }
export function assertAuthority(authority: RunAuthority): void {
  if (!authority.actorId || !authority.tenantId || !authority.appId || !authority.scopeRef || !authority.membershipRole
    || !authority.policyVersion.name || !authority.policyVersion.version
    || !(Date.parse(authority.issuedAt) <= Date.now()) || !(Date.parse(authority.expiresAt) > Date.now())) throw new CoreError('FORBIDDEN');
}
export function parseIntake(input: unknown, authority: RunAuthority): AgentRequest {
  assertAuthority(authority);
  const parsed = agentRequestSchema.safeParse(input);
  if (!parsed.success) throw new CoreError('INVALID_REQUEST');
  if (canonical(parsed.data.scope) !== canonical(authority.scope)) throw new CoreError('FORBIDDEN');
  return parsed.data;
}
// For a missing locator, retries must derive the same new conversation, even across instances.
export function resolveConversationId(request: AgentRequest, authority: RunAuthority): string {
  if (request.conversationId) return request.conversationId;
  const hash = createHash('sha256').update(canonical([authority.tenantId, authority.actorId, request.agentCode, authority.scopeRef, request.idempotencyKey])).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
