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

/**
 * 解锁按"通过"判断，不是"做过"：传入的必须是 passed=true 的章节测试 slug。
 * 0 分交白卷也算"做过"，如果传全部尝试记录，掌握线就形同虚设。
 */
export function getUnlockedKoreanTestSlugs(passedSlugs: Iterable<string>) {
  const passed = new Set(passedSlugs);
  let completedInOrder = 0;

  while (
    completedInOrder < KOREAN_TEST_SEQUENCE.length &&
    passed.has(KOREAN_TEST_SEQUENCE[completedInOrder])
  ) {
    completedInOrder += 1;
  }

  return new Set(
    KOREAN_TEST_SEQUENCE.slice(
      0,
      Math.min(KOREAN_TEST_SEQUENCE.length, completedInOrder + 1)
    )
  );
}

export function countUnlockedTests(
  unlockedSlugs: ReadonlySet<string>,
  sequence: readonly string[]
) {
  return sequence.filter((slug) => unlockedSlugs.has(slug)).length;
}
