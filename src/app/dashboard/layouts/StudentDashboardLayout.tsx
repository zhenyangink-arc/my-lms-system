import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { GuideAgentProvider } from "@/components/guide-agent/GuideAgentProvider";
import type { MembershipTier } from "@/lib/student-permissions";
import type { StudentAppSlug } from "@/lib/student-apps";
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
        <a
          href="#student-main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[80] focus:rounded-xl focus:bg-[var(--card)] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--foreground)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        >
          跳到主要内容
        </a>
        {!isPlatformAudit && <StudentFullscreenPrompt />}
        {!isPlatformAudit && <StudentPwaInstallPrompt />}

        <DashboardPermissionGate
          userRole={userRole}
          membershipTier={membershipTier}
        >
          <div className="student-system-window mx-auto flex min-h-[calc(100dvh-32px)] w-full overflow-hidden">
            <StudentSystemSidebar
              studentId={studentId}
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

              <main
                id="student-main-content"
                tabIndex={-1}
                className="app-student-main student-system-main min-w-0 scroll-mt-20"
              >
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
