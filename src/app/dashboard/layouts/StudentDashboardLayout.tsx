import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { GuideAgentProvider } from "@/components/guide-agent/GuideAgentProvider";
import type { MembershipTier } from "@/lib/student-permissions";
import { AuroraOrbs } from "../AuroraOrbs";
import { DashboardPermissionGate } from "../DashboardPermissionGate";
import { DashboardSidebar } from "../DashboardSidebar";
import { StudentFullscreenPrompt } from "../StudentFullscreenPrompt";
import { StudentPageHeader } from "../StudentPageHeader";
import { StudentPwaInstallPrompt } from "../StudentPwaInstallPrompt";
import { StudentTopbar } from "../StudentTopbar";

export function StudentDashboardLayout({
  children,
  studentId,
  userName,
  membershipTier,
  canAccessAnnouncements,
  dashboardBasePath,
  userRole = "student",
}: {
  children: ReactNode;
  studentId?: string;
  userName: string;
  membershipTier: MembershipTier;
  canAccessAnnouncements: boolean;
  dashboardBasePath: string;
  userRole?: string;
}) {
  const isPlatformAudit = userRole === "platform_course_inspector";

  return (
    <GuideAgentProvider>
      <div
        className="app-shell flex min-h-screen flex-col"
        data-dashboard-layout="student"
        data-dashboard-ui="student"
      >
        <AuroraOrbs />
        <StudentTopbar />
        {!isPlatformAudit && <StudentFullscreenPrompt />}
        {!isPlatformAudit && <StudentPwaInstallPrompt />}

        {isPlatformAudit && (
          <div
            className="pointer-events-none fixed right-3 top-[78px] z-[70] sm:right-5 sm:top-[84px]"
            role="status"
            aria-label="当前为只读巡检模式"
          >
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black shadow-lg backdrop-blur-md"
              style={{
                color: "var(--app-accent-strong)",
                borderColor: "var(--app-accent)",
                backgroundColor:
                  "color-mix(in srgb, var(--app-card-bg) 88%, transparent)",
              }}
            >
              <ShieldCheck size={14} aria-hidden="true" />
              只读巡检
            </span>
          </div>
        )}

        <DashboardPermissionGate
          userRole={userRole}
          membershipTier={membershipTier}
        >
          <DashboardSidebar
            userName={userName}
            userRole={userRole}
            membershipTier={membershipTier}
            canAccessAnnouncements={canAccessAnnouncements}
            dashboardBasePath={dashboardBasePath}
          />

          <main className="min-w-0 flex-1 pb-24 md:pb-0 md:ml-[52px] md:mr-[48px]">
            <StudentPageHeader
              studentId={studentId}
              dashboardBasePath={dashboardBasePath}
            />
            {children}
          </main>
        </DashboardPermissionGate>
      </div>
    </GuideAgentProvider>
  );
}
