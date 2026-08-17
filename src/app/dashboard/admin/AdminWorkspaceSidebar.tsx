"use client";

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, X } from "lucide-react";

import { useManagementSidebar } from "@/app/dashboard/ManagementSidebarProvider";
import { RouteLinkStatus } from "@/app/dashboard/RouteLinkStatus";
import type { UserRole } from "@/lib/admin";
import { normalizeDashboardPathname, scopeDashboardPath } from "@/lib/dashboard-path";
import { ADMIN_GROUP_LABELS, getAdminRoleLabel, getVisibleAdminNavigation } from "./admin-navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAVIGATION_PRIORITY: Record<string, number> = {
  "/dashboard/admin": 0,
  "/dashboard/admin/apps": 1,
  "/dashboard/courses": 0,
  "/dashboard/admin/library": 5,
  "/dashboard/admin/announcements": 0,
  "/dashboard/admin/help": 1,
  "/dashboard/admin/tenants": 0,
  "/dashboard/admin/accounts": 1,
  "/dashboard/admin/permissions": 2,
  "/dashboard/admin/token-usage": 3,
};

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
  canManageStudentAssignments,
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
  canManageStudentAssignments: boolean;
  dashboardBasePath: string;
}) {
  const pathname = normalizeDashboardPathname(usePathname());
  const { collapsed, mobileOpen, setMobileOpen, toggleSidebar } = useManagementSidebar();
  const mobileDialogRef = useRef<HTMLElement>(null);
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
    canManageStudentAssignments,
  });
  const groups = ["overview", "teaching", "content", "service", "support", "organization"] as const;

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => {
      mobileDialogRef.current
        ?.querySelector<HTMLElement>("button, a[href], select, input")
        ?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  }, [mobileOpen]);

  function trapMobileFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const sidebarContent = (
    <>
      <div className="management-sidebar-header flex h-14 shrink-0 items-center gap-2 border-b px-2">
        <span className="management-sidebar-logo flex size-8 shrink-0 items-center justify-center rounded-md">
          <span aria-hidden="true">P</span>
        </span>
        <div className="management-sidebar-copy min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{workspaceLabel}</p>
        </div>
        <button type="button" onClick={() => setMobileOpen(false)} className="management-mobile-close flex size-10 items-center justify-center rounded-md md:hidden" aria-label="关闭管理导航">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <nav className="management-navigation min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2" aria-label="管理中心导航">
        <div className="space-y-3">
          {groups.map((group) => {
            const groupItems = items
              .filter((item) => item.group === group)
              .sort(
                (left, right) =>
                  (NAVIGATION_PRIORITY[left.href] ?? 99) -
                  (NAVIGATION_PRIORITY[right.href] ?? 99),
              );
            if (groupItems.length === 0) return null;
            return (
              <section key={group} className="management-nav-section">
                <p className="management-nav-group flex h-8 items-center px-2 text-xs font-medium">{ADMIN_GROUP_LABELS[group]}</p>
                <ul className="space-y-1">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={scopeDashboardPath(item.href, dashboardBasePath)}
                          onClick={() => setMobileOpen(false)}
                          data-active={active ? "true" : "false"}
                          aria-current={active ? "page" : undefined}
                          className="management-nav-item group/item flex h-10 items-center gap-2 overflow-hidden rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                          title={collapsed ? item.label : undefined}
                          aria-label={item.label}
                        >
                          <Icon className="management-nav-icon size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                          <span className="management-nav-label min-w-0 flex-1 truncate">{item.label}</span>
                          <RouteLinkStatus />
                          <ChevronRight className="management-nav-chevron size-3.5 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-50" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </nav>

      <div className="management-sidebar-footer shrink-0 border-t p-2">
        <Link
          href={scopeDashboardPath("/dashboard/admin/profile", dashboardBasePath)}
          aria-current={isActivePath(pathname, "/dashboard/admin/profile") ? "page" : undefined}
          className="management-sidebar-account flex h-12 items-center gap-2 overflow-hidden rounded-md p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          title={collapsed ? getAdminRoleLabel(role) : undefined}
        >
          <span className="management-account-avatar flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">{workspaceLabel.slice(0, 1)}</span>
          <span className="management-sidebar-copy min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{getAdminRoleLabel(role)}</span>
            <span className="app-muted-text block truncate text-[11px]">{items.length} 个功能入口</span>
          </span>
        </Link>
      </div>
    </>
  );

  return (
    <>
      <div data-collapsed={collapsed ? "true" : "false"} className={`management-sidebar-gap hidden shrink-0 transition-[width] duration-200 md:block ${collapsed ? "w-12" : "w-64"}`} aria-hidden="true" />
      <aside id="management-desktop-navigation" data-collapsed={collapsed ? "true" : "false"} className={`management-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r transition-[width] duration-200 md:flex ${collapsed ? "w-12" : "w-64"}`}>
        {sidebarContent}
        <button type="button" onClick={toggleSidebar} className="management-sidebar-rail absolute inset-y-0 -right-2 hidden w-4 md:block" aria-label={collapsed ? "展开管理导航" : "收起管理导航"} title={collapsed ? "展开管理导航" : "收起管理导航"} />
      </aside>

      {mobileOpen && (
        <div className="management-mobile-layer fixed inset-0 z-50 md:hidden">
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/45" onClick={() => setMobileOpen(false)} aria-label="关闭管理导航" />
          <aside
            ref={mobileDialogRef}
            id="management-mobile-navigation"
            className="management-sidebar relative flex h-svh w-[18rem] max-w-[86vw] flex-col border-r shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="管理中心导航"
            onKeyDown={trapMobileFocus}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
