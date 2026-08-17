"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
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
  Menu,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  Target,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  getStudentPortalPathFromWorkspace,
  type StudentAppSlug,
} from "@/lib/student-apps";
import {
  DEFAULT_PRACTICE_SECTION,
  getPracticeDashboardPath,
  getPracticeMemoryKey,
  getPracticeSectionFromDashboardPath,
  isPracticeSection,
} from "@/lib/practice-navigation-memory";
import { LogoutButton } from "./LogoutButton";

type Props = {
  studentId?: string;
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
    label: "学习",
    items: [
      { label: "成长首页", href: "/dashboard", icon: LayoutDashboard },
      { label: "韩语课程", href: "/dashboard/courses", icon: BookOpen, requiresStudentSectionAccess: true },
      { label: "巩固中心", href: "/dashboard/practice", icon: Target, requiresStudentSectionAccess: true },
      { label: "学习任务", href: "/dashboard/assignments", icon: ClipboardList, requiresStudentSectionAccess: true, studentFeature: "learning_assignments" },
      { label: "会话练习", href: "/dashboard/conversation-practice", icon: MessageSquare, requiresStudentSectionAccess: true, studentFeature: "conversation_course" },
    ],
  },
  {
    label: "成长记录",
    items: [
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
];

const studyAbroadGroups: NavGroup[] = [
  {
    label: "留学服务",
    items: [
      { label: "服务首页", href: "/dashboard", icon: LayoutDashboard },
      { label: "留学课程", href: "/dashboard/courses", icon: BookOpen, requiresStudentSectionAccess: true },
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

const PRACTICE_MEMORY_EVENT = "student-practice-memory-change";

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentSystemSidebar({
  studentId,
  userRole,
  membershipTier,
  canAccessAnnouncements,
  dashboardBasePath,
  studentAppSlug,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = normalizeDashboardPathname(usePathname());
  const currentPracticeSection = getPracticeSectionFromDashboardPath(pathname);
  const studentPortalHref = getStudentPortalPathFromWorkspace(dashboardBasePath);
  const isAdmin = adminRoles.has(userRole);
  const isTeacher = userRole === "teacher";
  const isAudit = userRole === "platform_super_admin" || userRole === "platform_course_inspector";
  const practiceMemoryKey =
    studentId && studentAppSlug === "korean"
      ? getPracticeMemoryKey(studentId, dashboardBasePath)
      : null;

  const subscribeToPracticeMemory = useCallback(
    (onStoreChange: () => void) => {
      if (!practiceMemoryKey) return () => {};

      const handleStorage = (event: StorageEvent) => {
        if (!event.key || event.key === practiceMemoryKey) onStoreChange();
      };
      window.addEventListener("storage", handleStorage);
      window.addEventListener(PRACTICE_MEMORY_EVENT, onStoreChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(PRACTICE_MEMORY_EVENT, onStoreChange);
      };
    },
    [practiceMemoryKey],
  );

  const getPracticeMemorySnapshot = useCallback(() => {
    if (!practiceMemoryKey) return DEFAULT_PRACTICE_SECTION;

    try {
      const remembered = window.localStorage.getItem(practiceMemoryKey);
      return isPracticeSection(remembered)
        ? remembered
        : DEFAULT_PRACTICE_SECTION;
    } catch {
      return DEFAULT_PRACTICE_SECTION;
    }
  }, [practiceMemoryKey]);

  const rememberedPracticeSection = useSyncExternalStore(
    subscribeToPracticeMemory,
    getPracticeMemorySnapshot,
    () => DEFAULT_PRACTICE_SECTION,
  );

  useEffect(() => {
    if (!practiceMemoryKey || !currentPracticeSection) return;

    try {
      if (
        window.localStorage.getItem(practiceMemoryKey) !==
        currentPracticeSection
      ) {
        window.localStorage.setItem(
          practiceMemoryKey,
          currentPracticeSection,
        );
        window.dispatchEvent(new Event(PRACTICE_MEMORY_EVENT));
      }
    } catch {
      // 本地存储不可用时保持课程巩固作为稳定默认入口。
    }
  }, [currentPracticeSection, practiceMemoryKey]);

  const practiceEntryHref = getPracticeDashboardPath(
    currentPracticeSection ?? rememberedPracticeSection,
  );

  const resolveItemHref = (item: NavItem) =>
    item.href === "/dashboard/practice" ? practiceEntryHref : item.href;

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
  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const mobilePriorityHrefs =
    studentAppSlug === "study-abroad"
      ? ["/dashboard", "/dashboard/courses", "/dashboard/universities"]
      : studentAppSlug === "korean" || !studentAppSlug
        ? ["/dashboard", "/dashboard/courses", "/dashboard/practice"]
        : ["/dashboard"];
  const mobilePrimaryItems = mobilePriorityHrefs
    .map((href) => visibleItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
  const mobileMoreItems = visibleItems.filter(
    (item) => !mobilePrimaryItems.some((primaryItem) => primaryItem.href === item.href),
  );
  const mobileMoreHasCurrent = mobileMoreItems.some((item) =>
    isActive(pathname, item.href),
  );

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const selected = isActive(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={scopeDashboardPath(resolveItemHref(item), dashboardBasePath)}
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
          className="student-system-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          aria-label={studentAppSlug ? `返回${getStudentAppDefinition(studentAppSlug).title}首页` : "返回成长首页"}
        >
          <span className="student-system-brand-mark">
            <GraduationCap size={19} aria-hidden={true} />
          </span>
          <span>
            <strong>{studentAppSlug ? getStudentAppDefinition(studentAppSlug).title : "元智学习"}</strong>
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

      <nav className="student-mobile-navigation md:hidden" aria-label="学生端快捷导航">
        <Link
          href={studentPortalHref}
          className="student-mobile-navigation-item"
          aria-label="返回应用中心"
        >
          <PanelsTopLeft size={20} aria-hidden={true} />
          <span>应用</span>
        </Link>

        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const selected = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={scopeDashboardPath(resolveItemHref(item), dashboardBasePath)}
              aria-current={selected ? "page" : undefined}
              data-student-operation={item.requiresStudentSectionAccess ? "true" : undefined}
              data-permission={item.requiresStudentSectionAccess ? (item.studentFeature ?? "dashboard_section") : undefined}
              className="student-mobile-navigation-item"
            >
              <Icon size={20} aria-hidden={true} />
              <span>{item.label.replace("韩语", "")}</span>
            </Link>
          );
        })}

        {mobileMoreItems.length > 0 && (
          <button
            type="button"
            className="student-mobile-navigation-item"
            onClick={() => setMobileOpen(true)}
            aria-label="打开全部学习功能"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            aria-controls="student-mobile-navigation-sheet"
            data-active={mobileMoreHasCurrent ? "true" : undefined}
          >
            <Menu size={20} aria-hidden={true} />
            <span>更多</span>
          </button>
        )}
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          id="student-mobile-navigation-sheet"
          side="bottom"
          className="student-mobile-navigation-sheet max-h-[min(78dvh,680px)] overflow-hidden rounded-t-[24px] border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] md:hidden"
        >
          <SheetHeader className="border-b border-[var(--border)] px-5 pb-4 pt-5 text-left">
            <SheetTitle className="text-lg font-bold text-[var(--foreground)]">
              全部功能
            </SheetTitle>
            <SheetDescription className="text-sm text-[var(--foreground-muted)]">
              选择要进入的学习与服务页面
            </SheetDescription>
          </SheetHeader>

          <nav className="min-h-0 overflow-y-auto px-4 pb-[calc(16px+env(safe-area-inset-bottom))]" aria-label="全部学生功能">
            {visibleGroups.map((group) => (
              <section key={group.label} className="py-3" aria-labelledby={`mobile-nav-${group.label}`}>
                <h2 id={`mobile-nav-${group.label}`} className="px-2 pb-2 text-xs font-semibold tracking-wide text-[var(--foreground-muted)]">
                  {group.label}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const selected = isActive(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={scopeDashboardPath(resolveItemHref(item), dashboardBasePath)}
                        onClick={() => setMobileOpen(false)}
                        aria-current={selected ? "page" : undefined}
                        data-student-operation={item.requiresStudentSectionAccess ? "true" : undefined}
                        data-permission={item.requiresStudentSectionAccess ? (item.studentFeature ?? "dashboard_section") : undefined}
                        className="student-mobile-navigation-sheet-item"
                      >
                        <Icon size={20} aria-hidden={true} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}

            <div className="border-t border-[var(--border)] pt-3">
              <LogoutButton appearance="sheet" />
            </div>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
