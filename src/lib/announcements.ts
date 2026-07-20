import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { isValidRole, type UserRole } from "@/lib/admin";

export type AnnouncementAccess = {
  canAccess: boolean;
  canAssignAdmins: boolean;
  role: UserRole;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getAnnouncementAccess(): Promise<AnnouncementAccess> {
  const { supabase, user, profile } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";

  if (role === "tenant_super_admin" || role === "platform_super_admin" || role === "ceo") {
    return {
      canAccess: true,
      canAssignAdmins: role === "tenant_super_admin" || role === "platform_super_admin",
      role,
      supabase,
      user,
    };
  }

  if (role !== "admin") {
    return { canAccess: false, canAssignAdmins: false, role, supabase, user };
  }

  const { data, error } = await supabase
    .from("announcement_admin_assignments")
    .select("admin_id")
    .eq("admin_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  return {
    canAccess: !error && Boolean(data),
    canAssignAdmins: false,
    role,
    supabase,
    user,
  };
}

export async function requireAnnouncementAccess() {
  const access = await getAnnouncementAccess();
  if (!access.canAccess) redirect("/dashboard");
  return access;
}
