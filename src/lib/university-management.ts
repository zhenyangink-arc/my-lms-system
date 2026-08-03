import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";

const institutionViewerRoles = new Set([
  "tenant_super_admin",
  "ceo",
  "admin",
]);

export async function getUniversityManagementAccess() {
  const auth = await requireActiveUser();
  const globalRole = auth.platformProfile?.global_role ?? null;
  const canManageContent =
    globalRole === "platform_owner" || globalRole === "platform_admin";
  const canPermanentlyDelete = globalRole === "platform_owner";
  const isInstitutionViewer =
    Boolean(auth.tenant) && institutionViewerRoles.has(auth.profile?.role ?? "");
  const canViewManagement =
    canManageContent ||
    globalRole === "platform_deputy" ||
    isInstitutionViewer;

  return {
    ...auth,
    canManageContent,
    canPermanentlyDelete,
    canViewManagement,
    isInstitutionViewer,
  };
}

export async function requireUniversityManagementAccess() {
  const access = await getUniversityManagementAccess();
  if (!access.canViewManagement) redirect("/dashboard");
  return access;
}

export async function requireUniversityContentManager() {
  const access = await getUniversityManagementAccess();
  if (!access.canManageContent) {
    throw new Error("当前账号只能查看韩国大学资料，不能新增或修改内容。");
  }
  return access;
}

export async function requireUniversityDeletionManager() {
  const access = await getUniversityManagementAccess();
  if (!access.canPermanentlyDelete) {
    throw new Error("只有平台负责人可以永久删除韩国大学资料。");
  }
  return access;
}
