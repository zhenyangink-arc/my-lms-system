"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  Library,
  Megaphone,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import {
  type MembershipTier,
  type StudentFeature,
} from "@/lib/student-permissions";
import {
  normalizeDashboardPathname,
  scopeDashboardPath,
} from "@/lib/dashboard-path";
import {
  getStudentAppDefinition,
  type StudentAppSlug,
} from "@/lib/student-apps";

type Props = {
  userRole: string;
  membershipTier: MembershipTier;
  canAccessAnnouncements: boolean;
  dashboardBasePath: string;
  studentAppSlug?: StudentAppSlug;
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  announcementOnly?: boolean;
  teacherVisible?: boolean;
  requiresStudentSectionAccess?: boolean;
  studentFeature?: StudentFeature;
};

type NavGroup = {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
};

const learningGroups: NavGroup[] = [
  {
    label: "学习成长",
    items: [
      { label: "成长首页", href: "/dashboard", icon: LayoutDashboard },
      { label: "韩语课程", href: "/dashboard/courses", icon: BookOpen, requiresStudentSectionAccess: true },
      { label: "深化学习", href: "/dashboard/progress", icon: BarChart3, requiresStudentSectionAccess: true },
      { label: "成长工具箱", href: "/dashboard/toolbox", icon: Wrench, requiresStudentSectionAccess: true },
      { label: "作业与考试", href: "/dashboard/assignments", icon: ClipboardList, requiresStudentSectionAccess: true, studentFeature: "learning_assignments" },
      { label: "会话练习", href: "/dashboard/conversation-practice", icon: MessageSquare, requiresStudentSectionAccess: true, studentFeature: "conversation_course" },
      { label: "我的成绩", href: "/dashboard/grades", icon: Award, requiresStudentSectionAccess: true },
      { label: "学习记录", href: "/dashboard/records", icon: History, requiresStudentSectionAccess: true },
      { label: "资料库", href: "/dashboard/library", icon: Library, requiresStudentSectionAccess: true },
    ],
  },
  {
    label: "消息与服务",
    items: [
      { label: "通知公告", href: "/dashboard/announcements", icon: Megaphone, announcementOnly: true },
      { label: "帮助中心", href: "/dashboard/help", icon: HelpCircle },
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

const studyAbroadGroups: NavGroup[] = [
  {
    label: "留学服务",
    items: [
      { label: "服务首页", href: "/dashboard", icon: LayoutDashboard },
      { label: "目标大学", href: "/dashboard/universities", icon: Building2, requiresStudentSectionAccess: true },
      { label: "申请材料", href: "/dashboard/documents", icon: FileText, requiresStudentSectionAccess: true },
      { label: "签证准备", href: "/dashboard/visa", icon: ShieldCheck, requiresStudentSectionAccess: true },
    ],
  },
  {
    label: "消息与服务",
    items: [
      { label: "通知公告", href: "/dashboard/announcements", icon: Megaphone, announcementOnly: true },
      { label: "帮助中心", href: "/dashboard/help", icon: HelpCircle },
    ],
  },
];

function getStudentAppGroups(studentAppSlug?: StudentAppSlug): NavGroup[] {
  if (studentAppSlug === "study-abroad") return studyAbroadGroups;
  if (
    studentAppSlug === "english" ||
    studentAppSlug === "math" ||
    studentAppSlug === "university"
  ) {
    return [
      {
        label: "应用导航",
        items: [
          { label: "应用首页", href: "/dashboard", icon: LayoutDashboard },
        ],
      },
    ];
  }

  return learningGroups;
}

const adminRoles = new Set([
  "admin",
  "ceo",
  "platform_super_admin",
  "tenant_super_admin",
  "tenant_operator",
]);

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentSystemSidebar({
  userRole,
  membershipTier,
  canAccessAnnouncements,
  dashboardBasePath,
  studentAppSlug,
}: Props) {
  const pathname = normalizeDashboardPathname(usePathname());
  const isAdmin = adminRoles.has(userRole);
  const isTeacher = userRole === "teacher";
  const isAudit = userRole === "platform_super_admin" || userRole === "platform_course_inspector";

  const personalize = (item: NavItem): NavItem => {
    if (isAudit && item.href === "/dashboard/courses") {
      return { ...item, label: "课程前台巡检" };
    }

    if (
      userRole === "student" &&
      membershipTier === "vip2" &&
      item.href === "/dashboard/conversation-practice"
    ) {
      return {
        ...item,
        label: "AI交流体验",
        href: "/dashboard/conversation-practice/ai-experience",
        studentFeature: "ai_conversation_experience",
      };
    }

    return item;
  };

  const groups = getStudentAppGroups(studentAppSlug);
  const visibleGroups = groups
    .filter((group) => !group.adminOnly || isAdmin || (isTeacher && group.items.some((item) => item.teacherVisible)))
    .map((group) => ({
      ...group,
      items: group.items
        .filter(
          (item) =>
            (!group.adminOnly || !isTeacher || isAdmin || item.teacherVisible) &&
            (!item.announcementOnly || canAccessAnnouncements || userRole === "student")
        )
        .map(personalize),
    }));

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const selected = isActive(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={scopeDashboardPath(item.href, dashboardBasePath)}
        aria-current={selected ? "page" : undefined}
        data-student-operation={item.requiresStudentSectionAccess ? "true" : undefined}
        data-permission={item.requiresStudentSectionAccess ? (item.studentFeature ?? "dashboard_section") : undefined}
        className="student-system-nav-link"
      >
        <Icon size={17} className="shrink-0" aria-hidden={true} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside className="student-system-sidebar hidden shrink-0 flex-col md:flex" aria-label="学生端主导航">
        <Link
          href={dashboardBasePath}
          className="student-system-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          aria-label={studentAppSlug ? `返回${getStudentAppDefinition(studentAppSlug).title}首页` : "返回成长首页"}
        >
          <span className="student-system-brand-mark">
            <GraduationCap size={19} aria-hidden={true} />
          </span>
          <span>
            <strong>{studentAppSlug ? getStudentAppDefinition(studentAppSlug).title : "元智学习"}</strong>
            <small>{studentAppSlug ? "STUDENT APP" : "STUDENT OS"}</small>
          </span>
        </Link>

        <nav className="student-system-nav flex-1 overflow-y-auto px-3 pb-5" aria-label="学习功能">
          {visibleGroups.map((group) => (
            <section key={group.label} className="student-system-nav-group" aria-labelledby={`nav-${group.label}`}>
              <h2 id={`nav-${group.label}`}>{group.label}</h2>
              <div>{group.items.map((item) => renderLink(item))}</div>
            </section>
          ))}
        </nav>

        <div className="student-system-sidebar-foot">
          <span className="student-system-sidebar-status" aria-hidden="true" />
          学习服务正常
        </div>
      </aside>
    </>
  );
}
