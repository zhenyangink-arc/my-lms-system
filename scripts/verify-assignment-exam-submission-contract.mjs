import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_URL ?? process.env.API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if (!apiUrl || !anonKey || !serviceRoleKey) {
  throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const tenantId = "10000000-0000-4000-8000-000000000001";
const appId = "10000000-0000-4000-8000-000000000001";
const prefix = `exam-contract-${Date.now()}`;
const admin = createClient(apiUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const assignmentIds = [];
let userId = null;

function failOn(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function sql(statement) {
  execFileSync("docker", ["exec", "supabase_db_my-lms-system", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", statement], { stdio: "pipe" });
}

function createExam({ starts = "now() - interval '1 minute'", duration = 45 } = {}) {
  const assignmentId = randomUUID();
  const questionIds = [randomUUID(), randomUUID()];
  assignmentIds.push(assignmentId);
  sql(`
    insert into public.learning_assignments (
      id, tenant_id, title, description, assignment_type, target_scope,
      total_points, starts_at, due_at, duration_minutes, allow_resubmission,
      allow_late_submission, max_attempts, status, published_at, created_by,
      updated_by, student_app_id
    ) values (
      '${assignmentId}', '${tenantId}', '${prefix}-${assignmentIds.length}',
      'Authoritative exam contract fixture', 'exam', 'all_students', 2,
      ${starts}, now() + interval '2 hours', ${duration}, false, false, 1,
      'published', now(), '${userId}', '${userId}', '${appId}'
    );
    insert into public.learning_assignment_questions (
      id, tenant_id, assignment_id, question_type, language_skill,
      prompt, options, points, sort_order
    ) values
      ('${questionIds[0]}', '${tenantId}', '${assignmentId}', 'single_choice',
       'vocabulary', 'Question one', '["A", "B"]'::jsonb, 1, 0),
      ('${questionIds[1]}', '${tenantId}', '${assignmentId}', 'single_choice',
       'grammar', 'Question two', '["A", "B"]'::jsonb, 1, 1);
    insert into public.learning_assignment_question_keys (
      tenant_id, question_id, correct_answer, explanation, updated_by
    ) values
      ('${tenantId}', '${questionIds[0]}', 'A', 'fixture', '${userId}'),
      ('${tenantId}', '${questionIds[1]}', 'A', 'fixture', '${userId}');
  `);
  return { assignmentId, questionIds };
}

function answers(fixture, first = "", second = "") {
  return [
    { questionId: fixture.questionIds[0], answer: first },
    { questionId: fixture.questionIds[1], answer: second },
  ];
}

async function submit(client, fixture, intent, submittedAnswers) {
  return client.rpc("submit_learning_assignment", {
    p_assignment_id: fixture.assignmentId,
    p_answers: submittedAnswers,
    p_request_id: randomUUID(),
    p_submission_intent: intent,
  });
}

try {
  const email = `${prefix}@example.test`;
  const password = `Local-${randomUUID()}-Aa1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: "Exam contract test" },
  });
  failOn(createError, "create auth user");
  userId = created.user.id;
  sql(`
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values ('${tenantId}', '${userId}', 'student', 'active', 'vip2', true, now());
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at
    ) values ('${tenantId}', '${userId}', '${appId}', 'active', 'vip2', now() - interval '1 minute');
  `);

  const student = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await student.auth.signInWithPassword({ email, password });
  failOn(signInError, "sign in student");

  const idempotent = createExam();
  const firstStart = await student.rpc("start_learning_assignment_attempt", { p_assignment_id: idempotent.assignmentId });
  const secondStart = await student.rpc("start_learning_assignment_attempt", { p_assignment_id: idempotent.assignmentId });
  failOn(firstStart.error, "start exam first time");
  failOn(secondStart.error, "start exam idempotently");
  assert.equal(firstStart.data.startedAt, secondStart.data.startedAt, "server start time is immutable");
  assert.equal(firstStart.data.idempotent, false);
  assert.equal(secondStart.data.idempotent, true);

  const tooEarly = await submit(student, idempotent, "confirmed_incomplete", answers(idempotent, "A", ""));
  assert.match(tooEarly.error?.message ?? "", /最短有效作答时间/, "early incomplete confirmation is rejected");
  sql(`update public.learning_assignment_submission_counters set current_attempt_started_at = now() - interval '6 minutes' where assignment_id = '${idempotent.assignmentId}' and student_id = '${userId}';`);
  const confirmed = await submit(student, idempotent, "confirmed_incomplete", answers(idempotent, "A", ""));
  failOn(confirmed.error, "submit explicitly confirmed incomplete exam");

  const expired = createExam({ duration: 1 });
  failOn((await student.rpc("start_learning_assignment_attempt", { p_assignment_id: expired.assignmentId })).error, "start expiring exam");
  sql(`update public.learning_assignment_submission_counters set current_attempt_started_at = now() - interval '2 minutes' where assignment_id = '${expired.assignmentId}' and student_id = '${userId}';`);
  const expiredSubmit = await submit(student, expired, "time_expired", answers(expired));
  failOn(expiredSubmit.error, "auto-submit fully unanswered expired exam");
  const { data: expiredRow, error: expiredRowError } = await admin.from("learning_submissions").select("attempt_started_at,submission_intent,unanswered_count,learning_submission_answers(answer_text,awarded_points)").eq("assignment_id", expired.assignmentId).eq("student_id", userId).single();
  failOn(expiredRowError, "read expired submission");
  assert.equal(expiredRow.submission_intent, "time_expired");
  assert.equal(expiredRow.unanswered_count, 2);
  assert.ok(expiredRow.attempt_started_at);
  assert.deepEqual(expiredRow.learning_submission_answers.map((item) => item.answer_text), ["", ""]);
  assert.ok(expiredRow.learning_submission_answers.every((item) => Number(item.awarded_points) === 0));

  const unopened = createExam({ starts: "now() + interval '1 hour'" });
  const unopenedStart = await student.rpc("start_learning_assignment_attempt", { p_assignment_id: unopened.assignmentId });
  assert.ok(unopenedStart.error, "an exam cannot start before its configured opening");
  const unopenedSubmit = await submit(student, unopened, "confirmed_incomplete", answers(unopened, "A", ""));
  assert.ok(unopenedSubmit.error, "confirmed-incomplete cannot replace a server start");

  const staleExpiry = createExam({ duration: 1 });
  failOn((await student.rpc("start_learning_assignment_attempt", { p_assignment_id: staleExpiry.assignmentId })).error, "start stale expiry fixture");
  sql(`update public.learning_assignment_submission_counters set current_attempt_started_at = now() - interval '10 minutes' where assignment_id = '${staleExpiry.assignmentId}' and student_id = '${userId}';`);
  const staleAutoSubmit = await submit(student, staleExpiry, "time_expired", answers(staleExpiry));
  assert.match(staleAutoSubmit.error?.message ?? "", /五分钟内/, "expired intent cannot be replayed long after the deadline");

  console.log("Verified authoritative exam start, incomplete confirmation, and expiry submission boundaries.");
} finally {
  if (assignmentIds.length) {
    sql(`delete from public.learning_assignments where id in (${assignmentIds.map((id) => `'${id}'`).join(",")});`);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
}
