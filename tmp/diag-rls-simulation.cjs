// 诊断：Management API 多语句中 set local 对后续 SELECT 是否生效
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

const STUDENT_ID = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f";

console.log("=== 诊断1: 同一批 set local + select auth.uid() ===");
console.log(runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select auth.uid() as uid, current_user as cu;
`).trim());

console.log("\n=== 诊断2: set local 后 select（RLS 过滤 live_class_events）===");
console.log(runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select count(*) as total from live_class_events;
`).trim());

console.log("\n=== 诊断3: 不加 set 直接 select（postgres 身份全量）===");
console.log(runQuery(`select count(*) as total from live_class_events;`).trim());

console.log("\n=== 诊断4: set local 后 select（RLS 过滤 live_class_sessions）===");
console.log(runQuery(`
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
  select id, mode from live_class_sessions;
`).trim());
