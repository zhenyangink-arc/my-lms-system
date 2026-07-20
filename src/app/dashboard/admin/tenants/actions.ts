"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformOwner, requirePlatformTenantManager } from "@/lib/admin";
import { isValidLoginId, loginIdToInternalEmail, normalizeLoginId } from "@/lib/login-id";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantActionState } from "./action-state";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "租户名称至少需要 2 个字。").max(80, "租户名称不能超过 80 个字。"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "租户标识只能使用小写字母、数字和短横线。")
    .min(2, "租户标识至少需要 2 个字符。")
    .max(48, "租户标识不能超过 48 个字符。"),
  planKey: z.enum(["starter", "growth", "enterprise"]),
  managerName: z.string().trim().min(2, "管理员姓名至少需要 2 个字。").max(50, "管理员姓名不能超过 50 个字。"),
  managerLoginId: z.string().trim().transform(normalizeLoginId),
  initialPassword: z
    .string()
    .min(8, "初始密码至少需要 8 位。")
    .max(72, "初始密码不能超过 72 位。")
    .regex(/[A-Za-z]/, "初始密码需要包含字母。")
    .regex(/[0-9]/, "初始密码需要包含数字。"),
});

function result(status: TenantActionState["status"], message: string): TenantActionState {
  return { status, message };
}

function tenantDeletionErrorMessage(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  const databaseMessage = error.message?.trim();

  if (databaseMessage?.includes("请先停用租户")) {
    return "永久删除失败：请先停用租户。";
  }
  if (databaseMessage?.includes("删除确认租户标识不正确")) {
    return "永久删除失败：输入的租户标识不正确。";
  }
  if (databaseMessage?.includes("只有负责人或副负责人")) {
    return "永久删除失败：当前账号没有租户生命周期管理权限。";
  }
  if (error.code === "23503") {
    return `永久删除失败：仍有关联数据阻止删除。${error.details ? ` ${error.details}` : ""}`;
  }

  return `永久删除失败：${databaseMessage || "数据库未返回具体原因"}${
    error.code ? `（错误码 ${error.code}）` : ""
  }`;
}

export async function createDeputyOwnerAction(_previousState: TenantActionState, formData: FormData): Promise<TenantActionState> {
  void _previousState;
  const name = String(formData.get("name") ?? "").trim();
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("initial_password") ?? "");
  if (name.length < 2 || name.length > 50) return result("error", "副负责人姓名需为 2 至 50 个字符。");
  if (!isValidLoginId(loginId)) return result("error", "登录账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。");
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return result("error", "初始密码需为 8 至 72 位，并同时包含字母和数字。");
  await requirePlatformOwner();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginIdToInternalEmail(loginId), password, email_confirm: true,
    user_metadata: { full_name: name, name, login_id: loginId },
  });
  if (createError || !created.user) return result("error", "副负责人账号创建失败：登录账号可能已被使用。");
  const { error: profileError } = await admin.from("profiles").update({
    full_name: name,
    login_id: loginId,
    role: "tenant_operator",
    global_role: "platform_deputy",
    status: "active",
  }).eq("id", created.user.id);
  const { error: membershipCleanupError } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("user_id", created.user.id);
  if (profileError || membershipCleanupError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return result("error", "副负责人权限配置失败，账号已回滚。");
  }
  revalidatePath("/dashboard/admin/tenants");
  return result("success", "副负责人已设立；其仅可开通和管理租户。");
}

export async function createTenantAction(
  _previousState: TenantActionState,
  formData: FormData
): Promise<TenantActionState> {
  void _previousState;
  const input = tenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    planKey: formData.get("plan_key"),
    managerName: formData.get("manager_name"),
    managerLoginId: formData.get("manager_login_id"),
    initialPassword: formData.get("initial_password"),
  });

  if (!input.success) {
    return result("error", input.error.issues[0]?.message ?? "租户信息不正确。");
  }
  if (!isValidLoginId(input.data.managerLoginId)) {
    return result("error", "管理员账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。");
  }

  const { supabase, user } = await requirePlatformTenantManager();
  const { data: tenantId, error } = await supabase.rpc("create_tenant", {
    requested_name: input.data.name,
    requested_slug: input.data.slug,
    requested_plan_key: input.data.planKey,
  });

  if (error?.code === "PGRST202" || error?.code === "PGRST205" || error?.code === "42P01") {
    return result("error", "租户控制面尚未启用，请先应用多租户数据库迁移。");
  }
  if (error?.code === "23505") {
    return result("error", "该租户标识已被使用，请换一个。");
  }
  if (error) {
    console.error("Tenant creation RPC failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return result("error", "租户创建失败，请稍后重试。");
  }

  const admin = createAdminClient();
  const { data: created, error: createUserError } = await admin.auth.admin.createUser({
    email: loginIdToInternalEmail(input.data.managerLoginId),
    password: input.data.initialPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.data.managerName,
      name: input.data.managerName,
      login_id: input.data.managerLoginId,
    },
  });

  if (createUserError || !created.user) {
    console.error("Tenant manager Auth user creation failed", {
      tenantId,
      code: createUserError?.code,
      message: createUserError?.message,
    });
    await supabase.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
    return result("error", "租户已创建但管理员账号创建失败；该租户已自动停用，请检查账号是否重复后重试。");
  }

  const managerId = created.user.id;
  const { error: provisioningError } = await admin.from("tenant_provisioned_accounts").insert({
    tenant_id: tenantId,
    user_id: managerId,
    created_by: user.id,
  });
  const { error: removeBootstrapError } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("user_id", managerId)
    .neq("tenant_id", tenantId);
  const { error: membershipError } = await admin.from("tenant_memberships").insert({
    tenant_id: tenantId,
    user_id: managerId,
    role: "tenant_super_admin",
    status: "active",
    membership_tier: "normal",
    is_default: true,
    invited_by: user.id,
    joined_at: new Date().toISOString(),
  });
  // The profile audit trigger requires a tenant context. Establish the membership first,
  // then update the profile so the audit row receives this tenant's id.
  const { error: profileError } = membershipError
    ? { error: null }
    : await admin
        .from("profiles")
        .update({ login_id: input.data.managerLoginId, role: "tenant_super_admin", global_role: "tenant_super_admin", status: "active" })
        .eq("id", managerId);
  if (profileError || removeBootstrapError || membershipError || provisioningError) {
    console.error("Tenant manager provisioning failed", {
      tenantId,
      managerId,
      provisioningError,
      removeBootstrapError,
      membershipError,
      profileError,
    });
    await admin.auth.admin.deleteUser(managerId);
    await supabase.from("tenants").update({ status: "suspended" }).eq("id", tenantId);
    return result("error", "管理员账号配置失败；该租户已自动停用，请联系负责人处理。");
  }

  revalidatePath("/dashboard/admin/tenants");
  revalidatePath("/dashboard/admin");
  return result("success", "租户和管理员账号已创建。请将账号与初始密码安全交给管理员。");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function setTenantStatusAction(
  tenantId: string,
  nextStatus: "active" | "suspended",
  _previousState: TenantActionState,
  _formData: FormData
): Promise<TenantActionState> {
  void _previousState;
  void _formData;
  if (!isUuid(tenantId)) return result("error", "租户编号不正确。");
  const { supabase } = await requirePlatformTenantManager();
  const { error } = await supabase.rpc("set_tenant_lifecycle_status", {
    requested_tenant_id: tenantId,
    requested_status: nextStatus,
  });
  if (error) return result("error", "租户状态更新失败，请确认当前负责人权限和租户状态。");
  revalidatePath("/dashboard/admin/tenants");
  return result("success", nextStatus === "active" ? "租户已恢复。" : "租户已停用。");
}

export async function resetTenantManagerPasswordAction(
  tenantId: string,
  userId: string,
  _previousState: TenantActionState,
  formData: FormData
): Promise<TenantActionState> {
  void _previousState;
  const password = String(formData.get("new_password") ?? "");
  if (!isUuid(tenantId) || !isUuid(userId)) return result("error", "账号或租户编号不正确。");
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return result("error", "新密码需为 8 至 72 位，并同时包含字母和数字。");
  }

  await requirePlatformTenantManager();
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("tenant_memberships")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("role", "tenant_super_admin")
    .maybeSingle();
  if (!membership) return result("error", "该账号不是此租户的管理员。");

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return result("error", "密码重置失败，请稍后重试。");
  return result("success", "管理员密码已更新，请通过安全渠道交付新密码。");
}

export async function deleteTenantPermanentlyAction(
  tenantId: string,
  _previousState: TenantActionState,
  formData: FormData
): Promise<TenantActionState> {
  void _previousState;
  if (!isUuid(tenantId)) return result("error", "租户编号不正确。");
  const confirmation = String(formData.get("confirmation") ?? "").trim().toLowerCase();
  const { supabase } = await requirePlatformTenantManager();
  const admin = createAdminClient();
  const { data: provisionedAccounts } = await admin
    .from("tenant_provisioned_accounts")
    .select("user_id")
    .eq("tenant_id", tenantId);
  const { error } = await supabase.rpc("delete_tenant_permanently", {
    requested_tenant_id: tenantId,
    requested_slug_confirmation: confirmation,
  });
  if (error) {
    console.error("Permanent tenant deletion failed", {
      tenantId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return result("error", tenantDeletionErrorMessage(error));
  }

  let removedAccounts = 0;
  for (const account of provisionedAccounts ?? []) {
    const { count } = await admin
      .from("tenant_memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", account.user_id as string);
    if (count === 0) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(account.user_id as string);
      if (!deleteUserError) removedAccounts += 1;
    }
  }

  revalidatePath("/dashboard/admin/tenants");
  revalidatePath("/dashboard/admin");
  return result("success", `租户及其成员关系已永久删除；已清理 ${removedAccounts} 个仅属于该租户的登录账号。`);
}
