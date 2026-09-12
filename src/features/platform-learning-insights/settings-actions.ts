"use server";

import { revalidatePath } from "next/cache";
import { requireManagementAppAccess } from "@/lib/management-apps";
import { createClient } from "@/lib/supabase/server";

export type PlatformSettingState = { status: "idle" | "success" | "error"; message?: string; updatedAt?: string };
export async function savePlatformAppSettings(appSlug: string, previous: PlatformSettingState, form: FormData): Promise<PlatformSettingState> {
  const access = await requireManagementAppAccess("platform", appSlug);
  if (access.scope !== "platform" || !access.capabilities.manageTenantAvailability) return { status: "error", message: "当前账号没有机构应用设置权限。" };
  const tenantId = String(form.get("tenant_id") ?? "");
  const title = String(form.get("custom_title") ?? "").trim();
  const status = String(form.get("status") ?? "");
  const stamp = previous.updatedAt ?? String(form.get("updated_at") ?? "");
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(tenantId) || !Number.isFinite(Date.parse(stamp)) || !["active", "coming_soon", "hidden"].includes(status) || [...title].length > 80) return { status: "error", message: "设置参数无效，请检查名称、状态后重试。", updatedAt: previous.updatedAt };
  if (form.get("is_enabled") === "on" && status === "active" && access.app.status !== "active") return { status: "error", message: "平台应用尚未开放，不能启用机构应用。", updatedAt: previous.updatedAt };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_platform_tenant_application_settings", { p_tenant_id: tenantId, p_app_id: access.appId, p_is_enabled: form.get("is_enabled") === "on", p_status: status, p_custom_title: title, p_expected_updated_at: stamp });
  if (error) return { status: "error", message: error.code === "PGRST202" ? "设置服务尚未更新，请稍后重试。" : error.message, updatedAt: previous.updatedAt };
  revalidatePath(`${access.appPath}/settings`);
  revalidatePath("/[space]/dashboard/admin/apps/[appSlug]", "layout");
  revalidatePath("/[space]/apps/[appSlug]", "layout");
  return { status: "success", message: "机构应用设置已保存，变更已记录。", updatedAt: String(data) };
}
