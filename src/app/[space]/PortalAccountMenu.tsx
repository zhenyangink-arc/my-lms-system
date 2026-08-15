"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, Settings, UserRound } from "lucide-react";

import { LogoutButton } from "@/app/dashboard/LogoutButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PortalAccountMenuProps = {
  userName: string;
  accountLabel: string;
  profileContent: ReactNode;
  settingsContent: ReactNode;
};

export function PortalAccountMenu({
  userName,
  accountLabel,
  profileContent,
  settingsContent,
}: PortalAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"profile" | "settings" | null>(null);
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

  function openDialog(dialog: "profile" | "settings") {
    setIsOpen(false);
    setActiveDialog(dialog);
  }

  return (
    <>
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
          <button
            type="button"
            role="menuitem"
            onClick={() => openDialog("profile")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <UserRound aria-hidden="true" size={16} />
            个人资料
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openDialog("settings")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <Settings aria-hidden="true" size={16} />
            设置
          </button>
          <div className="my-1 border-t border-slate-100" />
          <LogoutButton appearance="menu" />
        </div>
      </div>

      <Dialog
        open={activeDialog !== null}
        onOpenChange={(open) => {
          if (!open) setActiveDialog(null);
        }}
      >
        <DialogContent
          overlayClassName="bg-slate-950/35 backdrop-blur-sm"
          className={activeDialog === "profile"
            ? "grid h-[calc(100dvh-2rem)] max-h-[960px] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.75rem] bg-slate-50 p-0 sm:max-w-[min(1180px,calc(100vw-2rem))]"
            : "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.75rem] bg-slate-50 p-0 sm:max-w-xl"}
        >
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 pr-14">
            <DialogTitle className="text-xl font-black text-slate-950">
              {activeDialog === "profile" ? "个人资料" : "设置"}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {activeDialog === "profile"
                ? "完善个人与教育信息，让学习和留学建议更准确。"
                : "调整学习工作台的主题与显示效果。"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {activeDialog === "profile" ? profileContent : settingsContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
