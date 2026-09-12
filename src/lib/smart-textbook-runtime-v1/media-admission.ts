import type { LessonManifestV1, MediaRefV1 } from './contracts.ts';

/** Shared publisher / Loader / Runtime rule. Byte owners still require ready.
 * Admission does not change readiness or authorize playback. */
export function admittedMedia(m: LessonManifestV1, r: MediaRefV1): boolean {
  if (r.readiness === 'ready') return !r.admission;
  if (r.readiness !== 'pending' || r.kind !== 'audio' || r.access !== 'lesson' || !r.admission || m.compatibility.profile !== 'legacy-adapted') return false;
  const native = m.blocks.filter(b => !b.type.startsWith('compat.'));
  const references = (value: unknown): boolean => Array.isArray(value) ? value.some(references) :
    !!value && typeof value === 'object' ? Object.values(value).some(references) : value === r.id;
  return !native.some(b => references(b.props));
}
