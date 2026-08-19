import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  aggregateChapterWeaknesses,
  aggregateSkillWeaknesses,
  buildNextStepSuggestion,
  groupReviewEvidence,
} from "../src/features/teacher-practice-insights/model.ts";

const baseReview = {
  studentId: "student-a",
  courseId: "course-a",
  courseChapterId: "chapter-a",
  chapterTitle: "第一章 发音",
  skill: "grammar",
  sourceType: "teacher_homework",
  status: "pending",
  errorCount: 2,
};

test("复习项目先按冻结维度聚合，再生成班级薄弱能力和章节", () => {
  const grouped = groupReviewEvidence([
    baseReview,
    { ...baseReview, errorCount: 3 },
    {
      ...baseReview,
      studentId: "student-b",
      skill: "listening",
      errorCount: 4,
      sourceType: "specialized_practice",
    },
    { ...baseReview, status: "mastered", errorCount: 20 },
  ]);

  assert.equal(grouped.length, 3);
  assert.equal(
    grouped.find((item) => item.skill === "grammar" && item.status === "pending")
      ?.errorCount,
    5,
  );
  assert.deepEqual(
    aggregateSkillWeaknesses(grouped).map((item) => [item.key, item.errorCount]),
    [
      ["grammar", 5],
      ["listening", 4],
    ],
  );
  assert.deepEqual(aggregateChapterWeaknesses(grouped)[0], {
    key: "chapter-a",
    label: "第一章 发音",
    errorCount: 9,
    unmasteredCount: 2,
    affectedStudentCount: 2,
  });
});

test("下一步建议会随学生真实最高薄弱能力和章节变化", () => {
  const grammarSuggestion = buildNextStepSuggestion([], [
    baseReview,
    { ...baseReview, errorCount: 4 },
    {
      ...baseReview,
      skill: "listening",
      courseChapterId: "chapter-b",
      chapterTitle: "第二章 问候",
      sourceType: "specialized_practice",
      errorCount: 1,
    },
  ]);
  assert.equal(grammarSuggestion.skill, "grammar");
  assert.equal(grammarSuggestion.chapterId, "chapter-a");
  assert.match(grammarSuggestion.text, /语法有 6 次未掌握错误/);
  assert.match(grammarSuggestion.text, /第一章 发音/);

  const listeningSuggestion = buildNextStepSuggestion([], [
    {
      ...baseReview,
      skill: "listening",
      courseChapterId: "chapter-b",
      chapterTitle: "第二章 问候",
      sourceType: "specialized_practice",
      errorCount: 8,
    },
  ]);
  assert.equal(listeningSuggestion.skill, "listening");
  assert.equal(listeningSuggestion.chapterId, "chapter-b");
  assert.match(listeningSuggestion.text, /听力有 8 次未掌握错误/);
  assert.doesNotMatch(listeningSuggestion.text, /语法有 6 次/);
});

test("口语写作建议读取真实 improvementTask，错题为空时回退真实掌握度", () => {
  const feedbackSuggestion = buildNextStepSuggestion([], [
    {
      ...baseReview,
      skill: "writing",
      sourceType: "teacher_speaking_writing_feedback",
      errorCount: 1,
      feedbackSnapshot: {
        rubric: { coherence: 2 },
        teacherComment: "连接语不足。",
        overallComment: "结构需要调整。",
        improvementTask: "补写两个连接句。",
      },
    },
  ]);
  assert.match(feedbackSuggestion.text, /补写两个连接句/);

  const progressSuggestion = buildNextStepSuggestion(
    [
      {
        studentId: "student-a",
        courseId: "course-a",
        courseTitle: "韩国语一级",
        courseSlug: "korean-one",
        courseChapterId: "chapter-c",
        chapterTitle: "第三章 位置",
        chapterSlug: "chapter-three",
        status: "needs_reinforcement",
        progressPercent: 70,
        masteryPercent: 42,
        lastPracticedAt: null,
      },
    ],
    [],
  );
  assert.equal(progressSuggestion.skill, null);
  assert.equal(progressSuggestion.chapterId, "chapter-c");
  assert.match(progressSuggestion.text, /掌握度为 42%/);
});

test("老师入口、RLS 数据源和现有学生可见学习计划机制保持契约", async () => {
  const [workspace, route, action, migration] = await Promise.all([
    readFile("src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx", "utf8"),
    readFile("src/app/[space]/dashboard/admin/apps/[appSlug]/practice-insights/page.tsx", "utf8"),
    readFile("src/features/teacher-practice-insights/actions.ts", "utf8"),
    readFile("supabase/migrations/202608190016_student_practice_progress_and_review_items.sql", "utf8"),
  ]);

  assert.match(workspace, /key: "practice-insights"/);
  assert.match(workspace, /tenantTeacherOnly: true/);
  assert.match(route, /context\.access\.role !== "teacher"/);
  assert.match(action, /getTeacherAssignedStudentIds/);
  assert.match(action, /\.from\("student_review_items"\)/);
  assert.match(action, /\.from\("student_chapter_practice_progress"\)/);
  assert.match(action, /supabase\.rpc\("save_learning_record_note"/);
  assert.match(action, /p_visibility: "student_visible"/);
  assert.match(migration, /private\.current_user_can_view_student_activity/);
});
