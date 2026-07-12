"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "puffy-dashboard-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme) {
      document.documentElement.setAttribute("data-puffy-theme", savedTheme);
      return;
    }

    document.documentElement.setAttribute("data-puffy-theme", "default");
  }, []);

  return <>{children}</>;
}