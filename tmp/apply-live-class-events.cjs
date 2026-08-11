// 应用迁移：live_class_events
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

console.log("=== EXECUTING 202608070008 ===");
const sql = fs.readFileSync("supabase/migrations/202608070008_live_class_events.sql", "utf8");
try {
  const out = runQuery(sql);
  console.log(`OK: ${out.trim().slice(0, 300) || "(empty)"}`);
} catch (error) {
  const message = error.stderr ? error.stderr.toString() : error.message;
  console.log(`FAIL: ${message.slice(0, 3000)}`);
  process.exit(1);
}

console.log("=== REGISTER ===");
try {
  const out = runQuery(
    "insert into supabase_migrations.schema_migrations (version, name, statements) values ('202608070008', 'live_class_events', '{}') on conflict (version) do nothing;"
  );
  console.log(`OK: ${out.trim().slice(0, 300) || "(empty)"}`);
} catch (error) {
  const message = error.stderr ? error.stderr.toString() : error.message;
  console.log(`FAIL: ${message.slice(0, 2000)}`);
  process.exit(1);
}

console.log("=== VERIFY ===");
console.log(runQuery(`
  select (select count(*) from information_schema.tables where table_name='live_class_events') as table_ok,
         (select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='live_class_events') as pub_ok;
`).trim());
