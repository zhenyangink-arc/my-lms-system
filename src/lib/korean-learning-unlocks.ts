import { EBOOK_CHAPTER_TARGET_SECONDS } from "./korean-ebook-progress.ts";

export const HANGUL_TEST_SEQUENCE = [
  "meet-hangul",
  "vowels-and-consonants",
  "batchim-and-reading",
  "pronunciation-rules-and-reading",
] as const;

export const KOREAN_LEVEL_ONE_TEST_SEQUENCE = Array.from(
  { length: 16 },
  (_, index) => `korean-level-one-${String(index + 1).padStart(2, "0")}`
);

export const KOREAN_TEST_SEQUENCE = [
  ...HANGUL_TEST_SEQUENCE,
  ...KOREAN_LEVEL_ONE_TEST_SEQUENCE,
];

export function isKoreanChapterLearningCompleted(progress: {
  progressPercent: number;
  readingSeconds?: number | null;
  readPages?: readonly number[] | null;
  totalPages?: number | null;
  completionSource?: string | null;
}) {
  if (
    progress.completionSource === "smart_textbook" ||
    progress.completionSource === "both"
  ) {
    return true;
  }
  return (
    progress.progressPercent >= 100 &&
    (progress.readingSeconds ?? 0) >= EBOOK_CHAPTER_TARGET_SECONDS
  );
}

/**
 * 解锁按"通过"判断，不是"做过"：传入的必须是 passed=true 的章节测试 slug。
 * 当传入 completedLearningSlugs 时，新测试必须完成本章电子书或智能教材；
 * 已经通过的测试继续显示既有成绩，但不能因此提前开放下一章测试。
 */
export function getUnlockedKoreanTestSlugs(
  passedSlugs: Iterable<string>,
  completedLearningSlugs?: Iterable<string>,
) {
  const passed = new Set(passedSlugs);
  const completedLearning = completedLearningSlugs
    ? new Set(completedLearningSlugs)
    : null;
  const unlocked = new Set<string>();

  for (let index = 0; index < KOREAN_TEST_SEQUENCE.length; index += 1) {
    const slug = KOREAN_TEST_SEQUENCE[index];
    const previousSlug = KOREAN_TEST_SEQUENCE[index - 1];

    if (previousSlug && !passed.has(previousSlug)) break;
    if (completedLearning && !completedLearning.has(slug) && !passed.has(slug)) {
      break;
    }

    unlocked.add(slug);
  }

  return unlocked;
}

export function countUnlockedTests(
  unlockedSlugs: ReadonlySet<string>,
  sequence: readonly string[]
) {
  return sequence.filter((slug) => unlockedSlugs.has(slug)).length;
}
