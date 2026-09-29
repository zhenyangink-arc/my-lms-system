import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonical } from '../../../agent-core/conversation/scope.ts';
import type { AgentProfile } from '../../../agent-core/contracts/server.ts';
import type { ProviderAdapter } from '../../../agent-core/contracts/provider.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { createStudentAiTeacherProfile, studentBaseInstructions, createProductionStudentAiTeacherProfile, productionStudentBaseInstructions } from '../../profiles/student-ai-teacher.ts';
import { studentPersonas } from '../../profiles/kim-persona.ts';
import { explainSkillDefinition } from '../../skills/explain-pinned-korean-segment/definition.ts';
import { lessonInputSchema, stateInputSchema, lessonOutputSchema, stateOutputSchema } from '../tools/contracts.ts';

import { productionExecutionSummarySkillDefinition } from '../../skills/summarize-current-lesson-execution/definition.ts';
import { lessonFactsInputSchema,productionLessonFactsOutputSchema } from '../tools/contracts.ts';

export const artifactDigest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
/** Exact code artifact admission. Unknown/executable fields, stale versions or Persona
 * substitutions cannot enter the persisted Core manifest. No DB procedure is executable. */
export function pinStudentRuntimeDefinition(candidate?: unknown,intent:'explain_segment'|'summarize_execution'='explain_segment') {
  const expected = intent==='summarize_execution'?createProductionStudentAiTeacherProfile():createStudentAiTeacherProfile();
  if (candidate!==undefined && canonical(candidate) !== canonical(expected)) throw new CoreError('FORBIDDEN');
  const persona = structuredClone(studentPersonas.kim), instructions = structuredClone(intent==='summarize_execution'?productionStudentBaseInstructions:studentBaseInstructions);
  const skill = structuredClone(intent==='summarize_execution'?productionExecutionSummarySkillDefinition:explainSkillDefinition);
  const toolSchemas = (intent==='summarize_execution'?[lessonFactsInputSchema,productionLessonFactsOutputSchema]:[lessonInputSchema, stateInputSchema, lessonOutputSchema, stateOutputSchema]).map(schema => z.toJSONSchema(schema));
  const definitionDigest = artifactDigest({ profile: expected, persona, instructions, skill, toolSchemas });
  // Only the explicit Core shape plus strict versioned artifact references is persisted.
  const profile: AgentProfile = { agentCode: expected.agentCode, definitionVersion: expected.definitionVersion, status: expected.status,
    promptVersion: expected.promptVersion, contextVersion: expected.contextVersion, model: expected.model,
    allowedSkillRefs: expected.allowedSkillRefs, allowedToolRefs: expected.allowedToolRefs,
    policyVersion: expected.policyVersion, budget: expected.budget,
    artifacts: { ...(intent==='summarize_execution'?{schemaVersion:2 as const,requiredEvidence:skill.evidenceRequirements.mandatory.map(toolRef=>({kind:'durable_execution_facts' as const,toolRef}))}:{schemaVersion:1 as const,requiredEvidenceToolRef:skill.evidenceRequirements.mandatory[0]}), definitionDigest, personaRef: expected.personaRef,
      privateInstructionsRef: expected.privateInstructionsRef, skillDigest: artifactDigest(skill),
      toolsDigest: artifactDigest({ refs: expected.allowedToolRefs, schemas: toolSchemas }), completionPolicyRef: expected.outputPolicyRef } };
  return { profile, persona, instructions, skill, definitionDigest,intent };
}
export type StudentRuntimeDefinition = ReturnType<typeof pinStudentRuntimeDefinition>;
export function assertStudentModelCapabilities(provider: ProviderAdapter, definition: StudentRuntimeDefinition) {
  const caps = provider.getCapabilities(definition.profile.model);
  if (provider.providerId !== 'deepseek' || caps.supportsStreaming !== 'supported' || caps.supportsTools !== 'supported')
    throw new CoreError('MODEL_CAPABILITY_UNAVAILABLE');
}
