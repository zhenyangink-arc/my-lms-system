"use server";
import { revalidatePath } from "next/cache";
import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";
export type FollowupState = { status: "idle" | "success" | "error"; message?: string; id?: string; savedStatus?: string };
export async function saveInstitutionFollowup(appSlug: string, previous: FollowupState, form: FormData): Promise<FollowupState> {
  const access = await requireManagementAppAccess("platform", appSlug);
  if (access.scope !== "platform" || !access.capabilities.manageTenantAvailability) return { status: "error", message: "当前账号没有机构跟进权限。" };
  const topic = String(form.get("topic") ?? "");
  const tenant = String(form.get("tenant") ?? "");
  const expected = previous.id ?? String(form.get("expected") ?? "");
  const status = String(form.get("status") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!uuid.test(tenant) || (expected && !uuid.test(expected)) || !["grades", "records", "conversation"].includes(topic) || !["pending", "in_progress", "resolved"].includes(status) || !note || [...note].length > 2000) return { ...previous, status: "error", message: "请检查机构、状态和处理说明。" };
  const client = await createClient();
  const { data, error } = await client.rpc("append_institution_learning_followup", { p_tenant_id: tenant, p_app_id: access.appId, p_topic: topic, p_status: status, p_note: note, p_expected_id: expected || null });
  if (error) return { ...previous, status: "error", message: error.code === "40001" ? "其他人已更新跟进，请刷新后核对最新记录。" : "跟进保存失败，请刷新后重试。" };
  revalidatePath(`${access.appPath}/${topic}`);
  return { status: "success", message: "跟进已保存，处理历史已保留。", id: String(data), savedStatus: status };
}
