import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';

export function canonical(value: unknown): string {
  if (value === undefined) throw new Error('Undefined is not source JSON');
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as { [key: string]: unknown })[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
/** Only persistent database IDs, enum slot keys or already allocated identities belong here. */
export function identity(kind: string, ...persistentKeys: string[]): string { return `${kind}-${digest(persistentKeys).slice(0,32)}`; }
export const identityMapSchema = z.strictObject({
  revision:z.literal('chapter-one-identities/1'),
  entries:z.array(z.strictObject({ owner:z.string(), collection:z.string(), fingerprint:z.string().regex(/^[a-f0-9]{64}$/), id:z.string().uuid() })),
  tracks:z.array(z.strictObject({ activityId:z.string(), legacyPage:z.number().int(), id:z.string().uuid(), sourceAudioDigest:z.string() })),
});
export type LegacyIdentityMap = z.infer<typeof identityMapSchema>;

/** Explicit offline rebinding proposal; caller reviews/persists it, no allocation or writes.
 * The same persistent ID survives an edited anonymous entity. Nested anonymous descendants
 * must be rebound separately when necessary; never silently align them by current index. */
export function rebindLegacyIdentity(map:LegacyIdentityMap,id:string,newValue:unknown):LegacyIdentityMap {
  const next=identityMapSchema.parse(structuredClone(map));
  const matches=next.entries.filter(e=>e.id===id);
  if(matches.length!==1)throw new Error('Rebinding requires exactly one existing allocation');
  const entry=matches[0],fingerprint=digest(newValue);
  if(next.entries.some(e=>e.id!==id&&e.owner===entry.owner&&e.collection===entry.collection&&e.fingerprint===fingerprint))throw new Error('Ambiguous rebinding');
  entry.fingerprint=fingerprint;
  return next;
}

export interface IdentityVisit { id:string; owner:string; path:string; collection:string; value:unknown }
/** Uses frozen matching evidence, NEVER allocates IDs. Edits/ambiguous duplicates fail closed.
 * Fingerprints locate allocations; they are not used as the allocated Runtime identity.
 * Across source revisions, authors explicitly rebind edited values to an existing allocation. */
export function walkIdentities(owner:string, value:unknown, root:string, ledger:LegacyIdentityMap,
  visit:(entry:IdentityVisit)=>void, unsupported:(path:string,reason:string)=>void): void {
  const walk=(v:unknown,path:string,collection:string):void=>{
    if(Array.isArray(v)) {
      const duplicates = v.map(digest);
      v.forEach((child,index)=>{
        const fingerprint=digest(child);
        const nativeId=child && typeof child==='object' && !Array.isArray(child) && 'id' in child && typeof child.id==='string' ? child.id : null;
        const matches=ledger.entries.filter(e=>e.owner===owner&&e.collection===collection&&e.fingerprint===fingerprint);
        const allocated=nativeId ? identity('part',owner,collection,nativeId) : matches.length===1 ? matches[0].id : null;
        if(!allocated || duplicates.filter(f=>f===fingerprint).length>1) { unsupported(`${path}[${index}]`,'Missing or ambiguous frozen identity allocation'); return; }
        visit({id:allocated,owner,path:`${path}[${index}]`,collection,value:child});
        walk(child,`${path}[${index}]`,`${collection}/entity:${allocated}`);
      }); return;
    }
    if(v && typeof v==='object') for(const [key,child] of Object.entries(v)) walk(child,`${path}.${key}`,`${collection}.${key}`);
  };
  walk(value,root,root);
}
