"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, PanelsTopLeft, X } from "lucide-react";
import { useState } from "react";

import type { UserRole } from "@/lib/admin";
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
  canManageConversationPractice,
  canAccessAnnouncements,
  canManageHelpCenter,
  canManageGradeCenter,
  canManageLearningRecords,
  canManageLibrary,
}: {
  role: UserRole;
  canManageConversationPractice: boolean;
  canAccessAnnouncements: boolean;
  canManageHelpCenter: boolean;
  canManageGradeCenter: boolean;
  canManageLearningRecords: boolean;
  canManageLibrary: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = getVisibleAdminNavigation(role, {
    canManageConversationPractice,
    canAccessAnnouncements,
    canManageHelpCenter,
    canManageGradeCenter,
    canManageLearningRecords,
    canManageLibrary,
  });
  const groups = ["overview", "teaching", "service", "organization"] as const;

  const navigation = (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="管理中心导航">
      <div className="space-y-5">
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          return (
            <section key={group}>
              {!collapsed && <p className="mb-2 px-3 text-[10px] font-black tracking-[0.18em] app-muted-text">{ADMIN_GROUP_LABELS[group]}</p>}
              {collapsed && <div className="mx-3 mb-2 border-t app-divider" />}
              <div className="space-y-1">
                {groupItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-black transition ${collapsed ? "justify-center" : ""}`}
                      style={active ? { color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)", boxShadow: "inset 0 0 0 1px var(--app-accent)" } : { color: "var(--app-muted)" }}
                    >
                      <Icon size={18} className="shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
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
      <div className="app-card sticky top-[68px] z-20 flex items-center gap-3 border-b px-4 py-3 md:hidden">
        <button type="button" onClick={() => { setCollapsed(false); setMobileOpen((open) => !open); }} className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border" aria-label={mobileOpen ? "收起管理导航" : "展开管理导航"} aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><PanelsTopLeft size={19} /></span>
        <div><p className="text-sm font-black">管理中心</p><p className="app-muted-text text-[10px]">{getAdminRoleLabel(role)} · {items.length - 1} 个模块</p></div>
      </div>

      {mobileOpen && <div className="app-sidebar sticky top-[133px] z-20 max-h-[calc(100vh-145px)] overflow-y-auto border-b md:hidden">{navigation}</div>}

      <aside className={`app-sidebar relative hidden shrink-0 border-r transition-[width] duration-200 md:sticky md:top-[68px] md:flex md:h-[calc(100vh-68px)] md:self-start md:flex-col ${collapsed ? "md:w-[76px]" : "md:w-[252px]"}`}>
        <div className={`flex items-center border-b p-3 app-divider ${collapsed ? "justify-center" : "gap-3"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><PanelsTopLeft size={19} /></span>
          {!collapsed && <div className="min-w-0 flex-1"><p className="truncate text-sm font-black">管理中心</p><p className="app-muted-text truncate text-[10px]">{getAdminRoleLabel(role)}工作台</p></div>}
          {!collapsed && <button type="button" onClick={() => setCollapsed(true)} className="app-soft-card flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border" aria-label="收起管理导航"><ChevronLeft size={15} /></button>}
        </div>

        {navigation}

        <div className="border-t p-3 app-divider">
          {collapsed ? <button type="button" onClick={() => setCollapsed(false)} className="app-soft-card flex h-10 w-full items-center justify-center rounded-xl border" aria-label="展开管理导航"><ChevronRight size={16} /></button> : <button type="button" onClick={() => setCollapsed(true)} className="app-soft-card flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black"><ChevronLeft size={14} />收起导航</button>}
        </div>
      </aside>
    </>
  );
}
