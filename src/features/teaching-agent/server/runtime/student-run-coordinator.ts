import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AgentRun, RuntimeExecutionContext } from '../../../agent-core/contracts/server.ts';
import type { AgentRequest, RuntimeEvent, RuntimeEventPayload } from '../../../agent-core/contracts/public.ts';
import type { ProviderAdapter, ProviderResponse, ProviderUsage, ModelMessage } from '../../../agent-core/contracts/provider.ts';
import type { AgentPersistence } from '../../../agent-core/persistence/ports.ts';
import type { TraceEvent, TraceSink } from '../../../agent-core/observability/trace.ts';
import { traceMetadata } from '../../../agent-core/observability/trace.ts';
import { createEventFactory } from '../../../agent-core/observability/events.ts';
import { assertBudget, consumeBudget } from '../../../agent-core/runtime/run-budget.ts';
import { assertExecution, withSignal } from '../../../agent-core/runtime/deadline.ts';
import { CoreError, errorCode, safeMessage } from '../../../agent-core/runtime/errors.ts';
import { parseIntake, resolveConversationId } from '../../../agent-core/conversation/scope.ts';
import type { createStudentDomainRuntime } from '../composition/create-student-domain-runtime.ts';
import { createStudentAiTeacherCapabilities } from '../composition/create-student-ai-teacher-capabilities.ts';
import type { VerifiedStudentBinding } from '../selection/selection-types.ts';
import { lessonToolRef, stateToolRef } from '../../profiles/student-ai-teacher.ts';
import { artifactDigest, type StudentRuntimeDefinition } from './student-runtime-definition.ts';
import { studentPlanningContext, assembleStudentExplainPrompt, assembleStudentExecutionPrompt } from './student-prompt-assembler.ts';
import { createStudentRunCompletionGuard, createProductionStudentCompletionGuard } from './student-run-completion-guard.ts';

import { createProductionLessonExecutionCapabilities } from '../composition/create-production-lesson-execution-capabilities.ts';
import { productionLessonFactsToolRef } from '../tools/contracts.ts';

/** Student-specific bounded execution above Core ports. The generic coordinator and
 * non-teaching Agents keep their own completion policy; no teaching import enters Core. */
export async function coordinateStudentRun(input: {
  request: AgentRequest; binding: VerifiedStudentBinding; domain: ReturnType<typeof createStudentDomainRuntime>;
  definition: StudentRuntimeDefinition; execution: RuntimeExecutionContext; provider: ProviderAdapter;
  onAdmitted?: (run: AgentRun) => Promise<void>; checkCancellation?: (run: AgentRun) => Promise<void>;
  persistence: AgentPersistence; trace?: TraceSink; emit?: (event: RuntimeEvent) => void;
}) {
  const { binding, definition, persistence, provider } = input;
  const summary=definition.intent==='summarize_execution',selectedSkill={name:definition.skill.name,version:definition.skill.version};
  // Keep the original runtime-local authority. Only serializable persistence metadata is cloned.
  const authority = binding.authority, request = parseIntake(input.request, authority);
  const profile = structuredClone(definition.profile), skillRunId = randomUUID();
  const initialBudget = { ...profile.budget, usedModelCalls: 0, usedToolExecutions: 0, deadlineAt: input.execution.deadlineAt };
  assertBudget(initialBudget);
  const admissionPromise = persistence.admitRun({ request, authority, conversationId: resolveConversationId(request, authority),
    digest: artifactDigest({ request, selection: { segmentRef: binding.selection.segmentRef, revision: binding.selection.contentRevision, locale: binding.scope.locale }, intent: definition.intent }), profile, skillRef: selectedSkill, budget: initialBudget });
  let admission: Awaited<typeof admissionPromise>;
  try { admission = await withSignal(admissionPromise, input.execution.signal); }
  catch (error) {
    // If an admission response arrives after cancellation, stop that newly-created Run.
    // A replay is never cancelled by another request. No model/domain work is scheduled.
    void admissionPromise.then(async result => {
      if (!result.replayed) { try { await input.onAdmitted?.(result.run); } catch { /* still stop a late admission */ } await persistence.transitionRun({ run: result.run, to: errorCode(error) === 'RUN_CANCELLED' ? 'cancelled' : 'failed',
        budget: result.run.budget, reason: errorCode(error) }); }
    }).catch(() => { /* DB fence/lease remains authoritative if transport is unavailable. */ });
    throw error;
  }
  if (admission.replayed) return admission;
  let run: AgentRun = admission.run, budget = { ...run.budget }, allReported = true;
  let stage: NonNullable<TraceEvent['details']>['stage'] = 'admission';
  const execution = { ...input.execution, runId: run.id };
  const factory = createEventFactory(run.id);
  const emit = (event: RuntimeEventPayload) => { try { input.emit?.(factory(event)); } catch { /* detached consumer */ } };
  const trace = async (kind: TraceEvent['kind'], details: TraceEvent['details'] = {}, links: Pick<TraceEvent,'modelCallId'|'toolCallId'|'contextSnapshotId'> = {}) => {
    const event = traceMetadata({ kind, runId: run.id, skillRunId, at: new Date().toISOString(), details, ...links });
    await withSignal(persistence.appendRunEvent(run, event), kind === 'run.failure' ? AbortSignal.timeout(2000) : execution.signal);
    // A secondary sink cannot hold up the durable lifecycle or leak unvalidated text.
    try { if (input.trace) await withSignal(input.trace.write(event), AbortSignal.timeout(1000)); } catch { /* durable event already persisted */ }
  };
  const move = async (to: AgentRun['status'], finalText?: string, reason?: string) => {
    run = await withSignal(persistence.transitionRun({ run, to, budget, finalText, reason }),
      to === 'failed' || to === 'cancelled' ? AbortSignal.timeout(2000) : execution.signal);
  };
  const checkpoint = async () => {
    assertExecution(execution.signal, execution.deadlineAt);
    if (input.checkCancellation) await withSignal(input.checkCancellation(run), execution.signal);
    assertExecution(execution.signal, execution.deadlineAt);
  };
  try {
    await input.onAdmitted?.(run);
    emit({ type: 'run.started', conversationId: run.conversationId });
    await checkpoint();
    await move('running'); await trace('run.started');
    await trace('definition.pinned', { definitionDigest: definition.definitionDigest, authorityDigest: artifactDigest(authority),
      profileRef: profile.definitionVersion, skillRef: selectedSkill, promptVersion: profile.promptVersion,
      contextVersion: profile.contextVersion, policyVersion: profile.policyVersion, modelConfigVersion: profile.model.configVersion });
    stage = 'context'; emit({ type: 'run.status', phase: 'resolving_context' });
    const explainCapabilities=summary?null:await withSignal(createStudentAiTeacherCapabilities({domain:input.domain,binding,execution,skillRunId,intent:'explain_segment',pinned:{profile,skill:definition.skill}}),execution.signal);
    const summaryCapabilities=summary?await withSignal(createProductionLessonExecutionCapabilities({domain:input.domain,binding,execution,skillRunId,profile}),execution.signal):null;
    const capabilities=summaryCapabilities??explainCapabilities!;
    const guard=summaryCapabilities?createProductionStudentCompletionGuard(summaryCapabilities,profile):createStudentRunCompletionGuard(explainCapabilities!,binding.scope.locale);
    const context = studentPlanningContext(binding);
    await trace('permission.checked', { status: 'pass' });
    await trace('context.resolved', {}, { contextSnapshotId: context.snapshotId });
    await trace('skill.selected', { skillRef: selectedSkill });
    const prompt = summary?assembleStudentExecutionPrompt(definition,context,request):assembleStudentExplainPrompt(definition, context, request);
    await trace('prompt.assembled', prompt.metadata);
    const messages: ModelMessage[] = prompt.messages;
    let correctiveUsed = false, finalMode = false, successfulTools = 0;
    while (true) {
      assertExecution(execution.signal, execution.deadlineAt);
      await checkpoint();
      stage = finalMode ? 'final' : correctiveUsed ? 'corrective' : 'planning';
      const modelRequest = { model: profile.model, messages, tools: capabilities.modelTools,
        toolChoice: finalMode ? 'none' as const : 'auto' as const, maxOutputTokens: budget.maxOutputTokensPerCall };
      if (new TextEncoder().encode(JSON.stringify(modelRequest)).length + 512 > budget.maxInputTokensPerCall) throw new CoreError('BUDGET_UNAVAILABLE');
      budget = consumeBudget(budget, 'model');
      const modelCallId = randomUUID(), started = Date.now();
      let usage: ProviderUsage = { status: 'unknown' }, response: ProviderResponse | undefined;
      await trace('model.started', { stage, modelConfigVersion: profile.model.configVersion }, { modelCallId });
      emit({ type: 'run.status', phase: finalMode ? 'answering' : 'retrieving' });
      try {
        // Consume the actual Provider stream, but never release planning/final deltas.
        await checkpoint();
        const iterator = provider.stream(modelRequest, { ...execution, modelCallId })[Symbol.asyncIterator]();
        try {
          while (true) {
            const next = await withSignal(iterator.next(), execution.signal);
            if (next.done) break;
            const event = next.value;
            if (event.type === 'usage') usage = event.usage;
            if (event.type === 'done') { response = event.response; usage = response.usage; }
            if (event.type === 'error') throw new CoreError(event.code);
          }
        } finally { void iterator.return?.().catch(() => {}); }
        if (!response) throw new CoreError('PROVIDER_PROTOCOL_ERROR');
      } finally {
        if (usage.status !== 'reported') allReported = false;
        // Stop-only usage accounting is allowed after abort/deadline, before terminal CAS.
        await withSignal(persistence.persistUsage(run, { runId: run.id, modelCallId, attemptIndex: run.executionAttempt,
          provider: profile.model.provider, model: profile.model.model, durationMs: Date.now() - started, usage }),
          execution.signal.aborted ? AbortSignal.timeout(2000) : execution.signal);
      }
      assertExecution(execution.signal, execution.deadlineAt);
      await checkpoint();
      if (finalMode) {
        if (response.toolCalls.length || response.finishReason !== 'stop') throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        const answer = await withSignal<Awaited<ReturnType<typeof guard.complete>>>(guard.complete(response.text, trace), execution.signal);
        // No fragile extraction of checkQuestion or structured output from ordinary text.
        const text = answer.limitation ? `${answer.responseText}\n\n${answer.limitation}` : answer.responseText;
        assertExecution(execution.signal, execution.deadlineAt);
        await checkpoint();
        stage = 'persistence'; await move('completed', text);
        emit({ type: 'answer.final', text, sourceRefs: answer.sourceRefs, completeness: answer.completeness });
        emit({ type: 'run.completed', usageStatus: allReported ? 'reported' : 'unknown' });
        return { run, replayed: false, answer: { ...answer, responseText: text } };
      }
      if (response.toolCalls.length) {
        if (response.finishReason !== 'tool_calls') throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        stage = 'tool'; await move('waiting_tool');
        messages.push({ role: 'assistant', text: response.text, toolCalls: response.toolCalls });
        // Explicit serial execution. Never Promise.all model-selected operations.
        for (const call of response.toolCalls) {
          if (successfulTools >= 2) throw new CoreError('TOOL_NOT_ALLOWED');
          assertExecution(execution.signal, execution.deadlineAt); budget = consumeBudget(budget, 'tool');
          const toolRef = summary && call.name===productionLessonFactsToolRef.name?productionLessonFactsToolRef:call.name === lessonToolRef.name ? lessonToolRef : call.name === stateToolRef.name ? stateToolRef : undefined;
          await trace('tool.requested', { stage, ...(toolRef ? { toolRef } : {}) }, { modelCallId, toolCallId: call.id });
          emit({ type: 'tool.status', callId: call.id, state: 'started' });
          await checkpoint();
          const result = await capabilities.executeTool(call, modelCallId);
          await checkpoint();
          const success = result.status === 'ok' || result.status === 'partial';
          const data = success ? result.data as { revision: string; segmentRef?: string; asOf: string } : undefined;
          await trace('tool.completed', { ...(toolRef ? { toolRef } : {}), status: result.status === 'not_found_or_not_visible' ? 'denied' : result.status,
            ...(summaryCapabilities&&success?{evidenceSet:await summaryCapabilities.traceEvidence()}:{}),
            ...(data ? { revision: data.revision, segmentRef: data.segmentRef, sourceRefs: 'sourceRefs' in result ? result.sourceRefs : [], asOf: data.asOf } : {}) },
          { modelCallId, toolCallId: call.id });
          emit({ type: 'tool.status', callId: call.id, state: success ? 'succeeded' : 'failed' });
          messages.push({ role: 'tool', callId: call.id, name: call.name, result });
          if (success) successfulTools++;
          else if (summary || call.name === lessonToolRef.name) throw new CoreError('REQUIRED_EVIDENCE_MISSING');
        }
        await move('running');
      } else {
        if (response.finishReason !== 'stop') throw new CoreError('PROVIDER_PROTOCOL_ERROR');
        // Suppressed text is not an answer and is never persisted as assistant content.
        messages.push({ role: 'assistant', text: response.text });
      }
      const evidence = await capabilities.validateEvidence();
      if (evidence.status === 'satisfied') {
        finalMode = true;
        messages.push({ role: 'system', text: summary?'Required durable evidence obtained. Do not call further tools. The server produces the bounded summary.':'Required Lesson evidence obtained. Answer the question using the Tool DATA. Ordinary concise text only. Do not call further tools.' });
      } else {
        if (correctiveUsed || budget.usedModelCalls >= budget.maxModelCalls - 1) throw new CoreError('REQUIRED_EVIDENCE_MISSING');
        correctiveUsed = true;
        messages.push({ role: 'system', text: summary?'Required durable evidence missing. Select get_current_lesson_execution_facts with {}. This is the single corrective attempt.':'Required lesson evidence missing. You must select get_current_lesson_context with the bound refs. No answer can be accepted without that Tool result. This is the single corrective attempt.' });
      }
    }
  } catch (error) {
    const code = errorCode(error);
    try { await trace('run.failure', { stage, status: 'fail' }); } catch { /* still attempt fenced terminal cleanup */ }
    try { await move(code === 'RUN_CANCELLED' ? 'cancelled' : 'failed', undefined, code); }
    catch { throw new CoreError('PERSISTENCE_FAILED'); }
    if (run.status === 'cancelled') emit({ type: 'run.cancelled', partial: false });
    else emit({ type: 'run.failed', code, safeMessage: safeMessage(code), partial: false });
    return { run, replayed: false };
  }
}
