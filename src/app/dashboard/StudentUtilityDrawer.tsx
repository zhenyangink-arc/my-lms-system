"use client";

import Link from "next/link";
import { Bell, GraduationCap, Home } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeSwitcher } from "./ThemeSwitcher";
import {
  BackgroundBrightnessControl,
  CardGradientControl,
  CardOpacityControl,
  DashboardAppearanceSync,
} from "./BackgroundBrightnessControl";
import { LogoutButton } from "./LogoutButton";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { EdgeHandle } from "./shell/EdgeHandle";
import { useHoverDrawer } from "./shell/useHoverDrawer";

type Props = {
  tenantName: string;
  userName: string;
  accountLabel: string;
  unreadCount: number;
  dashboardBasePath: string;
};

export function StudentUtilityDrawer({
  tenantName,
  userName,
  accountLabel,
  unreadCount,
  dashboardBasePath,
}: Props) {
  const { open, setOpen, handleProps, panelProps } = useHoverDrawer();

  return (
    <>
      <DashboardAppearanceSync />
      <div
        className="app-edge-hover-zone"
        data-side="right"
        aria-hidden="true"
        onMouseEnter={handleProps.onMouseEnter}
      />
      <EdgeHandle
        side="right"
        className="app-edge-handle-student"
        label={open ? "关闭设置与通知" : "打开设置与通知"}
        open={open}
        indicator={unreadCount > 0}
        {...handleProps}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="app-glass-panel gap-6 overflow-y-auto rounded-l-3xl p-5 data-[side=right]:w-full data-[side=right]:sm:max-w-xs"
          {...panelProps}
        >
          <SheetTitle className="sr-only">设置与通知</SheetTitle>

          <Link
            href={dashboardBasePath}
            className="flex min-w-0 items-center gap-3"
            onClick={() => setOpen(false)}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{
                background:
                  "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
              }}
            >
              <GraduationCap size={21} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black tracking-tight">
                {tenantName}
              </span>
              <span className="block truncate text-xs font-semibold app-muted-text">
                韩国留学与韩语成长工作台
              </span>
            </span>
          </Link>

          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition hover:-translate-y-0.5"
              style={{ color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)" }}
            >
              <Home size={16} aria-hidden="true" />
              网站首页
            </Link>

            <Link
              href={`${dashboardBasePath}#reminders`}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition hover:-translate-y-0.5"
              style={{ color: "var(--app-muted)", backgroundColor: "var(--app-soft-bg)" }}
            >
              <span className="flex items-center gap-2">
                <Bell size={16} aria-hidden="true" />
                通知提醒
              </span>
              {unreadCount > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href={scopeDashboardPath("/dashboard/profile", dashboardBasePath)}
                onClick={() => setOpen(false)}
                className="app-soft-card flex min-w-0 flex-1 items-center gap-2 rounded-xl border p-1.5 pr-2.5 transition hover:-translate-y-0.5"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white"
                  style={{ backgroundColor: "var(--app-success)" }}
                >
                  {userName.trim().slice(0, 1) || "学"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{userName}</span>
                  <span className="block truncate text-[10px] font-bold app-muted-text">{accountLabel}</span>
                </span>
              </Link>
              <LogoutButton collapsed />
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 app-divider">
            <span className="px-1 text-xs font-bold tracking-[0.18em] app-muted-text">
              界面主题
            </span>
            <ThemeSwitcher />
          </div>

          <div className="space-y-3 border-t pt-4 app-divider">
            <div className="flex items-center justify-between">
              <span className="px-1 text-xs font-bold tracking-[0.18em] app-muted-text">
                背景亮度
              </span>
              <BackgroundBrightnessControl />
            </div>
            <div className="flex items-center justify-between">
              <span className="px-1 text-xs font-bold tracking-[0.18em] app-muted-text">
                卡片透明度
              </span>
              <CardOpacityControl />
            </div>
            <div className="flex items-center justify-between">
              <span className="px-1 text-xs font-bold tracking-[0.18em] app-muted-text">
                卡片渐变
              </span>
              <CardGradientControl />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
