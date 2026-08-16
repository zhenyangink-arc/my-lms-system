"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Home, Layers3, Settings, UserRound, X } from "lucide-react";

import { GuideAgentChat } from "@/components/guide-agent/GuideAgentChat";
import {
  getStudentPortalPathFromWorkspace,
  type StudentAppSlug,
} from "@/lib/student-apps";
import { LogoutButton } from "./LogoutButton";
import { ReminderDialog, type TeacherReplyReminder } from "./ReminderDialog";

const DEFAULT_WINDOW_TRANSPARENCY = 72;
const DEFAULT_CARD_TRANSPARENCY = { 1: 72, 2: 62, 3: 52 } as const;
const LEGACY_GLASS_TRANSPARENCY_STORAGE_KEY = "student-system-glass-transparency";
const WINDOW_TRANSPARENCY_STORAGE_KEY = "student-system-window-transparency";
const LEGACY_CARD_TRANSPARENCY_STORAGE_KEY = "student-system-card-transparency";
const CARD_TRANSPARENCY_STORAGE_KEYS = {
  1: "student-system-card-level-1-transparency",
  2: "student-system-card-level-2-transparency",
  3: "student-system-card-level-3-transparency",
} as const;
const CARD_LEVELS = [1, 2, 3] as const;
type CardLevel = (typeof CARD_LEVELS)[number];
type CardTransparencyState = Record<CardLevel, number>;
const BACKGROUND_THEME_STORAGE_KEY = "student-system-background-theme";
const BUTTON_TRANSPARENCY_STORAGE_KEY = "student-system-button-transparency";
const MENU_TRANSPARENCY_STORAGE_KEY = "student-system-menu-transparency";
const DEFAULT_BUTTON_TRANSPARENCY = 30;
const DEFAULT_MENU_TRANSPARENCY = 20;
const BACKGROUND_THEME_OPTIONS = ["auto", "morning", "afternoon", "night"] as const;
type BackgroundTheme = (typeof BACKGROUND_THEME_OPTIONS)[number];
type ResolvedBackgroundTheme = Exclude<BackgroundTheme, "auto">;

function clampTransparency(value: number) {
  return Math.min(95, Math.max(30, Math.round(value)));
}

function clampSurfaceTransparency(value: number, maximum: number) {
  return Math.min(maximum, Math.max(0, Math.round(value)));
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

function applyButtonTransparency(transparency: number) {
  const normalizedValue = clampSurfaceTransparency(transparency, 80);
  const surfaceOpacity = 100 - normalizedValue;
  const root = document.documentElement;
  root.style.setProperty("--student-button-fill-opacity", `${surfaceOpacity}%`);
  root.style.setProperty(
    "--student-button-hover-fill-opacity",
    `${Math.min(surfaceOpacity + 14, 100)}%`,
  );
  root.style.removeProperty("--student-primary-button-foreground");
}

function applyMenuTransparency(transparency: number) {
  const normalizedValue = clampSurfaceTransparency(transparency, 90);
  document.documentElement.style.setProperty(
    "--student-menu-fill-opacity",
    `${100 - normalizedValue}%`,
  );
}

function applyWindowTransparency(transparency: number) {
  const shell = findStudentShell();
  if (!shell) return;

  const surfaceOpacity = 100 - clampTransparency(transparency);
  shell.style.setProperty(
    "--student-window-glass-opacity",
    `${surfaceOpacity}%`,
  );
}

function applyCardTransparency(level: CardLevel, transparency: number) {
  const shell = findStudentShell();
  if (!shell) return;

  const surfaceOpacity = 100 - clampTransparency(transparency);
  shell.style.setProperty(
    `--student-card-level-${level}-opacity`,
    `${surfaceOpacity}%`,
  );
  shell.style.setProperty(
    `--student-card-level-${level}-hover-opacity`,
    `${Math.min(surfaceOpacity + 14, 84)}%`,
  );
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
  dateLabel,
  unreadCount,
  teacherReminders,
  dashboardBasePath,
  studentId,
}: Props) {
  const siteHomeHref = getStudentPortalPathFromWorkspace(dashboardBasePath);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [cardTransparencyOpen, setCardTransparencyOpen] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("auto");
  const [buttonTransparency, setButtonTransparency] = useState(
    DEFAULT_BUTTON_TRANSPARENCY,
  );
  const [menuTransparency, setMenuTransparency] = useState(
    DEFAULT_MENU_TRANSPARENCY,
  );
  const [windowTransparency, setWindowTransparency] = useState(
    DEFAULT_WINDOW_TRANSPARENCY,
  );
  const [cardTransparencies, setCardTransparencies] = useState<CardTransparencyState>(
    DEFAULT_CARD_TRANSPARENCY,
  );
  const appearanceRef = useRef<HTMLDivElement>(null);
  const appearanceButtonRef = useRef<HTMLButtonElement>(null);
  const cardTransparencyButtonRef = useRef<HTMLButtonElement>(null);
  const cardTransparencyCloseRef = useRef<HTMLButtonElement>(null);
  const windowRangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const legacyValue = Number.parseInt(
      window.localStorage.getItem(LEGACY_GLASS_TRANSPARENCY_STORAGE_KEY) ?? "",
      10,
    );
    const fallbackValue = Number.isFinite(legacyValue)
      ? clampTransparency(legacyValue)
      : DEFAULT_WINDOW_TRANSPARENCY;
    const savedWindowValue = Number.parseInt(
      window.localStorage.getItem(WINDOW_TRANSPARENCY_STORAGE_KEY) ?? "",
      10,
    );
    const legacyCardValue = Number.parseInt(
      window.localStorage.getItem(LEGACY_CARD_TRANSPARENCY_STORAGE_KEY) ?? "",
      10,
    );
    const nextWindowValue = Number.isFinite(savedWindowValue)
      ? clampTransparency(savedWindowValue)
      : fallbackValue;
    const baseCardValue = Number.isFinite(legacyCardValue)
      ? clampTransparency(legacyCardValue)
      : fallbackValue;
    const nextCardValues = CARD_LEVELS.reduce<CardTransparencyState>(
      (values, level) => {
        const savedValue = Number.parseInt(
          window.localStorage.getItem(CARD_TRANSPARENCY_STORAGE_KEYS[level]) ?? "",
          10,
        );
        values[level] = Number.isFinite(savedValue)
          ? clampTransparency(savedValue)
          : clampTransparency(baseCardValue - (level - 1) * 10);
        return values;
      },
      { ...DEFAULT_CARD_TRANSPARENCY },
    );
    applyWindowTransparency(nextWindowValue);
    CARD_LEVELS.forEach((level) => {
      applyCardTransparency(level, nextCardValues[level]);
    });
    const animationFrame = window.requestAnimationFrame(() => {
      setWindowTransparency(nextWindowValue);
      setCardTransparencies(nextCardValues);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(BACKGROUND_THEME_STORAGE_KEY);
    const nextTheme = BACKGROUND_THEME_OPTIONS.includes(savedTheme as BackgroundTheme)
      ? (savedTheme as BackgroundTheme)
      : "auto";
    applyBackgroundTheme(nextTheme);
    const animationFrame = window.requestAnimationFrame(() => {
      setBackgroundTheme(nextTheme);
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

  useEffect(() => {
    const savedButtonValue = Number.parseInt(
      window.localStorage.getItem(BUTTON_TRANSPARENCY_STORAGE_KEY) ?? "",
      10,
    );
    const savedMenuValue = Number.parseInt(
      window.localStorage.getItem(MENU_TRANSPARENCY_STORAGE_KEY) ?? "",
      10,
    );
    const nextButtonValue = Number.isFinite(savedButtonValue)
      ? clampSurfaceTransparency(savedButtonValue, 80)
      : DEFAULT_BUTTON_TRANSPARENCY;
    const nextMenuValue = Number.isFinite(savedMenuValue)
      ? clampSurfaceTransparency(savedMenuValue, 90)
      : DEFAULT_MENU_TRANSPARENCY;
    applyButtonTransparency(nextButtonValue);
    applyMenuTransparency(nextMenuValue);
    const animationFrame = window.requestAnimationFrame(() => {
      setButtonTransparency(nextButtonValue);
      setMenuTransparency(nextMenuValue);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!appearanceOpen) return;

    windowRangeRef.current?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!appearanceRef.current?.contains(event.target as Node)) {
        setCardTransparencyOpen(false);
        setAppearanceOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (cardTransparencyOpen) {
          setCardTransparencyOpen(false);
          cardTransparencyButtonRef.current?.focus();
          return;
        }
        setAppearanceOpen(false);
        appearanceButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [appearanceOpen, cardTransparencyOpen]);

  useEffect(() => {
    if (!cardTransparencyOpen) return;
    cardTransparencyCloseRef.current?.focus();
  }, [cardTransparencyOpen]);

  const updateWindowTransparency = (nextValue: number) => {
    const normalizedValue = clampTransparency(nextValue);
    setWindowTransparency(normalizedValue);
    applyWindowTransparency(normalizedValue);
    window.localStorage.setItem(
      WINDOW_TRANSPARENCY_STORAGE_KEY,
      String(normalizedValue),
    );
  };

  const updateBackgroundTheme = (theme: BackgroundTheme) => {
    setBackgroundTheme(theme);
    applyBackgroundTheme(theme);
    window.localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, theme);
  };

  const updateButtonTransparency = (nextValue: number) => {
    const normalizedValue = clampSurfaceTransparency(nextValue, 80);
    setButtonTransparency(normalizedValue);
    applyButtonTransparency(normalizedValue);
    window.localStorage.setItem(
      BUTTON_TRANSPARENCY_STORAGE_KEY,
      String(normalizedValue),
    );
  };

  const updateMenuTransparency = (nextValue: number) => {
    const normalizedValue = clampSurfaceTransparency(nextValue, 90);
    setMenuTransparency(normalizedValue);
    applyMenuTransparency(normalizedValue);
    window.localStorage.setItem(
      MENU_TRANSPARENCY_STORAGE_KEY,
      String(normalizedValue),
    );
  };

  const updateCardTransparency = (level: CardLevel, nextValue: number) => {
    const normalizedValue = clampTransparency(nextValue);
    setCardTransparencies((currentValues) => ({
      ...currentValues,
      [level]: normalizedValue,
    }));
    applyCardTransparency(level, normalizedValue);
    window.localStorage.setItem(
      CARD_TRANSPARENCY_STORAGE_KEYS[level],
      String(normalizedValue),
    );
  };

  const resetGlassTransparency = () => {
    updateWindowTransparency(DEFAULT_WINDOW_TRANSPARENCY);
    CARD_LEVELS.forEach((level) => {
      updateCardTransparency(level, DEFAULT_CARD_TRANSPARENCY[level]);
    });
    updateButtonTransparency(DEFAULT_BUTTON_TRANSPARENCY);
    updateMenuTransparency(DEFAULT_MENU_TRANSPARENCY);
  };

  return (
    <>
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        reminders={teacherReminders}
      />

      <header className="student-system-topbar">
        <div className="student-system-greeting min-w-0">
          <span className="student-system-avatar" aria-hidden="true">
            {userName.trim().slice(0, 1).toUpperCase() || <UserRound size={16} />}
          </span>
          <div className="min-w-0">
            <p className="truncate">你好，{userName}</p>
            <p className="truncate">{dateLabel}</p>
          </div>
        </div>

        <nav className="student-system-toolbar" aria-label="学生工具栏">
          <Link
            href={siteHomeHref}
            className="student-system-tool-button"
            title="返回应用中心"
            aria-label="返回应用中心"
          >
            <Home size={18} aria-hidden="true" />
          </Link>

          <GuideAgentChat
            studentId={studentId}
            dashboardBasePath={dashboardBasePath}
            triggerVariant="portal"
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

          <div ref={appearanceRef} className="student-system-glass-control">
            <button
              ref={appearanceButtonRef}
              type="button"
              onClick={() => {
                setCardTransparencyOpen(false);
                setAppearanceOpen((open) => !open);
              }}
              className="student-system-tool-button"
              title="外观设置"
              aria-label="打开外观设置"
              aria-expanded={appearanceOpen}
              aria-controls="student-system-glass-popover"
            >
              <Settings size={18} aria-hidden="true" />
            </button>

            {appearanceOpen && (
              <section
                id="student-system-glass-popover"
                className="student-system-glass-popover"
                data-subpanel-open={cardTransparencyOpen || undefined}
                role="dialog"
                aria-label="外观设置"
              >
                <div className="student-system-glass-popover-header">
                  <div>
                    <strong>外观设置</strong>
                    <p>网页背景与玻璃层级分别保存</p>
                  </div>
                </div>

                <div className="student-system-background-setting">
                  <span className="student-system-background-label">网页背景</span>
                  <div className="student-system-background-options" aria-label="网页背景主题">
                    {BACKGROUND_THEME_OPTIONS.map((theme) => (
                      <button
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

                <div className="student-system-glass-setting">
                  <button
                    ref={cardTransparencyButtonRef}
                    type="button"
                    className="student-system-card-transparency-trigger"
                    onClick={() => setCardTransparencyOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={cardTransparencyOpen}
                    aria-controls="student-system-card-transparency-popover"
                  >
                    <span className="student-system-card-transparency-trigger-icon" aria-hidden="true">
                      <Layers3 size={16} />
                    </span>
                    <span>
                      <strong>透明度设置</strong>
                      <small>窗口、卡片、按钮与菜单</small>
                    </span>
                    <span className="student-system-card-transparency-summary" aria-hidden="true">
                      {windowTransparency}%
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>

                {cardTransparencyOpen && (
                  <section
                    id="student-system-card-transparency-popover"
                    className="student-system-card-transparency-popover"
                    role="dialog"
                    aria-label="透明度设置"
                  >
                    <div className="student-system-card-transparency-popover-header">
                      <div>
                        <strong>透明度设置</strong>
                        <p>各类界面表面分别调整并自动保存</p>
                      </div>
                      <button
                        ref={cardTransparencyCloseRef}
                        type="button"
                        className="student-system-card-transparency-close"
                        onClick={() => {
                          setCardTransparencyOpen(false);
                          cardTransparencyButtonRef.current?.focus();
                        }}
                        aria-label="关闭透明度设置"
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="student-system-glass-setting">
                      <div className="student-system-glass-setting-header">
                        <label htmlFor="student-system-window-range">学习应用窗口</label>
                        <span className="student-system-glass-value">
                          {windowTransparency}%
                        </span>
                      </div>
                      <input
                        ref={windowRangeRef}
                        id="student-system-window-range"
                        className="student-system-glass-range"
                        type="range"
                        min="30"
                        max="95"
                        step="1"
                        value={windowTransparency}
                        onChange={(event) =>
                          updateWindowTransparency(Number(event.target.value))
                        }
                      />
                      <div className="student-system-glass-scale" aria-hidden="true">
                        <span>更清晰</span>
                        <span>更通透</span>
                      </div>
                    </div>

                    {CARD_LEVELS.map((level) => (
                      <div key={level} className="student-system-glass-setting">
                        <div className="student-system-glass-setting-header">
                          <label htmlFor={`student-system-card-level-${level}-range`}>
                            {level === 1
                              ? "一级卡片（页面主卡）"
                              : level === 2
                                ? "二级卡片（主卡内）"
                                : "三级卡片（二级内）"}
                          </label>
                          <span className="student-system-glass-value">
                            {cardTransparencies[level]}%
                          </span>
                        </div>
                        <input
                          id={`student-system-card-level-${level}-range`}
                          className="student-system-glass-range"
                          type="range"
                          min="30"
                          max="95"
                          step="1"
                          value={cardTransparencies[level]}
                          onChange={(event) =>
                            updateCardTransparency(level, Number(event.target.value))
                          }
                        />
                        <div className="student-system-glass-scale" aria-hidden="true">
                          <span>更清晰</span>
                          <span>更通透</span>
                        </div>
                      </div>
                    ))}

                    <div className="student-system-glass-setting">
                      <div className="student-system-glass-setting-header">
                        <label htmlFor="student-system-button-range">按钮背景</label>
                        <span className="student-system-glass-value">
                          {buttonTransparency}%
                        </span>
                      </div>
                      <input
                        id="student-system-button-range"
                        className="student-system-glass-range"
                        type="range"
                        min="0"
                        max="80"
                        step="1"
                        value={buttonTransparency}
                        onChange={(event) =>
                          updateButtonTransparency(Number(event.target.value))
                        }
                      />
                      <div className="student-system-glass-scale" aria-hidden="true">
                        <span>更清晰</span>
                        <span>更通透</span>
                      </div>
                    </div>

                    <div className="student-system-glass-setting">
                      <div className="student-system-glass-setting-header">
                        <label htmlFor="student-system-menu-range">下拉菜单</label>
                        <span className="student-system-glass-value">
                          {menuTransparency}%
                        </span>
                      </div>
                      <input
                        id="student-system-menu-range"
                        className="student-system-glass-range"
                        type="range"
                        min="0"
                        max="90"
                        step="1"
                        value={menuTransparency}
                        onChange={(event) =>
                          updateMenuTransparency(Number(event.target.value))
                        }
                      />
                      <div className="student-system-glass-scale" aria-hidden="true">
                        <span>更清晰</span>
                        <span>更通透</span>
                      </div>
                    </div>

                    <div className="student-system-glass-popover-footer">
                      <span className="student-system-muted text-[10px]">自动保存</span>
                      <button
                        type="button"
                        className="student-system-glass-reset"
                        onClick={resetGlassTransparency}
                      >
                        恢复默认
                      </button>
                    </div>
                  </section>
                )}
              </section>
            )}
          </div>

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
