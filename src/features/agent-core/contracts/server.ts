import 'server-only';
import type { AgentRequest, ScopeLocator, RunStatus } from './public.ts';
import type { ModelRef, ModelMessage } from './provider.ts';
export type VersionRef = Readonly<{ name: string; version: string }>;
export type RiskLevel = 0 | 1 | 2 | 3 | 4;
export type PrivacyClass = 'public' | 'tenant' | 'personal' | 'restricted';
export type Provenance = 'trusted_server' | 'trusted_database' | 'verified_selection' | 'client_untrusted' | 'synthetic';
/** A shape is NOT an authority capability. Only verified server intake + resource
 * authorization may issue this object. Never deserialize it from browser JSON. */
export interface RunAuthority {
  readonly actorId: string; readonly tenantId: string; readonly membershipRole: string;
  readonly appId: string; readonly scope: ScopeLocator; readonly scopeRef: string;
  readonly policyVersion: VersionRef; readonly issuedAt: string; readonly expiresAt: string;
}
export interface RunBudget {
  maxModelCalls: number; maxToolExecutions: number; maxInputTokensPerCall: number;
  maxOutputTokensPerCall: number; reservedTokens: number; usedModelCalls: number;
  usedToolExecutions: number; deadlineAt: string;
}
export interface AgentRun {
  id: string; conversationId: string; inputMessageId: string; actorId: string; tenantId: string;
  agentCode: string; scopeRef: string; definitionVersion: VersionRef; skillRef: VersionRef;
  status: RunStatus; stateVersion: number; fencingToken: string; executionAttempt: number;
  leaseExpiresAt: string; deadlineAt: string; budget: RunBudget; createdAt: string;
  retryOfRunId?: string;
}
export interface AgentProfile {
  agentCode: string; definitionVersion: VersionRef; status: 'published' | 'disabled';
  promptVersion: VersionRef; contextVersion: VersionRef;
  model: ModelRef; allowedSkillRefs: readonly VersionRef[]; allowedToolRefs: readonly VersionRef[];
  policyVersion: VersionRef; budget: Omit<RunBudget, 'usedModelCalls' | 'usedToolExecutions' | 'deadlineAt'>;
  artifacts?: ({ schemaVersion: 1; definitionDigest: string; personaRef: VersionRef; privateInstructionsRef: VersionRef;
    skillDigest: string; toolsDigest: string; completionPolicyRef: VersionRef; requiredEvidenceToolRef: VersionRef } | { schemaVersion: 2; definitionDigest:string;personaRef:VersionRef;privateInstructionsRef:VersionRef;skillDigest:string;toolsDigest:string;completionPolicyRef:VersionRef;requiredEvidence:readonly TypedEvidenceRequirement[] });
}
export interface ContextSource {
  ref: string; provenance: Provenance; privacyClass: PrivacyClass; revision: string;
  scopeRef: string; retrievedAt: string; completeness: 'complete' | 'partial' | 'unknown';
}
export interface ContextValue<T> { value: T; sourceRefs: string[]; provenance: Provenance }
// Core carries only an explicitly resolved projection; no Korean/database fields.
export interface CoreContext { snapshotId: string; sources: ContextSource[]; values: Record<string, ContextValue<unknown>> }
export interface RuntimeExecutionContext { runId: string; signal: AbortSignal; deadlineAt: string }
export interface ContextResolver { resolve(request: AgentRequest, authority: RunAuthority, execution: RuntimeExecutionContext): Promise<CoreContext> }
export interface PromptAssemblyPort {
  assemble(input: { request: AgentRequest; profile: AgentProfile; context: CoreContext; skill: VersionRef }): Promise<ModelMessage[]>;
}
export type PermissionDecision =
  | { effect: 'allow'; policyVersion: VersionRef; scopeRef: string; expiresAt: string }
  | { effect: 'deny'; code: string }
  | { effect: 'confirm'; code: 'UNSUPPORTED_CONFIRMATION' };

export interface TypedEvidenceRequirement { readonly kind:'lesson_context'|'durable_execution_facts';readonly toolRef:VersionRef }
