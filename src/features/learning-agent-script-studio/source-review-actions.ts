"use server";

import { requirePlatformOwner } from "@/lib/admin";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { z } from "zod";

export async function loadScriptSourceReview(versionId: string) {
  const { supabase } = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(versionId).success) return { ok: false as const, message: "请选择有效的脚本版本。" };
  const { data, error } = await supabase.rpc("get_teaching_script_source_review", { p_version_id: versionId });
  if (error) return { ok: false as const, message: "暂时无法读取教材复核信息，请刷新重试。" };
  return { ok: true as const, review: data as ScriptSourceReview };
}
export type ScriptSourceReview = {
  source: Record<string, unknown>; previousSource: Record<string, unknown> | null;
  scriptToken: string; revision: number; reviewedAt: string | null;
  sourceChanged: boolean; scriptChanged: boolean; status: "unreviewed" | "changed" | "reviewed";
};
export async function confirmScriptSourceReview(input: { versionId: string; review: ScriptSourceReview }) {
  const { supabase } = await requirePlatformOwner();
  if (!z.string().uuid().safeParse(input.versionId).success || !input.review || JSON.stringify(input.review).length > 2_000_000) {
    return { ok: false, message: "复核参数无效，请重新读取。" };
  }
  const { error } = await supabase.rpc("confirm_teaching_script_source_review", {
    p_version_id: input.versionId, p_revision: input.review.revision,
    p_source: input.review.source, p_script_token: input.review.scriptToken,
  });
  if (error) return { ok: false, message: error.code === "P0001" ? error.message : "复核保存失败，请重试。" };
  revalidateDashboard("/dashboard/admin/apps/[appSlug]/teaching-scripts", "page");
  return { ok: true, message: "已确认教材与脚本一致。后续编辑会要求重新复核。" };
}
