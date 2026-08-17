"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "pwa-prompt-dismissed-at";
const INSTALLED_KEY = "pwa-installed";
const LAST_SHOWN_KEY = "pwa-prompt-last-shown-at";
const HIDE_TODAY_KEY = "pwa-prompt-hide-today";
const DISMISS_REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_SHOWN_REMEMBER_MS = 24 * 60 * 60 * 1000;

function todayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isHiddenToday(): boolean {
  try {
    return window.localStorage.getItem(HIDE_TODAY_KEY) === todayKey();
  } catch {
    return false;
  }
}

function markHiddenToday() {
  try {
    window.localStorage.setItem(HIDE_TODAY_KEY, todayKey());
  } catch {
    // localStorage 不可用时静默忽略。
  }
}

function isDismissedRecently(): boolean {
  try {
    if (window.localStorage.getItem(INSTALLED_KEY) === "1") return true;
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY));
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
    return Date.now() - dismissedAt < DISMISS_REMEMBER_MS;
  } catch {
    // localStorage 不可用(隐私模式/禁用存储)时静默忽略，按未关闭处理。
    return false;
  }
}

function isRecentlyShown(): boolean {
  try {
    const lastShownAt = Number(window.localStorage.getItem(LAST_SHOWN_KEY));
    if (!Number.isFinite(lastShownAt) || lastShownAt <= 0) return false;
    return Date.now() - lastShownAt < LAST_SHOWN_REMEMBER_MS;
  } catch {
    return false;
  }
}

function markPromptShown() {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用时静默忽略。
  }
}

function markPromptDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // localStorage 不可用时静默忽略。
  }
}

function markAppInstalled() {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // localStorage 不可用时静默忽略。
  }
}

export function StudentPwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      // 今天已点过"今天不显示"、已安装、上次关闭还在冷静期内，或 24 小时内刚展示过，不再重复打扰。
      if (isHiddenToday() || isDismissedRecently() || isRecentlyShown()) return;

      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
      markPromptShown();
    }

    function handleInstalled() {
      markAppInstalled();
      setInstallEvent(null);
      setIsVisible(false);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;

    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      markAppInstalled();
    } else {
      markPromptDismissed();
    }
    setInstallEvent(null);
    setIsVisible(false);
  }

  if (!isVisible || !installEvent) return null;

  return (
    <aside
      className="fixed right-4 top-20 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:right-6 sm:top-24"
      style={{
        color: "var(--foreground)",
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in srgb, var(--card) 94%, transparent)",
      }}
      role="dialog"
      aria-labelledby="student-pwa-title"
      aria-describedby="student-pwa-description"
    >
      <button
        type="button"
        onClick={() => {
          markPromptDismissed();
          setIsVisible(false);
        }}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/5"
        aria-label="关闭安装提示"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="flex gap-3 pr-8">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
        >
          <Download size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="student-pwa-title" className="font-bold">安装 PUFFY 学习应用</h2>
          <p id="student-pwa-description" className="app-muted-text mt-1 text-xs font-bold leading-5">
            安装后从桌面独立打开，不显示浏览器地址栏，使用体验更接近原生应用。
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={installApp}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <Download size={16} aria-hidden="true" />
        安装到桌面
      </button>

      <button
        type="button"
        onClick={() => {
          markHiddenToday();
          setIsVisible(false);
        }}
        className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border px-4 text-xs font-bold transition hover:bg-black/[0.02]"
        style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
      >
        今天不显示
      </button>
    </aside>
  );
}
