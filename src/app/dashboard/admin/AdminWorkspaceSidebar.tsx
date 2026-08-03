"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelsTopLeft, X } from "lucide-react";
import { useState } from "react";

import type { UserRole } from "@/lib/admin";
import { normalizeDashboardPathname, scopeDashboardPath } from "@/lib/dashboard-path";
import {
  ADMIN_GROUP_LABELS,
  getAdminRoleLabel,
  getVisibleAdminNavigation,
} from "./admin-navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminWorkspaceSidebar({
  role,
  workspaceLabel,
  canManageConversationPractice,
  canAccessAnnouncements,
  canManageHelpCenter,
  canManageGradeCenter,
  canManageLearningRecords,
  canManageLibrary,
  canManageDocumentReviews,
  canManageTenants,
  canAccessQuestionBank,
  canManageVisas,
  dashboardBasePath,
}: {
  role: UserRole;
  workspaceLabel: string;
  canManageConversationPractice: boolean;
  canAccessAnnouncements: boolean;
  canManageHelpCenter: boolean;
  canManageGradeCenter: boolean;
  canManageLearningRecords: boolean;
  canManageLibrary: boolean;
  canManageDocumentReviews: boolean;
  canManageTenants: boolean;
  canAccessQuestionBank: boolean;
  canManageVisas: boolean;
  dashboardBasePath: string;
}) {
  const pathname = normalizeDashboardPathname(usePathname());
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getVisibleAdminNavigation(role, {
    canManageConversationPractice,
    canAccessAnnouncements,
    canManageHelpCenter,
    canManageGradeCenter,
    canManageLearningRecords,
    canManageLibrary,
    canManageDocumentReviews,
    canManageTenants,
    canAccessQuestionBank,
    canManageVisas,
  });
  const groups = ["overview", "teaching", "service", "organization"] as const;

  const navigation = (
    <nav className="management-navigation flex-1 overflow-y-auto px-2 py-3" aria-label="管理中心导航">
      <div className="space-y-4">
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          return (
            <section key={group}>
              <p className="management-nav-group mb-1 px-2 text-[10px] font-medium uppercase">{ADMIN_GROUP_LABELS[group]}</p>
              <div className="space-y-px">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={scopeDashboardPath(item.href, dashboardBasePath)}
                      onClick={() => setMobileOpen(false)}
                      data-active={active ? "true" : "false"}
                      className="management-nav-item flex min-h-8 items-center gap-2 px-2 text-[12px] font-medium"
                    >
                      <Icon size={14} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      <div className="management-mobile-nav app-card sticky top-14 z-20 flex h-[58px] items-center gap-3 border-b px-3 md:hidden">
        <button type="button" onClick={() => setMobileOpen((open) => !open)} className="management-icon-button flex h-8 w-8 items-center justify-center border" aria-label={mobileOpen ? "收起管理导航" : "展开管理导航"} aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
        <span className="management-sidebar-mark flex h-7 w-7 items-center justify-center border"><PanelsTopLeft size={14} strokeWidth={1.7} /></span>
        <div><p className="text-[12px] font-semibold">{workspaceLabel}</p><p className="app-muted-text text-[10px]">{getAdminRoleLabel(role)} · {items.length} 个入口</p></div>
      </div>

      {mobileOpen && <div className="app-sidebar sticky top-[114px] z-20 max-h-[calc(100vh-114px)] overflow-y-auto border-b md:hidden">{navigation}</div>}

      <div className="hidden w-[272px] shrink-0 md:block" aria-hidden="true" />
      <aside
        aria-label="管理中心导航"
        className="management-sidebar app-sidebar fixed bottom-0 left-0 top-14 z-20 hidden h-[calc(100dvh-3.5rem)] w-[272px] flex-col overflow-hidden border-r md:flex"
      >
        <div className="management-sidebar-header flex h-[52px] items-center gap-2.5 border-b px-3 app-divider">
          <span className="management-sidebar-mark flex h-7 w-7 shrink-0 items-center justify-center border"><PanelsTopLeft size={14} strokeWidth={1.7} /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold">{workspaceLabel}</p><p className="app-muted-text truncate text-[10px]">{getAdminRoleLabel(role)}工作台</p></div>
        </div>

        {navigation}
      </aside>
    </>
  );
}
