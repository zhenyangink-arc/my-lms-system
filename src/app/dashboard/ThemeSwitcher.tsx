"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Palette } from "lucide-react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";
const THEME_CHANGE_EVENT = "puffy-dashboard-theme-change";

const themes = [
  {
    value: "default",
    label: "默认",
  },
  {
    value: "warm",
    label: "护眼",
  },
  {
    value: "lowblue",
    label: "低蓝光",
  },
  {
    value: "blue",
    label: "浅蓝",
  },
  {
    value: "green",
    label: "浅绿",
  },
  {
    value: "purple",
    label: "浅紫",
  },
  {
    value: "coffee",
    label: "咖啡",
  },
  {
    value: "slate",
    label: "夜灰",
  },
  {
    value: "night",
    label: "夜晚",
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
    <div className="app-theme-card rounded-2xl border p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="app-card flex h-8 w-8 items-center justify-center rounded-xl border shadow-sm">
          <Palette size={17} />
        </div>

        <div>
          <p className="text-sm font-bold">主题颜色</p>
          <p className="text-xs opacity-60">每个用户可自行选择</p>
        </div>
      </div>

      <select
        value={theme}
        onChange={(event) => handleThemeChange(event.target.value)}
        className="app-input w-full rounded-xl border px-3 py-2 text-xs font-semibold outline-none transition"
      >
        {themes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
