"use client";

import { useLayoutEffect } from "react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";
const AVAILABLE_THEMES = new Set([
  "default",
  "warm",
  "green",
  "lavender",
  "night",
]);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = savedTheme && AVAILABLE_THEMES.has(savedTheme)
      ? savedTheme
      : "default";

    // 旧版本保存过的主题会安全回退到新的明亮默认主题。
    document.documentElement.dataset.puffyTheme = nextTheme;
  }, []);

  return <>{children}</>;
}
