import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";

export type ConversationPracticeAccess = {
  /** 能否进入这个管理页面（浏览场景列表和数据） */
  canManage: boolean;
  /** 能否新建/编辑场景、修改发布状态——只留给平台负责人和平台单独指定的管理员，
   *  机构负责人和机构内其他角色即使能进页面，也只能浏览，不能新建或更改 */
  canManageContent: boolean;
  canAssignAdmins: boolean;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getConversationPracticeAccess(): Promise<ConversationPracticeAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";

  if (role === "tenant_super_admin" || role === "platform_super_admin" || role === "ceo") {
    const canManageContent = role === "platform_super_admin" && !tenant;
    return {
      canManage: true,
      canManageContent,
      canAssignAdmins: canManageContent,
      role,
      supabase,
      user,
    };
  }

  if (role !== "admin") {
    return { canManage: false, canManageContent: false, canAssignAdmins: false, role, supabase, user };
  }

  const { data, error } = await supabase
    .from("conversation_practice_admin_assignments")
    .select("admin_id")
    .eq("admin_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  const assigned = !error && Boolean(data);

  return {
    canManage: assigned,
    canManageContent: assigned && !tenant,
    canAssignAdmins: false,
    role,
    supabase,
    user,
  };
}

export async function requireConversationPracticeManager() {
  const access = await getConversationPracticeAccess();
  if (!access.canManage) redirect("/dashboard");
  return access;
}

/** 场景创建/编辑页专用：机构负责人等只能浏览的角色即使能进列表页，也不能进入这个编辑页。 */
export async function requireConversationPracticeContentManager() {
  const access = await getConversationPracticeAccess();
  if (!access.canManageContent) redirect("/dashboard/admin/conversation-practice");
  return access;
}
