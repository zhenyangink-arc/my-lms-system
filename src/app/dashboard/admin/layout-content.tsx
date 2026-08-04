import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isPlatformTenantManagerRole, isValidRole } from "@/lib/admin";
import { isAssignmentManagerRole } from "@/lib/learning-assignments";
import { requireActiveUser } from "@/lib/auth";


export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const auth = await requireActiveUser();
  const navigationRole =
    auth.platformProfile?.role === "platform_super_admin"
      ? "platform_super_admin"
      : auth.profile?.role;

  if (
    !isValidRole(navigationRole) ||
    (!isAssignmentManagerRole(navigationRole) &&
      !isPlatformTenantManagerRole(navigationRole))
  ) {
    redirect("/dashboard");
  }

  return children;
}
