import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";

export type LibraryScope = "platform" | "institution" | null;

export type LibraryAccess = {
  canManage: boolean;
  canCurate: boolean;
  scope: LibraryScope;
  tenantId: string | null;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getLibraryAccess(): Promise<LibraryAccess> {
  const { supabase, user, profile, platformProfile, tenant } =
    await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;
  const isPlatformOwner =
    platformProfile?.global_role === "platform_owner" &&
    platformProfile.role === "platform_super_admin" &&
    !tenantId;

  if (isPlatformOwner) {
    return {
      canManage: true,
      canCurate: true,
      scope: "platform",
      tenantId,
      role: "platform_super_admin",
      supabase,
      user,
    };
  }

  const isInstitutionManager =
    Boolean(tenantId) &&
    (role === "tenant_super_admin" || role === "ceo" || role === "admin");

  return {
    canManage: isInstitutionManager,
    canCurate: false,
    scope: isInstitutionManager ? "institution" : null,
    tenantId,
    role,
    supabase,
    user,
  };
}

export async function requireLibraryOverviewAccess() {
  const access = await getLibraryAccess();
  if (!access.canManage || !access.scope) redirect("/dashboard");
  return access;
}

export async function requireLibraryManager() {
  const access = await getLibraryAccess();
  if (!access.canCurate || access.scope !== "platform") {
    redirect("/dashboard/admin/library");
  }
  return { ...access, scope: "platform" as const };
}
