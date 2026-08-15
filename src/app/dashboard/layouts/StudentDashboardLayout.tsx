import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { GuideAgentProvider } from "@/components/guide-agent/GuideAgentProvider";
import type { MembershipTier } from "@/lib/student-permissions";
import type { StudentAppSlug } from "@/lib/student-apps";
import { AuroraOrbs } from "../AuroraOrbs";
import { DashboardPermissionGate } from "../DashboardPermissionGate";
import { StudentSystemSidebar } from "../StudentSystemSidebar";
import { StudentFullscreenPrompt } from "../StudentFullscreenPrompt";
import { StudentPageHeader } from "../StudentPageHeader";
import { StudentPwaInstallPrompt } from "../StudentPwaInstallPrompt";
import { StudentTopbar } from "../StudentTopbar";

export function StudentDashboardLayout({
  children,
  studentId,
  membershipTier,
  canAccessAnnouncements,
  dashboardBasePath,
  studentAppSlug,
  userRole = "student",
}: {
  children: ReactNode;
  studentId?: string;
  userName: string;
  membershipTier: MembershipTier;
  canAccessAnnouncements: boolean;
  dashboardBasePath: string;
  studentAppSlug?: StudentAppSlug;
  userRole?: string;
}) {
  const isPlatformAudit = userRole === "platform_course_inspector";

  return (
    <GuideAgentProvider>
      <div
        className="app-shell student-system-stage min-h-screen"
        data-dashboard-layout="student"
        data-dashboard-ui="student"
        data-student-shell="system"
      >
        <AuroraOrbs />
        {!isPlatformAudit && <StudentFullscreenPrompt />}
        {!isPlatformAudit && <StudentPwaInstallPrompt />}

        <DashboardPermissionGate
          userRole={userRole}
          membershipTier={membershipTier}
        >
          <div className="student-system-window mx-auto flex min-h-[calc(100dvh-32px)] w-full overflow-hidden">
            <StudentSystemSidebar
              userRole={userRole}
              membershipTier={membershipTier}
              canAccessAnnouncements={canAccessAnnouncements}
              dashboardBasePath={dashboardBasePath}
              studentAppSlug={studentAppSlug}
            />

            <div className="student-system-workspace min-w-0 flex-1">
              <StudentTopbar
                dashboardBasePath={dashboardBasePath}
                studentAppSlug={studentAppSlug}
              />

              {isPlatformAudit && (
                <div
                  className="pointer-events-none absolute right-5 top-[76px] z-[70]"
                  role="status"
                  aria-label="当前为只读巡检模式"
                >
                  <span className="student-system-audit-badge">
                    <ShieldCheck size={14} aria-hidden="true" />
                    只读巡检
                  </span>
                </div>
              )}

              <main className="app-student-main student-system-main min-w-0">
                <StudentPageHeader
                  studentId={studentId}
                  dashboardBasePath={dashboardBasePath}
                  studentAppSlug={studentAppSlug}
                  showAssistant={false}
                />
                {children}
              </main>
            </div>
          </div>
        </DashboardPermissionGate>
      </div>
    </GuideAgentProvider>
  );
}
