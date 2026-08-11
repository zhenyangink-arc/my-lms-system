// 阶段1验证：mode/成员表/trigger/policies + 基础 RLS 断言
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const env = fs.readFileSync(".env.local", "utf8");
const token = env
  .split(/\r?\n/)
  .find((line) => line.startsWith("SUPABASE_ACCESS_TOKEN="))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();
if (!token) { console.error("NO TOKEN"); process.exit(1); }

const ref = "jubdbsjsalpecfvseskz";
function runQuery(query) {
  const body = JSON.stringify({ query });
  const tmp = path.join(os.tmpdir(), `sbq_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmp, body, "utf8");
  try {
    const cmd = `curl.exe -s -X POST "https://api.supabase.com/v1/projects/${ref}/database/query" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" --data-binary "@${tmp}"`;
    return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

const TEACHER_ID = "2b438ee6-5fa9-4983-89ad-a43df4f46fc7";
const STUDENT_ID = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f"; // chen001

console.log("=== A. 结构：mode 列 + 历史数据 ===");
console.log(runQuery(`
  select mode, count(*) from live_class_sessions group by mode;
`).trim());

console.log("\n=== B. 结构：成员表 + trigger + policies ===");
console.log(runQuery(`
  select (select count(*) from information_schema.tables where table_name='live_class_members') as table_ok,
         (select count(*) from pg_trigger where tgname='live_class_members_validate_trigger') as trigger_ok;
`).trim());
console.log(runQuery(`
  select policyname, cmd from pg_policies
  where tablename='live_class_members' order by policyname;
`).trim());

console.log("\n=== C. 更新后的关键 policies ===");
console.log(runQuery(`
  select tablename, policyname from pg_policies
  where (tablename='live_class_sessions' and policyname like 'students%')
     or (tablename='live_class_events' and policyname like 'participants%')
     or (tablename='messages' and schemaname='realtime')
  order by tablename, policyname;
`).trim());

console.log("\n=== D. trigger：老师创建 group 课堂（student_id null 应成功）===");
let groupSessionId = "";
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values (
      (select tenant_id from tenant_student_assignments where teacher_id='${TEACHER_ID}' limit 1),
      '${TEACHER_ID}', null,
      (select course_id from lessons where id = (select lesson_id from live_class_sessions where id='952791cb-13d2-4dda-a9a2-5035ff4a6448')),
      (select lesson_id from live_class_sessions where id='952791cb-13d2-4dda-a9a2-5035ff4a6448'),
      'meet-hangul', 'active', 'group'
    ) returning id;
  `);
  const rows = JSON.parse(out);
  groupSessionId = rows[0]?.id ?? "";
  console.log(groupSessionId ? `PASS group 课堂创建成功: ${groupSessionId}` : `FAIL: ${out.slice(0, 300)}`);
} catch (error) {
  console.log(`FAIL: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 400)}`);
}

console.log("\n=== E. trigger：group 课堂带 student_id 应被拒 ===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values (
      (select tenant_id from tenant_student_assignments where teacher_id='${TEACHER_ID}' limit 1),
      '${TEACHER_ID}', '${STUDENT_ID}',
      (select course_id from lessons where id = (select lesson_id from live_class_sessions where id='952791cb-13d2-4dda-a9a2-5035ff4a6448')),
      (select lesson_id from live_class_sessions where id='952791cb-13d2-4dda-a9a2-5035ff4a6448'),
      'meet-hangul', 'active', 'group'
    ) returning id;
  `);
  // Management API 对 SQL 报错返回 {"message": "..."}，不抛异常
  const parsed = JSON.parse(out);
  if (parsed && typeof parsed.message === "string" && parsed.message.includes("公共课堂不应指定")) {
    console.log("PASS trigger 拒绝 group+student_id");
  } else {
    console.log(`FAIL(应被拒): ${out.slice(0, 300)}`);
  }
} catch (error) {
  const message = error.stderr ? error.stderr.toString() : error.message;
  console.log(message.includes("公共课堂不应指定") ? "PASS trigger 拒绝 group+student_id" : `FAIL: ${message.slice(0, 300)}`);
}

if (!groupSessionId) { console.log("\n(无法继续成员测试，无 group 课堂)"); process.exit(1); }

console.log("\n=== F. 老师 insert 成员 → 应成功 ===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_members (session_id, student_id)
    values ('${groupSessionId}', '${STUDENT_ID}') returning id;
  `);
  const rows = JSON.parse(out);
  console.log(rows.length >= 1 ? `PASS 成员加入成功` : `FAIL: ${out.slice(0, 300)}`);
} catch (error) {
  console.log(`FAIL: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== G. 学生身份 insert 成员（非老师）→ 应被 RLS 拒绝 ===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    insert into live_class_members (session_id, student_id)
    values ('${groupSessionId}', '${STUDENT_ID}') returning id;
  `);
  const parsed = JSON.parse(out);
  if (Array.isArray(parsed)) {
    console.log(parsed.length === 0 ? "PASS 学生 insert 成员被拒(0行)" : `FAIL: 影响了${parsed.length}行`);
  } else if (parsed && typeof parsed.message === "string" && parsed.message.includes("row-level security")) {
    console.log("PASS 学生 insert 成员被 RLS 拒绝");
  } else {
    console.log(`FAIL: ${out.slice(0, 300)}`);
  }
} catch (error) {
  const message = error.stderr ? error.stderr.toString() : error.message;
  console.log(message.includes("row-level security") ? "PASS 学生 insert 成员被 RLS 拒绝" : `FAIL: ${message.slice(0, 300)}`);
}

console.log("\n=== H. 学生身份读自己所在课堂/事件 → 应成功 ===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    select id, mode from live_class_sessions where id = '${groupSessionId}';
  `);
  console.log(`PASS 学生可读自己所在 group 课堂: ${out.trim().slice(0, 200)}`);
} catch (error) {
  console.log(`FAIL: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== CLEANUP ===");
try {
  runQuery(`delete from live_class_members where session_id = '${groupSessionId}';`);
  runQuery(`delete from live_class_sessions where id = '${groupSessionId}';`);
  console.log("CLEANUP OK");
} catch (error) {
  console.log(`CLEANUP FAILED: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}
