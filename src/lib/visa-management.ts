import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { hasTenantAppCapability } from "@/lib/tenant-app-capabilities";

export type VisaManagementScope = "institution" | "platform" | null;

export type VisaManagementAccess = {
  canManage: boolean;
  canView: boolean;
  scope: VisaManagementScope;
  role: UserRole;
  tenantId: string | null;
  dashboardBasePath: string;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getVisaManagementAccess(): Promise<VisaManagementAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  if (!tenantId && role === "platform_super_admin") {
    return { canManage: true, canView: true, scope: "platform", role, tenantId, dashboardBasePath, supabase, user };
  }
  if (!tenantId) {
    return { canManage: false, canView: false, scope: null, role, tenantId, dashboardBasePath, supabase, user };
  }

  if (role === "tenant_super_admin" || role === "ceo") {
    return { canManage: true, canView: true, scope: "institution", role, tenantId, dashboardBasePath, supabase, user };
  }
  const [canManage, canView] = await Promise.all([
    hasTenantAppCapability({
      supabase,
      tenantId,
      userId: user.id,
      appId: STUDENT_APP_IDS["study-abroad"],
      capability: "manageAssessments",
    }),
    hasTenantAppCapability({
      supabase,
      tenantId,
      userId: user.id,
      appId: STUDENT_APP_IDS["study-abroad"],
      capability: "viewAnalytics",
    }),
  ]);

  return {
    canManage,
    canView,
    scope: canView ? "institution" : null,
    role,
    tenantId,
    dashboardBasePath,
    supabase,
    user,
  };
}

export async function requireVisaOverviewAccess() {
  const access = await getVisaManagementAccess();
  if (!access.canView || !access.scope) redirect(access.dashboardBasePath);
  return access;
}

export async function requireVisaManager() {
  const access = await getVisaManagementAccess();
  if (!access.canManage || access.scope !== "institution" || !access.tenantId) {
    redirect("/dashboard");
  }
  return {
    ...access,
    scope: "institution" as const,
    tenantId: access.tenantId,
  };
}
