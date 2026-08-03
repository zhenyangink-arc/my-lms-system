import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { hasExplicitPermission } from "@/lib/permissions/access";

export type VisaManagementScope = "institution" | "platform" | null;

export type VisaManagementAccess = {
  canManage: boolean;
  scope: VisaManagementScope;
  role: UserRole;
  tenantId: string | null;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getVisaManagementAccess(): Promise<VisaManagementAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;

  if (!tenantId && role === "platform_super_admin") {
    return { canManage: true, scope: "platform", role, tenantId, supabase, user };
  }
  if (!tenantId) {
    return { canManage: false, scope: null, role, tenantId, supabase, user };
  }

  if (role === "tenant_super_admin" || role === "ceo") {
    return { canManage: true, scope: "institution", role, tenantId, supabase, user };
  }
  if (role !== "admin") {
    return { canManage: false, scope: null, role, tenantId, supabase, user };
  }

  const canManage = await hasExplicitPermission(
    supabase,
    user.id,
    "visa_management.manage",
    tenantId
  );

  return {
    canManage,
    scope: canManage ? "institution" : null,
    role,
    tenantId,
    supabase,
    user,
  };
}

export async function requireVisaOverviewAccess() {
  const access = await getVisaManagementAccess();
  if (!access.canManage || !access.scope) redirect("/dashboard");
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
