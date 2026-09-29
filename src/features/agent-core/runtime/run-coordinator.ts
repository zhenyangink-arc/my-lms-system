import 'server-only';
import { randomUUID } from 'node:crypto';
import type { RuntimeEvent, RuntimeEventPayload } from '../contracts/public.ts';
import type { AgentProfile, AgentRun, ContextResolver, PromptAssemblyPort, RunAuthority, VersionRef } from '../contracts/server.ts';
import type { ProviderAdapter, ProviderResponse, ProviderUsage } from '../contracts/provider.ts';
import type { SkillRegistry } from '../contracts/skill.ts';
import type { ToolRegistry } from '../contracts/tool.ts';
import type { AgentPersistence } from '../persistence/ports.ts';
import type { PermissionPolicy } from '../permissions/permission-policy.ts';
import { decisionAllows } from '../permissions/permission-policy.ts';
import { resolveAllowedToolDefinitions } from '../permissions/tool-policy.ts';
import { requireSkill, versionKey } from '../skills/registry.ts';
import { executeAllowedTool } from '../tools/executor.ts';
import { parseIntake, requestDigest, resolveConversationId } from '../conversation/scope.ts';
import { assertBudget, consumeBudget } from './run-budget.ts';
import { assertExecution, createDeadlineSignal, withSignal } from './deadline.ts';
import { CoreError, errorCode, safeMessage } from './errors.ts';
import { createEventFactory } from '../observability/events.ts';
import { noopLogger, noopTraceSink, traceMetadata } from '../observability/trace.ts';
import type { StructuredLogger, TraceEvent, TraceSink } from '../observability/trace.ts';
export interface CoordinatorPorts {
  persistence: AgentPersistence; policy: PermissionPolicy; skills: SkillRegistry; tools: ToolRegistry;
  provider: ProviderAdapter; context: ContextResolver; prompt: PromptAssemblyPort;
  trace?: TraceSink; logger?: StructuredLogger;
}
/** Server composition only; no product route, auth/cookies, DB entity, or registered business Tool. */
export async function coordinateRun(ports: CoordinatorPorts, input: { request: unknown; authority: RunAuthority; profile: AgentProfile; skillRef: VersionRef; signal: AbortSignal; emit: (event: RuntimeEvent) => void }): Promise<{ run: AgentRun; replayed: boolean }> {
  const request = parseIntake(input.request, input.authority);
  const profile = structuredClone(input.profile); const authority = structuredClone(input.authority);
  if (profile.status !== 'published' || profile.agentCode !== request.agentCode || versionKey(profile.policyVersion) !== versionKey(authority.policyVersion)
    || !profile.allowedSkillRefs.some((ref) => versionKey(ref) === versionKey(input.skillRef))) throw new CoreError('FORBIDDEN');
  const skill = requireSkill(ports.skills, input.skillRef);
  const deadlineAt = new Date(Math.min(Date.now() + 45_000, Date.parse(authority.expiresAt))).toISOString();
  assertExecution(input.signal, deadlineAt);
  if (!decisionAllows(await ports.policy.evaluate(authority, { kind: 'run', ref: profile.definitionVersion, requiredPermissions: [] }), authority)) throw new CoreError('FORBIDDEN');
  const initialBudget = { ...profile.budget, usedModelCalls: 0, usedToolExecutions: 0, deadlineAt }; assertBudget(initialBudget);
  assertExecution(input.signal, deadlineAt);
  const admission = await ports.persistence.admitRun({ request, authority, conversationId: resolveConversationId(request, authority), digest: requestDigest(request), profile, skillRef: input.skillRef, budget: initialBudget });
  if (admission.replayed) return admission; // Never call a model again for an idempotent replay.
  let run = admission.run; let budget = { ...run.budget }; let finalText = ''; let allReported = true;
  const makeEvent = createEventFactory(run.id); const skillRunId = randomUUID();
  // A disconnected consumer cannot prevent terminal persistence. No callbacks get raw traces.
  const emit = (event: RuntimeEventPayload) => { try { input.emit(makeEvent(event)); } catch { /* transport detached */ } };
  const trace = async (kind: TraceEvent['kind'], links: Pick<TraceEvent, 'modelCallId' | 'toolCallId' | 'contextSnapshotId'> = {}) => {
    const event = traceMetadata({ kind, runId: run.id, at: new Date().toISOString(), skillRunId, ...links });
    await ports.persistence.appendRunEvent(run, event);
    await (ports.trace ?? noopTraceSink).write(event);
  };
  const move = async (to: AgentRun['status'], text?: string, reason?: string) => {
    run = await ports.persistence.transitionRun({ run, to, budget, ...(text !== undefined ? { finalText: text } : {}), ...(reason ? { reason } : {}) });
  };
  let deadline: ReturnType<typeof createDeadlineSignal> | undefined;
  try {
    deadline = createDeadlineSignal(input.signal, run.deadlineAt);
    const execution = { runId: run.id, signal: deadline.signal, deadlineAt: run.deadlineAt };
    await move('running'); emit({ type: 'run.started', conversationId: run.conversationId }); await trace('run.started'); await trace('permission.checked');
    emit({ type: 'run.status', phase: 'resolving_context' });
    const context = await withSignal(ports.context.resolve(request, authority, execution), execution.signal);
    await trace('context.resolved', { contextSnapshotId: context.snapshotId }); await trace('skill.selected');
    const visible = await withSignal(resolveAllowedToolDefinitions(profile, skill, authority, ports.tools, ports.policy), execution.signal);
    const messages = await withSignal(ports.prompt.assemble({ request, profile, context, skill: input.skillRef }), execution.signal);
    const seenCallIds = new Set<string>();
    while (true) {
      assertExecution(execution.signal, execution.deadlineAt);
      const modelRequest = { model: profile.model, messages, tools: visible.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })), toolChoice: 'auto' as const, maxOutputTokens: budget.maxOutputTokensPerCall };
      // Conservative byte ceiling, NOT reported tokenizer usage; reserve protocol overhead too.
      if (new TextEncoder().encode(JSON.stringify(modelRequest)).length + 512 > budget.maxInputTokensPerCall) throw new CoreError('BUDGET_UNAVAILABLE');
      budget = consumeBudget(budget, 'model');
      const modelCallId = randomUUID(); const started = Date.now(); let usage: ProviderUsage = { status: 'unknown' }; let response: ProviderResponse | undefined;
      await trace('model.started', { modelCallId }); emit({ type: 'run.status', phase: 'answering' });
      try {
        assertExecution(execution.signal, execution.deadlineAt);
        for await (const event of ports.provider.stream(modelRequest, { ...execution, modelCallId })) {
          if (event.type === 'usage') usage = event.usage;
          if (event.type === 'error') throw new CoreError(event.code);
          if (event.type === 'done') { response = event.response; usage = response.usage; }
          if (event.type === 'text_delta') { finalText += event.text; emit({ type: 'answer.delta', text: event.text }); }
        }
        if (!response) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      } finally {
        if (usage.status !== 'reported') allReported = false;
        await ports.persistence.persistUsage(run, { runId: run.id, modelCallId, attemptIndex: run.executionAttempt, provider: profile.model.provider, model: profile.model.model, durationMs: Date.now() - started, usage });
      }
      assertExecution(execution.signal, execution.deadlineAt);
      if (!response.toolCalls.length) {
        if (response.finishReason !== 'stop') throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        finalText = response.text;
        await move('completed', finalText);
        emit({ type: 'answer.final', text: finalText, sourceRefs: [], completeness: 'complete' });
        emit({ type: 'run.completed', usageStatus: allReported ? 'reported' : 'unknown' });
        return { run, replayed: false };
      }
      await move('waiting_tool');
      messages.push({ role: 'assistant', text: response.text, toolCalls: response.toolCalls }); finalText = '';
      for (const call of response.toolCalls) {
        if (seenCallIds.has(call.id)) throw new CoreError('PROVIDER_PROTOCOL_ERROR'); seenCallIds.add(call.id);
        assertExecution(execution.signal, execution.deadlineAt); budget = consumeBudget(budget, 'tool');
        await trace('tool.started', { modelCallId, toolCallId: call.id }); emit({ type: 'tool.status', callId: call.id, state: 'started' });
        const result = await executeAllowedTool(call, visible, ports.tools, ports.policy, { ...execution, callId: call.id, modelCallId, skillRunId, authority });
        messages.push({ role: 'tool', callId: call.id, name: call.name, result });
        await trace('tool.completed', { modelCallId, toolCallId: call.id }); emit({ type: 'tool.status', callId: call.id, state: 'succeeded' });
      }
      await move('running');
    }
  } catch (error) {
    const code = errorCode(error); (ports.logger ?? noopLogger).error({ runId: run.id, errorCode: code, stage: 'coordinator' });
    // CAS failure never produces a false completion. A competing terminal winner stays authoritative.
    try { await move(code === 'RUN_CANCELLED' ? 'cancelled' : 'failed', finalText || undefined, code); }
    catch (persistenceError) { (ports.logger ?? noopLogger).error({ runId: run.id, errorCode: 'PERSISTENCE_FAILED', stage: 'terminal' }); throw new CoreError('PERSISTENCE_FAILED', persistenceError); }
    if (run.status === 'cancelled') emit({ type: 'run.cancelled', partial: Boolean(finalText) });
    else emit({ type: 'run.failed', code, safeMessage: safeMessage(code), partial: Boolean(finalText) });
    return { run, replayed: false };
  } finally { deadline?.dispose(); }
}
