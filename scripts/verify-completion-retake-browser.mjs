#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.RETAKE_APP_URL ?? "http://127.0.0.1:3000";
const DB = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const SUPABASE_URL = "http://127.0.0.1:54321";
const APP_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_ID = "a3100000-0000-4000-8000-000000000002";
const ORIGINAL_PAPER_ID = "d723089f-00d5-44b8-b6c9-002d710679e2";
const evidenceDir = "artifacts/round5-packet12b";
const password = `Retake-${crypto.randomUUID()}-Aa1!`;
const slug = `retake-e2e-${Date.now()}`;
const ids = Object.fromEntries(
  [
    "tenant", "paper", "paperQ1", "paperQ2", "assignment", "assignmentQ",
    "sameAssignment", "sameAssignmentQ1", "sameAssignmentQ2",
    "policy", "evaluation", "initialSubmission",
  ]
    .map((key) => [key, crypto.randomUUID()]),
);
const users = [];
let browser;

function sql(value) { return String(value).replaceAll("'", "''"); }
function runSql(statement) {
  return execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input: statement, encoding: "utf8" }).trim();
}
function lastJson(output) {
  const line = output.split("\n").findLast((candidate) => candidate.trimStart().startsWith("{"));
  assert.ok(line, `SQL 未返回 JSON：${output}`);
  return JSON.parse(line);
}

const kong = execFileSync("docker", ["exec", KONG, "cat", "/home/kong/kong.yml"], { encoding: "utf8" });
const keys = [...new Set(kong.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const keyFor = (role) => keys.find((key) => {
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === role; }
  catch { return false; }
});
const anonKey = keyFor("anon");
const serviceKey = keyFor("service_role");
assert.ok(anonKey && serviceKey, "无法读取本地 Supabase keys");
const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const baselineReadTables = ["profiles", "courses", "lessons"];
const originallyMissingRead = baselineReadTables.filter((table) =>
  runSql(`select has_table_privilege('authenticated','public.${table}','select');`) !== "t",
);

async function createUser(label, role) {
  const email = `${slug}-${role}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: label } });
  if (error || !data.user) throw error ?? new Error(`创建${label}失败`);
  users.push(data.user.id);
  runSql(`update public.profiles set full_name='${sql(label)}', role='${role}', global_role='member', status='active' where id='${data.user.id}'::uuid;`);
  return { id: data.user.id, email, label };
}

async function login(page, account) {
  runSql("grant select on public.profiles, public.courses, public.lessons to authenticated;");
  const failures = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" }).catch(async () => {
      await page.waitForTimeout(500);
      await page.goto(`${APP_URL}/login`, { waitUntil: "domcontentloaded" });
    });
    await page.getByLabel("登录账号").waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps")));
    }, { timeout: 30_000 });
    await page.getByLabel("登录账号").fill(account.email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "进入学习中心" }).click();
    await page.waitForTimeout(750);
    const leftLogin = await page.waitForURL(
      (url) => !url.pathname.startsWith("/login"),
      { timeout: 10_000 },
    ).then(() => true).catch(() => false);
    if (leftLogin) break;
    failures.push(`${page.url()}\n${(await page.locator("body").innerText()).slice(-1200)}`);
  }
  assert.ok(
    !new URL(page.url()).pathname.startsWith("/login"),
    `${account.label}浏览器登录失败\n${failures.join("\n--- retry ---\n")}`,
  );
  const dismiss = page.getByRole("button", { name: "暂不进入", exact: true });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(500);
}

async function apiFor(account) {
  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  if (error) throw error;
  return client;
}

async function waitForApp() {
  for (let index = 0; index < 40; index += 1) {
    const response = await fetch(`${APP_URL}/login`).catch(() => null);
    if (response?.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js 服务未就绪");
}

async function waitForHydration(page) {
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some(
    (button) => Object.keys(button).some((key) => key.startsWith("__reactProps")),
  ), undefined, { timeout: 30_000 });
}

try {
  await mkdir(evidenceDir, { recursive: true });
  await waitForApp();
  runSql("grant select on public.profiles, public.courses, public.lessons to authenticated;");
  const [teacher, student] = await Promise.all([
    createUser("补考验收老师", "teacher"),
    createUser("补考验收学生", "student"),
  ]);
  const sourceTestId = runSql(`select source_test_id from public.assessment_papers where id='${ORIGINAL_PAPER_ID}'::uuid;`);
  assert.match(sourceTestId, /^[0-9a-f-]{36}$/);

  runSql(`
    begin;
    insert into public.tenants (id,slug,name,status,created_by) values ('${ids.tenant}','${slug}','补考浏览器验收机构','active','${teacher.id}');
    update public.tenant_student_apps set is_enabled=true,status='active' where tenant_id='${ids.tenant}' and app_id='${APP_ID}';
    set local session_replication_role=replica;
    insert into public.tenant_memberships (tenant_id,user_id,role,status,membership_tier,is_default,joined_at) values
      ('${ids.tenant}','${teacher.id}','teacher','active','vip3',true,now()),
      ('${ids.tenant}','${student.id}','student','active','vip2',true,now());
    insert into public.staff_app_assignments (tenant_id,staff_id,app_id,access_role,can_manage_students,can_manage_content,can_manage_assessments,can_view_analytics,status,assigned_by)
      values ('${ids.tenant}','${teacher.id}','${APP_ID}','teacher',true,true,true,true,'active','${teacher.id}');
    insert into public.student_app_enrollments (tenant_id,student_id,app_id,status,access_tier,starts_at,enrolled_by)
      values ('${ids.tenant}','${student.id}','${APP_ID}','active','vip2',now()-interval '1 day','${teacher.id}');
    insert into public.tenant_student_assignments (tenant_id,student_id,teacher_id,assigned_by,student_app_id)
      values ('${ids.tenant}','${student.id}','${teacher.id}','${teacher.id}','${APP_ID}');

    insert into public.assessment_papers (id,paper_code,paper_type,title,description,source_test_id,student_app_id,duration_minutes,passing_score,allow_resubmission,total_points,question_count,version,status,published_at,created_by,updated_by)
      values ('${ids.paper}','EX-RETAKE-${ids.paper.slice(0,8).toUpperCase()}','exam','Packet12b 换卷验收卷','仅用于隔离浏览器验收','${sourceTestId}','${APP_ID}',30,60,false,100,2,1,'published',now(),'${teacher.id}','${teacher.id}');
    insert into public.assessment_paper_questions (id,paper_id,source_bank_question_id,source_bank_version,question_type,stimulus_text,prompt,options,points,sort_order,difficulty,skill) values
      ('${ids.paperQ1}','${ids.paper}',null,1,'single_choice','Packet12b 专属材料：서울의 오늘 날씨','Packet12b 新卷题目一：请选择验收答案。','["验收正确项","干扰项"]'::jsonb,60,0,'foundation','vocabulary'),
      ('${ids.paperQ2}','${ids.paper}',null,1,'long_text','Packet12b 专属写作材料','Packet12b 新卷题目二：请写一句验收说明。','[]'::jsonb,40,1,'foundation','writing');
    insert into public.assessment_paper_question_keys (question_id,correct_answer,explanation) values
      ('${ids.paperQ1}','验收正确项','Packet12b 新卷答案解析'),
      ('${ids.paperQ2}',null,'由老师人工批改');

    insert into public.learning_assignments (id,tenant_id,student_app_id,title,description,assignment_type,course_id,target_scope,total_points,starts_at,due_at,duration_minutes,max_attempts,allow_resubmission,status,published_at,created_by,updated_by,source_paper_id,source_paper_code,source_paper_version)
      values ('${ids.assignment}','${ids.tenant}','${APP_ID}','Packet12b 原期末考试','原始考试任务','exam','${COURSE_ID}','selected_students',100,now()-interval '3 days',now()-interval '2 days',30,1,false,'published',now()-interval '3 days','${teacher.id}','${teacher.id}','${ORIGINAL_PAPER_ID}','EX-K1-FIN-V1',1);
    insert into public.learning_assignment_targets (tenant_id,assignment_id,student_id) values ('${ids.tenant}','${ids.assignment}','${student.id}');
    insert into public.learning_assignment_questions (id,tenant_id,assignment_id,delivery_paper_id,question_type,language_skill,stimulus_text,prompt,options,points,sort_order,auto_graded)
      values ('${ids.assignmentQ}','${ids.tenant}','${ids.assignment}','${ORIGINAL_PAPER_ID}','single_choice','vocabulary','原卷材料','原卷题目（补考时不得出现）','["错误","正确"]'::jsonb,100,0,true);
    insert into public.learning_assignment_question_keys (tenant_id,question_id,correct_answer,explanation,updated_by)
      values ('${ids.tenant}','${ids.assignmentQ}','正确','原卷解析','${teacher.id}');
    insert into public.learning_assignments (id,tenant_id,student_app_id,title,description,assignment_type,course_id,target_scope,total_points,starts_at,due_at,duration_minutes,max_attempts,allow_resubmission,status,published_at,created_by,updated_by,source_paper_id,source_paper_code,source_paper_version)
      values ('${ids.sameAssignment}','${ids.tenant}','${APP_ID}','Packet12b 同卷补考测试','同一学生、相同母卷验证','exam','${COURSE_ID}','selected_students',100,now()-interval '3 days',now()-interval '2 days',30,1,false,'published',now()-interval '3 days','${teacher.id}','${teacher.id}','${ids.paper}','EX-RETAKE-${ids.paper.slice(0,8).toUpperCase()}',1);
    insert into public.learning_assignment_targets (tenant_id,assignment_id,student_id)
      values ('${ids.tenant}','${ids.sameAssignment}','${student.id}');
    insert into public.learning_assignment_questions (id,tenant_id,assignment_id,delivery_paper_id,source_paper_question_id,question_type,language_skill,stimulus_text,prompt,options,points,sort_order,auto_graded) values
      ('${ids.sameAssignmentQ1}','${ids.tenant}','${ids.sameAssignment}','${ids.paper}','${ids.paperQ1}','single_choice','vocabulary','Packet12b 专属材料：서울의 오늘 날씨','Packet12b 新卷题目一：请选择验收答案。','["验收正确项","干扰项"]'::jsonb,60,0,true),
      ('${ids.sameAssignmentQ2}','${ids.tenant}','${ids.sameAssignment}','${ids.paper}','${ids.paperQ2}','long_text','writing','Packet12b 专属写作材料','Packet12b 新卷题目二：请写一句验收说明。','[]'::jsonb,40,1,false);
    insert into public.learning_assignment_question_keys (tenant_id,question_id,correct_answer,explanation,updated_by) values
      ('${ids.tenant}','${ids.sameAssignmentQ1}','验收正确项','Packet12b 新卷答案解析','${teacher.id}'),
      ('${ids.tenant}','${ids.sameAssignmentQ2}',null,'由老师人工批改','${teacher.id}');
    insert into public.learning_submissions (id,tenant_id,assignment_id,student_id,attempt_number,status,score,computed_score,overall_feedback,submitted_at,graded_at,submission_state,objective_graded_at,grading_completed_at,grade_released_at,request_id,request_payload_hash)
      values ('${ids.initialSubmission}','${ids.tenant}','${ids.assignment}','${student.id}',1,'graded',20,20,'首次未通过',now()-interval '2 days',now()-interval '2 days','grade_released',now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',gen_random_uuid(),'initial-failed');
    insert into public.learning_submission_answers (tenant_id,submission_id,question_id,answer_text,awarded_points)
      values ('${ids.tenant}','${ids.initialSubmission}','${ids.assignmentQ}','错误',20);

    insert into public.course_completion_policies (id,student_app_id,course_id,policy_code,version,title,status,is_default,effective_from,requirements,created_by,published_by,published_at)
      values ('${ids.policy}','${APP_ID}','${COURSE_ID}','PACKET12B-${ids.policy.slice(0,8).toUpperCase()}',1,'Packet12b 验收政策','published',true,now()-interval '1 day','{"textbook":{"required_chapter_count":16,"require_all_mandatory_chapters":true},"required_assignments":{"require_all_assigned":true,"require_submitted":true,"require_graded":true},"formal_chapter_exams":{"minimum_completed_count":16,"minimum_passed_count":16,"passing_score":60},"stage_exams":{"required_count":4,"require_published_grades":true},"midterm_exam":{"require_published_grade":true,"passing_score":60},"final_exam":{"require_published_grade":true,"passing_score":60},"subjective_grading":{"require_all_certification_items_graded":true},"overall_score":{"minimum_score":60},"blocking_gaps":{"maximum_allowed_count":0}}'::jsonb,'${teacher.id}','${teacher.id}',now());
    insert into public.student_course_completion_evaluations (id,tenant_id,student_id,student_app_id,course_id,policy_id,policy_version,status,eligible,overall_score,requirements_snapshot,evidence_snapshot,missing_requirements,evaluated_at,evaluation_version,evaluation_fingerprint)
      values ('${ids.evaluation}','${ids.tenant}','${student.id}','${APP_ID}','${COURSE_ID}','${ids.policy}',1,'not_eligible',false,20,'{}'::jsonb,'{}'::jsonb,jsonb_build_array(
        jsonb_build_object('key','final-exam','category','final_exam','title','Packet12b 原期末考试','status','failed','reason','首次成绩20分，老师可发起补考。','sourceId','${ids.assignment}','currentValue',20,'requiredValue',60),
        jsonb_build_object('key','same-paper-exam','category','stage_exam','title','Packet12b 同卷补考测试','status','failed','reason','用于验证同卷补考。','sourceId','${ids.sameAssignment}','currentValue',20,'requiredValue',60)
      ),now(),'packet12b-e2e',md5('${ids.evaluation}'));
    set local session_replication_role=origin;
    commit;
    select pg_notify('pgrst','reload schema');
  `);

  await new Promise((resolve) => setTimeout(resolve, 2_000));
  browser = await chromium.launch({ headless: true });
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const teacherPage = await teacherContext.newPage();
  await login(teacherPage, teacher);
  await teacherPage.goto(`${APP_URL}/${slug}/dashboard/admin/apps/korean/completion-review`);
  await waitForHydration(teacherPage);
  await teacherPage.screenshot({ path: `${evidenceDir}/debug-completion-review.png`, fullPage: true });
  if (await teacherPage.getByRole("tab", { name: /未达标/ }).count() === 0) {
    throw new Error(`资格明细页缺少未达标标签：${teacherPage.url()}\n${(await teacherPage.locator("body").innerText()).slice(0, 2000)}`);
  }
  await teacherPage.getByRole("tab", { name: /未达标/ }).click();
  await teacherPage.getByRole("button", { name: "发起补考" }).first().click();
  await teacherPage.getByLabel("补考卷").selectOption(ids.paper);
  const start = new Date(Date.now() + 9 * 60 * 60_000 + 2 * 60_000).toISOString().slice(0, 16);
  const due = new Date(Date.now() + 9 * 60 * 60_000 + 26 * 60 * 60_000).toISOString().slice(0, 16);
  await teacherPage.getByLabel("补考开始时间").fill(start);
  await teacherPage.getByLabel("补考截止时间").fill(due);
  await teacherPage.screenshot({ path: `${evidenceDir}/01-teacher-retake-delivery.png`, fullPage: true });
  await teacherPage.getByRole("button", { name: "确认发起补考" }).click();
  let configuredRetakePaperId = "";
  for (let attempt = 0; attempt < 30; attempt += 1) {
    configuredRetakePaperId = runSql(`select coalesce(retake_paper_id::text,'') from public.learning_assignments where id='${ids.assignment}'::uuid;`);
    if (configuredRetakePaperId) break;
    await teacherPage.waitForTimeout(500);
  }
  if (configuredRetakePaperId !== ids.paper) {
    const retakeFeedbackText = await teacherPage.locator('[role="status"], [role="alert"]').last().innerText().catch(() => "页面没有返回操作反馈");
    await teacherPage.screenshot({ path: `${evidenceDir}/error-teacher-retake-delivery.png`, fullPage: true });
    throw new Error(`教师发起补考失败：${retakeFeedbackText}\n${(await teacherPage.locator("body").innerText()).slice(-2500)}`);
  }

  const teacherApi = await apiFor(teacher);
  const sameStartsAt = new Date(Date.now() + 2 * 60_000).toISOString();
  const sameDueAt = new Date(Date.now() + 26 * 60 * 60_000).toISOString();
  const { error: sameRetakeError } = await teacherApi.rpc(
    "configure_learning_assignment_retake",
    {
      p_evaluation_id: ids.evaluation,
      p_assignment_id: ids.sameAssignment,
      p_retake_paper_id: ids.paper,
      p_retake_starts_at: sameStartsAt,
      p_retake_due_at: sameDueAt,
      p_retake_score_policy: "highest",
      p_retake_original_weight_percent: null,
    },
  );
  if (sameRetakeError) throw sameRetakeError;

  runSql(`update public.learning_assignments set retake_starts_at=now()-interval '1 minute',retake_due_at=now()+interval '1 day' where id in ('${ids.assignment}','${ids.sameAssignment}');`);
  const snapshot = lastJson(runSql(`select jsonb_build_object('motherPaperId','${ids.paper}','motherQuestionIds',(select jsonb_agg(id order by sort_order) from assessment_paper_questions where paper_id='${ids.paper}'),'snapshotQuestionIds',(select jsonb_agg(id order by sort_order) from learning_assignment_questions where assignment_id='${ids.assignment}' and delivery_paper_id='${ids.paper}'),'snapshotMotherQuestionIds',(select jsonb_agg(source_paper_question_id order by sort_order) from learning_assignment_questions where assignment_id='${ids.assignment}' and delivery_paper_id='${ids.paper}'),'prompts',(select jsonb_agg(prompt order by sort_order) from learning_assignment_questions where assignment_id='${ids.assignment}' and delivery_paper_id='${ids.paper}'))`));
  assert.deepEqual(snapshot.snapshotMotherQuestionIds, snapshot.motherQuestionIds);
  assert.equal(snapshot.prompts[0], "Packet12b 新卷题目一：请选择验收答案。");
  await writeFile(`${evidenceDir}/question-id-proof.json`, `${JSON.stringify(snapshot, null, 2)}\n`);

  const studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const studentPage = await studentContext.newPage();
  await login(studentPage, student);
  await studentPage.goto(`${APP_URL}/${slug}/apps/korean/assignments/${ids.assignment}`, { waitUntil: "domcontentloaded" }).catch(async () => {
    await studentPage.waitForTimeout(500);
    await studentPage.goto(`${APP_URL}/${slug}/apps/korean/assignments/${ids.assignment}`, { waitUntil: "domcontentloaded" });
  });
  await studentPage.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await studentPage.waitForTimeout(1_000);
  await waitForHydration(studentPage);
  const dismissFullscreen = studentPage.getByRole("button", { name: "暂不进入", exact: true });
  if (await dismissFullscreen.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false)) await dismissFullscreen.click();
  const startResponses = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await studentPage.getByText("Packet12b 新卷题目一：请选择验收答案。").isVisible().catch(() => false)) break;
    const startButton = studentPage.getByRole("button", { name: /开始考试|继续考试/ });
    await startButton.waitFor({ state: "visible", timeout: 15_000 });
    const responsePromise = studentPage.waitForResponse(
      (response) => response.url().includes(`/api/assignments/${ids.assignment}/start`),
      { timeout: 15_000 },
    ).catch(() => null);
    await startButton.click();
    const response = await responsePromise;
    startResponses.push(response
      ? { status: response.status(), body: await response.text() }
      : { status: 0, body: "hydration/reload swallowed the click" });
    await studentPage.waitForTimeout(1_000);
  }
  await studentPage.getByText("Packet12b 新卷题目一：请选择验收答案。").waitFor({ timeout: 30_000 }).catch(() => undefined);
  await studentPage.screenshot({ path: `${evidenceDir}/debug-after-start.png`, fullPage: true });
  if (await studentPage.getByText("Packet12b 新卷题目一：请选择验收答案。").count() === 0) {
    throw new Error(`开考后未显示补考题：${JSON.stringify(startResponses)}\n${(await studentPage.locator("body").innerText()).slice(0, 2500)}`);
  }
  await studentPage.route("**/api/assignments/*/draft", (route) => route.abort());
  assert.equal(await studentPage.getByText("原卷题目（补考时不得出现）").count(), 0);
  assert.ok(await studentPage.getByText("Packet12b 专属材料：서울의 오늘 날씨").count());
  await studentPage.screenshot({ path: `${evidenceDir}/02-student-new-paper.png`, fullPage: true });
  await studentPage.getByLabel("验收正确项").check();
  await studentPage.getByRole("button").filter({ hasText: "写作" }).last().click();
  await studentPage.getByPlaceholder("在这里填写完整答案").fill("这是通过真实浏览器填写的补考答案。");
  await studentPage.getByRole("button", { name: "提交全部答案" }).click();
  await studentPage.getByRole("button", { name: "确认提交" }).click();
  const submitted = await studentPage.getByText("提交成功").waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!submitted) {
    throw new Error(`补考提交未成功：${(await studentPage.locator("body").innerText()).slice(-2500)}`);
  }
  await studentPage.screenshot({ path: `${evidenceDir}/03-student-submitted.png`, fullPage: true });

  await studentPage.goto(`${APP_URL}/${slug}/apps/korean/assignments/${ids.sameAssignment}`, { waitUntil: "domcontentloaded" });
  await waitForHydration(studentPage);
  const sameStartButton = studentPage.getByRole("button", { name: /开始考试|继续考试/ });
  if (await sameStartButton.isVisible().catch(() => false)) await sameStartButton.click();
  await studentPage.getByText("Packet12b 新卷题目一：请选择验收答案。").waitFor({ timeout: 30_000 });
  assert.ok(await studentPage.getByLabel("验收正确项").count());
  assert.equal(await studentPage.getByText("原卷题目（补考时不得出现）").count(), 0);
  await studentPage.getByLabel("验收正确项").check();
  await studentPage.getByRole("button").filter({ hasText: "写作" }).last().click();
  await studentPage.getByPlaceholder("在这里填写完整答案").fill("这是同卷场景的真实浏览器答案。");
  await studentPage.screenshot({ path: `${evidenceDir}/05-student-same-paper.png`, fullPage: true });
  await studentPage.getByRole("button", { name: "提交全部答案" }).click();
  await studentPage.getByRole("button", { name: "确认提交" }).click();
  await studentPage.getByText("提交成功").waitFor({ timeout: 30_000 });
  const samePaperProof = lastJson(runSql(`select jsonb_build_object(
    'deliveryPaperId','${ids.paper}',
    'motherQuestionIds',(select jsonb_agg(id order by sort_order) from public.assessment_paper_questions where paper_id='${ids.paper}'),
    'snapshotMotherQuestionIds',(select jsonb_agg(source_paper_question_id order by sort_order) from public.learning_assignment_questions where assignment_id='${ids.sameAssignment}' and delivery_paper_id='${ids.paper}'),
    'answerQuestionIds',(select jsonb_agg(answer.question_id order by question.sort_order) from public.learning_submissions submission join public.learning_submission_answers answer on answer.submission_id=submission.id join public.learning_assignment_questions question on question.id=answer.question_id where submission.assignment_id='${ids.sameAssignment}' and submission.student_id='${student.id}'),
    'answers',(select jsonb_agg(jsonb_build_object('answer',answer.answer_text,'awardedPoints',answer.awarded_points,'expected',key.correct_answer) order by question.sort_order) from public.learning_submissions submission join public.learning_submission_answers answer on answer.submission_id=submission.id join public.learning_assignment_questions question on question.id=answer.question_id left join public.learning_assignment_question_keys key on key.question_id=question.id where submission.assignment_id='${ids.sameAssignment}' and submission.student_id='${student.id}'),
    'computedScore',(select computed_score from public.learning_submissions where assignment_id='${ids.sameAssignment}' and student_id='${student.id}' order by attempt_number desc limit 1)
  )`));
  await writeFile(`${evidenceDir}/same-paper-proof.json`, `${JSON.stringify(samePaperProof, null, 2)}\n`);
  assert.deepEqual(samePaperProof.snapshotMotherQuestionIds, samePaperProof.motherQuestionIds);
  assert.deepEqual(samePaperProof.answerQuestionIds, [ids.sameAssignmentQ1, ids.sameAssignmentQ2]);
  assert.equal(Number(samePaperProof.answers[0].awardedPoints), 60);
  assert.equal(samePaperProof.answers[0].answer, samePaperProof.answers[0].expected);

  await teacherPage.goto(`${APP_URL}/${slug}/dashboard/admin/apps/korean/assignments/${ids.assignment}`);
  await waitForHydration(teacherPage);
  await teacherPage.getByText("这是通过真实浏览器填写的补考答案。").waitFor();
  const retakeSubmissionArticle = teacherPage
    .locator('article[id^="submission-"]')
    .filter({ hasText: "这是通过真实浏览器填写的补考答案。" });
  assert.equal(await retakeSubmissionArticle.count(), 1, "浏览器补考答案应当只属于一份提交");
  const gradingForm = retakeSubmissionArticle.locator('form:has(button[name="decision"])');
  assert.equal(await gradingForm.count(), 1, "补考提交应当只对应一个批改表单");
  const rubricScores = gradingForm.locator('input[type="number"]:visible');
  for (let index = 0; index < await rubricScores.count(); index += 1) {
    const input = rubricScores.nth(index);
    await input.fill((await input.getAttribute("max")) ?? "0");
  }
  await gradingForm.getByPlaceholder("总结完成情况；退回重做时必须写明原因。").fill("Packet12b 浏览器批改通过");
  await gradingForm.getByRole("button", { name: "完成并保存批改" }).click();
  await retakeSubmissionArticle.getByText(/批改已经保存/).waitFor({ timeout: 30_000 });
  await retakeSubmissionArticle.getByRole("button", { name: "确认发布成绩" }).click();
  await retakeSubmissionArticle.getByText(/成绩已经发布，批改内容已锁定/).waitFor({ timeout: 30_000 });
  await teacherPage.screenshot({ path: `${evidenceDir}/04-teacher-grade-released.png`, fullPage: true });

  let refreshed;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    refreshed = lastJson(runSql(`select jsonb_build_object('initialEvaluationId','${ids.evaluation}','latestEvaluationId',id,'status',status,'evaluatedAt',evaluated_at) from student_course_completion_evaluations where tenant_id='${ids.tenant}' and student_id='${student.id}' and status<>'superseded' order by evaluated_at desc limit 1;`));
    if (refreshed.latestEvaluationId !== ids.evaluation) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (refreshed.latestEvaluationId === ids.evaluation) {
    const refreshDiagnostic = runSql(`begin; select row_to_json(result) from private.try_evaluate_student_course_completion('${student.id}'::uuid,'${COURSE_ID}'::uuid,null) as result; rollback;`);
    throw new Error(`成绩发布后资格未生成新快照：${refreshDiagnostic}`);
  }
  await writeFile(`${evidenceDir}/qualification-refresh.json`, `${JSON.stringify(refreshed, null, 2)}\n`);

  const deepLinks = [
    ["教材", "课程学习", `/${slug}/apps/korean/courses/korean/korean-basic/korean-beginner/basic-pronunciation`],
    ["作业", "作业考试", `/${slug}/apps/korean/assignments/${ids.assignment}`],
    ["章节巩固", "巩固中心", `/${slug}/apps/korean/practice/course`],
    ["专项训练", "专项训练", `/${slug}/apps/korean/practice/skills/vocabulary`],
    ["错题复习", "错题复习", `/${slug}/apps/korean/practice/review`],
  ];
  const deepLinkEvidence = [];
  for (const [label, navigationLabel, path] of deepLinks) {
    await studentPage.goto(`${APP_URL}/${slug}/apps/korean`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForHydration(studentPage);
    const navigationLink = studentPage.getByRole("link", { name: navigationLabel, exact: true }).last();
    await navigationLink.click();
    await studentPage.waitForURL((url) => url.pathname !== `/${slug}/apps/korean`, { timeout: 30_000 });
    const response = await studentPage.goto(`${APP_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    assert.equal(response?.status(), 200, `${label}深链不是 200`);
    await studentPage.locator("main, body").first().waitFor();
    await studentPage.waitForFunction(
      () => !(document.body.innerText ?? "").includes("正在打开页面"),
      undefined,
      { timeout: 30_000 },
    );
    const text = (await studentPage.locator("body").innerText()).trim();
    const interactiveCount = await studentPage.locator('a[href], button, input, textarea, select').count();
    await studentPage.screenshot({ path: `${evidenceDir}/deep-link-${deepLinkEvidence.length + 1}-${label}.png`, fullPage: true });
    assert.ok(
      text.length > 30 && interactiveCount > 0 && !/This page could not be found|页面不存在|没有找到这个页面|404 Not Found/i.test(text),
      `${label}不是可操作页面：${JSON.stringify({ text: text.slice(0, 300), interactiveCount })}`,
    );
    deepLinkEvidence.push({ label, clickedFromHome: navigationLabel, path, status: response.status(), title: await studentPage.title(), interactiveCount, bodyTextSample: text.slice(0, 180) });
  }
  await writeFile(`${evidenceDir}/deep-links.json`, `${JSON.stringify(deepLinkEvidence, null, 2)}\n`);
  console.log(JSON.stringify({ status: "PASS", snapshot, refreshed, deepLinks: deepLinkEvidence.map(({ label, status }) => ({ label, status })), evidenceDir }, null, 2));
} finally {
  await browser?.close().catch(() => undefined);
  try {
    runSql(`begin; set local session_replication_role=replica;
      delete from public.course_completion_refresh_task_results where tenant_id='${ids.tenant}'::uuid;
      delete from public.course_completion_refresh_tasks where tenant_id='${ids.tenant}'::uuid or policy_id='${ids.policy}'::uuid;
      delete from public.course_completion_certificate_events where tenant_id='${ids.tenant}'::uuid;
      delete from public.course_completion_certificates where tenant_id='${ids.tenant}'::uuid;
      delete from public.student_course_completion_evaluations where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_recording_evidence where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_drafts where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_remediation_attempts where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_progress where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_retake_students where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_submission_answers where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_submissions where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_question_keys where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_questions where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_targets where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignment_submission_counters where tenant_id='${ids.tenant}'::uuid;
      delete from public.learning_assignments where tenant_id='${ids.tenant}'::uuid;
      delete from public.tenant_student_assignments where tenant_id='${ids.tenant}'::uuid;
      delete from public.student_app_enrollments where tenant_id='${ids.tenant}'::uuid;
      delete from public.staff_app_assignments where tenant_id='${ids.tenant}'::uuid;
      delete from public.tenant_student_apps where tenant_id='${ids.tenant}'::uuid;
      delete from public.tenant_memberships where tenant_id='${ids.tenant}'::uuid;
      delete from public.course_completion_policies where id='${ids.policy}'::uuid;
      delete from public.assessment_paper_question_keys where question_id in ('${ids.paperQ1}'::uuid,'${ids.paperQ2}'::uuid);
      delete from public.assessment_paper_questions where paper_id='${ids.paper}'::uuid;
      delete from public.assessment_papers where id='${ids.paper}'::uuid;
      delete from public.tenants where id='${ids.tenant}'::uuid;
      set local session_replication_role=origin; commit;`);
  } catch (error) { console.error(`WARN cleanup: ${error.message}`); }
  for (const id of users.reverse()) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  if (originallyMissingRead.length) {
    runSql(`revoke select on ${originallyMissingRead.map((table) => `public.${table}`).join(",")} from authenticated;`);
  }
}
