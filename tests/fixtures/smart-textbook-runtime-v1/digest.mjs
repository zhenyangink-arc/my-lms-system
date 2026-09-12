import { createHash } from 'node:crypto';
// Fixture integrity only, not a publisher/compiler/Runtime Loader.
// Semantic arrays keep their authored order; catalogs are normalized by identity.
export function fixtureDigest(manifest) {
  const { snapshot: _snapshot, ...semantic } = structuredClone(manifest);
  for (const key of ['activityRefs','mediaRefs','progressRefs','teachingRefs','runtimeTargets','regions']) semantic[key].sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  semantic.steps.sort((a,b)=>a.order-b.order);
  semantic.blocks.sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  semantic.requiredCapabilities.sort();
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(semantic))).digest('hex')}`;
}
