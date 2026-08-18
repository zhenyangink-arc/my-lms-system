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
  globalRole: string | null;
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

function getPlatformCapabilities(
  globalRole: string | null,
  appKind: StudentAppDefinition["kind"],
) {
  const isOwner = globalRole === "platform_owner";
  const isContentManager =
    isOwner || globalRole === "platform_admin";
  const isTenantManager =
    isOwner || globalRole === "platform_deputy";

  return {
    manageTenantAvailability: isTenantManager,
    manageStudents: isTenantManager,
    manageContent: isContentManager,
    // 留学材料、签证与学生个案的跨机构入口继续只向平台负责人
    // 提供匿名汇总；平台内容管理员仍可维护大学资料和留学课程。
    manageAssessments: isContentManager && (appKind === "learning" || isOwner),
    viewAnalytics: appKind === "learning" || isOwner,
  } satisfies ManagementAppCapabilities;
}

function getExecutiveTenantCapabilities() {
  return {
    manageTenantAvailability: true,
    manageStudents: true,
    manageContent: true,
    manageAssessments: true,
    viewAnalytics: true,
  } satisfies ManagementAppCapabilities;
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
          capabilities: getPlatformCapabilities(
            auth.platformProfile?.global_role ?? null,
            app.kind,
          ),
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

    if (staffAccessResult.error) {
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
        accessRole: isExecutive
          ? "administrator" as const
          : staffAccess!.access_role,
        availability: {
          enabled: tenantApp.is_enabled,
          status: tenantApp.status,
        },
        capabilities: isExecutive
          ? getExecutiveTenantCapabilities()
          : {
              manageTenantAvailability: false,
              manageStudents: staffAccess!.can_manage_students,
              manageContent: staffAccess!.can_manage_content,
              manageAssessments: staffAccess!.can_manage_assessments,
              viewAnalytics: staffAccess!.can_view_analytics,
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
        globalRole: auth.platformProfile?.global_role ?? null,
        accessRole: "platform",
        availability: { enabled: true, status: app.status },
        capabilities: getPlatformCapabilities(
          auth.platformProfile?.global_role ?? null,
          app.kind,
        ),
      };
    }

    const tenant = auth.tenant;
    if (!tenant) redirect(dashboardBasePath);

    const isExecutive = role === "tenant_super_admin" || role === "ceo";
    const [
      { data: tenantAppData, error: tenantAppError },
      { data: staffAccessData, error: staffAccessError },
    ] = await Promise.all([
      auth.supabase
        .from("tenant_student_apps")
        .select("is_enabled,status,custom_title")
        .eq("tenant_id", tenant.id)
        .eq("app_id", appId)
        .maybeSingle(),
      auth.supabase
        .from("staff_app_assignments")
        .select(
          "access_role,can_manage_students,can_manage_content,can_manage_assessments,can_view_analytics,status",
        )
        .eq("tenant_id", tenant.id)
        .eq("staff_id", auth.user.id)
        .eq("app_id", appId)
        .maybeSingle(),
    ]);

    if (tenantAppError) {
      throw new Error("无法读取当前机构的应用配置，请稍后重试。");
    }

    const tenantApp = tenantAppData as TenantAppRow | null;
    if (!tenantApp) notFound();

    if (staffAccessError) {
      throw new Error("无法读取当前账号的应用权限，请稍后重试。");
    }

    const staffAccess = staffAccessData as StaffAppAssignmentRow | null;
    if (
      !isExecutive &&
      (!staffAccess || staffAccess.status !== "active")
    ) {
      notFound();
    }

    if (!isExecutive && (!tenantApp.is_enabled || tenantApp.status === "hidden")) {
      notFound();
    }

    const capabilities = isExecutive
      ? getExecutiveTenantCapabilities()
      : {
          manageTenantAvailability: false,
          manageStudents: staffAccess!.can_manage_students,
          manageContent: staffAccess!.can_manage_content,
          manageAssessments: staffAccess!.can_manage_assessments,
          viewAnalytics: staffAccess!.can_view_analytics,
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
      globalRole: auth.platformProfile?.global_role ?? null,
      accessRole: isExecutive
        ? "administrator"
        : staffAccess!.access_role,
      availability: {
        enabled: tenantApp.is_enabled,
        status: tenantApp.status,
      },
      capabilities,
    };
  },
);
