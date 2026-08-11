// 查老师账号信息（tenant_id、email）用于创建假学生
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

console.log("=== 老师账号 ===");
console.log(runQuery(`
  select p.id, p.login_id, p.email, p.role, m.tenant_id, t.name as tenant_name, t.slug as tenant_slug
  from profiles p
  join tenant_memberships m on m.user_id = p.id and m.role = 'teacher'
  join tenants t on t.id = m.tenant_id
  where p.id = '2b438ee6-5fa9-4983-89ad-a43df4f46fc7';
`).trim());

console.log("=== 老师负责的学生（现状）===");
console.log(runQuery(`
  select s.login_id, s.email from tenant_student_assignments a
  join profiles s on s.id = a.student_id
  where a.teacher_id = '2b438ee6-5fa9-4983-89ad-a43df4f46fc7';
`).trim());

console.log("=== 现有课堂 ===");
console.log(runQuery(`
  select id, mode, student_id, status from live_class_sessions order by created_at;
`).trim());
