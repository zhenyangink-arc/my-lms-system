export type KoreanEbookProgressEntry = {
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  readPages: number[];
  readingSeconds?: number;
  lastReadAt?: string | null;
};

export type KoreanEbookProgressMap = Record<
  string,
  KoreanEbookProgressEntry
>;

export const MIN_EBOOK_PAGE_READING_SECONDS = 10;
export const EBOOK_CHAPTER_TARGET_SECONDS = 10 * 60;

export function getVisibleEbookPages(currentPage: number, totalPages: number) {
  const boundedPage = Math.min(
    Math.max(0, Math.floor(currentPage)),
    Math.max(0, totalPages - 1)
  );
  return Array.from(
    new Set([boundedPage, Math.min(boundedPage + 1, totalPages - 1)])
  );
}

export function getEbookCompletionPercent(progress: {
  readingSeconds: number;
  readPages: readonly number[];
  totalPages: number;
}) {
  const timePercent = Math.min(
    100,
    Math.round(
      (Math.max(0, progress.readingSeconds) /
        EBOOK_CHAPTER_TARGET_SECONDS) *
        100
    )
  );
  return timePercent;
}
