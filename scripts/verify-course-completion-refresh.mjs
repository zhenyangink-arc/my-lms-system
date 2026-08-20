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
const COURSE_ID = "2f79a679-6e25-4cf9-9f71-455905584787";

const ids = {
  tenant: randomUUID(),
  policy: randomUUID(),
  owner: null,
  students: [],
  normalAssignment: randomUUID(),
  normalSubmission: randomUUID(),
  failingAssignment: randomUUID(),
  failingSubmission: randomUUID(),
};

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

function lastJson(output) {
  const line = output
    .split("\n")
    .findLast((candidate) => candidate.trimStart().startsWith("{"));
  assert.ok(line, `SQL 没有返回 JSON：${output}`);
  return JSON.parse(line);
}

const kongConfig = execFileSync(
  "docker",
  ["exec", KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
  { encoding: "utf8" },
);
const jwtKeys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const serviceRoleKey = jwtKeys.find((key) => {
  try {
    return (
      JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"))
        .role === "service_role"
    );
  } catch {
    return false;
  }
});
assert.ok(serviceRoleKey, "无法从本地 Kong 配置读取 service_role key");

const admin = createClient(LOCAL_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const createdUsers = [];

async function createUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `completion-refresh-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`,
    password: `Local-${randomUUID()}-Aa1!`,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !data.user) throw error ?? new Error(`无法创建${label}`);
  createdUsers.push(data.user.id);
  return data.user.id;
}

try {
  ids.owner = await createUser("批量刷新验收负责人");
  ids.students = await Promise.all([
    createUser("批量刷新学生一"),
    createUser("批量刷新学生二"),
    createUser("批量刷新学生三"),
  ]);
  const [studentOne, studentTwo] = ids.students;
  const studentArray = ids.students.map((id) => `'${id}'::uuid`).join(",");

  runSql(`
    begin;
    update public.profiles
    set global_role = 'platform_owner', role = 'platform_super_admin', status = 'active'
    where id = '${ids.owner}'::uuid;
    update public.profiles set role = 'student', status = 'active'
    where id = any(array[${studentArray}]);
    insert into public.tenants (id, slug, name, status, created_by)
    values (
      '${ids.tenant}', 'completion-refresh-${Date.now()}',
      '结课刷新编排验收机构', 'active', '${ids.owner}'::uuid
    );
    insert into public.tenant_student_apps (tenant_id, app_id, is_enabled, status)
    values ('${ids.tenant}', '${APP_ID}', true, 'active')
    on conflict (tenant_id, app_id) do update
      set is_enabled = true, status = 'active';
    set local session_replication_role = replica;
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values (
      '${ids.tenant}', '${ids.owner}', 'ceo', 'active', 'vip3', true, now()
    );
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) select '${ids.tenant}', student_id, 'student', 'active', 'vip2', true, now()
      from unnest(array[${studentArray}]) as student_id;
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, starts_at, enrolled_by
    ) select '${ids.tenant}', student_id, '${APP_ID}', 'active',
        now() - interval '1 day', '${ids.owner}'
      from unnest(array[${studentArray}]) as student_id;
    set local session_replication_role = origin;
    select set_config('request.jwt.claim.sub', '${ids.owner}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, effective_from, requirements, created_by
    ) values (
      '${ids.policy}', '${APP_ID}', '${COURSE_ID}',
      'K1-COMP-REFRESH-${ids.policy.slice(0, 8).toUpperCase()}', 1,
      '韩国语一级刷新编排验收政策', 'published', true,
      now() - interval '1 minute',
      '{
        "textbook":{"required_chapter_count":16,"require_all_mandatory_chapters":true},
        "required_assignments":{"require_all_assigned":true,"require_submitted":true,"require_graded":true},
        "formal_chapter_exams":{"minimum_completed_count":1,"minimum_passed_count":1,"passing_score":60},
        "stage_exams":{"required_count":4,"require_published_grades":true},
        "midterm_exam":{"require_published_grade":true,"passing_score":60},
        "final_exam":{"require_published_grade":true,"passing_score":60},
        "subjective_grading":{"require_all_certification_items_graded":true},
        "overall_score":{"minimum_score":60},
        "blocking_gaps":{"maximum_allowed_count":0}
      }'::jsonb,
      '${ids.owner}'
    );
    commit;
  `);

  const policyBatch = lastJson(runSql(`
    select set_config('request.jwt.claim.role', 'service_role', false);
    select coalesce(jsonb_agg(row_to_json(processed)), '[]'::jsonb)
    from public.process_course_completion_refresh_tasks(25) as processed;
    select jsonb_build_object(
      'task', (select jsonb_build_object(
        'id', id, 'status', status, 'targets', target_count,
        'succeeded', succeeded_count, 'failed', failed_count
      ) from public.course_completion_refresh_tasks
      where policy_id = '${ids.policy}'),
      'evaluationCount', (select count(*)
        from public.student_course_completion_evaluations
        where policy_id = '${ids.policy}' and status <> 'superseded')
    );
  `));
  assert.equal(policyBatch.task.status, "succeeded");
  assert.equal(policyBatch.task.targets, 3);
  assert.equal(policyBatch.task.succeeded, 3);
  assert.equal(policyBatch.evaluationCount, 3);

  const beforeChapter = lastJson(runSql(`
    select jsonb_build_object('id', id, 'completed',
      evidence_snapshot #>> '{textbook,completedChapterCount}')
    from public.student_course_completion_evaluations
    where student_id = '${studentOne}' and policy_id = '${ids.policy}'
      and status <> 'superseded';
  `));
  runSql(`
    insert into public.course_ebook_progress (
      tenant_id, student_id, student_app_id, test_slug, current_page,
      total_pages, progress_percent, reading_seconds, completion_source
    ) values (
      '${ids.tenant}', '${studentOne}', '${APP_ID}', 'korean-level-one-01',
      0, 10, 0, 0, 'ebook'
    );
    update public.course_ebook_progress
    set completion_source = 'smart_textbook', updated_at = now()
    where tenant_id = '${ids.tenant}' and student_id = '${studentOne}'
      and test_slug = 'korean-level-one-01';
  `);
  const afterChapter = lastJson(runSql(`
    select jsonb_build_object('id', id, 'completed',
      evidence_snapshot #>> '{textbook,completedChapterCount}')
    from public.student_course_completion_evaluations
    where student_id = '${studentOne}' and policy_id = '${ids.policy}'
      and status <> 'superseded';
  `));
  assert.notEqual(afterChapter.id, beforeChapter.id);
  assert.equal(afterChapter.completed, "1");

  runSql(`
    insert into public.learning_assignments (
      id, tenant_id, student_app_id, title, description, assignment_type,
      course_id, target_scope, total_points, starts_at, due_at, status,
      published_at, created_by, updated_by, source_paper_code,
      source_paper_version
    ) values
      ('${ids.normalAssignment}', '${ids.tenant}', '${APP_ID}',
       '刷新验收必修作业', '', 'homework', '${COURSE_ID}', 'all_students',
       100, now()-interval '1 day', now()+interval '1 day', 'published', now(),
       '${ids.owner}', '${ids.owner}', 'HW-K1-REFRESH-V1', 1),
      ('${ids.failingAssignment}', '${ids.tenant}', '${APP_ID}',
       '刷新失败隔离作业', '', 'homework', '${COURSE_ID}', 'all_students',
       100, now()-interval '1 day', now()+interval '1 day', 'published', now(),
       '${ids.owner}', '${ids.owner}', 'HW-K1-REFRESH-FAIL-V1', 1);
    insert into public.learning_submissions (
      id, tenant_id, assignment_id, student_id, attempt_number, status,
      computed_score, submitted_at, graded_at, submission_state,
      objective_graded_at, grading_completed_at, request_id,
      request_payload_hash
    ) values
      ('${ids.normalSubmission}', '${ids.tenant}', '${ids.normalAssignment}',
       '${studentOne}', 1, 'submitted', 88, now(), now(), 'grading_completed',
       now(), now(), gen_random_uuid(), 'completion-refresh-normal'),
      ('${ids.failingSubmission}', '${ids.tenant}', '${ids.failingAssignment}',
       '${studentTwo}', 1, 'submitted', 77, now(), now(), 'grading_completed',
       now(), now(), gen_random_uuid(), 'completion-refresh-failure');
  `);

  const beforeGradeId = afterChapter.id;
  runSql(`
    select set_config('request.jwt.claim.sub', '${ids.owner}', false);
    select set_config('request.jwt.claim.role', 'authenticated', false);
    select public.release_learning_submission_grade('${ids.normalSubmission}');
  `);
  const afterGrade = lastJson(runSql(`
    select jsonb_build_object(
      'evaluationId', evaluation.id,
      'submissionState', submission.submission_state,
      'releasedAt', submission.grade_released_at is not null
    )
    from public.learning_submissions as submission
    cross join lateral (
      select id from public.student_course_completion_evaluations
      where student_id = '${studentOne}' and policy_id = '${ids.policy}'
        and status <> 'superseded'
      limit 1
    ) as evaluation
    where submission.id = '${ids.normalSubmission}';
  `));
  assert.equal(afterGrade.submissionState, "grade_released");
  assert.equal(afterGrade.releasedAt, true);
  assert.notEqual(afterGrade.evaluationId, beforeGradeId);

  const failureIsolation = lastJson(runSql(`
    begin;
    create or replace function private.verifier_reject_completion_evaluation()
    returns trigger language plpgsql set search_path = '' as $$
    begin
      raise exception 'verifier forced completion refresh failure';
    end;
    $$;
    create trigger verifier_reject_completion_evaluation
    before insert on public.student_course_completion_evaluations
    for each row execute function private.verifier_reject_completion_evaluation();
    select set_config('request.jwt.claim.sub', '${ids.owner}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    select public.release_learning_submission_grade('${ids.failingSubmission}');
    select jsonb_build_object(
      'submissionState', (select submission_state
        from public.learning_submissions where id = '${ids.failingSubmission}'),
      'releasedAt', (select grade_released_at is not null
        from public.learning_submissions where id = '${ids.failingSubmission}'),
      'retryTask', (select jsonb_build_object(
        'id', id, 'status', status, 'lastError', last_error
      ) from public.course_completion_refresh_tasks
        where task_kind = 'event_retry' and student_id = '${studentTwo}'
        order by created_at desc limit 1)
    );
    drop trigger verifier_reject_completion_evaluation
      on public.student_course_completion_evaluations;
    drop function private.verifier_reject_completion_evaluation();
    commit;
  `));
  assert.equal(failureIsolation.submissionState, "grade_released");
  assert.equal(failureIsolation.releasedAt, true);
  assert.equal(failureIsolation.retryTask.status, "pending");
  assert.match(failureIsolation.retryTask.lastError, /verifier forced/);

  const retryResult = lastJson(runSql(`
    select set_config('request.jwt.claim.role', 'service_role', false);
    select coalesce(jsonb_agg(row_to_json(processed)), '[]'::jsonb) as processed
    from public.process_course_completion_refresh_tasks(25) as processed;
    select jsonb_build_object(
      'status', status, 'targets', target_count,
      'succeeded', succeeded_count, 'failed', failed_count
    ) from public.course_completion_refresh_tasks
    where id = '${failureIsolation.retryTask.id}';
  `));
  assert.equal(retryResult.status, "succeeded");
  assert.equal(retryResult.targets, 1);
  assert.equal(retryResult.succeeded, 1);

  const manualTaskIds = lastJson(runSql(`
    select set_config('request.jwt.claim.sub', '${ids.owner}', false);
    select set_config('request.jwt.claim.role', 'authenticated', false);
    select jsonb_build_object(
      'first', public.request_institution_course_completion_refresh(
        '${COURSE_ID}', '${studentOne}'
      ),
      'second', public.request_institution_course_completion_refresh(
        '${COURSE_ID}', '${studentOne}'
      )
    );
  `));

  const concurrentCalls = await Promise.all([
    admin.rpc("process_course_completion_refresh_tasks", { p_limit: 1 }),
    admin.rpc("process_course_completion_refresh_tasks", { p_limit: 1 }),
  ]);
  for (const result of concurrentCalls) {
    assert.equal(result.error, null, result.error?.message);
    assert.equal(result.data?.length, 1);
  }

  const concurrency = lastJson(runSql(`
    select jsonb_build_object(
      'taskStatuses', (select jsonb_agg(status order by id)
        from public.course_completion_refresh_tasks
        where id in ('${manualTaskIds.first}', '${manualTaskIds.second}')),
      'resultEvaluationIds', (select jsonb_agg(evaluation_id order by task_id)
        from public.course_completion_refresh_task_results
        where task_id in ('${manualTaskIds.first}', '${manualTaskIds.second}')),
      'activeEvaluationCount', (select count(*)
        from public.student_course_completion_evaluations
        where student_id = '${studentOne}' and policy_id = '${ids.policy}'
          and status <> 'superseded'),
      'duplicateFingerprintCount', (select count(*)
        from (
          select evaluation_fingerprint
          from public.student_course_completion_evaluations
          where student_id = '${studentOne}' and policy_id = '${ids.policy}'
          group by evaluation_fingerprint having count(*) > 1
        ) duplicates),
      'processorHasLoop', position(' loop ' in lower(
        pg_get_functiondef(
          'public.process_course_completion_refresh_tasks(integer)'::regprocedure
        )
      )) > 0,
      'processorUsesSetQuery', position('cross join lateral' in lower(
        pg_get_functiondef(
          'public.process_course_completion_refresh_tasks(integer)'::regprocedure
        )
      )) > 0
    );
  `));
  assert.deepEqual(concurrency.taskStatuses, ["succeeded", "succeeded"]);
  assert.equal(new Set(concurrency.resultEvaluationIds).size, 1);
  assert.equal(concurrency.activeEvaluationCount, 1);
  assert.equal(concurrency.duplicateFingerprintCount, 0);
  assert.equal(concurrency.processorHasLoop, false);
  assert.equal(concurrency.processorUsesSetQuery, true);

  process.stdout.write(
    `${JSON.stringify(
      {
        policyPublicationBatch: policyBatch,
        chapterCompletion: { before: beforeChapter, after: afterChapter },
        gradeRelease: afterGrade,
        failureIsolation,
        retryResult,
        concurrency,
        batchExecutionEvidence: {
          processRpcCallsForThreeStudents: 1,
          targetCount: policyBatch.task.targets,
          implementation: "set query + CROSS JOIN LATERAL; no student LOOP",
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  try {
    runSql(`
      begin;
      set local session_replication_role = replica;
      do $$
      declare
        tenant_table record;
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
          execute format(
            'delete from public.%I where tenant_id = $1',
            tenant_table.table_name
          ) using '${ids.tenant}'::uuid;
        end loop;
      end;
      $$;
      delete from public.course_completion_refresh_tasks
      where policy_id = '${ids.policy}'::uuid;
      delete from public.tenants where id = '${ids.tenant}'::uuid;
      delete from public.course_completion_policies where id = '${ids.policy}'::uuid;
      set local session_replication_role = origin;
      commit;
    `);
  } catch (error) {
    process.stderr.write(`清理 Packet8 数据库数据失败：${error.message}\n`);
  }
  await Promise.all(
    createdUsers.map(async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) process.stderr.write(`清理测试账号 ${id} 失败：${error.message}\n`);
    }),
  );
}
