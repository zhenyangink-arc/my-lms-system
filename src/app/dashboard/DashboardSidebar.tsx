"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpen, Building2, ClipboardList, Cog, FileText, HelpCircle, History, LayoutDashboard, Library, Megaphone, MessageSquare, PanelsTopLeft, ShieldCheck, UserCircle } from "lucide-react";
import { type MembershipTier, type StudentFeature } from "@/lib/student-permissions";
import { normalizeDashboardPathname, scopeDashboardPath } from "@/lib/dashboard-path";

type Props = { userName: string; userRole: string; membershipTier: MembershipTier; canAccessAnnouncements: boolean; dashboardBasePath: string };
type Item = { label: string; href: string; icon: ComponentType<{ size?: number; className?: string }>; announcementOnly?: boolean; teacherVisible?: boolean; requiresStudentSectionAccess?: boolean; studentFeature?: StudentFeature };
type Group = { label: string; items: Item[]; adminOnly?: boolean };
const groups: Group[] = [
  { label: "学习成长", items: [
    { label: "成长首页", href: "/dashboard", icon: LayoutDashboard },
    { label: "我的课程", href: "/dashboard/courses", icon: BookOpen, requiresStudentSectionAccess: true },
    { label: "深化学习", href: "/dashboard/progress", icon: BarChart3, requiresStudentSectionAccess: true },
    { label: "作业与考试", href: "/dashboard/assignments", icon: ClipboardList, requiresStudentSectionAccess: true, studentFeature: "learning_assignments" },
    { label: "会话练习", href: "/dashboard/conversation-practice", icon: MessageSquare, requiresStudentSectionAccess: true, studentFeature: "conversation_course" },
    { label: "我的成绩", href: "/dashboard/grades", icon: Award, requiresStudentSectionAccess: true },
    { label: "学习记录", href: "/dashboard/records", icon: History, requiresStudentSectionAccess: true },
    { label: "资料库", href: "/dashboard/library", icon: Library, requiresStudentSectionAccess: true },
  ]},
  { label: "留学准备", items: [
    { label: "目标大学", href: "/dashboard/universities", icon: Building2, requiresStudentSectionAccess: true },
    { label: "申请材料", href: "/dashboard/documents", icon: FileText, requiresStudentSectionAccess: true },
    { label: "签证准备", href: "/dashboard/visa", icon: ShieldCheck, requiresStudentSectionAccess: true },
  ]},
  { label: "消息与服务", items: [
    { label: "通知公告", href: "/dashboard/announcements", icon: Megaphone, announcementOnly: true },
    { label: "帮助中心", href: "/dashboard/help", icon: HelpCircle },
    { label: "个人资料", href: "/dashboard/profile", icon: UserCircle },
    { label: "设置", href: "/dashboard/settings", icon: Cog },
  ]},
  { label: "后台管理", adminOnly: true, items: [{ label: "管理中心", href: "/dashboard/admin", icon: PanelsTopLeft, teacherVisible: true }] },
];
const studentMobile: Item[] = [{ label: "总览", href: "/dashboard", icon: LayoutDashboard }, { label: "课程", href: "/dashboard/courses", icon: BookOpen, requiresStudentSectionAccess: true }, { label: "深化", href: "/dashboard/progress", icon: BarChart3, requiresStudentSectionAccess: true }, { label: "大学", href: "/dashboard/universities", icon: Building2, requiresStudentSectionAccess: true }];
const staffMobile: Item[] = [{ label: "总览", href: "/dashboard", icon: LayoutDashboard }, { label: "课程", href: "/dashboard/courses", icon: BookOpen }, { label: "作业", href: "/dashboard/assignments", icon: ClipboardList }, { label: "管理", href: "/dashboard/admin", icon: PanelsTopLeft }, { label: "我的", href: "/dashboard/profile", icon: UserCircle }];
const adminRole = (role: string) => ["admin", "ceo", "platform_super_admin", "tenant_super_admin", "tenant_operator"].includes(role);
const active = (path: string, href: string) => href === "/dashboard" ? path === href : path === href || path.startsWith(`${href}/`);

function PermissionLink({ item, mobile = false, pathname, dashboardBasePath }: { item: Item; mobile?: boolean; pathname: string; dashboardBasePath: string }) {
  const Icon = item.icon;
  const selected = active(pathname, item.href);
  return (
    <Link
      href={scopeDashboardPath(item.href, dashboardBasePath)}
      data-student-operation={item.requiresStudentSectionAccess ? "true" : undefined}
      data-permission={item.requiresStudentSectionAccess ? (item.studentFeature ?? "dashboard_section") : undefined}
      className={mobile
        ? "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs font-bold"
        : "flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition"}
      style={selected
        ? { color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)", boxShadow: "inset 0 0 0 1px var(--app-accent)" }
        : { color: "var(--app-muted)" }}
    >
      <Icon size={mobile ? 17 : 15} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function DashboardSidebar({ userRole, membershipTier, canAccessAnnouncements, dashboardBasePath }: Props) {
  const pathname = normalizeDashboardPathname(usePathname());
  const isAdmin = adminRole(userRole);
  const isTeacher = userRole === "teacher";
  const isPlatformAudit = userRole === "platform_super_admin" || userRole === "platform_course_inspector";

  const personalizeItem = (item: Item): Item => {
    if (isPlatformAudit && item.href === "/dashboard/courses") return { ...item, label: "课程前台巡检" };
    if (userRole === "student" && membershipTier === "vip2" && item.href === "/dashboard/conversation-practice") return { ...item, label: "AI交流体验", href: "/dashboard/conversation-practice/ai-experience", studentFeature: "ai_conversation_experience" };
    return item;
  };
  const visible = groups
    .filter(g => !g.adminOnly || isAdmin || (isTeacher && g.items.some(i => i.teacherVisible)))
    .map(g => ({
      ...g,
      items: g.items
        .filter(i =>
          (!g.adminOnly || !isTeacher || isAdmin || i.teacherVisible)
          && (!i.announcementOnly || canAccessAnnouncements || userRole === "student")
          && (userRole !== "student" || (i.href !== "/dashboard/profile" && i.href !== "/dashboard/settings"))
        )
        .map(personalizeItem),
    }));
  const mobile = (isAdmin || isTeacher ? staffMobile : studentMobile).map(personalizeItem);

  return (
    <>
      {/* 桌面端：固定窄图标栏，hover 展开文字 */}
      <aside
        className="app-student-sidebar group fixed left-0 top-0 z-40 hidden h-dvh flex-col md:flex"
        aria-label="主导航"
      >
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {visible.map(g => (
            <div key={g.label} className="mb-3">
              <p className="app-student-sidebar-group-label mx-auto mb-1 truncate px-1 text-center text-[9px] font-bold tracking-[0.18em] app-muted-text">
                {g.label}
              </p>
              <div className="space-y-0.5 px-1.5">
                {g.items.map(i => {
                  const Icon = i.icon;
                  const selected = active(pathname, i.href);
                  return (
                    <Link
                      key={i.href}
                      href={scopeDashboardPath(i.href, dashboardBasePath)}
                      title={i.label}
                      data-student-operation={i.requiresStudentSectionAccess ? "true" : undefined}
                      data-permission={i.requiresStudentSectionAccess ? (i.studentFeature ?? "dashboard_section") : undefined}
                      className="app-student-sidebar-link flex items-center gap-2.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition"
                      style={selected
                        ? { color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)", boxShadow: "inset 0 0 0 1px var(--app-accent)" }
                        : { color: "var(--app-muted)" }}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="app-student-sidebar-link-label truncate">{i.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <nav
        className="app-student-mobile-nav app-topbar fixed inset-x-3 bottom-3 z-40 grid rounded-2xl border p-1.5 shadow-lg md:hidden"
        style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0, 1fr))` }}
      >
        {mobile.map(i => <PermissionLink key={i.href} item={i} mobile pathname={pathname} dashboardBasePath={dashboardBasePath} />)}
      </nav>
    </>
  );
}
