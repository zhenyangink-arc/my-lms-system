"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, X } from "lucide-react";

import { getActiveLiveClassAction } from "./actions";

/** 学生端课时页横幅：老师正在对该课时上伴学课时，点击进入课堂。 */
export function LiveClassEntryBanner({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let checking = false;
    const checkActiveClass = async () => {
      if (checking) return;
      checking = true;
      const result = await getActiveLiveClassAction(lessonId);
      checking = false;
      if (cancelled) return;
      setSessionId(result.ok && result.session ? result.session.id : null);
      setLoading(false);
    };
    void checkActiveClass();
    // 老师在课堂中途确认加入后，学生无需刷新即可在当前课时页收到入口。
    const timer = window.setInterval(() => void checkActiveClass(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lessonId]);

  if (loading || dismissed || !sessionId) return null;

  const space = window.location.pathname.split("/")[1];
  const href = `/${space}/dashboard/live/${sessionId}`;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-[#b7ddd2] bg-[#e6f6f1]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#238777] text-white">
          <GraduationCap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#173f4a]">老师正在给你上课</p>
          <p className="app-muted-text truncate text-[11px] font-medium">
            进入课堂，实时跟随老师的讲解与圈点。
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(href)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#238777] px-4 py-2 text-xs font-black text-white transition hover:bg-[#1d6d60]"
        >
          进入课堂
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="关闭提醒"
          className="shrink-0 rounded-full p-1.5 text-[#60736a] transition hover:bg-black/[0.05]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
