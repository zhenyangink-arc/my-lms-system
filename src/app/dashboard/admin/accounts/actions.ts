"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const VALID_ROLES = ["super_admin", "ceo", "admin", "teacher", "student"];
const VALID_STATUSES = ["active", "inactive", "suspended"];

export async function updateProfileRoleAction(
  profileId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const newRole = String(formData.get("role") ?? "").trim();

  if (!profileId) {
    throw new Error("Missing profile_id");
  }

  if (!VALID_ROLES.includes(newRole)) {
    throw new Error("Invalid role");
  }

  // 真正能不能改成功，由 SQL 21 的 RLS policy 判断
  // （CEO 想把某人改成老板/CEO，这里会被 Supabase 直接拒绝）
  const { error } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/admin/accounts");
}

export async function updateProfileStatusAction(
  profileId: string,
  formData: FormData
) {
  const supabase = await createClient();

  const newStatus = String(formData.get("status") ?? "").trim();
  const reason = String(formData.get("deactivate_reason") ?? "").trim();

  if (!profileId) {
    throw new Error("Missing profile_id");
  }

  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error("Invalid status");
  }

  // 停用或暂停必须填原因，正常状态不需要
  if (newStatus !== "active" && !reason) {
    throw new Error("Missing deactivate_reason");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === "active") {
    updatePayload.deactivated_at = null;
    updatePayload.deactivated_by = null;
    updatePayload.deactivate_reason = null;
  } else {
    updatePayload.deactivated_at = new Date().toISOString();
    updatePayload.deactivated_by = user?.id ?? null;
    updatePayload.deactivate_reason = reason;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/admin/accounts");
}