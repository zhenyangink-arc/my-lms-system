import type { ReactNode } from "react";
import Link from "next/link";

import { LazyGuideAgentChat } from "@/components/guide-agent/LazyGuideAgentChat";
import { PortalAccountMenu } from "./PortalAccountMenu";
import {
  PortalAppSwitcher,
  type PortalSwitcherApp,
} from "./PortalAppSwitcher";
import {
  PortalNotificationMenu,
  type PortalNotificationItem,
} from "./PortalNotificationMenu";

type PortalTopbarProps = {
  portalPath: string;
  dashboardBasePath: string;
  tenantName: string;
  userName: string;
  accountLabel: string;
  avatarUrl: string | null;
  studentId: string;
  apps: PortalSwitcherApp[];
  notifications: PortalNotificationItem[];
  learningNotificationsLoadFailed: boolean;
  platformNotificationsLoadFailed: boolean;
  profileContent: ReactNode;
  settingsContent: ReactNode;
};

export function PortalTopbar({
  portalPath,
  dashboardBasePath,
  tenantName,
  userName,
  accountLabel,
  avatarUrl,
  studentId,
  apps,
  notifications,
  learningNotificationsLoadFailed,
  platformNotificationsLoadFailed,
  profileContent,
  settingsContent,
}: PortalTopbarProps) {
  return (
    <header className="fixed inset-x-2 top-2 z-40 h-[4.5rem] overflow-visible rounded-[1.35rem] border border-white/85 bg-white/82 px-3 text-slate-950 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.34)] backdrop-blur-2xl sm:inset-x-4 sm:px-5 lg:px-6">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[42rem] max-w-[70vw] bg-[radial-gradient(circle_at_top_right,rgba(167,243,208,0.28),transparent_64%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
      />

      <div className="relative flex h-full w-full items-center gap-2 sm:gap-3 lg:gap-5">
        <Link
          href={portalPath}
          aria-label={`返回 ${tenantName} 学生应用门户`}
          className="group flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:gap-3"
        >
          <span className="font-[family-name:var(--font-geist-sans)] text-xl font-black tracking-[-0.04em] text-slate-950 transition group-hover:text-emerald-700">
            UPLY
          </span>
          <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 sm:block" />
          <span className="hidden max-w-28 truncate text-sm font-bold text-slate-600 sm:block lg:max-w-40">
            {tenantName}
          </span>
        </Link>

        <nav aria-label="学生应用门户主导航" className="hidden shrink-0 items-center gap-1 lg:flex">
          <Link
            href={portalPath}
            aria-current="page"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />
            应用门户
          </Link>
          <Link
            href={`${portalPath}#learning-summary`}
            className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            今日学习
          </Link>
          <Link
            href={`${portalPath}#student-apps`}
            className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            全部应用
          </Link>
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <LazyGuideAgentChat
            studentId={studentId}
            dashboardBasePath={dashboardBasePath}
            appearance="light"
            showLabel
          />
        </div>

        <PortalAppSwitcher apps={apps} />

        <PortalNotificationMenu
          notifications={notifications}
          learningLoadFailed={learningNotificationsLoadFailed}
          platformLoadFailed={platformNotificationsLoadFailed}
          reloadHref={portalPath}
        />

        <PortalAccountMenu
          userName={userName}
          accountLabel={accountLabel}
          avatarUrl={avatarUrl}
          profileContent={profileContent}
          settingsContent={settingsContent}
        />
      </div>
    </header>
  );
}
