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
        <Link href={href} className={className} style={style} onClick={openLesson}>
          {children}
        </Link>
      )}
      {isLaunching && (
        <div className="fixed inset-0 z-[60] flex h-[100dvh] items-center justify-center bg-[#f7faf8] text-[#173f4a]">
          <div className="flex flex-col items-center gap-4">
            <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#dce8e1] border-t-[#238777]" />
            <p className="text-sm font-black">正在打开阅读器…</p>
          </div>
        </div>
      )}
    </>
  );
}
