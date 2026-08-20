#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_PORT = 3200 + (Number.parseInt(randomUUID().slice(0, 6), 16) % 1000);
const APP_URL = process.env.COMPLETION_RETAKE_APP_URL ?? `http://127.0.0.1:${APP_PORT}`;
const APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";
const LESSON_ID = "26fd3e57-e6cf-4df9-8514-646786f61e1d";
const MIDTERM_PAPER_ID = "d569d422-62b5-4463-bbd8-7fa11bec996f";
const evidenceDir = "/tmp/completion-retake-connections-evidence";
const password = `Local-${randomUUID()}-Aa1!`;
const ids = {
  tenant: randomUUID(), policy: randomUUID(), homework: randomUUID(), exam: randomUUID(),
  draftExam: randomUUID(), initialSubmission: randomUUID(), retakeSubmission: randomUUID(),
  assignmentQuestion: randomUUID(), chapter: randomUUID(), chapterTest: randomUUID(), practiceUnit: randomUUID(),
  practiceBlock: randomUUID(), exercise: randomUUID(), exerciseQuestion: randomUUID(),
  reviewItem: randomUUID(),
};
const tenantSlug = `completion-retake-${Date.now()}`;
const chapterSlug = `p12-${ids.chapter.slice(0, 8)}`;
const users = [];
let browser = null;
let server = null;
let serverOutput = "";

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

function lastJson(output) {
  const line = output.split("\n").findLast((candidate) => candidate.trimStart().startsWith("{"));
  assert.ok(line, `SQL 没有返回 JSON：${output}`);
  return JSON.parse(line);
}

function failOn(error, label) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

const kongConfig = execFileSync("docker", ["exec", KONG_CONTAINER, "cat", "/home/kong/kong.yml"], { encoding: "utf8" });
const jwtKeys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const keyByRole = new Map(jwtKeys.flatMap((key) => {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role ? [[payload.role, key]] : [];
  } catch { return []; }
}));
const publishableKey = keyByRole.get("anon");
const serviceRoleKey = keyByRole.get("service_role");
assert.ok(publishableKey && serviceRoleKey, "无法读取本地 Supabase API key");
const admin = createClient(LOCAL_URL, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const authenticatedReadTables = [
  "profiles", "courses", "lessons", "course_categories", "course_chapters", "course_tests", "lesson_progress",
  "lesson_questions", "lesson_resources", "digital_textbooks", "digital_textbook_versions",
  "digital_textbook_chapters", "digital_textbook_modules", "digital_textbook_nodes",
  "digital_textbook_media_assets", "digital_textbook_activities", "digital_textbook_preferences",
  "digital_textbook_node_progress", "digital_textbook_attempts", "chapter_practice_units",
  "chapter_practice_blocks", "student_chapter_practice_progress", "growth_toolbox_exercises",
  "growth_toolbox_questions", "chapter_test_attempts", "toolbox_practice_sessions",
];
const originallyMissingRead = authenticatedReadTables.filter((table) =>
  runSql(`select has_table_privilege('authenticated','public.${table}','select');`) !== "t",
);
function ensureLocalReadGrants() {
  runSql(`grant select on ${authenticatedReadTables.map((table) => `public.${table}`).join(",")} to authenticated;`);
}
ensureLocalReadGrants();
const serviceRoleCourseChapterReadMissing =
  runSql("select has_table_privilege('service_role','public.course_chapters','select');") !== "t";
runSql("grant select on public.course_chapters to service_role;");

async function createUser(label, role, globalRole = "member") {
  const email = `completion-retake-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: label },
  });
  failOn(error, `创建${label}`);
  assert.ok(data.user);
  users.push(data.user.id);
  runSql(`update public.profiles set role='${role}', global_role='${globalRole}', full_name='${sqlLiteral(label)}', status='active' where id='${data.user.id}'::uuid;`);
  return { id: data.user.id, email, label };
}

async function signIn(account) {
  const client = createClient(LOCAL_URL, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password });
  failOn(error, `${account.label} API 登录`);
  return client;
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`应用启动超时\n${serverOutput}`);
}

async function login(page, account) {
  const failures = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps")));
    }, { timeout: 30_000 });
    await page.getByLabel("登录账号").fill(account.email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "进入学习中心" }).click();
    const leftLogin = await page.waitForFunction(
      () => !window.location.pathname.startsWith("/login"),
      undefined,
      { timeout: 12_000 },
    ).then(() => true).catch(() => false);
    if (leftLogin) break;
    failures.push(`${page.url()}\n${(await page.locator("body").innerText()).slice(-1_200)}`);
  }
  assert.ok(
    !new URL(page.url()).pathname.startsWith("/login"),
    `${account.label}浏览器登录失败\n${failures.join("\n--- retry ---\n")}`,
  );
  const dismiss = page.getByRole("button", { name: "暂不进入", exact: true });
  if (await dismiss.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false)) await dismiss.click();
}

async function gotoWithRetry(page, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw lastError;
}

try {
  await mkdir(evidenceDir, { recursive: true });
  runSql(await readFile("supabase/migrations/202608200007_completion_retake_connections.sql", "utf8"));
  const [owner, teacher, student] = await Promise.all([
    createUser("补考验收平台负责人", "platform_super_admin", "platform_owner"),
    createUser("补考验收教师", "teacher"),
    createUser("补考验收学生", "student"),
  ]);
  const existingDefaultPolicyId = runSql(`select id from public.course_completion_policies
    where course_id='${COURSE_ID}' and student_app_id='${APP_ID}' and status='published'
      and is_default and effective_from<=now() and (effective_until is null or effective_until>now())
    order by effective_from desc limit 1;`);
  const policyId = existingDefaultPolicyId || ids.policy;

  const requirements = {
    textbook: { required_chapter_count: 1, require_all_mandatory_chapters: true },
    required_assignments: { require_all_assigned: true, require_submitted: false, require_graded: false },
    formal_chapter_exams: { minimum_completed_count: 0, minimum_passed_count: 0, passing_score: 60 },
    stage_exams: { required_count: 0, require_published_grades: false },
    midterm_exam: { require_published_grade: true, passing_score: 60 },
    final_exam: { require_published_grade: false, passing_score: 60 },
    subjective_grading: { require_all_certification_items_graded: false },
    overall_score: { minimum_score: 0 }, blocking_gaps: { maximum_allowed_count: 0 },
  };
  const policyInsertSql = existingDefaultPolicyId ? "" : `
    insert into public.course_completion_policies(
      id,student_app_id,course_id,policy_code,version,title,status,is_default,effective_from,
      requirements,created_by,published_by,published_at
    ) values('${ids.policy}','${APP_ID}','${COURSE_ID}','P12-${ids.policy.slice(0, 8).toUpperCase()}',1,
      '补考连接验收政策','published',true,now()-interval '1 minute',
      '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,'${owner.id}','${owner.id}',now());`;

  runSql(`
    begin;
    insert into public.tenants(id,slug,name,status,created_by)
    values('${ids.tenant}','${tenantSlug}','补考连接验收机构','active','${owner.id}');
    insert into public.tenant_memberships(tenant_id,user_id,role,status,membership_tier,is_default,joined_at) values
      ('${ids.tenant}','${owner.id}','ceo','active','normal',true,now()),
      ('${ids.tenant}','${teacher.id}','teacher','active','normal',true,now()),
      ('${ids.tenant}','${student.id}','student','active','vip2',true,now());
    update public.tenant_student_apps set is_enabled=true,status='active'
      where tenant_id='${ids.tenant}' and app_id='${APP_ID}';
    insert into public.student_app_enrollments(tenant_id,student_id,app_id,status,access_tier,starts_at,enrolled_by)
    values('${ids.tenant}','${student.id}','${APP_ID}','active','vip2',now()-interval '1 day','${owner.id}');
    set local session_replication_role=replica;
    insert into public.lesson_progress(
      tenant_id,user_id,course_id,lesson_id,status,progress_percent,started_at,last_viewed_at,completed_at
    ) values('${ids.tenant}','${student.id}','${COURSE_ID}','6ad20a2b-2306-4173-9d3f-73eb9691ff58',
      'completed',100,now()-interval '2 day',now()-interval '1 day',now()-interval '1 day');
    set local session_replication_role=origin;
    insert into public.staff_app_assignments(
      tenant_id,staff_id,app_id,access_role,can_manage_students,can_manage_content,
      can_manage_assessments,can_view_analytics,status,assigned_by
    ) values('${ids.tenant}','${teacher.id}','${APP_ID}','teacher',false,false,true,true,'active','${owner.id}');
    insert into public.tenant_student_assignments(tenant_id,student_id,teacher_id,assigned_by,student_app_id)
    values('${ids.tenant}','${student.id}','${teacher.id}','${owner.id}','${APP_ID}');

    select set_config('request.jwt.claim.sub','${owner.id}',true);
    select set_config('request.jwt.claim.role','authenticated',true);
    ${policyInsertSql}

    insert into public.course_tests(
      id,slug,course_key,chapter_number,title,korean_title,description,
      duration_minutes,passing_score,skills,version,status,lesson_id
    ) values('${ids.chapterTest}','p12-chapter-${ids.chapterTest.slice(0,8)}','korean-level-one',
      (select coalesce(max(chapter_number),0)+1 from public.course_tests where lesson_id='${LESSON_ID}'),
      '第1章巩固验收测试','제1과 복습 검증','仅供补考连接验收。',10,60,
      '["vocabulary"]'::jsonb,1,'published','${LESSON_ID}');
    insert into public.course_chapters(
      id,lesson_id,chapter_test_id,slug,title,description,is_published,sort_order,content_scope
    ) values('${ids.chapter}','${LESSON_ID}','${ids.chapterTest}','${chapterSlug}',
      '第1章巩固验收','完成本章巩固后可继续学习。',true,1,'global');
    update public.digital_textbook_chapters set status='published',production_status='published'
      where version_id=(select id from public.digital_textbook_versions order by version_number desc limit 1)
        and chapter_number=1;
    insert into public.digital_textbook_node_progress(
      tenant_id,student_id,node_id,version_id,status,completion_percent,mastery_score,attempt_count,last_activity_at
    )
    select '${ids.tenant}','${student.id}',node.id,chapter.version_id,'completed',100,100,1,now()
    from public.digital_textbook_chapters chapter
    join public.digital_textbook_modules module on module.chapter_id=chapter.id
    join public.digital_textbook_nodes node on node.module_id=module.id
    where chapter.version_id=(select id from public.digital_textbook_versions order by version_number desc limit 1)
      and chapter.chapter_number=0;
    insert into public.chapter_practice_units(
      id,student_app_id,course_chapter_id,version,status,title,completion_rule,source_snapshot,published_at
    ) values('${ids.practiceUnit}','${APP_ID}','${ids.chapter}',1,'draft','第1章巩固验收',
      '{"requiredBlockCount":1}'::jsonb,'{}'::jsonb,null);
    insert into public.chapter_practice_blocks(
      id,practice_unit_id,block_type,title,instructions,content_payload,sort_order,is_required,status
    ) values('${ids.practiceBlock}','${ids.practiceUnit}','vocabulary','词汇复习',
      '阅读例句后标记完成。','{"example":"안녕하세요 — 你好"}'::jsonb,1,true,'published');
    update public.chapter_practice_units set status='published',published_at=now()
      where id='${ids.practiceUnit}';
    insert into public.growth_toolbox_exercises(
      id,slug,skill,title,description,instructions,source,course_id,course_chapter_id,
      chapter_test_id,content_payload,status,sort_order,created_by,student_app_id
    ) values('${ids.exercise}','p12-vocabulary-${ids.exercise.slice(0,8)}','vocabulary','词汇专项验收',
      '针对本章薄弱词汇进行训练。','选择正确含义。','platform','${COURSE_ID}','${ids.chapter}',
      '${ids.chapterTest}','{}'::jsonb,'published',1,'${owner.id}','${APP_ID}');
    insert into public.growth_toolbox_questions(
      id,exercise_id,primary_skill,question_type,prompt,content_payload,max_score,sort_order
    ) values('${ids.exerciseQuestion}','${ids.exercise}','vocabulary','single_choice','안녕하세요 的意思是？',
      '{"options":[{"value":"hello","label":"你好"},{"value":"bye","label":"再见"}]}'::jsonb,1,1);

    insert into public.learning_assignments(
      id,tenant_id,student_app_id,title,description,assignment_type,course_id,target_scope,
      total_points,starts_at,due_at,status,published_at,created_by,updated_by
    ) values('${ids.homework}','${ids.tenant}','${APP_ID}','作业深链验收','填写一句韩语问候。','homework',
      '${COURSE_ID}','all_students',10,now()-interval '1 hour',now()+interval '1 day','published',now(),'${owner.id}','${owner.id}');
    insert into public.learning_assignment_questions(
      id,tenant_id,assignment_id,question_type,prompt,points,sort_order,language_skill,auto_graded
    ) values('${ids.assignmentQuestion}','${ids.tenant}','${ids.homework}','long_text','请写一句韩语问候。',10,1,'writing',false);
    insert into public.learning_assignments(
      id,tenant_id,student_app_id,title,description,assignment_type,course_id,target_scope,
      total_points,starts_at,due_at,status,published_at,created_by,updated_by,source_paper_id,
      source_paper_code,source_paper_version,max_attempts
    ) values('${ids.exam}','${ids.tenant}','${APP_ID}','期中考试','首次考试与补考共用正式试卷。','exam',
      '${COURSE_ID}','all_students',100,now()-interval '2 day',now()-interval '1 day','published',now()-interval '2 day',
      '${owner.id}','${owner.id}','${MIDTERM_PAPER_ID}','EX-K1-MID-V1',1,1);
    insert into public.learning_assignment_questions(
      tenant_id,assignment_id,question_type,prompt,options,points,sort_order,language_skill,auto_graded
    ) values('${ids.tenant}','${ids.exam}','single_choice','补考验收题','["答案A","答案B"]'::jsonb,100,1,'grammar',true);
    insert into public.learning_assignments(
      id,tenant_id,student_app_id,title,description,assignment_type,course_id,target_scope,total_points,
      starts_at,due_at,status,created_by,updated_by,source_paper_id,source_paper_code,source_paper_version
    ) values('${ids.draftExam}','${ids.tenant}','${APP_ID}','未布置伪考试','','exam','${COURSE_ID}','all_students',100,
      now(),now()+interval '1 day','draft','${owner.id}','${owner.id}','${MIDTERM_PAPER_ID}','EX-K1-MID-V1',1);
    insert into public.learning_submissions(
      id,tenant_id,assignment_id,student_id,attempt_number,status,score,computed_score,submitted_at,
      graded_at,objective_graded_at,grading_completed_at,grade_released_at,submission_state,request_id,request_payload_hash
    ) values('${ids.initialSubmission}','${ids.tenant}','${ids.exam}','${student.id}',1,'graded',50,50,
      now()-interval '36 hour',now()-interval '35 hour',now()-interval '35 hour',now()-interval '35 hour',
      now()-interval '35 hour','grade_released',gen_random_uuid(),'p12-initial');
    insert into public.student_review_items(
      id,tenant_id,student_id,student_app_id,source_type,source_id,source_question_id,course_id,
      course_chapter_id,skill,content_snapshot,student_answer_snapshot,feedback_snapshot,error_count,status
    ) values('${ids.reviewItem}','${ids.tenant}','${student.id}','${APP_ID}','practice_self_check','${ids.practiceBlock}',
      '${ids.assignmentQuestion}','${COURSE_ID}','${ids.chapter}','writing',
      '{"prompt":"请写一句韩语问候。","sourceTitle":"作业深链验收","sourceVersion":1}'::jsonb,
      '{"answer":"안녕"}'::jsonb,'{"expectedAnswer":"안녕하세요","teacherComment":"请使用礼貌表达。"}'::jsonb,1,'pending');
    commit;
  `);

  const initialEvaluationId = runSql(`
    select set_config('request.jwt.claim.role','service_role',false);
    select public.evaluate_student_course_completion('${student.id}','${COURSE_ID}','${policyId}');
    select id from public.student_course_completion_evaluations
      where student_id='${student.id}' and policy_id='${policyId}' and status<>'superseded'
      order by evaluated_at desc limit 1;
  `).split("\n").at(-1);
  assert.match(initialEvaluationId, /^[0-9a-f-]{36}$/);

  const gaps = [
    { key: "textbook:overview", category: "course", title: "教材总览", status: "in_progress", href: "/dashboard/courses/korean/korean-basic/korean-beginner/basic-pronunciation?chapter=korean-level-one-00", reason: "教材总览尚未完成。" },
    { key: "homework", category: "assignment", title: "作业深链验收", status: "missing", sourceId: ids.homework, href: `/dashboard/assignments/${ids.homework}`, reason: "对应作业尚未提交。" },
    { key: "chapter-practice", category: "chapter_practice", title: "第1章巩固验收", status: "in_progress", href: `/dashboard/practice/course/korean-beginner/${chapterSlug}`, reason: "章节能力需要巩固。" },
    { key: "specialized", category: "specialized_practice", title: "词汇专项验收", status: "in_progress", href: `/dashboard/training/vocabulary/korean-beginner/basic-pronunciation/${chapterSlug}`, reason: "词汇专项能力需要加强。" },
    { key: "review", category: "review", title: "错题复习验收", status: "in_progress", sourceId: ids.reviewItem, href: "/dashboard/practice/review", reason: "存在一条待复习错题。" },
    { key: "midterm-exam", category: "midterm_exam", title: "期中考试", status: "failed", sourceId: ids.exam, currentValue: 50, requiredValue: 60, reason: "期中考试成绩为50分，政策要求60分。" },
  ];
  runSql(`update public.student_course_completion_evaluations set missing_requirements='${sqlLiteral(JSON.stringify(gaps))}'::jsonb where id='${initialEvaluationId}'::uuid; select pg_notify('pgrst','reload schema');`);

  ensureLocalReadGrants();
  const studentApi = await signIn(student);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  for (const [table, columns] of [
    ["courses", "id"], ["lessons", "id"], ["course_chapters", "id"],
    ["growth_toolbox_exercises", "id"], ["chapter_test_attempts", "id"],
    ["toolbox_practice_sessions", "id"], ["lesson_progress", "id"], ["chapter_tests", "id"],
  ]) {
    const result = await studentApi.from(table).select(columns).limit(1);
    failOn(result.error, `学生读取${table}`);
  }

  if (!process.env.COMPLETION_RETAKE_APP_URL) {
    server = spawn("npm", ["run", "dev", "--", "--port", String(APP_PORT)], {
      cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NEXT_DIST_DIR: `.next-packet12-e2e-${APP_PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      },
    });
    server.stdout.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-30_000); });
    server.stderr.on("data", (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-30_000); });
  }
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const studentPage = await studentContext.newPage();
  await login(studentPage, student);
  const completionUrl = `${APP_URL}/${tenantSlug}/apps/korean/grades/completion`;
  const deepLinkCases = [
    ["教材总览", `/${tenantSlug}/apps/korean/courses/korean/korean-basic/korean-beginner/basic-pronunciation?chapter=korean-level-one-00`, /第 00 章|课程总览/],
    ["作业深链验收", `/${tenantSlug}/apps/korean/assignments/${ids.homework}`, /请写一句韩语问候/],
    ["第1章巩固验收", `/${tenantSlug}/apps/korean/practice/course/korean-beginner/${chapterSlug}`, /标记本块已复习/],
    ["词汇专项验收", `/${tenantSlug}/apps/korean/training/vocabulary/korean-beginner/basic-pronunciation/${chapterSlug}`, /안녕하세요 的意思是/],
    ["错题复习验收", `/${tenantSlug}/apps/korean/practice/review`, /标记为重新掌握/],
  ];
  const deepLinkEvidence = [];
  for (const [title, targetHref, expected] of deepLinkCases) {
    if (title === "第1章教材") {
      runSql(`update public.digital_textbook_chapters set status='published',production_status='published'
        where version_id=(select id from public.digital_textbook_versions order by version_number desc limit 1)
          and chapter_number=1;`);
    }
    ensureLocalReadGrants();
    await gotoWithRetry(studentPage, completionUrl);
    await studentPage.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    if (await studentPage.getByRole("heading", { name: "还有结课要求需要完成" }).count() === 0) {
      throw new Error(`资格页未加载：${studentPage.url()}\n${(await studentPage.locator("body").innerText()).slice(0, 3000)}\n${serverOutput.slice(-5000)}`);
    }
    const link = studentPage.locator(`a[href="${targetHref}"]`).filter({ hasText: "去完成" });
    assert.equal(await link.count(), 1, `${title} 的去完成链接数量不正确`);
    const href = await link.getAttribute("href");
    assert.ok(href);
    await link.click();
    const clickedNavigation = await studentPage
      .waitForURL((url) => `${url.pathname}${url.search}` === targetHref, { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (!clickedNavigation) await gotoWithRetry(studentPage, `${APP_URL}${targetHref}`);
    await studentPage.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
    const focusDismiss = studentPage.getByRole("button", { name: "暂不进入", exact: true });
    if (await focusDismiss.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false)) await focusDismiss.click();
    try {
      await studentPage.getByText(expected).first().waitFor({ timeout: 30_000 });
    } catch {
      throw new Error(`深链页面未进入可操作状态：${title} ${studentPage.url()}\n${(await studentPage.locator("body").innerText()).slice(0, 3000)}\n${serverOutput.slice(-5000)}`);
    }
    const body = await studentPage.locator("body").innerText();
    assert.doesNotMatch(body, /404|This page could not be found/);
    assert.match(body, expected);
    deepLinkEvidence.push({ title, href, landedAt: new URL(studentPage.url()).pathname });
  }
  await studentPage.screenshot({ path: `${evidenceDir}/01-five-deep-links-last-page.png`, fullPage: true });
  console.log(`PASS 深链：${JSON.stringify(deepLinkEvidence)}`);

  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, teacher);
  ensureLocalReadGrants();
  await gotoWithRetry(teacherPage, `${APP_URL}/${tenantSlug}/dashboard/admin/apps/korean/completion-review`);
  await teacherPage.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  if (await teacherPage.getByRole("heading", { name: "结课资格", exact: true }).count() === 0) {
    throw new Error(`教师资格页未加载：${teacherPage.url()}\n${(await teacherPage.locator("body").innerText()).slice(0, 3000)}\n${serverOutput.slice(-5000)}`);
  }
  await teacherPage.getByText("补考验收学生", { exact: true }).waitFor();
  await teacherPage.getByRole("button", { name: "发起补考", exact: true }).click();
  const retakePaperSelect = teacherPage.getByLabel("补考卷", { exact: true });
  await retakePaperSelect.waitFor();
  assert.equal(await retakePaperSelect.inputValue(), MIDTERM_PAPER_ID);
  await teacherPage.getByRole("button", { name: "确认发起补考", exact: true }).click();
  await teacherPage.getByText("补考已发起", { exact: false }).waitFor({ timeout: 20_000 });
  const retakeConfigured = lastJson(runSql(`select jsonb_build_object(
    'paper',retake_paper_id,'starts',retake_starts_at,'due',retake_due_at,'policy',retake_score_policy,
    'studentAssigned',exists(select 1 from public.learning_assignment_retake_students r where r.assignment_id=a.id and r.student_id='${student.id}')
  ) from public.learning_assignments a where id='${ids.exam}';`));
  assert.equal(retakeConfigured.paper, MIDTERM_PAPER_ID);
  assert.equal(retakeConfigured.policy, "highest");
  assert.equal(retakeConfigured.studentAssigned, true);
  await teacherPage.screenshot({ path: `${evidenceDir}/02-teacher-retake-success.png`, fullPage: true });
  console.log(`PASS 教师补考：${JSON.stringify(retakeConfigured)}`);

  runSql(`update public.learning_assignments set retake_starts_at=now()-interval '5 minute',retake_due_at=now()+interval '1 day' where id='${ids.exam}';`);
  ensureLocalReadGrants();
  await gotoWithRetry(studentPage, `${APP_URL}/${tenantSlug}/apps/korean`);
  await studentPage.getByText("期中考试补考", { exact: true }).first().waitFor({ timeout: 30_000 });
  assert.equal(await studentPage.getByText("未布置伪考试", { exact: true }).count(), 0);
  const retakeArticle = studentPage.locator("article").filter({ hasText: "期中考试补考" }).first();
  const retakeHref = await retakeArticle.getByRole("link", { name: "进入考试" }).getAttribute("href");
  assert.ok(retakeHref, "补考任务缺少真实详情链接");
  await gotoWithRetry(studentPage, new URL(retakeHref, APP_URL).toString());
  await studentPage.getByText("当前为老师布置的补考", { exact: false }).waitFor();
  console.log("PASS 今日学习：真实补考任务出现，草稿考试未出现，详情使用补考窗口");

  runSql(`insert into public.learning_submissions(
    id,tenant_id,assignment_id,student_id,attempt_number,status,submitted_at,
    submission_state,objective_graded_at,request_id,request_payload_hash
  ) values('${ids.retakeSubmission}','${ids.tenant}','${ids.exam}','${student.id}',2,'submitted',now(),
    'objective_graded_pending_manual',now(),gen_random_uuid(),'p12-retake-pending');`);
  ensureLocalReadGrants();
  await gotoWithRetry(studentPage, `${APP_URL}/${tenantSlug}/apps/korean`);
  const pendingStatus = studentPage.getByText(/等待批改|无需重复提交/).first();
  await pendingStatus.waitFor();
  assert.match(await pendingStatus.innerText(), /等待批改|无需重复提交/);
  await studentPage.screenshot({ path: `${evidenceDir}/03-pending-grading-status-only.png`, fullPage: true });
  console.log("PASS 等待批改：仅显示状态，无重复提交链接");

  runSql(`begin; set local session_replication_role=replica; update public.learning_submissions set
    computed_score=85,objective_graded_at=now(),grading_completed_at=now(),submission_state='grading_completed'
    where id='${ids.retakeSubmission}'; set local session_replication_role=origin; commit;`);
  const teacherApi = await signIn(teacher);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const released = await teacherApi.rpc("release_learning_submission_grade", { p_submission_id: ids.retakeSubmission });
  failOn(released.error, "发布补考成绩");
  const refreshed = lastJson(runSql(`select jsonb_build_object(
    'evaluationId',id,'oldSuperseded',(select status='superseded' from public.student_course_completion_evaluations where id='${initialEvaluationId}'),
    'selectedScore',evidence_snapshot#>'{midtermExam,score}',
    'retakeScore',evidence_snapshot#>'{midtermExam,retake,retakeScore}',
    'retakeReleased',evidence_snapshot#>'{midtermExam,retake,retakeGradeReleased}',
    'releasedSubmissionId',evidence_snapshot#>'{midtermExam,releasedSubmissionId}'
  ) from public.student_course_completion_evaluations where student_id='${student.id}' and policy_id='${policyId}' and status<>'superseded' order by evaluated_at desc limit 1;`));
  assert.notEqual(refreshed.evaluationId, initialEvaluationId);
  assert.equal(refreshed.oldSuperseded, true);
  assert.equal(Number(refreshed.selectedScore), 85);
  assert.equal(Number(refreshed.retakeScore), 85);
  assert.equal(refreshed.retakeReleased, true);
  assert.equal(refreshed.releasedSubmissionId, ids.retakeSubmission);
  console.log(`PASS 补考成绩刷新：${JSON.stringify(refreshed)}`);
  await teacherContext.close();
  await studentContext.close();
  console.log(`EVIDENCE ${evidenceDir}`);
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (server?.pid) {
    try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
  try {
    runSql(`
      begin; set local session_replication_role=replica;
      delete from public.growth_toolbox_questions where id='${ids.exerciseQuestion}';
      delete from public.growth_toolbox_exercises where id='${ids.exercise}';
      delete from public.chapter_practice_blocks where id='${ids.practiceBlock}';
      delete from public.chapter_practice_units where id='${ids.practiceUnit}';
      do $$ declare tenant_table record; begin
        for tenant_table in select distinct c.table_name from information_schema.columns c
          join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
          where c.table_schema='public' and c.column_name='tenant_id' and t.table_type='BASE TABLE'
        loop execute format('delete from public.%I where tenant_id=$1',tenant_table.table_name) using '${ids.tenant}'::uuid; end loop;
      end $$;
      delete from public.course_chapters where id='${ids.chapter}';
      delete from public.course_tests where id='${ids.chapterTest}';
      update public.digital_textbook_chapters set status='draft',production_status='editorial_review'
        where version_id=(select id from public.digital_textbook_versions order by version_number desc limit 1)
          and chapter_number=1;
      delete from public.course_completion_refresh_tasks where policy_id='${ids.policy}';
      delete from public.course_completion_policies where id='${ids.policy}';
      delete from public.tenants where id='${ids.tenant}';
      set local session_replication_role=origin; commit;
    `);
  } catch (error) { console.error(`WARN 测试数据清理失败：${error.message}`); }
  for (const userId of users.reverse()) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  if (originallyMissingRead.length) {
    runSql(`revoke select on ${originallyMissingRead.map((table) => `public.${table}`).join(",")} from authenticated;`);
  }
  if (serviceRoleCourseChapterReadMissing) {
    runSql("revoke select on public.course_chapters from service_role;");
  }
}
