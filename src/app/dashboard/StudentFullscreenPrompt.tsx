"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

const FULLSCREEN_PROMPT_KEY = "student-fullscreen-prompt";
const STUDENT_FULLSCREEN_ATTRIBUTE = "data-student-fullscreen";

function isBrowserFullscreen() {
  const widthMatches = Math.abs(window.innerWidth - window.screen.width) <= 2;
  const heightMatches = Math.abs(window.innerHeight - window.screen.height) <= 2;
  const displayModeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;

  return widthMatches && heightMatches || displayModeFullscreen;
}

export function markStudentFullscreenPromptPending() {
  window.sessionStorage.setItem(FULLSCREEN_PROMPT_KEY, "pending");
}

export function StudentFullscreenPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasEnteredFullscreen = useRef(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(FULLSCREEN_PROMPT_KEY) !== "pending") return;

    window.sessionStorage.removeItem(FULLSCREEN_PROMPT_KEY);
    const frameId = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    function syncStudentFullscreenState() {
      const isFullscreen = Boolean(document.fullscreenElement) || isBrowserFullscreen();

      document.documentElement.setAttribute(
        STUDENT_FULLSCREEN_ATTRIBUTE,
        isFullscreen ? "true" : "false"
      );
    }

    syncStudentFullscreenState();
    window.addEventListener("resize", syncStudentFullscreenState);
    document.addEventListener("fullscreenchange", syncStudentFullscreenState);

    return () => {
      window.removeEventListener("resize", syncStudentFullscreenState);
      document.removeEventListener("fullscreenchange", syncStudentFullscreenState);
      document.documentElement.removeAttribute(STUDENT_FULLSCREEN_ATTRIBUTE);
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && hasEnteredFullscreen.current) {
        setErrorMessage(null);
        setIsVisible(true);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function dismiss() {
    setIsVisible(false);
    setErrorMessage(null);
  }

  async function enterFullscreen() {
    if (!document.fullscreenEnabled) {
      setErrorMessage("当前浏览器不支持网页全屏，请使用浏览器的全屏功能。");
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
      hasEnteredFullscreen.current = true;
      dismiss();
    } catch {
      setErrorMessage("未能进入全屏，请再试一次或使用浏览器的全屏功能。");
    }
  }

  if (!isVisible) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-24 z-[90] mx-auto max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-xl md:bottom-6"
      style={{
        color: "var(--app-text)",
        borderColor: "var(--app-border)",
        backgroundColor: "color-mix(in srgb, var(--app-card-bg) 94%, transparent)",
      }}
      role="dialog"
      aria-labelledby="student-fullscreen-title"
      aria-describedby="student-fullscreen-description"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/5"
        aria-label="稍后再说"
      >
        <X size={16} aria-hidden="true" />
      </button>

      <div className="flex gap-3 pr-8">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
        >
          <Maximize2 size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="student-fullscreen-title" className="font-black">
            进入全屏学习
          </h2>
          <p id="student-fullscreen-description" className="app-muted-text mt-1 text-xs font-bold leading-5">
            减少页面外的干扰，获得更专注的学习体验。按 Esc 可随时退出全屏。
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="mt-3 text-xs font-bold" role="alert" style={{ color: "var(--app-warm)" }}>
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={enterFullscreen}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <Maximize2 size={16} aria-hidden="true" />
          进入全屏学习
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="app-soft-card h-10 rounded-xl border px-4 text-sm font-black"
        >
          暂不进入
        </button>
      </div>
    </aside>
  );
}
