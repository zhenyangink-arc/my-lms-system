import { redirect } from "next/navigation";
import {
  isActiveProfileStatus,
  requireActiveUser,
} from "@/lib/auth";

/*

  当前文件作用：
  1. 在 Next.js 服务端判断当前用户是否能进入管理端
  2. 支持新的权限层级：
     - platform_super_admin = 平台负责人
     - tenant_super_admin   = 机构负责人
     - ceo         = CEO
     - admin       = 管理员
     - teacher     = 老师 / 员工
     - student     = 学生
  3. 支持账号状态：
     - active    = 正常
     - inactive  = 已停用
     - suspended = 暂停
*/

/*
  系统角色类型
*/
export type UserRole =
  | "student"
  | "teacher"
  | "admin"
  | "ceo"
  | "platform_super_admin"
  | "tenant_super_admin"
  | "tenant_operator";

/*
  账号状态类型
*/
export type UserStatus = "active" | "inactive" | "suspended";

/*
  判断账号状态是否可用

  说明：
  - 旧账号可能没有 status，所以 null 暂时按 active 处理
  - 后面数据库已经给 status 设置 default active
*/
export function isActiveStatus(status: string | null | undefined) {
  return isActiveProfileStatus(status);
}

/*
  判断是否是合法角色
*/
export function isValidRole(role: string | null | undefined): role is UserRole {
  return (
    role === "student" ||
    role === "teacher" ||
    role === "admin" ||
    role === "ceo" ||
    role === "platform_super_admin" ||
    role === "tenant_super_admin" ||
    role === "tenant_operator"
  );
}

/*
  判断是否可以进入管理后台

  当前允许：
  - tenant_super_admin 机构负责人
  - ceo CEO
  - admin 管理员

  暂时不允许：
  - teacher
  - student
*/
export function isAdminRole(role: string | null | undefined) {
  return role === "admin" || role === "ceo" || role === "tenant_super_admin" || role === "platform_super_admin";
}

export function isTenantOwnerRole(role: string | null | undefined) {
  return role === "tenant_super_admin";
}

export function isPlatformOwnerRole(role: string | null | undefined) {
  return role === "platform_super_admin";
}

/*
  判断是否是老板或 CEO

  后面账号管理、运营管理、回收站管理会用到。
*/
export function isExecutiveRole(role: string | null | undefined) {
  return role === "tenant_super_admin" || role === "ceo" || role === "platform_super_admin";
}

export function isPlatformTenantManagerRole(role: string | null | undefined) {
  return role === "platform_super_admin" || role === "tenant_operator";
}

async function isTenantProvisionedAccount(
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"],
  userId: string
) {
  const { data, error } = await supabase
    .from("tenant_provisioned_accounts")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  // 未部署多租户表时保持旧系统兼容；其他读取错误则拒绝平台级权限。
  if (error && error.code !== "PGRST205" && error.code !== "42P01") return true;
  return Boolean(data);
}

export async function requirePlatformTenantManager() {
  const { supabase, user, platformProfile } = await requireActiveUser();
  if (!isPlatformTenantManagerRole(platformProfile?.role) || await isTenantProvisionedAccount(supabase, user.id)) redirect("/dashboard");
  return { supabase, user, role: platformProfile?.role as UserRole };
}

/*
  管理后台通用权限检查

  使用位置：
  - /dashboard/admin
  - /dashboard/admin/courses
  - /dashboard/admin/courses/[courseId]
  - /dashboard/admin/courses/[courseId]/lessons/[lessonId]

  通过条件：
  1. 用户已登录
  2. profiles.status 是 active
  3. profiles.role 是 admin / ceo / tenant_super_admin
*/
export async function requireAdmin() {
  const { supabase, user, profile } = await requireActiveUser();

  /*
    非 admin / ceo / tenant_super_admin 不能进入管理后台。
  */
  if (!isAdminRole(profile?.role)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    role: profile?.role as UserRole,
    status: (profile?.status ?? "active") as UserStatus,
  };
}

/*
  只允许老板进入

  后面用于：
  - 老板账号管理
  - CEO 账号管理
  - 系统危险操作
  - 全站回收站
*/
export async function requirePlatformOwner() {
  const { supabase, user, platformProfile } = await requireActiveUser();
  if (!isPlatformOwnerRole(platformProfile?.role) || await isTenantProvisionedAccount(supabase, user.id)) {
    redirect("/dashboard/admin");
  }
  return {
    supabase,
    user,
    role: platformProfile.role as UserRole,
    status: (platformProfile.status ?? "active") as UserStatus,
  };
}

export async function requireTenantOwner() {
  const result = await requireAdmin();
  if (!isTenantOwnerRole(result.role)) redirect("/dashboard/admin");
  return result;
}

export async function requireAccountOwner() {
  const result = await requireAdmin();
  if (result.role !== "tenant_super_admin" && result.role !== "platform_super_admin") redirect("/dashboard/admin");
  return result;
}

/*
  允许老板和 CEO 进入

  后面用于：
  - 管理员账号管理
  - 老师账号管理
  - 运营管理
*/
export async function requireExecutive() {
  const result = await requireAdmin();

  if (!isExecutiveRole(result.role)) {
    redirect("/dashboard/admin");
  }

  return result;
}
