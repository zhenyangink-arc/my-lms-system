// 只读：chen001 的章节测试通过记录 + 韩文字母入门各章的解锁模式
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

console.log("=== chen001 韩语章节测试通过记录 ===");
console.log(runQuery(`
  select ta.test_slug, ta.passed, ta.correct_count, ta.total_questions, ta.updated_at
  from chapter_test_attempts ta
  where ta.student_id = (select id from profiles where login_id = 'chen001')
    and ta.test_slug in ('meet-hangul','vowels-and-consonants','batchim-and-reading','pronunciation-rules-and-reading')
  order by ta.updated_at desc;
`).trim());

console.log("=== 韩文字母入门的章与解锁配置 ===");
console.log(runQuery(`
  select cc.id, cc.slug, cc.title, cc.sort_order, cc.unlock_mode,
         cc.prerequisite_chapter_id, cc.available_from, cc.is_manually_locked
  from course_chapters cc
  join lessons l on l.id = cc.lesson_id
  where l.slug = 'hangul-introduction'
  order by cc.sort_order;
`).trim());
