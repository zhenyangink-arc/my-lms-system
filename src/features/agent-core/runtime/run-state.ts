import 'server-only';
import type { RunStatus } from '../contracts/public.ts';
import type { AgentRun } from '../contracts/server.ts';
import { CoreError } from './errors.ts';
export function isTerminalRunStatus(status: RunStatus): boolean { return ['completed', 'failed', 'cancelled'].includes(status); }
export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  const edges: Record<RunStatus, readonly RunStatus[]> = {
    created: ['running', 'failed', 'cancelled'], running: ['waiting_tool', 'completed', 'failed', 'cancelled'],
    waiting_tool: ['running', 'failed', 'cancelled'], waiting_confirmation: [], completed: [], failed: [], cancelled: [],
  };
  if (!edges[from]?.includes(to)) throw new CoreError('PERSISTENCE_FAILED');
}
export function transitionRun(run: AgentRun, to: RunStatus): AgentRun {
  assertRunTransition(run.status, to); return { ...run, status: to, stateVersion: run.stateVersion + 1 };
}
