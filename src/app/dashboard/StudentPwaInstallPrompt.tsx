"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function StudentPwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    }

    function handleInstalled() {
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
    await installEvent.userChoice;
    setInstallEvent(null);
    setIsVisible(false);
  }

  if (!isVisible || !installEvent) return null;

  return (
    <aside
      className="fixed right-4 top-20 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:right-6 sm:top-24"
      style={{
        color: "var(--app-text)",
        borderColor: "var(--app-border)",
        backgroundColor: "color-mix(in srgb, var(--app-card-bg) 94%, transparent)",
      }}
      role="dialog"
      aria-labelledby="student-pwa-title"
      aria-describedby="student-pwa-description"
    >
      <button
        type="button"
        onClick={() => setIsVisible(false)}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/5"
        aria-label="关闭安装提示"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="flex gap-3 pr-8">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
        >
          <Download size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 id="student-pwa-title" className="font-black">安装 PUFFY 学习应用</h2>
          <p id="student-pwa-description" className="app-muted-text mt-1 text-xs font-bold leading-5">
            安装后从桌面独立打开，不显示浏览器地址栏，使用体验更接近原生应用。
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={installApp}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
        style={{ backgroundColor: "var(--app-accent)" }}
      >
        <Download size={16} aria-hidden="true" />
        安装到桌面
      </button>
    </aside>
  );
}
