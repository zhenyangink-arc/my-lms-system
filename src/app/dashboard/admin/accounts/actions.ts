"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireExecutive, requireOwner } from "@/lib/admin";
import type { AccountActionState } from "./action-state";
import {
  canManageTarget,
  getAssignableRoles,
  type AppRole,
} from "./permissions";

const VALID_STATUSES = ["active", "inactive", "suspended"];
const VALID_MEMBERSHIP_TIERS = ["normal", "vip1", "vip2", "vip3"];

function actionError(message: string): AccountActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): AccountActionState {
  return { status: "success", message };
}

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
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { supabase, role: viewerRole } = await requireExecutive();
  const newRole = String(formData.get("role") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");

  const assignableRoles = getAssignableRoles(viewerRole);
  if (!assignableRoles.includes(newRole as AppRole)) {
    return actionError("你不能分配这个角色。");
  }

  try {
    const target = await requireManageableTarget(supabase, viewerRole, profileId);
    if (target.role === newRole) return actionSuccess("账号角色没有变化。");

    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", profileId)
      .select("id")
      .maybeSingle();

    if (error || !updatedProfile) {
      return actionError("角色更新失败，请稍后重试。");
    }

    revalidatePath("/dashboard/admin/accounts");
    revalidatePath(`/dashboard/admin/accounts/${profileId}`);
    return actionSuccess("账号角色已更新。");
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "角色更新失败，请稍后重试。");
  }
}

export async function updateProfileStatusAction(
  profileId: string,
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { supabase, role: viewerRole, user } = await requireExecutive();
  const newStatus = String(formData.get("status") ?? "").trim();
  const reason = String(formData.get("deactivate_reason") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");
  if (!VALID_STATUSES.includes(newStatus)) return actionError("请选择有效的账号状态。");
  if (newStatus !== "active" && !reason) return actionError("暂停或停用账号时必须填写原因。");
  if (reason.length > 300) return actionError("状态原因不能超过 300 个字。");

  try {
    await requireManageableTarget(supabase, viewerRole, profileId);

    const updatePayload: Record<string, unknown> = { status: newStatus };
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
      return actionError("账号状态更新失败，请稍后重试。");
    }

    revalidatePath("/dashboard/admin/accounts");
    revalidatePath(`/dashboard/admin/accounts/${profileId}`);
    return actionSuccess(newStatus === "active" ? "账号已恢复正常使用。" : "账号状态已更新。");
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "账号状态更新失败，请稍后重试。");
  }
}

/** 会员档位与后台角色分开管理，避免把学生服务权限误做成后台权限。 */
export async function updateMembershipTierAction(
  profileId: string,
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { supabase, role: viewerRole, user } = await requireExecutive();
  const membershipTier = String(formData.get("membership_tier") ?? "").trim();

  if (!VALID_MEMBERSHIP_TIERS.includes(membershipTier)) {
    return actionError("请选择有效的学生会员档位。");
  }

  try {
    const target = await requireManageableTarget(supabase, viewerRole, profileId);
    if (target.role !== "student") return actionError("会员档位只适用于学生账号。");

    const { error } = await supabase
      .from("profiles")
      .update({
        membership_tier: membershipTier,
        membership_updated_at: new Date().toISOString(),
        membership_updated_by: user.id,
      })
      .eq("id", profileId);

    if (error) return actionError("会员档位更新失败，请稍后重试。");

    revalidatePath("/dashboard/admin/accounts");
    revalidatePath(`/dashboard/admin/accounts/${profileId}`);
    return actionSuccess("学生会员档位已更新。");
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "会员档位更新失败，请稍后重试。");
  }
}

/**
 * 永久删除只能由负责人执行。数据库函数会再次校验负责人身份、目标账号和确认内容，
 * 服务端动作另外负责通过 Storage 接口清理账号遗留的私有文件。
 */
export async function deleteAccountAction(
  profileId: string,
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  void _previousState;
  const { supabase, user } = await requireOwner();
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const reason = String(formData.get("deletion_reason") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");
  if (profileId === user.id) return actionError("不能删除当前登录的负责人账号。");
  if (reason.length < 2 || reason.length > 300) return actionError("删除原因需要填写 2 至 300 个字。");

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_path")
    .eq("id", profileId)
    .maybeSingle();

  if (targetError || !target) return actionError("找不到要删除的账号。");
  if (target.role === "super_admin") return actionError("负责人账号不能通过管理页面删除。");

  const expectedConfirmation = (target.email || target.id.slice(-6)).trim().toLocaleLowerCase();
  if (confirmation.toLocaleLowerCase() !== expectedConfirmation) {
    return actionError("删除确认内容不正确，请完整输入账号邮箱或编号后六位。");
  }

  // 在删除数据库行之前保存文件路径；账号删除后业务表会通过外键级联清理。
  const { data: documents } = await supabase
    .from("student_application_documents")
    .select("id, storage_path")
    .eq("user_id", profileId);
  const documentIds = (documents ?? []).map((document) => document.id);
  const fileVersionsResult = documentIds.length > 0
    ? await supabase
        .from("student_application_document_files")
        .select("storage_path")
        .in("document_id", documentIds)
    : { data: [], error: null };

  const applicationPaths = [...new Set([
    ...(documents ?? []).map((document) => document.storage_path),
    ...(fileVersionsResult.data ?? []).map((file) => file.storage_path),
  ].filter((path): path is string => Boolean(path)))];

  const { error: deleteError } = await supabase.rpc("delete_managed_account", {
    requested_user_id: profileId,
    requested_confirmation: confirmation,
    requested_reason: reason,
  });

  if (deleteError) return actionError("账号删除失败，请确认当前账号是负责人并稍后重试。");

  let storageCleanupFailed = false;
  if (target.avatar_path) {
    const { error } = await supabase.storage.from("profile-photos").remove([target.avatar_path]);
    storageCleanupFailed = storageCleanupFailed || Boolean(error);
  }
  // Storage 单次删除控制在 100 个路径以内，避免测试账号积累大量版本时超出接口限制。
  for (let index = 0; index < applicationPaths.length; index += 100) {
    const { error } = await supabase.storage
      .from("application-documents")
      .remove(applicationPaths.slice(index, index + 100));
    storageCleanupFailed = storageCleanupFailed || Boolean(error);
  }

  revalidatePath("/dashboard/admin/accounts");
  revalidatePath(`/dashboard/admin/accounts/${profileId}`);
  redirect(storageCleanupFailed ? "/dashboard/admin/accounts?deleted=cleanup" : "/dashboard/admin/accounts?deleted=1");
}
