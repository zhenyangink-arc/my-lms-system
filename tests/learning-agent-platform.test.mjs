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
  assert.match(shell, /startTutorLesson/);
  assert.match(shell, /我准备好了，开始学习/);
  assert.match(shell, /!tutorStarted/);
  assert.match(shell, /tutorReply\("ready"\)/);
});

test("平台模型用量按 Qwen、DeepSeek、模型与使用场景独立统计", async () => {
  const migration = await readFile(new URL("supabase/migrations/202608260003_split_ai_usage_by_provider.sql", root), "utf8");
  const service = await readFile(new URL("src/features/model-usage/api/service.ts", root), "utf8");
  const table = await readFile(new URL("src/features/model-usage/components/model-usage-table/index.tsx", root), "utf8");
  const edge = await readFile(new URL("supabase/functions/learning-agent-runtime/index.ts", root), "utf8");
  assert.match(migration, /add column if not exists provider text/);
  assert.match(migration, /feature_code/);
  assert.match(service, /provider,model,feature_code,agent_code/);
  assert.match(service, /groupByProviderAndModel/);
  assert.match(table, /Qwen 与 DeepSeek 用量对比/);
  assert.match(table, /providerTotals/);
  assert.match(table, /分模型统计/);
  assert.match(table, /item\.models\.entries\(\)/);
  assert.match(edge, /feature_code: "learning_agent"/);
  assert.match(edge, /agent_code: agentCode/);
});

test("机构负责人只查看机构总体用量，不显示供应商拆分", async () => {
  const service = await readFile(new URL("src/features/model-usage/api/service.ts", root), "utf8");
  const table = await readFile(new URL("src/features/model-usage/components/model-usage-table/index.tsx", root), "utf8");
  const toolbar = await readFile(new URL("src/features/model-usage/components/model-usage-table/model-usage-table-toolbar.tsx", root), "utf8");
  const activity = await readFile(new URL("src/features/model-usage/components/model-usage-table/activity-dialog.tsx", root), "utf8");
  assert.match(service, /canViewAllTenants[\s\S]*groupByProviderAndModel\(tenantUsageRows\)[\s\S]*\[tenantUsageRows\]/);
  assert.match(service, /model: canViewAllTenants \? first\.model : "全部模型"/);
  assert.match(table, /canViewAllTenants && \([\s\S]*Qwen 与 DeepSeek 用量对比/);
  assert.match(toolbar, /canViewAllTenants && \([\s\S]*模型供应商/);
  assert.match(activity, /showProviderDetails && \([\s\S]*供应商 \/ 模型/);
});

test("只有平台负责人可以切换教学 Agent 模型并留下审计记录", async () => {
  const migration = await readFile(new URL("supabase/migrations/202608260004_learning_agent_model_switch_audit.sql", root), "utf8");
  const route = await readFile(new URL("src/app/api/admin/model-usage/learning-agent-model/route.ts", root), "utf8");
  const listing = await readFile(new URL("src/features/model-usage/components/model-usage-listing.tsx", root), "utf8");
  const settings = await readFile(new URL("src/features/model-usage/components/learning-agent-model-settings.tsx", root), "utf8");
  const modelOptions = await readFile(new URL("src/features/model-usage/model-options.ts", root), "utf8");
  assert.match(migration, /learning_agent_model_change_logs/);
  assert.match(migration, /set_learning_agent_model/);
  assert.match(migration, /revoke all on function[\s\S]*authenticated/);
  assert.match(route, /isPlatformOwnerRole\(auth\.platformProfile\?\.role\)/);
  assert.match(route, /只有平台负责人可以修改教学引擎模型/);
  assert.match(route, /admin\.rpc\("set_learning_agent_model"/);
  assert.match(listing, /result\.canViewAllTenants && \([\s\S]*LearningAgentModelSettings/);
  assert.match(settings, /教学引擎配置/);
  assert.match(settings, /LEARNING_AGENT_MODEL_OPTIONS/);
  assert.match(settings, /left\.agentCode === "uply-guide-agent"/);
  assert.match(modelOptions, /deepseek-v4-flash/);
  assert.match(modelOptions, /deepseek-v4-pro/);
  assert.doesNotMatch(modelOptions, /deepseek-chat|deepseek-reasoner/);
});

test("UPLY 导航助手由站内 Agent 运行时驱动且不再依赖 Dify", async () => {
  const migration = await readFile(new URL("supabase/migrations/202608260005_uply_guide_agent.sql", root), "utf8");
  const route = await readFile(new URL("src/app/api/agent-chat/route.ts", root), "utf8");
  const runtime = await readFile(new URL("supabase/functions/guide-agent-runtime/index.ts", root), "utf8");
  const component = await readFile(new URL("src/components/guide-agent/GuideAgentChat.tsx", root), "utf8");
  const envExample = await readFile(new URL(".env.example", root), "utf8");
  assert.match(migration, /uply-guide-agent/);
  assert.match(migration, /guide_agent_sessions/);
  assert.match(migration, /guide_agent_messages/);
  assert.match(route, /getGuideAgentStudentContext/);
  assert.match(route, /functions\/v1\/guide-agent-runtime/);
  assert.match(route, /resolveGuideAgentRule/);
  assert.match(runtime, /feature_code: "guide_agent"/);
  assert.match(runtime, /learning_agent_profile_secrets/);
  assert.match(component, /UPLY 导航助手/);
  assert.doesNotMatch(route, /Dify|DIFY_/);
  assert.doesNotMatch(envExample, /Dify|DIFY_/);
});

test("门户提问框可连续转交消息，助手失败只显示局部提示", async () => {
  const lazyChat = await readFile(
    new URL("src/components/guide-agent/LazyGuideAgentChat.tsx", root),
    "utf8",
  );
  const chat = await readFile(
    new URL("src/components/guide-agent/GuideAgentChat.tsx", root),
    "utf8",
  );
  const route = await readFile(
    new URL("src/app/api/agent-chat/route.ts", root),
    "utf8",
  );

  assert.match(lazyChat, /promptSequenceRef\.current \+= 1/);
  assert.match(lazyChat, /id: promptSequenceRef\.current/);
  assert.match(chat, /lastForwardedPromptIdRef/);
  assert.match(chat, /initialPrompt\.message/);
  assert.match(chat, /failureMessage/);
  assert.doesNotMatch(chat, /console\.error/);
  assert.doesNotMatch(route, /console\.error/);
});

test("Agent 运营中心仅平台负责人可见并支持会话、规则与审计", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202609040002_agent_operations_center.sql", root),
    "utf8",
  );
  const navigation = await readFile(
    new URL("src/app/dashboard/admin/admin-navigation.ts", root),
    "utf8",
  );
  const page = await readFile(
    new URL("src/app/dashboard/admin/agents/page-content.tsx", root),
    "utf8",
  );
  const service = await readFile(
    new URL("src/features/agent-operations/service.ts", root),
    "utf8",
  );
  const actions = await readFile(
    new URL("src/features/agent-operations/actions.ts", root),
    "utf8",
  );
  const agentRoute = await readFile(
    new URL("src/app/api/agent-chat/route.ts", root),
    "utf8",
  );
  const hardeningMigration = await readFile(
    new URL("supabase/migrations/202609040004_harden_agent_operations.sql", root),
    "utf8",
  );

  assert.match(migration, /guide_agent_navigation_rules/);
  assert.match(migration, /guide_agent_operation_logs/);
  assert.match(migration, /revoke all on public\.guide_agent_navigation_rules from public, anon, authenticated/);
  assert.match(migration, /grant all on public\.guide_agent_navigation_rules to service_role/);
  assert.match(navigation, /label: "Agent 运营中心"[\s\S]*roles: \["platform_super_admin"\]/);
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(actions, /requirePlatformOwner\(\)/);
  assert.match(actions, /isAllowedGuideDestination/);
  assert.match(actions, /saveAgentBehaviorConfig/);
  assert.match(actions, /system_prompt/);
  assert.match(page, /运行概览/);
  assert.match(page, /会话记录/);
  assert.match(page, /导航规则/);
  assert.match(page, /Agent 配置/);
  assert.match(page, /操作日志/);
  assert.match(agentRoute, /response_mode: "local_rule"/);
  assert.match(agentRoute, /response_mode: "model"/);
  assert.match(agentRoute, /X-Guide-Agent-Mode/);
  assert.match(agentRoute, /recordGuideAgentFailure/);
  assert.match(hardeningMigration, /guide_agent_navigation_rule_versions/);
  assert.match(hardeningMigration, /guide_agent_failures/);
  assert.match(hardeningMigration, /enforce_guide_agent_event_append_only/);
  assert.match(hardeningMigration, /save_guide_agent_navigation_rule[\s\S]*guide_agent_operation_logs/);
  assert.match(hardeningMigration, /list_guide_agent_conversations/);
  assert.match(actions, /rollbackAgentNavigationRule/);
  assert.match(page, /failureRate/);
  assert.match(page, /会话分页/);
});
