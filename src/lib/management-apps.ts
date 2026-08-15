import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import type { UserRole } from "@/lib/admin";
import { isValidRole } from "@/lib/admin";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { getManagementAppPath } from "@/lib/management-app-path";
import {
  getStudentAppDefinition,
  isStudentAppSlug,
  STUDENT_APPS,
  STUDENT_APP_IDS,
  type StudentAppDefinition,
  type StudentAppSlug,
} from "@/lib/student-apps";

type AppAccessError = {
  code?: string;
  message?: string;
} | null;

type TenantAppRow = {
  is_enabled: boolean;
  status: "active" | "coming_soon" | "hidden";
  custom_title: string | null;
};

type StaffAppAssignmentRow = {
  access_role: "administrator" | "operator" | "teacher" | "viewer";
  can_manage_students: boolean;
  can_manage_content: boolean;
  can_manage_assessments: boolean;
  can_view_analytics: boolean;
  status: "active" | "inactive";
};

export type ManagementAppCapabilities = {
  manageTenantAvailability: boolean;
  manageStudents: boolean;
  manageContent: boolean;
  manageAssessments: boolean;
  viewAnalytics: boolean;
};

export type ManagementAppAccess = {
  app: StudentAppDefinition;
  appId: string;
  appTitle: string;
  appPath: string;
  dashboardBasePath: string;
  scope: "platform" | "tenant";
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  userId: string;
  role: UserRole;
  accessRole: StaffAppAssignmentRow["access_role"] | "platform";
  availability: {
    enabled: boolean;
    status: TenantAppRow["status"];
  };
  capabilities: ManagementAppCapabilities;
};

export type ManagementAppCatalogItem = {
  app: StudentAppDefinition;
  appId: string;
  appTitle: string;
  appPath: string;
  accessRole: StaffAppAssignmentRow["access_role"] | "platform";
  availability: ManagementAppAccess["availability"];
  capabilities: ManagementAppCapabilities;
};

export type ManagementAppCatalogAccess = {
  scope: "platform" | "tenant";
  tenantId: string | null;
  tenantName: string | null;
  role: UserRole;
  dashboardBasePath: string;
  items: ManagementAppCatalogItem[];
};

function isApplicationAccessSchemaMissing(error: AppAccessError) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42P01" ||
    error?.message?.includes("staff_app_assignments") === true ||
    error?.message?.includes("student_app_enrollments") === true
  );
}

function getPlatformCapabilities(globalRole: string | null) {
  const isOwner = globalRole === "platform_owner";
  const isContentManager =
    isOwner || globalRole === "platform_admin";
  const isTenantManager =
    isOwner || globalRole === "platform_deputy";

  return {
    manageTenantAvailability: isTenantManager,
    manageStudents: isTenantManager,
    manageContent: isContentManager,
    manageAssessments: isContentManager,
    viewAnalytics: true,
  } satisfies ManagementAppCapabilities;
}

function getLegacyTenantCapabilities(role: UserRole) {
  const isExecutive = role === "tenant_super_admin" || role === "ceo";
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  return {
    manageTenantAvailability: isExecutive,
    manageStudents: isExecutive || isAdmin,
    manageContent: isExecutive,
    manageAssessments: isExecutive || isAdmin || isTeacher,
    viewAnalytics: isExecutive || isAdmin || isTeacher,
  } satisfies ManagementAppCapabilities;
}

function getLegacyAccessRole(role: UserRole) {
  if (role === "tenant_super_admin" || role === "ceo") {
    return "administrator" as const;
  }
  if (role === "admin") return "operator" as const;
  if (role === "teacher") return "teacher" as const;
  return "viewer" as const;
}

export const requireManagementAppCatalogAccess = cache(
  async (space: string): Promise<ManagementAppCatalogAccess> => {
    const requestedSpace = space === "platform" ? "platform" : "tenant";
    const access = await requireDashboardAccess(
      requestedSpace,
      requestedSpace === "tenant" ? space : null,
    );
    const { auth, dashboardBasePath } = access;
    const role =
      auth.platformProfile?.role === "platform_super_admin"
        ? "platform_super_admin"
        : auth.profile?.role;

    if (!isValidRole(role) || role === "student" || role === "platform_course_inspector") {
      redirect(dashboardBasePath);
    }

    if (access.space === "platform") {
      const capabilities = getPlatformCapabilities(
        auth.platformProfile?.global_role ?? null,
      );
      return {
        scope: "platform",
        tenantId: null,
        tenantName: null,
        role,
        dashboardBasePath,
        items: STUDENT_APPS.map((app) => ({
          app,
          appId: STUDENT_APP_IDS[app.slug],
          appTitle: app.title,
          appPath: getManagementAppPath(dashboardBasePath, app.slug),
          accessRole: "platform" as const,
          availability: { enabled: true, status: app.status },
          capabilities,
        })),
      };
    }

    const tenant = auth.tenant;
    if (!tenant) redirect(dashboardBasePath);

    const [tenantAppsResult, staffAccessResult] = await Promise.all([
      auth.supabase
        .from("tenant_student_apps")
        .select("app_id,is_enabled,status,custom_title,sort_order")
        .eq("tenant_id", tenant.id)
        .order("sort_order", { ascending: true }),
      auth.supabase
        .from("staff_app_assignments")
        .select(
          "app_id,access_role,can_manage_students,can_manage_content,can_manage_assessments,can_view_analytics,status",
        )
        .eq("tenant_id", tenant.id)
        .eq("staff_id", auth.user.id),
    ]);

    if (tenantAppsResult.error) {
      throw new Error("无法读取当前机构的应用目录，请稍后重试。");
    }

    const usesLegacyAccess = isApplicationAccessSchemaMissing(
      staffAccessResult.error,
    );
    if (staffAccessResult.error && !usesLegacyAccess) {
      throw new Error("无法读取当前账号的应用权限，请稍后重试。");
    }

    type TenantCatalogRow = TenantAppRow & {
      app_id: string;
      sort_order: number;
    };
    type StaffCatalogRow = StaffAppAssignmentRow & { app_id: string };

    const tenantAppById = new Map(
      ((tenantAppsResult.data ?? []) as TenantCatalogRow[]).map((item) => [
        item.app_id,
        item,
      ]),
    );
    const staffAccessById = new Map(
      ((staffAccessResult.data ?? []) as StaffCatalogRow[]).map((item) => [
        item.app_id,
        item,
      ]),
    );
    const isExecutive = role === "tenant_super_admin" || role === "ceo";

    const items = STUDENT_APPS.map((app) => {
      const appId = STUDENT_APP_IDS[app.slug];
      const tenantApp = tenantAppById.get(appId);
      if (!tenantApp) return null;
      const staffAccess = staffAccessById.get(appId);

      if (
        !isExecutive &&
        !usesLegacyAccess &&
        (!staffAccess || staffAccess.status !== "active")
      ) {
        return null;
      }
      if (
        !isExecutive &&
        (!tenantApp.is_enabled || tenantApp.status === "hidden")
      ) {
        return null;
      }

      return {
        app,
        appId,
        appTitle: tenantApp.custom_title?.trim() || app.title,
        appPath: getManagementAppPath(dashboardBasePath, app.slug),
        accessRole:
          usesLegacyAccess || !staffAccess
            ? getLegacyAccessRole(role)
            : staffAccess.access_role,
        availability: {
          enabled: tenantApp.is_enabled,
          status: tenantApp.status,
        },
        capabilities:
          usesLegacyAccess || !staffAccess
            ? getLegacyTenantCapabilities(role)
            : {
                manageTenantAvailability: isExecutive,
                manageStudents: staffAccess.can_manage_students,
                manageContent: staffAccess.can_manage_content,
                manageAssessments: staffAccess.can_manage_assessments,
                viewAnalytics: staffAccess.can_view_analytics,
              },
        sortOrder: tenantApp.sort_order,
      };
    })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        app: item.app,
        appId: item.appId,
        appTitle: item.appTitle,
        appPath: item.appPath,
        accessRole: item.accessRole,
        availability: item.availability,
        capabilities: item.capabilities,
      }));

    return {
      scope: "tenant",
      tenantId: tenant.id,
      tenantName: tenant.name,
      role,
      dashboardBasePath,
      items,
    };
  },
);

export const requireManagementAppAccess = cache(
  async (space: string, requestedAppSlug: string): Promise<ManagementAppAccess> => {
    if (!isStudentAppSlug(requestedAppSlug)) notFound();
    const appSlug: StudentAppSlug = requestedAppSlug;
    const requestedSpace = space === "platform" ? "platform" : "tenant";
    const access = await requireDashboardAccess(
      requestedSpace,
      requestedSpace === "tenant" ? space : null,
    );
    const { auth, dashboardBasePath } = access;
    const role =
      auth.platformProfile?.role === "platform_super_admin"
        ? "platform_super_admin"
        : auth.profile?.role;

    if (!isValidRole(role) || role === "student" || role === "platform_course_inspector") {
      redirect(dashboardBasePath);
    }

    const app = getStudentAppDefinition(appSlug);
    const appId = STUDENT_APP_IDS[appSlug];

    if (access.space === "platform") {
      return {
        app,
        appId,
        appTitle: app.title,
        appPath: getManagementAppPath(dashboardBasePath, appSlug),
        dashboardBasePath,
        scope: "platform",
        tenantId: null,
        tenantSlug: null,
        tenantName: null,
        userId: auth.user.id,
        role,
        accessRole: "platform",
        availability: { enabled: true, status: app.status },
        capabilities: getPlatformCapabilities(
          auth.platformProfile?.global_role ?? null,
        ),
      };
    }

    const tenant = auth.tenant;
    if (!tenant) redirect(dashboardBasePath);

    const { data: tenantAppData, error: tenantAppError } = await auth.supabase
      .from("tenant_student_apps")
      .select("is_enabled,status,custom_title")
      .eq("tenant_id", tenant.id)
      .eq("app_id", appId)
      .maybeSingle();

    if (tenantAppError) {
      throw new Error("无法读取当前机构的应用配置，请稍后重试。");
    }

    const tenantApp = tenantAppData as TenantAppRow | null;
    if (!tenantApp) notFound();

    const isExecutive = role === "tenant_super_admin" || role === "ceo";
    const { data: staffAccessData, error: staffAccessError } = await auth.supabase
      .from("staff_app_assignments")
      .select(
        "access_role,can_manage_students,can_manage_content,can_manage_assessments,can_view_analytics,status",
      )
      .eq("tenant_id", tenant.id)
      .eq("staff_id", auth.user.id)
      .eq("app_id", appId)
      .maybeSingle();

    const usesLegacyAccess = isApplicationAccessSchemaMissing(staffAccessError);
    if (staffAccessError && !usesLegacyAccess) {
      throw new Error("无法读取当前账号的应用权限，请稍后重试。");
    }

    const staffAccess = staffAccessData as StaffAppAssignmentRow | null;
    if (
      !isExecutive &&
      !usesLegacyAccess &&
      (!staffAccess || staffAccess.status !== "active")
    ) {
      notFound();
    }

    if (!isExecutive && (!tenantApp.is_enabled || tenantApp.status === "hidden")) {
      notFound();
    }

    const capabilities =
      usesLegacyAccess || !staffAccess
        ? getLegacyTenantCapabilities(role)
        : {
            manageTenantAvailability: isExecutive,
            manageStudents: staffAccess.can_manage_students,
            manageContent: staffAccess.can_manage_content,
            manageAssessments: staffAccess.can_manage_assessments,
            viewAnalytics: staffAccess.can_view_analytics,
          };

    return {
      app,
      appId,
      appTitle: tenantApp.custom_title?.trim() || app.title,
      appPath: getManagementAppPath(dashboardBasePath, appSlug),
      dashboardBasePath,
      scope: "tenant",
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      userId: auth.user.id,
      role,
      accessRole:
        usesLegacyAccess || !staffAccess
          ? getLegacyAccessRole(role)
          : staffAccess.access_role,
      availability: {
        enabled: tenantApp.is_enabled,
        status: tenantApp.status,
      },
      capabilities,
    };
  },
);
