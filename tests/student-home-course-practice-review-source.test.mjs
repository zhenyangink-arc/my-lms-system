import assert from "node:assert/strict";
import test from "node:test";

import {
  mapCourseContinuationTask,
  selectCourseContinuationCandidate,
} from "../src/features/student-home-learning/api/course-mapper.ts";
import { mapChapterPracticeTask } from "../src/features/student-home-learning/api/chapter-practice-mapper.ts";
import { mapSpecializedPracticeTask } from "../src/features/student-home-learning/api/specialized-practice-mapper.ts";
import { mapReviewTask } from "../src/features/student-home-learning/api/review-mapper.ts";
import { dedupeHomeLearningTasks } from "../src/features/student-home-learning/api/dedupe.ts";

const context = {
  studentAppId: "app-1",
  appSlug: "korean",
  appLabel: "韩语",
  space: "school",
};

function courseCandidate(overrides = {}) {
  return {
    sourceId: "chapter-1",
    courseId: "course-1",
    courseChapterId: "chapter-1",
    courseTitle: "韩语入门",
    lessonTitle: "基础发音",
    chapterTitle: "第4章",
    categorySlug: "korean",
    subcategorySlug: "korean-basic",
    courseSlug: "level-one",
    lessonSlug: "pronunciation",
    progressPercent: 62,
    progressStatus: "in_progress",
    isAvailable: true,
    updatedAt: "2026-08-19T03:00:00.000Z",
    ...overrides,
  };
}

test("继续课程选择最近有效位置并深链到真实课时", () => {
  const selected = selectCourseContinuationCandidate([
    courseCandidate({
      sourceId: "older",
      courseChapterId: "chapter-old",
      updatedAt: "2026-08-18T03:00:00.000Z",
    }),
    courseCandidate(),
    courseCandidate({
      sourceId: "locked",
      courseChapterId: "chapter-locked",
      isAvailable: false,
      updatedAt: "2026-08-20T03:00:00.000Z",
    }),
  ]);
  assert.equal(selected?.sourceId, "chapter-1");

  const task = mapCourseContinuationTask({ candidate: selected, ...context });
  assert.equal(
    task?.href,
    "/school/apps/korean/courses/korean/korean-basic/level-one/pronunciation",
  );
  assert.equal(task?.courseChapterId, "chapter-1");
  assert.match(task?.reason ?? "", /62%/);
});

test("同一章节的多个继续位置只保留最近一条", () => {
  const selected = selectCourseContinuationCandidate([
    courseCandidate({ sourceId: "lesson-progress" }),
    courseCandidate({
      sourceId: "ebook-progress",
      updatedAt: "2026-08-19T04:00:00.000Z",
    }),
  ]);
  assert.equal(selected?.sourceId, "ebook-progress");
});

function chapterCandidate(overrides = {}) {
  return {
    practiceUnitId: "unit-1",
    courseId: "course-1",
    courseChapterId: "chapter-1",
    courseSlug: "level-one",
    courseTitle: "韩语入门",
    chapterSlug: "chapter-one",
    chapterTitle: "第1章",
    description: "章节巩固",
    publicationStatus: "published",
    progressStatus: "not_started",
    progressPercent: 0,
    correctCount: 0,
    attemptCount: 0,
    completionRule: { minimumAccuracyPercent: 80 },
    ebookCompleted: true,
    unmasteredReviewCount: 0,
    isOpen: true,
    updatedAt: "2026-08-19T03:00:00.000Z",
    ...overrides,
  };
}

test("教材完成未巩固映射为可开始，低于掌握线映射为进行中待加强", () => {
  const available = mapChapterPracticeTask({
    candidate: chapterCandidate(),
    ...context,
  });
  assert.equal(available?.status, "available");
  assert.match(available?.reason ?? "", /教材已经完成/);
  assert.equal(
    available?.href,
    "/school/apps/korean/practice/course/level-one/chapter-one",
  );

  const reinforcement = mapChapterPracticeTask({
    candidate: chapterCandidate({
      progressStatus: "needs_reinforcement",
      progressPercent: 100,
      correctCount: 6,
      attemptCount: 10,
    }),
    ...context,
  });
  assert.equal(reinforcement?.status, "in_progress");
  assert.match(reinforcement?.reason ?? "", /60%.*80%掌握线/);
});

test("未开放章节和已掌握章节不生成巩固任务", () => {
  assert.equal(
    mapChapterPracticeTask({
      candidate: chapterCandidate({ isOpen: false }),
      ...context,
    }),
    null,
  );
  assert.equal(
    mapChapterPracticeTask({
      candidate: chapterCandidate({ progressStatus: "mastered" }),
      ...context,
    }),
    null,
  );
});

function specializedCandidate(overrides = {}) {
  return {
    exerciseId: "exercise-1",
    exerciseTitle: "语法专项训练",
    description: "练习本章语法",
    skill: "grammar",
    abilityScore: 58,
    recentSessionCount: 4,
    consecutiveLowSessionCount: 0,
    courseId: "course-1",
    courseChapterId: "chapter-1",
    courseSlug: "level-one",
    lessonSlug: "lesson-one",
    chapterSlug: "chapter-one",
    isOpen: true,
    updatedAt: "2026-08-19T03:00:00.000Z",
    ...overrides,
  };
}

test("专项训练使用能力值和近期练习门槛，不随机生成", () => {
  const weak = mapSpecializedPracticeTask({
    candidate: specializedCandidate(),
    ...context,
  });
  assert.match(weak?.reason ?? "", /58分.*70分建议线/);
  assert.equal(
    weak?.href,
    "/school/apps/korean/training/grammar/level-one/lesson-one/chapter-one",
  );

  const sufficient = mapSpecializedPracticeTask({
    candidate: specializedCandidate({ abilityScore: 85, recentSessionCount: 3 }),
    ...context,
  });
  assert.equal(sufficient, null);

  const insufficient = mapSpecializedPracticeTask({
    candidate: specializedCandidate({ abilityScore: null, recentSessionCount: 1 }),
    ...context,
  });
  assert.match(insufficient?.reason ?? "", /最近30天只完成1次/);
});

function reviewCandidate(overrides = {}) {
  return {
    sourceId: "chapter:chapter-1",
    title: "第1章",
    itemCount: 7,
    repeatedErrorCount: 2,
    reviewStatus: "pending",
    isAvailable: true,
    courseId: "course-1",
    courseChapterId: "chapter-1",
    skill: null,
    updatedAt: "2026-08-19T03:00:00.000Z",
    ...overrides,
  };
}

test("错题按章节聚合，零错题不产生任务", () => {
  const task = mapReviewTask({ candidate: reviewCandidate(), ...context });
  assert.equal(task?.sourceId, "chapter:chapter-1");
  assert.match(task?.reason ?? "", /7道错题.*2道出现重复错误/);
  assert.equal(task?.href, "/school/apps/korean/practice/review");

  assert.equal(
    mapReviewTask({ candidate: reviewCandidate({ itemCount: 0 }), ...context }),
    null,
  );
});

test("统一去重移除已完成任务并保留同 taskKey 的更紧迫状态", () => {
  const base = mapReviewTask({ candidate: reviewCandidate(), ...context });
  assert.ok(base);
  const result = dedupeHomeLearningTasks([
    { ...base, status: "completed", updatedAt: "2026-08-19T05:00:00.000Z" },
    { ...base, status: "available", updatedAt: "2026-08-19T03:00:00.000Z" },
    { ...base, status: "in_progress", updatedAt: "2026-08-19T02:00:00.000Z" },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "in_progress");
});
