"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

const FULLSCREEN_PROMPT_KEY = "student-fullscreen-prompt";
const STUDENT_FULLSCREEN_ATTRIBUTE = "data-student-fullscreen";
const BROWSER_FULLSCREEN_TOLERANCE = 48;

function isBrowserFullscreen() {
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const widthMatches =
    Math.abs(viewportWidth - window.screen.width) <= BROWSER_FULLSCREEN_TOLERANCE;
  const heightMatches =
    Math.abs(viewportHeight - window.screen.height) <= BROWSER_FULLSCREEN_TOLERANCE;
  const displayModeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;

  // F11 fullscreen does not set document.fullscreenElement. Browser and OS
  // scaling can also leave a small edge gap, so matching within two pixels was
  // too strict and left the ordinary floating-window layout active.
  return (widthMatches && heightMatches) || displayModeFullscreen;
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

    // 应用切换器点击"进入应用"时会直接请求一次全屏，这时导航到这里挂载的
    // 时候浏览器其实已经是全屏状态了；这个标记只是登录时留下的"找机会提醒
    // 一次"，不代表现在真的还需要提醒。先看当前是不是已经全屏，是的话直接
    // 消费掉标记，不用再弹一次。
    if (document.fullscreenElement || isBrowserFullscreen()) {
      hasEnteredFullscreen.current = true;
      return;
    }

    // 这里不能在 cleanup 里 cancelAnimationFrame：开发模式下 React Strict Mode
    // 会把这个 effect 立刻挂载、卸载、再挂载一次。如果 cleanup 取消了第一次
    // 挂载排的这一帧，等到第二次挂载时 sessionStorage 里的标记已经被第一次
    // 消费掉了，条件判断直接短路返回，弹窗就再也不会出现。让这一帧原样触发，
    // 组件本身还挂载着，调用 setIsVisible 是安全的。
    window.requestAnimationFrame(() => setIsVisible(true));
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <aside
        className="relative w-full max-w-md rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
        style={{
          color: "var(--foreground)",
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in srgb, var(--card) 94%, transparent)",
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
            style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}
          >
            <Maximize2 size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="student-fullscreen-title" className="font-bold">
              进入全屏学习
            </h2>
            <p id="student-fullscreen-description" className="app-muted-text mt-1 text-xs font-bold leading-5">
              减少页面外的干扰，获得更专注的学习体验。按 Esc 可随时退出全屏。
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="mt-3 text-xs font-bold" role="alert" style={{ color: "var(--status-warning)" }}>
            {errorMessage}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={enterFullscreen}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}
          >
            <Maximize2 size={16} aria-hidden="true" />
            进入全屏学习
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="app-soft-card h-10 rounded-xl border px-4 text-sm font-bold"
          >
            暂不进入
          </button>
        </div>
      </aside>
    </div>
  );
}
