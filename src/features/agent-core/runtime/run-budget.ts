import 'server-only';
import type { RunBudget } from '../contracts/server.ts';
import { CoreError } from './errors.ts';
export function assertBudget(budget: RunBudget): void {
  for (const k of ['maxModelCalls', 'maxInputTokensPerCall', 'maxOutputTokensPerCall', 'reservedTokens'] as const)
    if (!Number.isSafeInteger(budget[k]) || budget[k] <= 0) throw new CoreError('BUDGET_UNAVAILABLE');
  for (const k of ['maxToolExecutions', 'usedModelCalls', 'usedToolExecutions'] as const)
    if (!Number.isSafeInteger(budget[k]) || budget[k] < 0) throw new CoreError('BUDGET_UNAVAILABLE');
  if (budget.reservedTokens < budget.maxModelCalls * (budget.maxInputTokensPerCall + budget.maxOutputTokensPerCall)) throw new CoreError('BUDGET_UNAVAILABLE');
}
export function consumeBudget(budget: RunBudget, kind: 'model' | 'tool'): RunBudget {
  assertBudget(budget);
  const used = kind === 'model' ? 'usedModelCalls' : 'usedToolExecutions';
  const limit = kind === 'model' ? budget.maxModelCalls : budget.maxToolExecutions;
  if (budget[used] >= limit) throw new CoreError('BUDGET_UNAVAILABLE');
  return { ...budget, [used]: budget[used] + 1 };
}
