import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("PERF-018 profile lookups use confirmed foreign-key embeds", async () => {
  const [accounts, announcements, grades, people, conversation] =
    await Promise.all([
      source("src/features/accounts/api/service.ts"),
      source("src/features/announcements/api/service.ts"),
      source("src/features/grades/api/service.ts"),
      source(
        "src/app/dashboard/admin/apps/ManagementApplicationPeoplePage.tsx",
      ),
      source(
        "src/app/dashboard/admin/conversation-practice/page-content.tsx",
      ),
    ]);

  assert.match(accounts, /tenant_memberships_user_id_fkey/);
  assert.match(accounts, /account_management_audit_logs_actor_id_fkey/);
  assert.match(announcements, /announcements_created_by_fkey/);
  assert.match(grades, /learning_submissions_student_id_fkey/);
  assert.match(grades, /course_test_attempts_student_id_fkey/);
  assert.match(grades, /grade_review_requests_student_id_fkey/);
  assert.doesNotMatch(grades, /\.from\("profiles"\)/);
  assert.match(people, /tenant_memberships_user_id_fkey/);
  assert.doesNotMatch(people, /\.from\("profiles"\)/);
  assert.match(conversation, /conversation_practice_progress_user_id_fkey/);
});

test("PERF-021 uses an invoker aggregate and an untruncated fallback", async () => {
  const [overview, migration] = await Promise.all([
    source(
      "src/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage.tsx",
    ),
    source(
      "supabase/migrations/202608170005_platform_management_app_overview_invoker_fix.sql",
    ),
  ]);

  assert.match(overview, /get_platform_management_app_overview/);
  assert.doesNotMatch(overview, /\.limit\(5000\)/);
  assert.match(overview, /\.range\(from, to\)/);
  assert.match(overview, /loadPagedLearningHours/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /not private\.is_platform_owner\(\)/);
  assert.match(migration, /revoke all[\s\S]*from public, anon/i);
  assert.match(migration, /grant execute[\s\S]*to authenticated/i);

  for (const table of [
    "student_app_enrollments",
    "staff_app_assignments",
    "learning_assignments",
    "learning_submissions",
    "learning_record_notes",
    "conversation_practice_scenarios",
    "conversation_practice_progress",
  ]) {
    assert.match(
      migration,
      new RegExp(`from public\\.${table}[\\s\\S]*?tenant_id`),
      `${table} must remain explicitly tenant-bound`,
    );
  }
  assert.doesNotMatch(migration, /from public\.learning_time_log/);
});
