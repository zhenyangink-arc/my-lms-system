import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608200005_completion_refresh_orchestration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("authoritative completion and grade writes trigger safe refreshes", () => {
  assert.match(
    migration,
    /after insert or update of completion_source, progress_percent,[\s\S]*completed_at on public\.course_ebook_progress/,
  );
  assert.match(migration, /after insert or update of submission_state on public\.learning_submissions/);
  assert.match(migration, /after insert or update of record_status, score on public\.grade_records/);
  assert.match(migration, /new\.submission_state <> 'grade_released'/);
  assert.match(migration, /'EX-K1-MID-V1'/);
  assert.match(migration, /'EX-K1-FIN-V1'/);
  assert.match(migration, /'补考最终成绩发布'/);
});

test("business events isolate evaluator and queue failures", () => {
  const safeRefresh = migration.match(
    /create or replace function private\.safe_refresh_student_course_completion[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(safeRefresh);
  assert.match(safeRefresh, /private\.try_evaluate_student_course_completion/);
  assert.match(safeRefresh, /event_retry[\s\S]*exception when others then/);
  assert.match(safeRefresh, /exception when others then[\s\S]*null;/);
});

test("policy publication creates a delayed batch task for its effective scope", () => {
  assert.match(migration, /course_completion_policies_enqueue_refresh/);
  assert.match(migration, /'policy_publish'/);
  assert.match(migration, /greatest\(now\(\), new\.effective_from\)/);
  assert.match(migration, /'policy-publish:' \|\| new\.id::text/);
});

test("batch processor is one set query with locking and per-student isolation", () => {
  const processor = migration.match(
    /create or replace function public\.process_course_completion_refresh_tasks[\s\S]*?\n\$\$;/,
  )?.[0];
  assert.ok(processor);
  assert.match(processor, /for update skip locked/);
  assert.match(processor, /with targets as materialized/);
  assert.match(processor, /cross join lateral private\.try_evaluate_student_course_completion/);
  assert.doesNotMatch(processor, /\b(loop|foreach)\b/i);
  assert.match(migration, /course_completion_refresh_tasks_active_dedupe_key/);
});

test("institution RPC is capability checked and worker RPC is service-only", () => {
  assert.match(migration, /public\.request_institution_course_completion_refresh/);
  assert.match(migration, /'manage_assessments'/);
  assert.match(
    migration,
    /revoke all on function public\.process_course_completion_refresh_tasks\(integer\)[\s\S]*authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.process_course_completion_refresh_tasks\(integer\)[\s\S]*service_role/,
  );
});
