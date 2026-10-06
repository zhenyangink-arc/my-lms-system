import 'server-only';
import { z } from 'zod';
import { requireActiveUser } from '../auth';
import { createAdminClient } from '../supabase/admin';
import { readTextbookGrammarCards, grammarTextEditSchema } from '../textbook-grammar-content';
import { digest, rebindLegacyIdentity } from '../smart-textbook-legacy-adapter/identity.server';
import { publicationIdentities, grammarIdentityOverridesSchema } from './grammar-identities.server';
import { captureChapterOnePublication, type DependencyCapture } from './capture.server';
import { chapterOnePublicationScope } from './loader.server';

export function grammarAuthoringCards(dependencies: DependencyCapture) {
  const map = publicationIdentities(dependencies.digital_textbook_nodes);
  return dependencies.digital_textbook_nodes.flatMap(n => readTextbookGrammarCards(n.content as Record<string,unknown>).map(card => {
    const entries = map.entries.filter(e => e.owner === n.id && e.collection === 'content.grammarCards' && e.fingerprint === digest(card));
    if (entries.length !== 1) throw Error('GRAMMAR_IDENTITY_UNRESOLVED');
    return { nodeId: String(n.id), cardId: entries[0].id, expected: digest({content:n.content,identities:n.authoring_grammar_identities ?? []}), card };
  }));
}
export const grammarSaveSchema = z.strictObject({
  cardId: z.string().uuid(), expected: z.string().regex(/^[a-f0-9]{64}$/), patch: grammarTextEditSchema,
});
/** No browser row/index/media/ledger payload. Reauthorization + one captured
 * source; SQL compares node AND mapping and commits both under authoring lock. */
export async function saveChapterOneGrammar(input: unknown) {
  const auth = await requireActiveUser();
  if (auth.profile?.global_role !== 'platform_owner') throw Error('PUBLICATION_OWNER_ONLY');
  const value = grammarSaveSchema.parse(input), admin = createAdminClient();
  const { dependencies } = await captureChapterOnePublication(admin,auth.user.id,chapterOnePublicationScope);
  const card = grammarAuthoringCards(dependencies).find(c => c.cardId === value.cardId);
  if (!card || card.expected !== value.expected) throw Error('GRAMMAR_EDIT_CONFLICT');
  const row = dependencies.digital_textbook_nodes.find(n=>n.id === card.nodeId)!;
  const nextCard = { ...card.card, ...value.patch };
  const map = rebindLegacyIdentity(publicationIdentities(dependencies.digital_textbook_nodes),card.cardId,nextCard);
  const prior = grammarIdentityOverridesSchema.parse(row.authoring_grammar_identities ?? []);
  const next = [...prior.filter(e => e.id !== card.cardId), {id:card.cardId,fingerprint:digest(nextCard)}].sort((a,b)=>a.id.localeCompare(b.id));
  // Validate the projected ledger again before writing. All descendants remain
  // unchanged: no rules, example text/audio, comparison, add/delete or reorder.
  if (!map.entries.some(e=>e.id===card.cardId&&e.fingerprint===digest(nextCard))) throw Error('GRAMMAR_IDENTITY_INVALID');
  const result = await admin.rpc('edit_runtime_grammar_card_v1', {
    p_actor: auth.user.id, p_scope:chapterOnePublicationScope, p_node:card.nodeId,
    p_expected_content:row.content, p_expected_identities:prior,
    p_old_card:card.card, p_patch:value.patch, p_identities:next,
  });
  if (result.error || result.data?.saved !== true) throw Error('GRAMMAR_EDIT_REJECTED');
  return {saved:true as const};
}
