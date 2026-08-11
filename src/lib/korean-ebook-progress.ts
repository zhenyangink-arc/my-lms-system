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
