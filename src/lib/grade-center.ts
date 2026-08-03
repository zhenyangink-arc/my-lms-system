import "server-only";

import { redirect } from "next/navigation";
import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { hasExplicitPermission } from "@/lib/permissions/access";

export type GradeCenterScope = "institution" | "platform" | null;
export type GradeCenterAccess = { canManage: boolean; scope: GradeCenterScope; role: UserRole; tenantId: string | null; supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"]; user: Awaited<ReturnType<typeof requireActiveUser>>["user"] };

export async function getGradeCenterAccess(): Promise<GradeCenterAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;
  // 平台负责人只有机构级汇总视图，不进入任何机构的学生成绩明细。
  if (!tenantId && role === "platform_super_admin") return { canManage: true, scope: "platform", role, tenantId, supabase, user };
  if (!tenantId) return { canManage: false, scope: null, role, tenantId, supabase, user };
  if (role === "tenant_super_admin" || role === "ceo") return { canManage: true, scope: "institution", role, tenantId, supabase, user };
  if (role !== "admin") return { canManage: false, scope: null, role, tenantId, supabase, user };
  const canManage = await hasExplicitPermission(supabase, user.id, "grade_center.manage", tenantId);
  return { canManage, scope: canManage ? "institution" : null, role, tenantId, supabase, user };
}

export async function requireGradeCenterOverviewAccess() { const access = await getGradeCenterAccess(); if (!access.canManage || !access.scope) redirect("/dashboard"); return access; }
export async function requireGradeCenterManager() { const access = await getGradeCenterAccess(); if (!access.canManage || access.scope !== "institution" || !access.tenantId) redirect("/dashboard"); return { ...access, scope: "institution" as const, tenantId: access.tenantId }; }
