"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";

export const THEME_STORAGE_KEY = "app-dashboard-theme";
const THEME_CHANGE_EVENT = "app-dashboard-theme-change";

const themes = [
  {
    value: "classic",
    label: "阳光青提",
    description: "象牙白画布与青提绿点缀",
    colors: ["#63a867", "#b3936a", "#fcfbf7"],
  },
  {
    value: "aurora",
    label: "极光紫",
    description: "薰衣草画布与紫罗兰点缀",
    colors: ["#7c6ff0", "#5aa9e6", "#f7f6fb"],
  },
  {
    value: "coral",
    label: "蜜桃珊瑚",
    description: "胭脂白画布与珊瑚橘点缀",
    colors: ["#fb7d72", "#f4a6c1", "#fdf6f5"],
  },
  {
    value: "clarity",
    label: "曜石黑",
    description: "OLED 黑色画布、深色玻璃与明亮金",
    colors: ["#030303", "#ffd60a", "#bf5af2"],
  },
  {
    value: "porcelain",
    label: "云瓷白",
    description: "纯白画布、浅色玻璃与香槟金",
    colors: ["#ffffff", "#1d1d1f", "#d4a72c"],
  },
];

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getThemeSnapshot() {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return themes.some((item) => item.value === savedTheme)
    ? (savedTheme as string)
    : "clarity";
}

function getThemeServerSnapshot() {
  return "clarity";
}

export function ThemeSwitcher({ layout = "compact" }: { layout?: "compact" | "sidebar" }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-app-theme", theme);
  }, [theme]);

  function handleThemeChange(nextTheme: string) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div
      className={layout === "sidebar" ? "grid gap-1" : "flex items-center gap-1.5"}
      aria-label="界面主题"
    >
      {themes.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => handleThemeChange(item.value)}
          aria-label={`${item.label}主题：${item.description}`}
          aria-pressed={theme === item.value}
          title={`${item.label} · ${item.description}`}
          className={
            layout === "sidebar"
              ? "relative flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold transition hover:bg-[color-mix(in_srgb,var(--app-accent-soft)_46%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
              : "relative flex h-8 w-8 items-center justify-center rounded-xl border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
          }
          style={{
            borderColor:
              theme === item.value ? "var(--app-accent)" : "var(--app-border)",
            backgroundColor: "transparent",
          }}
        >
          <span
            className={
              layout === "sidebar"
                ? "h-6 w-6 shrink-0 rounded-lg shadow-sm"
                : "h-5 w-5 rounded-lg shadow-sm"
            }
            style={{
              background: `linear-gradient(135deg, ${item.colors[0]} 0 38%, ${item.colors[1]} 38% 70%, ${item.colors[2]} 70%)`,
            }}
          />
          {layout === "sidebar" && (
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          )}
          {theme === item.value && (
            <span
              className={
                layout === "sidebar"
                  ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  : "absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
              }
              style={{
                color: "var(--app-accent-contrast)",
                backgroundColor: "var(--app-accent)",
              }}
            >
              <Check size={layout === "sidebar" ? 11 : 8} strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function SidebarThemeControl() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        title="切换主题"
        className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl px-2 text-[11px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--app-accent-soft)_40%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
        style={{ color: open ? "var(--app-accent-strong)" : "var(--app-muted)" }}
      >
        <Palette size={18} className="shrink-0" aria-hidden="true" />
        <span className="app-student-utility-expanded min-w-0 flex-1 truncate text-left">
          切换主题
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`app-student-utility-expanded shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="app-student-utility-expanded mt-1 rounded-xl border p-1.5"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor:
              "color-mix(in srgb, var(--app-card-bg) 64%, transparent)",
          }}
        >
          <ThemeSwitcher layout="sidebar" />
        </div>
      )}
    </div>
  );
}
