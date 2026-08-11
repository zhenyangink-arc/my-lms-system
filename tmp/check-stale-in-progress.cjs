// 只读统计：无真实学习信号的 in_progress 课时（打开过页面但没读电子书/没做题/没播放视频）
// 真实学习信号 = 电子书阅读秒数>0 或 章节测试通过 或 progress_percent>0(视频播放过)
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

const STALE_WHERE = `
  lp.status = 'in_progress'
  and coalesce(lp.progress_percent, 0) = 0
  and not exists (
    select 1
    from chapter_tests ct
    where ct.course_key = l.slug
      and ct.status = 'published'
      and (
        exists (select 1 from course_ebook_progress ep
                where ep.student_id = lp.user_id and ep.test_slug = ct.slug
                and coalesce(ep.reading_seconds, 0) > 0)
        or exists (select 1 from chapter_test_attempts ta
                   where ta.student_id = lp.user_id and ta.test_slug = ct.slug
                   and ta.passed = true)
      )
  )
`;

console.log("=== TOTAL ===");
console.log(runQuery(`
  select count(*) as stale_count
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  where ${STALE_WHERE}
  ;
`).trim());

console.log("=== SAMPLE (top 20 by updated_at desc) ===");
console.log(runQuery(`
  select lp.user_id, lp.lesson_id, l.title as lesson_title, c.title as course_title,
         lp.progress_percent, lp.updated_at
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  left join courses c on c.id = lp.course_id
  where ${STALE_WHERE}
  order by lp.updated_at desc
  limit 20
  ;
`).trim());

console.log("=== chen001 DETAIL ===");
console.log(runQuery(`
  select lp.user_id, p.full_name, p.login_id, lp.lesson_id, l.title as lesson_title,
         c.title as course_title, lp.progress_percent, lp.updated_at
  from lesson_progress lp
  join lessons l on l.id = lp.lesson_id
  left join courses c on c.id = lp.course_id
  join profiles p on p.id = lp.user_id
  where lp.user_id in (select id from profiles where login_id = 'chen001')
    and ${STALE_WHERE}
  ;
`).trim());
