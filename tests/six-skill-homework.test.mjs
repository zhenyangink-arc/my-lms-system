import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("chapter homework is generated from every vocabulary item and two grammar rounds", async () => {
  const migration = await source(
    "supabase/migrations/202608180034_six_skill_chapter_homework.sql"
  );
  assert.match(migration, /jsonb_array_elements\(node\.content -> 'vocabulary'\)/);
  assert.match(migration, /cross join generate_series\(1, 2\) as round_no/);
  assert.match(
    migration,
    /'vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'/
  );
  assert.match(migration, /publish_chapter_homework_plan/);
});

test("teacher release defaults to chapter-completion unlock", async () => {
  const catalog = await source(
    "src/app/dashboard/admin/assignments/AssessmentPaperReleaseCatalog.tsx"
  );
  const action = await source(
    "src/app/dashboard/admin/assignments/paper-actions.ts"
  );
  assert.match(catalog, /name="unlock_after_chapter_completion"/);
  assert.match(catalog, /defaultChecked/);
  assert.match(action, /create_learning_assignment_from_paper_with_unlock/);
  assert.match(action, /p_unlock_after_chapter_completion/);
});

test("student homework supports six sections and direct speaking recording", async () => {
  const form = await source(
    "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx"
  );
  const recorder = await source(
    "src/app/dashboard/assignments/AssignmentAudioRecorder.tsx"
  );
  for (const skill of [
    "vocabulary",
    "grammar",
    "listening",
    "speaking",
    "reading",
    "writing",
  ]) {
    assert.match(form, new RegExp(`"${skill}"`));
  }
  assert.match(form, /AssignmentAudioRecorder/);
  assert.match(recorder, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(recorder, /\/api\/assignments\/\$\{assignmentId\}\/recordings/);
});

test("homework optimization uses genuine listening, draft recovery, and database grading", async () => {
  const form = await source(
    "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx"
  );
  const player = await source(
    "src/app/dashboard/assignments/AssignmentListeningPlayer.tsx"
  );
  const migration = await source(
    "supabase/migrations/202608190001_homework_v11_grading_and_integrity.sql"
  );
  const listeningFix = await source(
    "supabase/migrations/202608190004_fix_listening_backfill_trigger_order.sql"
  );
  assert.match(form, /learning-assignment-draft:/);
  assert.match(form, /作答进度/);
  assert.match(player, /speechSynthesis/);
  assert.doesNotMatch(player, />\{script\}</);
  assert.match(migration, /digital_textbook_activity_secrets/);
  assert.match(migration, /learning_submission_answers_prepare/);
  assert.match(migration, /consumed_submission_id/);
  assert.doesNotMatch(
    listeningFix,
    /(?:chapter|version|textbook)\.status\s*=\s*'published'/,
    "draft textbook listening activities must remain eligible for backfill"
  );
  assert.ok(
    listeningFix.indexOf("update public.chapter_homework_skill_settings") <
      listeningFix.indexOf("delete from public.chapter_homework_questions"),
    "settings trigger must run before the canonical listening replacement"
  );
});
