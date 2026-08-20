#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";
const APP_PORT = 3121;
const APP_URL = process.env.COMPLETION_STATISTICS_APP_URL ?? `http://127.0.0.1:${APP_PORT}`;
const evidenceDir = "artifacts/round5-packet13";
const password = `Local-${randomUUID()}-Aa1!`;
const fixture = {
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  tenantSlugA: `completion-statistics-a-${Date.now()}`,
  tenantSlugB: `completion-statistics-b-${Date.now()}`,
  policyV1: randomUUID(),
  policyV2: randomUUID(),
  policyCode: `STATS-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
};

function sqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function runSql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
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
const keys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const keyByRole = new Map(
  keys.flatMap((key) => {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      return payload.role ? [[payload.role, key]] : [];
    } catch {
      return [];
    }
  }),
);
const anonKey = keyByRole.get("anon");
const serviceRoleKey = keyByRole.get("service_role");
assert.ok(anonKey && serviceRoleKey, "无法从本地 Kong 配置读取 API key");

const admin = createClient(LOCAL_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];

async function createAccount(label, role, globalRole = "member") {
  const email = `completion-statistics-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  failOn(error, `创建${label}`);
  assert.ok(data.user);
  createdUserIds.push(data.user.id);
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
  const client = createClient(LOCAL_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  failOn(error, `${account.label}登录`);
  return client;
}

function getPlanNodeTypes(plan) {
  const types = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node["Node Type"] === "string") types.push(node["Node Type"]);
    for (const child of node.Plans ?? []) visit(child);
  };
  visit(plan?.[0]?.Plan);
  return types;
}

let rpcCalls = 0;
async function countedRpc(client, name) {
  rpcCalls += 1;
  return client.rpc(name, { p_student_app_id: APP_ID });
}

const accounts = {};
const evaluations = [];
let browser = null;
let server = null;
let serverOutput = "";

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${APP_URL}/login`).catch(() => null);
    if (response && response.status < 500) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`应用启动超时\n${serverOutput}`);
}

async function login(page, account) {
  const failures = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("登录账号").waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps")));
    }, undefined, { timeout: 30_000 });
    await page.getByLabel("登录账号").fill(account.email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "进入学习中心" }).click();
    const leftLogin = await page.waitForURL(
      (url) => !url.pathname.startsWith("/login"),
      { timeout: 12_000 },
    ).then(() => true).catch(() => false);
    if (leftLogin) break;
    failures.push((await page.locator("body").innerText()).slice(-1200));
  }
  assert.ok(
    !new URL(page.url()).pathname.startsWith("/login"),
    `${account.label}浏览器登录失败\n${failures.join("\n--- retry ---\n")}`,
  );
  const dismiss = page.getByRole("button", { name: "暂不进入", exact: true });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await page.waitForTimeout(2_000);
}

async function auditResponsiveStatistics(page, rootSelector, filePrefix) {
  for (const viewport of [
    { label: "mobile-375", width: 375, height: 812 },
    { label: "tablet-768", width: 768, height: 1024 },
    { label: "desktop-1280", width: 1280, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(150);
    const audit = await page.evaluate((selector) => {
      const root = document.querySelector(selector);
      const controls = root ? [...root.querySelectorAll("a,button,input,select,textarea")] : [];
      return {
        rootFound: Boolean(root),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        smallControls: controls
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              name: element.getAttribute("aria-label") || element.textContent?.trim() || "",
              width: rect.width,
              height: rect.height,
            };
          })
          .filter((control) => control.width < 44 || control.height < 44),
      };
    }, rootSelector);
    assert.equal(audit.rootFound, true);
    assert.ok(audit.scrollWidth <= audit.innerWidth, `${viewport.label}: ${JSON.stringify(audit)}`);
    assert.deepEqual(audit.smallControls, [], `${viewport.label}: ${JSON.stringify(audit)}`);
    await page.screenshot({
      path: `${evidenceDir}/${filePrefix}-${viewport.label}.png`,
      fullPage: true,
    });
  }
}

try {
  [accounts.platform, accounts.ownerA, accounts.ownerB, accounts.teacherA] = await Promise.all([
    createAccount("统计验收平台负责人", "platform_super_admin", "platform_owner"),
    createAccount("统计验收机构A负责人", "ceo"),
    createAccount("统计验收机构B负责人", "ceo"),
    createAccount("统计验收机构A老师", "teacher"),
  ]);
  accounts.students = await Promise.all(
    Array.from({ length: 40 }, (_, index) => createAccount(`统计验收学生${index + 1}`, "student")),
  );

  const requirements = {
    textbook: { required_chapter_count: 16, require_all_mandatory_chapters: true },
    required_assignments: { require_all_assigned: true, require_submitted: true, require_graded: true },
    formal_chapter_exams: { minimum_completed_count: 16, minimum_passed_count: 16, passing_score: 60 },
    stage_exams: { required_count: 4, require_published_grades: true },
    midterm_exam: { require_published_grade: true, passing_score: 60 },
    final_exam: { require_published_grade: true, passing_score: 60 },
    subjective_grading: { require_all_certification_items_graded: true },
    overall_score: { minimum_score: 60 },
    blocking_gaps: { maximum_allowed_count: 0 },
  };
  const cohorts = [
    { tenantId: fixture.tenantA, ownerId: accounts.ownerA.id, policyId: fixture.policyV1, version: 1, students: accounts.students.slice(0, 10), eligible: 6, issued: 5 },
    { tenantId: fixture.tenantA, ownerId: accounts.ownerA.id, policyId: fixture.policyV2, version: 2, students: accounts.students.slice(10, 20), eligible: 8, issued: 6 },
    { tenantId: fixture.tenantB, ownerId: accounts.ownerB.id, policyId: fixture.policyV1, version: 1, students: accounts.students.slice(20, 30), eligible: 5, issued: 2 },
    { tenantId: fixture.tenantB, ownerId: accounts.ownerB.id, policyId: fixture.policyV2, version: 2, students: accounts.students.slice(30, 40), eligible: 7, issued: 4 },
  ];

  for (const cohort of cohorts) {
    cohort.students.forEach((student, index) => {
      const eligible = index < cohort.eligible;
      const nonEligibleStatuses = ["not_eligible", "pending_grading", "not_ready"];
      const gaps = eligible
        ? []
        : [
            {
              key: "overall-score",
              category: "overall_score",
              title: "综合成绩",
              status: index % 2 === 0 ? "failed" : "in_progress",
              href: "/dashboard/grades",
              reason: "综合成绩尚未达到当前结课政策要求。",
            },
            ...(index % 2 === 0
              ? [{
                  key: "textbook:chapter:16",
                  category: "course",
                  title: "第16章教材",
                  status: "missing",
                  href: "/dashboard/courses",
                  reason: "第16章教材尚未完成。",
                }]
              : []),
          ];
      evaluations.push({
        id: randomUUID(),
        tenantId: cohort.tenantId,
        ownerId: cohort.ownerId,
        studentId: student.id,
        policyId: cohort.policyId,
        version: cohort.version,
        status: eligible ? "eligible" : nonEligibleStatuses[index % nonEligibleStatuses.length],
        eligible,
        issued: index < cohort.issued,
        gaps,
        monthsAgo: index < 5 ? 2 : 1,
      });
    });
  }

  const membershipRows = [
    `('${fixture.tenantA}', '${accounts.ownerA.id}', 'ceo', 'active', 'normal', true, now())`,
    `('${fixture.tenantA}', '${accounts.teacherA.id}', 'teacher', 'active', 'normal', true, now())`,
    `('${fixture.tenantB}', '${accounts.ownerB.id}', 'ceo', 'active', 'normal', true, now())`,
    ...evaluations.map((evaluation) =>
      `('${evaluation.tenantId}', '${evaluation.studentId}', 'student', 'active', 'normal', true, now())`,
    ),
  ];
  const evaluationRows = evaluations.map((evaluation) => `(
    '${evaluation.id}', '${evaluation.tenantId}', '${evaluation.studentId}', '${APP_ID}', '${COURSE_ID}',
    '${evaluation.policyId}', ${evaluation.version}, '${evaluation.status}', ${evaluation.eligible},
    ${evaluation.eligible ? 80 : 48}, '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
    '{"fixture":true}'::jsonb, '${sqlLiteral(JSON.stringify(evaluation.gaps))}'::jsonb,
    now() - interval '${evaluation.monthsAgo} months', 'packet13-statistics-v1', md5('${evaluation.id}')
  )`);

  runSql(`
    begin;
    insert into public.tenants (id, slug, name, status, created_by) values
      ('${fixture.tenantA}', '${fixture.tenantSlugA}', '统计验收机构A', 'active', '${accounts.ownerA.id}'),
      ('${fixture.tenantB}', '${fixture.tenantSlugB}', '统计验收机构B', 'active', '${accounts.ownerB.id}');

    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values ${membershipRows.join(",\n")};

    update public.tenant_student_apps
    set is_enabled = true, status = 'active'
    where tenant_id in ('${fixture.tenantA}', '${fixture.tenantB}')
      and app_id = '${APP_ID}';

    insert into public.staff_app_assignments (
      tenant_id, staff_id, app_id, access_role,
      can_manage_students, can_manage_content, can_manage_assessments,
      can_view_analytics, status, assigned_by
    ) values (
      '${fixture.tenantA}', '${accounts.teacherA.id}', '${APP_ID}', 'teacher',
      false, false, true, true, 'active', '${accounts.ownerA.id}'
    );

    select set_config('request.jwt.claim.sub', '${accounts.platform.id}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, requirements, created_by
    ) values
      ('${fixture.policyV1}', '${APP_ID}', '${COURSE_ID}', '${fixture.policyCode}', 1,
       '统计验收政策第一版', 'draft', false, '${sqlLiteral(JSON.stringify(requirements))}'::jsonb, '${accounts.platform.id}'),
      ('${fixture.policyV2}', '${APP_ID}', '${COURSE_ID}', '${fixture.policyCode}', 2,
       '统计验收政策第二版', 'draft', false, '${sqlLiteral(JSON.stringify(requirements))}'::jsonb, '${accounts.platform.id}');

    insert into public.student_course_completion_evaluations (
      id, tenant_id, student_id, student_app_id, course_id,
      policy_id, policy_version, status, eligible, overall_score,
      requirements_snapshot, evidence_snapshot, missing_requirements,
      evaluated_at, evaluation_version, evaluation_fingerprint
    ) values ${evaluationRows.join(",\n")};
    commit;
  `);

  const certificateRows = evaluations
    .filter((evaluation) => evaluation.issued)
    .map((evaluation, index) => `(
      '${randomUUID()}', '${evaluation.tenantId}', '${evaluation.studentId}', '${APP_ID}', '${COURSE_ID}',
      '${evaluation.id}', 'CERT-2026-${index.toString(16).toUpperCase().padStart(8, "0")}-00000000-00000000-00000000', 'issued',
      '统计验收学生', '韩国语一级', '{}'::jsonb, '{"fixture":true}'::jsonb, 80,
      '${evaluation.ownerId}', now(), now()
    )`);
  runSql(`
    insert into public.course_completion_certificates (
      id, tenant_id, student_id, student_app_id, course_id, evaluation_id,
      certificate_number, status, student_name_snapshot, course_title_snapshot,
      policy_snapshot, evidence_snapshot, overall_score_snapshot,
      issued_by, issued_at, created_at
    ) values ${certificateRows.join(",\n")};
    select pg_notify('pgrst', 'reload schema');
  `);
  await new Promise((resolve) => setTimeout(resolve, 700));

  const [ownerAClient, ownerBClient, teacherClient, platformClient] = await Promise.all([
    signIn(accounts.ownerA),
    signIn(accounts.ownerB),
    signIn(accounts.teacherA),
    signIn(accounts.platform),
  ]);

  rpcCalls = 0;
  const ownerAResult = await countedRpc(ownerAClient, "get_institution_course_completion_statistics");
  assert.equal(rpcCalls, 1, "机构统计应只调用一次 RPC");
  failOn(ownerAResult.error, "机构A读取结课统计");
  assert.equal(ownerAResult.data.tenantId, fixture.tenantA);
  assert.equal(ownerAResult.data.totalEvaluations, 20);
  assert.equal(ownerAResult.data.eligibleCount, 14);
  assert.equal(ownerAResult.data.eligibleRate, 70);
  assert.equal(ownerAResult.data.issuedCount, 11);
  assert.equal(ownerAResult.data.issuanceRate, 78.6);

  rpcCalls = 0;
  const ownerBResult = await countedRpc(ownerBClient, "get_institution_course_completion_statistics");
  assert.equal(rpcCalls, 1, "机构B统计应只调用一次 RPC");
  failOn(ownerBResult.error, "机构B读取结课统计");
  assert.equal(ownerBResult.data.tenantId, fixture.tenantB);
  assert.equal(ownerBResult.data.totalEvaluations, 20);
  assert.equal(ownerBResult.data.eligibleCount, 12);
  assert.equal(ownerBResult.data.issuedCount, 6);
  assert.equal(ownerBResult.data.issuanceRate, 50);

  const teacherResult = await teacherClient.rpc("get_institution_course_completion_statistics", {
    p_student_app_id: APP_ID,
  });
  assert.ok(teacherResult.error);
  assert.match(teacherResult.error.message, /只有机构负责人/);

  rpcCalls = 0;
  const platformResult = await countedRpc(platformClient, "get_platform_course_completion_trends");
  assert.equal(rpcCalls, 1, "平台趋势应只调用一次 RPC");
  failOn(platformResult.error, "平台读取跨机构结课趋势");
  const fixtureTrend = platformResult.data.trend.filter(
    (point) => point.policyCode === fixture.policyCode,
  );
  assert.equal(fixtureTrend.length, 4);
  assert.deepEqual(
    [...new Set(fixtureTrend.map((point) => point.policyVersion))].sort(),
    [1, 2],
  );
  assert.deepEqual(
    [...new Set(fixtureTrend.map((point) => point.policyId))].sort(),
    [fixture.policyV1, fixture.policyV2].sort(),
  );
  assert.ok(fixtureTrend.every((point) => point.institutionCount === 2));
  assert.ok(fixtureTrend.every((point) => point.totalEvaluations === 10));

  const manualA = runSql(`
    select count(*) || ','
      || count(*) filter (where evaluation.status = 'eligible' and evaluation.eligible) || ','
      || count(certificate.evaluation_id)
    from public.student_course_completion_evaluations as evaluation
    left join public.course_completion_certificates as certificate
      on certificate.evaluation_id = evaluation.id and certificate.status = 'issued'
    where evaluation.tenant_id = '${fixture.tenantA}'
      and evaluation.student_app_id = '${APP_ID}'
      and evaluation.status <> 'superseded';
  `).split(",").map(Number);
  assert.deepEqual(manualA, [20, 14, 11]);

  const manualOverallGapCount = Number(runSql(`
    select count(*)
    from public.student_course_completion_evaluations as evaluation
    cross join lateral jsonb_array_elements(evaluation.missing_requirements) as gap(value)
    where evaluation.tenant_id = '${fixture.tenantA}'
      and evaluation.student_app_id = '${APP_ID}'
      and evaluation.status <> 'superseded'
      and gap.value ->> 'key' = 'overall-score'
      and gap.value ->> 'category' = 'overall_score';
  `));
  const rpcOverallGap = ownerAResult.data.gaps.find(
    (gap) => gap.key === "overall-score" && gap.category === "overall_score",
  );
  assert.equal(rpcOverallGap.count, manualOverallGapCount);
  assert.equal(manualOverallGapCount, 6);

  const institutionPlan = JSON.parse(runSql(`
    explain (analyze, format json)
    select gap.value ->> 'key', gap.value ->> 'category', count(*)
    from public.student_course_completion_evaluations as evaluation
    cross join lateral jsonb_array_elements(evaluation.missing_requirements) as gap(value)
    where evaluation.tenant_id = '${fixture.tenantA}'
      and evaluation.student_app_id = '${APP_ID}'
      and evaluation.status <> 'superseded'
    group by gap.value ->> 'key', gap.value ->> 'category';
  `));
  const platformPlan = JSON.parse(runSql(`
    explain (analyze, format json)
    select date_trunc('month', evaluation.evaluated_at), policy.policy_code,
      evaluation.policy_version, count(*), count(distinct evaluation.tenant_id)
    from public.student_course_completion_evaluations as evaluation
    join public.course_completion_policies as policy
      on policy.id = evaluation.policy_id and policy.version = evaluation.policy_version
    where evaluation.student_app_id = '${APP_ID}'
      and evaluation.status <> 'superseded'
      and evaluation.tenant_id in ('${fixture.tenantA}', '${fixture.tenantB}')
    group by date_trunc('month', evaluation.evaluated_at), policy.policy_code,
      evaluation.policy_version;
  `));
  const institutionPlanNodes = getPlanNodeTypes(institutionPlan);
  const platformPlanNodes = getPlanNodeTypes(platformPlan);
  assert.ok(institutionPlanNodes.includes("Aggregate"));
  assert.ok(platformPlanNodes.includes("Aggregate"));

  process.stdout.write(`${JSON.stringify({
    fixture: { institutions: 2, students: 40, evaluations: evaluations.length, statuses: [...new Set(evaluations.map((item) => item.status))] },
    institutionIsolation: {
      tenantA: { total: ownerAResult.data.totalEvaluations, eligible: ownerAResult.data.eligibleCount, issued: ownerAResult.data.issuedCount },
      tenantB: { total: ownerBResult.data.totalEvaluations, eligible: ownerBResult.data.eligibleCount, issued: ownerBResult.data.issuedCount },
      teacherDenied: teacherResult.error.message,
    },
    manualChecks: { tenantACounts: manualA, tenantAOverallGapCount: manualOverallGapCount },
    platformTrend: { rows: fixtureTrend.length, versions: [1, 2], eachRowInstitutionCount: 2 },
    performance: {
      rpcCallsPerView: 1,
      recordCount: evaluations.length,
      institutionExplainNodeTypes: institutionPlanNodes,
      platformExplainNodeTypes: platformPlanNodes,
    },
  }, null, 2)}\n`);

  await mkdir(evidenceDir, { recursive: true });
  if (!process.env.COMPLETION_STATISTICS_APP_URL) {
    server = spawn("npm", ["run", "dev", "--", "--port", String(APP_PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_DIST_DIR: ".next-statistics",
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
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
  const institutionContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const institutionPage = await institutionContext.newPage();
  await login(institutionPage, accounts.ownerA);
  await institutionPage.goto(
    `${APP_URL}/${fixture.tenantSlugA}/dashboard/admin/apps/korean/completion-review`,
    { waitUntil: "networkidle" },
  );
  await institutionPage.getByRole("heading", { name: "结课统计", exact: true }).waitFor();
  const institutionText = await institutionPage.locator("body").innerText();
  assert.match(institutionText, /70\.0%/);
  assert.match(institutionText, /78\.6%/);
  assert.match(institutionText, /主要未达标缺口/);
  await institutionPage.screenshot({
    path: `${evidenceDir}/01-institution-statistics.png`,
    fullPage: true,
  });
  await auditResponsiveStatistics(
    institutionPage,
    'section[aria-label="结课统计"]',
    "03-institution",
  );
  await institutionContext.close();

  const platformContext = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const platformPage = await platformContext.newPage();
  await login(platformPage, accounts.platform);
  await platformPage.goto(
    `${APP_URL}/platform/dashboard/admin/apps/korean/completion-review`,
    { waitUntil: "networkidle" },
  );
  await platformPage.getByRole("heading", { name: "跨机构结课趋势", exact: true }).waitFor();
  const platformText = await platformPage.locator("body").innerText();
  assert.match(platformText, new RegExp(`${fixture.policyCode} 第 1 版`));
  assert.match(platformText, new RegExp(`${fixture.policyCode} 第 2 版`));
  await platformPage.screenshot({
    path: `${evidenceDir}/02-platform-statistics.png`,
    fullPage: true,
  });
  await auditResponsiveStatistics(
    platformPage,
    'section[aria-label="跨机构结课趋势"]',
    "04-platform",
  );
  await platformPage.setViewportSize({ width: 768, height: 1024 });
  const tableScroller = platformPage.getByLabel("跨机构结课趋势数据表");
  await tableScroller.focus();
  assert.equal(await tableScroller.evaluate((element) => element === document.activeElement), true);
  await platformContext.close();
  console.log("PASS 统计页面 375/768/1280px：无页面横向滚动，触控区不小于44px，趋势表可键盘聚焦");
  console.log(`BROWSER_EVIDENCE ${evidenceDir}`);
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Development server already stopped.
    }
  }
  const cleanupErrors = [];
  try {
    runSql(`
      begin;
      set local session_replication_role = replica;
      do $$
      declare tenant_table record;
      begin
        for tenant_table in
          select distinct column_info.table_name
          from information_schema.columns as column_info
          join information_schema.tables as table_info
            on table_info.table_schema = column_info.table_schema
           and table_info.table_name = column_info.table_name
          where column_info.table_schema = 'public'
            and column_info.column_name = 'tenant_id'
            and table_info.table_type = 'BASE TABLE'
        loop
          execute format('delete from public.%I where tenant_id = any($1)', tenant_table.table_name)
          using array['${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid];
        end loop;
      end;
      $$;
      delete from public.course_completion_refresh_tasks
      where policy_id in ('${fixture.policyV1}'::uuid, '${fixture.policyV2}'::uuid);
      delete from public.course_completion_policies
      where id in ('${fixture.policyV1}'::uuid, '${fixture.policyV2}'::uuid);
      delete from public.tenants
      where id in ('${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid);
      set local session_replication_role = origin;
      commit;
    `);
  } catch (error) {
    cleanupErrors.push(new Error(`统计验收数据清理失败: ${error.message}`));
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(new Error(`统计验收账号清理失败 (${userId}): ${error.message}`));
  }
  try {
    const retained = Number(runSql(`
      select count(*) from public.student_course_completion_evaluations
      where tenant_id in ('${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid);
    `));
    if (retained !== 0) cleanupErrors.push(new Error(`仍保留 ${retained} 条统计验收资格记录`));
  } catch (error) {
    cleanupErrors.push(new Error(`统计验收清理核对失败: ${error.message}`));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "统计验收数据未完全清理");
  console.log("CLEANUP completion statistics fixture completed with zero retained evaluation rows");
}
