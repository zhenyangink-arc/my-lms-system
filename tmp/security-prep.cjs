// 安全测试准备：查 chen001 的老师 + 现有 active session + tenant
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

console.log("=== chen001 与负责老师 ===");
console.log(runQuery(`
  select s.id as student_id, p.login_id as student_login, a.teacher_id,
         t.login_id as teacher_login, a.tenant_id
  from tenant_student_assignments a
  join profiles s on s.id = a.student_id
  join profiles t on t.id = a.teacher_id
  where s.login_id = 'chen001';
`).trim());

console.log("=== 现有 active sessions ===");
console.log(runQuery(`
  select id, teacher_id, student_id, lesson_id, chapter_slug, status, created_at
  from live_class_sessions where status = 'active' order by created_at desc limit 5;
`).trim());
