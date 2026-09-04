import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  matchGuideAgentRule,
  type GuideAgentRuleRow,
} from "@/lib/guide-agent-rule-matcher";

export { matchGuideAgentRule, type ResolvedGuideAgentRule } from "@/lib/guide-agent-rule-matcher";

export async function resolveGuideAgentRule({
  admin,
  agentProfileId,
  message,
}: {
  admin: SupabaseClient;
  agentProfileId: string;
  message: string;
}) {
  const { data, error } = await admin
    .from("guide_agent_navigation_rules")
    .select("id,name,trigger_phrases,action_type,target_path,target_element_id,response_text,priority")
    .eq("agent_profile_id", agentProfileId)
    .eq("status", "enabled")
    .order("priority", { ascending: false });

  // 迁移部署前保持助手可用；规则表读取失败时继续走模型，不把数据库细节暴露给学生。
  if (error) return null;
  return matchGuideAgentRule(message, (data ?? []) as GuideAgentRuleRow[]);
}
