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
const password = `Local-${randomUUID()}-Aa1!`;
const fixture = {
  tenantA: randomUUID(),
  tenantB: randomUUID(),
  policy: randomUUID(),
  eligibleA: Array.from({ length: 4 }, () => randomUUID()),
  eligibleB: randomUUID(),
  notEligible: randomUUID(),
  pending: randomUUID(),
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

function expectSqlFailure(sql, pattern, label) {
  let failure;
  try {
    runSql(sql);
  } catch (error) {
    failure = `${error.stderr ?? ""}${error.stdout ?? ""}${error.message ?? ""}`;
  }
  assert.ok(failure, `${label}: SQL unexpectedly succeeded`);
  assert.match(failure, pattern, label);
  return failure.match(pattern)?.[0] ?? label;
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

async function createAccount(label, role, globalRole = "member") {
  const email = `certificate-${role}-${Date.now()}-${randomUUID().slice(0, 8)}@local.test`;
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
    set role = '${sqlLiteral(role)}',
        global_role = '${sqlLiteral(globalRole)}',
        full_name = '${sqlLiteral(label)}',
        status = 'active'
    where id = '${data.user.id}'::uuid;
  `);
  return { id: data.user.id, email, role, label };
}

async function signIn(account) {
  const client = createClient(LOCAL_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: account.email,
    password,
  });
  failOn(error, `${account.label}登录`);
  return client;
}

function expectRpcError(result, pattern, label) {
  assert.ok(result.error, `${label}: RPC unexpectedly succeeded`);
  assert.match(result.error.message, pattern, label);
  return result.error.message;
}

const accounts = {};
let originalCourseTitle;

try {
  originalCourseTitle = runSql(`
    select title from public.courses where id = '${COURSE_ID}'::uuid;
  `);
  assert.ok(originalCourseTitle, "验收课程不存在");

  accounts.ownerA = await createAccount("证书验收机构A负责人", "ceo");
  accounts.ownerB = await createAccount("证书验收机构B负责人", "ceo");
  accounts.teacherA = await createAccount("证书验收机构A老师", "teacher");
  accounts.platform = await createAccount(
    "证书验收平台负责人",
    "platform_super_admin",
    "platform_owner",
  );
  accounts.students = [];
  for (let index = 0; index < 5; index += 1) {
    accounts.students.push(
      await createAccount(`证书验收学生${index + 1}`, "student"),
    );
  }

  const studentsA = accounts.students.slice(0, 4);
  const studentB = accounts.students[4];
  const tenantSlugSuffix = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const requirements = {
    textbook: {
      required_chapter_count: 1,
      require_all_mandatory_chapters: true,
    },
    required_assignments: {
      require_all_assigned: true,
      require_submitted: true,
      require_graded: true,
    },
    formal_chapter_exams: {
      minimum_completed_count: 1,
      minimum_passed_count: 1,
      passing_score: 60,
    },
    stage_exams: { required_count: 0, require_published_grades: true },
    midterm_exam: { require_published_grade: true, passing_score: 60 },
    final_exam: { require_published_grade: true, passing_score: 60 },
    subjective_grading: { require_all_certification_items_graded: true },
    overall_score: { minimum_score: 60 },
    blocking_gaps: { maximum_allowed_count: 0 },
  };

  runSql(`
    begin;
    insert into public.tenants (id, slug, name, status, created_by) values
      ('${fixture.tenantA}', 'certificate-a-${tenantSlugSuffix}', '证书验收机构A', 'active', '${accounts.ownerA.id}'),
      ('${fixture.tenantB}', 'certificate-b-${tenantSlugSuffix}', '证书验收机构B', 'active', '${accounts.ownerB.id}');

    insert into public.tenant_memberships (
      tenant_id, user_id, role, status, membership_tier, is_default, joined_at
    ) values
      ('${fixture.tenantA}', '${accounts.ownerA.id}', 'ceo', 'active', 'normal', true, now()),
      ('${fixture.tenantA}', '${accounts.teacherA.id}', 'teacher', 'active', 'normal', true, now()),
      ${studentsA
        .map(
          (student) =>
            `('${fixture.tenantA}', '${student.id}', 'student', 'active', 'normal', true, now())`,
        )
        .join(",\n      ")},
      ('${fixture.tenantB}', '${accounts.ownerB.id}', 'ceo', 'active', 'normal', true, now()),
      ('${fixture.tenantB}', '${studentB.id}', 'student', 'active', 'normal', true, now());

    select set_config('request.jwt.claim.sub', '${accounts.platform.id}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);
    insert into public.course_completion_policies (
      id, student_app_id, course_id, policy_code, version, title, status,
      is_default, effective_from, requirements, created_by
    ) values (
      '${fixture.policy}', '${APP_ID}', '${COURSE_ID}',
      'CERT-VERIFY-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}',
      1, '证书本体验收政策', 'published', false, now() - interval '1 minute',
      '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
      '${accounts.platform.id}'
    );

    insert into public.student_course_completion_evaluations (
      id, tenant_id, student_id, student_app_id, course_id,
      policy_id, policy_version, status, eligible, overall_score,
      requirements_snapshot, evidence_snapshot, missing_requirements,
      evaluated_at, evaluation_version, evaluation_fingerprint
    ) values
      ${studentsA
        .map(
          (student, index) => `(
            '${fixture.eligibleA[index]}', '${fixture.tenantA}', '${student.id}',
            '${APP_ID}', '${COURSE_ID}', '${fixture.policy}', 1,
            'eligible', true, ${80 + index},
            '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
            jsonb_build_object('fixture', true, 'studentIndex', ${index + 1}),
            '[]'::jsonb, now(), 'packet9-verifier-v1',
            md5('${fixture.eligibleA[index]}')
          )`)
        .join(",\n      ")},
      (
        '${fixture.eligibleB}', '${fixture.tenantB}', '${studentB.id}',
        '${APP_ID}', '${COURSE_ID}', '${fixture.policy}', 1,
        'eligible', true, 88,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '{"fixture":true,"tenant":"B"}'::jsonb,
        '[]'::jsonb, now(), 'packet9-verifier-v1', md5('${fixture.eligibleB}')
      ),
      (
        '${fixture.notEligible}', '${fixture.tenantA}', '${studentsA[0].id}',
        '${APP_ID}', '${COURSE_ID}', '${fixture.policy}', 1,
        'not_eligible', false, 40,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '{"fixture":true,"result":"not_eligible"}'::jsonb,
        '[{"key":"overall","category":"overall_score","title":"综合成绩","status":"failed","href":"/dashboard/apps/korean/grades","reason":"综合成绩未达到结课标准"}]'::jsonb,
        now(), 'packet9-verifier-v1', md5('${fixture.notEligible}')
      ),
      (
        '${fixture.pending}', '${fixture.tenantA}', '${studentsA[0].id}',
        '${APP_ID}', '${COURSE_ID}', '${fixture.policy}', 1,
        'pending_grading', false, null,
        '${sqlLiteral(JSON.stringify(requirements))}'::jsonb,
        '{"fixture":true,"result":"pending_grading"}'::jsonb,
        '[{"key":"manual","category":"manual_grading","title":"人工批改","status":"pending_grading","href":"/dashboard/apps/korean/assignments","reason":"主观题仍在等待老师批改"}]'::jsonb,
        now(), 'packet9-verifier-v1', md5('${fixture.pending}')
      );
    commit;
    select pg_notify('pgrst', 'reload schema');
  `);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const [ownerA1, ownerA2, ownerB, teacherA, platform, ...students] =
    await Promise.all([
      signIn(accounts.ownerA),
      signIn(accounts.ownerA),
      signIn(accounts.ownerB),
      signIn(accounts.teacherA),
      signIn(accounts.platform),
      ...accounts.students.map(signIn),
    ]);

  const invalidNotEligible = await ownerA1.rpc(
    "issue_course_completion_certificate",
    { p_evaluation_id: fixture.notEligible },
  );
  const invalidPending = await ownerA1.rpc(
    "issue_course_completion_certificate",
    { p_evaluation_id: fixture.pending },
  );
  const invalidEvidence = {
    notEligible: expectRpcError(
      invalidNotEligible,
      /只有 eligible 状态/,
      "not_eligible must be rejected",
    ),
    pendingGrading: expectRpcError(
      invalidPending,
      /只有 eligible 状态/,
      "pending_grading must be rejected",
    ),
  };

  const [concurrentOne, concurrentTwo] = await Promise.all([
    ownerA1.rpc("issue_course_completion_certificate", {
      p_evaluation_id: fixture.eligibleA[0],
    }),
    ownerA2.rpc("issue_course_completion_certificate", {
      p_evaluation_id: fixture.eligibleA[0],
    }),
  ]);
  failOn(concurrentOne.error, "并发颁发请求1");
  failOn(concurrentTwo.error, "并发颁发请求2");
  assert.equal(concurrentOne.data.id, concurrentTwo.data.id);

  const issuedA = [concurrentOne.data];
  for (const evaluationId of fixture.eligibleA.slice(1)) {
    const result = await ownerA1.rpc("issue_course_completion_certificate", {
      p_evaluation_id: evaluationId,
    });
    failOn(result.error, "机构A颁发样本证书");
    issuedA.push(result.data);
  }
  const issuedBResult = await ownerB.rpc("issue_course_completion_certificate", {
    p_evaluation_id: fixture.eligibleB,
  });
  failOn(issuedBResult.error, "机构B颁发样本证书");
  const issuedB = issuedBResult.data;

  const concurrentDatabaseCount = Number(
    runSql(`
      select count(*)
      from public.course_completion_certificates
      where evaluation_id = '${fixture.eligibleA[0]}'::uuid
        and status = 'issued';
    `),
  );
  assert.equal(concurrentDatabaseCount, 1);

  const teacherIssue = await teacherA.rpc(
    "issue_course_completion_certificate",
    { p_evaluation_id: fixture.eligibleA[1] },
  );
  const crossTenantIssue = await ownerA1.rpc(
    "issue_course_completion_certificate",
    { p_evaluation_id: fixture.eligibleB },
  );
  const teacherDenied = expectRpcError(
    teacherIssue,
    /只有对应机构负责人/,
    "teacher issue must be denied",
  );
  const crossTenantDenied = expectRpcError(
    crossTenantIssue,
    /只有对应机构负责人/,
    "cross-tenant issue must be denied",
  );

  const [{ data: ownerARows, error: ownerAReadError }, { data: studentRows, error: studentReadError }] =
    await Promise.all([
      ownerA1.from("course_completion_certificates").select("id,tenant_id"),
      students[0]
        .from("course_completion_certificates")
        .select("id,student_id,tenant_id"),
    ]);
  failOn(ownerAReadError, "机构A读取证书");
  failOn(studentReadError, "学生读取自己的证书");
  assert.equal(ownerARows.length, 4);
  assert.ok(ownerARows.every((row) => row.tenant_id === fixture.tenantA));
  assert.equal(studentRows.length, 1);
  assert.equal(studentRows[0].student_id, accounts.students[0].id);

  const forgedCertificate = {
    id: randomUUID(),
    tenant_id: fixture.tenantA,
    student_id: accounts.students[0].id,
    student_app_id: APP_ID,
    course_id: COURSE_ID,
    evaluation_id: fixture.eligibleA[0],
    certificate_number: "CERT-2026-AAAAAAAA-AAAAAAAA-AAAAAAAA-AAAAAAAA",
    status: "issued",
    student_name_snapshot: "伪造姓名",
    course_title_snapshot: "伪造课程",
    policy_snapshot: {},
    evidence_snapshot: {},
    issued_by: accounts.ownerA.id,
    issued_at: new Date().toISOString(),
  };
  const directInsert = await admin
    .from("course_completion_certificates")
    .insert(forgedCertificate);
  assert.ok(directInsert.error, "service_role direct certificate insert must fail");
  assert.match(directInsert.error.message, /permission denied/i);

  const directStudentInsert = await students[0]
    .from("course_completion_certificates")
    .insert({ ...forgedCertificate, id: randomUUID() });
  assert.ok(directStudentInsert.error, "student direct certificate insert must fail");
  assert.match(directStudentInsert.error.message, /permission denied/i);

  const directStudentUpdate = await students[0]
    .from("course_completion_certificates")
    .update({ status: "revoked" })
    .eq("id", issuedA[0].id);
  assert.ok(directStudentUpdate.error, "student direct certificate update must fail");
  assert.match(directStudentUpdate.error.message, /permission denied/i);

  const emptyReason = await ownerA1.rpc(
    "revoke_course_completion_certificate",
    { p_certificate_id: issuedA[0].id, p_reason: " " },
  );
  expectRpcError(emptyReason, /必须提供/, "empty revocation reason must fail");

  const crossTenantRevoke = await ownerA1.rpc(
    "revoke_course_completion_certificate",
    { p_certificate_id: issuedB.id, p_reason: "机构A无权撤销机构B证书" },
  );
  expectRpcError(
    crossTenantRevoke,
    /只有对应机构负责人或平台负责人/,
    "cross-tenant revoke must fail",
  );
  const teacherRevoke = await teacherA.rpc(
    "revoke_course_completion_certificate",
    { p_certificate_id: issuedA[0].id, p_reason: "老师无权撤销证书" },
  );
  const teacherRevokeDenied = expectRpcError(
    teacherRevoke,
    /只有对应机构负责人或平台负责人/,
    "teacher revoke must fail",
  );

  const revokeReason = "学生姓名需要按正式证件更正后重新颁发";
  const revoked = await ownerA1.rpc("revoke_course_completion_certificate", {
    p_certificate_id: issuedA[0].id,
    p_reason: revokeReason,
  });
  failOn(revoked.error, "机构A撤销证书");
  assert.equal(revoked.data.status, "revoked");
  assert.equal(revoked.data.revocation_reason, revokeReason);
  const revokedEventCount = Number(
    runSql(`
      select count(*) from public.course_completion_certificate_events
      where certificate_id = '${issuedA[0].id}'::uuid
        and event_type = 'revoked'
        and reason = '${sqlLiteral(revokeReason)}';
    `),
  );
  assert.equal(revokedEventCount, 1);

  const changedStudentName = "证书验收学生一（更正）";
  const changedCourseTitle = `${originalCourseTitle}（证书快照验收）`;
  runSql(`
    update public.profiles set full_name = '${sqlLiteral(changedStudentName)}'
    where id = '${accounts.students[0].id}'::uuid;
    update public.courses set title = '${sqlLiteral(changedCourseTitle)}'
    where id = '${COURSE_ID}'::uuid;
  `);

  const reissued = await ownerA1.rpc(
    "reissue_course_completion_certificate",
    {
      p_certificate_id: issuedA[0].id,
      p_reason: "已核对更正后的姓名并重新审核通过",
      p_evaluation_id: fixture.eligibleA[0],
    },
  );
  failOn(reissued.error, "机构A重新颁发证书");
  assert.notEqual(reissued.data.id, issuedA[0].id);
  assert.notEqual(reissued.data.certificate_number, issuedA[0].certificate_number);
  assert.equal(reissued.data.reissued_from_id, issuedA[0].id);
  assert.equal(reissued.data.student_name_snapshot, changedStudentName);
  assert.equal(reissued.data.course_title_snapshot, changedCourseTitle);

  const oldAfterReissue = JSON.parse(
    runSql(`
      select row_to_json(certificate)
      from public.course_completion_certificates as certificate
      where id = '${issuedA[0].id}'::uuid;
    `),
  );
  assert.equal(oldAfterReissue.status, "reissued");
  assert.equal(oldAfterReissue.student_name_snapshot, accounts.students[0].label);
  assert.equal(oldAfterReissue.course_title_snapshot, originalCourseTitle);

  const reissuedEventCount = Number(
    runSql(`
      select count(*) from public.course_completion_certificate_events
      where certificate_id = '${reissued.data.id}'::uuid
        and event_type = 'reissued'
        and metadata ->> 'reissuedFromId' = '${issuedA[0].id}';
    `),
  );
  assert.equal(reissuedEventCount, 1);

  const appendOnlyEvidence = expectSqlFailure(
    `update public.course_completion_certificate_events
     set reason = '篡改历史'
     where certificate_id = '${reissued.data.id}'::uuid;`,
    /证书审计事件只允许追加/,
    "append-only event update",
  );

  const platformRows = await platform
    .from("course_completion_certificates")
    .select("id,tenant_id");
  failOn(platformRows.error, "平台负责人读取全局证书");
  assert.equal(platformRows.data.length, 6);
  assert.deepEqual(
    new Set(platformRows.data.map((row) => row.tenant_id)),
    new Set([fixture.tenantA, fixture.tenantB]),
  );
  const platformRevoke = await platform.rpc(
    "revoke_course_completion_certificate",
    { p_certificate_id: issuedB.id, p_reason: "平台异常处置验收撤销" },
  );
  failOn(platformRevoke.error, "平台负责人异常撤销");
  assert.equal(platformRevoke.data.status, "revoked");

  const certificateNumbers = [
    ...issuedA.map((certificate) => certificate.certificate_number),
    issuedB.certificate_number,
    reissued.data.certificate_number,
  ];
  assert.equal(new Set(certificateNumbers).size, certificateNumbers.length);
  for (const number of certificateNumbers) {
    assert.match(
      number,
      /^CERT-\d{4}(?:-[0-9A-F]{8}){4}$/,
      "certificate number format",
    );
    for (const account of Object.values(accounts)) {
      if (account && !Array.isArray(account) && account.id) {
        assert.ok(!number.includes(account.id.replaceAll("-", "").toUpperCase()));
      }
    }
  }
  const randomPayloads = certificateNumbers.map((number) =>
    BigInt(`0x${number.split("-").slice(2).join("")}`),
  );
  const deltas = randomPayloads
    .slice(1)
    .map((value, index) => value - randomPayloads[index]);
  assert.ok(deltas.every((delta) => delta !== 1n));
  assert.equal(new Set(deltas.map(String)).size, deltas.length);

  const evidence = {
    certificateNumbers,
    concurrency: {
      requestOneCertificateId: concurrentOne.data.id,
      requestTwoCertificateId: concurrentTwo.data.id,
      issuedRowsForEvaluation: concurrentDatabaseCount,
    },
    rejectedStatuses: invalidEvidence,
    rls: {
      institutionARowCount: ownerARows.length,
      institutionATenants: [...new Set(ownerARows.map((row) => row.tenant_id))],
      studentOwnRowCount: studentRows.length,
      teacherIssueDenied: teacherDenied,
      crossTenantIssueDenied: crossTenantDenied,
      directServiceRoleInsertDenied: directInsert.error.message,
      directStudentInsertDenied: directStudentInsert.error.message,
      directStudentUpdateDenied: directStudentUpdate.error.message,
      teacherRevokeDenied,
      platformGlobalReadCount: platformRows.data.length,
      platformRevokedTenantBCertificate: platformRevoke.data.id,
    },
    revocation: {
      certificateId: revoked.data.id,
      statusBeforeReissue: revoked.data.status,
      retainedRow: true,
      revokedEventCount,
    },
    reissue: {
      oldCertificateId: issuedA[0].id,
      oldStatus: oldAfterReissue.status,
      newCertificateId: reissued.data.id,
      reissuedFromId: reissued.data.reissued_from_id,
      snapshotStayedImmutable: {
        oldStudentName: oldAfterReissue.student_name_snapshot,
        oldCourseTitle: oldAfterReissue.course_title_snapshot,
        newStudentName: reissued.data.student_name_snapshot,
        newCourseTitle: reissued.data.course_title_snapshot,
      },
      reissuedEventCount,
    },
    auditAppendOnly: appendOnlyEvidence,
  };
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  const cleanupErrors = [];
  try {
    runSql(`
      begin;
      set local session_replication_role = replica;
      ${
        originalCourseTitle
          ? `update public.courses set title = '${sqlLiteral(originalCourseTitle)}'
             where id = '${COURSE_ID}'::uuid;`
          : ""
      }
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
            'delete from public.%I where tenant_id = any($1)',
            tenant_table.table_name
          ) using array['${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid];
        end loop;
      end;
      $$;
      delete from public.course_completion_refresh_tasks
      where policy_id = '${fixture.policy}'::uuid;
      delete from public.course_completion_policies
      where id = '${fixture.policy}'::uuid;
      delete from public.tenants
      where id in ('${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid);
      set local session_replication_role = origin;
      commit;
    `);
  } catch (error) {
    cleanupErrors.push(new Error(`certificate fixture cleanup failed: ${error.message}`));
  }
  for (const userId of createdUserIds.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      cleanupErrors.push(
        new Error(`fixture user cleanup failed (${userId}): ${error.message}`),
      );
    }
  }
  try {
    const retainedRows = Number(
      runSql(`
        select count(*) from public.course_completion_certificates
        where tenant_id in ('${fixture.tenantA}'::uuid, '${fixture.tenantB}'::uuid);
      `),
    );
    if (retainedRows !== 0) {
      cleanupErrors.push(new Error(`retained certificate fixture rows: ${retainedRows}`));
    }
  } catch (error) {
    cleanupErrors.push(new Error(`fixture cleanup verification failed: ${error.message}`));
  }
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "certificate fixture cleanup failed");
  }
  console.log("CLEANUP certificate fixture completed with zero retained certificate rows");
}
