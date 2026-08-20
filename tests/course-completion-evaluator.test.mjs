import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("completion RPC is service-role only and idempotent by evidence fingerprint", async () => {
  const migration = await source(
    "supabase/migrations/202608200004_single_student_completion_evaluator.sql",
  );

  assert.match(migration, /evaluation_fingerprint text/);
  assert.match(migration, /student_course_completion_evaluations_idempotency_key/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /status = 'superseded'/);
  assert.match(
    migration,
    /revoke all on function public\.evaluate_student_course_completion[\s\S]*authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.evaluate_student_course_completion[\s\S]*service_role/,
  );
});

test("only released grades can enter completion evidence", async () => {
  const migration = await source(
    "supabase/migrations/202608200004_single_student_completion_evaluator.sql",
  );

  assert.match(migration, /submission\.submission_state = 'grade_released'/);
  assert.match(migration, /submission\.grade_released_at is not null/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.evaluate_student_course_completion[\s\S]*/)?.[0] ?? "",
    /computed_score/,
  );
  assert.match(migration, /completion_evidence_uses_released_scores/);
  assert.match(migration, /student_course_completion_evaluations_released_scores_check/);
  assert.match(migration, /pending_grading/);
});

test("canonical mother-paper ids and configured retake strategies drive scores", async () => {
  const migration = await source(
    "supabase/migrations/202608200004_single_student_completion_evaluator.sql",
  );

  assert.match(migration, /paper\.id = assignment\.source_paper_id/);
  assert.match(migration, /paper\.paper_code = assignment\.source_paper_code/);
  assert.match(migration, /EX-K1-MID-V1/);
  assert.match(migration, /EX-K1-FIN-V1/);
  assert.match(migration, /retake_score_policy = 'highest'/);
  assert.match(migration, /retake_score_policy = 'latest'/);
  assert.match(migration, /retake_score_policy = 'weighted'/);
  assert.doesNotMatch(migration, /title\s+(?:ilike|like)/i);
});

test("textbook completion follows real digital textbook chapters, not assessment snapshots", async () => {
  const migration = await source(
    "supabase/migrations/202608200004_single_student_completion_evaluator.sql",
  );

  const evaluator =
    migration.match(
      /create or replace function public\.evaluate_student_course_completion[\s\S]*/,
    )?.[0] ?? "";
  assert.match(evaluator, /public\.digital_textbook_chapters as chapter/);
  assert.match(evaluator, /test\.id = chapter\.chapter_test_id/);
  assert.match(evaluator, /public\.course_ebook_progress as progress/);
  assert.match(evaluator, /progress\.test_slug = canonical\.slug/);
  assert.doesNotMatch(
    evaluator,
    /test\.chapter_number = expected\.chapter_number[\s\S]{0,240}test\.status = 'published'/,
  );
});

test("structured gaps use natural-language reasons and existing route families", async () => {
  const [migration, types, legacyRoute, assignmentRoute, gradeRoute, courseRoute] =
    await Promise.all([
      source(
        "supabase/migrations/202608200004_single_student_completion_evaluator.sql",
      ),
      source("src/features/course-completion/types.ts"),
      source("src/app/dashboard/[...rest]/page.tsx"),
      source("src/app/[space]/apps/korean/assignments/[assignmentId]/page.tsx"),
      source("src/app/[space]/apps/korean/grades/page.tsx"),
      source(
        "src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx",
      ),
    ]);

  assert.ok(
    legacyRoute.includes("buildLegacyStudentAppTarget") &&
      assignmentRoute.length > 0 &&
      gradeRoute.length > 0 &&
      courseRoute.length > 0,
  );
  assert.match(types, /export type CompletionRequirementGap/);
  assert.match(types, /href\?: string/);
  assert.match(migration, /尚未布置/);
  assert.match(migration, /成绩尚未发布/);
  assert.match(migration, /政策要求/);
  assert.match(migration, /\^\/dashboard/);
  for (const forbidden of ["color", "icon", "className", "cssClass"]) {
    assert.match(migration, new RegExp(`'${forbidden}'`));
  }
});
