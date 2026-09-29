import 'server-only';
import { z } from 'zod';
import type { ModelToolCall } from '../../../agent-core/contracts/provider.ts';
import type { AgentProfile } from '../../../agent-core/contracts/server.ts';
import type { SkillDefinition } from '../../../agent-core/contracts/skill.ts';
import { createSkillRegistry } from '../../../agent-core/skills/registry.ts';
import type { ToolResult } from '../../../agent-core/contracts/tool.ts';
import { createToolEvidenceLedger } from '../skills/tool-evidence-ledger.ts';
import { executeAllowedTool } from '../../../agent-core/tools/executor.ts';
import { resolveAllowedToolDefinitions } from '../../../agent-core/permissions/tool-policy.ts';
import { createDeadlineSignal, withSignal, assertExecution } from '../../../agent-core/runtime/deadline.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { createStudentAiTeacherProfile, explainSkillRef, lessonToolRef, stateToolRef } from '../../profiles/student-ai-teacher.ts';
import type { StudentPersona } from '../../profiles/kim-persona.ts';
import { checkExplainEvidence, type ExplainEvidence } from '../../skills/explain-pinned-korean-segment/evidence.ts';
import { validateExplainOutput } from '../../skills/explain-pinned-korean-segment/output.ts';
import { createStudentAiTeacherToolRegistry } from '../tools/student-tool-registry.ts';
import type { StudentToolBinding } from '../tools/contracts.ts';
import { createStudentToolPolicy } from '../policies/student-tool-policy.ts';
import { createStudentAiTeacherSkillRegistry, selectStudentExplainSkill } from '../skills/student-skill-registry.ts';
import { emitCapabilityTrace, type StudentCapabilityTrace, type StudentCapabilityEvent } from '../skills/trace.ts';
import { teachingRef } from '../selection/references.ts';

/** Sole Core bridge shared with the isolated composition. Callers cannot replace
 * the executor or import a result; the helper only stores this invocation's result. */
export function createStudentToolEvidenceLedger(input: Omit<Parameters<typeof createToolEvidenceLedger>[0], 'invokeCore'>) {
  return createToolEvidenceLedger({ ...input, invokeCore: executeAllowedTool });
}

const callSchema = z.strictObject({ id: z.string().min(1).max(200), name: z.string().min(1).max(100), arguments: z.string().max(16000) });

/** A server-only capability composition, NOT a Provider loop, API or Run coordinator.
 * The returned execution method is the sole writer of its private evidence ledger.
 * No method accepts externally supplied ToolResults or final sourceRefs. */
export async function createStudentAiTeacherCapabilities(input: StudentToolBinding & {
  intent: unknown; persona?: StudentPersona; trace?: StudentCapabilityTrace;
  pinned?: { profile: AgentProfile; skill: SkillDefinition };
}) {
  if (!z.uuid().safeParse(input.execution.runId).success || !z.uuid().safeParse(input.skillRunId).success)
    throw new CoreError('INVALID_REQUEST');
  // Snapshot the composition handles, preserving the 1A WeakMap-minted binding identity.
  const bound: StudentToolBinding = { domain: input.domain, binding: input.binding,
    execution: { ...input.execution }, skillRunId: input.skillRunId };
  const trace = input.trace;
  const profile = input.pinned ? structuredClone(input.pinned.profile) : createStudentAiTeacherProfile(input.persona);
  const skill = selectStudentExplainSkill(profile, input.pinned ? createSkillRegistry([input.pinned.skill]) : createStudentAiTeacherSkillRegistry(), input.intent);
  const registry = createStudentAiTeacherToolRegistry(bound), policy = createStudentToolPolicy(bound);
  const emit = (kind: StudentCapabilityEvent['kind'], ref: StudentCapabilityEvent['ref'] = explainSkillRef, status?: StudentCapabilityEvent['status'], callId?: string) =>
    emitCapabilityTrace(trace, { kind, ref, status, runId: bound.execution.runId, at: new Date().toISOString(),
      ...(callId ? { callRef: teachingRef('call', [bound.execution.runId, callId]) } : {}) });
  const bounded = async <T>(operation: () => Promise<T>): Promise<T> => {
    assertExecution(bound.execution.signal, bound.execution.deadlineAt);
    const deadline = createDeadlineSignal(bound.execution.signal, bound.execution.deadlineAt);
    try { return await withSignal(operation(), deadline.signal); } finally { deadline.dispose(); }
  };
  const checked = await bounded(() => bound.domain.selection.revalidate(bound.binding, bound.execution));
  if (checked.status !== 'ok') throw new CoreError('FORBIDDEN');
  const visible = await bounded(() => resolveAllowedToolDefinitions(profile, skill, bound.binding.authority, registry, policy));
  if (!visible.some(tool => tool.name === lessonToolRef.name)) throw new CoreError('FORBIDDEN');
  emit('skill.loaded');
  const ledger = createStudentToolEvidenceLedger({ context: { ...bound.execution, authority: bound.binding.authority,
    skillRunId: bound.skillRunId }, skill: explainSkillRef, visible, registry, policy });
  let busy = false, attempts = 0;
  const seenCalls = new Set<string>();
  async function evidence(): Promise<ExplainEvidence> {
    if (busy) return { status: 'invalid', code: 'INVALID_LESSON_EVIDENCE' };
    const fresh = await bounded(() => bound.domain.selection.revalidate(bound.binding, bound.execution));
    const result: ExplainEvidence = fresh.status === 'ok' && !busy ? checkExplainEvidence(bound.binding, ledger.get(lessonToolRef)?.result, ledger.get(stateToolRef)?.result)
      : { status: 'invalid', code: 'INVALID_LESSON_EVIDENCE' };
    emit('skill.evidence', explainSkillRef, result.status);
    return result;
  }
  return {
    // Copies cannot mutate runtime allowlists or the private ledger.
    profile: structuredClone(profile), skill: structuredClone(skill),
    modelTools: visible.map(tool => ({ name: tool.name, description: tool.description, inputSchema: structuredClone(tool.inputSchema) })),
    async executeTool(raw: ModelToolCall, modelCallId: string): Promise<ToolResult<unknown>> {
      if (busy || attempts >= profile.budget.maxToolExecutions) throw new CoreError('TOOL_NOT_ALLOWED');
      const parsed = callSchema.safeParse(raw);
      if (!parsed.success || !z.uuid().safeParse(modelCallId).success) throw new CoreError('TOOL_INVALID_INPUT');
      const call = parsed.data;
      if (seenCalls.has(call.id)) throw new CoreError('TOOL_NOT_ALLOWED');
      seenCalls.add(call.id); attempts++; busy = true;
      const ref = call.name === lessonToolRef.name ? lessonToolRef : call.name === stateToolRef.name ? stateToolRef : { name: 'unrecognized-tool', version: 'unknown' };
      try {
        const result = await ledger.execute(call, modelCallId, ref, () => emit('tool.requested', ref, undefined, call.id));
        emit(result.status === 'not_found_or_not_visible' ? 'tool.denied' : 'tool.completed', ref, result.status, call.id);
        return result;
      } catch (error) {
        emit('tool.denied', ref, 'denied', call.id);
        // A safe Core code only: no cause, stack string, SQL error or raw row to a future model.
        throw new CoreError(error instanceof CoreError ? error.code : 'TOOL_FAILED');
      } finally { busy = false; }
    },
    validateEvidence: evidence,
    async validateOutput(textEnvelope: unknown) { return validateExplainOutput(textEnvelope, await evidence(), bound.binding.scope.locale); },
  };
}
