"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type ManagementSidebarContextValue = {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const ManagementSidebarContext = createContext<ManagementSidebarContextValue | null>(null);

export function ManagementSidebarProvider({ children, defaultCollapsed = false }: { children: ReactNode; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("management_sidebar_collapsed", String(next));
      document.cookie = `management_sidebar_collapsed=${next}; path=/; max-age=604800`;
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mobileOpen) {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, toggleSidebar]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const value = useMemo(
    () => ({ collapsed, mobileOpen, setMobileOpen, toggleSidebar }),
    [collapsed, mobileOpen, toggleSidebar],
  );

  return <ManagementSidebarContext.Provider value={value}>{children}</ManagementSidebarContext.Provider>;
}

export function useManagementSidebar() {
  const context = useContext(ManagementSidebarContext);
  if (!context) throw new Error("管理端侧栏必须在侧栏状态容器中使用。");
  return context;
}
