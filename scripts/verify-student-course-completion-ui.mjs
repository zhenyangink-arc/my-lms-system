#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const APP_URL = process.env.STUDENT_COMPLETION_APP_URL ?? "http://127.0.0.1:3000";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";
const evidenceDir = "/tmp/student-course-completion-evidence";
const password = `Local-${crypto.randomUUID()}-Aa1!`;
const fixture = {
  tenant: crypto.randomUUID(),
  policy: crypto.randomUUID(),
  notMetEvaluation: crypto.randomUUID(),
  pendingEvaluation: crypto.randomUUID(),
  issuedEvaluation: crypto.randomUUID(),
};
const tenantSlug = `student-completion-${Date.now()}`;
const users = [];
let browser = null;

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

async function createUser(label, role, globalRole = "member") {
  const email = `student-completion-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@local.test`;
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
    set role = '${sqlLiteral(role)}', global_role = '${sqlLiteral(globalRole)}',
        full_name = '${sqlLiteral(label)}', status = 'active'
    where id = '${data.user.id}'::uuid;
  `);
  return { id: data.user.id, email, label };
}

async function apiFor(account) {
  const client = createClient(LOCAL_URL, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  failOn(error, `${account.label} API 登录`);
  return client;
}

async function browserLogin(page, account) {
  runSql("grant select on public.profiles, public.courses to authenticated;");
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(account.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  const dismissFocusPrompt = page.getByRole("button", { name: "暂不进入", exact: true });
  const focusPromptVisible = await dismissFocusPrompt
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (focusPromptVisible) {
    await dismissFocusPrompt.click();
    await dismissFocusPrompt.waitFor({ state: "hidden" });
  }
}

async function dismissFocusPrompt(page) {
  const dismiss = page.getByRole("button", { name: "暂不进入", exact: true });
  const visible = await dismiss
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (visible) {
    await dismiss.click();
    await dismiss.waitFor({ state: "hidden" });
  }
}

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
const completeEvidence = {
  textbook: { requiredChapterCount: 16, completedChapterCount: 16, chapters: [] },
  requiredAssignments: [],
  formalChapterExams: [],
  stageExams: [],
  midtermExam: {
    itemKey: "midterm-exam", motherPaperCode: "EX-K1-MID-V1",
    score: 86, gradeReleased: true, href: "/dashboard/assignments",
  },
  finalExam: {
    itemKey: "final-exam", motherPaperCode: "EX-K1-FIN-V1",
    score: 91, gradeReleased: true, href: "/dashboard/assignments",
  },
  subjectiveGrading: { required: true, pendingCount: 0, complete: true },
  overallScore: { published: true, score: 88, href: "/dashboard/grades" },
};

try {
  await mkdir(evidenceDir, { recursive: true });
  const [platformOwner, owner, notMetStudent, pendingStudent, issuedStudent] = await Promise.all([
    createUser("结课页面平台负责人", "platform_super_admin", "platform_owner"),
    createUser("结课页面机构负责人", "ceo"),
    createUser("未达标学生", "student"),
    createUser("等待批改学生", "student"),
    createUser("已获证书学生", "student"),
  ]);

  const notMetGaps = [
    {
      key: "final-exam", category: "final_exam", title: "期末考试", status: "failed",
      currentValue: 58, requiredValue: 60, href: "/dashboard/assignments",
      reason: "期末考试成绩为58分，政策要求60分。",
    },
    {
      key: "textbook:chapter:16", category: "course", title: "第16章教材", status: "in_progress",
      currentValue: 0, requiredValue: 1, href: "/dashboard/courses/korean/beginner/korean-level-one/korean-level-one-16",
      reason: "第16章教材尚未完成。",
    },
  ];
  const pendingGaps = [
    {
      key: "manual-grading:final", category: "manual_grading", title: "期末考试口语写作批改",
      status: "pending_grading", href: "/dashboard/assignments",
      reason: "期末考试口语或写作题正在等待老师批改并发布成绩。",
    },
  ];
  const pendingEvidence = {
    ...completeEvidence,
    finalExam: {
      itemKey: "final-exam", motherPaperCode: "EX-K1-FIN-V1", score: null,
      gradeReleased: false, pendingGrading: true, manualQuestionCount: 2,
      href: "/dashboard/assignments",
    },
    subjectiveGrading: { required: true, pendingCount: 2, complete: false },
    overallScore: { published: false, href: "/dashboard/grades" },
  };

  runSql(`
    begin;
    insert into public.tenants (id, slug, name, status, created_by)
    values ('${fixture.tenant}', '${tenantSlug}', '结课页面验收机构', 'active', '${owner.id}');

    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values
      ('${fixture.tenant}', '${owner.id}', 'ceo', 'active', 'normal', true, now()),
      ('${fixture.tenant}', '${notMetStudent.id}', 'student', 'active', 'vip2', true, now()),
      ('${fixture.tenant}', '${pendingStudent.id}', 'student', 'active', 'vip2', true, now()),
      ('${fixture.tenant}', '${issuedStudent.id}', 'student', 'active', 'vip2', true, now());

    update public.tenant_student_apps
    set is_enabled = true, status = 'active'
    where tenant_id = '${fixture.tenant}' and app_id = '${APP_ID}';

    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values
      ('${fixture.tenant}', '${notMetStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${owner.id}'),
      ('${fixture.tenant}', '${pendingStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${owner.id}'),
      ('${fixture.tenant}', '${issuedStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${owner.id}');

    select set_config('request.jwt.claim.sub', '${platformOwner.id}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, requirements, created_by
    ) values (
      '${fixture.policy}', '${APP_ID}', '${COURSE_ID}',
      'STUDENT-UI-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}',
      1, '学生结课页验收政策', 'draft', false,
      '${sqlLiteral(JSON.stringify(requirements))}'::jsonb, '${platformOwner.id}'
    );

    insert into public.student_course_completion_evaluations (
      id, tenant_id, student_id, student_app_id, course_id, policy_id, policy_version,
      status, eligible, overall_score, requirements_snapshot, evidence_snapshot,
      missing_requirements, evaluated_at, evaluation_version, evaluation_fingerprint
    ) values
      (
        '${fixture.notMetEvaluation}', '${fixture.tenant}', '${notMetStudent.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'not_eligible', false, 58,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify({ ...completeEvidence, finalExam: { ...completeEvidence.finalExam, score: 58 } }))}'::jsonb,
        '${sqlLiteral(JSON.stringify(notMetGaps))}'::jsonb, now(), 'packet11-browser-v1', md5('${fixture.notMetEvaluation}')
      ),
      (
        '${fixture.pendingEvaluation}', '${fixture.tenant}', '${pendingStudent.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'pending_grading', false, null,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify(pendingEvidence))}'::jsonb,
        '${sqlLiteral(JSON.stringify(pendingGaps))}'::jsonb, now(), 'packet11-browser-v1', md5('${fixture.pendingEvaluation}')
      ),
      (
        '${fixture.issuedEvaluation}', '${fixture.tenant}', '${issuedStudent.id}', '${APP_ID}', '${COURSE_ID}',
        '${fixture.policy}', 1, 'eligible', true, 88,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '${sqlLiteral(JSON.stringify(completeEvidence))}'::jsonb,
        '[]'::jsonb, now(), 'packet11-browser-v1', md5('${fixture.issuedEvaluation}')
      );
    commit;
    select pg_notify('pgrst', 'reload schema');
  `);

  const ownerApi = await apiFor(owner);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const issued = await ownerApi.rpc("issue_course_completion_certificate", {
    p_evaluation_id: fixture.issuedEvaluation,
  });
  failOn(issued.error, "颁发测试证书");
  const revoked = await ownerApi.rpc("revoke_course_completion_certificate", {
    p_certificate_id: issued.data.id,
    p_reason: "证书姓名资料核对后重新颁发",
  });
  failOn(revoked.error, "撤销测试证书");
  const reissued = await ownerApi.rpc("reissue_course_completion_certificate", {
    p_certificate_id: issued.data.id,
    p_reason: "姓名资料已经确认",
    p_evaluation_id: fixture.issuedEvaluation,
  });
  failOn(reissued.error, "重新颁发测试证书");

  const studentApis = await Promise.all([
    apiFor(notMetStudent), apiFor(pendingStudent), apiFor(issuedStudent),
  ]);
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const visibility = await Promise.all(
    studentApis.map(async (client) => {
      const [evaluations, certificates] = await Promise.all([
        client.from("student_course_completion_evaluations").select("student_id"),
        client.from("course_completion_certificates").select("student_id"),
      ]);
      failOn(evaluations.error, "学生读取本人资格");
      failOn(certificates.error, "学生读取本人证书");
      return { evaluations: evaluations.data, certificates: certificates.data };
    }),
  );
  assert.deepEqual(visibility.map((item) => item.evaluations.length), [1, 1, 1]);
  assert.deepEqual(visibility.map((item) => item.certificates.length), [0, 0, 2]);
  assert.ok(visibility.every((item, index) =>
    item.evaluations.every((row) => row.student_id === [notMetStudent, pendingStudent, issuedStudent][index].id) &&
    item.certificates.every((row) => row.student_id === [notMetStudent, pendingStudent, issuedStudent][index].id),
  ));
  console.log("PASS RLS：三个学生账号均只能读取自己的资格与证书");

  // Other local verification processes may restore these baseline grants when
  // they finish, so re-assert them immediately before browser navigation.
  runSql("grant select on public.profiles, public.courses to authenticated;");

  browser = await chromium.launch({ headless: true });
  const cases = [
    { account: notMetStudent, heading: "还有结课要求需要完成", file: "01-not-met.png" },
    { account: pendingStudent, heading: "已提交的内容正在批改", file: "02-pending-grading.png" },
    { account: issuedStudent, heading: "你的结课证书已颁发", file: "03-issued-conclusion.png" },
  ];
  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await browserLogin(page, item.account);
    await page.goto(`${APP_URL}/${tenantSlug}/apps/korean/grades/completion`);
    await page.waitForLoadState("networkidle");
    await dismissFocusPrompt(page);
    if (await page.getByRole("heading", { name: item.heading, exact: true }).count() === 0) {
      console.error(`DEBUG ${page.url()}\n${await page.locator("body").innerText()}`);
      await page.screenshot({ path: `${evidenceDir}/debug-missing-heading.png`, fullPage: true });
    }
    await page.getByRole("heading", { name: item.heading, exact: true }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: `${evidenceDir}/${item.file}`, fullPage: true });
    if (item.account === pendingStudent) {
      assert.match(await page.locator("body").innerText(), /已提交，无需重复提交/);
      assert.equal(await page.getByRole("link", { name: "去完成" }).count(), 0);
    }
    if (item.account === issuedStudent) {
      const activeCertificateStatus = page.getByText("重新颁发 · 有效", { exact: true });
      await activeCertificateStatus.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${evidenceDir}/03-issued-certificate.png` });
    }
    await context.close();
  }
  console.log("PASS 浏览器：未达标、等待批改、已颁发三种学生视图");

  const responsiveContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const responsivePage = await responsiveContext.newPage();
  await browserLogin(responsivePage, notMetStudent);
  await responsivePage.goto(`${APP_URL}/${tenantSlug}/apps/korean/grades/completion`);
  await dismissFocusPrompt(responsivePage);
  await responsivePage.getByRole("heading", { name: "还有结课要求需要完成" }).waitFor();
  for (const viewport of [
    { label: "mobile-375", width: 375, height: 812 },
    { label: "tablet-768", width: 768, height: 1024 },
    { label: "desktop-1280", width: 1280, height: 900 },
  ]) {
    await responsivePage.setViewportSize({ width: viewport.width, height: viewport.height });
    await responsivePage.waitForTimeout(150);
    const audit = await responsivePage.evaluate(() => {
      const root = document.querySelector(".completion-screen-page");
      const controls = root ? [...root.querySelectorAll("a,button,input,select,textarea")] : [];
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        smallControls: controls
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              text: element.getAttribute("aria-label") || element.textContent?.trim(),
              width: rect.width,
              height: rect.height,
            };
          })
          .filter((item) => item.width < 44 || item.height < 44),
      };
    });
    assert.ok(audit.scrollWidth <= audit.innerWidth, `${viewport.label}: ${JSON.stringify(audit)}`);
    assert.deepEqual(audit.smallControls, [], `${viewport.label}: ${JSON.stringify(audit)}`);
    await responsivePage.screenshot({
      path: `${evidenceDir}/04-${viewport.label}.png`,
      fullPage: true,
    });
  }
  const hintButton = responsivePage.getByRole("button", { name: "查看考试成绩说明" });
  await hintButton.focus();
  await responsivePage.keyboard.press("Enter");
  await responsivePage.getByRole("tooltip").waitFor();
  await responsivePage.keyboard.press("Escape");
  assert.equal(await hintButton.evaluate((element) => element === document.activeElement), true);
  await responsiveContext.close();
  console.log("PASS 375/768/1280px：无页面横向滚动，触控区不小于44px，标题提示支持键盘与焦点返回");

  const printContext = await browser.newContext({ viewport: { width: 1123, height: 794 } });
  const printPage = await printContext.newPage();
  await browserLogin(printPage, issuedStudent);
  await printPage.goto(`${APP_URL}/${tenantSlug}/apps/korean/grades/completion`);
  await dismissFocusPrompt(printPage);
  await printPage.getByRole("heading", { name: "你的结课证书已颁发" }).waitFor();
  await printPage.emulateMedia({ media: "print" });
  assert.equal(await printPage.locator(".completion-print-root").evaluate((element) => getComputedStyle(element).display), "block");
  assert.equal(await printPage.locator(".completion-screen-page").evaluate((element) => getComputedStyle(element).visibility), "hidden");
  await printPage.screenshot({ path: `${evidenceDir}/05-print-preview.png`, fullPage: true });
  await printPage.pdf({ path: `${evidenceDir}/05-certificate.pdf`, format: "A4", landscape: true, printBackground: true });
  await printContext.close();
  console.log("PASS 打印：屏幕布局隐藏，独立A4横向证书布局可见");
  console.log(`EVIDENCE ${evidenceDir}`);
} finally {
  if (browser) await browser.close();
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
            on tables.table_schema = columns.table_schema and tables.table_name = columns.table_name
          where columns.table_schema = 'public' and columns.column_name = 'tenant_id'
            and tables.table_type = 'BASE TABLE'
        loop
          execute format('delete from public.%I where tenant_id = $1', tenant_table.table_name)
          using '${fixture.tenant}'::uuid;
        end loop;
      end;
      $$;
      delete from public.course_completion_refresh_tasks where policy_id = '${fixture.policy}'::uuid;
      delete from public.course_completion_policies where id = '${fixture.policy}'::uuid;
      delete from public.tenants where id = '${fixture.tenant}'::uuid;
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
