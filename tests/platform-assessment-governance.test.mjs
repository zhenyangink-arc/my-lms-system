import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("only the platform owner can release papers and released snapshots are frozen", async () => {
  const migration = await source(
    "supabase/migrations/202608190006_platform_assessment_release_governance.sql"
  );

  assert.match(
    migration,
    /current_user_can_release_assessment_papers[\s\S]*private\.is_platform_owner\(\)/
  );
  assert.match(migration, /assessment_papers_release_owner/);
  assert.match(migration, /assessment_papers_release_quality/);
  assert.match(migration, /已发布或已停止提供的试卷内容不可直接修改/);
  assert.match(migration, /left\(v_source\.title \|\| '（新版本）'/);
  assert.match(migration, /v_source\.version \+ 1/);
});

test("institutions read only released papers for active authorized apps", async () => {
  const [migration, page] = await Promise.all([
    source(
      "supabase/migrations/202608190006_platform_assessment_release_governance.sql"
    ),
    source(
      "src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx"
    ),
  ]);

  assert.match(
    migration,
    /status = 'published'[\s\S]*tenant_student_apps[\s\S]*manage_assessments/
  );
  assert.match(page, /access\.scope === "tenant"/);
  assert.match(page, /paperQuery = paperQuery\.eq\("status", "published"\)/);
  assert.match(page, /access\.globalRole === "platform_owner"/);
  assert.match(page, /PlatformAssessmentPaperCatalog/);
});

test("teachers can publish only to assigned selected students", async () => {
  const [migration, catalog, workspace] = await Promise.all([
    source(
      "supabase/migrations/202608190006_platform_assessment_release_governance.sql"
    ),
    source(
      "src/app/dashboard/admin/assignments/AssessmentPaperReleaseCatalog.tsx"
    ),
    source("src/app/dashboard/admin/assignments/PaperTypeWorkspace.tsx"),
  ]);

  assert.match(
    migration,
    /current_profile_role\(\) = 'teacher'[\s\S]*p_target_scope <> 'selected_students'/
  );
  assert.match(migration, /current_teacher_has_student_app_access/);
  assert.match(catalog, /canTargetAllStudents/);
  assert.match(workspace, /canTargetAllStudents=\{access\.role !== "teacher"\}/);
});

test("chapter homework publishing is owner-only and published content is not edited in place", async () => {
  const [workspace, action, button] = await Promise.all([
    source("src/app/dashboard/admin/assignments/HomeworkChapterWorkspace.tsx"),
    source("src/app/dashboard/admin/assignments/homework-plan-actions.ts"),
    source(
      "src/app/dashboard/admin/assignments/ChapterHomeworkPublishButton.tsx"
    ),
  ]);

  assert.match(workspace, /plan\.status === "draft"/);
  assert.match(workspace, /内容已冻结/);
  assert.match(action, /if \(!canReleasePapers\)/);
  assert.match(action, /已发布版本不可直接修改/);
  assert.match(button, /等待负责人发布/);
});
