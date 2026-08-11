// 只读：chapter_test_attempts 表结构 + chen001 韩语测试通过情况
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

console.log("=== columns ===");
console.log(runQuery(`
  select column_name from information_schema.columns
  where table_name = 'chapter_test_attempts' order by ordinal_position;
`).trim());

console.log("=== chen001 韩语章节测试全部记录 ===");
console.log(runQuery(`
  select * from chapter_test_attempts
  where student_id = (select id from profiles where login_id = 'chen001')
    and test_slug in ('meet-hangul','vowels-and-consonants','batchim-and-reading','pronunciation-rules-and-reading')
  order by attempted_at desc;
`).trim());
