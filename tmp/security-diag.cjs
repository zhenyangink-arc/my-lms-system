// 诊断：学生 INSERT stroke（老师专属事件）的原始响应
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

const SID = "952791cb-13d2-4dda-a9a2-5035ff4a6448";
const STUDENT = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f";

const payload = JSON.stringify({
  kind: "stroke",
  stroke: { id: "diag-x", points: [{ x: 1, y: 2 }], color: "#000", width: 6 },
}).replace(/'/g, "''");

const sql = `
set local role authenticated;
set local request.jwt.claims = '{"sub":"${STUDENT}","role":"authenticated"}';
insert into live_class_events (tenant_id, session_id, sender_id, kind, chapter_slug, page, payload)
values (
  (select tenant_id from live_class_sessions where id = '${SID}'),
  '${SID}', '${STUDENT}', 'stroke', 'meet-hangul', 1, '${payload}'::jsonb
)
returning id;
`;

const out = runQuery(sql);
console.log("RAW RESPONSE:", out.slice(0, 800));

// 清理诊断行（如果竟然插入成功）
try {
  const clean = runQuery(
    `delete from live_class_events where payload::text = '${payload}' and session_id = '${SID}';`
  );
  console.log("CLEANUP:", clean.slice(0, 200));
} catch {
  /* ignore */
}
