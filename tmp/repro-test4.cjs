// 复现测试4：独立课堂事件，学生身份读取，打印全部中间值
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
const STUDENT_ID = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f";
const EXISTING = "952791cb-13d2-4dda-a9a2-5035ff4a6448";

// 1. 老师创建独立 group 课堂
const setupOut = runQuery(`
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
console.log("setup:", setupOut.trim());
const foreignSession = JSON.parse(setupOut)[0]?.id;

// 2. 老师发事件
const evtOut = runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${TEACHER_ID}","role":"authenticated"}';
  insert into live_class_events (tenant_id, session_id, sender_id, kind, chapter_slug, page, payload)
  values ((select tenant_id from live_class_sessions where id='${foreignSession}'), '${foreignSession}', '${TEACHER_ID}',
          'end', 'meet-hangul', 1, '{"kind":"end"}'::jsonb) returning id;
`);
console.log("event insert:", evtOut.trim());
const insertedId = JSON.parse(evtOut)[0]?.id;

// 3. chen001 身份读取（严格同一批事务）
const readOut = runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select count(*) as cnt from live_class_events where id = ${insertedId};
`);
console.log("chen001 read:", readOut.trim());

// 4. 对照：chen001 身份直接查该课堂
const sessOut = runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select id, mode, teacher_id, student_id from live_class_sessions where id = '${foreignSession}';
`);
console.log("chen001 read session:", sessOut.trim());

// 5. 对照：函数结果
const fnOut = runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select public.is_live_class_participant('${foreignSession}') as is_participant;
`);
console.log("chen001 is_participant:", fnOut.trim());

// 清理
runQuery(`delete from live_class_events where id = ${insertedId};`);
runQuery(`delete from live_class_sessions where id = '${foreignSession}';`);
console.log("cleaned");
