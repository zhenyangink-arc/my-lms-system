import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";

export type HelpCenterAccess = {
  canManage: boolean;
  canHandleTickets: boolean;
  canManageArticles: boolean;
  canAssignTickets: boolean;
  canViewPlatformOverview: boolean;
  scope: "platform" | "tenant" | null;
  tenantId: string | null;
  dashboardBasePath: string;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getHelpCenterAccess(): Promise<HelpCenterAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;

  if (!tenantId && role === "platform_super_admin") {
    return {
      canManage: true,
      canHandleTickets: false,
      canManageArticles: false,
      canAssignTickets: false,
      canViewPlatformOverview: true,
      scope: "platform",
      tenantId,
      dashboardBasePath: getDashboardBasePath(null),
      role,
      supabase,
      user,
    };
  }

  if (tenantId && (role === "tenant_super_admin" || role === "ceo" || role === "teacher")) {
    const canManageArticles = role === "tenant_super_admin" || role === "ceo";
    return {
      canManage: true,
      canHandleTickets: true,
      canManageArticles,
      canAssignTickets: canManageArticles,
      canViewPlatformOverview: false,
      scope: "tenant",
      tenantId,
      dashboardBasePath: getDashboardBasePath(tenant?.slug),
      role,
      supabase,
      user,
    };
  }

  return {
    canManage: false,
    canHandleTickets: false,
    canManageArticles: false,
    canAssignTickets: false,
    canViewPlatformOverview: false,
    scope: null,
    tenantId,
    dashboardBasePath: getDashboardBasePath(tenant?.slug),
    role,
    supabase,
    user,
  };
}

export async function requireHelpCenterManager() {
  const access = await getHelpCenterAccess();
  if (!access.canManage || !access.scope) redirect("/dashboard");
  return access;
}

export async function requireHelpTicketHandler() {
  const access = await getHelpCenterAccess();
  if (!access.canHandleTickets || access.scope !== "tenant" || !access.tenantId) redirect("/dashboard/help");
  return access;
}

export async function requireHelpArticleManager() {
  const access = await getHelpCenterAccess();
  if (!access.canManageArticles || access.scope !== "tenant" || !access.tenantId) redirect("/dashboard/admin/help");
  return access;
}

export async function requireHelpTicketAssigner() {
  const access = await getHelpCenterAccess();
  if (!access.canAssignTickets || access.scope !== "tenant" || !access.tenantId) redirect("/dashboard/admin/help");
  return access;
}
