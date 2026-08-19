import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202608190017_unified_student_review_center.sql",
  import.meta.url,
);
const progressServicePath = new URL(
  "../src/features/chapter-practice/student/progress-service.ts",
  import.meta.url,
);
const reviewActionPath = new URL(
  "../src/features/student-review-center/actions.ts",
  import.meta.url,
);
const listeningActionPath = new URL(
  "../src/features/chapter-practice/listening-actions.ts",
  import.meta.url,
);

test("统一错题迁移覆盖真实来源、历史收藏与非阻断归集", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const source of [
    "chapter_quiz",
    "teacher_homework",
    "formal_chapter_exam",
    "stage_exam",
    "midterm_exam",
    "final_exam",
    "specialized_practice",
    "practice_self_check",
    "student_bookmark",
    "teacher_speaking_writing_feedback",
  ]) {
    assert.match(sql, new RegExp(`'${source}'`), `${source} must be mapped`);
  }
  assert.match(sql, /chapter_test_attempts_capture_review_items/i);
  assert.match(sql, /toolbox_practice_attempts_capture_review_item/i);
  assert.match(sql, /learning_submissions_capture_review_items/i);
  assert.match(sql, /chapter_test_question_reviews_capture_unified_item/i);
  assert.match(sql, /exception\s+when\s+others\s+then\s+raise\s+warning/gi);
  assert.match(sql, /migrate_chapter_test_question_reviews_to_review_items/);
  assert.match(sql, /record_student_practice_listening_reviews/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.chapter_test_question_reviews/i);
  assert.doesNotMatch(sql, /update\s+public\.chapter_test_question_reviews/i);
});

test("听辨进度成功后非阻断归集错题", async () => {
  const source = await readFile(listeningActionPath, "utf8");
  const progressWrite = source.indexOf("recordStudentChapterPracticeProgress");
  const reviewWrite = source.lastIndexOf("record_student_practice_listening_reviews");
  assert.ok(progressWrite >= 0 && reviewWrite > progressWrite);
  assert.match(source, /try\s*{[\s\S]*record_student_practice_listening_reviews[\s\S]*}\s*catch/);
  assert.match(source, /console\.warn\("听辨进度已保存，但错题归集失败"/);
});

test("巩固自测归集失败不会改变原进度保存结果", async () => {
  const source = await readFile(progressServicePath, "utf8");
  const progressWrite = source.indexOf("student_chapter_practice_progress");
  const reviewWrite = source.indexOf("record_student_practice_self_check_review");
  assert.ok(progressWrite >= 0 && reviewWrite > progressWrite);
  assert.match(source, /try\s*{[\s\S]*record_student_practice_self_check_review[\s\S]*}\s*catch/);
  assert.match(source, /console\.warn\("巩固自测已保存，但错题归集失败"/);
});

test("重新掌握操作使用学生会话和 RLS 约束更新状态", async () => {
  const source = await readFile(reviewActionPath, "utf8");
  assert.match(source, /requireActiveUser\(\)/);
  assert.match(source, /profile\?\.role !== "student"/);
  assert.match(source, /\.eq\("student_id", user\.id\)/);
  assert.match(source, /status: "mastered"/);
  assert.match(source, /mastered_at: now/);
  assert.match(source, /last_reviewed_at: now/);
});
