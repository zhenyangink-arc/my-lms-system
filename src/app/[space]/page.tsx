import { redirect } from "next/navigation";

import { requireDashboardAccess } from "@/lib/dashboard-access";
import {
  MEMBERSHIP_TIER_LABELS,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { PortalTopbar } from "./PortalTopbar";

export default async function StudentPortalPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const access = await requireDashboardAccess("tenant", space);

  if (access.auth.profile?.role !== "student") {
    redirect(access.dashboardBasePath);
  }

  const { user, profile, tenant } = access.auth;
  const dashboardBasePath = access.dashboardBasePath;
  const portalPath = dashboardBasePath.slice(0, -"/dashboard".length);
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";
  const accountLabel =
    MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)];

  return (
    <>
      <PortalTopbar
        portalPath={portalPath}
        dashboardBasePath={dashboardBasePath}
        tenantName={tenant?.name ?? space}
        userName={userName}
        accountLabel={accountLabel}
        studentId={user.id}
      />
      <main className="min-h-screen bg-slate-50 px-8 pb-10 pt-[6.5rem] text-slate-950">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-bold">课程门户</h1>
        </div>
      </main>
    </>
  );
}
