import { propsSchemas, blockTypes, type BlockTypeV1, type BlockV1, type RegionV1, type ProgressRefV1 } from './contracts.ts';

export interface RegistryEntryV1 {
  type: BlockTypeV1;
  capability: string;
  allowedRegions: readonly RegionV1['id'][];
  propsValidator: (typeof propsSchemas)[BlockTypeV1];
  composition: 'atomic' | 'composite';
  progressKinds: readonly ProgressRefV1['kind'][];
  targetPartsRule: 'none' | 'declared-props-identities';
  renderer: 'unimplemented';
  dispose: 'unimplemented';
  migrationReader: 'unimplemented';
}
const composites = new Set<BlockTypeV1>(['dialogue','listening','shadowing','role_play','supplemental_visual','vocabulary_practice','grammar_practice','pattern_practice','listen_speak','read_write','review','compat.learning.v1']);
const support = new Set<BlockTypeV1>(['image','text','rich_text','audio','supplemental_visual']);
export const blockRegistryV1 = Object.freeze(Object.fromEntries(blockTypes.map(type => [type, Object.freeze({
  type, capability: `block.${type}`, propsValidator: propsSchemas[type],
  allowedRegions: Object.freeze(type === 'compat.teacher.v1' ? ['teaching'] : type === 'video' ? ['teaching','interaction.main'] : support.has(type) ? ['teaching','interaction.main','interaction.support'] : type === 'dialogue' ? ['interaction.main','interaction.support'] : ['interaction.main']),
  composition: composites.has(type) ? 'composite' : 'atomic',
  progressKinds: Object.freeze(type === 'compat.teacher.v1' ? ['teaching'] : ['video','image','text','rich_text','dialogue','supplemental_visual'].includes(type) ? [] : type === 'shadowing' ? ['guided-repeat'] : composites.has(type) ? ['activity','node','activity-page','guided-repeat'] : ['activity']),
  targetPartsRule: composites.has(type) ? 'declared-props-identities' : 'none',
  renderer: 'unimplemented', dispose: 'unimplemented', migrationReader: 'unimplemented',
})])) as unknown as { readonly [K in BlockTypeV1]: RegistryEntryV1 });
export const contractCapabilitiesV1 = Object.freeze(['layout.v1','navigation.linear.v1','progress.server.v1', ...blockTypes.map(t => blockRegistryV1[t].capability)]);
/** No executable renderer is registered in Phase 3A. */
export const executableCapabilitiesV1: readonly string[] = Object.freeze([]);
export function declaredPartIds(block: BlockV1): string[] {
  if (blockRegistryV1[block.type].targetPartsRule === 'none') return [];
  const ids: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'id' && typeof child === 'string') ids.push(child);
      else if (key === 'exercisePartIds' && Array.isArray(child)) ids.push(...child);
      else visit(child);
    }
  };
  visit(block.props);
  return ids;
}

/** Media-bearing parts and their containing panels may expose play, not siblings. */
export function canPlayTarget(block: BlockV1, partId: string | null): boolean {
  // Compatibility play is implemented by a scoped service owner, never by a
  // DOM element. The compiler/private validator certifies the exact part family;
  // the mounted registry additionally requires an actual authorized owner.
  if (block.type==='compat.learning.v1') return partId!==null && block.props.parts.some(p=>p.id===partId);
  if (['image','supplemental_visual','text','rich_text','compat.teacher.v1','compat.learning.v1'].includes(block.type)) return false;
  const playable = new Set<string>();
  const visit = (value: unknown, ancestors: string[]): boolean => {
    if (Array.isArray(value)) return value.map(v => visit(v, ancestors)).some(Boolean);
    if (!value || typeof value !== 'object') return false;
    const entries = Object.entries(value);
    const id = entries.find(([k]) => k === 'id')?.[1];
    const path = typeof id === 'string' ? [...ancestors,id] : ancestors;
    const direct = entries.some(([k,v]) => ['mediaRef','modelMediaRef'].includes(k) && typeof v === 'string');
    const nested = entries.map(([,v]) => visit(v,path)).some(Boolean);
    if (direct || nested) path.forEach(id => playable.add(id));
    return direct || nested;
  };
  const root = visit(block.props,[]);
  return partId === null ? root : playable.has(partId);
}
