import type { ReactNode } from "react";

import { requireActiveUser } from "@/lib/auth";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardSidebar } from "./DashboardSidebar";
import { DashboardPermissionGate } from "./DashboardPermissionGate";
import { GlobalTopbar } from "./GlobalTopbar";
import { ThemeProvider } from "./ThemeProvider";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, profile } = await requireActiveUser();

  const userName =
    profile?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "用户";

  const userRole = profile?.role ?? "student";
  const membershipTier = normalizeMembershipTier(profile?.membership_tier);

  return (
    <ThemeProvider>
      <div className="app-shell flex min-h-screen flex-col">
        <GlobalTopbar />

        <div className="flex min-h-0 flex-1">
          <DashboardSidebar
            userName={userName}
            userRole={userRole}
            membershipTier={membershipTier}
          />

          <main className="min-w-0 flex-1 pb-24 md:pb-0">
            <DashboardPermissionGate userRole={userRole} membershipTier={membershipTier}>
              {children}
            </DashboardPermissionGate>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
