"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Check } from "lucide-react";

export const THEME_STORAGE_KEY = "app-dashboard-theme";
const THEME_CHANGE_EVENT = "app-dashboard-theme-change";

const themes = [
  {
    value: "classic",
    label: "元智蓝",
    description: "静谧蓝画布与白色玻璃卡片",
    colors: ["#2563eb", "#0ea5e9", "#eef1f8"],
  },
  {
    value: "vercel",
    label: "极简",
    description: "Vercel 风格的黑白灰与蓝色点缀",
    colors: ["#171717", "#0070f3", "#fafafa"],
  },
  {
    value: "chatgpt",
    label: "清雅",
    description: "ChatGPT 风格的中性灰与绿色",
    colors: ["#10a37f", "#ab68ff", "#f7f7f8"],
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
    <div className="hidden items-center gap-1.5 sm:flex" aria-label="界面主题">
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
