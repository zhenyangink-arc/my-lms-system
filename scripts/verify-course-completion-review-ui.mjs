#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_PORT = 3120;
const APP_URL = process.env.COMPLETION_REVIEW_APP_URL ?? `http://127.0.0.1:${APP_PORT}`;
const APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";
const evidenceDir = "/tmp/course-completion-review-evidence";
const password = `Local-${crypto.randomUUID()}-Aa1!`;
const fixture = {
  tenantA: crypto.randomUUID(),
  tenantB: crypto.randomUUID(),
  policy: crypto.randomUUID(),
  eligibleA: crypto.randomUUID(),
  notEligibleA: crypto.randomUUID(),
  eligibleB: crypto.randomUUID(),
};
const tenantSlugA = `completion-review-a-${Date.now()}`;
const tenantSlugB = `completion-review-b-${Date.now()}`;

function sqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function runSql(sql) {
  return execFileSync(
    "docker",
    [
      "exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-At",
    ],
    { input: sql, encoding: "utf8" },
  ).trim();
}

function failOn(error, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

const kongConfig = execFileSync(
  "docker",
  ["exec", KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
  { encoding: "utf8" },
);
const jwtKeys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const keyByRole = new Map(
  jwtKeys.flatMap((key) => {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      return payload.role ? [[payload.role, key]] : [];
    } catch {
      return [];
    }
  }),
);
const publishableKey = keyByRole.get("anon");
const secretKey = keyByRole.get("service_role");
assert.ok(publishableKey && secretKey, "无法从本地 Kong 配置读取 API key");

const admin = createClient(LOCAL_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authenticatedReadTables = ["profiles", "courses"];
const originallyMissingRead = authenticatedReadTables.filter(
  (table) =>
    runSql(`select has_table_privilege('authenticated', 'public.${table}', 'select');`) !== "t",
);
if (originallyMissingRead.length) {
  runSql(
    `grant select on ${originallyMissingRead.map((table) => `public.${table}`).join(", ")} to authenticated;`,
  );
}
const users = [];
let browser = null;
let server = null;
let serverOutput = "";

async function createUser(label, role, globalRole = "member") {
  const email = `completion-review-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  failOn(error, `创建${label}`);
  assert.ok(data.user);
  users.push(data.user.id);
  runSql(`
    update public.profiles
    set role = '${sqlLiteral(role)}',
        global_role = '${sqlLiteral(globalRole)}',
        full_name = '${sqlLiteral(label)}',
        status = 'active'
    where id = '${data.user.id}'::uuid;
  `);
  return { id: data.user.id, email, label };
}

async function signIn(account) {
  const client = createClient(LOCAL_URL, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  failOn(error, `${account.label}登录 API`);
  return client;
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Development server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`应用启动超时\n${serverOutput}`);
}

async function login(page, account) {
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(account.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  // Browser sign-in mints a fresh token; let the local API clock catch up
  // before the first authenticated Server Component request.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const [platformOwner, ownerA, ownerB, teacherA, eligibleStudentA, gapStudentA, studentB] =
    await Promise.all([
      createUser("结课审核平台负责人", "platform_super_admin", "platform_owner"),
      createUser("机构A运营负责人", "ceo"),
      createUser("机构B运营负责人", "ceo"),
      createUser("机构A普通教师", "teacher"),
      createUser("待审核学生甲", "student"),
      createUser("未达标学生乙", "student"),
      createUser("机构B学生丙", "student"),
    ]);

  const requirements = {
    textbook: { required_chapter_count: 16, require_all_mandatory_chapters: true },
    required_assignments: {
      require_all_assigned: true,
      require_submitted: true,
      require_graded: true,
    },
    formal_chapter_exams: {
      minimum_completed_count: 16,
      minimum_passed_count: 16,
      passing_score: 60,
    },
    stage_exams: { required_count: 4, require_published_grades: true },
    midterm_exam: { require_published_grade: true, passing_score: 60 },
    final_exam: { require_published_grade: true, passing_score: 60 },
    subjective_grading: { require_all_certification_items_graded: true },
    overall_score: { minimum_score: 60 },
    blocking_gaps: { maximum_allowed_count: 0 },
  };
  const evidence = {
    textbook: { requiredChapterCount: 16, completedChapterCount: 16, chapters: [] },
    requiredAssignments: [],
    formalChapterExams: [],
    stageExams: [],
    midtermExam: { itemKey: "midterm-exam", score: 86, gradeReleased: true },
    finalExam: { itemKey: "final-exam", score: 91, gradeReleased: true },
    subjectiveGrading: { required: true, pendingCount: 0, complete: true },
    overallScore: { published: true, score: 88, href: "/dashboard/grades" },
  };
  const gaps = [
    {
      key: "final-exam",
      category: "final_exam",
      title: "期末考试",
      status: "failed",
      currentValue: 58,
      requiredValue: 60,
      href: "/dashboard/assignments",
      reason: "期末考试成绩为58分，政策要求60分。",
    },
    {
      key: "textbook:chapter:16",
      category: "course",
      title: "第16章教材",
      status: "in_progress",
      currentValue: 0,
      requiredValue: 1,
      href: "/dashboard/courses",
      reason: "第16章教材尚未完成。",
    },
  ];

  runSql(`
    begin;
    insert into public.tenants (id, slug, name, status, created_by) values
      ('${fixture.tenantA}', '${tenantSlugA}', '结课审核验收机构A', 'active', '${ownerA.id}'),
      ('${fixture.tenantB}', '${tenantSlugB}', '结课审核验收机构B', 'active', '${ownerB.id}');

    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values
      ('${fixture.tenantA}', '${ownerA.id}', 'ceo', 'active', 'normal', true, now()),
      ('${fixture.tenantA}', '${teacherA.id}', 'teacher', 'active', 'normal', true, now()),
      ('${fixture.tenantA}', '${eligibleStudentA.id}', 'student', 'active', 'normal', true, now()),
      ('${fixture.tenantA}', '${gapStudentA.id}', 'student', 'active', 'normal', true, now()),
      ('${fixture.tenantB}', '${ownerB.id}', 'ceo', 'active', 'normal', true, now()),
      ('${fixture.tenantB}', '${studentB.id}', 'student', 'active', 'normal', true, now());

    update public.tenant_student_apps
    set is_enabled = true, status = 'active'
    where tenant_id in ('${fixture.tenantA}', '${fixture.tenantB}')
      and app_id = '${APP_ID}';

    insert into public.staff_app_assignments (
      tenant_id, staff_id, app_id, access_role,
      can_manage_students, can_manage_content, can_manage_assessments,
      can_view_analytics, status, assigned_by
    ) values (
      '${fixture.tenantA}', '${teacherA.id}', '${APP_ID}', 'teacher',
      false, false, true, true, 'active', '${ownerA.id}'
    );

    select set_config('request.jwt.claim.sub', '${platformOwner.id}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, requirements, created_by
    ) values (
      '${fixture.policy}', '${APP_ID}', '${COURSE_ID}',
      'UI-REVIEW-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}',
      1, '结课审核浏览器验收政策', 'draft', false,
      '${sqlLiteral(JSON.stringify(requirements))}'::jsonb, '${platformOwner.id}'
    );

    insert into public.student_course_completion_evaluations (
      id, tenant_id, student_id, student_app_id, course_id,
      policy_id, policy_version, status, eligible, overall_score,
      requirements_snapshot, evidence_snapshot, missing_requirements,
      evaluated_at, evaluation_version, evaluation_fingerprint
    ) values
      (
        '${fixture.eligibleA}', '${fixture.tenantA}', '${eligibleStudentA.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'eligible', true, 88,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify(evidence))}'::jsonb,
        '[]'::jsonb, now(), 'packet10-browser-v1', md5('${fixture.eligibleA}')
      ),
      (
        '${fixture.notEligibleA}', '${fixture.tenantA}', '${gapStudentA.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'not_eligible', false, 58,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify({ ...evidence, overallScore: { published: true, score: 58 } }))}'::jsonb,
        '${sqlLiteral(JSON.stringify(gaps))}'::jsonb,
        now(), 'packet10-browser-v1', md5('${fixture.notEligibleA}')
      ),
      (
        '${fixture.eligibleB}', '${fixture.tenantB}', '${studentB.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'eligible', true, 90,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify(evidence))}'::jsonb,
        '[]'::jsonb, now(), 'packet10-browser-v1', md5('${fixture.eligibleB}')
      );
    commit;
    select pg_notify('pgrst', 'reload schema');
  `);

  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const [ownerAApi, ownerBApi] = await Promise.all([signIn(ownerA), signIn(ownerB)]);
  // Some local container combinations reject a token minted in the current
  // clock tick as being issued in the future.
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const [{ data: ownerARows, error: ownerAError }, { data: ownerBRows, error: ownerBError }] =
    await Promise.all([
      ownerAApi.from("student_course_completion_evaluations").select("tenant_id,student_id"),
      ownerBApi.from("student_course_completion_evaluations").select("tenant_id,student_id"),
    ]);
  failOn(ownerAError, "机构A读取资格");
  failOn(ownerBError, "机构B读取资格");
  assert.equal(ownerARows.length, 2);
  assert.ok(ownerARows.every((row) => row.tenant_id === fixture.tenantA));
  assert.equal(ownerBRows.length, 1);
  assert.ok(ownerBRows.every((row) => row.tenant_id === fixture.tenantB));
  console.log("PASS RLS: 机构A仅见2条本机构资格，机构B仅见1条本机构资格");

  if (!process.env.COMPLETION_REVIEW_APP_URL) {
    server = spawn("npm", ["run", "dev", "--", "--port", String(APP_PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SERVICE_ROLE_KEY: secretKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    });
    server.stdout.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-20_000);
    });
    server.stderr.on("data", (chunk) => {
      serverOutput = `${serverOutput}${chunk}`.slice(-20_000);
    });
  }
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ownerContext.newPage();
  await login(page, ownerA);
  const reviewUrl = `${APP_URL}/${tenantSlugA}/dashboard/admin/apps/korean/completion-review`;
  await page.goto(reviewUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "结课审核", exact: true }).waitFor();
  let bodyText = await page.locator("body").innerText();
  assert.match(bodyText, /待审核学生甲/);
  assert.doesNotMatch(bodyText, /机构B学生丙/);
  await page.screenshot({ path: `${evidenceDir}/01-pending-review.png`, fullPage: true });
  console.log("PASS 浏览器：机构A待审核列表不含机构B学生");

  await page.getByRole("tab", { name: /未达标/ }).click();
  await page.getByText("未达标学生乙", { exact: true }).waitFor();
  bodyText = await page.locator("body").innerText();
  assert.match(bodyText, /期末考试成绩为58分，政策要求60分/);
  assert.match(bodyText, /第16章教材尚未完成/);
  await page.screenshot({ path: `${evidenceDir}/02-not-eligible.png`, fullPage: true });
  console.log("PASS 浏览器：未达标列表展示具体自然语言缺口");
  await page.getByRole("tab", { name: /待审核/ }).click();

  const detailTrigger = page.getByRole("button", { name: "查看资格明细", exact: true }).first();
  await detailTrigger.click();
  await page.getByRole("heading", { name: "资格明细" }).waitFor();
  await page.waitForTimeout(300);
  bodyText = await page.locator("body").innerText();
  assert.match(bodyText, /教材已完成 16\/16 章/);
  assert.match(bodyText, /当前资格快照没有未达标项目/);
  const sheet = page.locator('[data-slot="sheet-content"]');
  assert.equal(await sheet.evaluate((element) => element.contains(document.activeElement)), true);
  const sheetClose = page.getByRole("button", { name: "关闭" });
  const sheetCloseBox = await sheetClose.boundingBox();
  assert.ok(sheetCloseBox && sheetCloseBox.width >= 44 && sheetCloseBox.height >= 44);
  await page.screenshot({ path: `${evidenceDir}/03-eligibility-detail.png`, fullPage: true });
  await sheetClose.click();
  assert.equal(await detailTrigger.evaluate((element) => element === document.activeElement), true);

  const issueTrigger = page.getByRole("button", { name: "颁发证书", exact: true });
  await issueTrigger.click();
  const issueCancel = page.getByRole("button", { name: "取消", exact: true });
  const issueCancelBox = await issueCancel.boundingBox();
  assert.ok(issueCancelBox && issueCancelBox.width >= 44 && issueCancelBox.height >= 44);
  await page.keyboard.press("Escape");
  assert.equal(await issueTrigger.evaluate((element) => element === document.activeElement), true);
  await issueTrigger.click();
  await page.getByRole("button", { name: "确认颁发", exact: true }).click();
  await page.getByRole("tab", { name: /已颁发/ }).click();
  await page.getByText("待审核学生甲", { exact: true }).waitFor({ timeout: 20_000 });
  await page.getByText("证书有效", { exact: true }).waitFor();
  await page.screenshot({ path: `${evidenceDir}/04-issued.png`, fullPage: true });
  console.log("PASS 浏览器：颁发后记录进入已颁发列表");

  await page.getByRole("button", { name: "撤销证书", exact: true }).click();
  await page.getByLabel("撤销原因").fill("学生姓名需要核对，暂时撤销证书");
  await page.getByRole("button", { name: "确认撤销", exact: true }).click();
  await page.getByRole("tab", { name: /已撤销/ }).click();
  await page.getByText("学生姓名需要核对，暂时撤销证书", { exact: false }).waitFor({ timeout: 20_000 });
  await page.screenshot({ path: `${evidenceDir}/05-revoked.png`, fullPage: true });
  console.log("PASS 浏览器：撤销原因保存并进入已撤销列表");

  await page.getByRole("button", { name: "重新颁发", exact: true }).click();
  await page.getByLabel("重新颁发原因").fill("姓名资料已确认，重新颁发有效证书");
  await page.getByRole("button", { name: "确认重新颁发", exact: true }).click();
  await page.getByRole("tab", { name: /已颁发/ }).click();
  await page.getByText("证书有效", { exact: true }).waitFor({ timeout: 20_000 });
  const issuedCount = Number(runSql(`
    select count(*) from public.course_completion_certificates
    where tenant_id = '${fixture.tenantA}'::uuid and status = 'issued';
  `));
  const replacedCount = Number(runSql(`
    select count(*) from public.course_completion_certificates
    where tenant_id = '${fixture.tenantA}'::uuid and status = 'reissued';
  `));
  assert.equal(issuedCount, 1);
  assert.equal(replacedCount, 1);
  console.log("PASS 浏览器/数据库：重新颁发后1张有效证书，原证书标记为已替代");

  const issuedTab = page.getByRole("tab", { name: /已颁发/ });
  await issuedTab.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.getByRole("tab", { name: /已撤销/ }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await issuedTab.getAttribute("aria-selected"), "true");

  const revokeTrigger = page.getByRole("button", { name: "撤销证书", exact: true });
  await revokeTrigger.click();
  assert.equal(
    await page.locator('[data-slot="alert-dialog-content"]').evaluate((element) => element.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await revokeTrigger.evaluate((element) => element === document.activeElement), true);

  for (const viewport of [
    { label: "mobile-375", width: 375, height: 812 },
    { label: "tablet-768", width: 768, height: 1024 },
    { label: "desktop-1280", width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(150);
    const viewportAudit = await page.evaluate(() => {
      const tablist = document.querySelector('[role="tablist"][aria-label="结课审核状态"]');
      const root = tablist?.parentElement;
      const controls = root ? [...root.querySelectorAll("button,a,input,select,textarea")] : [];
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        controls: controls
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              name: element.getAttribute("aria-label") || element.textContent?.trim() || "",
              width: rect.width,
              height: rect.height,
            };
          }),
      };
    });
    assert.ok(viewportAudit.scrollWidth <= viewportAudit.innerWidth, `${viewport.label}: ${JSON.stringify(viewportAudit)}`);
    assert.ok(viewportAudit.controls.length >= 6);
    assert.ok(
      viewportAudit.controls.every((control) => control.width >= 44 && control.height >= 44),
      `${viewport.label}: ${JSON.stringify(viewportAudit)}`,
    );
    await page.screenshot({ path: `${evidenceDir}/06-${viewport.label}.png`, fullPage: true });
  }
  console.log("PASS 375/768/1280px：无页面横向滚动，触控区不小于44px，页签与弹层焦点管理通过");
  await ownerContext.close();

  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, teacherA);
  await teacherPage.goto(reviewUrl);
  await teacherPage.waitForLoadState("networkidle");
  assert.equal(
    new URL(teacherPage.url()).pathname,
    `/${tenantSlugA}/dashboard/admin/apps/korean`,
  );
  assert.equal(await teacherPage.locator('a[href$="/completion-review"]').count(), 0);
  console.log("PASS 权限：普通教师直接访问被重定向，应用工作区不显示入口");
  await teacherContext.close();

  console.log(`EVIDENCE ${evidenceDir}`);
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Development server already stopped.
    }
  }
  try {
    runSql(`
      begin;
      set local session_replication_role = replica;
      do $$
      declare tenant_table record;
      begin
        for tenant_table in
          select columns.table_name
          from information_schema.columns as columns
          join information_schema.tables as tables
            on tables.table_schema = columns.table_schema
           and tables.table_name = columns.table_name
          where columns.table_schema = 'public'
            and columns.column_name = 'tenant_id'
            and tables.table_type = 'BASE TABLE'
        loop
          execute format(
            'delete from public.%I where tenant_id = any($1)',
            tenant_table.table_name
          ) using array['${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid];
        end loop;
      end;
      $$;
      delete from public.course_completion_refresh_tasks where policy_id = '${fixture.policy}'::uuid;
      delete from public.course_completion_policies where id = '${fixture.policy}'::uuid;
      delete from public.tenants where id in ('${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid);
      set local session_replication_role = origin;
      commit;
    `);
  } catch (error) {
    console.error(`WARN fixture cleanup: ${error.message}`);
  }
  for (const userId of users.reverse()) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
  if (originallyMissingRead.length) {
    runSql(
      `revoke select on ${originallyMissingRead.map((table) => `public.${table}`).join(", ")} from authenticated;`,
    );
  }
}
