import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";

export type TenantAppCapability =
  | "manageStudents"
  | "manageContent"
  | "manageAssessments"
  | "viewAnalytics";

type TenantAppRow = {
  is_enabled: boolean;
  status: "active" | "coming_soon" | "hidden";
};

type StaffAppRow = {
  status: "active" | "inactive";
  can_manage_students: boolean;
  can_manage_content: boolean;
  can_manage_assessments: boolean;
  can_view_analytics: boolean;
};

const capabilityColumn = {
  manageStudents: "can_manage_students",
  manageContent: "can_manage_content",
  manageAssessments: "can_manage_assessments",
  viewAnalytics: "can_view_analytics",
} as const satisfies Record<TenantAppCapability, keyof StaffAppRow>;

/**
 * Mirrors private.current_staff_has_app_capability in Supabase for server-side
 * route guards that need to compose an existing feature service.
 */
export async function hasTenantAppCapability({
  supabase,
  tenantId,
  userId,
  appId,
  capability,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  appId: string;
  capability: TenantAppCapability;
}) {
  const [tenantAppResult, staffAppResult] = await Promise.all([
    supabase
      .from("tenant_student_apps")
      .select("is_enabled,status")
      .eq("tenant_id", tenantId)
      .eq("app_id", appId)
      .maybeSingle(),
    supabase
      .from("staff_app_assignments")
      .select(
        "status,can_manage_students,can_manage_content,can_manage_assessments,can_view_analytics",
      )
      .eq("tenant_id", tenantId)
      .eq("staff_id", userId)
      .eq("app_id", appId)
      .maybeSingle(),
  ]);

  if (tenantAppResult.error || staffAppResult.error) return false;
  const tenantApp = tenantAppResult.data as TenantAppRow | null;
  const staffApp = staffAppResult.data as StaffAppRow | null;
  if (
    !tenantApp?.is_enabled ||
    tenantApp.status === "hidden" ||
    staffApp?.status !== "active"
  ) {
    return false;
  }

  return staffApp[capabilityColumn[capability]] === true;
}

export type TenantAppCapabilityContext = {
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
  tenantId: string;
  tenantSlug: string;
  role: UserRole;
};

/**
 * Application workspaces use this guard instead of the older feature-wide
 * permissions. Executives inherit every tenant application capability; all
 * other staff must have the matching active staff_app_assignments row.
 */
export async function getTenantAppCapabilityContext(
  appId: string,
  capability: TenantAppCapability,
): Promise<TenantAppCapabilityContext | null> {
  const auth = await requireActiveUser();
  const role = isValidRole(auth.profile?.role) ? auth.profile.role : "student";
  if (!auth.tenant || role === "student" || role === "platform_course_inspector") {
    return null;
  }

  const isExecutive = role === "tenant_super_admin" || role === "ceo";
  const allowed =
    isExecutive ||
    (await hasTenantAppCapability({
      supabase: auth.supabase,
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      appId,
      capability,
    }));
  if (!allowed) return null;

  return {
    supabase: auth.supabase,
    user: auth.user,
    tenantId: auth.tenant.id,
    tenantSlug: auth.tenant.slug,
    role,
  };
}

export async function requireTenantAppCapability(
  appId: string,
  capability: TenantAppCapability,
) {
  const context = await getTenantAppCapabilityContext(appId, capability);
  if (!context) redirect("/dashboard");
  return context;
}
