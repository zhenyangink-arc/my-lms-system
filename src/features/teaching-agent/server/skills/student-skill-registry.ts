import 'server-only';
import type { AgentProfile, VersionRef } from '../../../agent-core/contracts/server.ts';
import type { SkillRegistry } from '../../../agent-core/contracts/skill.ts';
import { createSkillRegistry, requireSkill, versionKey } from '../../../agent-core/skills/registry.ts';
import { CoreError } from '../../../agent-core/runtime/errors.ts';
import { explainSkillDefinition } from '../../skills/explain-pinned-korean-segment/definition.ts';
import { explainSkillRef } from '../../profiles/student-ai-teacher.ts';

import { productionExecutionSummarySkillDefinition,productionExecutionSummarySkillRef } from '../../skills/summarize-current-lesson-execution/definition.ts';
export function createStudentAiTeacherSkillRegistry(): SkillRegistry { return createSkillRegistry([explainSkillDefinition,productionExecutionSummarySkillDefinition]); }
export function selectStudentExplainSkill(profile: AgentProfile, registry: SkillRegistry, intent: unknown,
  ref: VersionRef = explainSkillRef) {
  if (intent !== 'explain_segment' || profile.agentCode !== 'student-ai-teacher' || profile.status !== 'published'
    || versionKey(ref) !== versionKey(explainSkillRef)
    || !profile.allowedSkillRefs.some(allowed => versionKey(allowed) === versionKey(ref))) throw new CoreError('FORBIDDEN');
  return requireSkill(registry, ref);
}

export function selectStudentExecutionSkill(profile:AgentProfile,registry:SkillRegistry){
 if(profile.agentCode!=='student-ai-teacher'||profile.definitionVersion.version!=='1.1.0'||profile.status!=='published'||!profile.allowedSkillRefs.some(r=>versionKey(r)===versionKey(productionExecutionSummarySkillRef)))throw new CoreError('FORBIDDEN');
 return requireSkill(registry,productionExecutionSummarySkillRef);
}
