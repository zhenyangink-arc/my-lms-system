import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_URL ?? process.env.API_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!apiUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required."
  );
}

const tenantId = "10000000-0000-4000-8000-000000000001";
const koreanAppId = "10000000-0000-4000-8000-000000000001";
const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const fixturePrefix = `submission-concurrency-${Date.now()}`;
const email = `${fixturePrefix}@example.test`;
const password = `Local-${randomUUID()}-Aa1!`;
let userId = null;
const assignmentIds = [];

function failOn(error, context) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

function sql(statement) {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_my-lms-system",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { stdio: "pipe" }
  );
}

async function createObjectiveAssignment(maxAttempts, scheduleRelease = false) {
  const assignmentId = randomUUID();
  const questionId = randomUUID();
  assignmentIds.push(assignmentId);
  sql(`
    insert into public.learning_assignments (
      id, tenant_id, title, description, assignment_type, target_scope,
      total_points, starts_at, due_at, allow_resubmission,
      allow_late_submission, max_attempts, status, published_at,
      created_by, updated_by, student_app_id, grade_release_at
    ) values (
      '${assignmentId}', '${tenantId}',
      '${fixturePrefix}-${assignmentIds.length}',
      'Concurrency verification fixture', 'homework', 'all_students', 1,
      now() - interval '1 day',
      ${scheduleRelease ? "now() - interval '1 day'" : "now() + interval '1 hour'"},
      ${maxAttempts > 1}, ${scheduleRelease}, ${maxAttempts}, 'published', now(),
      '${userId}', '${userId}', '${koreanAppId}',
      ${scheduleRelease ? "now() + interval '1 hour'" : "null"}
    );
    insert into public.learning_assignment_questions (
      id, tenant_id, assignment_id, question_type, language_skill,
      prompt, options, points, sort_order
    ) values (
      '${questionId}', '${tenantId}', '${assignmentId}', 'single_choice',
      'vocabulary', 'Select the correct answer', '["A", "B"]'::jsonb,
      1, 0
    );
    insert into public.learning_assignment_question_keys (
      tenant_id, question_id, correct_answer, explanation, updated_by
    ) values (
      '${tenantId}', '${questionId}', 'A', 'fixture', '${userId}'
    );
  `);
  return { assignmentId, questionId };
}

async function createManualAssignment() {
  const assignmentId = randomUUID();
  const questionId = randomUUID();
  assignmentIds.push(assignmentId);
  sql(`
    insert into public.learning_assignments (
      id, tenant_id, title, description, assignment_type, target_scope,
      total_points, starts_at, due_at, allow_resubmission,
      allow_late_submission, max_attempts, status, published_at,
      created_by, updated_by, student_app_id
    ) values (
      '${assignmentId}', '${tenantId}',
      '${fixturePrefix}-${assignmentIds.length}',
      'Manual grading fixture', 'homework', 'all_students', 1,
      now() - interval '1 minute', now() + interval '1 hour',
      false, false, 1, 'published', now(),
      '${userId}', '${userId}', '${koreanAppId}'
    );
    insert into public.learning_assignment_questions (
      id, tenant_id, assignment_id, question_type, language_skill,
      prompt, options, points, sort_order
    ) values (
      '${questionId}', '${tenantId}', '${assignmentId}', 'long_text',
      'writing', 'Write one sentence', '[]'::jsonb, 1, 0
    );
  `);
  return { assignmentId, questionId };
}

function submit(client, fixture, requestId) {
  return client.rpc("submit_learning_assignment", {
    p_assignment_id: fixture.assignmentId,
    p_answers: [{ questionId: fixture.questionId, answer: "A" }],
    p_request_id: requestId,
    p_submission_intent: "complete",
  });
}

try {
  const { data: created, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Submission concurrency test" },
    });
  failOn(createUserError, "create auth user");
  userId = created.user.id;

  sql(`
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values (
      '${tenantId}', '${userId}', 'student', 'active', 'vip2', true, now()
    )
    on conflict (tenant_id, user_id) do update
    set role = 'student', status = 'active', membership_tier = 'vip2', is_default = true;
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, access_tier, starts_at
    ) values (
      '${tenantId}', '${userId}', '${koreanAppId}',
      'active', 'vip2', now() - interval '1 minute'
    )
    on conflict (tenant_id, student_id, app_id) do update
    set status = 'active', starts_at = excluded.starts_at, ends_at = null;
  `);

  const student = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await student.auth.signInWithPassword({
    email,
    password,
  });
  failOn(signInError, "sign in test student");

  const limited = await createObjectiveAssignment(2);
  const limitedResults = await Promise.all(
    [randomUUID(), randomUUID(), randomUUID()].map((requestId) =>
      submit(student, limited, requestId)
    )
  );
  const limitedSuccesses = limitedResults.filter((result) => !result.error);
  const limitedFailures = limitedResults.filter((result) => result.error);
  assert.equal(
    limitedSuccesses.length,
    2,
    `exactly max_attempts requests succeed: ${limitedFailures
      .map((result) => result.error?.message)
      .join(" | ")}`
  );
  assert.equal(limitedFailures.length, 1, "the excess concurrent request fails");
  assert.match(limitedFailures[0].error.message, /允许的提交次数/);

  const { data: limitedRows, error: limitedRowsError } = await admin
    .from("learning_submissions")
    .select("attempt_number,submission_state")
    .eq("assignment_id", limited.assignmentId)
    .eq("student_id", userId)
    .order("attempt_number");
  failOn(limitedRowsError, "read limited submissions");
  assert.deepEqual(
    limitedRows.map((row) => row.attempt_number),
    [1, 2],
    "attempt numbers are unique and contiguous"
  );
  assert.ok(
    limitedRows.every((row) => row.submission_state === "grade_released"),
    "automatic grading advances the persisted workflow"
  );

  const { data: progress, error: progressError } = await admin
    .from("learning_assignment_progress")
    .select("progress_state,attempts_used")
    .eq("assignment_id", limited.assignmentId)
    .eq("student_id", userId)
    .single();
  failOn(progressError, "read assignment progress");
  assert.deepEqual(progress, {
    progress_state: "grade_released",
    attempts_used: 2,
  });

  const idempotent = await createObjectiveAssignment(1);
  const repeatedRequestId = randomUUID();
  const { error: initialDraftError } = await student.rpc(
    "save_learning_assignment_draft",
    {
      p_assignment_id: idempotent.assignmentId,
      p_answers: { [idempotent.questionId]: "A" },
      p_active_step: 0,
      p_request_id: repeatedRequestId,
    }
  );
  failOn(initialDraftError, "save initial draft");
  const repeatedResults = await Promise.all([
    submit(student, idempotent, repeatedRequestId),
    submit(student, idempotent, repeatedRequestId),
  ]);
  assert.ok(
    repeatedResults.every((result) => !result.error),
    "both calls of the same request return success"
  );
  assert.deepEqual(
    repeatedResults.map((result) => result.data.idempotent).sort(),
    [false, true],
    "one call commits and the concurrent replay is explicitly idempotent"
  );
  assert.equal(
    new Set(repeatedResults.map((result) => result.data.submissionId)).size,
    1,
    "both calls return the same submission"
  );

  const { count: repeatedCount, error: repeatedCountError } = await admin
    .from("learning_submissions")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", idempotent.assignmentId)
    .eq("student_id", userId);
  failOn(repeatedCountError, "count idempotent submissions");
  assert.equal(repeatedCount, 1, "the idempotent request creates one row");
  const { error: delayedDraftError } = await student.rpc(
    "save_learning_assignment_draft",
    {
      p_assignment_id: idempotent.assignmentId,
      p_answers: { [idempotent.questionId]: "A" },
      p_active_step: 0,
      p_request_id: repeatedRequestId,
    }
  );
  failOn(delayedDraftError, "handle delayed autosave idempotently");
  const { count: delayedDraftCount, error: delayedDraftCountError } =
    await admin
      .from("learning_assignment_drafts")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", idempotent.assignmentId)
      .eq("student_id", userId);
  failOn(delayedDraftCountError, "count delayed drafts");
  assert.equal(
    delayedDraftCount,
    0,
    "a delayed autosave cannot recreate a committed submission draft"
  );
  sql(`
    update public.learning_assignments
    set status = 'closed'
    where id = '${idempotent.assignmentId}';
  `);
  const replayAfterClose = await submit(
    student,
    idempotent,
    repeatedRequestId
  );
  failOn(replayAfterClose.error, "replay submission after assignment close");
  assert.equal(
    replayAfterClose.data.idempotent,
    true,
    "a committed request remains successful after the submission window closes"
  );

  const manual = await createManualAssignment();
  const manualResult = await submit(student, manual, randomUUID());
  failOn(manualResult.error, "submit manual assignment");
  assert.equal(
    manualResult.data.workflowState,
    "objective_graded_pending_manual",
    "writing stays successfully submitted while awaiting manual grading"
  );
  const { data: manualProgress, error: manualProgressError } = await admin
    .from("learning_assignment_progress")
    .select("progress_state,attempts_used")
    .eq("assignment_id", manual.assignmentId)
    .eq("student_id", userId)
    .single();
  failOn(manualProgressError, "read manual assignment progress");
  assert.deepEqual(manualProgress, {
    progress_state: "objective_graded_pending_manual",
    attempts_used: 1,
  });

  const scheduled = await createObjectiveAssignment(1, true);
  const scheduledResult = await submit(student, scheduled, randomUUID());
  failOn(scheduledResult.error, "submit scheduled-release assignment");
  assert.equal(scheduledResult.data.workflowState, "grading_completed");
  const { data: beforeRelease, error: beforeReleaseError } = await admin
    .from("learning_submissions")
    .select("status,submission_state,score,computed_score")
    .eq("assignment_id", scheduled.assignmentId)
    .eq("student_id", userId)
    .single();
  failOn(beforeReleaseError, "read grade before release");
  assert.deepEqual(beforeRelease, {
    status: "submitted",
    submission_state: "grading_completed",
    score: null,
    computed_score: 1,
  });
  sql(`
    update public.learning_assignments
    set grade_release_at = now() - interval '1 minute'
    where id = '${scheduled.assignmentId}';
  `);
  const { error: releaseError } = await student.rpc(
    "release_current_user_due_assignment_grades"
  );
  failOn(releaseError, "release due assignment grade");
  const { data: afterRelease, error: afterReleaseError } = await admin
    .from("learning_submissions")
    .select("status,submission_state,score")
    .eq("assignment_id", scheduled.assignmentId)
    .eq("student_id", userId)
    .single();
  failOn(afterReleaseError, "read grade after release");
  assert.deepEqual(afterRelease, {
    status: "graded",
    submission_state: "grade_released",
    score: 1,
  });

  console.log(
    JSON.stringify({
      maxAttempts: { successes: 2, failures: 1, attempts: [1, 2] },
      idempotency: { successes: 2, rows: 1, replayFlag: true },
      progress,
      manualProgress,
      scheduledRelease: { before: beforeRelease, after: afterRelease },
    })
  );
} finally {
  if (assignmentIds.length > 0) {
    sql(
      `delete from public.learning_assignments where id in (${assignmentIds
        .map((id) => `'${id}'`)
        .join(",")});`
    );
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
