import 'server-only';
import type { SkillDefinition } from '../../../agent-core/contracts/skill.ts';
import type { VersionRef } from '../../../agent-core/contracts/server.ts';
/** Names the existing teaching extension; Core remains the sole Skill framework. */
export interface TeachingSkillDefinition extends SkillDefinition {
 intent: string;
 requiredContext: readonly string[];
 evidenceRequirements: { mandatory: readonly VersionRef[]; optional: readonly VersionRef[] };
 locales: readonly string[];
}
