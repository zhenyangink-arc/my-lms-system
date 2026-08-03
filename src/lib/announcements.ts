import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";

export type AnnouncementManagementScope = "platform" | "tenant" | null;

export type AnnouncementAccess = {
  canAccess: boolean;
  scope: AnnouncementManagementScope;
  tenantId: string | null;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

type GrantedAnnouncementAccess = AnnouncementAccess & {
  canAccess: true;
  scope: Exclude<AnnouncementManagementScope, null>;
};

export async function getAnnouncementAccess(): Promise<AnnouncementAccess> {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  const tenantId = tenant?.id ?? null;

  if (!tenantId && role === "platform_super_admin") {
    return { canAccess: true, scope: "platform", tenantId, role, supabase, user };
  }

  if (
    tenantId &&
    (role === "tenant_super_admin" || role === "ceo")
  ) {
    return { canAccess: true, scope: "tenant", tenantId, role, supabase, user };
  }

  return { canAccess: false, scope: null, tenantId, role, supabase, user };
}

export async function requireAnnouncementAccess(): Promise<GrantedAnnouncementAccess> {
  const access = await getAnnouncementAccess();
  if (!access.canAccess || !access.scope) redirect("/dashboard");
  return access as GrantedAnnouncementAccess;
}
