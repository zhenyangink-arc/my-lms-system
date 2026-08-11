// 验证：函数收紧后——登录用户无法探测任意课堂（传不了 uid），authenticated 仅可查自己的课堂
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

const STUDENT_ID = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f"; // chen001
const SESSION_OWN = "952791cb-13d2-4dda-a9a2-5035ff4a6448"; // chen001 参与的 1对1 课堂
const SESSION_FOREIGN = "00000000-0000-0000-0000-000000000001"; // 不存在的课堂

console.log("=== 学生身份调用函数（签名已无 uid 参数，只能查自己）===");
try {
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${STUDENT_ID}","role":"authenticated"}';
    select public.is_live_class_participant('${SESSION_OWN}') as own_session,
           public.is_live_class_participant('${SESSION_FOREIGN}') as foreign_session;
  `);
  const rows = JSON.parse(out);
  const r = rows[0] ?? {};
  const pass = r.own_session === true && r.foreign_session === false;
  console.log(pass
    ? `PASS 自己的课堂=true, 他人的课堂=false（探测被挡）`
    : `FAIL: ${JSON.stringify(r)}`);
} catch (error) {
  console.log(`FAIL: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}
