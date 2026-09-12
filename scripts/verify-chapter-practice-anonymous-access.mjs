// Uses only the public API key: never generates or installs a user session.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(base && key, 'Public Supabase configuration is required.');
const linkedProject = (await readFile(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8')).trim();
assert.equal(new URL(base).hostname, `${linkedProject}.supabase.co`, 'Application and linked migration targets must match.');
const absentId = '00000000-0000-0000-0000-000000000000';
for (const [label, path, body] of [
  ['script review read', '/rest/v1/rpc/get_teaching_script_source_review', { p_version_id: absentId }],
  ['script review status', '/rest/v1/rpc/list_teaching_script_source_review_status', { p_app_id: absentId }],
  ['script review confirmation', '/rest/v1/rpc/confirm_teaching_script_source_review', { p_version_id: absentId, p_revision: 0, p_source: {}, p_script_token: 'anonymous-denial-check' }],
  ['binding table', '/rest/v1/chapter_practice_bindings?select=id&limit=1'],
  ['read function', '/rest/v1/rpc/read_chapter_practice_snapshots', { p_app_id: absentId }],
  // No real resource identity is supplied, even if an authorization regression occurs.
  ['review function', '/rest/v1/rpc/review_chapter_practice_binding', {
    p_app_id: absentId, p_chapter_id: absentId, p_expected_revision: 0, p_expected_snapshot: [], p_enabled: false,
  }],
]) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.ok([401, 403].includes(response.status), `${label}: expected denial, received HTTP ${response.status}`);
  assert.equal(result.code, '42501', `${label}: expected insufficient privileges, not a missing deployment`);
  console.log(`${label}: anonymous access denied (${response.status}, ${result.code})`);
}
