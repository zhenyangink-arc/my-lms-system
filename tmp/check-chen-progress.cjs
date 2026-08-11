// 只读：查 chen001 在"韩文字母入门"课时的完整进度信号
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

const uid = "(select id from profiles where login_id = 'chen001')";

console.log("=== chen001 全部课时进度（lesson_progress） ===");
console.log(runQuery(`
  select l.title as lesson_title, l.slug as lesson_slug, c.title as course_title,
         lp.status, lp.progress_percent, lp.started_at, lp.last_viewed_at, lp.updated_at
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  left join courses c on c.id = lp.course_id
  where lp.user_id = ${uid}
  order by lp.updated_at desc
  ;
`).trim());

console.log("=== chen001 电子书阅读进度（course_ebook_progress） ===");
console.log(runQuery(`
  select ep.test_slug, ep.reading_seconds, ep.progress_percent, ep.read_pages,
         ep.current_page, ep.total_pages, ep.last_read_at, l.title as lesson_title
  from course_ebook_progress ep
  join chapter_tests ct on ct.slug = ep.test_slug and ct.status = 'published'
  join lessons l on l.slug = ct.course_key
  where ep.student_id = ${uid}
  order by ep.last_read_at desc
  ;
`).trim());

console.log("=== chen001 章节测试通过记录（chapter_test_attempts passed） ===");
console.log(runQuery(`
  select ta.test_slug, ta.passed, ta.attempt_count, ta.updated_at
  from chapter_test_attempts ta
  where ta.student_id = ${uid}
  order by ta.updated_at desc
  ;
`).trim());
