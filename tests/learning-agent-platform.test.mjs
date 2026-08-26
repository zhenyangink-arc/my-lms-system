import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("多学科 Agent 平台无损迁移韩语教学脚本、会话与消息", async () => {
  const sql = await readFile(new URL("supabase/migrations/202608260002_multi_subject_learning_agent_runtime.sql", root), "utf8");
  for (const table of [
    "learning_agent_profiles",
    "learning_agent_profile_secrets",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /rename to learning_agent_lessons/);
  assert.match(sql, /rename to learning_agent_sessions/);
  assert.match(sql, /agent_code[\s\S]*uply-korean-teacher/);
  assert.match(sql, /revoke all on public\.learning_agent_profile_secrets from anon, authenticated/);
});

test("不同课程 Agent 可分别选择 Qwen 或 DeepSeek 且密钥仅在 Edge Function 读取", async () => {
  const edge = await readFile(new URL("supabase/functions/learning-agent-runtime/index.ts", root), "utf8");
  assert.match(edge, /learning_agent_profile_secrets/);
  assert.match(edge, /profile\.provider === "deepseek"/);
  assert.match(edge, /DASHSCOPE_API_KEY/);
  assert.match(edge, /DEEPSEEK_API_KEY/);
  assert.match(edge, /stream: true/);
  assert.doesNotMatch(edge, /sk-[A-Za-z0-9]/);
});

test("教学区从通用学习 Agent API 流式读取并按真实进度定位活动", async () => {
  const route = await readFile(new URL("src/app/api/learning-agent/respond/route.ts", root), "utf8");
  const shell = await readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8");
  assert.match(route, /digital_textbook_node_progress/);
  assert.match(route, /X-Learning-Agent-Action/);
  assert.match(route, /functions\/v1\/learning-agent-runtime/);
  assert.match(shell, /\/api\/learning-agent\/respond/);
  assert.match(shell, /textbook\.agent\.code/);
  assert.match(shell, /response\.body\.getReader\(\)/);
  assert.match(shell, /data-smart-textbook-activity-id/);
  assert.match(shell, /tutorReply\("ready"\)/);
});
