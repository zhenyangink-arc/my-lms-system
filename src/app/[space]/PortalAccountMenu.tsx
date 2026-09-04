"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChevronDown, Settings, UserRound, X } from "lucide-react";

import { LogoutButton } from "@/app/dashboard/LogoutButton";
import {
  ProfileDialogModeProvider,
  type ProfileDialogMode,
} from "@/app/dashboard/profile/ProfileDialogModeContext";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PORTAL_PROFILE_OPEN_EVENT,
  type PortalProfileOpenMode,
} from "./PortalProfileTrigger";

type PortalAccountMenuProps = {
  userName: string;
  accountLabel: string;
  avatarUrl: string | null;
  profileContent: ReactNode;
  settingsContent: ReactNode;
};

export function PortalAccountMenu({
  userName,
  accountLabel,
  avatarUrl,
  profileContent,
  settingsContent,
}: PortalAccountMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"profile" | "settings" | null>(null);
  const [profileMode, setProfileMode] = useState<ProfileDialogMode>("summary");
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

  useEffect(() => {
    function openProfile(event: Event) {
      const detail = (event as CustomEvent<{ mode?: PortalProfileOpenMode }>).detail;
      setIsOpen(false);
      setProfileMode(detail?.mode === "edit" ? "edit" : "summary");
      setActiveDialog("profile");
    }

    window.addEventListener(PORTAL_PROFILE_OPEN_EVENT, openProfile);
    return () => window.removeEventListener(PORTAL_PROFILE_OPEN_EVENT, openProfile);
  }, []);

  function openDialog(dialog: "profile" | "settings") {
    setIsOpen(false);
    if (dialog === "profile") setProfileMode("summary");
    setActiveDialog(dialog);
  }

  return (
    <>
      <div ref={menuRef} className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-11 items-center gap-2 rounded-xl px-1 text-left text-slate-950 transition-colors hover:bg-slate-900/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:px-2"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-300 bg-cover bg-center text-[11px] font-black text-slate-950 shadow-sm ring-1 ring-white/70"
            style={avatarUrl ? { backgroundImage: `url("${avatarUrl}")` } : undefined}
          >
            {avatarUrl ? null : initial}
          </span>
          <span className="hidden max-w-32 leading-tight md:block">
            <span className="block truncate text-xs font-bold text-slate-950">
              {userName}
            </span>
            <span className="block truncate text-xs font-medium text-slate-500">
              {accountLabel}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className={`hidden text-slate-500 transition-transform md:block ${isOpen ? "rotate-180" : ""}`}
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
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <UserRound aria-hidden="true" size={16} />
            个人资料
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openDialog("settings")}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
          showCloseButton={false}
          overlayClassName="bg-slate-950/35 backdrop-blur-sm"
          className={activeDialog === "profile"
            ? "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.75rem] bg-slate-50 p-0 sm:max-w-2xl"
            : "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[1.75rem] bg-slate-50 p-0 sm:max-w-xl"}
        >
          <DialogClose
            type="button"
            aria-label={activeDialog === "profile" ? "关闭个人资料" : "关闭设置"}
            className="absolute right-2.5 top-2.5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <X size={18} aria-hidden="true" />
          </DialogClose>
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
          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            {activeDialog === "profile" ? (
              <ProfileDialogModeProvider mode={profileMode}>
                {profileContent}
              </ProfileDialogModeProvider>
            ) : settingsContent}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
