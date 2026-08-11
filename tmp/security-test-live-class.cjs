// 安全测试（修正版）：用 RETURNING 验证受影响行数。
// RLS 拒绝时 UPDATE 静默返回 0 行（不回显错误），故以 returning 行数判定。
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
const EXISTING_SESSION = "952791cb-13d2-4dda-a9a2-5035ff4a6448";

console.log("=== SETUP: 老师身份创建独立测试课堂 ===");
let testSessionId = "";
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status)
    values (
      (select tenant_id from tenant_student_assignments where teacher_id = '${TEACHER_ID}' and student_id = '${STUDENT_ID}' limit 1),
      '${TEACHER_ID}', '${STUDENT_ID}',
      (select course_id from lessons where id = (select lesson_id from live_class_sessions where id = '${EXISTING_SESSION}')),
      (select lesson_id from live_class_sessions where id = '${EXISTING_SESSION}'),
      'meet-hangul', 'active'
    )
    returning id;
  `);
  const rows = JSON.parse(out);
  testSessionId = rows[0]?.id ?? "";
  if (!testSessionId) throw new Error("no id");
  console.log(`INSERT OK: ${testSessionId}`);
} catch (error) {
  console.log(`INSERT FAILED: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 400)}`);
  process.exit(1);
}

console.log("\n=== TEST A: 学生身份 update 测试课堂（模拟学生调结束课堂）===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    update live_class_sessions
    set status = 'ended', ended_at = now(), ended_by = '${STUDENT_ID}'
    where id = '${testSessionId}'
    returning id;
  `);
  const rows = JSON.parse(out);
  console.log(rows.length === 0
    ? "PASS: 学生 UPDATE 被 RLS 拒绝（0 行受影响）"
    : `FAIL: 学生 UPDATE 影响了 ${rows.length} 行！`);
} catch (error) {
  console.log(`REJECTED WITH ERROR: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== TEST B: 老师身份 update 测试课堂（结束）===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    update live_class_sessions set status = 'ended', ended_at = now(), ended_by = '${TEACHER_ID}'
    where id = '${testSessionId}'
    returning id;
  `);
  const rows = JSON.parse(out);
  console.log(rows.length === 1
    ? "PASS: 老师 UPDATE 成功（1 行受影响）"
    : `FAIL: 老师 UPDATE 影响 ${rows.length} 行`);
} catch (error) {
  console.log(`FAIL: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== TEST C: 学生身份 UPDATE 真实课堂也必须被拒（无副作用验证）===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    update live_class_sessions
    set status = 'ended', ended_at = now(), ended_by = '${STUDENT_ID}'
    where id = '${EXISTING_SESSION}'
    returning id;
  `);
  const rows = JSON.parse(out);
  console.log(rows.length === 0
    ? "PASS: 学生对真实课堂 UPDATE 被拒（0 行）"
    : `FAIL: 学生影响真实课堂 ${rows.length} 行！`);
} catch (error) {
  console.log(`REJECTED WITH ERROR: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== CLEANUP ===");
try {
  const out = runQuery(`delete from live_class_sessions where id = '${testSessionId}';`);
  console.log(`CLEANUP OK: ${out.trim() || "(empty)"}`);
} catch (error) {
  console.log(`CLEANUP FAILED: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log("\n=== VERIFY: 真实课堂仍 active ===");
console.log(runQuery(`
  select id, status from live_class_sessions where id = '${EXISTING_SESSION}';
`).trim());
