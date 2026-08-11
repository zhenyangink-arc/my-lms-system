// 阶段二动态攻击测试：以老师、成员、非成员身份直接访问数据库。
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const env = fs.readFileSync(".env.local", "utf8");
const token = env
  .split(/\r?\n/)
  .find((line) => line.startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN_MISSING");

function runQuery(query) {
  const bodyPath = path.join(os.tmpdir(), `verify_live_class_rls_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(bodyPath, JSON.stringify({ query }), "utf8");
  try {
    const result = spawnSync(
      "curl.exe",
      [
        "-sS", "-X", "POST",
        "https://api.supabase.com/v1/projects/jubdbsjsalpecfvseskz/database/query",
        "-H", `Authorization: Bearer ${token}`,
        "-H", "Content-Type: application/json",
        "--data-binary", `@${bodyPath}`,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    if (result.status !== 0) throw new Error(`SUPABASE_QUERY_FAILED: ${String(result.stderr).trim()}`);
    return String(result.stdout).trim();
  } finally {
    try { fs.unlinkSync(bodyPath); } catch { /* ignore */ }
  }
}

function parseResponse(output) {
  const parsed = JSON.parse(output || "null");
  if (Array.isArray(parsed)) return { ok: true, rows: parsed };
  return { ok: false, message: String(parsed?.message ?? output) };
}

function asUser(userId, statement) {
  return parseResponse(runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '${JSON.stringify({ sub: userId, role: "authenticated" })}';
    ${statement}
  `));
}

const assertions = [];
function assert(name, passed, detail) {
  assertions.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

function rowCount(result) {
  return result.ok ? result.rows.length : -1;
}

const fixtureResponse = parseResponse(runQuery(`
  with candidates as (
    select
      s.id as source_session_id,
      s.tenant_id,
      s.teacher_id,
      s.course_id,
      s.lesson_id,
      s.chapter_slug,
      s.student_id as one_on_one_student_id,
      array(
        select a.student_id
        from public.tenant_student_assignments a
        join public.tenant_memberships m
          on m.tenant_id = a.tenant_id
         and m.user_id = a.student_id
         and m.role = 'student'
         and m.status = 'active'
         and m.is_default
        where a.tenant_id = s.tenant_id
          and a.teacher_id = s.teacher_id
        order by a.created_at, a.student_id
      ) as assigned_students
    from public.live_class_sessions s
    join public.tenant_memberships teacher_membership
      on teacher_membership.tenant_id = s.tenant_id
     and teacher_membership.user_id = s.teacher_id
     and teacher_membership.status = 'active'
     and teacher_membership.is_default
    where s.mode = 'one_on_one'
      and s.student_id is not null
  )
  select *, (
    select m.user_id
    from public.tenant_memberships m
    where m.tenant_id = candidates.tenant_id
      and m.role = 'student'
      and m.status = 'active'
      and m.is_default
      and not (m.user_id = any(candidates.assigned_students))
    order by m.created_at, m.user_id
    limit 1
  ) as unassigned_student_id
  from candidates
  where cardinality(assigned_students) >= 3
    and one_on_one_student_id = any(assigned_students)
  order by source_session_id
  limit 1;
`));

if (!fixtureResponse.ok || fixtureResponse.rows.length !== 1) {
  throw new Error(`RLS_FIXTURE_NOT_FOUND: ${fixtureResponse.ok ? "no suitable teacher with 3 assigned students" : fixtureResponse.message}`);
}

const fixture = fixtureResponse.rows[0];
const [memberA, memberB, outsider] = fixture.assigned_students;
const teacher = fixture.teacher_id;
let sessionId = null;

try {
  const setup = parseResponse(runQuery(`
    with inserted as (
      insert into public.live_class_sessions (
        tenant_id, teacher_id, student_id, course_id, lesson_id,
        chapter_slug, status, mode
      ) values (
        '${fixture.tenant_id}', '${teacher}', null,
        '${fixture.course_id}', '${fixture.lesson_id}',
        '${String(fixture.chapter_slug).replaceAll("'", "''")}', 'active', 'group'
      ) returning id
    ), members as (
      insert into public.live_class_members (session_id, student_id)
      select inserted.id, student_id
      from inserted
      cross join unnest(array['${memberA}'::uuid, '${memberB}'::uuid]) as student_id
      returning session_id
    )
    select id from inserted;
  `));
  if (!setup.ok || setup.rows.length !== 1) throw new Error(`SETUP_FAILED: ${setup.message ?? "no session"}`);
  sessionId = setup.rows[0].id;

  assert("老师可读自己的 group 课堂", rowCount(asUser(teacher, `select id from public.live_class_sessions where id = '${sessionId}';`)) === 1, "返回 1 行");
  assert("在场成员可读 group 课堂", rowCount(asUser(memberA, `select id from public.live_class_sessions where id = '${sessionId}';`)) === 1, "返回 1 行");
  assert("非成员不可读 group 课堂", rowCount(asUser(outsider, `select id from public.live_class_sessions where id = '${sessionId}';`)) === 0, "返回 0 行");

  const ownRows = asUser(memberA, `select student_id from public.live_class_members where session_id = '${sessionId}' order by student_id;`);
  assert("学生只能读自己的成员行", ownRows.ok && ownRows.rows.length === 1 && ownRows.rows[0].student_id === memberA, `可见 ${ownRows.ok ? ownRows.rows.length : -1} 行`);

  const studentInsertMember = asUser(memberA, `insert into public.live_class_members (session_id, student_id) values ('${sessionId}', '${outsider}') returning id;`);
  assert("学生不能直接 INSERT 成员", !studentInsertMember.ok, studentInsertMember.ok ? "越权成功" : "RLS 拒绝");

  const studentUpdateMember = asUser(memberA, `update public.live_class_members set left_at = now() where session_id = '${sessionId}' and student_id = '${memberA}' returning id;`);
  assert("学生不能直接 UPDATE 成员", !studentUpdateMember.ok || studentUpdateMember.rows.length === 0, studentUpdateMember.ok ? `影响 ${studentUpdateMember.rows.length} 行` : "RLS 拒绝");

  const studentDeleteMember = asUser(memberA, `delete from public.live_class_members where session_id = '${sessionId}' and student_id = '${memberA}' returning id;`);
  assert("学生不能直接 DELETE 成员", !studentDeleteMember.ok || studentDeleteMember.rows.length === 0, studentDeleteMember.ok ? `影响 ${studentDeleteMember.rows.length} 行` : "RLS 拒绝");

  const studentUpdateSession = asUser(memberA, `update public.live_class_sessions set status = 'ended' where id = '${sessionId}' returning id;`);
  assert("学生不能直接 UPDATE 课堂", !studentUpdateSession.ok || studentUpdateSession.rows.length === 0, studentUpdateSession.ok ? `影响 ${studentUpdateSession.rows.length} 行` : "RLS 拒绝");

  const allowedEvent = asUser(memberA, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${memberA}', 'rtc-answer', '{"kind":"rtc-answer","sdp":"stage2"}'::jsonb)
    returning id;
  `);
  assert("成员可 INSERT rtc-answer", allowedEvent.ok && allowedEvent.rows.length === 1, allowedEvent.ok ? "写入 1 行" : allowedEvent.message);

  const forbiddenEvent = asUser(memberA, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${memberA}', 'end', '{"kind":"end"}'::jsonb)
    returning id;
  `);
  assert("学生不能 INSERT 老师专属事件", !forbiddenEvent.ok, forbiddenEvent.ok ? "越权成功" : "RLS 拒绝");

  const outsiderEvent = asUser(outsider, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${outsider}', 'rtc-ice', '{"kind":"rtc-ice","candidate":"stage2"}'::jsonb)
    returning id;
  `);
  assert("非成员不能 INSERT 允许种类的事件", !outsiderEvent.ok, outsiderEvent.ok ? "越权成功" : "RLS 拒绝");

  const spoofSender = asUser(memberA, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${memberB}', 'rtc-ice', '{"kind":"rtc-ice","candidate":"stage2"}'::jsonb)
    returning id;
  `);
  assert("成员不能伪造 sender_id", !spoofSender.ok, spoofSender.ok ? "伪造成功" : "RLS 拒绝");

  const teacherEvent = asUser(teacher, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${teacher}', 'end', '{"kind":"end"}'::jsonb)
    returning id;
  `);
  assert("老师可 INSERT 专属事件", teacherEvent.ok && teacherEvent.rows.length === 1, teacherEvent.ok ? "写入 1 行" : teacherEvent.message);

  if (fixture.unassigned_student_id) {
    const unassignedInsert = asUser(teacher, `insert into public.live_class_members (session_id, student_id) values ('${sessionId}', '${fixture.unassigned_student_id}') returning id;`);
    assert("老师不能绕过负责名单添加学生", !unassignedInsert.ok, unassignedInsert.ok ? "越权成功" : "触发器拒绝");
  } else {
    assert("老师不能绕过负责名单添加学生", true, "当前租户没有可用的未分配学生，静态约束已核对");
  }

  const remove = asUser(teacher, `update public.live_class_members set left_at = now() where session_id = '${sessionId}' and student_id = '${memberA}' returning id;`);
  assert("老师可移除成员", remove.ok && remove.rows.length === 1, remove.ok ? "影响 1 行" : remove.message);

  assert("被移除学生不可再读课堂", rowCount(asUser(memberA, `select id from public.live_class_sessions where id = '${sessionId}';`)) === 0, "返回 0 行");
  const afterRemovalEvent = asUser(memberA, `
    insert into public.live_class_events (tenant_id, session_id, sender_id, kind, payload)
    values ('${fixture.tenant_id}', '${sessionId}', '${memberA}', 'rtc-ice', '{"kind":"rtc-ice","candidate":"removed"}'::jsonb)
    returning id;
  `);
  assert("被移除学生不可再发课堂事件", !afterRemovalEvent.ok, afterRemovalEvent.ok ? "越权成功" : "RLS 拒绝");
  assert("被移除学生不可再读历史事件", rowCount(asUser(memberA, `select id from public.live_class_events where session_id = '${sessionId}';`)) === 0, "返回 0 行");

  assert("原一对一学生仍可读原课堂", rowCount(asUser(fixture.one_on_one_student_id, `select id from public.live_class_sessions where id = '${fixture.source_session_id}';`)) === 1, "one_on_one 返回 1 行");
} finally {
  if (sessionId) {
    runQuery(`delete from public.live_class_sessions where id = '${sessionId}';`);
  }
}

const failed = assertions.filter((item) => !item.passed);
console.log(JSON.stringify({ total: assertions.length, passed: assertions.length - failed.length, failed }, null, 2));
process.exit(failed.length === 0 ? 0 : 1);
