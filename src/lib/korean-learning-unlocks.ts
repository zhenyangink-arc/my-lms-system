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

export function getUnlockedKoreanTestSlugs(attemptedSlugs: Iterable<string>) {
  const attempted = new Set(attemptedSlugs);
  let completedInOrder = 0;

  while (
    completedInOrder < KOREAN_TEST_SEQUENCE.length &&
    attempted.has(KOREAN_TEST_SEQUENCE[completedInOrder])
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
