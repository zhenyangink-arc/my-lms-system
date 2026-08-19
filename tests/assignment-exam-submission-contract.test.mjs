import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("exam start is an idempotent server timestamp protected by the attempt lock", async () => {
  const migration = await source(
    "supabase/migrations/202608190012_assignment_exam_authoritative_timing.sql",
  );
  assert.match(migration, /current_attempt_started_at timestamptz/);
  assert.match(migration, /start_learning_assignment_attempt/);
  assert.match(
    migration,
    /current_attempt_started_at[\s\S]*for update;[\s\S]*if v_started_at is null/,
  );
  assert.match(migration, /'startedAt', v_started_at/);
  assert.match(migration, /'idempotent', v_idempotent/);
});

test("expired and explicitly confirmed exam submissions can preserve empty answers", async () => {
  const migration = await source(
    "supabase/migrations/202608190012_assignment_exam_authoritative_timing.sql",
  );
  const action = await source("src/app/dashboard/assignments/actions.ts");
  assert.match(migration, /submission_intent in \('complete', 'confirmed_incomplete', 'time_expired'\)/);
  assert.match(migration, /char_length\(answer_text\) between 0 and 10000/);
  assert.match(migration, /if new\.answer_text = ''[\s\S]*new\.awarded_points := 0/);
  assert.match(migration, /v_answer_text <> '' and v_question_type = 'single_choice'/);
  assert.match(action, /p_submission_intent: submissionIntent/);
});

test("incomplete intent cannot bypass opening, engagement, or expiry grace", async () => {
  const migration = await source(
    "supabase/migrations/202608190012_assignment_exam_authoritative_timing.sql",
  );
  assert.match(migration, /v_assignment\.starts_at > now\(\)/);
  assert.match(migration, /v_attempt_started_at is null/);
  assert.match(migration, /v_answered_count = 0/);
  assert.match(migration, /make_interval\(secs => v_assignment\.duration_minutes \* 6\)/);
  assert.match(migration, /v_authoritative_deadline \+ interval '5 minutes'/);
});

test("the form starts and resumes from server timing instead of a local start key", async () => {
  const form = await source(
    "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx",
  );
  assert.match(form, /\/api\/assignments\/\$\{assignmentId\}\/start/);
  assert.match(form, /payload\.startedAt/);
  assert.match(form, /payload\.serverNow/);
  assert.match(form, /name="submission_intent"/);
  assert.doesNotMatch(form, /learning-assignment-exam-start/);
});
