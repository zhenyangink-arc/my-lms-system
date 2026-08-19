import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCoursePracticeCatalog,
  getCoursePracticeDirectoryState,
} from "../src/lib/course-practice-catalog.ts";

const openRule = {
  unlock_mode: "immediate",
  available_from: null,
  is_manually_locked: false,
};

function fixture(overrides = {}) {
  const courses = [
    {
      id: "course-a",
      category_id: "korean-basic",
      slug: "foundation-course",
      title: "基础课程",
      sort_order: 1,
      prerequisite_course_id: null,
      ...openRule,
    },
    {
      id: "course-c",
      category_id: "korean-basic",
      slug: "conversation-course",
      title: "会话课程",
      sort_order: 3,
      prerequisite_course_id: null,
      ...openRule,
    },
  ];
  const lessons = courses.map((course, index) => ({
    id: `lesson-${index}`,
    course_id: course.id,
    slug: `lesson-${index}`,
    title: `${course.title}课时`,
    sort_order: 1,
    prerequisite_lesson_id: null,
    prerequisite_chapter_id: null,
    ...openRule,
  }));
  const chapters = lessons.map((lesson, index) => ({
    id: `chapter-${index}`,
    lesson_id: lesson.id,
    chapter_test_id: index === 0 ? "test-a" : null,
    slug: `chapter-${index}`,
    title: `${index + 1}章`,
    description: null,
    sort_order: 1,
    prerequisite_chapter_id: null,
    ...openRule,
  }));

  return {
    courses,
    lessons,
    chapters,
    publishedPracticeChapterIds: new Set(["chapter-0"]),
    lessonProgress: [],
    attempts: [],
    ebookProgress: [],
    practiceProgress: [],
    now: new Date("2026-08-19T00:00:00.000Z"),
    ...overrides,
  };
}

test("任意新增的已发布韩语课程都进入目录，不依赖旧课程键", () => {
  const catalog = buildCoursePracticeCatalog(fixture());

  assert.deepEqual(
    catalog.map((course) => course.slug),
    ["foundation-course", "conversation-course"],
  );
});

test("已开放章节按巩固包发布状态区分可进入与内容准备中", () => {
  const catalog = buildCoursePracticeCatalog(fixture());

  assert.equal(catalog[0].chapters[0].status, "not_started");
  assert.equal(catalog[0].chapters[0].hasPublishedContent, true);
  assert.equal(catalog[1].chapters[0].status, "preparing");
  assert.equal(catalog[1].chapters[0].hasPublishedContent, false);
});

test("课程、课时和章节的时间、手动锁定及前置关系都会产生未开放状态", () => {
  const data = fixture();
  data.courses[0].available_from = "2026-08-20T00:00:00.000Z";
  data.courses[0].unlock_mode = "scheduled";
  data.lessons[1].is_manually_locked = true;
  const prerequisiteChapter = {
    ...data.chapters[0],
    id: "chapter-prerequisite",
    slug: "chapter-prerequisite",
  };
  data.chapters.push(prerequisiteChapter, {
    ...data.chapters[0],
    id: "chapter-dependent",
    slug: "chapter-dependent",
    prerequisite_chapter_id: prerequisiteChapter.id,
    unlock_mode: "prerequisite_completed",
    sort_order: 2,
  });

  const catalog = buildCoursePracticeCatalog(data);
  assert.equal(catalog[0].chapters[0].status, "unavailable");
  assert.equal(catalog[0].chapters.at(-1).status, "unavailable");
  assert.equal(catalog[1].chapters[0].status, "unavailable");
});

test("旧章节测试只提供兼容进度，不再承担目录来源", async () => {
  const loaderSource = await readFile(
    new URL("../src/lib/course-practice-catalog.server.ts", import.meta.url),
    "utf8",
  );

  assert.match(loaderSource, /\.from\("courses"\)/);
  assert.match(loaderSource, /\.from\("lessons"\)/);
  assert.match(loaderSource, /\.from\("course_chapters"\)/);
  assert.match(loaderSource, /\.from\("chapter_practice_units"\)/);
  assert.doesNotMatch(loaderSource, /\.from\("chapter_tests"\)/);
});

test("目录中的巩固状态和完成率只读取章节巩固进度表口径", () => {
  const data = fixture({
    attempts: [
      { test_id: "test-a", test_slug: "chapter-0", score: 100, passed: true },
    ],
    ebookProgress: [{ test_slug: "chapter-0", progress_percent: 100 }],
    practiceProgress: [
      {
        course_chapter_id: "chapter-0",
        status: "needs_reinforcement",
        progress_percent: 60,
        mastery_percent: 33.33,
      },
    ],
  });
  const catalog = buildCoursePracticeCatalog(data);
  assert.equal(catalog[0].chapters[0].status, "needs_review");
  assert.equal(catalog[0].chapters[0].progressPercent, 60);
});

test("目录保留具体的时间与前置测试锁定原因", () => {
  const scheduled = fixture();
  scheduled.courses[0].available_from = "2026-08-25T00:00:00.000Z";
  scheduled.courses[0].unlock_mode = "scheduled";
  const scheduledCatalog = buildCoursePracticeCatalog(scheduled);
  assert.equal(
    scheduledCatalog[0].chapters[0].lockedReason,
    "需等到2026年8月25日开放",
  );

  const prerequisite = fixture();
  const source = prerequisite.chapters[0];
  prerequisite.chapters.push({
    ...source,
    id: "chapter-dependent",
    slug: "chapter-dependent",
    title: "前置测试后的章节",
    sort_order: 2,
    unlock_mode: "prerequisite_passed",
    prerequisite_chapter_id: source.id,
  });
  const prerequisiteCatalog = buildCoursePracticeCatalog(prerequisite);
  assert.equal(
    prerequisiteCatalog[0].chapters[1].lockedReason,
    "需先通过前置章节「1章」的测试",
  );
});

test("有进行中记录时优先继续，并展开最近学习所在课程", () => {
  const catalog = buildCoursePracticeCatalog(fixture({
    publishedPracticeChapterIds: new Set(["chapter-0", "chapter-1"]),
    practiceProgress: [
      {
        course_chapter_id: "chapter-0",
        status: "in_progress",
        progress_percent: 40,
        mastery_percent: 20,
        last_practiced_at: "2026-08-18T00:00:00.000Z",
      },
      {
        course_chapter_id: "chapter-1",
        status: "mastered",
        progress_percent: 100,
        mastery_percent: 90,
        last_practiced_at: "2026-08-19T00:00:00.000Z",
      },
    ],
  }));
  assert.deepEqual(getCoursePracticeDirectoryState(catalog), {
    focusCourseId: "course-a",
    focusChapterId: "chapter-0",
    hasInProgress: true,
    expandedCourseId: "course-c",
  });
});

test("新学生没有进度时从第一个可进入章节开始", () => {
  const catalog = buildCoursePracticeCatalog(fixture());
  assert.deepEqual(getCoursePracticeDirectoryState(catalog), {
    focusCourseId: "course-a",
    focusChapterId: "chapter-0",
    hasInProgress: false,
    expandedCourseId: "course-a",
  });
});
