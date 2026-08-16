"use client";

import Link from "next/link";
import { ArrowUpRight, Home, PanelLeft, UserCircle } from "lucide-react";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import { ManagementBreadcrumbs } from "./ManagementBreadcrumbs";
import { useManagementSidebar } from "./ManagementSidebarProvider";
import type { ManagementWorkspace } from "./layouts/ManagementDashboardLayout";

export function ManagementTopbar({
  workspace,
  workspaceName,
  roleLabel,
  userName,
  dashboardBasePath,
}: {
  workspace: ManagementWorkspace;
  workspaceName: string;
  roleLabel: string;
  userName: string;
  dashboardBasePath: string;
}) {
  const { collapsed, mobileOpen, toggleSidebar } = useManagementSidebar();

  return (
    <header className="management-topbar sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="management-sidebar-trigger -ml-1 flex size-10 shrink-0 items-center justify-center rounded-md md:hidden"
          aria-label={mobileOpen ? "关闭管理导航" : "打开管理导航"}
          aria-controls="management-mobile-navigation"
          aria-expanded={mobileOpen}
          title="切换管理导航（Ctrl+B）"
        >
          <PanelLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleSidebar}
          className="management-sidebar-trigger -ml-1 hidden size-10 shrink-0 items-center justify-center rounded-md md:flex"
          aria-label={collapsed ? "展开管理导航" : "收起管理导航"}
          aria-controls="management-desktop-navigation"
          aria-expanded={!collapsed}
          title="切换管理导航（Ctrl+B）"
        >
          <PanelLeft size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="management-topbar-separator h-4 w-px" aria-hidden="true" />
        <ManagementBreadcrumbs dashboardBasePath={dashboardBasePath} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link href="/" className="management-header-button hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs sm:flex" title="打开网站首页">
          <Home size={14} aria-hidden="true" />
          <span className="hidden xl:inline">网站首页</span>
          <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
        <Link
          href={scopeDashboardPath("/dashboard/admin/profile", dashboardBasePath)}
          className="management-user-button flex h-9 items-center gap-2 rounded-md border p-1 pr-2.5"
          title={`${userName} · ${roleLabel}`}
        >
          <span className="management-avatar flex size-7 items-center justify-center rounded-md text-xs font-semibold">
            {userName.trim().slice(0, 1) || <UserCircle size={14} aria-hidden="true" />}
          </span>
          <span className="management-user-copy hidden min-w-0 max-w-32 sm:block">
            <strong className="block truncate text-xs font-semibold">{userName}</strong>
            <small className="app-muted-text mt-0.5 block truncate text-[11px]">{roleLabel}</small>
          </span>
          <span className="sr-only">{workspace === "platform" ? "平台" : "机构"}：{workspaceName}</span>
        </Link>
      </div>
    </header>
  );
}
