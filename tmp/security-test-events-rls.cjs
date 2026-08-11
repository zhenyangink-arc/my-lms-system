// 安全测试（修正版）：live_class_events RLS —— 用原始响应精确判定拒绝/成功
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
const STUDENT_ID = "fbec91b2-5386-4bc0-bb38-6ac0cd34687f"; // chen001
const SESSION_ID = "952791cb-13d2-4dda-a9a2-5035ff4a6448";
const OUTSIDER_ID = "00000000-0000-0000-0000-000000000001";

/** 返回 { status: "ok", rows } | { status: "denied", message } */
function insertAs(userId, kind, extraPayload) {
  const payload = JSON.stringify({ kind, ...extraPayload }).replace(/'/g, "''");
  const out = runQuery(`
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';
    insert into live_class_events (tenant_id, session_id, sender_id, kind, chapter_slug, page, payload)
    values (
      (select tenant_id from live_class_sessions where id = '${SESSION_ID}'),
      '${SESSION_ID}', '${userId}', '${kind}', 'meet-hangul', 1, '${payload}'::jsonb
    )
    returning id;
  `);
  try {
    const parsed = JSON.parse(out);
    if (Array.isArray(parsed)) return { status: "ok", rows: parsed.length };
    if (parsed && typeof parsed.message === "string") {
      return { status: "denied", message: parsed.message };
    }
    return { status: "unknown", out };
  } catch {
    return { status: "unknown", out };
  }
}

let allPassed = true;
const report = (label, pass, detail) => {
  if (!pass) allPassed = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ${detail}`);
};

console.log("=== 学生身份尝试老师专属事件（必须全部被 RLS 拒绝）===");
const teacherOnly = [
  ["stroke", "画线"],
  ["note", "文字批注"],
  ["page", "翻页"],
  ["clear", "清除"],
  ["rtc-offer", "语音发起"],
  ["end", "结束课堂"],
];
for (const [kind, label] of teacherOnly) {
  const result = insertAs(STUDENT_ID, kind, {});
  const denied = result.status === "denied" && result.message.includes("row-level security");
  report(`学生 INSERT ${label}(${kind})`, denied,
    result.status === "denied" ? `被 RLS 拒绝 ✓` : `未被拒绝: ${JSON.stringify(result).slice(0, 120)}`);
}

console.log("\n=== 学生身份可发事件（必须成功）===");
const studentAllowed = [
  ["rtc-answer", "语音应答"],
  ["rtc-ice", "ICE候选"],
  ["rtc-hangup", "挂断"],
];
for (const [kind, label] of studentAllowed) {
  const result = insertAs(STUDENT_ID, kind, {});
  report(`学生 INSERT ${label}(${kind})`, result.status === "ok" && result.rows >= 1,
    result.status === "ok" ? `成功 ${result.rows} 行` : JSON.stringify(result).slice(0, 120));
}

console.log("\n=== 老师身份任意事件（必须成功）===");
for (const [kind, label] of [["stroke", "画线"], ["rtc-offer", "语音发起"], ["end", "结束课堂"]]) {
  const result = insertAs(TEACHER_ID, kind, {});
  report(`老师 INSERT ${label}(${kind})`, result.status === "ok" && result.rows >= 1,
    result.status === "ok" ? `成功 ${result.rows} 行` : JSON.stringify(result).slice(0, 120));
}

console.log("\n=== 非参与者 INSERT（必须被拒）===");
const outsider = insertAs(OUTSIDER_ID, "rtc-ice", {});
report("非参与者 INSERT rtc-ice", outsider.status === "denied" && outsider.message.includes("row-level security"),
  outsider.status === "denied" ? "被 RLS 拒绝 ✓" : JSON.stringify(outsider).slice(0, 120));

console.log("\n=== CLEANUP: 删除本次测试事件 ===");
try {
  const out = runQuery(`
    delete from live_class_events
    where session_id = '${SESSION_ID}'
      and sender_id in ('${STUDENT_ID}', '${TEACHER_ID}', '${OUTSIDER_ID}')
      and created_at > now() - interval '10 minutes';
  `);
  console.log(`CLEANUP OK: ${out.trim() || "(empty)"}`);
} catch (error) {
  console.log(`CLEANUP FAILED: ${(error.stderr ? error.stderr.toString() : error.message).slice(0, 300)}`);
}

console.log(allPassed ? "\n=== 全部安全断言通过 ===" : "\n=== 存在失败断言！===");
process.exit(allPassed ? 0 : 1);
