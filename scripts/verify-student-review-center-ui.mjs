#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_my-lms-system";
const LOCAL_KONG_CONTAINER = "supabase_kong_my-lms-system";
const APP_PORT = 3113;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const KOREAN_APP_ID = "10000000-0000-4000-8000-000000000001";
const TENANT_ID = "b2000000-0000-4000-8000-000000000001";
const TENANT_SLUG = "review-center-ui-verification";
const REVIEW_ITEM_ID = "b3000000-0000-4000-8000-000000000001";
const SOURCE_ID = "b4000000-0000-4000-8000-000000000001";
const email = `review-center-ui-${Date.now()}@local.test`;
const password = `Local-${crypto.randomUUID()}!`;

function runLocalSql(sql) {
  return execFileSync(
    "docker",
    [
      "exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres",
      "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At",
    ],
    { input: sql, encoding: "utf8" },
  ).trim();
}

const kongConfig = execFileSync(
  "docker",
  ["exec", LOCAL_KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
  { encoding: "utf8" },
);
const keys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const keyByRole = new Map(
  keys.flatMap((key) => {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
      );
      return payload.role ? [[payload.role, key]] : [];
    } catch {
      return [];
    }
  }),
);
const publishableKey = keyByRole.get("anon");
const secretKey = keyByRole.get("service_role");
assert.ok(publishableKey && secretKey, "无法读取本地 Supabase API key");
const admin = createClient(LOCAL_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const localAuthReadTables = [
  "profiles",
  "tenants",
  "tenant_memberships",
  "tenant_student_apps",
  "student_app_enrollments",
];
runLocalSql(
  `grant select on ${localAuthReadTables.map((table) => `public.${table}`).join(", ")} to authenticated;`,
);

async function waitForServer(serverOutput) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`);
      if (response.ok) return;
    } catch {
      // Dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`等待应用启动超时\n${serverOutput()}`);
}

let userId = null;
let browser = null;
let server = null;
let output = "";
try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(createError);
  userId = created.user.id;
  runLocalSql(`
    update public.profiles
    set role = 'student', full_name = '错题交互验证学生', status = 'active'
    where id = '${userId}'::uuid;
    insert into public.tenants (id, slug, name, status, created_by)
    values ('${TENANT_ID}', '${TENANT_SLUG}', '错题交互验证机构', 'active', '${userId}'::uuid);
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default
    ) values (
      '${TENANT_ID}', '${userId}'::uuid, 'student', 'active', 'vip2', true
    );
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values (
      '${TENANT_ID}', '${userId}'::uuid, '${KOREAN_APP_ID}',
      'active', 'vip2', now() - interval '1 day', '${userId}'::uuid
    );
    insert into public.student_review_items (
      id, tenant_id, student_id, student_app_id, source_type, source_id,
      skill, content_snapshot, student_answer_snapshot, feedback_snapshot,
      error_count, status
    ) values (
      '${REVIEW_ITEM_ID}', '${TENANT_ID}', '${userId}'::uuid, '${KOREAN_APP_ID}',
      'practice_self_check', '${SOURCE_ID}', 'grammar',
      '{"sourceVersion":1,"sourceTitle":"第一章巩固","prompt":"主题助词是否掌握？"}',
      '{"answer":"还需加强"}',
      '{"expectedAnswer":"已经掌握","lastErrorAt":"2026-08-19T00:00:00Z"}',
      1, 'pending'
    );
  `);

  const localAppEnvironment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
  };
  if (process.env.SKIP_STUDENT_REVIEW_CENTER_BUILD !== "1") {
    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      env: localAppEnvironment,
      stdio: "inherit",
    });
  }
  server = spawn("npm", ["run", "start", "--", "--port", String(APP_PORT)], {
    cwd: process.cwd(),
    env: localAppEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
  server.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
  await waitForServer(() => output);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  await page.goto(`${APP_URL}/${TENANT_SLUG}/apps/korean/practice/review`);
  await page.waitForLoadState("networkidle");
  const reviewHeading = page.getByRole("heading", { name: "错题复习", exact: true });
  assert.ok(
    (await reviewHeading.count()) >= 1,
    `错题页未正常显示：${page.url()}\n${(await page.locator("body").innerText()).slice(0, 2000)}\n${output}`,
  );
  const dismissFullscreen = page.getByRole("button", { name: "暂不进入" });
  if (await dismissFullscreen.isVisible()) await dismissFullscreen.click();
  await page.getByText("主题助词是否掌握？", { exact: true }).waitFor();
  await page.getByRole("button", { name: "标记为重新掌握" }).click();
  await page.waitForTimeout(1500);
  const pageTextAfterMastering = await page.locator("body").innerText();
  assert.match(
    pageTextAfterMastering,
    /最近重新掌握的内容（1）/,
    `重新掌握操作未成功\n${pageTextAfterMastering.slice(0, 2500)}\n${output}`,
  );

  const row = JSON.parse(runLocalSql(`
    select jsonb_build_object(
      'status', status,
      'mastered_at_set', mastered_at is not null,
      'last_reviewed_at_set', last_reviewed_at is not null
    ) from public.student_review_items where id = '${REVIEW_ITEM_ID}';
  `));
  assert.deepEqual(row, {
    status: "mastered",
    mastered_at_set: true,
    last_reviewed_at_set: true,
  });
  console.log(`PASS browser mastered interaction: ${JSON.stringify(row)}`);
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
  if (userId) {
    runLocalSql(`
      delete from public.student_app_enrollments where tenant_id = '${TENANT_ID}';
      delete from public.tenant_student_apps where tenant_id = '${TENANT_ID}';
      delete from public.application_access_audit_logs where tenant_id = '${TENANT_ID}';
      delete from public.tenant_memberships where tenant_id = '${TENANT_ID}';
      delete from public.tenant_membership_audit_logs where tenant_id = '${TENANT_ID}';
      delete from public.tenants where id = '${TENANT_ID}';
    `);
    await admin.auth.admin.deleteUser(userId);
  }
  runLocalSql(
    `revoke select on ${localAuthReadTables.map((table) => `public.${table}`).join(", ")} from authenticated;`,
  );
}
