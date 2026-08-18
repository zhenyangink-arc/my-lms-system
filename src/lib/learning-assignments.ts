import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { isValidRole, type UserRole } from "@/lib/admin";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";

export const assignmentManagerRoles = new Set<UserRole>([
  "teacher",
  "admin",
  "ceo",
  "tenant_super_admin",
  "platform_super_admin",
]);

export function isAssignmentManagerRole(role: string | null | undefined) {
  return isValidRole(role) && assignmentManagerRoles.has(role);
}

export async function requireAssignmentManager() {
  const { supabase, user, profile } = await requireActiveUser();
  if (!isAssignmentManagerRole(profile?.role)) redirect("/dashboard/assignments");

  return {
    supabase,
    user,
    role: profile?.role as UserRole,
  };
}

export async function requireAssignmentStudent() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  if (isAssignmentManagerRole(profile?.role)) redirect("/dashboard/admin/assignments");
  if (profile?.role && profile.role !== "student") redirect("/dashboard");
  if (
    !canUseStudentFeature(
      "student",
      normalizeMembershipTier(profile?.membership_tier),
      "learning_assignments"
    )
  ) {
    redirect("/dashboard");
  }

  return { supabase, user, tenant };
}

export async function requireAssignmentViewer() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const role = isValidRole(profile?.role) ? profile.role : "student";
  if (
    role === "student" &&
    !canUseStudentFeature(
      role,
      normalizeMembershipTier(profile?.membership_tier),
      "learning_assignments"
    )
  ) {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    tenant,
    role,
    isManager: isAssignmentManagerRole(role),
  };
}
