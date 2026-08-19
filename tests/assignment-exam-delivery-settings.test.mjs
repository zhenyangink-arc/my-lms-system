import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("exam task settings are stored on assignment instances", async () => {
  const migration = await source(
    "supabase/migrations/202608190010_assignment_exam_delivery_settings.sql"
  );

  for (const field of [
    "allow_late_submission",
    "max_attempts",
    "shuffle_questions",
    "shuffle_options",
    "grade_release_at",
    "retake_paper_id",
    "retake_starts_at",
    "retake_due_at",
    "retake_score_policy",
    "retake_original_weight_percent",
  ]) {
    assert.match(migration, new RegExp(`learning_assignments[\\s\\S]*${field}`));
  }
  assert.match(migration, /learning_assignment_retake_students/);
  assert.doesNotMatch(migration, /update public\.assessment_papers/);
});

test("late submission and exact attempt limits are enforced by the database", async () => {
  const migration = await source(
    "supabase/migrations/202608190010_assignment_exam_delivery_settings.sql"
  );

  assert.match(
    migration,
    /assignment\.allow_late_submission[\s\S]*submission\.student_id[\s\S]*assignment\.max_attempts/
  );
  assert.match(migration, /p_max_attempts not between 1 and 10/);
  assert.match(migration, /allow_resubmission = coalesce\([\s\S]*p_max_attempts > 1/);
});

test("teacher release form and action validate every new exam setting", async () => {
  const [catalog, action] = await Promise.all([
    source(
      "src/app/dashboard/admin/assignments/AssessmentPaperReleaseCatalog.tsx"
    ),
    source("src/app/dashboard/admin/assignments/paper-actions.ts"),
  ]);

  for (const field of [
    "allow_late_submission",
    "max_attempts",
    "shuffle_questions",
    "shuffle_options",
    "grade_release_at",
    "retake_paper_id",
    "retake_student_ids",
    "retake_score_policy",
  ]) {
    assert.match(catalog, new RegExp(`name=["']${field}["']`));
    assert.match(action, new RegExp(`p_${field}`));
  }
  assert.match(action, /成绩公开时间不能早于提交截止时间/);
  assert.match(action, /补考开始时间不能早于首次截止时间/);
  assert.match(action, /首次成绩占比需要填写 1 至 99/);
});

test("teacher workspace shows the unsubmitted student list for assignments", async () => {
  const workspace = await source(
    "src/app/dashboard/admin/assignments/PaperTypeWorkspace.tsx"
  );

  assert.match(workspace, /submittedStudentIds/);
  assert.match(workspace, /unsubmittedStudents/);
  assert.match(workspace, /未提交 \{unsubmittedStudents\.length\} 人/);
  assert.match(workspace, /\.eq\("assignment_type", paperType\)/);
});
