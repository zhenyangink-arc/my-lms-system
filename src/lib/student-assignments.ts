import "server-only";

import { redirect } from "next/navigation";
import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";

export type StudentAssignmentScope = "tenant" | "platform" | null;

export type StudentAssignmentAccess = {
  canManage: boolean;
  scope: StudentAssignmentScope;
  role: UserRole;
  tenantId: string | null;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

/**
 * 学生分配管理入口权限：
 * - 机构侧：数据库正式注册 student_assignments.manage 前，仅 tenant_super_admin 固定可管理；
 * - 平台侧：platform_super_admin 可只读查看各机构的老师-学生覆盖情况（不能分配）；
 * - CEO、老师、学生不进入本模块。
 */
export async function getStudentAssignmentAccess(): Promise<StudentAssignmentAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;

  if (!tenantId) {
    return {
      canManage: false,
      scope: role === "platform_super_admin" ? "platform" : null,
      role,
      tenantId,
      supabase,
      user,
    };
  }
  if (role === "tenant_super_admin") return { canManage: true, scope: "tenant", role, tenantId, supabase, user };
  return { canManage: false, scope: null, role, tenantId, supabase, user };
}

/** 页面入口：机构侧可管理或平台侧只读，均允许进入页面。 */
export async function requireStudentAssignmentPageAccess() {
  const access = await getStudentAssignmentAccess();
  if (!access.scope) redirect("/dashboard");
  return access;
}

/** 写操作：仅机构侧可管理角色。 */
export async function requireStudentAssignmentManager() {
  const access = await getStudentAssignmentAccess();
  if (!access.canManage || access.scope !== "tenant" || !access.tenantId) redirect("/dashboard");
  return access;
}

/**
 * 老师负责的学生 id 集合（当前老师在当前机构被分配的 student_id）。
 * 老师只能查看/管理自己负责的学生；RLS 已允许老师读取自己的分配记录。
 */
export async function getTeacherAssignedStudentIds(
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"],
  tenantId: string,
  userId: string,
  studentAppId?: string,
): Promise<string[]> {
  let query = supabase
    .from("tenant_student_assignments")
    .select("student_id")
    .eq("tenant_id", tenantId)
    .eq("teacher_id", userId);
  if (studentAppId) query = query.eq("student_app_id", studentAppId);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) => String(row.student_id));
}
