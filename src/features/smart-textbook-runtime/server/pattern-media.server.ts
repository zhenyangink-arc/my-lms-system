import 'server-only';
import type { LessonManifestV1 } from '../../../lib/smart-textbook-runtime-v1/contracts.ts';
import type { PrivateBindings } from '../../../lib/smart-textbook-legacy-adapter/capsules.server.ts';
import { createR2SignedObjectUrl } from '../../../lib/r2';

export function resolvePatternMedia(m: LessonManifestV1, b: PrivateBindings, capsuleRef: string, turnId: string) {
  const c = b.capsules.find(c => c.id === capsuleRef);
  const block = m.blocks.find(b => b.type === 'compat.learning.v1' && b.props.capsuleRef === capsuleRef);
  if (c?.kind !== 'learning' || block?.type !== 'compat.learning.v1') throw Error('PATTERN_MEDIA_CAPSULE');
  const activity = c.activities.find(a => a.activityKey === 'pattern-choice');
  if (activity?.activityKey !== 'pattern-choice' || !block.props.activityRefs.includes(activity.activityId)) throw Error('PATTERN_MEDIA_ACTIVITY');
  const identities = b.identities.filter(i => i.owner === activity.activityId && i.partId === turnId);
  const match = identities.length === 1 && /^public_config\.conversation\.steps\[(\d+)\]$/.exec(identities[0].legacyPath);
  const turn = match ? activity.settings.conversation.steps[Number(match[1])] : null;
  // This is the existing frozen activity-turn identity, not an invented Manifest
  // play target. V1 currently declares no imperative target for these turns.
  if (!turn) throw Error('PATTERN_MEDIA_TURN');
  if (!turn.audioAssetKey) return null;
  const metadata = b.mediaMetadata.filter(x => x.assetKey === turn.audioAssetKey && x.purpose === 'guided-conversation-line');
  if (metadata.length !== 1) throw Error('PATTERN_MEDIA_AMBIGUOUS');
  const ref = m.mediaRefs.find(r => r.id === metadata[0].ref);
  const rows = b.media.filter(r => r.ref === ref?.id);
  if (!ref || rows.length !== 1 || ref.revision !== rows[0].revision || ref.kind !== 'audio' || rows[0].access !== 'lesson') throw Error('PATTERN_MEDIA_BINDING');
  if (ref.readiness !== 'ready') return null;
  if (!rows[0].objectKey) throw Error('PATTERN_MEDIA_LOCATION');
  return rows[0]; // Private only, never serialized to the Runtime.
}

/** Authorize before calling. Presigned location stays on the server; only a
 * bounded, typed Blob crosses the service port. No new media/recording storage. */
export async function patternAudioBytes(m: LessonManifestV1, b: PrivateBindings, capsuleRef: string, turnId: string, signal: AbortSignal): Promise<Blob | null> {
  signal.throwIfAborted();
  const owner = resolvePatternMedia(m, b, capsuleRef, turnId);
  if (!owner) return null;
  const response = await fetch(await createR2SignedObjectUrl(owner.objectKey!), { signal, cache: 'no-store', redirect: 'error' });
  const mime = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!response.ok || !['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/webm'].includes(mime) || !response.body) throw Error('PATTERN_MEDIA_UNAVAILABLE');
  const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted(); const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > 10 * 1024 * 1024) throw Error('PATTERN_MEDIA_SIZE');
      chunks.push(new Uint8Array(part.value));
    }
    if (!size) throw Error('PATTERN_MEDIA_EMPTY');
    return new Blob(chunks, { type: mime });
  } finally { await reader.cancel(); reader.releaseLock(); }
}
