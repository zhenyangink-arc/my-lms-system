"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";

type HangulLessonLaunchLinkProps = {
  href: string;
  className: string;
  style?: CSSProperties;
  children: ReactNode;
  shouldEnterFullscreen: boolean;
  locked: boolean;
};

export function HangulLessonLaunchLink({
  href,
  className,
  style,
  children,
  shouldEnterFullscreen,
  locked,
}: HangulLessonLaunchLinkProps) {
  const router = useRouter();
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStage, setLaunchStage] = useState(0);
  const [launchIsSlow, setLaunchIsSlow] = useState(false);
  const launchDialogRef = useRef<HTMLDivElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isLaunching) return;
    launchDialogRef.current?.focus();
    const readingTimer = window.setTimeout(() => setLaunchStage(1), 350);
    const interfaceTimer = window.setTimeout(() => setLaunchStage(2), 1100);
    const slowTimer = window.setTimeout(() => setLaunchIsSlow(true), 12000);
    return () => {
      window.clearTimeout(readingTimer);
      window.clearTimeout(interfaceTimer);
      window.clearTimeout(slowTimer);
    };
  }, [isLaunching]);

  useEffect(() => {
    function resetLaunchState() {
      setIsLaunching(false);
      setLaunchStage(0);
      setLaunchIsSlow(false);
    }
    window.addEventListener("pageshow", resetLaunchState);
    return () => window.removeEventListener("pageshow", resetLaunchState);
  }, []);

  const launchStages = [
    { label: "正在检查课程入口", progress: 24 },
    { label: "正在读取章节数据", progress: 58 },
    { label: "正在准备学习界面", progress: 88 },
  ];
  const currentLaunchStage = launchStages[launchStage] ?? launchStages[0];

  function keepFocusInLaunchDialog(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    event.preventDefault();
    (retryButtonRef.current ?? launchDialogRef.current)?.focus();
  }

  function openLesson(event: MouseEvent<HTMLAnchorElement>) {
    if (locked) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (isLaunching) return;
    setLaunchStage(0);
    setLaunchIsSlow(false);
    setIsLaunching(true);

    if (shouldEnterFullscreen) {
      // Browsers only permit this API directly from the user's click.
      void document.documentElement.requestFullscreen().catch(() => {});
    }
    router.prefetch(href);
    window.requestAnimationFrame(() => router.push(href));
  }

  return (
    <>
      {locked ? (
        <span
          className={`${className} cursor-not-allowed opacity-65`}
          style={style}
          aria-disabled="true"
        >
          {children}
        </span>
      ) : (
        <Link
          href={href}
          prefetch={true}
          className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2`}
          style={style}
          onClick={openLesson}
          onPointerEnter={() => router.prefetch(href)}
          onFocus={() => router.prefetch(href)}
          aria-busy={isLaunching || undefined}
        >
          {children}
        </Link>
      )}
      {isLaunching && (
        <div
          ref={launchDialogRef}
          className="fixed inset-0 z-[80] flex h-[100dvh] items-center justify-center bg-[color-mix(in_srgb,var(--card)_96%,transparent)] px-5 text-[var(--foreground)] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-launch-title"
          aria-describedby="course-launch-description"
          aria-busy="true"
          tabIndex={-1}
          onKeyDown={keepFocusInLaunchDialog}
        >
          <div className="app-card w-full max-w-md rounded-[28px] border p-6 shadow-2xl sm:p-8">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--support-surface)] text-[var(--support)]" aria-hidden="true">
              <BookOpen size={23} />
            </span>
            <p id="course-launch-title" className="mt-5 text-center text-lg font-bold">正在为你准备课程</p>
            <p id="course-launch-description" role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-center text-sm leading-6 text-[var(--foreground-secondary)]">
              {currentLaunchStage.label}。数据准备完成后会自动进入，请稍候。
            </p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--border-subtle)]" role="progressbar" aria-label="课程准备进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentLaunchStage.progress}>
              <div
                className="h-full rounded-full bg-[var(--support)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${currentLaunchStage.progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[var(--foreground-muted)]">
              <span>{currentLaunchStage.label}</span>
              <span className="tabular-nums">步骤 {launchStage + 1} / {launchStages.length}</span>
            </div>
            {launchIsSlow && (
              <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3 text-center">
                <p className="text-xs font-semibold leading-5 text-[var(--foreground-secondary)]">加载时间比平时稍长，可以继续等待或重新加载。</p>
                <button
                  ref={retryButtonRef}
                  type="button"
                  onClick={() => window.location.assign(href)}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-sm font-bold text-[var(--foreground)] transition hover:border-[var(--support)]"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  重新加载课程
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
