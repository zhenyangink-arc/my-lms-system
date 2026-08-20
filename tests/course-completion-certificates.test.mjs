import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608200006_course_completion_certificates.sql",
  import.meta.url,
);

async function migrationSource() {
  return readFile(migrationUrl, "utf8");
}

test("certificate number is server-generated from 128-bit cryptographic randomness", async () => {
  const migration = await migrationSource();

  assert.match(migration, /extensions\.gen_random_bytes\(16\)/);
  assert.match(migration, /new\.certificate_number := private\.generate_course_completion_certificate_number\(\)/);
  assert.match(migration, /unique \(certificate_number\)/);
  assert.doesNotMatch(
    migration.match(/function public\.issue_course_completion_certificate[\s\S]*?returns public\.course_completion_certificates/)?.[0] ?? "",
    /certificate_number/,
  );
});

test("certificate snapshots and state transitions are immutable outside RPC state changes", async () => {
  const migration = await migrationSource();

  for (const field of [
    "student_name_snapshot",
    "course_title_snapshot",
    "policy_snapshot",
    "evidence_snapshot",
    "overall_score_snapshot",
    "reissued_from_id",
  ]) {
    assert.match(migration, new RegExp(field));
  }
  assert.match(migration, /证书编号、身份、来源和颁发时快照均不可修改/);
  assert.match(migration, /old\.status = 'issued' and new\.status = 'revoked'/);
  assert.match(migration, /revocation_reason is not null/);
  assert.match(migration, /old\.status = 'revoked' and new\.status = 'reissued'/);
  assert.match(migration, /结课证书不可删除/);
});

test("certificate issue and reissue require an eligible database row", async () => {
  const migration = await migrationSource();

  assert.match(migration, /v_evaluation\.status <> 'eligible' or not v_evaluation\.eligible/g);
  assert.match(migration, /for update/gi);
  assert.match(migration, /course_completion_certificates_initial_evaluation_key/);
  assert.match(migration, /course_completion_certificates_one_issued_evaluation_key/);
  assert.match(migration, /course_completion_certificates_reissued_from_key/);
});

test("audit events are append-only and all direct writes are revoked", async () => {
  const migration = await migrationSource();

  assert.match(migration, /'issued', 'revoked', 'reissued', 'downloaded', 'verification_viewed'/);
  assert.match(migration, /before update or delete on public\.course_completion_certificate_events/);
  assert.match(migration, /审计事件只允许追加/);
  assert.match(
    migration,
    /revoke all on public\.course_completion_certificates[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.match(
    migration,
    /revoke all on public\.course_completion_certificate_events[\s\S]*?from public, anon, authenticated, service_role/,
  );
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all) on public\.course_completion_certificate/i);
});

test("RLS separates students, institution leaders, and the platform owner", async () => {
  const migration = await migrationSource();

  assert.match(migration, /students read own completion certificates/);
  assert.match(migration, /student_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /institution leaders read tenant completion certificates/);
  assert.match(migration, /array\['tenant_super_admin', 'ceo'\]::text\[\]/);
  assert.match(migration, /platform owner reads all completion certificates/);
  assert.match(migration, /private\.is_platform_owner\(\)/);
  assert.doesNotMatch(migration, /create policy[^;]+for (?:insert|update|delete|all)/i);
});
