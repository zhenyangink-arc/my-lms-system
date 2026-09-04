import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { hasExplicitPermission } from "@/lib/permissions/access";
import { getStudentAppPath } from "@/lib/student-apps";
import { getTenantAppCapabilityContext } from "@/lib/tenant-app-capabilities";

export type ConversationPracticeAccess = {
  /** 能否进入这个管理页面（浏览场景列表和数据） */
  canManage: boolean;
  /** 能否新建/编辑场景、修改发布状态——只留给平台负责人和平台单独指定的管理员，
   *  机构负责人和机构内其他角色即使能进页面，也只能浏览，不能新建或更改 */
  canManageContent: boolean;
  role: UserRole;
  tenantId: string | null;
  tenantSlug: string | null;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

/** 会话练习功能固定挂在韩语应用下，租户内学生端页面都从这里拼接跳转路径。 */
export function getConversationPracticeBasePath(tenantSlug: string | null) {
  return getStudentAppPath(tenantSlug ?? "", "korean", "conversation-practice");
}

export async function getConversationPracticeAccess(
  studentAppId?: string,
): Promise<ConversationPracticeAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;
  const tenantSlug = tenant?.slug ?? null;

  if (studentAppId && tenant) {
    const appAccess = await getTenantAppCapabilityContext(
      studentAppId,
      "manageAssessments",
    );
    return {
      canManage: Boolean(appAccess),
      canManageContent: false,
      role,
      tenantId,
      tenantSlug,
      supabase,
      user,
    };
  }

  if (role === "tenant_super_admin" || role === "platform_super_admin" || role === "ceo") {
    const canManageContent = role === "platform_super_admin" && !tenant;
    return {
      canManage: true,
      canManageContent,
      role,
      tenantId,
      tenantSlug,
      supabase,
      user,
    };
  }

  // 老师可浏览会话练习数据，但页面只显示自己负责的学生；不能新建/编辑场景。
  if (role === "teacher") {
    return { canManage: true, canManageContent: false, role, tenantId, tenantSlug, supabase, user };
  }

  if (role !== "admin" || !tenant) {
    return { canManage: false, canManageContent: false, role, tenantId, tenantSlug, supabase, user };
  }

  const assigned = await hasExplicitPermission(
    supabase,
    user.id,
    "conversation_practice.manage",
    tenant.id
  );

  return {
    canManage: assigned,
    canManageContent: false,
    role,
    tenantId,
    tenantSlug,
    supabase,
    user,
  };
}

export async function requireConversationPracticeManager(studentAppId?: string) {
  const access = await getConversationPracticeAccess(studentAppId);
  if (!access.canManage) redirect("/dashboard");
  return access;
}

/** 场景创建/编辑页专用：机构负责人等只能浏览的角色即使能进列表页，也不能进入这个编辑页。 */
export async function requireConversationPracticeContentManager() {
  const access = await getConversationPracticeAccess();
  if (!access.canManageContent) redirect("/dashboard/admin/conversation-practice");
  return access;
}
