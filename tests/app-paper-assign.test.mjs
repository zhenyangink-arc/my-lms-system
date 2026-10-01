import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const page = read("src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx");
const panel = read("src/app/dashboard/admin/apps/AppPaperAssignPanel.tsx");

test("机构视图的布置入口：不再指向已失效的 /admin/assignments，改为页内布置面板", () => {
  assert.doesNotMatch(page, /admin\/assignments`/);
  assert.doesNotMatch(page, /去布置作业或考试/);
  assert.match(page, /<AppPaperAssignPanel/);
  assert.match(page, /canAssignPapers &&/);
});

test("布置面板的数据按本应用读取，且只在机构视图、有测评权限时读取", () => {
  assert.match(page, /const canAssignPapers =\s*access\.scope === "tenant" && access\.capabilities\.manageAssessments/);
  assert.match(page, /list_learning_assignment_students_by_app",\s*\{\s*p_student_app_id: access\.appId/);
  assert.match(page, /\.from\("courses"\)[\s\S]*?\.eq\("student_app_id", access\.appId\)[\s\S]*?\.eq\("is_published", true\)/);
  assert.match(page, /canTargetAllStudents=\{access\.role !== "teacher"\}/);
});

test("布置面板沿用原有布置动作，不自带权限或试卷判断，也不含补考与解锁选项", () => {
  assert.match(panel, /publishAssessmentPaperAction\.bind\(null, paper\.paperType\)/);
  for (const name of ["paper_id", "target_scope", "target_ids", "starts_at", "due_at", "institution_note"]) {
    assert.match(panel, new RegExp(`name="${name}"`), name);
  }
  for (const name of ["max_attempts", "grade_release_at"]) assert.match(panel, new RegExp(`name="${name}"`), name);
  assert.doesNotMatch(panel, /retake|unlock_after_chapter_completion/);
  assert.doesNotMatch(panel, /\.rpc\(|supabase/);
});

test("考试专有字段只在考试卷出现；指定学生时没有选人则不能发布", () => {
  assert.match(panel, /\{isExam && \(/);
  assert.match(panel, /scope === "selected_students" && chosen\.size === 0/);
});

test("韩语、英语页面其余部分不变：制作标准试卷仍走原有编辑器分支", () => {
  assert.equal((page.match(/<AssessmentPaperComposer/g) ?? []).length, 2);
  assert.match(page, /canPrepareStandardPapers &&\s*!subjectAssessmentAuthoring &&\s*!testResult\.error/);
});
