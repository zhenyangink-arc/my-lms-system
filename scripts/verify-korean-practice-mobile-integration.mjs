#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_my-lms-system";
const LOCAL_KONG_CONTAINER = "supabase_kong_my-lms-system";
const APP_PORT = 3115;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const KOREAN_APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";
const COURSE_SLUG = "korean-beginner";
const LESSON_SLUG = "hangul-introduction";
const CHAPTER_ID = "2f3af527-a83a-421b-87c9-1fe2137a765d";
const CHAPTER_SLUG = "meet-hangul";
const EXERCISE_ID = "c9e13559-2b78-4278-94d3-87ca4d7622fe";
const SKILL = "grammar";
const tenantId = crypto.randomUUID();
const tenantSlug = `practice-mobile-${Date.now()}`;
const email = `${tenantSlug}@local.test`;
const password = "LocalPracticeMobile123!";

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

async function waitForServer(output) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`);
      if (response.ok) return;
    } catch {
      // Production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`等待应用启动超时\n${output()}`);
}

async function dismissFullscreen(page) {
  const dismiss = page.getByRole("button", { name: "暂不进入" });
  if (await dismiss.isVisible()) await dismiss.click();
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(
    dimensions.scrollWidth,
    dimensions.clientWidth,
    `${label} 出现横向滚动：${JSON.stringify(dimensions)}`,
  );
  return dimensions;
}

async function assertTouchTarget(locator, label) {
  await locator.first().scrollIntoViewIfNeeded();
  const box = await locator.first().boundingBox();
  assert.ok(box, `${label} 不可见`);
  assert.ok(
    box.width >= 44 && box.height >= 44,
    `${label} 触控区域不足 44px：${JSON.stringify(box)}`,
  );
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

async function assertReadable(locator, label) {
  const size = await locator.first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  assert.ok(size >= 12, `${label} 字号小于 12px：${size}px`);
  return size;
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
  "growth_toolbox_items",
  "growth_toolbox_exercises",
  "growth_toolbox_questions",
  "toolbox_practice_sessions",
  "student_toolbox_skill_profiles",
];
const serviceRoleAdminTables = [
  "courses",
  "lessons",
  "course_chapters",
  "chapter_tests",
];
const missingServiceRoleGrants = runLocalSql(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name = any(array[${serviceRoleAdminTables.map((table) => `'${table}'`).join(",")}])
    and not has_table_privilege('service_role', format('public.%I', table_name), 'select')
  order by table_name;
`).split("\n").filter(Boolean);

let userId = null;
let browser = null;
let server = null;
let serverOutput = "";

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(createError);
  userId = created.user.id;
  runLocalSql(`
    grant select on ${authenticatedReadTables.map((table) => `public.${table}`).join(", ")} to authenticated;
    ${missingServiceRoleGrants.length
      ? `grant select on ${missingServiceRoleGrants.map((table) => `public.${table}`).join(", ")} to service_role;`
      : ""}
    update public.profiles
      set role = 'student', full_name = '手机端综合验收学生', status = 'active'
      where id = '${userId}'::uuid;
    insert into public.tenants (id, slug, name, status, created_by)
      values ('${tenantId}'::uuid, '${tenantSlug}', '手机端综合验收机构', 'active', '${userId}'::uuid);
    insert into public.tenant_student_apps (tenant_id, app_id, is_enabled, status)
      values ('${tenantId}'::uuid, '${KOREAN_APP_ID}'::uuid, true, 'active')
      on conflict (tenant_id, app_id) do update
        set is_enabled = excluded.is_enabled, status = excluded.status;
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default
    ) values (
      '${tenantId}'::uuid, '${userId}'::uuid, 'student', 'active', 'vip2', true
    );
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values (
      '${tenantId}'::uuid, '${userId}'::uuid, '${KOREAN_APP_ID}'::uuid,
      'active', 'vip2', now() - interval '1 day', '${userId}'::uuid
    );
    insert into public.student_review_items (
      tenant_id, student_id, student_app_id, source_type, source_id,
      source_question_id, course_id, course_chapter_id, skill,
      content_snapshot, student_answer_snapshot, feedback_snapshot,
      error_count, status
    ) values (
      '${tenantId}'::uuid, '${userId}'::uuid, '${KOREAN_APP_ID}'::uuid,
      'specialized_practice', '${EXERCISE_ID}'::uuid, null,
      '${COURSE_ID}'::uuid, '${CHAPTER_ID}'::uuid, '${SKILL}',
      '{"sourceVersion":1,"sourceTitle":"认识韩文语法训练","prompt":"真实关联专项训练错题"}',
      '{"answer":"错误答案"}',
      '{"correctAnswer":"正确答案","lastErrorAt":"2026-08-19T00:00:00Z"}',
      1, 'pending'
    );
  `);
  console.log(`FIXTURE real association: ${SKILL}/${COURSE_SLUG}/${LESSON_SLUG}/${CHAPTER_SLUG}`);

  const studentApi = createClient(LOCAL_URL, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await studentApi.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);
  const studentChecks = await Promise.all([
    studentApi
      .from("growth_toolbox_exercises")
      .select("id,skill,title,description,instructions,content_payload,course_id,course_chapter_id,chapter_test_id")
      .eq("student_app_id", KOREAN_APP_ID)
      .limit(1),
    studentApi.from("chapter_test_attempts").select("test_slug,passed").limit(1),
    studentApi
      .from("toolbox_practice_sessions")
      .select("exercise_id,status")
      .eq("student_app_id", KOREAN_APP_ID)
      .limit(1),
    studentApi.from("lesson_progress").select("lesson_id,status").limit(1),
  ]);
  const checkNames = ["专项练习", "章节测试记录", "练习会话", "课时进度"];
  studentChecks.forEach((result, index) => {
    assert.ifError(
      result.error
        ? new Error(`${checkNames[index]}读取失败：${result.error.message}`)
        : null,
    );
  });
  const adminChecks = await Promise.all([
    admin.from("courses").select("id,category_id,slug,title,description,level,sort_order,unlock_mode,prerequisite_course_id,available_from,is_manually_locked").limit(1),
    admin.from("lessons").select("id,course_id,slug,title,description,sort_order,unlock_mode,prerequisite_lesson_id,prerequisite_chapter_id,available_from,is_manually_locked").limit(1),
    admin.from("course_chapters").select("id,lesson_id,chapter_test_id,slug,title,description,sort_order,unlock_mode,prerequisite_chapter_id,available_from,is_manually_locked").limit(1),
    admin.from("chapter_tests").select("id,slug,course_key,chapter_number,title,korean_title,skills").limit(1),
  ]);
  const adminCheckNames = ["课程", "课时", "章节", "章节测试"];
  adminChecks.forEach((result, index) => {
    assert.ifError(
      result.error
        ? new Error(`${adminCheckNames[index]}管理查询失败：${result.error.message}`)
        : null,
    );
  });
  await studentApi.auth.signOut();

  const appEnvironment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
  };
  if (process.env.SKIP_KOREAN_PRACTICE_MOBILE_BUILD !== "1") {
    execFileSync("npx", ["next", "build", "--webpack"], {
      cwd: process.cwd(),
      env: appEnvironment,
      stdio: "inherit",
    });
  }
  server = spawn("npm", ["run", "start", "--", "--port", String(APP_PORT)], {
    cwd: process.cwd(),
    env: appEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-20_000);
  });
  server.stderr.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-20_000);
  });
  await waitForServer(() => serverOutput);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  try {
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  } catch (error) {
    throw new Error(
      `登录未完成：${page.url()}\n${(await page.locator("body").innerText()).slice(0, 3000)}\n${serverOutput}`,
      { cause: error },
    );
  }

  const base = `${APP_URL}/${tenantSlug}/apps/korean`;
  const directoryUrl = `${base}/practice/course`;
  const detailUrl = `${directoryUrl}/${COURSE_SLUG}/${CHAPTER_SLUG}`;
  const skillsUrl = `${base}/practice/skills`;
  const trainingUrl = `${base}/training/${SKILL}/${COURSE_SLUG}/${LESSON_SLUG}/${CHAPTER_SLUG}`;
  const reviewUrl = `${base}/practice/review`;
  const report = {};

  await page.goto(directoryUrl);
  await page.waitForLoadState("networkidle");
  await dismissFullscreen(page);
  report.directoryOverflow = await assertNoHorizontalOverflow(page, "课程巩固目录");
  report.directoryAction = await assertTouchTarget(
    page.getByRole("link", { name: /开始本章|继续本章|回顾本章/ }),
    "课程巩固首要操作",
  );
  report.directoryStatusFont = await assertReadable(
    page.getByText("未开始", { exact: true }),
    "课程目录状态",
  );

  await page.goto(detailUrl);
  await page.waitForLoadState("networkidle");
  report.detailOverflow = await assertNoHorizontalOverflow(page, "章节巩固详情");
  report.detailAction = await assertTouchTarget(
    page.getByRole("button", { name: /标记本块已复习|已完成本块/ }),
    "章节巩固标记操作",
  );
  report.detailStatusFont = await assertReadable(
    page.getByText("未开始", { exact: true }),
    "章节巩固状态",
  );
  await page.getByRole("link", { name: "练习本章专项能力" }).click();
  await page.waitForURL(/\/training\/[^/]+\/korean-beginner\/hangul-introduction\/meet-hangul$/, { timeout: 30_000 });
  report.courseToSpecialized = page.url();
  await page.goto(report.courseToSpecialized);
  await page.waitForLoadState("networkidle");

  report.trainingOverflow = await assertNoHorizontalOverflow(page, "专项训练详情");
  const returnToCourse = page.getByRole("link", { name: "返回本章课程巩固" });
  if ((await returnToCourse.count()) === 0) {
    throw new Error(
      `专项训练详情未显示关联课程入口：${page.url()}\n${(await page.locator("body").innerText()).slice(0, 3000)}\n${serverOutput}`,
    );
  }
  report.trainingAction = await assertTouchTarget(
    returnToCourse,
    "专项训练返回课程巩固操作",
  );
  await returnToCourse.click();
  await page.waitForURL(detailUrl);
  report.specializedToCourse = page.url();

  await page.goto(skillsUrl);
  await page.waitForLoadState("networkidle");
  report.skillsOverflow = await assertNoHorizontalOverflow(page, "专项训练目录");
  report.skillsAction = await assertTouchTarget(
    page.getByRole("link", { name: /训练$/ }).first(),
    "专项训练入口卡",
  );
  report.skillsStatusFont = await assertReadable(
    page.getByText("尚未练习", { exact: true }),
    "专项训练状态",
  );

  await page.goto(reviewUrl);
  await page.waitForLoadState("networkidle");
  report.reviewOverflow = await assertNoHorizontalOverflow(page, "错题复习");
  report.reviewAction = await assertTouchTarget(
    page.getByRole("link", { name: "返回来源专项训练" }),
    "错题来源入口",
  );
  report.reviewStatusFont = await assertReadable(
    page.getByText("待复习", { exact: true }),
    "错题状态",
  );
  await page.getByRole("link", { name: "返回来源专项训练" }).click();
  await page.waitForURL(trainingUrl);
  report.reviewToSource = page.url();

  console.log(`PASS 375px mobile integration: ${JSON.stringify(report)}`);
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Server already stopped.
    }
  }
  if (userId) {
    runLocalSql(`
      delete from public.student_app_enrollments where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_student_apps where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_memberships where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_membership_audit_logs where tenant_id = '${tenantId}'::uuid;
      delete from public.application_access_audit_logs where tenant_id = '${tenantId}'::uuid;
      delete from public.tenants where id = '${tenantId}'::uuid;
    `);
    await admin.auth.admin.deleteUser(userId);
  }
  if (missingServiceRoleGrants.length) {
    runLocalSql(
      `revoke select on ${missingServiceRoleGrants.map((table) => `public.${table}`).join(", ")} from service_role;`,
    );
  }
}
