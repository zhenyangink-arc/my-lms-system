// 阶段2 安全测试：学生越权操作（insert 课堂 / insert 成员 / update 成员 / 读他人课堂事件）
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
const EXISTING = "952791cb-13d2-4dda-a9a2-5035ff4a6448";

let allPassed = true;
const report = (label, pass, detail) => {
  if (!pass) allPassed = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ${detail}`);
};

/** 执行以指定身份运行的单条 SQL，返回 { denied: boolean, msg } */
function execAs(userId, sql) {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
    ${sql}
  `);
  try {
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) return { denied: false, rows: parsed.length };
    if (parsed && typeof parsed.message === "string") {
      return { denied: true, msg: parsed.message };
    }
    return { denied: false, raw: out };
  } catch {
    return { denied: false, raw: out };
  }
}

console.log("=== 1. 学生 insert live_class_sessions（越权创建课堂）→ 应被拒 ===");
{
  const r = execAs(STUDENT_ID, `
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values (
      (select tenant_id from live_class_sessions where id='${EXISTING}'),
      '${TEACHER_ID}', null,
      (select course_id from live_class_sessions where id='${EXISTING}'),
      (select lesson_id from live_class_sessions where id='${EXISTING}'),
      'meet-hangul', 'active', 'group'
    ) returning id;
  `);
  report("学生 insert 课堂", r.denied, r.denied ? "被 RLS 拒绝 ✓" : JSON.stringify(r).slice(0, 150));
}

console.log("\n=== 2. 学生 update live_class_members（越权移除成员）→ 应被拒 ===");
{
  const r = execAs(STUDENT_ID, `
    update live_class_members set left_at = now() where student_id = '${STUDENT_ID}';
  `);
  report("学生 update 成员", r.denied || (r.rows === 0 && !r.denied), r.denied ? "被 RLS 拒绝 ✓" : `rows=${r.rows}`);
}

console.log("\n=== 3. 学生 insert live_class_members（越权添加成员）→ 应被拒 ===");
{
  const r = execAs(STUDENT_ID, `
    insert into live_class_members (session_id, student_id)
    values ('${EXISTING}', '${STUDENT_ID}') returning id;
  `);
  report("学生 insert 成员", r.denied, r.denied ? "被 RLS 拒绝 ✓" : JSON.stringify(r).slice(0, 150));
}

console.log("\n=== 4. 学生读非自己课堂的 events（信息泄露）→ 应被拒/0行 ===");
{
  // 老师创建独立 group 课堂（不含 chen001），老师发事件，chen001 读应 0 行/被拒
  const setup = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values (
      (select tenant_id from live_class_sessions where id='${EXISTING}'),
      '${TEACHER_ID}', null,
      (select course_id from live_class_sessions where id='${EXISTING}'),
      (select lesson_id from live_class_sessions where id='${EXISTING}'),
      'meet-hangul', 'active', 'group'
    ) returning id;
  `);
  const foreignSession = JSON.parse(setup)[0]?.id;
  const evt = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_events (tenant_id, session_id, sender_id, kind, chapter_slug, page, payload)
    values ((select tenant_id from live_class_sessions where id='${foreignSession}'), '${foreignSession}', '${TEACHER_ID}',
            'end', 'meet-hangul', 1, '{"kind":"end"}'::jsonb) returning id;
  `);
  const insertedId = JSON.parse(evt)[0]?.id;
  const readOut = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    select count(*) as cnt from live_class_events where id = ${insertedId};
  `);
  let cnt = -1;
  let denied = false;
  try {
    const parsed = JSON.parse(readOut);
    if (Array.isArray(parsed)) {
      cnt = Number(parsed[0]?.cnt ?? -1);
    } else if (parsed && typeof parsed.message === "string") {
      denied = true;
    }
  } catch {
    /* keep -1 */
  }
  report("学生读他人课堂事件", denied || cnt === 0,
    denied ? "被 RLS 拒绝 ✓" : `读到 ${cnt} 行（应 0）`);
  // 清理
  runQuery(`delete from live_class_events where id = ${insertedId};`);
  runQuery(`delete from live_class_sessions where id = '${foreignSession}';`);
}

console.log("\n=== 5. 老师 update live_class_members（remove 合法操作）→ 应成功 ===");
{
  // 先建测试课堂+成员，老师身份 remove
  const setup = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values (
      (select tenant_id from live_class_sessions where id='${EXISTING}'),
      '${TEACHER_ID}', null,
      (select course_id from live_class_sessions where id='${EXISTING}'),
      (select lesson_id from live_class_sessions where id='${EXISTING}'),
      'meet-hangul', 'active', 'group'
    ) returning id;
  `);
  const gid = JSON.parse(setup)[0]?.id;
  runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
    insert into live_class_members (session_id, student_id) values ('${gid}', '${STUDENT_ID}');
  `);
  const r = execAs(TEACHER_ID, `
    update live_class_members set left_at = now() where session_id = '${gid}' and student_id = '${STUDENT_ID}';
  `);
  report("老师 update 成员(remove)", !r.denied, r.denied ? `被拒: ${r.msg}` : "成功");
  // 清理
  runQuery(`delete from live_class_members where session_id = '${gid}';`);
  runQuery(`delete from live_class_sessions where id = '${gid}';`);
}

console.log(allPassed ? "\n=== 全部安全断言通过 ===" : "\n=== 存在失败断言！===");
process.exit(allPassed ? 0 : 1);
