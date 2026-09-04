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
import { PortalRewardsMenu } from "./PortalRewardsMenu";

type PortalTopbarProps = {
  portalPath: string;
  dashboardBasePath: string;
  tenantName: string;
  userName: string;
  accountLabel: string;
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
  studentId,
  apps,
  notifications,
  learningNotificationsLoadFailed,
  platformNotificationsLoadFailed,
  profileContent,
  settingsContent,
}: PortalTopbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[4.5rem] overflow-visible border-b border-white/10 bg-slate-950/95 px-4 text-white shadow-[0_16px_50px_-34px_rgba(15,23,42,0.95)] backdrop-blur-xl sm:px-6 lg:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[42rem] max-w-[70vw] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_64%)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent"
      />

      <div className="relative flex h-full w-full items-center gap-2 sm:gap-3 lg:gap-5">
        <Link
          href={portalPath}
          aria-label={`返回 ${tenantName} 学生应用门户`}
          className="group flex h-11 min-w-0 shrink-0 items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:gap-3"
        >
          <span className="bg-gradient-to-r from-emerald-200 to-lime-200 bg-clip-text font-[family-name:var(--font-geist-sans)] text-xl font-black tracking-tight text-transparent transition group-hover:brightness-110">
            UPLY
          </span>
          <span aria-hidden="true" className="hidden h-5 w-px bg-white/15 sm:block" />
          <span className="hidden max-w-28 truncate text-sm font-bold text-slate-200 sm:block lg:max-w-40">
            {tenantName}
          </span>
        </Link>

        <nav aria-label="学生应用门户主导航" className="hidden shrink-0 items-center gap-1 lg:flex">
          <Link
            href={portalPath}
            aria-current="page"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-black text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-300" />
            应用门户
          </Link>
          <Link
            href={`${portalPath}#learning-summary`}
            className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            今日学习
          </Link>
          <Link
            href={`${portalPath}#student-apps`}
            className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            全部应用
          </Link>
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <LazyGuideAgentChat
            studentId={studentId}
            dashboardBasePath={dashboardBasePath}
            appearance="dark"
            showLabel
          />
        </div>

        <span aria-hidden="true" className="hidden h-5 w-px bg-white/12 xl:block" />

        <PortalAppSwitcher apps={apps} />

        <PortalRewardsMenu />

        <PortalNotificationMenu
          notifications={notifications}
          learningLoadFailed={learningNotificationsLoadFailed}
          platformLoadFailed={platformNotificationsLoadFailed}
          reloadHref={portalPath}
        />

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
