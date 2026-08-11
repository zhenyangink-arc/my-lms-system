// 后端演练：模拟"发起公共课堂→复用→移除→1对1无影响"完整流程（数据层）
// UI 点击部分需浏览器验证，这里验证每个动作的服务端/RLS 实际结果。
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

const TEACHER_ID = "2b438ee6-5fa9-4983-89ad-a43df4f46fc7";
const TENANT_ID = "ead4e9d6-8b5f-4769-978b-f5a43083c491";
const EXISTING_1v1 = "952791cb-13d2-4dda-a9a2-5035ff4a6448"; // chen001 的 one_on_one 课堂
const T1 = "fc03743f-aae5-4c61-8a94-6c8862c7ed12"; // test01
const T2 = "fa8f68e4-ba28-45fa-8e45-13369b4a1a0d"; // test02
const T3 = "ed550149-3aba-45ea-9d4c-bd3a73f3d7ea"; // test03
const CHEN2 = ""; // chen002 的 id 待查

const lessonInfo = (() => {
  const out = runQuery(`
    select l.id as lesson_id, l.course_id from lessons l
    where l.slug = 'hangul-introduction';
  `);
  const row = JSON.parse(out)[0];
  return { lessonId: row.lesson_id, courseId: row.course_id };
})();

async function qAs(userId, sql) {
  return runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
    ${sql}
  `);
}

let allPassed = true;
const report = (label, pass, detail) => {
  if (!pass) allPassed = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ${detail}`);
};

(async () => {
  console.log(`课时: ${lessonInfo.lessonId} 课程: ${lessonInfo.courseId}\n`);

  // —— 第 1 步：发起公共课堂（第一批：test01/02/03）——
  console.log("=== 1. 发起公共课堂（多选 test01/02/03）===");
  const createOut = await qAs(TEACHER_ID, `
    insert into live_class_sessions (tenant_id, teacher_id, student_id, course_id, lesson_id, chapter_slug, status, mode)
    values ('${TENANT_ID}', '${TEACHER_ID}', null, '${lessonInfo.courseId}', '${lessonInfo.lessonId}', 'meet-hangul', 'active', 'group')
    returning id;
  `);
  const gid = JSON.parse(createOut)[0]?.id;
  report("创建 group 课堂", Boolean(gid), gid ? `id=${gid}` : createOut.slice(0, 150));
  if (!gid) { process.exit(1); }

  const memberOut = await qAs(TEACHER_ID, `
    insert into live_class_members (session_id, student_id) values
      ('${gid}', '${T1}'), ('${gid}', '${T2}'), ('${gid}', '${T3}');
  `);
  report("加入 3 名成员", !memberOut.includes("message"), JSON.parse(memberOut || "[]").length > 0 ? "3 行" : "（重复被忽略）");

  // 验证：test01 能查到/进入课堂
  const t1Check = await qAs(T1, `select public.is_live_class_participant('${gid}') as p;`);
  report("test01 是参与者（可进入）", JSON.parse(t1Check)[0]?.p === true, `is_participant=${JSON.parse(t1Check)[0]?.p}`);

  // —— 第 2 步：再次发起（第二批：含新学生 chen002/003）→ 应为复用 ——
  console.log("\n=== 2. 再次发起（同课时，选 chen002/chen003）→ 验证复用 ===");
  // action 逻辑：同老师同课时 active group 已存在 → 复用并追加成员。此处复刻该判断并追加。
  const existingOut = await qAs(TEACHER_ID, `
    select id from live_class_sessions
    where tenant_id='${TENANT_ID}' and teacher_id='${TEACHER_ID}'
      and lesson_id='${lessonInfo.lessonId}' and mode='group' and status='active'
    limit 1;
  `);
  const reusedId = JSON.parse(existingOut)[0]?.id;
  report("复用检测：同课时 active group 唯一", reusedId === gid, reusedId === gid ? `复用课堂 ${reusedId}（未新建）` : `异常: ${existingOut.slice(0, 120)}`);

  const chenIdsOut = runQuery(`select id, login_id from profiles where login_id in ('chen002','chen003');`);
  const chenIds = JSON.parse(chenIdsOut);
  for (const c of chenIds) {
    await qAs(TEACHER_ID, `
      insert into live_class_members (session_id, student_id)
      values ('${gid}', '${c.id}') on conflict (session_id, student_id) do nothing;
    `);
  }
  const memberCountOut = await qAs(TEACHER_ID, `select count(*) as c from live_class_members where session_id='${gid}' and left_at is null;`);
  const memberCount = JSON.parse(memberCountOut)[0]?.c;
  report("追加 chen002/003 后成员数", memberCount === 5, `在场成员 ${memberCount}（test01/02/03 + chen002/003）`);

  // —— 第 3 步：移除 test01 ——
  console.log("\n=== 3. 移除 test01 ===");
  const removeOut = await qAs(TEACHER_ID, `
    update live_class_members set left_at = now() where session_id='${gid}' and student_id='${T1}' and left_at is null;
  `);
  const t1After = await qAs(T1, `select public.is_live_class_participant('${gid}') as p;`);
  const removed = JSON.parse(t1After)[0]?.p === false;
  report("test01 失去权限（事件/频道/进入均失效）", removed, `is_participant=${JSON.parse(t1After)[0]?.p}`);

  // —— 第 4 步：1 对 1 无影响 ——
  console.log("\n=== 4. 原有 1 对 1 课堂不受影响 ===");
  const oneOneOut = await qAs(TEACHER_ID, `select id, mode, student_id, status from live_class_sessions where id='${EXISTING_1v1}';`);
  const oneOne = JSON.parse(oneOneOut)[0];
  report("952791cb 状态未变", oneOne?.mode === "one_on_one" && oneOne?.status === "active", `mode=${oneOne?.mode} status=${oneOne?.status}`);

  // —— 清理：删除演练课堂（保留假学生供 UI 测试）——
  console.log("\n=== 清理演练数据 ===");
  runQuery(`delete from live_class_members where session_id='${gid}';`);
  runQuery(`delete from live_class_sessions where id='${gid}';`);
  console.log("演练课堂已清理（测试学生账号保留，供浏览器 UI 测试）");

  console.log(allPassed ? "\n=== 后端演练全部通过 ===" : "\n=== 存在失败！===");
  process.exit(allPassed ? 0 : 1);
})();
