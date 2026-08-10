"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requirePlatformOwner } from "@/lib/admin";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { ASSIGNABLE_PERMISSION_KEYS } from "@/lib/permissions/catalog";

const permissionGrantSchema = z.object({
  targetUserId: z.uuid(),
  permissionKey: z.enum(ASSIGNABLE_PERMISSION_KEYS),
  tenantId: z.union([z.literal(""), z.uuid()]).optional(),
  enabled: z.enum(["true", "false"]),
  view: z.enum(["logic", "matrix", "account", "grants", "audit"]).optional(),
});

function permissionPageUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `${getDashboardBasePath(null)}/admin/permissions?${query.toString()}`;
}

export async function updateUnifiedPermissionGrantAction(formData: FormData) {
  const { supabase } = await requirePlatformOwner();
  const parsed = permissionGrantSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
    permissionKey: formData.get("permissionKey"),
    tenantId: String(formData.get("tenantId") ?? ""),
    enabled: formData.get("enabled"),
    view: formData.get("view") || "grants",
  });

  if (!parsed.success) {
    redirect(permissionPageUrl({ view: "grants", error: "权限参数不正确，请刷新页面后重试。" }));
  }

  const { targetUserId, permissionKey, tenantId, enabled, view } = parsed.data;
  const { error } = await supabase.rpc("set_user_permission_grant", {
    requested_subject_user_id: targetUserId,
    requested_permission_key: permissionKey,
    requested_tenant_id: tenantId || null,
    requested_enabled: enabled === "true",
  });

  if (error) {
    redirect(permissionPageUrl({
      view: view ?? "grants",
      ...(tenantId ? { tenant: tenantId } : {}),
      error: `权限更新失败：${error.message}`.slice(0, 120),
    }));
  }

  revalidateDashboard("/dashboard/admin/permissions");
  redirect(permissionPageUrl({
    view: view ?? "grants",
    ...(tenantId ? { tenant: tenantId } : {}),
    updated: "1",
  }));
}
