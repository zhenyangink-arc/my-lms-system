import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("student completion page stays inside the existing Korean grades route", async () => {
  const [route, grades] = await Promise.all([
    source("src/app/[space]/apps/korean/grades/completion/page.tsx"),
    source("src/app/dashboard/grades/page-content.tsx"),
  ]);

  assert.match(route, /getStudentCompletionData/);
  assert.match(route, /access\.role !== "student"/);
  assert.match(grades, /href="grades\/completion"/);
  assert.match(grades, /结课资格与证书/);
});

test("student queries are explicitly scoped to the signed-in student and existing RLS", async () => {
  const [service, certificatesMigration, evaluationsMigration] = await Promise.all([
    source("src/features/course-completion/student-service.ts"),
    source("supabase/migrations/202608200006_course_completion_certificates.sql"),
    source("supabase/migrations/202608200003_course_completion_policies_and_evaluations.sql"),
  ]);

  for (const table of [
    "student_course_completion_evaluations",
    "course_completion_certificates",
  ]) {
    assert.match(service, new RegExp(`from\\(\\\"${table}\\\"\\)[\\s\\S]*?\\.eq\\(\\\"student_id\\\", studentId\\)`));
  }
  assert.match(service, /\.eq\("tenant_id", tenantId\)/);
  assert.match(service, /\.eq\("student_app_id", appId\)/);
  assert.match(certificatesMigration, /students read own completion certificates/);
  assert.match(evaluationsMigration, /students read own completion evaluations/);
  assert.doesNotMatch(service, /createAdminClient|service_role/);
});

test("completion UI includes four conclusions, canonical exams, status icons and accessible hints", async () => {
  const [page, service] = await Promise.all([
    source("src/features/course-completion/StudentCompletionPage.tsx"),
    source("src/features/course-completion/student-service.ts"),
  ]);

  for (const text of ["未满足", "等待批改", "符合资格", "已颁发"]) {
    assert.match(page, new RegExp(text));
  }
  assert.match(service, /EX-K1-MID-V1/);
  assert.match(service, /EX-K1-FIN-V1/);
  assert.match(page, /已提交，无需重复提交/);
  assert.match(page, /CardTitleWithHint/);
  assert.match(page, /下一步：/);
  assert.match(page, />\s*去完成\s*</);
  assert.match(page, /gap\.status === "pending_grading"/);
  for (const status of ["等待批改", "未通过", "进行中", "未完成"]) {
    assert.match(page, new RegExp(status));
  }
  assert.match(page, /CheckCircle2/);
  assert.match(page, /Clock3/);
  assert.match(page, /CircleX/);
  assert.doesNotMatch(page, /eyebrow|typeLabel|interactionLabel/);
});

test("certificate screen and print layouts are separate", async () => {
  const [page, styles] = await Promise.all([
    source("src/features/course-completion/StudentCompletionPage.tsx"),
    source("src/app/globals.css"),
  ]);

  assert.match(page, /completion-screen-page/);
  assert.match(page, /completion-print-root/);
  assert.match(page, /颁发机构/);
  assert.match(page, /证书编号/);
  assert.match(page, /已被新证书替代/);
  assert.match(page, /已撤销/);
  assert.match(styles, /@media print/);
  assert.match(styles, /size: A4 landscape/);
  assert.match(styles, /body:has\(\.completion-print-root\)/);
});

test("student completion browser audit covers phone, tablet, desktop, keyboard hints and print", async () => {
  const script = await source("scripts/verify-student-course-completion-ui.mjs");

  for (const width of [375, 768, 1280]) {
    assert.match(script, new RegExp(`width: ${width}`));
  }
  assert.match(script, /control\.width < 44 \|\| item\.height < 44|item\.width < 44 \|\| item\.height < 44/);
  assert.match(script, /getByRole\("tooltip"\)/);
  assert.match(script, /keyboard\.press\("Escape"\)/);
  assert.match(script, /emulateMedia\(\{ media: "print" \}\)/);
});
