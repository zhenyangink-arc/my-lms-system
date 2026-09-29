import 'server-only';
import type { VersionRef } from './server.ts';
export interface SkillDefinition {
  name: string; version: string; status: 'published' | 'disabled'; description: string;
  allowedTools: readonly VersionRef[]; procedure: readonly string[]; outputContract: VersionRef;
}
export interface SkillRegistry { get(ref: VersionRef): SkillDefinition | undefined }
