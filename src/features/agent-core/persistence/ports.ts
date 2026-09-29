import 'server-only';
import type { AgentRequest, RunStatus } from '../contracts/public.ts';
import type { AgentProfile, AgentRun, RunAuthority, RunBudget, VersionRef } from '../contracts/server.ts';
import type { ProviderUsage } from '../contracts/provider.ts';
import type { TraceEvent } from '../observability/trace.ts';
export interface Admission { request: AgentRequest; authority: RunAuthority; conversationId: string; digest: string; profile: AgentProfile; skillRef: VersionRef; budget: RunBudget }
export interface Transition { run: AgentRun; to: RunStatus; budget: RunBudget; finalText?: string; reason?: string }
export interface AgentRunRepository {
  admitRun(input: Admission): Promise<{ run: AgentRun; replayed: boolean }>;
  getRun(id: string): Promise<AgentRun | null>;
  transitionRun(input: Transition): Promise<AgentRun>;
}
export interface ConversationRepository { getConversation(id: string): Promise<{ id: string; agentCode: string; scopeRef: string; status: string } | null> }
export interface AgentMessageRepository { listMessages(conversationId: string): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; state: string }>> }
export interface DefinitionRepository { getDefinition(ref: VersionRef): Promise<AgentProfile | null> }
export interface RunEventRepository { appendRunEvent(run: AgentRun, event: TraceEvent): Promise<void> }
export interface UsageRecord { runId: string; modelCallId: string; attemptIndex: number; provider: string; model: string; durationMs: number; usage: ProviderUsage }
export interface UsageRepository { persistUsage(run: AgentRun, record: UsageRecord): Promise<void> }
export type AgentPersistence = AgentRunRepository & RunEventRepository & UsageRepository;
