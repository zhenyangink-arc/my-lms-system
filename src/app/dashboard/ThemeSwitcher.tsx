"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check } from "lucide-react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";
const THEME_CHANGE_EVENT = "puffy-dashboard-theme-change";

const themes = [
  {
    value: "default",
    label: "晴空",
    description: "珊瑚与天蓝",
    colors: ["#f47b5f", "#67bed5", "#f6d98b"],
  },
  {
    value: "warm",
    label: "暖阳",
    description: "杏色与琥珀",
    colors: ["#df8651", "#efb65f", "#ead7bb"],
  },
  {
    value: "green",
    label: "清新",
    description: "薄荷与青绿",
    colors: ["#319b7d", "#79c9b1", "#d7efe4"],
  },
  {
    value: "lavender",
    label: "柔紫",
    description: "薰衣草与莓果",
    colors: ["#8c78c6", "#c4b8e8", "#f0dce5"],
  },
  {
    value: "night",
    label: "夜航",
    description: "深蓝与柔和天青",
    colors: ["#16283a", "#4fa8c5", "#f08a70"],
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
    : "default";
}

function getThemeServerSnapshot() {
  return "default";
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-puffy-theme", theme);
  }, [theme]);

  function handleThemeChange(nextTheme: string) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div className="flex items-center justify-center gap-1.5 py-1" aria-label="界面主题">
      {/* 主题区只保留色彩图标，名称通过悬停提示和无障碍标签提供。 */}
      {themes.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => handleThemeChange(item.value)}
          aria-label={`${item.label}主题：${item.description}`}
          aria-pressed={theme === item.value}
          title={`${item.label} · ${item.description}`}
          className="relative flex h-8 w-8 items-center justify-center rounded-xl border transition hover:-translate-y-0.5"
          style={{
            borderColor: theme === item.value ? "var(--app-accent)" : "var(--app-border)",
            backgroundColor: "transparent",
          }}
        >
          <span className="h-5 w-5 rounded-lg shadow-sm" style={{ background: `linear-gradient(135deg, ${item.colors[0]} 0 38%, ${item.colors[1]} 38% 70%, ${item.colors[2]} 70%)` }} />
          {theme === item.value && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white" style={{ backgroundColor: "var(--app-accent)" }}><Check size={8} strokeWidth={3} /></span>}
        </button>
      ))}
    </div>
  );
}
