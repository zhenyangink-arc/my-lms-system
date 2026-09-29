import 'server-only';
import type { SkillDefinition, SkillRegistry } from '../contracts/skill.ts';
import type { VersionRef } from '../contracts/server.ts';
import { CoreError } from '../runtime/errors.ts';
export function versionKey(ref: VersionRef): string { return JSON.stringify([ref.name, ref.version]); }
export function createSkillRegistry(skills: readonly SkillDefinition[] = []): SkillRegistry {
  const entries = new Map<string, SkillDefinition>();
  for (const skill of skills) {
    const key = versionKey(skill); if (entries.has(key)) throw new CoreError('INVALID_REQUEST');
    entries.set(key, structuredClone(skill));
  }
  return { get(ref) { const skill = entries.get(versionKey(ref)); return skill ? structuredClone(skill) : undefined; } };
}
export function requireSkill(registry: SkillRegistry, ref: VersionRef): SkillDefinition {
  const skill = registry.get(ref);
  if (!skill || skill.status !== 'published') throw new CoreError('FORBIDDEN');
  return skill;
}
export const productionSkillRegistry = createSkillRegistry();
