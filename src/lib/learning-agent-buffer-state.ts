export type BufferLocale = "zh-CN" | "ko-KR";

type BufferStage = { bufferLine: Partial<Record<BufferLocale, string>>; bufferSpeechAssetId: Partial<Record<BufferLocale, string>> };
/** Preserve the server-selected text/asset pair. Null does not authorize a different node/locale. */
export function bufferPairForStage(locale: BufferLocale, opening: BufferStage, resumed?: BufferStage | null) {
  const stage = resumed ?? opening;
  const text = (stage.bufferLine[locale] ?? stage.bufferLine['zh-CN'] ?? '').trim();
  return { text, assetId: text ? stage.bufferSpeechAssetId[locale] ?? null : null };
}

/** An empty buffer line is a deliberate author choice (「不显示过渡台词」),
 * not a missing value — every saved node is required to pick either a real
 * preset or that "none" option, so there is nothing left to default to. */
export function bufferLineForRequest(
  override: string | undefined,
  prefetched: string | null,
) {
  const requested = override ?? prefetched;
  return requested || null;
}

export function bufferSpeechAssetForRequest(
  override: string | null | undefined,
  prefetched: string | null,
) {
  return override === undefined ? prefetched : override;
}
