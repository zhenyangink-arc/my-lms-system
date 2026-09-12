import type { BlockV1, LessonManifestV1, RuntimeContextV1 } from '../../../src/lib/smart-textbook-runtime-v1/contracts.ts';
// Compile-only regression: discriminator narrows props, with no open JSON fallback.
export function narrowBlock(block: BlockV1) {
  if (block.type === 'video') {
    const ref: string = block.props.mediaRef;
    // @ts-expect-error Activity-only props must not exist on video.
    block.props.activityRef;
    return ref;
  }
  if (block.type === 'multiple_choice') {
    // @ts-expect-error Private correctness is never a props field.
    block.props.answer_key;
    return block.props.activityRef;
  }
}
export function contractTypes(manifest: LessonManifestV1, context: RuntimeContextV1) {
  const version: '1.0.0' = manifest.schemaVersion;
  // @ts-expect-error Version discrimination is closed.
  const invalid: '2.0.0' = manifest.schemaVersion;
  return { version, invalid, context };
}
