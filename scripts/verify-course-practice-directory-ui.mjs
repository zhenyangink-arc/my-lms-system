#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_my-lms-system";
const LOCAL_KONG_CONTAINER = "supabase_kong_my-lms-system";
const APP_PORT = 3114;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const KOREAN_APP_ID = "10000000-0000-4000-8000-000000000001";
const PRACTICE_UNIT_ID = "dd8f0e1a-b1a8-4747-af6a-d86b6c86035d";
const COMPLETED_BLOCK_ID = "a16ccbe6-c98c-4fc8-bc12-c0fabe82e025";
const SCHEDULED_CHAPTER_ID = "c9797e25-1c7f-4cf9-96f5-4ea148fc4702";
const TENANT_ID = crypto.randomUUID();
const TENANT_SLUG = `course-directory-ui-${Date.now()}`;
const password = "LocalPracticeDirectory123!";

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

async function waitForServer(output) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`);
      if (response.ok) return;
    } catch {
      // Development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`等待应用启动超时\n${output()}`);
}

async function createStudent(label) {
  const email = `course-directory-${label}-${Date.now()}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  return { id: data.user.id, email };
}

async function login(page, email) {
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

async function dismissFullscreen(page) {
  const dismiss = page.getByRole("button", { name: "暂不进入" });
  if (await dismiss.isVisible()) await dismiss.click();
}

const authenticatedReadTables = [
  "profiles",
  "tenants",
  "tenant_memberships",
  "tenant_student_apps",
  "student_app_enrollments",
  "courses",
  "lessons",
  "course_chapters",
  "chapter_practice_units",
  "chapter_practice_blocks",
  "lesson_progress",
  "chapter_test_attempts",
  "course_ebook_progress",
  "student_chapter_practice_progress",
  "student_review_items",
];

let ongoingStudent = null;
let newStudent = null;
let browser = null;
let server = null;
let serverOutput = "";
let originalScheduledChapter = null;

try {
  ongoingStudent = await createStudent("ongoing");
  newStudent = await createStudent("new");
  console.log("FIXTURE users created");
  originalScheduledChapter = JSON.parse(runLocalSql(`
    select jsonb_build_object(
      'unlock_mode', unlock_mode,
      'available_from', available_from,
      'is_manually_locked', is_manually_locked
    ) from public.course_chapters where id = '${SCHEDULED_CHAPTER_ID}'::uuid;
  `));

  runLocalSql(`
    grant select on ${authenticatedReadTables.map((table) => `public.${table}`).join(", ")} to authenticated;
    update public.profiles set role = 'student', full_name = '目录验收进行中学生', status = 'active'
      where id = '${ongoingStudent.id}'::uuid;
    update public.profiles set role = 'student', full_name = '目录验收新学生', status = 'active'
      where id = '${newStudent.id}'::uuid;
    insert into public.tenants (id, slug, name, status, created_by)
      values ('${TENANT_ID}'::uuid, '${TENANT_SLUG}', '课程目录验收机构', 'active', '${ongoingStudent.id}'::uuid);
    insert into public.tenant_student_apps (tenant_id, app_id, is_enabled, status)
      values ('${TENANT_ID}'::uuid, '${KOREAN_APP_ID}'::uuid, true, 'active')
      on conflict (tenant_id, app_id) do update
        set is_enabled = excluded.is_enabled, status = excluded.status;
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default
    ) values
      ('${TENANT_ID}'::uuid, '${ongoingStudent.id}'::uuid, 'student', 'active', 'vip2', true),
      ('${TENANT_ID}'::uuid, '${newStudent.id}'::uuid, 'student', 'active', 'vip2', true);
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values
      ('${TENANT_ID}'::uuid, '${ongoingStudent.id}'::uuid, '${KOREAN_APP_ID}'::uuid, 'active', 'vip2', now() - interval '1 day', '${ongoingStudent.id}'::uuid),
      ('${TENANT_ID}'::uuid, '${newStudent.id}'::uuid, '${KOREAN_APP_ID}'::uuid, 'active', 'vip2', now() - interval '1 day', '${ongoingStudent.id}'::uuid);
    insert into public.student_chapter_practice_progress (
      tenant_id, student_id, practice_unit_id, status, progress_percent,
      mastery_percent, completed_block_ids, started_at, last_practiced_at
    ) values (
      '${TENANT_ID}'::uuid, '${ongoingStudent.id}'::uuid, '${PRACTICE_UNIT_ID}'::uuid,
      'in_progress', 20, 10, array['${COMPLETED_BLOCK_ID}'::uuid], now() - interval '2 days', now()
    );
    insert into public.student_review_items (
      tenant_id, student_id, student_app_id, source_type, source_id,
      course_id, course_chapter_id, skill, content_snapshot,
      student_answer_snapshot, feedback_snapshot, error_count, status
    ) values (
      '${TENANT_ID}'::uuid, '${ongoingStudent.id}'::uuid, '${KOREAN_APP_ID}'::uuid,
      'practice_self_check', gen_random_uuid(),
      '2f79a679-6e25-4cf9-9f71-455905584787'::uuid,
      '2f3af527-a83a-421b-87c9-1fe2137a765d'::uuid,
      'grammar', '{"prompt":"助词选择需要再练习"}', '{}', '{}', 2, 'pending'
    );
    update public.course_chapters
      set unlock_mode = 'scheduled', available_from = '2099-08-25T00:00:00+09:00', is_manually_locked = false
      where id = '${SCHEDULED_CHAPTER_ID}'::uuid;
  `);
  console.log("FIXTURE real progress, review item, and lock conditions inserted");

  const localAppEnvironment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
  };
  if (process.env.SKIP_COURSE_PRACTICE_DIRECTORY_BUILD !== "1") {
    execFileSync("npx", ["next", "build", "--webpack"], {
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
  server.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-20_000); });
  server.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-20_000); });
  await waitForServer(() => serverOutput);
  console.log("SERVER production build started");

  browser = await chromium.launch({ headless: true });
  const directoryUrl = `${APP_URL}/${TENANT_SLUG}/apps/korean/practice/course`;

  const ongoingPage = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await login(ongoingPage, ongoingStudent.email);
  await ongoingPage.goto(directoryUrl);
  await ongoingPage.waitForLoadState("networkidle");
  await dismissFullscreen(ongoingPage);
  await ongoingPage.getByRole("heading", { name: "继续巩固", exact: true }).waitFor();
  const ongoingText = await ongoingPage.locator("body").innerText();
  for (const label of [
    "当前课程与章节",
    "本章尚未完成的项目",
    "最近错题",
    "薄弱能力",
    "课程目录",
  ]) {
    assert.ok(ongoingText.indexOf(label) > -1, `进行中页面缺少：${label}`);
  }
  assert.ok(
    ongoingText.indexOf("当前课程与章节") < ongoingText.indexOf("本章尚未完成的项目") &&
      ongoingText.indexOf("本章尚未完成的项目") < ongoingText.indexOf("最近错题") &&
      ongoingText.indexOf("最近错题") < ongoingText.indexOf("课程目录"),
    "进行中页面的信息优先级不符合冻结顺序",
  );
  assert.match(ongoingText, /核心词汇复习/);
  assert.match(ongoingText, /助词选择需要再练习/);
  assert.match(ongoingText, /语法\s*1 项/);
  assert.match(ongoingText, /需先通过前置章节「认识韩文」的测试/);

  const openCourses = ongoingPage.locator('details[data-course-id][open]');
  assert.equal(await openCourses.count(), 1, "进行中学生应只自动展开一门课程");
  assert.match(await openCourses.first().innerText(), /韩语初级/);
  assert.ok((await ongoingPage.locator('details[data-course-id]:not([open])').count()) > 0);
  const scheduledCourse = ongoingPage
    .locator('details[data-course-id]')
    .filter({ has: ongoingPage.getByRole("heading", { name: "韩国生活实用韩语", exact: true }) });
  await scheduledCourse.locator("summary").click();
  await ongoingPage.getByText("需等到2099年8月25日开放", { exact: true }).waitFor();
  const scheduledCard = ongoingPage.getByText("需等到2099年8月25日开放", { exact: true }).locator("xpath=ancestor::article[1]");
  assert.ok((await scheduledCard.locator("svg").count()) >= 2, "时间锁定状态应同时显示图标和文字");
  const prerequisiteCard = ongoingPage.getByText("需先通过前置章节「认识韩文」的测试", { exact: true }).locator("xpath=ancestor::article[1]");
  assert.ok((await prerequisiteCard.locator("svg").count()) >= 2, "前置锁定状态应同时显示图标和文字");
  console.log("PASS ongoing browser: continue-first hierarchy, real remaining blocks/review/weak skill, one current course expanded, two precise lock reasons");

  const newContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const newPage = await newContext.newPage();
  await login(newPage, newStudent.email);
  await newPage.goto(directoryUrl);
  await newPage.waitForLoadState("networkidle");
  await dismissFullscreen(newPage);
  await newPage.getByRole("heading", { name: "从这里开始", exact: true }).waitFor();
  assert.equal(await newPage.getByRole("heading", { name: "继续巩固", exact: true }).count(), 0);
  assert.match(await newPage.locator("body").innerText(), /当前没有待复习错题/);
  assert.equal(await newPage.locator('details[data-course-id][open]').count(), 1);

  await newPage.getByRole("link", { name: /开始本章/ }).click();
  await newPage.waitForURL(/\/practice\/course\/[^/]+\/[^/]+$/);
  assert.notEqual(newPage.url(), directoryUrl, "无进度空场景的开始操作未导航");
  await newPage.goto(directoryUrl);
  await newPage.waitForLoadState("networkidle");
  await newPage.getByRole("link", { name: /去专项训练/ }).first().click();
  await newPage.waitForURL(/\/practice\/skills$/);
  assert.match(newPage.url(), /\/practice\/skills$/);
  console.log("PASS new-student browser: explicit start guidance differs from ongoing student; no-progress and no-review recovery actions both navigate");
  await newContext.close();
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
  if (originalScheduledChapter) {
    const availableFrom = originalScheduledChapter.available_from
      ? `'${String(originalScheduledChapter.available_from).replaceAll("'", "''")}'::timestamptz`
      : "null";
    runLocalSql(`
      update public.course_chapters
        set unlock_mode = '${String(originalScheduledChapter.unlock_mode).replaceAll("'", "''")}',
            available_from = ${availableFrom},
            is_manually_locked = ${originalScheduledChapter.is_manually_locked ? "true" : "false"}
        where id = '${SCHEDULED_CHAPTER_ID}'::uuid;
    `);
    console.log("CLEANUP temporary chapter lock restored");
  }
  if (ongoingStudent || newStudent) {
    runLocalSql(`
      delete from public.student_app_enrollments where tenant_id = '${TENANT_ID}'::uuid;
      delete from public.tenant_student_apps where tenant_id = '${TENANT_ID}'::uuid;
      delete from public.tenant_memberships where tenant_id = '${TENANT_ID}'::uuid;
      delete from public.tenant_membership_audit_logs where tenant_id = '${TENANT_ID}'::uuid;
      delete from public.application_access_audit_logs where tenant_id = '${TENANT_ID}'::uuid;
      delete from public.tenants where id = '${TENANT_ID}'::uuid;
    `);
    console.log("CLEANUP temporary tenant data removed");
  }
  if (ongoingStudent) await admin.auth.admin.deleteUser(ongoingStudent.id);
  if (newStudent) await admin.auth.admin.deleteUser(newStudent.id);
}
