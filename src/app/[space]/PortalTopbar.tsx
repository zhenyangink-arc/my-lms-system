import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { GuideAgentChat } from "@/components/guide-agent/GuideAgentChat";
import { GuideAgentProvider } from "@/components/guide-agent/GuideAgentProvider";
import { PortalAccountMenu } from "./PortalAccountMenu";
import { PortalCourseSearchInput } from "./PortalCourseSearch";

type PortalTopbarProps = {
  portalPath: string;
  dashboardBasePath: string;
  tenantName: string;
  userName: string;
  accountLabel: string;
  studentId: string;
};

const navLinkClassName =
  "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export function PortalTopbar({
  portalPath,
  dashboardBasePath,
  tenantName,
  userName,
  accountLabel,
  studentId,
}: PortalTopbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200/80 bg-white/85 px-8 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-5">
        <Link
          href={portalPath}
          aria-label={`返回 ${tenantName} 课程门户`}
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-black tracking-tight text-transparent">
            UPLY
          </span>
          <span aria-hidden="true" className="h-5 w-px bg-slate-200" />
          <span className="max-w-40 truncate text-sm font-semibold text-slate-800">
            {tenantName}
          </span>
        </Link>

        <nav aria-label="课程门户主导航" className="flex shrink-0 items-center gap-1">
          <Link
            href={portalPath}
            aria-current="page"
            className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            课程门户
          </Link>
          <Link href={`${dashboardBasePath}/progress`} className={navLinkClassName}>
            学习进度
          </Link>
          <Link href={`${dashboardBasePath}/library`} className={navLinkClassName}>
            学习资料
          </Link>
        </nav>

        <div className="flex min-w-8 flex-1 items-center justify-end gap-2">
          <PortalCourseSearchInput />
          <GuideAgentProvider>
            <GuideAgentChat
              studentId={studentId}
              dashboardBasePath={dashboardBasePath}
              triggerVariant="portal"
            />
          </GuideAgentProvider>
        </div>

        <Link
          href={dashboardBasePath}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <LayoutDashboard aria-hidden="true" size={17} />
          学习工作台
        </Link>

        <PortalAccountMenu
          dashboardBasePath={dashboardBasePath}
          userName={userName}
          accountLabel={accountLabel}
        />
      </div>
    </header>
  );
}
