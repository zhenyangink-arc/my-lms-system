"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

type HangulLessonLaunchLinkProps = {
  href: string;
  className: string;
  style: CSSProperties;
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

  function openLesson(event: MouseEvent<HTMLAnchorElement>) {
    if (locked) {
      event.preventDefault();
      return;
    }
    if (!shouldEnterFullscreen) return;
    event.preventDefault();
    setIsLaunching(true);

    // Browsers only permit this API directly from the user's click. Do not
    // await it: waiting briefly exposes the course-detail page in fullscreen.
    void document.documentElement.requestFullscreen().catch(() => {});
    router.push(href);
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
          className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2`}
          style={style}
          onClick={openLesson}
        >
          {children}
        </Link>
      )}
      {isLaunching && (
        <div
          className="fixed inset-0 z-[60] flex h-[100dvh] items-center justify-center bg-[var(--card)] text-[var(--primary)]"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-4">
            <span
              aria-hidden="true"
              className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--status-success)]"
            />
            <p className="text-sm font-bold">正在打开阅读器…</p>
          </div>
        </div>
      )}
    </>
  );
}
