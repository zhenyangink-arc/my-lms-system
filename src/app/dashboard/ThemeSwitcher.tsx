"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";

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

export function ThemeSwitcher() {
  const [theme, setTheme] = useState("default");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-puffy-theme", savedTheme);
      return;
    }

    document.documentElement.setAttribute("data-puffy-theme", "default");
  }, []);

  function handleThemeChange(nextTheme: string) {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    document.documentElement.setAttribute("data-puffy-theme", nextTheme);
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