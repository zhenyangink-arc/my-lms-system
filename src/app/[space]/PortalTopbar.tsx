import type { ReactNode } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { LazyGuideAgentChat } from "@/components/guide-agent/LazyGuideAgentChat";
import { PortalAccountMenu } from "./PortalAccountMenu";

type PortalTopbarProps = {
  portalPath: string;
  dashboardBasePath: string;
  tenantName: string;
  userName: string;
  accountLabel: string;
  studentId: string;
  profileContent: ReactNode;
  settingsContent: ReactNode;
};

export function PortalTopbar({
  portalPath,
  dashboardBasePath,
  tenantName,
  userName,
  accountLabel,
  studentId,
  profileContent,
  settingsContent,
}: PortalTopbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200/80 bg-white/85 px-8 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-5">
        <Link
          href={portalPath}
          aria-label={`返回 ${tenantName} 学生应用门户`}
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

        <nav aria-label="学生应用门户主导航" className="flex shrink-0 items-center gap-1">
          <Link
            href={portalPath}
            aria-current="page"
            className="rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            应用门户
          </Link>
        </nav>

        <div className="flex min-w-8 flex-1 items-center justify-end gap-2">
          <LazyGuideAgentChat
            studentId={studentId}
            dashboardBasePath={dashboardBasePath}
          />
        </div>

        <Link
          href={dashboardBasePath}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <LayoutDashboard aria-hidden="true" size={17} />
          韩语学习
        </Link>

        <PortalAccountMenu
          userName={userName}
          accountLabel={accountLabel}
          profileContent={profileContent}
          settingsContent={settingsContent}
        />
      </div>
    </header>
  );
}
