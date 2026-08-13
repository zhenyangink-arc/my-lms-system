"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Settings, UserRound } from "lucide-react";

import { LogoutButton } from "@/app/dashboard/LogoutButton";

type PortalAccountMenuProps = {
  dashboardBasePath: string;
  userName: string;
  accountLabel: string;
};

export function PortalAccountMenu({
  dashboardBasePath,
  userName,
  accountLabel,
}: PortalAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initial = Array.from(userName.trim())[0]?.toUpperCase() || "U";

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 items-center gap-2 rounded-xl px-2 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
          {initial}
        </span>
        <span className="max-w-32 leading-tight">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {userName}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {accountLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        hidden={!isOpen}
        role="menu"
        aria-label="学生账户菜单"
        className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10"
      >
        <Link
          role="menuitem"
          href={`${dashboardBasePath}/profile`}
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <UserRound aria-hidden="true" size={16} />
          个人资料
        </Link>
        <Link
          role="menuitem"
          href={`${dashboardBasePath}/settings`}
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Settings aria-hidden="true" size={16} />
          设置
        </Link>
        <div className="my-1 border-t border-slate-100" />
        <LogoutButton appearance="menu" />
      </div>
    </div>
  );
}
