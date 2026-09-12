/** Addresses use persisted identities, never display order, titles or selectors.
 * Syntax cannot prove identity provenance; the future compiler must freeze mappings. */
export const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export function isStableId(value: unknown): value is string {
  return typeof value === 'string' && stableIdPattern.test(value);
}
export function parseRuntimeTarget(value: unknown): { stepId: string; blockId: string; partId: string | null } | null {
  if (typeof value !== 'string') return null;
  const match = /^step:([^/]+)\/block:([^/]+)(?:\/part:([^/]+))?$/.exec(value);
  if (!match || !isStableId(match[1]) || !isStableId(match[2]) || (match[3] !== undefined && !isStableId(match[3]))) return null;
  return { stepId: match[1], blockId: match[2], partId: match[3] ?? null };
}
export function makeRuntimeTarget(stepId: string, blockId: string, partId: string | null = null): string {
  if (!isStableId(stepId) || !isStableId(blockId) || (partId !== null && !isStableId(partId))) throw new Error('Invalid stable identity');
  return `step:${stepId}/block:${blockId}${partId === null ? '' : `/part:${partId}`}`;
}
