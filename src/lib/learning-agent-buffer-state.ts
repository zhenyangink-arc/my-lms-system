export type BufferLocale = "zh-CN" | "ko-KR";

const DEFAULT_BUFFER_LINE: Record<BufferLocale, string> = {
  "zh-CN": "稍等一下，我看看这里怎么讲…",
  "ko-KR": "잠시만요, 이 부분을 한번 볼게요…",
};

export function bufferLineForRequest(
  override: string | undefined,
  prefetched: string | null,
  locale: BufferLocale,
) {
  const requested = override ?? prefetched;
  if (requested === null) return null;
  return requested || DEFAULT_BUFFER_LINE[locale];
}

export function bufferSpeechAssetForRequest(
  override: string | null | undefined,
  prefetched: string | null,
) {
  return override === undefined ? prefetched : override;
}
