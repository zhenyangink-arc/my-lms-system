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
  partial: null,
  pending: null,
  eligible: null,
  retake: null,
  homework: randomUUID(),
  formal: randomUUID(),
  stage1: randomUUID(),
  stage2: randomUUID(),
  stage3: randomUUID(),
  stage4: randomUUID(),
  midterm: randomUUID(),
  final: randomUUID(),
  manualQuestion: randomUUID(),
  overallItem: randomUUID(),
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
    email: `completion-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`,
    password: `Local-${randomUUID()}-Aa1!`,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !data.user) throw error ?? new Error(`无法创建${label}`);
  createdUsers.push(data.user.id);
  return data.user.id;
}

try {
  ids.owner = await createUser("资格计算验收负责人");
  ids.partial = await createUser("部分完成学生");
  ids.pending = await createUser("成绩未发布学生");
  ids.eligible = await createUser("全部达标学生");
  ids.retake = await createUser("补考达标学生");

  const students = [ids.partial, ids.pending, ids.eligible, ids.retake];
  const released = (assignmentId, studentId, attempt, score, submitted) => `
    insert into public.learning_submissions (
      tenant_id, assignment_id, student_id, attempt_number, status, score,
      submitted_at, graded_at, submission_state, objective_graded_at,
      grading_completed_at, grade_released_at, request_id, request_payload_hash
    ) values (
      '${ids.tenant}'::uuid, '${assignmentId}'::uuid, '${studentId}'::uuid,
      ${attempt}, 'graded', ${score}, ${submitted}, now(), 'grade_released',
      now(), now(), now(), gen_random_uuid(), 'completion-verifier'
    );`;
  const releasedFor = (studentId) => [
    released(ids.homework, studentId, 1, 80, "now() - interval '8 days'"),
    released(ids.formal, studentId, 1, 78, "now() - interval '8 days'"),
    released(ids.stage1, studentId, 1, 80, "now() - interval '8 days'"),
    released(ids.stage2, studentId, 1, 81, "now() - interval '8 days'"),
    released(ids.stage3, studentId, 1, 82, "now() - interval '8 days'"),
    released(ids.stage4, studentId, 1, 83, "now() - interval '8 days'"),
    released(ids.final, studentId, 1, 84, "now() - interval '8 days'"),
  ].join("\n");

  const output = runSql(`
    begin;
    update public.profiles
    set global_role = 'platform_owner', role = 'platform_super_admin', status = 'active'
    where id = '${ids.owner}'::uuid;
    update public.profiles set role = 'student', status = 'active'
    where id = any(array[${students.map((id) => `'${id}'::uuid`).join(",")}]);
    select set_config('request.jwt.claim.sub', '${ids.owner}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);

    insert into public.tenants (id, slug, name, status, created_by)
    values (
      '${ids.tenant}'::uuid, 'completion-${Date.now()}',
      '结课资格计算验收机构', 'active', '${ids.owner}'::uuid
    );
    insert into public.tenant_student_apps (tenant_id, app_id, is_enabled, status)
    values ('${ids.tenant}'::uuid, '${APP_ID}'::uuid, true, 'active')
    on conflict (tenant_id, app_id) do update
      set is_enabled = true, status = 'active';
    set local session_replication_role = replica;
    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, is_default, joined_at
    ) select '${ids.tenant}'::uuid, student_id, 'student', 'active', true, now()
      from unnest(array[${students.map((id) => `'${id}'::uuid`).join(",")}]) student_id;
    insert into public.student_app_enrollments (
      tenant_id, student_id, app_id, status, starts_at, enrolled_by
    ) select '${ids.tenant}'::uuid, student_id, '${APP_ID}'::uuid,
        'active', now() - interval '1 day', '${ids.owner}'::uuid
      from unnest(array[${students.map((id) => `'${id}'::uuid`).join(",")}]) student_id;
    set local session_replication_role = origin;

    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, effective_from, requirements, created_by
    ) values (
      '${ids.policy}'::uuid, '${APP_ID}'::uuid, '${COURSE_ID}'::uuid,
      'K1-COMP-VERIFY', 1, '韩国语一级结课验收政策', 'published', true,
      now() - interval '1 day',
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
      '${ids.owner}'::uuid
    );

    insert into public.learning_assignments (
      id, tenant_id, student_app_id, title, description, assignment_type,
      course_id, target_scope, total_points, starts_at, due_at, status,
      published_at, created_by, updated_by, source_paper_id, source_paper_code,
      source_paper_version
    ) values
      ('${ids.homework}', '${ids.tenant}', '${APP_ID}', '第一章必修作业', '', 'homework',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='HW-K1-01-V1'), 'HW-K1-01-V1', 1),
      ('${ids.formal}', '${ids.tenant}', '${APP_ID}', '第一章正式考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-01-V1'), 'EX-K1-01-V1', 1),
      ('${ids.stage1}', '${ids.tenant}', '${APP_ID}', '第一阶段考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-ST01-V1'), 'EX-K1-ST01-V1', 1),
      ('${ids.stage2}', '${ids.tenant}', '${APP_ID}', '第二阶段考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-ST02-V1'), 'EX-K1-ST02-V1', 1),
      ('${ids.stage3}', '${ids.tenant}', '${APP_ID}', '第三阶段考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-ST03-V1'), 'EX-K1-ST03-V1', 1),
      ('${ids.stage4}', '${ids.tenant}', '${APP_ID}', '第四阶段考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-ST04-V1'), 'EX-K1-ST04-V1', 1),
      ('${ids.final}', '${ids.tenant}', '${APP_ID}', '韩国语一级期末考试', '', 'exam',
       '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()+interval '5 days',
       'published', now(), '${ids.owner}', '${ids.owner}',
       (select id from public.assessment_papers where paper_code='EX-K1-FIN-V1'), 'EX-K1-FIN-V1', 1);

    insert into public.learning_assignments (
      id, tenant_id, student_app_id, title, description, assignment_type,
      course_id, target_scope, total_points, starts_at, due_at, status,
      published_at, created_by, updated_by, source_paper_id, source_paper_code,
      source_paper_version, retake_paper_id, retake_starts_at, retake_due_at,
      retake_score_policy
    ) values (
      '${ids.midterm}', '${ids.tenant}', '${APP_ID}', '韩国语一级期中考试', '', 'exam',
      '${COURSE_ID}', 'all_students', 100, now()-interval '20 days', now()-interval '10 days',
      'published', now(), '${ids.owner}', '${ids.owner}',
      (select id from public.assessment_papers where paper_code='EX-K1-MID-V1'), 'EX-K1-MID-V1', 1,
      (select id from public.assessment_papers where paper_code='EX-K1-MID-V1'),
      now()-interval '5 days', now()+interval '5 days', 'highest'
    );
    insert into public.learning_assignment_retake_students (
      tenant_id, assignment_id, student_id
    ) values ('${ids.tenant}', '${ids.midterm}', '${ids.retake}');
    insert into public.learning_assignment_questions (
      id, tenant_id, assignment_id, question_type, language_skill,
      prompt, points, sort_order, auto_graded
    ) values (
      '${ids.manualQuestion}', '${ids.tenant}', '${ids.midterm}',
      'long_text', 'writing', '请完成写作题', 100, 0, false
    );

    insert into public.course_ebook_progress (
      tenant_id, student_id, student_app_id, test_slug, current_page,
      total_pages, progress_percent, completed_at, completion_source
    )
    select '${ids.tenant}', student_id, '${APP_ID}',
      'korean-level-one-' || lpad(chapter_number::text, 2, '0'),
      10, 10, 100, now(), 'smart_textbook'
    from unnest(array['${ids.pending}'::uuid,'${ids.eligible}'::uuid,'${ids.retake}'::uuid]) student_id
    cross join generate_series(1,16) chapter_number;
    insert into public.course_ebook_progress (
      tenant_id, student_id, student_app_id, test_slug, current_page,
      total_pages, progress_percent, completed_at, completion_source
    ) select '${ids.tenant}', '${ids.partial}', '${APP_ID}',
      'korean-level-one-' || lpad(chapter_number::text, 2, '0'),
      10, 10, 100, now(), 'smart_textbook'
    from generate_series(1,5) chapter_number;
    -- Even completed progress rows for isolated assessment snapshots must not
    -- count as real textbook completion.
    insert into public.course_ebook_progress (
      tenant_id, student_id, student_app_id, test_slug, current_page,
      total_pages, progress_percent, completed_at, completion_source
    ) select '${ids.tenant}', '${ids.partial}', '${APP_ID}',
      'korean-level-one-' || lpad(chapter_number::text, 2, '0')
        || '-assessment-seed-source-v1',
      10, 10, 100, now(), 'smart_textbook'
    from generate_series(1,16) chapter_number;

    ${releasedFor(ids.pending)}
    ${releasedFor(ids.eligible)}
    ${releasedFor(ids.retake)}
    ${released(ids.midterm, ids.eligible, 1, 85, "now() - interval '8 days'")}
    ${released(ids.midterm, ids.retake, 1, 50, "now() - interval '8 days'")}
    ${released(ids.midterm, ids.retake, 2, 75, "now() - interval '2 days'")}
    insert into public.learning_submissions (
      tenant_id, assignment_id, student_id, attempt_number, status,
      submitted_at, submission_state, objective_graded_at,
      request_id, request_payload_hash
    ) values (
      '${ids.tenant}', '${ids.midterm}', '${ids.pending}', 1, 'submitted',
      now()-interval '8 days', 'objective_graded_pending_manual', now(),
      gen_random_uuid(), 'completion-verifier-pending-midterm'
    );
    insert into public.learning_submissions (
      tenant_id, assignment_id, student_id, attempt_number, status,
      submitted_at, submission_state, request_id, request_payload_hash
    ) values (
      '${ids.tenant}', '${ids.homework}', '${ids.partial}', 1, 'submitted',
      now()-interval '1 day', 'submitted_pending_grading', gen_random_uuid(),
      'completion-verifier-pending-homework'
    );

    insert into public.grade_items (
      id, tenant_id, title, item_type, total_points, source_assignment_id,
      status, published_at, created_by, updated_by
    ) values (
      '${ids.overallItem}', '${ids.tenant}', '韩国语一级综合成绩', 'final', 100,
      '${ids.final}', 'published', now(), '${ids.owner}', '${ids.owner}'
    );
    insert into public.grade_records (
      tenant_id, item_id, student_id, record_status, score, graded_by
    ) select '${ids.tenant}', '${ids.overallItem}', student_id, 'graded',
        case when student_id='${ids.partial}'::uuid then 50 else 80 end,
        '${ids.owner}'
      from unnest(array[${students.map((id) => `'${id}'::uuid`).join(",")}]) student_id;

    do $$
    declare
      partial_eval public.student_course_completion_evaluations;
      pending_eval public.student_course_completion_evaluations;
      eligible_eval public.student_course_completion_evaluations;
      eligible_again public.student_course_completion_evaluations;
      retake_eval public.student_course_completion_evaluations;
    begin
      partial_eval := public.evaluate_student_course_completion(
        '${ids.partial}', '${COURSE_ID}', '${ids.policy}'
      );
      pending_eval := public.evaluate_student_course_completion(
        '${ids.pending}', '${COURSE_ID}', '${ids.policy}'
      );
      eligible_eval := public.evaluate_student_course_completion(
        '${ids.eligible}', '${COURSE_ID}', '${ids.policy}'
      );
      eligible_again := public.evaluate_student_course_completion(
        '${ids.eligible}', '${COURSE_ID}'
      );
      retake_eval := public.evaluate_student_course_completion(
        '${ids.retake}', '${COURSE_ID}', '${ids.policy}'
      );

      if partial_eval.status <> 'pending_grading'
        or not (partial_eval.missing_requirements @> jsonb_build_array(
          jsonb_build_object(
            'category', 'assignment',
            'status', 'pending_grading',
            'sourceId', '${ids.homework}'
          )
        )) then
        raise exception '部分完成学生缺口不准确：%', row_to_json(partial_eval);
      end if;
      if partial_eval.evidence_snapshot #>> '{textbook,completedChapterCount}' <> '5'
        or exists (
          select 1
          from jsonb_array_elements(
            partial_eval.evidence_snapshot #> '{textbook,chapters}'
          ) as chapter
          where chapter ->> 'testSlug' like '%-assessment-seed-source-v1'
        ) then
        raise exception '隔离测评快照污染了未完成学生的教材进度：%',
          partial_eval.evidence_snapshot -> 'textbook';
      end if;
      if pending_eval.status <> 'pending_grading'
        or pending_eval.evidence_snapshot #>> '{midtermExam,score}' is not null
        or not (pending_eval.missing_requirements @>
          '[{"key":"manual-grading:midterm","status":"pending_grading"}]'::jsonb) then
        raise exception '未发布成绩被误计或状态错误：%', row_to_json(pending_eval);
      end if;
      if not eligible_eval.eligible or eligible_eval.status <> 'eligible'
        or jsonb_array_length(eligible_eval.missing_requirements) <> 0 then
        raise exception '全部达标学生未通过：%', row_to_json(eligible_eval);
      end if;
      if eligible_eval.evidence_snapshot #>> '{textbook,completedChapterCount}' <> '16'
        or exists (
          select 1
          from jsonb_array_elements(
            eligible_eval.evidence_snapshot #> '{textbook,chapters}'
          ) as chapter
          where chapter ->> 'testSlug' like '%-assessment-seed-source-v1'
        ) then
        raise exception '全部达标学生的教材证据来源不准确：%',
          eligible_eval.evidence_snapshot -> 'textbook';
      end if;
      if eligible_eval.id <> eligible_again.id or (
        select count(*) from public.student_course_completion_evaluations
        where student_id='${ids.eligible}' and policy_id='${ids.policy}'
          and status <> 'superseded'
      ) <> 1 then
        raise exception '相同输入重复计算没有保持幂等';
      end if;
      if not retake_eval.eligible
        or retake_eval.evidence_snapshot #>> '{midtermExam,score}' <> '75.000'
        or retake_eval.evidence_snapshot #>> '{midtermExam,retake,policy}' <> 'highest' then
        raise exception '补考最高分策略错误：%', row_to_json(retake_eval);
      end if;
      if exists (
        select 1 from jsonb_array_elements(partial_eval.missing_requirements) gap
        where not (gap ->> 'href' like '/dashboard%')
          or char_length(gap ->> 'reason') < 2
      ) then
        raise exception '缺口 href 或 reason 无效';
      end if;

      begin
        insert into public.student_course_completion_evaluations (
          tenant_id, student_id, student_app_id, course_id, policy_id,
          policy_version, status, eligible, requirements_snapshot,
          evidence_snapshot, missing_requirements, evaluation_version,
          evaluation_fingerprint
        ) values (
          '${ids.tenant}', '${ids.partial}', '${APP_ID}', '${COURSE_ID}', '${ids.policy}',
          1, 'not_eligible', false, '{}'::jsonb,
          '{"midtermExam":{"gradeReleased":false,"score":99}}'::jsonb,
          '[]'::jsonb, 'malicious-test', md5('malicious-test')
        );
        raise exception '数据库允许未发布分数进入资格证据';
      exception when check_violation then
        null;
      end;
    end $$;

    select jsonb_build_object(
      'partial', (select jsonb_build_object(
        'status', status, 'textbook', evidence_snapshot -> 'textbook',
        'gaps', missing_requirements
      ) from public.student_course_completion_evaluations
        where student_id='${ids.partial}' and status <> 'superseded'),
      'pending', (select jsonb_build_object(
        'status', status, 'midterm', evidence_snapshot -> 'midtermExam',
        'gaps', missing_requirements
      ) from public.student_course_completion_evaluations
        where student_id='${ids.pending}' and status <> 'superseded'),
      'eligible', (select jsonb_build_object(
        'id', id, 'status', status, 'eligible', eligible,
        'textbook', evidence_snapshot -> 'textbook'
      ) from public.student_course_completion_evaluations
        where student_id='${ids.eligible}' and status <> 'superseded'),
      'retake', (select jsonb_build_object(
        'status', status, 'midterm', evidence_snapshot -> 'midtermExam'
      ) from public.student_course_completion_evaluations
        where student_id='${ids.retake}' and status <> 'superseded'),
      'evaluationCount', (select count(*)
        from public.student_course_completion_evaluations
        where policy_id='${ids.policy}' and status <> 'superseded'),
      'eligibleEvaluationCount', (select count(*)
        from public.student_course_completion_evaluations
        where policy_id='${ids.policy}' and student_id='${ids.eligible}'
          and status <> 'superseded'),
      'authenticatedCanExecute', has_function_privilege(
        'authenticated',
        'public.evaluate_student_course_completion(uuid,uuid,uuid)',
        'execute'
      )
    );
    rollback;
  `);

  const evidenceLine = output
    .split("\n")
    .findLast((line) => line.trimStart().startsWith("{"));
  assert.ok(evidenceLine, "验收 SQL 没有返回证据 JSON");
  const evidence = JSON.parse(evidenceLine);
  assert.equal(evidence.pending.status, "pending_grading");
  assert.equal(evidence.pending.midterm.score, undefined);
  assert.equal(evidence.partial.textbook.completedChapterCount, 5);
  assert.equal(evidence.partial.textbook.chapters.length, 16);
  assert.ok(
    evidence.partial.textbook.chapters.every(
      (chapter) => !chapter.testSlug.endsWith("-assessment-seed-source-v1"),
    ),
  );
  assert.equal(evidence.eligible.status, "eligible");
  assert.equal(evidence.eligible.eligible, true);
  assert.equal(evidence.eligible.textbook.completedChapterCount, 16);
  assert.equal(evidence.retake.midterm.score, 75);
  assert.equal(evidence.retake.midterm.retake.policy, "highest");
  assert.equal(evidence.evaluationCount, 4);
  assert.equal(evidence.eligibleEvaluationCount, 1);
  assert.equal(evidence.authenticatedCanExecute, false);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await Promise.all(
    createdUsers.map(async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) process.stderr.write(`清理测试账号 ${sqlLiteral(id)} 失败：${error.message}\n`);
    }),
  );
}
