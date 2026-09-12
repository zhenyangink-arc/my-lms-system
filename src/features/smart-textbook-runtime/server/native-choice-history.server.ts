import 'server-only';
import { z } from 'zod';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';

/** Legacy integer is a coordinate in the frozen ledger, NOT the current options
 * array. Reordering presentation options does not change historical identity. */
export function restoreNativeChoice(m: LessonManifestV1, b: PrivateBindings, activityRef: string, response: unknown): string {
  const activity = m.activityRefs.find(a => a.id === activityRef);
  const binding = b.activities.find(a => a.ref === activityRef);
  if (activity?.type !== 'single_choice' || !binding || binding.versionId !== m.version.id) throw Error('NATIVE_HISTORY_SCOPE');
  const index = z.number().int().nonnegative().parse(response);
  const mappings = b.identities.filter(i => i.owner === binding.activityId && /^options\[\d+\]$/.test(i.legacyPath));
  const ids = mappings.map(i => i.partId), paths = mappings.map(i => i.legacyPath);
  const options = activity.publicPresentation.options;
  if (new Set(ids).size !== ids.length || new Set(paths).size !== paths.length || new Set(options.map(o => o.id)).size !== options.length || mappings.length !== options.length || options.some(o => !ids.includes(o.id))) throw Error('NATIVE_HISTORY_AMBIGUOUS_MAPPING');
  const identity = mappings.find(i => i.legacyPath === `options[${index}]`);
  if (!identity || !options.some(o => o.id === identity.partId)) throw Error('NATIVE_HISTORY_UNKNOWN_OPTION');
  return identity.partId;
}
