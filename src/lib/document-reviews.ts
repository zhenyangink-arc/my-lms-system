import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { hasTenantAppCapability } from "@/lib/tenant-app-capabilities";

export type DocumentReviewScope = "institution" | "platform" | null;

export type DocumentReviewAccess = {
  canManage: boolean;
  canView: boolean;
  scope: DocumentReviewScope;
  role: UserRole;
  tenantId: string | null;
  dashboardBasePath: string;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getDocumentReviewAccess(): Promise<DocumentReviewAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  // 平台负责人只进入机构级汇总，不读取任何机构的学生申请明细。
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

export async function requireDocumentReviewOverviewAccess() {
  const access = await getDocumentReviewAccess();
  if (!access.canView || !access.scope) redirect(access.dashboardBasePath);
  return access;
}

export async function requireDocumentReviewManager() {
  const access = await getDocumentReviewAccess();
  if (!access.canManage || access.scope !== "institution" || !access.tenantId) {
    redirect(access.dashboardBasePath);
  }
  return {
    ...access,
    scope: "institution" as const,
    tenantId: access.tenantId,
  };
}
