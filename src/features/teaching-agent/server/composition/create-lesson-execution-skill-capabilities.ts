import 'server-only';
import { z } from 'zod';
import type { AgentProfile } from '../../../agent-core/contracts/server.ts';
import type { ToolExecutionContext } from '../../../agent-core/contracts/tool.ts';
import type { PermissionPolicy } from '../../../agent-core/permissions/permission-policy.ts';
import { resolveAllowedToolDefinitions } from '../../../agent-core/permissions/tool-policy.ts';
import { createToolRegistry } from '../../../agent-core/tools/registry.ts';
import { createSkillRegistry, requireSkill } from '../../../agent-core/skills/registry.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { assertExecution, createDeadlineSignal, withSignal } from '../../../agent-core/runtime/deadline.ts';
import { createLessonExecutionFactsTool } from '../tools/get-current-lesson-execution-facts.ts';
import { createLessonExecutionFactsReadPort } from '../domain-ports/lesson-execution-facts-read-port.ts';
import { factsGrantSchema, type FactsGrant, type LessonFactsBindingIssuer, type LessonFactsHandle } from '../domain-ports/lesson-execution-facts-binding.ts';
import { lessonFactsToolRef } from '../tools/contracts.ts';
import { createStudentToolEvidenceLedger } from './create-student-ai-teacher-capabilities.ts';
import { executionSummarySkillDefinition, executionSummarySkillRef } from '../../skills/summarize-current-lesson-execution/definition.ts';
import { checkExecutionSummaryEvidence, type ExecutionEvidenceBinding } from '../../skills/summarize-current-lesson-execution/evidence.ts';
import { projectExecutionSummary } from '../../skills/summarize-current-lesson-execution/output.ts';
const callSchema = z.strictObject({ id: z.string().min(1).max(200), name: z.string().min(1).max(100), arguments: z.string().max(16000) });
/** ISOLATED HARNESS ONLY. No routes, production registration, coordinator,
 * production issuer, current DB transport or Provider are constructed here. */
export async function createLessonExecutionSkillCapabilities(input: {
 isolation: 'isolated-test-db'; intent: 'summarize_execution'; profile: AgentProfile;
 issuer: LessonFactsBindingIssuer; handle: LessonFactsHandle; grant: FactsGrant;
 context: ToolExecutionContext; policy: PermissionPolicy;
}) {
 const grant = factsGrantSchema.parse(structuredClone(input.grant)), context = { ...input.context };
 if (input.isolation !== 'isolated-test-db' || grant.storage !== 'isolated-test-db' || input.intent !== 'summarize_execution'
  || !z.uuid().safeParse(context.runId).success || !z.uuid().safeParse(context.skillRunId).success
  || context.authority.actorId !== grant.domain.actorId || context.authority.tenantId !== grant.domain.tenantId
  || context.authority.membershipRole !== 'student') throw new CoreError('FORBIDDEN');
 const profile = structuredClone(input.profile), issuer = input.issuer, handle = input.handle, policy = input.policy;
 const bound: ExecutionEvidenceBinding = Object.freeze({ content: grant.content, storage: 'isolated-test-db', snapshot: grant, runStartedAt: Date.now() });
 const skill = requireSkill(createSkillRegistry([executionSummarySkillDefinition]), executionSummarySkillRef);
 if (profile.agentCode !== 'student-ai-teacher' || !profile.allowedSkillRefs.some(r => r.name === skill.name && r.version === skill.version)) throw new CoreError('FORBIDDEN');
 const registry = createToolRegistry([createLessonExecutionFactsTool(createLessonExecutionFactsReadPort(issuer), handle)]);
 const bounded = async <T>(op: () => Promise<T>) => {
  assertExecution(context.signal, context.deadlineAt);
  const deadline = createDeadlineSignal(context.signal, context.deadlineAt);
  try { return await withSignal(op(), deadline.signal); } finally { deadline.dispose(); }
 };
 await bounded(() => issuer.revalidate(handle, context));
 const visible = await bounded(() => resolveAllowedToolDefinitions(profile, skill, context.authority, registry, policy));
 if (!visible.some(t => t.name === lessonFactsToolRef.name && t.version === lessonFactsToolRef.version)) throw new CoreError('FORBIDDEN');
 const ledger = createStudentToolEvidenceLedger({ context, skill: executionSummarySkillRef, binding: bound, visible, registry, policy });
 let busy = false, attempts = 0;
 const seen = new Set<string>();
 async function evidence() {
  if (busy) return { status: 'invalid', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
  try {
   await bounded(() => issuer.revalidate(handle, context));
   if (busy) return { status: 'invalid', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
   const permitted = await bounded(() => resolveAllowedToolDefinitions(profile, skill, context.authority, registry, policy));
   if (!permitted.some(t => t.name === lessonFactsToolRef.name && t.version === lessonFactsToolRef.version)) return { status: 'invalid', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
   const receipt = ledger.get(lessonFactsToolRef);
   if (!receipt) return { status: 'missing', code: 'REQUIRED_EVIDENCE_MISSING' } as const;
   return checkExecutionSummaryEvidence(receipt, bound, context);
  } catch { return { status: 'invalid', code: 'REQUIRED_EVIDENCE_MISSING' } as const; }
 }
 return {
  modelTools: visible.map(t => ({ name: t.name, description: t.description, inputSchema: structuredClone(t.inputSchema) })),
  async executeTool(raw: unknown, modelCallId: string) {
   if (busy || attempts >= profile.budget.maxToolExecutions) throw new CoreError('TOOL_NOT_ALLOWED');
   const parsed = callSchema.safeParse(raw);
   if (!parsed.success || !z.uuid().safeParse(modelCallId).success) throw new CoreError('TOOL_INVALID_INPUT');
   const call = parsed.data;
   if (seen.has(call.id)) throw new CoreError('TOOL_NOT_ALLOWED');
   seen.add(call.id); attempts++; busy = true;
   try {
    return await ledger.execute(call, modelCallId, lessonFactsToolRef);
   } catch (error) { throw new CoreError(error instanceof CoreError ? error.code : 'TOOL_FAILED'); }
   finally { busy = false; }
  },
  async validateEvidence() { const e = await evidence(); return e.status === 'satisfied' ? { status: 'satisfied' as const } : e; },
  async complete(modelOutput: unknown = {}) {
   const output = projectExecutionSummary(modelOutput, await evidence());
   if (output.status !== 'accepted') throw new CoreError(output.code);
   return output.output;
  },
 };
}
