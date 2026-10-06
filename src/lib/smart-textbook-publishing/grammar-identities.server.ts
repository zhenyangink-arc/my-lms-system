import 'server-only';
import { z } from 'zod';
import frozen from './assets/v1/chapter-one-identities.server';
import { identityMapSchema, type LegacyIdentityMap } from '../smart-textbook-legacy-adapter/identity.server';

export const grammarIdentityOverridesSchema = z.array(z.strictObject({
  id: z.string().uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}));
/** Captured together with the node, fenced and sealed in private dependencies.
 * This can rebind existing card values, never allocate a new Runtime identity. */
export function publicationIdentities(nodes: { id?: unknown; authoring_grammar_identities?: unknown }[]): LegacyIdentityMap {
  const ledger = identityMapSchema.parse(structuredClone(frozen));
  const seen = new Set<string>();
  for (const node of nodes) for (const change of grammarIdentityOverridesSchema.parse(node.authoring_grammar_identities ?? [])) {
    const entry = ledger.entries.find(e => e.id === change.id && e.owner === node.id && e.collection === 'content.grammarCards');
    if (!entry || seen.has(entry.id)) throw Error('GRAMMAR_IDENTITY_INVALID');
    seen.add(entry.id); entry.fingerprint = change.fingerprint;
  }
  for (const e of ledger.entries) if (ledger.entries.filter(other => other.owner === e.owner && other.collection === e.collection && other.fingerprint === e.fingerprint).length !== 1) throw Error('GRAMMAR_IDENTITY_AMBIGUOUS');
  return ledger;
}
