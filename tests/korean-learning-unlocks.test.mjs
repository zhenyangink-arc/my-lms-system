import assert from "node:assert/strict";
import test from "node:test";

import {
  HANGUL_TEST_SEQUENCE,
  getUnlockedKoreanTestSlugs,
  isKoreanChapterLearningCompleted,
} from "../src/lib/korean-learning-unlocks.ts";

test("智能教材完成证据无需伪造电子书阅读时长", () => {
  assert.equal(
    isKoreanChapterLearningCompleted({
      progressPercent: 100,
      readingSeconds: 0,
      readPages: [],
      totalPages: 32,
      completionSource: "smart_textbook",
    }),
    true,
  );
});

test("旧电子书证据仍要求完整进度和有效阅读时长", () => {
  assert.equal(
    isKoreanChapterLearningCompleted({
      progressPercent: 100,
      readingSeconds: 599,
      completionSource: "ebook",
    }),
    false,
  );
  assert.equal(
    isKoreanChapterLearningCompleted({
      progressPercent: 100,
      readingSeconds: 600,
      completionSource: "ebook",
    }),
    true,
  );
});

test("完成第 01 章智能教材后，测试序列不再被电子书门槛拦截", () => {
  const unlocked = getUnlockedKoreanTestSlugs(
    HANGUL_TEST_SEQUENCE,
    ["korean-level-one-01"],
  );

  assert.equal(unlocked.has("korean-level-one-01"), true);
  assert.equal(unlocked.has("korean-level-one-02"), false);
});
