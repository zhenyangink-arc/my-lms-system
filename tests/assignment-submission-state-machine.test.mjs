import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("submission allocation is serialized and the max-attempt check is inside the lock", async () => {
  const migration = await source(
    "supabase/migrations/202608190011_assignment_submission_state_machine.sql"
  );

  assert.match(migration, /learning_assignment_submission_counters/);
  assert.match(
    migration,
    /select counter\.attempt_count[\s\S]*for update;[\s\S]*if v_attempt >= v_assignment\.max_attempts/
  );
  assert.match(
    migration,
    /v_attempt := v_attempt \+ 1;[\s\S]*attempt_number[\s\S]*v_attempt/
  );
});

test("a repeated request returns the committed submission before enforcing the limit", async () => {
  const migration = await source(
    "supabase/migrations/202608190011_assignment_submission_state_machine.sql"
  );
  const action = await source("src/app/dashboard/assignments/actions.ts");
  const form = await source(
    "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx"
  );

  const replayLookup = migration.indexOf("and submission.request_id = p_request_id");
  const attemptLimit = migration.indexOf("if v_attempt >= v_assignment.max_attempts");
  assert.ok(replayLookup > 0 && replayLookup < attemptLimit);
  assert.match(migration, /'idempotent', true/);
  assert.match(migration, /learning_submissions_request_id_key/);
  assert.match(action, /p_request_id: submissionRequestId/);
  assert.match(form, /name="submission_request_id"/);
});

test("draft, grading, and release states are persisted and consumed after refresh", async () => {
  const migration = await source(
    "supabase/migrations/202608190011_assignment_submission_state_machine.sql"
  );
  const boardPage = await source(
    "src/app/dashboard/assignments/page-content.tsx"
  );
  const detailPage = await source(
    "src/app/dashboard/assignments/[assignmentId]/page-content.tsx"
  );

  for (const state of [
    "in_progress",
    "submitted_pending_grading",
    "objective_graded_pending_manual",
    "grading_completed",
    "grade_released",
  ]) {
    assert.match(migration, new RegExp(state));
  }
  assert.match(migration, /learning_assignment_drafts_sync_progress/);
  assert.match(migration, /learning_submissions_sync_progress/);
  assert.match(boardPage, /learning_assignment_progress/);
  assert.match(detailPage, /submission_state/);
  assert.match(detailPage, /release_current_user_due_assignment_grades/);
});

