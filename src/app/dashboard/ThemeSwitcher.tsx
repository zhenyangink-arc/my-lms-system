"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check } from "lucide-react";

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
    : "classic";
}

function getThemeServerSnapshot() {
  return "classic";
}

export function ThemeSwitcher() {
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
    <div className="flex items-center gap-1.5" aria-label="界面主题">
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
            borderColor:
              theme === item.value ? "var(--app-accent)" : "var(--app-border)",
            backgroundColor: "transparent",
          }}
        >
          <span
            className="h-5 w-5 rounded-lg shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${item.colors[0]} 0 38%, ${item.colors[1]} 38% 70%, ${item.colors[2]} 70%)`,
            }}
          />
          {theme === item.value && (
            <span
              className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              <Check size={8} strokeWidth={3} />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
