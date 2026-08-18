import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608190007_seed_korean_chapter_one_pilot_papers.sql",
  import.meta.url
);

test("first chapter pilot creates reviewable homework and exam drafts", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /slug = 'korean-level-one-01'/);
  assert.match(migration, /'HW-K1-01-V1', 'homework'/);
  assert.match(migration, /'EX-K1-01-V1', 'exam'/);
  assert.match(migration, /v_plan\.id, v_test\.student_app_id/);
  assert.match(migration, /from public\.chapter_homework_questions/);
  assert.match(migration, /from public\.chapter_test_questions/);
  assert.match(migration, /1, 'draft'/);
  assert.doesNotMatch(migration, /'published',\s*v_owner_id/);
});
