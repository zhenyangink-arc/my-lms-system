// 调研：realtime.messages 表结构 + 现有 realtime policy + 尝试 Management API 开启 restrict
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

console.log("=== realtime.messages 表结构 ===");
console.log(runQuery(`
  select column_name, data_type from information_schema.columns
  where table_schema = 'realtime' and table_name = 'messages' order by ordinal_position;
`).trim());

console.log("\n=== realtime.messages 现有 policies ===");
console.log(runQuery(`
  select policyname, cmd, roles from pg_policies
  where schemaname = 'realtime' and tablename = 'messages';
`).trim());

console.log("\n=== 尝试 Management API: GET realtime config ===");
for (const endpoint of [
  `/v1/projects/${ref}/realtime/config`,
  `/v1/projects/${ref}/realtime`,
  `/v1/projects/${ref}/config/realtime`,
]) {
  try {
    const out = execSync(`curl.exe -s -X GET "https://api.supabase.com/v1${endpoint}" -H "Authorization: Bearer ${token}"`, { encoding: "utf8" });
    console.log(`${endpoint} -> ${out.slice(0, 200)}`);
  } catch (error) {
    console.log(`${endpoint} -> ERR ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 120)}`);
  }
}
