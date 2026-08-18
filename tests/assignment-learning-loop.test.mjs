import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("student drafts are saved locally and in the authenticated cloud endpoint", async () => {
  const form = await source(
    "src/app/dashboard/assignments/AssignmentSubmissionForm.tsx"
  );
  const route = await source(
    "src/app/api/assignments/[assignmentId]/draft/route.ts"
  );
  const migration = await source(
    "supabase/migrations/202608190005_assignment_learning_loop.sql"
  );

  assert.match(form, /window\.localStorage\.setItem/);
  assert.match(form, /\/api\/assignments\/\$\{assignmentId\}\/draft/);
  assert.match(form, /云端已保存/);
  assert.match(route, /requireActiveUser/);
  assert.match(route, /save_learning_assignment_draft/);
  assert.match(migration, /create table if not exists public\.learning_assignment_drafts/);
  assert.match(migration, /learning_submissions_clear_draft/);
});

test("chapter completion creates a per-student assignment deadline", async () => {
  const migration = await source(
    "supabase/migrations/202608190005_assignment_learning_loop.sql"
  );
  const board = await source(
    "src/app/dashboard/assignments/AssignmentBoard.tsx"
  );

  assert.match(migration, /course_ebook_progress[\s\S]*completed_at/);
  assert.match(migration, /due_days_after_unlock/);
  assert.match(migration, /current_user_assignment_window/);
  assert.match(board, /完成对应章节学习后解锁/);
});

test("paper release is blocked until the authoritative quality checks pass", async () => {
  const migration = await source(
    "supabase/migrations/202608190005_assignment_learning_loop.sql"
  );
  const catalog = await source(
    "src/app/dashboard/admin/assignments/AssessmentPaperReleaseCatalog.tsx"
  );

  assert.match(migration, /validate_assessment_paper_release/);
  assert.match(migration, /'allSkills', v_all_skills/);
  assert.match(migration, /'listeningReady', v_listening_ready/);
  assert.match(catalog, /质检未通过/);
  assert.match(catalog, /题量与总分快照一致/);
  assert.match(catalog, /六项学习内容齐全/);
});

test("grading prioritizes subjective work and supports feedback shortcuts", async () => {
  const grading = await source(
    "src/app/dashboard/admin/assignments/SubmissionGradingForm.tsx"
  );
  const review = await source(
    "src/app/dashboard/admin/assignments/[assignmentId]/page-content.tsx"
  );
  const audio = await source(
    "src/app/dashboard/admin/assignments/SubmittedAudioAnswer.tsx"
  );

  assert.match(grading, /manualAnswers/);
  assert.match(grading, /常用评语/);
  assert.match(review, /待批改快速跳转/);
  assert.match(review, /AssignmentSkillSummary/);
  assert.match(audio, /0\.8, 1, 1\.25/);
});

test("graded objective mistakes support guarded remediation practice", async () => {
  const migration = await source(
    "supabase/migrations/202608190005_assignment_learning_loop.sql"
  );
  const practice = await source(
    "src/app/dashboard/assignments/AssignmentRemediationPractice.tsx"
  );

  assert.match(migration, /learning_assignment_remediation_attempts/);
  assert.match(migration, /submit_assignment_remediation_answer/);
  assert.match(migration, /v_attempt_count >= 2/);
  assert.match(practice, /错题重练/);
  assert.match(practice, /CardTitleWithHint/);
});
