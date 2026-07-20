"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAccountOwner, requireExecutive } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { isValidLoginId, loginIdToInternalEmail, normalizeLoginId } from "@/lib/login-id";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountActionState } from "./action-state";
import {
  canManageTarget,
  getAssignableRoles,
  type AppRole,
} from "./permissions";

const VALID_STATUSES = ["active", "inactive", "suspended"];
const VALID_MEMBERSHIP_TIERS = ["normal", "vip1", "vip2", "vip3"];
const CREATABLE_ACCOUNT_ROLES = ["teacher", "student"] as const;

function actionError(message: string): AccountActionState {
  return { status: "error", message };
}

function actionSuccess(message: string): AccountActionState {
  return { status: "success", message };
}

function accountCreationError(error: { code?: string; message?: string; status?: number } | null): AccountActionState {
  console.error("Managed account creation failed", {
    code: error?.code,
    status: error?.status,
    message: error?.message,
  });

  if (error?.code === "email_exists" || error?.code === "user_already_exists") {
    return actionError("该登录账号已被使用，请更换账号。");
  }

  if (error?.code === "email_address_invalid") {
    return actionError("系统内部登录邮箱格式无效，请联系平台负责人检查账号配置。");
  }

  if (error?.code === "unexpected_failure" || error?.message?.toLowerCase().includes("database error")) {
    return actionError("认证账号建档失败：数据库触发器或资料约束异常，请联系平台负责人。");
  }

  const diagnosticCode = error?.code || (error?.status ? `HTTP ${error.status}` : "unknown");
  return actionError(`账号创建失败（${diagnosticCode}），请联系平台负责人。`);
}

/** 平台负责人可给指定机构开户；机构负责人只能给自己的当前机构开户。 */
export async function createManagedAccountAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  void _previousState;
  const name = String(formData.get("full_name") ?? "").trim();
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("initial_password") ?? "");
  const role = String(formData.get("role") ?? "");
  const requestedTenantId = String(formData.get("tenant_id") ?? "").trim();

  if (name.length < 2 || name.length > 50) return actionError("姓名需要填写 2 至 50 个字符。");
  if (!isValidLoginId(loginId)) return actionError("登录账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。");
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return actionError("初始密码需为 8 至 72 位，并同时包含字母和数字。");
  if (!CREATABLE_ACCOUNT_ROLES.includes(role as (typeof CREATABLE_ACCOUNT_ROLES)[number])) return actionError("这里只能创建员工或学生账号。");

  const auth = await requireActiveUser();
  const isPlatformOwner = auth.platformProfile?.role === "platform_super_admin";
  const isTenantOwner = auth.tenant?.role === "tenant_super_admin";
  if (!isPlatformOwner && !isTenantOwner) return actionError("只有平台负责人或机构负责人可以创建账号。");

  const tenantId = isPlatformOwner ? (requestedTenantId || auth.tenant?.id || "") : auth.tenant?.id ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) return actionError("机构编号不正确。");

  const admin = createAdminClient();
  const { data: tenant } = await admin.from("tenants").select("id").eq("id", tenantId).eq("status", "active").maybeSingle();
  if (!tenant) return actionError("目标机构不存在或当前不可用。");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginIdToInternalEmail(loginId), password, email_confirm: true,
    user_metadata: { full_name: name, name, login_id: loginId },
  });
  if (createError || !created.user) return accountCreationError(createError);

  const userId = created.user.id;
  const { error: profileError } = await admin.from("profiles").update({ full_name: name, login_id: loginId, role, global_role: "member", status: "active", membership_tier: "normal" }).eq("id", userId);
  const { error: cleanupError } = await admin.from("tenant_memberships").delete().eq("user_id", userId);
  const { error: membershipError } = await admin.from("tenant_memberships").insert({
    tenant_id: tenantId, user_id: userId, role, status: "active", membership_tier: "normal",
    is_default: true, invited_by: auth.user.id, joined_at: new Date().toISOString(),
  });

  if (profileError || cleanupError || membershipError) {
    await admin.auth.admin.deleteUser(userId);
    return actionError("账号已回滚：机构归属或角色配置失败，请稍后重试。");
  }

  revalidatePath("/dashboard/admin/accounts");
  revalidatePath(`/dashboard/admin/tenants/${tenantId}`);
  return actionSuccess(`${role === "teacher" ? "员工" : "学生"}账号已创建，请安全交付登录账号和初始密码。`);
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
  if (target.role === "tenant_super_admin" || !canManageTarget(viewerRole, target.role)) {
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
  const { supabase, user } = await requireAccountOwner();
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
  if (target.role === "tenant_super_admin") return actionError("机构负责人账号不能通过管理页面删除。");

  const expectedConfirmation = (target.email || target.id.slice(-6)).trim().toLocaleLowerCase();
  if (confirmation.toLocaleLowerCase() !== expectedConfirmation) {
    return actionError("删除确认内容不正确，请完整输入账号邮箱或编号后六位。");
  }

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

  revalidatePath("/dashboard/admin/accounts");
  revalidatePath(`/dashboard/admin/accounts/${profileId}`);
  redirect(storageCleanupFailed ? "/dashboard/admin/accounts?deleted=cleanup" : "/dashboard/admin/accounts?deleted=1");
}
