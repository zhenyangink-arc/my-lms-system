import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRun } from '../../../agent-core/contracts/server.ts';
import { studentRunStatusSchema, type StudentRunStatus } from '../../../agent-core/contracts/transport.ts';
import { CoreError, publicErrorCode, safeMessage } from '../../../agent-core/runtime/errors.ts';
export interface RunOwner { actorId: string; tenantId: string }
export interface StudentRunStore {
 reserveSequence(runId: string): Promise<number>;
 status(runId: string): Promise<StudentRunStatus | null>;
 cancel(runId: string): Promise<'accepted' | 'already_terminal' | null>;
 checkCancellation(run: AgentRun): Promise<void>;
}
export function retryable(code: string) { return ['PROVIDER_UNAVAILABLE','DEADLINE_EXCEEDED','CONVERSATION_BUSY','PERSISTENCE_FAILED'].includes(code); }
/** Infrastructure-only client. This ownership reader never mints Domain authority. */
export function createStudentRunStore(client: SupabaseClient, owner: RunOwner): StudentRunStore {
 const params = { p_actor: owner.actorId, p_tenant: owner.tenantId };
 async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, { ...params, ...args });
  if (error) throw new CoreError(publicErrorCode(error.message));
  return data;
 }
 return {
  async reserveSequence(id) {
   const base = await rpc('reserve_student_agent_event_sequence_v1', { p_run: id });
   if (!Number.isSafeInteger(base) || base < 0) throw new CoreError('PERSISTENCE_FAILED');
   return base;
  },
  async status(id) {
   const row = await rpc('get_student_agent_run_status_v1', { p_run: id }); if (!row) return null;
   const code = publicErrorCode(row.failureCode);
   const result = studentRunStatusSchema.safeParse({ protocolVersion: 1, runId: row.runId, conversationId: row.conversationId,
    status: row.status, createdAt: row.createdAt, endedAt: row.endedAt ?? null,
    ...(row.status === 'completed' ? { finalAnswer: row.finalAnswer, sourceRefs: row.sourceRefs, completeness: row.completeness } : {}),
    ...(row.status === 'failed' ? { safeFailure: { code, safeMessage: safeMessage(code), retryable: retryable(code) } } : {}) });
   if (!result.success || (result.data.status === 'completed' && (!result.data.finalAnswer || !result.data.sourceRefs || !result.data.completeness))) throw new CoreError('PERSISTENCE_FAILED');
   return result.data;
  },
  async cancel(id) {
   const data = await rpc('request_agent_run_cancel_v1', { p_run: id }); if (!data) return null;
   if (data.result !== 'accepted' && data.result !== 'already_terminal') throw new CoreError('PERSISTENCE_FAILED');
   return data.result;
  },
  async checkCancellation(run) {
   if (run.actorId !== owner.actorId || run.tenantId !== owner.tenantId) throw new CoreError('FORBIDDEN');
   const cancelled = await rpc('check_agent_run_cancel_v1', { p_run: run.id, p_fence: run.fencingToken });
   if (cancelled === true) throw new CoreError('RUN_CANCELLED');
   if (cancelled !== false) throw new CoreError('PERSISTENCE_FAILED');
  },
 };
}
