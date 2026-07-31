export type KoreanEbookProgressEntry = {
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  readPages: number[];
};

export type KoreanEbookProgressMap = Record<
  string,
  KoreanEbookProgressEntry
>;
