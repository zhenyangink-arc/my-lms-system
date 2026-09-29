import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AgentProfile, AgentRun, RunAuthority, VersionRef } from '../../contracts/server.ts';
import type { Admission, AgentPersistence, ConversationRepository, AgentMessageRepository, DefinitionRepository, Transition, UsageRecord } from '../ports.ts';
import type { TraceEvent } from '../../observability/trace.ts';
import { traceMetadata } from '../../observability/trace.ts';
import { assertAuthority, canonical } from '../../conversation/scope.ts';
import { CoreError } from '../../runtime/errors.ts';
import type { CoreErrorCode } from '../../contracts/public.ts';
const ref = z.object({ name: z.string(), version: z.string() }).strict();
const budget = z.object({ maxModelCalls: z.number().int().positive(), maxToolExecutions: z.number().int().nonnegative(),
  maxInputTokensPerCall: z.number().int().positive(), maxOutputTokensPerCall: z.number().int().positive(), reservedTokens: z.number().int().positive() }).strict();
const profileSchema = z.object({ agentCode: z.string(), definitionVersion: ref, status: z.enum(['published','disabled']),
  promptVersion: ref, contextVersion: ref,
  model: z.object({ provider: z.string(), model: z.string(), configVersion: z.string() }).strict(),
  allowedSkillRefs: z.array(ref), allowedToolRefs: z.array(ref), policyVersion: ref, budget,
  artifacts:z.union([
    z.object({schemaVersion:z.literal(1),definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),personaRef:ref,privateInstructionsRef:ref,skillDigest:z.string().regex(/^[a-f0-9]{64}$/),toolsDigest:z.string().regex(/^[a-f0-9]{64}$/),completionPolicyRef:ref,requiredEvidenceToolRef:ref}).strict(),
    z.object({schemaVersion:z.literal(2),definitionDigest:z.string().regex(/^[a-f0-9]{64}$/),personaRef:ref,privateInstructionsRef:ref,skillDigest:z.string().regex(/^[a-f0-9]{64}$/),toolsDigest:z.string().regex(/^[a-f0-9]{64}$/),completionPolicyRef:ref,requiredEvidence:z.array(z.object({kind:z.enum(['lesson_context','durable_execution_facts']),toolRef:ref}).strict()).min(1).max(8)}).strict()
  ]).optional() }).strict();
const runSchema = z.object({ id: z.string().uuid(), conversationId: z.string().uuid(), inputMessageId: z.string().uuid(),
  actorId: z.string().uuid(), tenantId: z.string().uuid(), agentCode: z.string(), scopeRef: z.string(), definitionVersion: ref, skillRef: ref,
  status: z.enum(['created','running','waiting_tool','completed','failed','cancelled']), stateVersion: z.number().int().positive(),
  fencingToken: z.string().uuid(), executionAttempt: z.number().int().positive(), leaseExpiresAt: z.string(), deadlineAt: z.string(),
  budget: budget.extend({ usedModelCalls: z.number().int().nonnegative(), usedToolExecutions: z.number().int().nonnegative(), deadlineAt: z.string() }), createdAt: z.string() });
const known: CoreErrorCode[] = ['FORBIDDEN','RUN_CANCELLED','RUN_NOT_FOUND','CONVERSATION_BUSY','IDEMPOTENCY_CONFLICT','BUDGET_UNAVAILABLE','PERSISTENCE_FAILED','DEADLINE_EXCEEDED','INVALID_REQUEST','REQUIRED_EVIDENCE_MISSING','SKILL_OUTPUT_INVALID'];
function databaseError(error: { message: string } | null): void {
  if (error) throw new CoreError(known.find((code) => error.message === code) ?? 'PERSISTENCE_FAILED');
}
/** Bind once in trusted server intake. Does not grant teaching/app permissions.
 * No admin client or query(table) escapes this repository. */
export class SupabaseAgentRepositories implements AgentPersistence, ConversationRepository, AgentMessageRepository, DefinitionRepository {
  private readonly client: SupabaseClient;
  private readonly authority: RunAuthority;
  constructor(client: SupabaseClient, authority: RunAuthority) { assertAuthority(authority); this.client = client; this.authority = structuredClone(authority); }
  // An authority valid at admission may expire mid-call. Fenced stop/accounting
  // cleanup must remain possible; this never permits another model or domain read.
  private params(cleanup = false) { if (!cleanup) assertAuthority(this.authority); return { p_tenant: this.authority.tenantId, p_actor: this.authority.actorId }; }
  private checkedRun(value: unknown): AgentRun {
    const result = runSchema.safeParse(value); if (!result.success) throw new CoreError('PERSISTENCE_FAILED');
    const run = result.data;
    if (run.actorId !== this.authority.actorId || run.tenantId !== this.authority.tenantId || run.scopeRef !== this.authority.scopeRef) throw new CoreError('FORBIDDEN');
    return run;
  }
  async admitRun(input: Admission) {
    if (canonical(input.authority) !== canonical(this.authority)) throw new CoreError('FORBIDDEN');
    const definition = await this.getDefinition(input.profile.definitionVersion);
    if (!definition || canonical(definition) !== canonical(input.profile)) throw new CoreError('FORBIDDEN');
    const { data, error } = await this.client.rpc('admit_agent_run_v1', { ...this.params(),
      p_conversation: input.conversationId, p_agent: input.request.agentCode, p_app: this.authority.appId,
      p_scope_kind: this.authority.scope.kind, p_scope_ref: this.authority.scopeRef, p_key: input.request.idempotencyKey,
      p_digest: input.digest, p_message: input.request.message, p_definition_version: input.profile.definitionVersion.version,
      p_skill: input.skillRef, p_budget: input.budget, p_deadline: input.budget.deadlineAt });
    databaseError(error);
    if (!data || typeof data.replayed !== 'boolean') throw new CoreError('PERSISTENCE_FAILED');
    return { run: this.checkedRun(data.run), replayed: data.replayed as boolean };
  }
  async getRun(id: string) {
    this.params();
    const { data, error } = await this.client.from('agent_runs').select('*').eq('id', id).eq('tenant_id', this.authority.tenantId).eq('actor_id', this.authority.actorId).eq('scope_ref', this.authority.scopeRef).maybeSingle();
    databaseError(error); if (!data) return null;
    return this.checkedRun({ id: data.id, conversationId: data.conversation_id, inputMessageId: data.input_message_id,
      actorId: data.actor_id, tenantId: data.tenant_id, agentCode: data.agent_code, scopeRef: data.scope_ref,
      definitionVersion: { name: data.agent_code, version: data.profile_version }, skillRef: data.skill_ref,
      status: data.status, stateVersion: data.state_version, fencingToken: data.fencing_token, executionAttempt: data.execution_attempt,
      leaseExpiresAt: data.lease_expires_at, deadlineAt: data.deadline_at, budget: data.budget, createdAt: data.created_at });
  }
  async transitionRun(input: Transition) {
    this.checkedRun(input.run);
    const { data, error } = await this.client.rpc('transition_agent_run_v1', { ...this.params(input.to === 'failed' || input.to === 'cancelled'), p_run: input.run.id,
      p_expected_status: input.run.status, p_expected_version: input.run.stateVersion, p_fence: input.run.fencingToken,
      p_to: input.to, p_budget: input.budget, p_final: input.finalText ?? null, p_reason: input.reason ?? null });
    databaseError(error); return this.checkedRun(data);
  }
  async appendRunEvent(run: AgentRun, event: TraceEvent) {
    this.checkedRun(run);
    if (event.runId !== run.id) throw new CoreError('FORBIDDEN');
    const extended = Boolean(event.details) || ['tool.requested','evidence.checked','output.checked','definition.pinned','prompt.assembled','run.failure'].includes(event.kind);
    const { error } = await this.client.rpc(extended ? 'append_agent_run_event_v2' : 'append_agent_run_event_v1', {
      ...this.params(event.kind === 'run.failure'), p_run: run.id, p_version: run.stateVersion, p_fence: run.fencingToken, p_event: traceMetadata(event) }); databaseError(error);
  }
  async persistUsage(run: AgentRun, record: UsageRecord) {
    this.checkedRun(run); if (record.runId !== run.id) throw new CoreError('FORBIDDEN');
    const { error } = await this.client.rpc('record_agent_usage_v1', { ...this.params(true), p_run: run.id, p_version: run.stateVersion, p_fence: run.fencingToken, p_record: record }); databaseError(error);
  }
  async getConversation(id: string) {
    this.params();
    const { data, error } = await this.client.from('agent_conversations').select('id,agent_code,scope_ref,status').eq('id', id).eq('tenant_id', this.authority.tenantId).eq('actor_id', this.authority.actorId).eq('scope_ref', this.authority.scopeRef).maybeSingle();
    databaseError(error); return data ? { id: String(data.id), agentCode: String(data.agent_code), scopeRef: String(data.scope_ref), status: String(data.status) } : null;
  }
  async listMessages(conversationId: string) {
    if (!await this.getConversation(conversationId)) return [];
    const { data, error } = await this.client.from('agent_messages').select('id,role,content,state').eq('conversation_id', conversationId).eq('tenant_id', this.authority.tenantId).eq('actor_id', this.authority.actorId).order('created_at', { ascending: false }).limit(40);
    databaseError(error);
    return z.array(z.object({ id: z.string(), role: z.enum(['user','assistant']), content: z.string(), state: z.string() })).parse(data ?? []).reverse();
  }
  async getDefinition(version: VersionRef): Promise<AgentProfile | null> {
    this.params();
    const { data, error } = await this.client.from('agent_definition_versions').select('manifest').eq('tenant_id', this.authority.tenantId).eq('agent_code', version.name).eq('version', version.version).eq('status', 'published').maybeSingle();
    databaseError(error); if (!data) return null;
    const parsed = profileSchema.safeParse(data.manifest); if (!parsed.success) throw new CoreError('PERSISTENCE_FAILED');
    if (canonical(parsed.data.definitionVersion) !== canonical(version) || parsed.data.agentCode !== version.name) throw new CoreError('PERSISTENCE_FAILED');
    return parsed.data;
  }
}
