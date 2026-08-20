#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER =
  process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_ID = "10000000-0000-4000-8000-000000000001";
const password = `Local-${randomUUID()}-Aa1!`;
const fixture = {
  tenantId: randomUUID(),
  assignmentId: randomUUID(),
  objectiveQuestionId: randomUUID(),
  subjectiveQuestionId: randomUUID(),
  submissionId: randomUUID(),
  objectiveAnswerId: randomUUID(),
  subjectiveAnswerId: randomUUID(),
};

function sqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function runSql(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
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
const anonKey = keyByRole.get("anon");
const serviceRoleKey = keyByRole.get("service_role");
assert.ok(anonKey && serviceRoleKey, "无法从本地 Kong 配置读取 API key");

const admin = createClient(LOCAL_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];

async function createAccount(label, role) {
  const email = `assignment-rls-${role}-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  failOn(error, `创建${label}账号`);
  assert.ok(data.user);
  createdUserIds.push(data.user.id);
  runSql(`
    update public.profiles
    set role = '${sqlLiteral(role)}', full_name = '${sqlLiteral(label)}', status = 'active'
    where id = '${data.user.id}'::uuid;
  `);
  return { id: data.user.id, email, role };
}

async function signIn(account) {
  const client = createClient(LOCAL_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  failOn(error, `${account.role} 登录`);
  return client;
}

let studentAccount;
let teacherAccount;
let managerAccount;

try {
  [studentAccount, teacherAccount, managerAccount] = await Promise.all([
    createAccount("RLS 验收学生", "student"),
    createAccount("RLS 验收教师", "teacher"),
    createAccount("RLS 验收机构管理员", "ceo"),
  ]);

  runSql(`
    insert into public.tenants (id, slug, name, status, created_by)
    values (
      '${fixture.tenantId}'::uuid,
      'assignment-rls-${Date.now()}',
      '成绩发布 RLS 验收机构',
      'active',
      '${managerAccount.id}'::uuid
    );
    insert into public.tenant_student_apps (tenant_id, app_id, is_enabled, status)
    values ('${fixture.tenantId}'::uuid, '${APP_ID}'::uuid, true, 'active')
    on conflict (tenant_id, app_id) do update
      set is_enabled = true, status = 'active';
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default
    ) values
      ('${fixture.tenantId}'::uuid, '${studentAccount.id}'::uuid, 'student', 'active', 'vip2', true),
      ('${fixture.tenantId}'::uuid, '${teacherAccount.id}'::uuid, 'teacher', 'active', 'vip2', true),
      ('${fixture.tenantId}'::uuid, '${managerAccount.id}'::uuid, 'ceo', 'active', 'vip2', true);
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at, enrolled_by
    ) values (
      '${fixture.tenantId}'::uuid, '${studentAccount.id}'::uuid, '${APP_ID}'::uuid,
      'active', 'vip2', now() - interval '1 minute', '${managerAccount.id}'::uuid
    );
    insert into public.staff_app_assignments (
      tenant_id, staff_id, app_id, access_role, can_manage_students,
      can_manage_content, can_manage_assessments, can_view_analytics,
      status, assigned_by
    ) values
      (
        '${fixture.tenantId}'::uuid, '${teacherAccount.id}'::uuid, '${APP_ID}'::uuid,
        'teacher', false, false, true, true, 'active', '${managerAccount.id}'::uuid
      ),
      (
        '${fixture.tenantId}'::uuid, '${managerAccount.id}'::uuid, '${APP_ID}'::uuid,
        'administrator', true, true, true, true, 'active', '${managerAccount.id}'::uuid
      );
    insert into public.tenant_student_assignments (
      tenant_id, student_id, teacher_id, assigned_by, student_app_id
    ) values (
      '${fixture.tenantId}'::uuid, '${studentAccount.id}'::uuid,
      '${teacherAccount.id}'::uuid, '${managerAccount.id}'::uuid, '${APP_ID}'::uuid
    );

    insert into public.learning_assignments (
      id, tenant_id, student_app_id, title, description, assignment_type,
      target_scope, total_points, due_at, status, published_at, created_by, updated_by
    ) values (
      '${fixture.assignmentId}'::uuid, '${fixture.tenantId}'::uuid, '${APP_ID}'::uuid,
      '成绩发布 RLS 验收', '本地可清理安全夹具', 'exam', 'all_students', 16,
      now() + interval '1 day', 'published', now(),
      '${managerAccount.id}'::uuid, '${managerAccount.id}'::uuid
    );
    insert into public.learning_assignment_questions (
      id, tenant_id, assignment_id, question_type, language_skill, prompt,
      options, points, sort_order, auto_graded
    ) values
      (
        '${fixture.objectiveQuestionId}'::uuid, '${fixture.tenantId}'::uuid,
        '${fixture.assignmentId}'::uuid, 'single_choice', 'vocabulary',
        '客观题', '["A","B"]'::jsonb, 1, 0, true
      ),
      (
        '${fixture.subjectiveQuestionId}'::uuid, '${fixture.tenantId}'::uuid,
        '${fixture.assignmentId}'::uuid, 'long_text', 'speaking',
        '主观题', '[]'::jsonb, 15, 1, false
      );
    insert into public.learning_assignment_question_keys (
      tenant_id, question_id, correct_answer, explanation, updated_by
    ) values (
      '${fixture.tenantId}'::uuid, '${fixture.objectiveQuestionId}'::uuid,
      'A', '客观题解析', '${managerAccount.id}'::uuid
    );
    insert into public.learning_submissions (
      id, tenant_id, assignment_id, student_id, attempt_number, status,
      request_id, request_payload_hash, submission_state, objective_graded_at
    ) values (
      '${fixture.submissionId}'::uuid, '${fixture.tenantId}'::uuid,
      '${fixture.assignmentId}'::uuid, '${studentAccount.id}'::uuid, 1, 'submitted',
      '${randomUUID()}'::uuid, 'assignment-grade-release-rls',
      'objective_graded_pending_manual', now()
    );
    insert into public.learning_submission_answers (
      id, tenant_id, submission_id, question_id, answer_text, awarded_points
    ) values
      (
        '${fixture.objectiveAnswerId}'::uuid, '${fixture.tenantId}'::uuid,
        '${fixture.submissionId}'::uuid, '${fixture.objectiveQuestionId}'::uuid, 'A', 1
      ),
      (
        '${fixture.subjectiveAnswerId}'::uuid, '${fixture.tenantId}'::uuid,
        '${fixture.submissionId}'::uuid, '${fixture.subjectiveQuestionId}'::uuid,
        '学生主观题回答', null
      );
  `);

  const [student, teacher, manager] = await Promise.all([
    signIn(studentAccount),
    signIn(teacherAccount),
    signIn(managerAccount),
  ]);

  const { error: gradeError } = await teacher.rpc("grade_learning_submission", {
    p_submission_id: fixture.submissionId,
    p_decision: "graded",
    p_overall_feedback: "发布前内部总体评语",
    p_scores: [
      {
        answerId: fixture.objectiveAnswerId,
        points: 1,
        feedback: "发布前内部客观题评语",
      },
      {
        answerId: fixture.subjectiveAnswerId,
        points: 15,
        feedback: "发布前内部主观题评语",
        rubricScores: {
          pronunciation_accuracy: 4,
          fluency: 4,
          grammar_vocabulary: 4,
          task_completion: 3,
        },
      },
    ],
  });
  failOn(gradeError, "教师批改写入");

  const teacherSubmission = await teacher
    .from("learning_submissions")
    .select("submission_state,computed_score,overall_feedback")
    .eq("id", fixture.submissionId)
    .single();
  failOn(teacherSubmission.error, "教师发布前读取提交评分");
  assert.deepEqual(teacherSubmission.data, {
    submission_state: "grading_completed",
    computed_score: 16,
    overall_feedback: "发布前内部总体评语",
  });
  const teacherAnswer = await teacher
    .from("learning_submission_answers")
    .select("awarded_points,rubric_scores,grader_feedback")
    .eq("id", fixture.subjectiveAnswerId)
    .single();
  failOn(teacherAnswer.error, "教师发布前读取主观题评分");
  assert.equal(Number(teacherAnswer.data.awarded_points), 15);
  assert.equal(teacherAnswer.data.rubric_scores.task_completion, 3);
  assert.equal(teacherAnswer.data.grader_feedback, "发布前内部主观题评语");
  const teacherReviewItem = await teacher
    .from("student_review_items")
    .select("feedback_snapshot")
    .eq("source_id", fixture.assignmentId)
    .eq("student_id", studentAccount.id)
    .single();
  failOn(teacherReviewItem.error, "教师发布前读取派生复习项");
  assert.equal(teacherReviewItem.data.feedback_snapshot.awardedPoints, 15);
  assert.equal(teacherReviewItem.data.feedback_snapshot.rubric.task_completion, 3);
  assert.equal(
    teacherReviewItem.data.feedback_snapshot.teacherComment,
    "发布前内部主观题评语",
  );
  console.log("PASS teacher pre-release REST: full grading details readable; grading RPC writable");

  const managerSubmission = await manager
    .from("learning_submissions")
    .select("computed_score,overall_feedback")
    .eq("id", fixture.submissionId)
    .single();
  failOn(managerSubmission.error, "机构管理员发布前读取评分");
  assert.equal(Number(managerSubmission.data.computed_score), 16);
  assert.equal(managerSubmission.data.overall_feedback, "发布前内部总体评语");
  console.log("PASS manager pre-release REST: full grading details readable");

  const studentBaseSubmissions = await student
    .from("learning_submissions")
    .select("id,score,computed_score,overall_feedback")
    .eq("id", fixture.submissionId);
  failOn(studentBaseSubmissions.error, "学生发布前直查提交原表");
  assert.deepEqual(studentBaseSubmissions.data, []);
  const studentBaseAnswers = await student
    .from("learning_submission_answers")
    .select("id,awarded_points,rubric_scores,grader_feedback")
    .eq("submission_id", fixture.submissionId);
  failOn(studentBaseAnswers.error, "学生发布前直查答案原表");
  assert.deepEqual(studentBaseAnswers.data, []);
  const studentReviewItems = await student
    .from("student_review_items")
    .select("id,feedback_snapshot")
    .eq("source_id", fixture.assignmentId);
  failOn(studentReviewItems.error, "学生发布前直查派生复习项");
  assert.deepEqual(studentReviewItems.data, []);
  const studentReviewBypass = await student
    .from("student_review_items")
    .update({ source_type: "student_bookmark" })
    .eq("source_id", fixture.assignmentId)
    .select("id,feedback_snapshot");
  failOn(studentReviewBypass.error, "学生发布前尝试改写派生复习项来源");
  assert.deepEqual(studentReviewBypass.data, []);
  const unchangedReviewItem = await teacher
    .from("student_review_items")
    .select("source_type")
    .eq("source_id", fixture.assignmentId)
    .single();
  failOn(unchangedReviewItem.error, "教师复核派生复习项来源");
  assert.equal(
    unchangedReviewItem.data.source_type,
    "teacher_speaking_writing_feedback",
  );

  const studentSafeSubmission = await student
    .from("student_learning_submissions")
    .select("submission_state,score,overall_feedback")
    .eq("id", fixture.submissionId)
    .single();
  failOn(studentSafeSubmission.error, "学生发布前读取安全提交视图");
  assert.deepEqual(studentSafeSubmission.data, {
    submission_state: "grading_completed",
    score: null,
    overall_feedback: null,
  });
  const studentSafeAnswers = await student
    .from("student_learning_submission_answers")
    .select("question_id,awarded_points,rubric_scores,grader_feedback")
    .eq("submission_id", fixture.submissionId)
    .order("question_id");
  failOn(studentSafeAnswers.error, "学生发布前读取安全答案视图");
  const objective = studentSafeAnswers.data.find(
    (row) => row.question_id === fixture.objectiveQuestionId,
  );
  const subjective = studentSafeAnswers.data.find(
    (row) => row.question_id === fixture.subjectiveQuestionId,
  );
  assert.equal(Number(objective.awarded_points), 1);
  assert.equal(objective.rubric_scores, null);
  assert.equal(objective.grader_feedback, null);
  assert.deepEqual(subjective, {
    question_id: fixture.subjectiveQuestionId,
    awarded_points: null,
    rubric_scores: null,
    grader_feedback: null,
  });
  console.log("PASS student pre-release REST: base and derived review rows=0; status/objective points only; subjective grade/rubric/feedback=null");

  const { error: releaseError } = await manager.rpc(
    "release_learning_submission_grade",
    { p_submission_id: fixture.submissionId },
  );
  failOn(releaseError, "机构管理员发布成绩");

  const releasedSubmission = await student
    .from("learning_submissions")
    .select("submission_state,score,computed_score,overall_feedback")
    .eq("id", fixture.submissionId)
    .single();
  failOn(releasedSubmission.error, "学生发布后直查提交原表");
  assert.deepEqual(releasedSubmission.data, {
    submission_state: "grade_released",
    score: 16,
    computed_score: 16,
    overall_feedback: "发布前内部总体评语",
  });
  const releasedAnswer = await student
    .from("learning_submission_answers")
    .select("awarded_points,rubric_scores,grader_feedback")
    .eq("id", fixture.subjectiveAnswerId)
    .single();
  failOn(releasedAnswer.error, "学生发布后直查主观题评分");
  assert.equal(Number(releasedAnswer.data.awarded_points), 15);
  assert.equal(releasedAnswer.data.rubric_scores.pronunciation_accuracy, 4);
  assert.equal(releasedAnswer.data.grader_feedback, "发布前内部主观题评语");
  const releasedReviewItem = await student
    .from("student_review_items")
    .select("feedback_snapshot")
    .eq("source_id", fixture.assignmentId)
    .single();
  failOn(releasedReviewItem.error, "学生发布后读取派生复习项");
  assert.equal(releasedReviewItem.data.feedback_snapshot.awardedPoints, 15);
  assert.equal(
    releasedReviewItem.data.feedback_snapshot.overallComment,
    "发布前内部总体评语",
  );
  console.log("PASS student post-release REST: score, rubric, teacher feedback, and derived review feedback readable");
} finally {
  const cleanupErrors = [];
  try {
    runSql(`
      begin;
      delete from public.learning_assignments
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_student_assignments
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.student_app_enrollments
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.staff_app_assignments
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_student_apps
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_memberships
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_membership_audit_logs
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.application_access_audit_logs
      where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenants where id = '${fixture.tenantId}'::uuid;
      commit;
    `);
  } catch (error) {
    cleanupErrors.push(new Error(`fixture tenant cleanup failed: ${error.message}`));
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      cleanupErrors.push(
        new Error(`fixture user cleanup failed (${userId}): ${error.message}`),
      );
    }
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "RLS fixture cleanup failed");
  console.log("CLEANUP assignment-grade-release RLS fixture completed with zero retained fixture rows");
}
