"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { redirect } from "next/navigation";

import { requireAccountOwner, requireExecutive, requirePlatformOwner } from "@/lib/admin";
import { isValidLoginId, loginIdToInternalEmail, normalizeLoginId } from "@/lib/login-id";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AccountActionState } from "./action-state";
import type { AccountListProfile } from "./AccountCard";
import {
  canManageTarget,
  getAssignableRoles,
  type AppRole,
} from "@/features/accounts/constants/account-options";

const VALID_STATUSES = ["active", "inactive", "suspended"];
const VALID_MEMBERSHIP_TIERS = ["normal", "vip1", "vip2", "vip3"];
const CREATABLE_ACCOUNT_ROLES = ["teacher", "student"] as const;
const CREATABLE_PLATFORM_ROLES = [
  "platform_deputy",
  "platform_admin",
  "platform_course_inspector",
] as const;

function getPlatformProfileIdentity(role: string) {
  if (role === "platform_deputy") {
    return { role: "tenant_operator", global_role: "platform_deputy" };
  }
  if (role === "platform_course_inspector") {
    return {
      role: "platform_course_inspector",
      global_role: "platform_course_inspector",
    };
  }
  return { role: "admin", global_role: "platform_admin" };
}

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

  const { tenant, role: viewerRole, user } = await requireAccountOwner();
  const isPlatformOwner = viewerRole === "platform_super_admin";
  if (isPlatformOwner) await requirePlatformOwner();

  const tenantId = isPlatformOwner ? (requestedTenantId || tenant?.id || "") : tenant?.id ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) return actionError("机构编号不正确。");

  const admin = createAdminClient();
  const { data: targetTenant } = await admin.from("tenants").select("id").eq("id", tenantId).eq("status", "active").maybeSingle();
  if (!targetTenant) return actionError("目标机构不存在或当前不可用。");

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
    is_default: true, invited_by: user.id, joined_at: new Date().toISOString(),
  });

  if (profileError || cleanupError || membershipError) {
    await admin.auth.admin.deleteUser(userId);
    return actionError("账号已回滚：机构归属或角色配置失败，请稍后重试。");
  }

  revalidateDashboard("/dashboard/admin/accounts");
  revalidateDashboard("/dashboard/admin/records");
  revalidateDashboard(`/dashboard/admin/tenants/${tenantId}`);
  return actionSuccess(`${role === "teacher" ? "员工" : "学生"}账号已创建，请安全交付登录账号和初始密码。`);
}

export async function createPlatformAccountAction(
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  void _previousState;
  const name = String(formData.get("full_name") ?? "").trim();
  const loginId = normalizeLoginId(String(formData.get("login_id") ?? ""));
  const password = String(formData.get("initial_password") ?? "");
  const role = String(formData.get("role") ?? "");

  if (name.length < 2 || name.length > 50) return actionError("姓名需要填写 2 至 50 个字符。");
  if (!isValidLoginId(loginId)) return actionError("登录账号只能使用 3 至 32 位小写字母、数字、短横线或下划线。");
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return actionError("初始密码需为 8 至 72 位，并同时包含字母和数字。");
  }
  if (!CREATABLE_PLATFORM_ROLES.includes(role as (typeof CREATABLE_PLATFORM_ROLES)[number])) {
    return actionError("平台账号只能设为平台副负责人、平台管理员或平台课程巡检员。");
  }

  await requirePlatformOwner();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginIdToInternalEmail(loginId),
    password,
    email_confirm: true,
    user_metadata: { full_name: name, name, login_id: loginId },
  });
  if (createError || !created.user) return accountCreationError(createError);

  const profileIdentity = getPlatformProfileIdentity(role);
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: name,
      login_id: loginId,
      ...profileIdentity,
      status: "active",
      membership_tier: "normal",
    })
    .eq("id", created.user.id);
  const { error: membershipCleanupError } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("user_id", created.user.id);

  if (profileError || membershipCleanupError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return actionError("平台角色配置失败，账号已回滚。");
  }

  revalidateDashboard("/dashboard/admin/accounts");
  const roleLabel = role === "platform_deputy"
    ? "平台副负责人"
    : role === "platform_course_inspector"
      ? "平台课程巡检员"
      : "平台管理员";
  return actionSuccess(`${roleLabel}账号已创建。`);
}

async function requireManageableTarget(
  viewerRole: string,
  viewerTenantId: string | null,
  profileId: string
) {
  const admin = createAdminClient();
  const [{ data: target, error }, { data: memberships, error: membershipError }] = await Promise.all([
    admin
    .from("profiles")
    .select("id, role, global_role")
    .eq("id", profileId)
    .maybeSingle(),
    admin
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", profileId),
  ]);

  if (error || membershipError || !target) {
    throw new Error("找不到要管理的账号。");
  }

  const belongsToViewerScope = viewerTenantId
    ? (memberships ?? []).some((membership) => membership.tenant_id === viewerTenantId)
    : (memberships ?? []).length === 0;

  if (!belongsToViewerScope) {
    throw new Error("你没有权限管理这个账号。");
  }

  const effectiveRole = viewerTenantId
    ? (memberships ?? []).find(
        (membership) => membership.tenant_id === viewerTenantId
      )?.role ?? target.role
    : target.global_role === "platform_deputy" ||
        target.global_role === "platform_admin" ||
        target.global_role === "platform_course_inspector"
      ? target.global_role
      : target.role;
  const accountScope = viewerTenantId ? "tenant" : "platform";

  // 老板账号不通过普通账号管理页修改，避免误降级或自我停用。
  if (effectiveRole === "tenant_super_admin" || !canManageTarget(viewerRole, effectiveRole, accountScope)) {
    throw new Error("你没有权限管理这个账号。");
  }

  return { ...target, role: effectiveRole };
}

export async function updateProfileRoleAction(
  profileId: string,
  _previousState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const { tenant, role: viewerRole } = await requireExecutive();
  const newRole = String(formData.get("role") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");

  const accountScope = tenant ? "tenant" : "platform";
  const assignableRoles = getAssignableRoles(viewerRole, accountScope);
  if (!assignableRoles.includes(newRole as AppRole)) {
    return actionError("你不能分配这个角色。");
  }

  try {
    const target = await requireManageableTarget(viewerRole, tenant?.id ?? null, profileId);
    if (target.role === newRole) return actionSuccess("账号角色没有变化。");

    const admin = createAdminClient();
    const profileIdentity = tenant
      ? { role: newRole }
      : getPlatformProfileIdentity(newRole);
    const { data: updatedProfile, error } = await admin
      .from("profiles")
      .update(profileIdentity)
      .eq("id", profileId)
      .select("id")
      .maybeSingle();
    const membershipResult = tenant
      ? await admin
          .from("tenant_memberships")
          .update({ role: newRole })
          .eq("tenant_id", tenant.id)
          .eq("user_id", profileId)
          .select("user_id")
          .maybeSingle()
      : { data: { user_id: profileId }, error: null };

    if (error || !updatedProfile || membershipResult.error || !membershipResult.data) {
      return actionError("角色更新失败，请稍后重试。");
    }

    revalidateDashboard("/dashboard/admin/accounts");
    revalidateDashboard(`/dashboard/admin/accounts/${profileId}`);
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
  const { tenant, role: viewerRole, user } = await requireExecutive();
  const newStatus = String(formData.get("status") ?? "").trim();
  const reason = String(formData.get("deactivate_reason") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");
  if (!VALID_STATUSES.includes(newStatus)) return actionError("请选择有效的账号状态。");
  if (newStatus !== "active" && !reason) return actionError("暂停或停用账号时必须填写原因。");
  if (reason.length > 300) return actionError("状态原因不能超过 300 个字。");

  try {
    await requireManageableTarget(viewerRole, tenant?.id ?? null, profileId);

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

    const admin = createAdminClient();
    const { data: updatedProfile, error } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", profileId)
      .select("id")
      .maybeSingle();
    const membershipResult = tenant
      ? await admin
          .from("tenant_memberships")
          .update({ status: newStatus })
          .eq("tenant_id", tenant.id)
          .eq("user_id", profileId)
          .select("user_id")
          .maybeSingle()
      : { data: { user_id: profileId }, error: null };

    if (error || !updatedProfile || membershipResult.error || !membershipResult.data) {
      return actionError("账号状态更新失败，请稍后重试。");
    }

    revalidateDashboard("/dashboard/admin/accounts");
    revalidateDashboard(`/dashboard/admin/accounts/${profileId}`);
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
  const { tenant, role: viewerRole, user } = await requireExecutive();
  const membershipTier = String(formData.get("membership_tier") ?? "").trim();

  if (!VALID_MEMBERSHIP_TIERS.includes(membershipTier)) {
    return actionError("请选择有效的学生会员档位。");
  }

  try {
    const target = await requireManageableTarget(viewerRole, tenant?.id ?? null, profileId);
    if (target.role !== "student") return actionError("会员档位只适用于学生账号。");

    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({
        membership_tier: membershipTier,
        membership_updated_at: new Date().toISOString(),
        membership_updated_by: user.id,
      })
      .eq("id", profileId);
    const membershipResult = tenant
      ? await admin
          .from("tenant_memberships")
          .update({ membership_tier: membershipTier })
          .eq("tenant_id", tenant.id)
          .eq("user_id", profileId)
          .select("user_id")
          .maybeSingle()
      : { data: { user_id: profileId }, error: null };

    if (error || membershipResult.error || !membershipResult.data) {
      return actionError("会员档位更新失败，请稍后重试。");
    }

    revalidateDashboard("/dashboard/admin/accounts");
    revalidateDashboard(`/dashboard/admin/accounts/${profileId}`);
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
  const { supabase, tenant, role: viewerRole, user } = await requireAccountOwner();
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  const reason = String(formData.get("deletion_reason") ?? "").trim();

  if (!profileId) return actionError("缺少账号编号，请刷新页面后重试。");
  if (profileId === user.id) return actionError("不能删除当前登录的负责人账号。");
  if (reason.length < 2 || reason.length > 300) return actionError("删除原因需要填写 2 至 300 个字。");
  if (!tenant) return actionError("平台账号暂不支持在此永久删除，请先停用账号。");

  try {
    await requireManageableTarget(viewerRole, tenant.id, profileId);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "你没有权限删除这个账号。");
  }

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

  revalidateDashboard("/dashboard/admin/accounts");
  revalidateDashboard(`/dashboard/admin/accounts/${profileId}`);
  redirect(storageCleanupFailed ? "/dashboard/admin/accounts?deleted=cleanup" : "/dashboard/admin/accounts?deleted=1");
}

export type AccountDetailProfile = AccountListProfile & {
  avatar_path: string | null;
  gender: string | null;
  birth_date: string | null;
  address_province: string | null;
  address_city: string | null;
  education_level: string | null;
  education_status: string | null;
  education_completion_month: string | null;
  academic_average: number | null;
  gaokao_has_score: boolean | null;
  gaokao_score: number | null;
  english_level: string | null;
  math_level: string | null;
  has_korean: boolean | null;
  topik_level: number | null;
  has_work_experience: boolean | null;
};

export type AccountDetailAuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  changed_fields: string[] | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

export type AccountStaffProfile = {
  gender: string | null;
  birth_date: string | null;
  hired_at: string | null;
};

export type AccountDetailResult =
  | {
      ok: true;
      profile: AccountDetailProfile;
      auditLogs: AccountDetailAuditLog[];
      actorNames: Record<string, string>;
      avatarUrl: string | null;
      staffProfile: AccountStaffProfile | null;
    }
  | { ok: false; error: string };

const ACCOUNT_DETAIL_PROFILE_FIELDS =
  "id, full_name, email, login_id, role, global_role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier, avatar_path, gender, birth_date, address_province, address_city, education_level, education_status, education_completion_month, academic_average, gaokao_has_score, gaokao_score, english_level, math_level, has_korean, topik_level, has_work_experience" as const;

/**
 * 列表页"详情"弹窗按需加载完整档案数据（与详情页同一套查询逻辑）。
 * 只做展示，不含写操作；写操作仍走行内"管理"弹窗。
 */
export async function getAccountDetailAction(
  profileId: string
): Promise<AccountDetailResult> {
  if (!profileId) return { ok: false, error: "缺少账号编号，请刷新页面后重试。" };

  try {
    const { supabase, tenant } = await requireExecutive();
    const admin = createAdminClient();

    const { data: targetMemberships, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("tenant_id, role, status, membership_tier")
      .eq("user_id", profileId);
    if (membershipError) {
      return { ok: false, error: "无法确认账号范围，请稍后重试。" };
    }

    const isInViewerScope = tenant
      ? (targetMemberships ?? []).some(
          (membership) => membership.tenant_id === tenant.id
        )
      : (targetMemberships ?? []).length === 0;
    if (!isInViewerScope) {
      return { ok: false, error: "该账号不在你的管理范围内。" };
    }

    const [profileResult, auditResult, staffResult] = await Promise.all([
      admin
        .from("profiles")
        .select(ACCOUNT_DETAIL_PROFILE_FIELDS)
        .eq("id", profileId)
        .neq("role", "tenant_super_admin")
        .maybeSingle(),
      tenant
        ? admin
            .from("account_management_audit_logs")
            .select("id, actor_id, action, changed_fields, before_data, after_data, created_at")
            .eq("tenant_id", tenant.id)
            .eq("target_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
      admin
        .from("staff_profiles")
        .select("gender, birth_date, hired_at")
        .eq("user_id", profileId)
        .maybeSingle(),
    ]);

    if (profileResult.error || !profileResult.data) {
      return { ok: false, error: "找不到该账号的档案。" };
    }

    const storedProfile = profileResult.data as AccountDetailProfile;
    if (
      !tenant &&
      storedProfile.global_role !== "platform_deputy" &&
      storedProfile.global_role !== "platform_admin" &&
      storedProfile.global_role !== "platform_course_inspector"
    ) {
      return { ok: false, error: "该账号不是平台后台成员。" };
    }

    const currentMembership = tenant
      ? (targetMemberships ?? []).find(
          (membership) => membership.tenant_id === tenant.id
        )
      : null;
    const profile: AccountDetailProfile = currentMembership
      ? {
          ...storedProfile,
          role: currentMembership.role,
          status: currentMembership.status,
          membership_tier: currentMembership.membership_tier,
        }
      : {
          ...storedProfile,
          role:
            storedProfile.global_role === "platform_deputy" ||
            storedProfile.global_role === "platform_admin" ||
            storedProfile.global_role === "platform_course_inspector"
              ? storedProfile.global_role
              : storedProfile.role,
        };

    const auditLogs = auditResult.error
      ? []
      : ((auditResult.data as AccountDetailAuditLog[] | null) ?? []);

    const actorIds = [
      ...new Set(
        auditLogs
          .map((log) => log.actor_id)
          .filter((value): value is string => Boolean(value))
      ),
    ];
    const actorResult =
      actorIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", actorIds)
        : { data: [], error: null };
    const actorNames = Object.fromEntries(
      (actorResult.data ?? []).map((actor) => [
        actor.id,
        actor.full_name || actor.email || `管理员 …${actor.id.slice(-6)}`,
      ])
    );

    let avatarUrl: string | null = null;
    if (profile.avatar_path) {
      const { data: signedAvatar } = await supabase.storage
        .from("profile-photos")
        .createSignedUrl(profile.avatar_path, 60 * 30);
      avatarUrl = signedAvatar?.signedUrl ?? null;
    }

    return {
      ok: true,
      profile,
      auditLogs,
      actorNames,
      avatarUrl,
      staffProfile: staffResult.error
        ? null
        : ((staffResult.data as AccountStaffProfile | null) ?? null),
    };
  } catch (error) {
    console.error("账号详情加载失败", error);
    return { ok: false, error: "详情加载失败，请稍后重试。" };
  }
}
