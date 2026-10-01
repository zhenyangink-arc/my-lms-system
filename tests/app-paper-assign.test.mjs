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

test("数学学生端：作业路由与英语一致且按数学应用读取；数学题型有标签与专用输入", () => {
  for (const file of ["assignments/page.tsx", "assignments/[assignmentId]/page.tsx", "assignments/[assignmentId]/layout.tsx"]) {
    const text = read(`src/app/[space]/apps/math/${file}`);
    assert.match(text, /"math"/, file);
    assert.doesNotMatch(text, /english|korean|English/i, file);
  }
  const config = read("src/app/dashboard/assignments/config.ts");
  assert.match(config, /"math\.expression": "表达式作答"/);
  assert.match(config, /"math\.numeric": "数值作答"/);
  const form = read("src/app/dashboard/assignments/AssignmentSubmissionForm.tsx");
  assert.match(form, /question\.type === "math\.expression" \|\| question\.type === "math\.numeric"/);
  assert.match(form, /maxLength=\{200\}/);
  // 其余题型的输入保持不变（含原有的短答提示）
  assert.match(form, /placeholder=\{question\.type === "file_link" \? "粘贴完整文件链接" : "填写韩语答案"\}/);
});

test("非韩语应用的作业详情链接指向本应用；韩语沿用旧路径（行为不变）", () => {
  const list = read("src/app/dashboard/assignments/page-content.tsx");
  assert.match(list, /studentAppSlug !== "korean" && tenant\s*\?\s*getStudentAppPath\(tenant\.slug, studentAppSlug, "assignments"\)\s*:\s*undefined/);
  const board = read("src/app/dashboard/assignments/AssignmentBoard.tsx");
  assert.match(board, /\$\{assignmentHrefBase \?\? "\/dashboard\/assignments"\}\/\$\{item\.id\}/);
  const detail = read("src/app/dashboard/assignments/[assignmentId]/page-content.tsx");
  assert.match(detail, /space && studentAppSlug !== "korean" \? getStudentAppPath\(space, studentAppSlug, "assignments"\) : "\/dashboard\/assignments"/);
});
