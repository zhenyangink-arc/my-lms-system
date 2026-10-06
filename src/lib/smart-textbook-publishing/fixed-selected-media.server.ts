import 'server-only';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fixedSelectedMediaProofSchema, type FixedSelectedMediaProof } from './native-video-source.server.ts';

const selectedPath = '/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4';
const proof: FixedSelectedMediaProof = fixedSelectedMediaProofSchema.parse({
  adapter: 'fixed-selected-host/1', assetId: 'course-video-sample01',
  sha256: '68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',
  sizeBytes: 5487747, mime: 'video/mp4', videoDurationSeconds: 30, containerDurationSeconds: 30.016,
  revision: 'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',
});
/** No authority is granted here. Call only after owner/session authorization.
 * One bounded descriptor supplies both the hash and the returned immutable bytes. */
export async function readFixedSelectedVideoSnapshot(signal?: AbortSignal): Promise<{ proof: FixedSelectedMediaProof; bytes: Uint8Array }> {
  signal?.throwIfAborted();
  if (await realpath(selectedPath) !== selectedPath) throw Error('FIXED_MEDIA_PATH');
  const file = await open(selectedPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size !== proof.sizeBytes) throw Error('FIXED_MEDIA_SIZE');
    const bytes = new Uint8Array(proof.sizeBytes);
    let offset = 0;
    while (offset < bytes.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(bytes, offset, Math.min(65536, bytes.length - offset), offset);
      if (!bytesRead) throw Error('FIXED_MEDIA_TRUNCATED');
      offset += bytesRead;
    }
    const extra = await file.read(new Uint8Array(1), 0, 1, offset);
    const after = await file.stat();
    signal?.throwIfAborted();
    if (extra.bytesRead || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs ||
        createHash('sha256').update(bytes).digest('hex') !== proof.sha256) throw Error('FIXED_MEDIA_BYTES');
    return { proof: { ...proof }, bytes };
  } finally { await file.close(); }
}
