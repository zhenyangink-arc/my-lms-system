"use client";

import type { ComponentType, FocusEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  Cog,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import { LogoutButton } from "./LogoutButton";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { MEMBERSHIP_TIER_LABELS, type MembershipTier } from "@/lib/student-permissions";

type DashboardSidebarProps = {
  userName: string;
  userRole: string;
  membershipTier: MembershipTier;
  canAccessAnnouncements: boolean;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  executiveOnly?: boolean;
  announcementOnly?: boolean;
  teacherVisible?: boolean;
};

type SidebarGroup = {
  label: string;
  items: SidebarItem[];
  adminOnly?: boolean;
};

const navigationGroups: SidebarGroup[] = [
  {
    label: "学习成长",
    items: [
      { label: "成长总览", href: "/dashboard", icon: LayoutDashboard },
      { label: "我的课程", href: "/dashboard/courses", icon: BookOpen },
      { label: "学习进度", href: "/dashboard/progress", icon: BarChart3 },
      { label: "作业与考试", href: "/dashboard/assignments", icon: ClipboardList },
      { label: "会话练习", href: "/dashboard/conversation-practice", icon: MessageSquare },
      { label: "成绩管理", href: "/dashboard/grades", icon: Award },
      { label: "学习记录", href: "/dashboard/records", icon: History },
      { label: "资料库", href: "/dashboard/library", icon: Library },
    ],
  },
  {
    label: "留学准备",
    items: [
      { label: "目标大学", href: "/dashboard/universities", icon: Building2 },
      { label: "申请材料", href: "/dashboard/documents", icon: FileText },
      { label: "签证准备", href: "/dashboard/visa", icon: ShieldCheck },
    ],
  },
  {
    label: "消息与服务",
    items: [
      { label: "通知公告", href: "/dashboard/announcements", icon: Megaphone, announcementOnly: true },
      { label: "帮助中心", href: "/dashboard/help", icon: HelpCircle },
      { label: "个人资料", href: "/dashboard/profile", icon: UserCircle },
      { label: "设置", href: "/dashboard/settings", icon: Cog },
    ],
  },
  {
    label: "后台管理",
    adminOnly: true,
    items: [
      { label: "管理中心", href: "/dashboard/admin", icon: PanelsTopLeft, teacherVisible: true },
    ],
  },
];

const mobileItems: SidebarItem[] = [
  { label: "总览", href: "/dashboard", icon: LayoutDashboard },
  { label: "课程", href: "/dashboard/courses", icon: BookOpen },
  { label: "进度", href: "/dashboard/progress", icon: BarChart3 },
  { label: "大学", href: "/dashboard/universities", icon: Building2 },
  { label: "我的", href: "/dashboard/profile", icon: UserCircle },
];

const staffMobileItems: SidebarItem[] = [
  { label: "总览", href: "/dashboard", icon: LayoutDashboard },
  { label: "课程", href: "/dashboard/courses", icon: BookOpen },
  { label: "作业", href: "/dashboard/assignments", icon: ClipboardList },
  { label: "管理", href: "/dashboard/admin", icon: PanelsTopLeft },
  { label: "我的", href: "/dashboard/profile", icon: UserCircle },
];

function isAdminRole(role: string) {
  return role === "admin" || role === "ceo" || role === "super_admin";
}

function isExecutiveRole(role: string) {
  return role === "ceo" || role === "super_admin";
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleLabel(role: string) {
  if (role === "super_admin") return "负责人";
  if (role === "ceo") return "运营负责人";
  if (role === "admin") return "管理员";
  if (role === "teacher") return "教师";
  return "学生";
}

export function DashboardSidebar({
  userName,
  userRole,
  membershipTier,
  canAccessAnnouncements,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const collapsed = !hovered;

  const isAdmin = isAdminRole(userRole);
  const isExecutive = isExecutiveRole(userRole);
  const isTeacher = userRole === "teacher";
  const visibleMobileItems = isAdmin || isTeacher ? staffMobileItems : mobileItems;

  const visibleGroups = navigationGroups
    .filter(
      (group) =>
        !group.adminOnly ||
        isAdmin ||
        (isTeacher && group.items.some((item) => item.teacherVisible))
    )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!group.adminOnly || !isTeacher || isAdmin || item.teacherVisible) &&
          (!item.executiveOnly || isExecutive) &&
          (!item.announcementOnly || canAccessAnnouncements)
      ),
    }));

  function handleSidebarBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setHovered(false);
    }
  }

  return (
    <>
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={handleSidebarBlur}
        className={`app-sidebar relative hidden shrink-0 border-r transition-[width] duration-200 md:sticky md:top-[68px] md:flex md:h-[calc(100vh-68px)] md:self-start md:flex-col ${
          collapsed ? "md:w-[84px]" : "md:w-[264px]"
        }`}
      >
        {/* 桌面端导航随鼠标移入展开、移出收起，不再依赖手动收缩按钮。 */}
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="控制台导航">
          <div className="space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.label}>
                {!collapsed ? (
                  <p className="mb-2 px-3 text-[11px] font-bold tracking-[0.18em] app-muted-text">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-3 mb-2 border-t app-divider" />
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                          collapsed ? "justify-center" : ""
                        }`}
                        style={
                          active
                            ? {
                                color: "var(--app-accent-strong)",
                                backgroundColor: "var(--app-accent-soft)",
                                boxShadow: "inset 0 0 0 1px var(--app-accent)",
                              }
                            : { color: "var(--app-muted)" }
                        }
                      >
                        <Icon
                          size={18}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t px-3 py-2 app-divider">
          {!collapsed && (
            <div className="mb-1">
              <ThemeSwitcher />
            </div>
          )}
          <div className={`flex gap-1.5 ${collapsed ? "flex-col items-center" : "items-center"}`}>
            <Link
              href="/dashboard/profile"
              title={collapsed ? `${userName}（${getRoleLabel(userRole)}）` : undefined}
              className={`app-soft-card flex min-w-0 items-center rounded-xl border p-1.5 transition hover:-translate-y-0.5 ${collapsed ? "justify-center" : "flex-1 gap-2"}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>
                {userName.trim().slice(0, 1) || "学"}
              </span>
              {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{userName}</span><span className="block text-[9px] font-bold app-muted-text">{userRole === "student" ? MEMBERSHIP_TIER_LABELS[membershipTier] : getRoleLabel(userRole)}</span></span>}
            </Link>
            <LogoutButton collapsed />
          </div>
        </div>
      </aside>

      {/* 移动端保留五个最高频入口，避免小屏设备完全失去导航。 */}
      <nav
        className="app-topbar fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border p-1.5 shadow-lg md:hidden"
        aria-label="移动端控制台导航"
      >
        {visibleMobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold"
              style={
                active
                  ? {
                      color: "var(--app-accent-strong)",
                      backgroundColor: "var(--app-accent-soft)",
                    }
                  : { color: "var(--app-muted)" }
              }
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
