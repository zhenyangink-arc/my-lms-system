import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("speaking and writing rubric totals are enforced by the database", async () => {
  const migration = await source(
    "supabase/migrations/202608190013_assignment_rubric_grading_and_release.sql"
  );
  const form = await source(
    "src/app/dashboard/admin/assignments/SubmissionGradingForm.tsx"
  );

  for (const key of [
    "pronunciation_accuracy",
    "fluency",
    "grammar_vocabulary",
    "task_completion",
    "content_completeness",
    "grammar_accuracy",
    "vocabulary_use",
    "organization_expression",
    "spelling_format",
  ]) {
    assert.match(migration, new RegExp(key));
    assert.match(form, new RegExp(key));
  }
  assert.match(migration, /before insert or update of question_id, awarded_points, rubric_scores/);
  assert.match(migration, /if v_total <> new\.awarded_points/);
  assert.match(migration, /分项分数之和必须与单题总分一致/);
  assert.match(form, /本题总得分/);
  assert.match(form, /kind \? \([\s\S]*rubric_kind_[\s\S]*\) : \([\s\S]*name={`score_/);
});

test("tenant grading comments have seeded CRUD storage and server actions", async () => {
  const migration = await source(
    "supabase/migrations/202608190013_assignment_rubric_grading_and_release.sql"
  );
  const actions = await source(
    "src/app/dashboard/admin/assignments/grading-actions.ts"
  );
  const page = await source(
    "src/app/dashboard/admin/assignments/[assignmentId]/page-content.tsx"
  );

  assert.match(migration, /create table public\.learning_grading_comments/);
  assert.match(migration, /tenant_id uuid not null/);
  assert.match(migration, /整体完成认真，继续保持。/);
  assert.match(migration, /create_learning_grading_comment/);
  assert.match(migration, /update_learning_grading_comment/);
  assert.match(migration, /delete_learning_grading_comment/);
  assert.match(actions, /create_learning_grading_comment/);
  assert.match(actions, /update_learning_grading_comment/);
  assert.match(actions, /delete_learning_grading_comment/);
  assert.match(page, /learning_grading_comments/);
});

test("grade release is a separate action available only after grading completes", async () => {
  const migration = await source(
    "supabase/migrations/202608190013_assignment_rubric_grading_and_release.sql"
  );
  const actions = await source("src/app/dashboard/assignments/actions.ts");
  const form = await source(
    "src/app/dashboard/admin/assignments/SubmissionGradingForm.tsx"
  );

  assert.match(migration, /create or replace function public\.release_learning_submission_grade/);
  assert.match(migration, /v_submission\.submission_state <> 'grading_completed'/);
  assert.match(migration, /answer\.awarded_points is null/);
  assert.match(migration, /grade_release_confirmed_at is not null/);
  assert.match(actions, /releaseLearningSubmissionGradeAction/);
  assert.match(actions, /release_learning_submission_grade/);
  assert.match(form, /submissionState === "grading_completed"/);
  assert.match(form, /确认发布成绩/);
  assert.match(form, /客观题暂定成绩/);
  assert.match(form, /待批改主观题/);
});

test("student grading reads use database-enforced safe projections", async () => {
  const migration = await source(
    "supabase/migrations/202608200001_assignment_grade_release_rls.sql"
  );
  const page = await source(
    "src/app/dashboard/assignments/[assignmentId]/page-content.tsx"
  );
  const list = await source("src/app/dashboard/assignments/page-content.tsx");
  const actions = await source("src/app/dashboard/assignments/actions.ts");
  const records = await source("src/app/dashboard/records/page-content.tsx");

  assert.match(migration, /learning_submissions\.submission_state = 'grade_released'/);
  assert.match(migration, /submission\.submission_state = 'grade_released'/);
  assert.match(migration, /create view public\.student_learning_submissions/);
  assert.match(migration, /create view public\.student_learning_submission_answers/);
  assert.match(migration, /with \(security_barrier = true\)/);
  assert.match(migration, /when question\.auto_graded[\s\S]*then answer\.awarded_points/);
  assert.match(migration, /when submission\.submission_state = 'grade_released'[\s\S]*then answer\.rubric_scores/);
  assert.match(migration, /when submission\.submission_state = 'grade_released'[\s\S]*then answer\.grader_feedback/);
  assert.match(migration, /student_review_item_grade_is_released/);
  assert.match(migration, /submission\.id::text = p_content_snapshot ->> 'sourceSubmissionId'/);
  assert.match(migration, /drop policy if exists "authorized users read student review items"/);
  assert.match(migration, /drop policy if exists "students update own review items"/);
  assert.match(migration, /revoke all on public\.student_learning_submissions from public, anon/);
  assert.match(migration, /grant select on public\.student_learning_submission_answers to authenticated/);

  assert.match(page, /from\("student_learning_submissions"\)/);
  assert.match(page, /from\("student_learning_submission_answers"\)/);
  assert.match(list, /from\("student_learning_submissions"\)/);
  assert.match(actions, /from\("student_learning_submissions"\)/);
  assert.match(records, /from\("student_learning_submissions"\)/);
});
