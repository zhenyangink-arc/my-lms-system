import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAssignmentDetailPath,
  getChapterPracticePath,
  getCourseLearningPath,
  getGradeFeedbackPath,
  getReviewPath,
  getSpecializedPracticePath,
} from "../src/features/student-home-learning/routes.ts";
import { mapCourseContinuationTask } from "../src/features/student-home-learning/api/course-mapper.ts";
import { isStudentNavItemEnabled } from "../src/features/subjects/registry.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("任务链接未指明应用时沿用韩语应用，与改造前一致", () => {
  assert.equal(getAssignmentDetailPath("school", "a-1"), "/school/apps/korean/assignments/a-1");
  assert.equal(getCourseLearningPath("school"), "/school/apps/korean/courses");
  assert.equal(getReviewPath("school"), "/school/apps/korean/practice/review");
  assert.equal(getGradeFeedbackPath("school", null), "/school/apps/korean/grades");
});

test("任务链接按任务所属应用生成", () => {
  assert.equal(
    getAssignmentDetailPath("school", "a-1", "english"),
    "/school/apps/english/assignments/a-1",
  );
  assert.equal(
    getGradeFeedbackPath("school", "a-1", "english"),
    "/school/apps/english/assignments/a-1",
  );
  assert.equal(
    getCourseLearningPath(
      "school",
      {
        categorySlug: "english",
        subcategorySlug: "college-english",
        courseSlug: "college-english-1",
        lessonSlug: "unit-1",
      },
      "english",
    ),
    "/school/apps/english/courses/english/college-english/college-english-1/unit-1",
  );
  assert.equal(getChapterPracticePath("school", null, "math"), "/school/apps/math/practice/course");
  assert.equal(getSpecializedPracticePath("school", null, "math"), "/school/apps/math/practice/skills");
});

test("课程任务的链接跟随任务所属应用", () => {
  const task = mapCourseContinuationTask({
    candidate: {
      sourceId: "lesson-1",
      courseId: "course-1",
      courseChapterId: null,
      courseTitle: "大学英语一",
      lessonTitle: "Unit 1",
      chapterTitle: null,
      categorySlug: "english",
      subcategorySlug: "college-english",
      courseSlug: "college-english-1",
      lessonSlug: "unit-1",
      progressPercent: 0,
      progressStatus: "not_started",
      isAvailable: true,
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
    studentAppId: "app-en",
    appSlug: "english",
    appLabel: "英语学习",
    space: "school",
  });
  assert.equal(task?.appSlug, "english");
  assert.equal(
    task?.href,
    "/school/apps/english/courses/english/college-english/college-english-1/unit-1",
  );
});

test("学生导航栏目查询：没有学科清单的应用返回 null", () => {
  assert.equal(isStudentNavItemEnabled("korean", "practice"), true);
  assert.equal(isStudentNavItemEnabled("english", "practice"), false);
  assert.equal(isStudentNavItemEnabled("english", "courses"), true);
  assert.equal(isStudentNavItemEnabled("math", "courses"), false);
  assert.equal(isStudentNavItemEnabled("university", "practice"), null);
});

test("未开放巩固中心的学科不生成巩固、专项训练、错题复习任务", async () => {
  const service = await source("src/features/student-home-learning/api/service.ts");
  assert.match(service, /isStudentNavItemEnabled\(appSlug, "practice"\) \?\? true/);
  assert.match(service, /const catalogPromise = practiceEnabled/);
  assert.match(service, /getGradeFeedbackPath\(space, row\.assignment_id, appSlug\)/);
});

test("映射函数把任务所属应用传给链接函数", async () => {
  const files = [
    "assignment-exam-mapper",
    "chapter-practice-mapper",
    "course-mapper",
    "review-mapper",
    "specialized-practice-mapper",
  ];
  for (const file of files) {
    const text = await source(`src/features/student-home-learning/api/${file}.ts`);
    const calls = text.match(/get[A-Za-z]+Path\([\s\S]*?\)[,;]/g) ?? [];
    assert.ok(calls.length > 0, file);
    for (const call of calls) assert.match(call, /appSlug\)[,;]$/, `${file}: ${call}`);
  }
  const currentCourse = await source("src/features/student-current-course/api/service.ts");
  assert.match(currentCourse, /lessonSlug: lesson\.slug,\n\s*\}, appSlug\)/);
});

test("门户今日总览汇总所有已开放、已报名的学科应用", async () => {
  const portal = await source("src/app/[space]/page.tsx");
  assert.match(portal, /loadPortalHomeLearningSummaryForApps\(/);
  assert.match(portal, /app\.portalStatus === "active" &&\s*isSubjectSlug\(app\.slug\)/);
  assert.match(portal, /studentAppId: STUDENT_APP_IDS\[app\.slug\]/);
  assert.doesNotMatch(portal, /loadPortalHomeLearningSummary\(/);
  // 只有一个学科时不额外显示学科名，与改造前一致。
  assert.match(portal, /const showTaskAppLabels = summaryApps\.length > 1;/);
});
