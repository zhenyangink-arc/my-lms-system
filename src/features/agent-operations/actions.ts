"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformOwner } from "@/lib/admin";
import { GUIDE_AGENT_DESTINATIONS, isAllowedGuideDestination } from "@/lib/guide-agent-targets";
import { matchGuideAgentRule } from "@/lib/guide-agent-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentRuleVersion } from "./types";

type UnknownRow = Record<string, unknown>;

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function finiteNumber(value: unknown, fallback = 0) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "规则名称至少需要 2 个字。").max(80),
  triggerPhrases: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  actionType: z.enum(["navigate", "highlight"]),
  targetPath: z.string().trim(),
  targetElementId: z.string().trim().max(100).nullable(),
  responseText: z.string().trim().min(2).max(200),
  priority: z.number().int().min(0).max(1000),
  status: z.enum(["enabled", "disabled"]),
});

export type AgentRuleActionResult = {
  ok: boolean;
  message: string;
  matchedRule?: string | null;
  targetLabel?: string | null;
};

function refreshAgentOperations() {
  revalidatePath("/platform/dashboard/admin/agents");
}

async function getProfileId(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("learning_agent_profiles")
    .select("id")
    .eq("agent_code", "uply-guide-agent")
    .eq("status", "published")
    .single();
  if (error || !data) return null;
  return String(data.id);
}

const AGENT_NOT_PUBLISHED_RESULT: AgentRuleActionResult = {
  ok: false,
  message: "导航助手尚未发布，暂时无法执行该操作。",
};

export async function saveAgentNavigationRule(input: unknown): Promise<AgentRuleActionResult> {
  const auth = await requirePlatformOwner();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "规则内容不完整。" };
  }
  const rule = parsed.data;
  if (!isAllowedGuideDestination(rule.targetPath)) {
    return { ok: false, message: "目标页面不在允许的学生页面列表中。" };
  }
  if (rule.actionType === "highlight" && !rule.targetElementId) {
    return { ok: false, message: "页面高亮规则需要填写元素标识。" };
  }

  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { error } = await auth.supabase.rpc("save_guide_agent_navigation_rule", {
    p_rule_id: rule.id ?? null,
    p_agent_profile_id: profileId,
    p_name: rule.name,
    p_trigger_phrases: Array.from(new Set(rule.triggerPhrases)),
    p_action_type: rule.actionType,
    p_target_path: rule.targetPath,
    p_target_element_id: rule.actionType === "highlight" ? rule.targetElementId : null,
    p_response_text: rule.responseText,
    p_priority: rule.priority,
    p_status: rule.status,
  });
  if (error) {
    return { ok: false, message: error?.code === "23505" ? "规则名称已经存在。" : "规则保存失败，请稍后再试。" };
  }
  refreshAgentOperations();
  return { ok: true, message: rule.id ? "规则已更新。" : "规则已创建。" };
}

export async function setAgentNavigationRuleStatus(
  ruleId: string,
  status: "enabled" | "disabled",
): Promise<AgentRuleActionResult> {
  const auth = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(ruleId).success) return { ok: false, message: "规则编号无效。" };
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { error } = await auth.supabase.rpc("set_guide_agent_navigation_rule_status", {
    p_rule_id: ruleId,
    p_agent_profile_id: profileId,
    p_status: status,
  });
  if (error) return { ok: false, message: "规则状态更新失败。" };
  refreshAgentOperations();
  return { ok: true, message: status === "enabled" ? "规则已启用。" : "规则已停用。" };
}

export async function deleteAgentNavigationRule(ruleId: string): Promise<AgentRuleActionResult> {
  const auth = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(ruleId).success) return { ok: false, message: "规则编号无效。" };
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { error } = await auth.supabase.rpc("delete_guide_agent_navigation_rule", {
    p_rule_id: ruleId,
    p_agent_profile_id: profileId,
  });
  if (error) return { ok: false, message: "规则删除失败。" };
  refreshAgentOperations();
  return { ok: true, message: "规则已删除。" };
}

export async function testAgentNavigationRule(message: string): Promise<AgentRuleActionResult> {
  await requirePlatformOwner();
  const safeMessage = z.string().trim().min(1).max(200).safeParse(message);
  if (!safeMessage.success) return { ok: false, message: "请输入要测试的学生表达。" };
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { data, error } = await admin
    .from("guide_agent_navigation_rules")
    .select("id,name,trigger_phrases,action_type,target_path,target_element_id,response_text,priority")
    .eq("agent_profile_id", profileId)
    .eq("status", "enabled")
    .order("priority", { ascending: false });
  if (error) return { ok: false, message: "暂时无法读取已启用规则。" };
  const matched = matchGuideAgentRule(safeMessage.data, data ?? []);
  if (!matched) return { ok: true, message: "没有命中本地规则，将交给模型回答。", matchedRule: null };
  const destination = GUIDE_AGENT_DESTINATIONS.find((item) => item.path === matched.targetPath);
  return {
    ok: true,
    message: `命中“${matched.name}”，将执行${matched.actionType === "highlight" ? "页面高亮" : "页面跳转"}。`,
    matchedRule: matched.name,
    targetLabel: destination?.label ?? matched.targetPath,
  };
}

export async function rollbackAgentNavigationRule(
  ruleId: string,
  versionNumber: number,
): Promise<AgentRuleActionResult> {
  const auth = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(ruleId).success || !z.number().int().positive().safeParse(versionNumber).success) {
    return { ok: false, message: "规则版本编号无效。" };
  }
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { error } = await auth.supabase.rpc("rollback_guide_agent_navigation_rule", {
    p_rule_id: ruleId,
    p_agent_profile_id: profileId,
    p_version_number: versionNumber,
  });
  if (error) {
    return { ok: false, message: error.code === "23505" ? "同名规则已经存在，无法恢复。" : "规则版本恢复失败。" };
  }
  refreshAgentOperations();
  return { ok: true, message: `规则已恢复到版本 ${versionNumber}，恢复前状态仍保留在版本历史中。` };
}

const validChangeTypes = new Set<AgentRuleVersion["changeType"]>([
  "created", "updated", "enabled", "disabled", "deleted", "rollback",
]);

export async function getAgentNavigationRuleVersions(ruleId: string): Promise<AgentRuleVersion[]> {
  const auth = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(ruleId).success) return [];
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return [];

  const { data, error } = await auth.supabase.rpc("list_guide_agent_navigation_rule_versions", {
    p_agent_profile_id: profileId,
    p_rule_id: ruleId,
  });
  if (error) return [];

  const rows = (data ?? []) as UnknownRow[];
  const actorIds = Array.from(new Set(rows.map((row) => String(row.actor_id ?? "")).filter(Boolean)));
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", actorIds)
    : { data: [] as UnknownRow[] };
  const actorById = new Map(
    ((actors ?? []) as UnknownRow[]).map((row) => [String(row.id), text(row.full_name, text(row.email, "平台负责人"))]),
  );

  return rows.map((row) => {
    const snapshot = row.snapshot && typeof row.snapshot === "object" && !Array.isArray(row.snapshot)
      ? row.snapshot as Record<string, unknown>
      : {};
    const changeType = validChangeTypes.has(String(row.change_type) as AgentRuleVersion["changeType"])
      ? String(row.change_type) as AgentRuleVersion["changeType"]
      : "updated";
    return {
      id: String(row.id),
      ruleId: String(row.rule_id),
      versionNumber: finiteNumber(row.version_number),
      name: text(snapshot.name, "未命名规则"),
      changeType,
      sourceVersionNumber: row.source_version_number === null || row.source_version_number === undefined
        ? null
        : finiteNumber(row.source_version_number),
      actorName: actorById.get(String(row.actor_id)) ?? "平台负责人",
      createdAt: String(row.created_at),
    };
  });
}

const behaviorSchema = z.object({
  systemPrompt: z.string().trim().min(40, "系统提示词至少需要 40 个字。").max(6000),
  maxOutputCharacters: z.number().int().min(120).max(1000),
});

export async function saveAgentBehaviorConfig(input: unknown): Promise<AgentRuleActionResult> {
  const auth = await requirePlatformOwner();
  const parsed = behaviorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Agent 配置不完整。" };
  const admin = createAdminClient();
  const profileId = await getProfileId(admin);
  if (!profileId) return AGENT_NOT_PUBLISHED_RESULT;
  const { error } = await auth.supabase.rpc("update_guide_agent_behavior", {
    p_agent_profile_id: profileId,
    p_system_prompt: parsed.data.systemPrompt,
    p_max_output_characters: parsed.data.maxOutputCharacters,
  });
  if (error) return { ok: false, message: "Agent 配置保存失败。" };
  refreshAgentOperations();
  return { ok: true, message: "Agent 配置已保存，新发起的模型回答将使用新配置。" };
}
