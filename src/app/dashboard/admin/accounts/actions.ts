"use server";

import { revalidatePath } from "next/cache";
import { requireExecutive } from "@/lib/admin";
import {
  canManageTarget,
  getAssignableRoles,
  type AppRole,
} from "./permissions";

const VALID_STATUSES = ["active", "inactive", "suspended"];

async function requireManageableTarget(
  supabase: Awaited<ReturnType<typeof requireExecutive>>["supabase"],
  viewerRole: string,
  profileId: string
) {
  const { data: target, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !target) {
    throw new Error("找不到要管理的账号。");
  }

  // 老板账号不通过普通账号管理页修改，避免误降级或自我停用。
  if (target.role === "super_admin" || !canManageTarget(viewerRole, target.role)) {
    throw new Error("你没有权限管理这个账号。");
  }

  return target;
}

export async function updateProfileRoleAction(
  profileId: string,
  formData: FormData
) {
  const { supabase, role: viewerRole } = await requireExecutive();

  const newRole = String(formData.get("role") ?? "").trim();

  if (!profileId) {
    throw new Error("Missing profile_id");
  }

  const assignableRoles = getAssignableRoles(viewerRole);

  if (!assignableRoles.includes(newRole as AppRole)) {
    throw new Error("你不能分配这个角色。");
  }

  await requireManageableTarget(supabase, viewerRole, profileId);

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    throw new Error("角色更新失败，请稍后重试。");
  }

  revalidatePath("/dashboard/admin/accounts");
}

export async function updateProfileStatusAction(
  profileId: string,
  formData: FormData
) {
  const { supabase, role: viewerRole, user } = await requireExecutive();

  const newStatus = String(formData.get("status") ?? "").trim();
  const reason = String(formData.get("deactivate_reason") ?? "").trim();

  if (!profileId) {
    throw new Error("Missing profile_id");
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error("无效的账号状态。");
  }

  // 停用或暂停必须填原因，正常状态不需要
  if (newStatus !== "active" && !reason) {
    throw new Error("Missing deactivate_reason");
  }

  await requireManageableTarget(supabase, viewerRole, profileId);

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "active") {
    updatePayload.deactivated_at = null;
    updatePayload.deactivated_by = null;
    updatePayload.deactivate_reason = null;
  } else {
    updatePayload.deactivated_at = new Date().toISOString();
    updatePayload.deactivated_by = user.id;
    updatePayload.deactivate_reason = reason;
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", profileId)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    throw new Error("账号状态更新失败，请稍后重试。");
  }

  revalidatePath("/dashboard/admin/accounts");
}
