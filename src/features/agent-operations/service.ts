import "server-only";

import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AgentAuditLog,
  AgentConversation,
  AgentConversationFailure,
  AgentConversationMessage,
  AgentDeletedRuleSummary,
  AgentNavigationRule,
  AgentOperationsData,
} from "./types";

type UnknownRow = Record<string, unknown>;

export type AgentOperationsQuery = {
  includeConversations?: boolean;
  conversationPage?: number;
  conversationPageSize?: number;
  conversationQuery?: string;
  conversationAuditScope?: "overview" | "conversations";
};

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function finiteNumber(value: unknown, fallback = 0) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function localizedName(value: unknown, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  return text((value as Record<string, unknown>)["zh-CN"], fallback);
}

function emptyOperationsData(page: number, pageSize: number): AgentOperationsData {
  return {
    metrics: {
      conversations: 0,
      studentQuestions: 0,
      localRuleReplies: 0,
      modelReplies: 0,
      failedRequests: 0,
      failureRate: 0,
      averageFirstTokenMs: null,
    },
    conversations: [],
    conversationTotal: 0,
    conversationPage: page,
    conversationPageSize: pageSize,
    rules: [],
    deletedRules: [],
    modelConfig: null,
    behaviorConfig: null,
    auditLogs: [],
    hasQueryError: true,
  };
}

export async function getAgentOperationsData(options: AgentOperationsQuery = {}): Promise<AgentOperationsData> {
  const auth = await requirePlatformOwner();
  const admin = createAdminClient();
  const conversationPage = Math.max(1, Math.floor(options.conversationPage ?? 1));
  const conversationPageSize = Math.max(1, Math.min(50, Math.floor(options.conversationPageSize ?? 20)));
  const conversationQuery = options.conversationQuery?.trim().slice(0, 100) ?? "";
  const includeConversations = options.includeConversations === true;

  const { data: profile, error: profileError } = await admin
    .from("learning_agent_profiles")
    .select("id,agent_code,subject_code,display_name")
    .eq("agent_code", "uply-guide-agent")
    .eq("status", "published")
    .maybeSingle();

  if (profileError || !profile) {
    return emptyOperationsData(conversationPage, conversationPageSize);
  }

  const conversationsPromise = includeConversations
    ? auth.supabase.rpc("list_guide_agent_conversations", {
        p_agent_profile_id: profile.id,
        p_query: conversationQuery,
        p_limit: conversationPageSize,
        p_offset: (conversationPage - 1) * conversationPageSize,
        p_audit_scope: options.conversationAuditScope ?? "conversations",
      })
    : Promise.resolve({ data: [], error: null });

  const [metricsResult, sessionsResult, rulesResult, deletedRulesResult, secretResult, auditResult, modelAuditResult] = await Promise.all([
    auth.supabase.rpc("get_guide_agent_operations_metrics", { p_agent_profile_id: profile.id }),
    conversationsPromise,
    admin
      .from("guide_agent_navigation_rules")
      .select("id,name,trigger_phrases,action_type,target_path,target_element_id,response_text,priority,status,updated_at")
      .eq("agent_profile_id", profile.id)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false }),
    auth.supabase.rpc("list_guide_agent_deleted_navigation_rules", { p_agent_profile_id: profile.id }),
    admin
      .from("learning_agent_profile_secrets")
      .select("provider,model,system_prompt,reply_policy")
      .eq("agent_profile_id", profile.id)
      .maybeSingle(),
    admin
      .from("guide_agent_operation_logs")
      .select("id,actor_id,action,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("learning_agent_model_change_logs")
      .select("id,changed_by,previous_provider,previous_model,next_provider,next_model,created_at")
      .eq("agent_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  let sessionRows = (sessionsResult.data ?? []) as UnknownRow[];
  let resolvedConversationPage = conversationPage;
  // 请求的页码可能已经超出实际结果范围（会话被清理、或手动改了 URL 上的 page）；
  // 这种情况下窗口函数拿不到 total_count，会被误判为“总数为 0”，改为回退到第 1 页取真实总数。
  if (includeConversations && sessionRows.length === 0 && conversationPage > 1) {
    const { data: fallbackRows } = await auth.supabase.rpc("list_guide_agent_conversations", {
      p_agent_profile_id: profile.id,
      p_query: conversationQuery,
      p_limit: conversationPageSize,
      p_offset: 0,
      p_audit_scope: options.conversationAuditScope ?? "conversations",
    });
    sessionRows = (fallbackRows ?? []) as UnknownRow[];
    resolvedConversationPage = 1;
  }
  const sessionIds = sessionRows.map((row) => String(row.id));
  const auditActorIds = Array.from(new Set([
    ...((auditResult.data ?? []) as UnknownRow[]).map((row) => String(row.actor_id ?? "")),
    ...((modelAuditResult.data ?? []) as UnknownRow[]).map((row) => String(row.changed_by ?? "")),
  ].filter(Boolean)));

  const [messagesResult, failuresResult, actorsResult] = await Promise.all([
    sessionIds.length
      ? admin
          .from("guide_agent_messages")
          .select("id,session_id,role,content,actions,provider,model,response_mode,first_token_ms,total_duration_ms,created_at")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? admin
          .from("guide_agent_failures")
          .select("id,session_id,user_message_id,stage,error_code,provider,model,public_message,duration_ms,created_at")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [], error: null }),
    auditActorIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", auditActorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const hasQueryError = [
    metricsResult,
    sessionsResult,
    rulesResult,
    deletedRulesResult,
    secretResult,
    auditResult,
    modelAuditResult,
    messagesResult,
    failuresResult,
    actorsResult,
  ].some((result) => Boolean(result.error));

  const actorById = new Map(
    ((actorsResult.data ?? []) as UnknownRow[]).map((row) => [
      String(row.id),
      text(row.full_name, text(row.email, "平台负责人")),
    ]),
  );

  const messagesBySession = new Map<string, AgentConversationMessage[]>();
  for (const row of (messagesResult.data ?? []) as UnknownRow[]) {
    const sessionId = String(row.session_id);
    const current = messagesBySession.get(sessionId) ?? [];
    current.push({
      id: String(row.id),
      role: row.role === "assistant" ? "assistant" : "user",
      content: text(row.content, ""),
      actions: Array.isArray(row.actions) ? row.actions as Array<Record<string, unknown>> : [],
      provider: typeof row.provider === "string" ? row.provider : null,
      model: typeof row.model === "string" ? row.model : null,
      responseMode: row.response_mode === "local_rule" || row.response_mode === "model" ? row.response_mode : null,
      firstTokenMs: typeof row.first_token_ms === "number" ? row.first_token_ms : null,
      totalDurationMs: typeof row.total_duration_ms === "number" ? row.total_duration_ms : null,
      createdAt: String(row.created_at),
    });
    messagesBySession.set(sessionId, current);
  }

  const failuresBySession = new Map<string, AgentConversationFailure[]>();
  for (const row of (failuresResult.data ?? []) as UnknownRow[]) {
    const sessionId = String(row.session_id);
    const current = failuresBySession.get(sessionId) ?? [];
    const stage = ["environment", "upstream", "stream", "persistence", "historical"].includes(String(row.stage))
      ? String(row.stage) as AgentConversationFailure["stage"]
      : "historical";
    current.push({
      id: String(row.id),
      userMessageId: String(row.user_message_id),
      stage,
      errorCode: text(row.error_code, "unknown_failure"),
      provider: typeof row.provider === "string" ? row.provider : null,
      model: typeof row.model === "string" ? row.model : null,
      publicMessage: text(row.public_message, "助手没有完成本次回复。"),
      durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null,
      createdAt: String(row.created_at),
    });
    failuresBySession.set(sessionId, current);
  }

  const conversations: AgentConversation[] = sessionRows.map((row) => ({
    id: String(row.id),
    studentName: text(row.student_name, "未知学生"),
    tenantName: text(row.tenant_name, "未知机构"),
    status: text(row.status, "active"),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    messages: messagesBySession.get(String(row.id)) ?? [],
    failures: failuresBySession.get(String(row.id)) ?? [],
  }));

  const rules: AgentNavigationRule[] = ((rulesResult.data ?? []) as UnknownRow[]).map((row) => ({
    id: String(row.id),
    name: text(row.name),
    triggerPhrases: Array.isArray(row.trigger_phrases) ? row.trigger_phrases.map(String) : [],
    actionType: row.action_type === "highlight" ? "highlight" : "navigate",
    targetPath: text(row.target_path, "/dashboard"),
    targetElementId: typeof row.target_element_id === "string" ? row.target_element_id : null,
    responseText: text(row.response_text),
    priority: finiteNumber(row.priority),
    status: row.status === "disabled" ? "disabled" : "enabled",
    updatedAt: String(row.updated_at),
  }));

  const deletedRules: AgentDeletedRuleSummary[] = ((deletedRulesResult.data ?? []) as UnknownRow[]).map((row) => ({
    ruleId: String(row.rule_id),
    name: text(row.name, "未命名规则"),
    lastVersionNumber: finiteNumber(row.last_version_number),
    deletedAt: String(row.deleted_at),
  }));

  const auditLogs: AgentAuditLog[] = [
    ...((auditResult.data ?? []) as UnknownRow[]).map((row) => ({
      id: String(row.id),
      action: text(row.action),
      summary: text(row.summary),
      actorName: actorById.get(String(row.actor_id)) ?? "平台负责人",
      createdAt: String(row.created_at),
    })),
    ...((modelAuditResult.data ?? []) as UnknownRow[]).map((row) => ({
      id: String(row.id),
      action: "切换模型",
      summary: `${text(row.previous_provider)} / ${text(row.previous_model)} → ${text(row.next_provider)} / ${text(row.next_model)}`,
      actorName: actorById.get(String(row.changed_by)) ?? "平台负责人",
      createdAt: String(row.created_at),
    })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 100);

  const metricRow = metricsResult.data && typeof metricsResult.data === "object" && !Array.isArray(metricsResult.data)
    ? metricsResult.data as Record<string, unknown>
    : {};
  const modelReplies = finiteNumber(metricRow.modelReplies);
  const failedRequests = finiteNumber(metricRow.failedRequests);
  const measuredFirstToken = metricRow.averageFirstTokenMs;
  const provider = secretResult.data?.provider;
  const modelConfig = provider === "qwen" || provider === "deepseek"
    ? {
        agentCode: String(profile.agent_code),
        displayName: localizedName(profile.display_name, String(profile.agent_code)),
        subjectCode: String(profile.subject_code),
        provider,
        model: String(secretResult.data?.model ?? ""),
      }
    : null;
  const replyPolicy = secretResult.data?.reply_policy && typeof secretResult.data.reply_policy === "object"
    ? secretResult.data.reply_policy as Record<string, unknown>
    : {};
  const behaviorConfig = secretResult.data
    ? {
        systemPrompt: text(secretResult.data.system_prompt, ""),
        maxOutputCharacters: Math.max(120, Math.min(1000, Number(replyPolicy.maxOutputCharacters) || 480)),
      }
    : null;

  return {
    metrics: {
      conversations: finiteNumber(metricRow.conversations),
      studentQuestions: finiteNumber(metricRow.studentQuestions),
      localRuleReplies: finiteNumber(metricRow.localRuleReplies),
      modelReplies,
      failedRequests,
      failureRate: modelReplies + failedRequests > 0
        ? Math.round((failedRequests / (modelReplies + failedRequests)) * 1000) / 10
        : 0,
      averageFirstTokenMs: measuredFirstToken === null || measuredFirstToken === undefined
        ? null
        : finiteNumber(measuredFirstToken),
    },
    conversations,
    conversationTotal: sessionRows[0] ? finiteNumber(sessionRows[0].total_count) : 0,
    conversationPage: resolvedConversationPage,
    conversationPageSize,
    rules,
    deletedRules,
    modelConfig,
    behaviorConfig,
    auditLogs,
    hasQueryError,
  };
}
