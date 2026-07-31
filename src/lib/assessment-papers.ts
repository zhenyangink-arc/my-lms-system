import "server-only";

import { redirect } from "next/navigation";

import { isValidRole, type UserRole } from "@/lib/admin";
import { requireActiveUser } from "@/lib/auth";
import { isAssignmentManagerRole } from "@/lib/learning-assignments";

export type AssessmentPaperType = "homework" | "exam";
export type AssessmentPaperStatus =
  | "draft"
  | "published"
  | "retired"
  | "archived";

export type AssessmentPaperAccess = {
  canView: boolean;
  canManagePapers: boolean;
  canPublishPapers: boolean;
  isPlatformWorkspace: boolean;
  role: UserRole;
  tenantId: string | null;
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"];
  user: Awaited<ReturnType<typeof requireActiveUser>>["user"];
};

export async function getAssessmentPaperAccess(): Promise<AssessmentPaperAccess> {
  const { supabase, user, profile, platformProfile, tenant } =
    await requireActiveUser();
  const roleValue =
    platformProfile?.role === "platform_super_admin"
      ? "platform_super_admin"
      : profile?.role;
  const role = isValidRole(roleValue) ? roleValue : "student";

  const { data: manageData, error: manageError } = await supabase.rpc(
    "current_user_can_manage_assessment_papers"
  );
  const canManagePapers = !manageError && manageData === true;
  const canPublishPapers =
    !canManagePapers && Boolean(tenant) && isAssignmentManagerRole(profile?.role);

  return {
    canView: canManagePapers || canPublishPapers,
    canManagePapers,
    canPublishPapers,
    isPlatformWorkspace: canManagePapers && !tenant,
    role,
    tenantId: tenant?.id ?? null,
    supabase,
    user,
  };
}

export async function requireAssessmentPaperWorkspace() {
  const access = await getAssessmentPaperAccess();
  if (!access.canView) redirect("/dashboard");
  return access;
}

export async function requireAssessmentPaperManager() {
  const access = await getAssessmentPaperAccess();
  if (!access.canManagePapers) redirect("/dashboard/admin/assignments");
  return access;
}

export async function requireAssessmentPaperPublisher() {
  const access = await getAssessmentPaperAccess();
  if (!access.canPublishPapers) redirect("/dashboard/admin/assignments");
  return access;
}
