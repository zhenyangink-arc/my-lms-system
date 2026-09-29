import 'server-only';
import type { AgentProfile, RunAuthority } from '../contracts/server.ts';
import type { SkillDefinition } from '../contracts/skill.ts';
import type { ToolDefinition, ToolRegistry } from '../contracts/tool.ts';
import type { PermissionPolicy } from './permission-policy.ts';
import { decisionAllows } from './permission-policy.ts';
import { versionKey } from '../skills/registry.ts';
export async function resolveAllowedToolDefinitions(profile: AgentProfile, skill: SkillDefinition, authority: RunAuthority, registry: ToolRegistry, policy: PermissionPolicy): Promise<ToolDefinition[]> {
  if (profile.status !== 'published' || skill.status !== 'published') return [];
  const skillKeys = new Set(skill.allowedTools.map(versionKey));
  const allowed: ToolDefinition[] = [];
  for (const ref of profile.allowedToolRefs) {
    if (!skillKeys.has(versionKey(ref))) continue;
    const tool = registry.get(ref)?.definition;
    if (!tool || tool.status !== 'enabled' || tool.riskLevel !== 0) continue;
    if (decisionAllows(await policy.evaluate(authority, { kind: 'tool', ref, requiredPermissions: tool.requiredPermissions }), authority)) {
      // Provider tool names cannot disambiguate multiple versions in one Run.
      if (allowed.some((item) => item.name === tool.name)) continue;
      allowed.push(tool);
    }
  }
  return allowed;
}
