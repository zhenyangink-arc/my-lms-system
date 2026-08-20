#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { mapAssignmentExamTask } from "../src/features/student-home-learning/api/assignment-exam-mapper.ts";

const LOCAL_URL = "http://127.0.0.1:54321";
const DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const KONG_CONTAINER = process.env.LOCAL_SUPABASE_KONG_CONTAINER ?? "supabase_kong_my-lms-system";
const APP_ID = "10000000-0000-4000-8000-000000000001";
const PAPER_CODE = "EX-K1-FIN-V1";
const password = `Final-${randomUUID()}-Aa1!`;
const fixture = { tenantId: randomUUID() };

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
const anonKey = keyByRole.get("anon");
const serviceRoleKey = keyByRole.get("service_role");
assert.ok(anonKey && serviceRoleKey, "无法从本地 Kong 配置读取 API key");

const admin = createClient(LOCAL_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUserIds = [];

async function createAccount(label, role) {
  const email = `final-delivery-${role}-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`;
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
  const { error } = await client.auth.signInWithPassword({ email: account.email, password });
  failOn(error, `${account.role} 登录`);
  return client;
}

function mapTodayTask(assignment, progress) {
  return mapAssignmentExamTask({
    assignment,
    progress,
    studentAppId: APP_ID,
    appSlug: "korean",
    appLabel: "韩国语",
    space: "student",
    now: new Date(),
  });
}

let studentAccount;
let teacherAccount;
let managerAccount;
let assignmentId;

try {
  const paperResult = await admin
    .from("assessment_papers")
    .select("id,paper_code,status,question_count,total_points,duration_minutes,passing_score,allow_resubmission")
    .eq("paper_code", PAPER_CODE)
    .single();
  failOn(paperResult.error, "读取期末母卷");
  assert.deepEqual(paperResult.data, {
    id: paperResult.data.id,
    paper_code: PAPER_CODE,
    status: "published",
    question_count: 41,
    total_points: 100,
    duration_minutes: 90,
    passing_score: 60,
    allow_resubmission: false,
  });
  const qualityEvidence = runSql(`
    select cardinality(private.assessment_paper_release_issues(id))
    from public.assessment_papers where paper_code = '${PAPER_CODE}';
  `);
  assert.equal(qualityEvidence, "0");
  console.log("PASS paper: published; 41 questions; 100 points; 90 minutes; passing 60; quality issues=0");

  [studentAccount, teacherAccount, managerAccount] = await Promise.all([
    createAccount("期末投递验收学生", "student"),
    createAccount("期末投递验收教师", "teacher"),
    createAccount("期末投递验收机构管理员", "ceo"),
  ]);

  runSql(`
    insert into public.tenants (id, slug, name, status, created_by)
    values (
      '${fixture.tenantId}'::uuid, 'final-delivery-${Date.now()}',
      '期末真实投递验收班级', 'active', '${managerAccount.id}'::uuid
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
      ('${fixture.tenantId}'::uuid, '${teacherAccount.id}'::uuid, '${APP_ID}'::uuid,
       'teacher', false, false, true, true, 'active', '${managerAccount.id}'::uuid),
      ('${fixture.tenantId}'::uuid, '${managerAccount.id}'::uuid, '${APP_ID}'::uuid,
       'administrator', true, true, true, true, 'active', '${managerAccount.id}'::uuid);
    insert into public.tenant_student_assignments (
      tenant_id, student_id, teacher_id, assigned_by, student_app_id
    ) values (
      '${fixture.tenantId}'::uuid, '${studentAccount.id}'::uuid,
      '${teacherAccount.id}'::uuid, '${managerAccount.id}'::uuid, '${APP_ID}'::uuid
    );
  `);

  const [student, teacher, manager] = await Promise.all([
    signIn(studentAccount),
    signIn(teacherAccount),
    signIn(managerAccount),
  ]);

  const { data: createdAssignmentId, error: assignmentError } = await manager.rpc(
    "create_learning_assignment_from_paper_with_unlock",
    {
      p_paper_id: paperResult.data.id,
      p_course_id: null,
      p_target_scope: "selected_students",
      p_target_ids: [studentAccount.id],
      p_starts_at: new Date(Date.now() - 60_000).toISOString(),
      p_due_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_institution_note: "期末卷真实投递验收；完成后自动清理",
      p_unlock_after_chapter_completion: false,
      p_due_days_after_unlock: null,
      p_allow_late_submission: false,
      p_max_attempts: 1,
      p_shuffle_questions: false,
      p_shuffle_options: false,
      p_grade_release_at: null,
      p_retake_paper_id: null,
      p_retake_student_ids: [],
      p_retake_starts_at: null,
      p_retake_due_at: null,
      p_retake_score_policy: null,
      p_retake_original_weight_percent: null,
    },
  );
  failOn(assignmentError, "从期末母卷真实投递");
  assignmentId = createdAssignmentId;
  assert.ok(assignmentId);

  const assignmentResult = await student
    .from("learning_assignments")
    .select("id,title,description,assignment_type,course_id,starts_at,due_at,allow_late_submission,unlock_after_chapter_completion,unlock_test_slug,due_days_after_unlock,updated_at,max_attempts,source_paper_id")
    .eq("id", assignmentId)
    .single();
  failOn(assignmentResult.error, "学生读取今日期末任务");
  assert.equal(assignmentResult.data.source_paper_id, paperResult.data.id);
  assert.equal(assignmentResult.data.max_attempts, 1);
  const taskAssignment = { ...assignmentResult.data };
  delete taskAssignment.max_attempts;
  delete taskAssignment.source_paper_id;
  assert.equal(mapTodayTask(taskAssignment, undefined).status, "available");
  console.log("PASS today aggregation: published selected-student exam appears as available");

  const startResult = await student.rpc("start_learning_assignment_attempt", {
    p_assignment_id: assignmentId,
  });
  failOn(startResult.error, "学生开始期末考试");
  assert.equal(startResult.data.idempotent, false);
  const inProgressResult = await student
    .from("learning_assignment_progress")
    .select("assignment_id,progress_state,updated_at")
    .eq("assignment_id", assignmentId)
    .single();
  failOn(inProgressResult.error, "读取考试进行中进度");
  assert.equal(mapTodayTask(taskAssignment, inProgressResult.data).status, "in_progress");

  const questionsResult = await student
    .from("learning_assignment_questions")
    .select("id,question_type,language_skill,auto_graded,points")
    .eq("assignment_id", assignmentId)
    .order("sort_order");
  failOn(questionsResult.error, "学生读取41道投递快照");
  assert.equal(questionsResult.data.length, 41);
  const keysResult = await admin
    .from("learning_assignment_question_keys")
    .select("question_id,correct_answer")
    .eq("tenant_id", fixture.tenantId);
  failOn(keysResult.error, "验收脚本读取客观题答案夹具");
  const answerByQuestion = new Map(keysResult.data.map((key) => [key.question_id, key.correct_answer]));
  const recordingEvidenceByQuestion = new Map(
    questionsResult.data
      .filter((question) => question.question_type === "audio_recording")
      .map((question) => [question.id, randomUUID()]),
  );
  for (const [questionId, evidenceId] of recordingEvidenceByQuestion) {
    runSql(`
      insert into public.learning_assignment_recording_evidence (
        id, tenant_id, student_id, assignment_id, question_id,
        object_key, byte_size, mime_type
      ) values (
        '${evidenceId}'::uuid, '${fixture.tenantId}'::uuid,
        '${studentAccount.id}'::uuid, '${assignmentId}'::uuid,
        '${questionId}'::uuid, 'final-delivery/${evidenceId}.webm',
        4096, 'audio/webm'
      );
    `);
  }
  const answers = questionsResult.data.map((question) => ({
    questionId: question.id,
    answer: question.auto_graded
      ? answerByQuestion.get(question.id)
      : question.question_type === "audio_recording"
        ? recordingEvidenceByQuestion.get(question.id)
        : "다음 토요일 오후 두 시에 서울역에서 만나요. 버스로 학교에 가요. 작은 선물 한 개를 살게요. 날씨가 좋으면 공원에 가고 싶어요. 비가 오면 박물관에 갈 거예요. 저는 표를 준비할게요. 친구는 음료수를 준비해요. 같이 점심을 먹을 거예요. 곧 만나요.",
  }));
  assert.equal(answers.filter((answer) => answer.answer).length, 41);

  const submitResult = await student.rpc("submit_learning_assignment", {
    p_assignment_id: assignmentId,
    p_answers: answers,
    p_request_id: randomUUID(),
    p_submission_intent: "complete",
  });
  failOn(submitResult.error, "学生提交期末考试");
  assert.equal(submitResult.data.workflowState, "objective_graded_pending_manual");
  const submissionId = submitResult.data.submissionId;
  const pendingProgressResult = await student
    .from("learning_assignment_progress")
    .select("assignment_id,progress_state,updated_at")
    .eq("assignment_id", assignmentId)
    .single();
  failOn(pendingProgressResult.error, "读取待批改进度");
  assert.equal(pendingProgressResult.data.progress_state, "objective_graded_pending_manual");
  assert.equal(mapTodayTask(taskAssignment, pendingProgressResult.data).status, "pending_grading");
  console.log("PASS submission: 41 answers accepted; objective auto-grade -> objective_graded_pending_manual; today status=pending_grading");

  const teacherAnswersResult = await teacher
    .from("learning_submission_answers")
    .select("id,question_id,awarded_points,learning_assignment_questions!inner(auto_graded,points,question_type)")
    .eq("submission_id", submissionId);
  failOn(teacherAnswersResult.error, "教师读取全部待评分答案");
  assert.equal(teacherAnswersResult.data.length, 41);
  const scores = teacherAnswersResult.data.map((answer) => {
    const question = answer.learning_assignment_questions;
    if (question.auto_graded) {
      return { answerId: answer.id, points: Number(answer.awarded_points), feedback: null };
    }
    const points = question.question_type === "long_text" ? 12 : Number(question.points) - 1;
    return {
      answerId: answer.id,
      points,
      feedback: "期末人工批改验收评语",
      rubricScores: question.question_type === "long_text"
        ? {
            content_completeness: 3,
            grammar_accuracy: 3,
            vocabulary_use: 2,
            organization_expression: 2,
            spelling_format: 2,
          }
        : Number(question.points) === 7
          ? {
              pronunciation_accuracy: 2,
              fluency: 1,
              grammar_vocabulary: 1,
              task_completion: 2,
            }
          : {
              pronunciation_accuracy: 2,
              fluency: 2,
              grammar_vocabulary: 1,
              task_completion: 2,
            },
    };
  });
  const gradeResult = await teacher.rpc("grade_learning_submission", {
    p_submission_id: submissionId,
    p_decision: "graded",
    p_overall_feedback: "期末卷批改完成，成绩尚未发布。",
    p_scores: scores,
  });
  failOn(gradeResult.error, "教师完成主客观题批改");

  const teacherSubmission = await teacher
    .from("learning_submissions")
    .select("submission_state,computed_score,overall_feedback")
    .eq("id", submissionId)
    .single();
  failOn(teacherSubmission.error, "教师读取发布前内部评分");
  assert.equal(teacherSubmission.data.submission_state, "grading_completed");
  assert.equal(Number(teacherSubmission.data.computed_score), 95);

  const studentBaseSubmission = await student
    .from("learning_submissions")
    .select("id,score,computed_score,overall_feedback")
    .eq("id", submissionId);
  failOn(studentBaseSubmission.error, "学生发布前直查提交原表");
  assert.deepEqual(studentBaseSubmission.data, []);
  const studentBaseAnswers = await student
    .from("learning_submission_answers")
    .select("id,awarded_points,rubric_scores,grader_feedback")
    .eq("submission_id", submissionId);
  failOn(studentBaseAnswers.error, "学生发布前直查答案原表");
  assert.deepEqual(studentBaseAnswers.data, []);

  const safeSubmission = await student
    .from("student_learning_submissions")
    .select("submission_state,score,overall_feedback")
    .eq("id", submissionId)
    .single();
  failOn(safeSubmission.error, "学生发布前读取安全提交视图");
  assert.deepEqual(safeSubmission.data, {
    submission_state: "grading_completed",
    score: null,
    overall_feedback: null,
  });
  const safeAnswers = await student
    .from("student_learning_submission_answers")
    .select("question_id,awarded_points,rubric_scores,grader_feedback")
    .eq("submission_id", submissionId);
  failOn(safeAnswers.error, "学生发布前读取安全答案视图");
  assert.equal(safeAnswers.data.length, 41);
  const subjectiveQuestionIds = new Set(
    questionsResult.data.filter((question) => !question.auto_graded).map((question) => question.id),
  );
  const safeSubjective = safeAnswers.data.filter((answer) => subjectiveQuestionIds.has(answer.question_id));
  assert.equal(safeSubjective.length, 3);
  assert.ok(safeSubjective.every((answer) =>
    answer.awarded_points === null && answer.rubric_scores === null && answer.grader_feedback === null
  ));
  console.log("PASS pre-release RLS: student base submissions/answers rows=0; safe view score/feedback and all 3 subjective grades=null");

  const releaseResult = await manager.rpc("release_learning_submission_grade", {
    p_submission_id: submissionId,
  });
  failOn(releaseResult.error, "机构管理员发布期末成绩");
  assert.equal(releaseResult.data.released, true);
  assert.equal(releaseResult.data.scheduled, false);

  const releasedSubmission = await student
    .from("learning_submissions")
    .select("submission_state,score,computed_score,overall_feedback")
    .eq("id", submissionId)
    .single();
  failOn(releasedSubmission.error, "学生发布后直查提交原表");
  assert.equal(releasedSubmission.data.submission_state, "grade_released");
  assert.equal(Number(releasedSubmission.data.score), 95);
  assert.equal(Number(releasedSubmission.data.computed_score), 95);
  assert.equal(releasedSubmission.data.overall_feedback, "期末卷批改完成，成绩尚未发布。");
  const releasedSubjective = await student
    .from("learning_submission_answers")
    .select("awarded_points,rubric_scores,grader_feedback,learning_assignment_questions!inner(auto_graded)")
    .eq("submission_id", submissionId);
  failOn(releasedSubjective.error, "学生发布后读取主观评分");
  assert.equal(releasedSubjective.data.filter((answer) => !answer.learning_assignment_questions.auto_graded).length, 3);
  assert.ok(releasedSubjective.data
    .filter((answer) => !answer.learning_assignment_questions.auto_graded)
    .every((answer) => answer.awarded_points !== null && answer.rubric_scores && answer.grader_feedback));
  const completedProgress = await student
    .from("learning_assignment_progress")
    .select("assignment_id,progress_state,updated_at")
    .eq("assignment_id", assignmentId)
    .single();
  failOn(completedProgress.error, "读取成绩发布后聚合进度");
  assert.equal(completedProgress.data.progress_state, "grade_released");
  assert.equal(mapTodayTask(taskAssignment, completedProgress.data).status, "completed");
  console.log("PASS post-release: score=95; 3 subjective grades/rubrics/comments visible; today progress=grade_released/completed");
} finally {
  const cleanupErrors = [];
  try {
    runSql(`
      begin;
      delete from public.learning_assignments where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_student_assignments where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.student_app_enrollments where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.staff_app_assignments where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_student_apps where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_memberships where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenant_membership_audit_logs where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.application_access_audit_logs where tenant_id = '${fixture.tenantId}'::uuid;
      delete from public.tenants where id = '${fixture.tenantId}'::uuid;
      commit;
    `);
  } catch (error) {
    cleanupErrors.push(new Error(`fixture tenant cleanup failed: ${error.message}`));
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(new Error(`fixture user cleanup failed (${userId}): ${error.message}`));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "final delivery cleanup failed");
  console.log(`PASS cleanup: assignment=${assignmentId ?? "not-created"}; tenant and ${createdUserIds.length} accounts removed`);
}
