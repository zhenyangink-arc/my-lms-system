import 'server-only';
import type { ToolRegistration, ToolRegistry } from '../contracts/tool.ts';
import { versionKey } from '../skills/registry.ts';
import { CoreError } from '../runtime/errors.ts';
export function createToolRegistry(tools: readonly ToolRegistration[] = []): ToolRegistry {
  const entries = new Map<string, ToolRegistration>();
  for (const tool of tools) {
    const key = versionKey(tool.definition); if (entries.has(key)) throw new CoreError('INVALID_REQUEST');
    entries.set(key, { definition: Object.freeze({ ...tool.definition }), executor: tool.executor });
  }
  return { get(ref) { return entries.get(versionKey(ref)); } };
}
export const productionToolRegistry = createToolRegistry();
