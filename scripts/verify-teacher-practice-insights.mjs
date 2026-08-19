#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_PORT = 3117;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const APP_ID = "10000000-0000-4000-8000-000000000001";
const tenantId = crypto.randomUUID();
const tenantSlug = `teacher-practice-${Date.now()}`;
const password = `Local-${crypto.randomUUID()}!`;

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
assert.ok(publishableKey && secretKey, "无法从本地 Kong 配置读取 API key");

const authenticatedReadTables = [
  "profiles",
  "tenants",
  "tenant_memberships",
  "tenant_student_apps",
  "student_app_enrollments",
  "staff_app_assignments",
  "tenant_student_assignments",
  "student_chapter_practice_progress",
  "student_review_items",
  "chapter_practice_units",
  "course_chapters",
  "lessons",
  "courses",
  "learning_record_notes",
];
const originallyMissingRead = authenticatedReadTables.filter(
  (table) => runSql(
    `select has_table_privilege('authenticated', 'public.${table}', 'select');`,
  ) !== "t",
);
if (originallyMissingRead.length) {
  runSql(
    `grant select on ${originallyMissingRead.map((table) => `public.${table}`).join(", ")} to authenticated;`,
  );
}

const fixture = JSON.parse(runSql(`
  select jsonb_build_object(
    'unitId', unit.id,
    'chapterId', chapter.id,
    'chapterTitle', chapter.title,
    'courseId', course.id
  )
  from public.chapter_practice_units as unit
  join public.course_chapters as chapter on chapter.id = unit.course_chapter_id
  join public.lessons as lesson on lesson.id = chapter.lesson_id
  join public.courses as course on course.id = lesson.course_id
  where unit.status = 'published'
    and course.student_app_id = '${APP_ID}'::uuid
  order by unit.version desc
  limit 1;
`));

const admin = createClient(LOCAL_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const users = [];
let browser = null;
let server = null;
let serverOutput = "";

async function createUser(label, role) {
  const email = `teacher-practice-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data.user);
  users.push(data.user.id);
  runSql(`
    update public.profiles
    set role = '${sqlLiteral(role)}', full_name = '${sqlLiteral(label)}', status = 'active'
    where id = '${data.user.id}'::uuid;
  `);
  return { id: data.user.id, email };
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Next.js is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`应用启动超时\n${serverOutput}`);
}

async function login(page, email) {
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  try {
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  } catch (error) {
    throw new Error(
      `登录后未离开登录页：${email}\n${(await page.locator("body").innerText()).slice(0, 2000)}\n${serverOutput}`,
      { cause: error },
    );
  }
}

try {
  const [teacher, otherTeacher, grammarStudent, listeningStudent, otherStudent] =
    await Promise.all([
      createUser("巩固验收老师", "teacher"),
      createUser("其他验收老师", "teacher"),
      createUser("语法薄弱学生", "student"),
      createUser("听力薄弱学生", "student"),
      createUser("其他老师学生", "student"),
    ]);

  runSql(`
    insert into public.tenants (id, slug, name, status, created_by)
    values (
      '${tenantId}'::uuid,
      '${tenantSlug}',
      '老师巩固学情验收机构',
      'active',
      '${teacher.id}'::uuid
    );
    update public.tenant_student_apps
    set is_enabled = true, status = 'active'
    where tenant_id = '${tenantId}'::uuid and app_id = '${APP_ID}'::uuid;

    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default
    ) values
      ('${tenantId}', '${teacher.id}', 'teacher', 'active', 'normal', true),
      ('${tenantId}', '${otherTeacher.id}', 'teacher', 'active', 'normal', true),
      ('${tenantId}', '${grammarStudent.id}', 'student', 'active', 'vip2', true),
      ('${tenantId}', '${listeningStudent.id}', 'student', 'active', 'vip2', true),
      ('${tenantId}', '${otherStudent.id}', 'student', 'active', 'vip2', true);

    insert into public.staff_app_assignments (
      tenant_id, staff_id, app_id, access_role,
      can_manage_students, can_manage_content, can_manage_assessments,
      can_view_analytics, status, assigned_by
    ) values
      ('${tenantId}', '${teacher.id}', '${APP_ID}', 'teacher', false, false, true, true, 'active', '${teacher.id}'),
      ('${tenantId}', '${otherTeacher.id}', '${APP_ID}', 'teacher', false, false, true, true, 'active', '${teacher.id}');

    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values
      ('${tenantId}', '${grammarStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${teacher.id}'),
      ('${tenantId}', '${listeningStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${teacher.id}'),
      ('${tenantId}', '${otherStudent.id}', '${APP_ID}', 'active', 'vip2', now() - interval '1 day', '${teacher.id}');

    insert into public.tenant_student_assignments (
      tenant_id, student_id, teacher_id, student_app_id, assigned_by
    ) values
      ('${tenantId}', '${grammarStudent.id}', '${teacher.id}', '${APP_ID}', '${teacher.id}'),
      ('${tenantId}', '${listeningStudent.id}', '${teacher.id}', '${APP_ID}', '${teacher.id}'),
      ('${tenantId}', '${otherStudent.id}', '${otherTeacher.id}', '${APP_ID}', '${teacher.id}');

    insert into public.student_chapter_practice_progress (
      tenant_id, student_id, practice_unit_id, status,
      progress_percent, mastery_percent, correct_count, attempt_count,
      started_at, last_practiced_at
    ) values
      ('${tenantId}', '${grammarStudent.id}', '${fixture.unitId}', 'needs_reinforcement', 68, 44, 4, 9, now() - interval '2 days', now() - interval '1 hour'),
      ('${tenantId}', '${listeningStudent.id}', '${fixture.unitId}', 'in_progress', 52, 61, 5, 8, now() - interval '3 days', now() - interval '2 hours'),
      ('${tenantId}', '${otherStudent.id}', '${fixture.unitId}', 'needs_reinforcement', 20, 12, 1, 8, now() - interval '4 days', now() - interval '3 hours');

    insert into public.student_review_items (
      tenant_id, student_id, student_app_id, source_type, source_id,
      course_id, course_chapter_id, skill, content_snapshot,
      student_answer_snapshot, feedback_snapshot, error_count, status
    ) values
      ('${tenantId}', '${grammarStudent.id}', '${APP_ID}', 'teacher_homework', '${crypto.randomUUID()}',
       '${fixture.courseId}', '${fixture.chapterId}', 'grammar', '{"sourceTitle":"语法验收作业"}', '{}', '{}', 7, 'pending'),
      ('${tenantId}', '${listeningStudent.id}', '${APP_ID}', 'specialized_practice', '${crypto.randomUUID()}',
       '${fixture.courseId}', '${fixture.chapterId}', 'listening', '{"sourceTitle":"听力验收训练"}', '{}', '{}', 9, 'reviewing'),
      ('${tenantId}', '${otherStudent.id}', '${APP_ID}', 'teacher_homework', '${crypto.randomUUID()}',
       '${fixture.courseId}', '${fixture.chapterId}', 'writing', '{"sourceTitle":"写作验收作业"}', '{}', '{}', 99, 'pending');
  `);

  const teacherApi = createClient(LOCAL_URL, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await teacherApi.auth.signInWithPassword({
    email: teacher.email,
    password,
  });
  assert.ifError(signInError);
  // PostgREST rejects a token generated in the same clock tick on some local
  // container combinations as "issued at future".
  await new Promise((resolve) => setTimeout(resolve, 1_200));
  const [{ data: visibleProgress, error: progressError }, { data: visibleReviews, error: reviewError }] =
    await Promise.all([
      teacherApi
        .from("student_chapter_practice_progress")
        .select("student_id,status,progress_percent,mastery_percent")
        .eq("tenant_id", tenantId),
      teacherApi
        .from("student_review_items")
        .select("student_id,skill,error_count,status")
        .eq("tenant_id", tenantId),
    ]);
  assert.ifError(progressError);
  assert.ifError(reviewError);
  assert.deepEqual(
    new Set((visibleProgress ?? []).map((row) => row.student_id)),
    new Set([grammarStudent.id, listeningStudent.id]),
  );
  assert.deepEqual(
    new Set((visibleReviews ?? []).map((row) => row.student_id)),
    new Set([grammarStudent.id, listeningStudent.id]),
  );
  console.log("PASS RLS boundary: teacher reads two assigned students and not the other teacher's student");

  const localEnvironment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
  };
  if (process.env.SKIP_TEACHER_PRACTICE_INSIGHTS_BUILD !== "1") {
    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      env: localEnvironment,
      stdio: "inherit",
    });
  }
  server = spawn("npm", ["run", "start", "--", "--port", String(APP_PORT)], {
    cwd: process.cwd(),
    env: localEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-16_000);
  });
  server.stderr.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-16_000);
  });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, teacher.email);
  await teacherPage.goto(
    `${APP_URL}/${tenantSlug}/dashboard/admin/apps/korean/practice-insights`,
  );
  await teacherPage.waitForLoadState("networkidle");
  await teacherPage.getByRole("heading", { name: "巩固学情", exact: true }).waitFor();
  const bodyText = await teacherPage.locator("body").innerText();
  assert.match(bodyText, /语法薄弱学生/);
  assert.match(bodyText, /听力薄弱学生/);
  assert.doesNotMatch(bodyText, /其他老师学生/);
  assert.match(bodyText, new RegExp(`${sqlLiteral(fixture.chapterTitle)}[\\s\\S]*待加强`));
  assert.match(bodyText, /语法有 7 次未掌握错误/);
  assert.match(bodyText, /听力有 9 次未掌握错误/);
  console.log("PASS browser insights: real progress and two data-dependent suggestions are visible");

  await teacherPage
    .getByRole("button", { name: "推荐语法专项训练", exact: true })
    .click();
  await teacherPage
    .getByText("推荐已发送，学生可在学习记录中看到。")
    .waitFor({ timeout: 20_000 })
    .catch(() => undefined);
  const recommendationPageText = await teacherPage.locator("body").innerText();
  assert.match(
    recommendationPageText,
    /推荐已发送，学生可在学习记录中看到。/,
    `推荐操作未成功\n${recommendationPageText.slice(0, 4000)}\n${serverOutput}`,
  );
  const recommendation = JSON.parse(runSql(`
    select jsonb_build_object(
      'student_id', student_id,
      'title', title,
      'visibility', visibility,
      'record_type', record_type,
      'next_action', next_action
    )
    from public.learning_record_notes
    where tenant_id = '${tenantId}'::uuid
      and student_id = '${grammarStudent.id}'::uuid
      and title = '巩固推荐：语法专项训练'
    order by occurred_at desc
    limit 1;
  `));
  assert.equal(recommendation.student_id, grammarStudent.id);
  assert.equal(recommendation.visibility, "student_visible");
  assert.equal(recommendation.record_type, "plan");
  assert.match(recommendation.next_action, /practice\/skills\/grammar/);
  console.log("PASS teacher recommendation: student-visible learning plan persisted");
  await teacherContext.close();

  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const studentPage = await studentContext.newPage();
  await login(studentPage, grammarStudent.email);
  await studentPage.goto(`${APP_URL}/${tenantSlug}/apps/korean/records`);
  await studentPage.waitForLoadState("networkidle");
  const dismissFullscreen = studentPage.getByRole("button", { name: "暂不进入" });
  if (await dismissFullscreen.isVisible().catch(() => false)) await dismissFullscreen.click();
  await studentPage.getByText("老师给你的下一步建议", { exact: true }).waitFor();
  await studentPage.getByText("巩固推荐：语法专项训练", { exact: true }).waitFor();
  assert.match(await studentPage.locator("body").innerText(), /practice\/skills\/grammar/);
  console.log("PASS student interaction: recommended student sees the recommendation on the student side");
  await studentContext.close();
} finally {
  if (browser) await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Server already stopped.
    }
  }
  try {
    runSql(`
      delete from public.learning_record_notes where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_student_assignments where tenant_id = '${tenantId}'::uuid;
      delete from public.student_app_enrollments where tenant_id = '${tenantId}'::uuid;
      delete from public.staff_app_assignments where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_memberships where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_student_apps where tenant_id = '${tenantId}'::uuid;
      delete from public.application_access_audit_logs where tenant_id = '${tenantId}'::uuid;
      delete from public.tenant_membership_audit_logs where tenant_id = '${tenantId}'::uuid;
      delete from public.tenants where id = '${tenantId}'::uuid;
    `);
  } catch {
    // Preserve the original verification failure; fixture IDs are unique.
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
