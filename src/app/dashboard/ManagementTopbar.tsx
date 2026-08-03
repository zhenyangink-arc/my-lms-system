import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Home,
  PanelsTopLeft,
  UserCircle,
} from "lucide-react";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import type { ManagementWorkspace } from "./layouts/ManagementDashboardLayout";

export function ManagementTopbar({
  workspace,
  workspaceName,
  roleLabel,
  userName,
  dashboardBasePath,
  homePath,
}: {
  workspace: ManagementWorkspace;
  workspaceName: string;
  roleLabel: string;
  userName: string;
  dashboardBasePath: string;
  homePath: string;
}) {
  const WorkspaceIcon = workspace === "platform" ? PanelsTopLeft : Building2;

  return (
    <header className="management-topbar app-topbar sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b px-3 sm:px-4">
      <Link
        href={scopeDashboardPath(homePath, dashboardBasePath)}
        className="management-brand flex min-w-0 items-center gap-2.5"
      >
        <span className="management-mark flex h-7 w-7 shrink-0 items-center justify-center">
          <WorkspaceIcon size={14} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="truncate text-[13px] font-semibold tracking-[-0.01em]">
          {workspaceName}
        </span>
        <span className="management-topbar-divider hidden h-4 w-px sm:block" />
        <span className="app-muted-text hidden text-[11px] sm:block">
          {workspace === "platform" ? "Platform" : "Organization"}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="app-muted-text hidden items-center gap-2 px-2 text-[11px] lg:flex">
          <span className="management-status-dot" aria-hidden="true" />
          {roleLabel}
        </span>

        <Link
          href="/"
          className="management-icon-button hidden h-8 items-center gap-1.5 border px-2.5 text-[11px] sm:flex"
          title="打开网站首页"
        >
          <Home size={13} strokeWidth={1.7} aria-hidden="true" />
          <span className="hidden xl:inline">网站</span>
          <ArrowUpRight size={11} strokeWidth={1.7} aria-hidden="true" />
        </Link>

        <Link
          href={scopeDashboardPath("/dashboard/profile", dashboardBasePath)}
          className="management-profile flex h-8 items-center gap-2 border p-1 pr-2.5"
          title={`${userName} · ${roleLabel}`}
        >
          <span className="management-avatar flex h-6 w-6 items-center justify-center text-[10px] font-semibold">
            {userName.trim().slice(0, 1) || (
              <UserCircle size={13} aria-hidden="true" />
            )}
          </span>
          <span className="hidden max-w-28 truncate text-[11px] font-medium sm:block">
            {userName}
          </span>
        </Link>
      </div>
    </header>
  );
}
