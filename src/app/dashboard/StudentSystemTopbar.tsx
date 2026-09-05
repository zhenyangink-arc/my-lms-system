"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, Eye, Search, Settings } from "lucide-react";

import { LazyGuideAgentChat } from "@/components/guide-agent/LazyGuideAgentChat";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getStudentAppDefinition,
  getStudentPortalPathFromWorkspace,
  type StudentAppSlug,
} from "@/lib/student-apps";
import {
  normalizeDashboardPathname,
  scopeDashboardPath,
} from "@/lib/dashboard-path";
import { LogoutButton } from "./LogoutButton";
import { ReminderDialog, type TeacherReplyReminder } from "./ReminderDialog";

const BACKGROUND_THEME_STORAGE_KEY = "student-system-background-theme";
const REDUCED_TRANSPARENCY_STORAGE_KEY =
  "student-system-reduced-transparency";
const LEGACY_TRANSPARENCY_STORAGE_KEYS = [
  "student-system-glass-transparency",
  "student-system-window-transparency",
  "student-system-card-transparency",
  "student-system-card-level-1-transparency",
  "student-system-card-level-2-transparency",
  "student-system-card-level-3-transparency",
  "student-system-button-transparency",
  "student-system-menu-transparency",
] as const;

const BACKGROUND_THEME_OPTIONS = ["auto", "morning", "afternoon", "night"] as const;
type BackgroundTheme = (typeof BACKGROUND_THEME_OPTIONS)[number];
type ResolvedBackgroundTheme = Exclude<BackgroundTheme, "auto">;

const TOPBAR_INDEX_LABELS = [
  ["/dashboard/announcements", "通知公告"],
  ["/dashboard/assignments", "学习任务"],
  ["/dashboard/conversation-practice", "会话练习"],
  ["/dashboard/courses", "韩语课程"],
  ["/dashboard/grades", "我的成绩"],
  ["/dashboard/help", "帮助中心"],
  ["/dashboard/library", "资料库"],
  ["/dashboard/practice", "巩固中心"],
  ["/dashboard/progress", "学习进度"],
  ["/dashboard/records", "学习记录"],
  ["/dashboard/documents", "申请材料"],
  ["/dashboard/universities", "目标大学"],
  ["/dashboard/visa", "签证准备"],
] as const;

function getTopbarIndexLabel(pathname: string, studentAppSlug?: StudentAppSlug) {
  const matchedLabel = TOPBAR_INDEX_LABELS.find(([prefix]) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  )?.[1];

  if (matchedLabel) return matchedLabel;
  return studentAppSlug
    ? getStudentAppDefinition(studentAppSlug).title
    : "学习空间";
}

function findStudentShell() {
  return document.querySelector<HTMLElement>(
    '.app-shell[data-student-shell="system"]',
  );
}

function getAutomaticBackgroundTheme(): ResolvedBackgroundTheme {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "night";
}

function applyBackgroundTheme(theme: BackgroundTheme) {
  const shell = findStudentShell();
  if (!shell) return;

  const resolvedTheme =
    theme === "auto" ? getAutomaticBackgroundTheme() : theme;
  shell.dataset.studentBackground = resolvedTheme;
  document.documentElement.dataset.studentBackground = resolvedTheme;
}

function applyTransparencyPreference(reduced: boolean) {
  const shell = findStudentShell();
  const root = document.documentElement;

  if (reduced) {
    root.dataset.studentTransparency = "reduced";
    if (shell) shell.dataset.studentTransparency = "reduced";
  } else {
    delete root.dataset.studentTransparency;
    if (shell) delete shell.dataset.studentTransparency;
  }

  // Clear inline variables written by the retired multi-slider control.
  [
    "--student-button-fill-opacity",
    "--student-button-hover-fill-opacity",
    "--student-menu-fill-opacity",
  ].forEach((property) => root.style.removeProperty(property));
  if (shell) {
    [
      "--student-window-glass-opacity",
      "--student-card-level-1-opacity",
      "--student-card-level-1-hover-opacity",
      "--student-card-level-2-opacity",
      "--student-card-level-2-hover-opacity",
      "--student-card-level-3-opacity",
      "--student-card-level-3-hover-opacity",
    ].forEach((property) => shell.style.removeProperty(property));
  }
}

type Props = {
  tenantName: string;
  userName: string;
  accountLabel: string;
  dateLabel: string;
  unreadCount: number;
  teacherReminders: TeacherReplyReminder[];
  dashboardBasePath: string;
  studentId: string;
  studentAppSlug?: StudentAppSlug;
};

export function StudentSystemTopbar({
  userName,
  accountLabel,
  unreadCount,
  teacherReminders,
  dashboardBasePath,
  studentId,
  studentAppSlug,
}: Props) {
  const siteHomeHref = getStudentPortalPathFromWorkspace(dashboardBasePath);
  const router = useRouter();
  const pathname = normalizeDashboardPathname(usePathname());
  const indexLabel = getTopbarIndexLabel(pathname, studentAppSlug);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [backgroundTheme, setBackgroundTheme] =
    useState<BackgroundTheme>("auto");
  const [reducedTransparency, setReducedTransparency] = useState(false);
  const firstThemeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    const nextTheme = BACKGROUND_THEME_OPTIONS.includes(savedTheme as BackgroundTheme)
      ? (savedTheme as BackgroundTheme)
      : "auto";
    const nextReducedTransparency =
      window.localStorage.getItem(REDUCED_TRANSPARENCY_STORAGE_KEY) === "true";

    applyBackgroundTheme(nextTheme);
    applyTransparencyPreference(nextReducedTransparency);
    LEGACY_TRANSPARENCY_STORAGE_KEYS.forEach((key) =>
      window.localStorage.removeItem(key),
    );

    const animationFrame = window.requestAnimationFrame(() => {
      setBackgroundTheme(nextTheme);
      setReducedTransparency(nextReducedTransparency);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    applyBackgroundTheme(backgroundTheme);
    if (backgroundTheme !== "auto") return;

    const interval = window.setInterval(() => {
      applyBackgroundTheme("auto");
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [backgroundTheme]);

  const updateBackgroundTheme = (theme: BackgroundTheme) => {
    setBackgroundTheme(theme);
    applyBackgroundTheme(theme);
    window.localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, theme);
  };

  const toggleReducedTransparency = () => {
    const nextValue = !reducedTransparency;
    setReducedTransparency(nextValue);
    applyTransparencyPreference(nextValue);
    window.localStorage.setItem(
      REDUCED_TRANSPARENCY_STORAGE_KEY,
      String(nextValue),
    );
  };

  const submitCourseSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "").trim();
    const coursesHref = scopeDashboardPath(
      "/dashboard/courses",
      dashboardBasePath,
    );
    router.push(query ? `${coursesHref}?q=${encodeURIComponent(query)}` : coursesHref);
  };

  return (
    <>
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        reminders={teacherReminders}
      />

      <header className="student-system-topbar">
        <nav className="student-system-breadcrumb" aria-label="当前位置">
          <Link href={siteHomeHref}>首页</Link>
          <ChevronRight size={12} aria-hidden={true} />
          <span aria-current="page">{indexLabel}</span>
        </nav>

        {studentAppSlug === "korean" && (
          <form
            className="student-system-header-search"
            role="search"
            onSubmit={submitCourseSearch}
          >
            <Search size={14} aria-hidden="true" />
            <label className="sr-only" htmlFor="student-course-search">
              搜索韩语课程
            </label>
            <input
              id="student-course-search"
              name="q"
              type="search"
              placeholder="搜索课程名称或简介"
              autoComplete="off"
            />
          </form>
        )}

        <nav className="student-system-toolbar" aria-label="学生工具栏">
          <LazyGuideAgentChat
            studentId={studentId}
            dashboardBasePath={dashboardBasePath}
          />

          <button
            type="button"
            onClick={() => setReminderOpen(true)}
            className="student-system-tool-button relative"
            title="通知提醒"
            aria-label={unreadCount > 0 ? `${unreadCount} 条未读提醒` : "通知提醒"}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="student-system-notice-count" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <Popover open={appearanceOpen} onOpenChange={setAppearanceOpen}>
            <PopoverTrigger
              className="student-system-tool-button"
              title="外观设置"
              aria-label="打开外观设置"
            >
              <Settings size={18} aria-hidden="true" />
            </PopoverTrigger>

            <PopoverContent
              id="student-system-glass-popover"
              className="student-system-glass-popover"
              positionerClassName="student-system-floating-layer"
              align="end"
              side="bottom"
              sideOffset={12}
              initialFocus={firstThemeButtonRef}
            >
              <div className="student-system-glass-popover-header">
                <div>
                  <PopoverTitle className="student-system-glass-popover-title">
                    外观设置
                  </PopoverTitle>
                  <PopoverDescription className="student-system-glass-popover-description">
                    背景只改变环境氛围，操作色和状态含义保持一致。
                  </PopoverDescription>
                </div>
              </div>

              <div className="student-system-background-setting">
                <span className="student-system-background-label">环境背景</span>
                <div className="student-system-background-options" aria-label="环境背景模式">
                  {BACKGROUND_THEME_OPTIONS.map((theme, index) => (
                    <button
                      ref={index === 0 ? firstThemeButtonRef : undefined}
                      key={theme}
                      type="button"
                      className="student-system-background-option"
                      data-background-theme={theme}
                      aria-pressed={backgroundTheme === theme}
                      onClick={() => updateBackgroundTheme(theme)}
                    >
                      <span aria-hidden="true" />
                      {theme === "auto"
                        ? "自动"
                        : theme === "morning"
                          ? "上午"
                          : theme === "afternoon"
                            ? "下午"
                            : "晚上"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="student-system-appearance-setting">
                <button
                  type="button"
                  className="student-system-transparency-toggle"
                  role="switch"
                  aria-checked={reducedTransparency}
                  onClick={toggleReducedTransparency}
                >
                  <span className="student-system-transparency-icon" aria-hidden="true">
                    <Eye size={16} />
                  </span>
                  <span>
                    <strong>增强表面清晰度</strong>
                    <small>关闭窗口和工具栏的透明材质；学习内容始终使用实底。</small>
                  </span>
                  <span className="student-system-switch-indicator" aria-hidden="true" />
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="student-system-account hidden lg:flex">
            <span>
              <strong>{userName}</strong>
              <small>{accountLabel}</small>
            </span>
          </div>

          <div className="student-system-logout" title="退出登录">
            <LogoutButton collapsed />
          </div>
        </nav>
      </header>
    </>
  );
}
