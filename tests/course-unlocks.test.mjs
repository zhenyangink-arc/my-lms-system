import assert from "node:assert/strict";
import test from "node:test";

import {
  getUnlockedChapterSlugs,
  isLessonUnlocked,
} from "../src/lib/course-unlocks.ts";

const prerequisiteLessonId = "hangul-introduction";
const prerequisiteChapterId = "pronunciation-rules-and-reading-id";
const prerequisiteChapterSlug = "pronunciation-rules-and-reading";

const lesson = {
  id: "basic-pronunciation",
  unlock_mode: "prerequisite_passed",
  prerequisite_lesson_id: prerequisiteLessonId,
  prerequisite_chapter_id: prerequisiteChapterId,
  available_from: null,
  is_manually_locked: false,
};

function checkUnlock({ completedLessonIds = new Set(), passedChapterSlugs = new Set() } = {}) {
  return isLessonUnlocked({
    lesson,
    lessonIndex: 1,
    orderedLessons: [],
    completedLessonIds,
    prerequisiteChapterSlugById: new Map([
      [prerequisiteChapterId, prerequisiteChapterSlug],
    ]),
    passedChapterSlugs,
  });
}

test("前置课程已完成时，即使章节测试记录暂时不可见也会解锁下一课", () => {
  assert.equal(checkUnlock({ completedLessonIds: new Set([prerequisiteLessonId]) }), true);
});

test("前置章节已通过时会解锁下一课", () => {
  assert.equal(checkUnlock({ passedChapterSlugs: new Set([prerequisiteChapterSlug]) }), true);
});

test("前置课程和章节均未完成时保持锁定", () => {
  assert.equal(checkUnlock(), false);
});

const overviewChapter = {
  id: "overview-id",
  slug: "korean-level-one-00",
  unlock_mode: "immediate",
  prerequisite_chapter_id: null,
  available_from: null,
  is_manually_locked: false,
};
const chapterOne = {
  id: "chapter-one-id",
  slug: "korean-level-one-01",
  unlock_mode: "prerequisite_completed",
  prerequisite_chapter_id: overviewChapter.id,
  available_from: null,
  is_manually_locked: false,
};

test("课程总览未完成时第 01 章保持锁定", () => {
  const unlocked = getUnlockedChapterSlugs({
    chapters: [overviewChapter, chapterOne],
    passedChapterSlugs: new Set(),
    completedChapterSlugs: new Set(),
  });

  assert.deepEqual([...unlocked], [overviewChapter.slug]);
});

test("看完课程总览后解锁第 01 章，不要求总览章节测试", () => {
  const unlocked = getUnlockedChapterSlugs({
    chapters: [overviewChapter, chapterOne],
    passedChapterSlugs: new Set(),
    completedChapterSlugs: new Set([overviewChapter.slug]),
  });

  assert.deepEqual([...unlocked], [overviewChapter.slug, chapterOne.slug]);
});
