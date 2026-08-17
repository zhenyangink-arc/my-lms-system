"use client";

// @refresh reset

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getActiveLiveClassAction } from "./actions";
import { liveChannelName } from "./live-realtime";

type LiveClassCandidate = {
  id: string;
  teacherId: string;
};

type PresenceEntry = {
  role?: string;
};

/**
 * 学生端课时页横幅。
 * 数据库 active 只代表课堂未正式结束；只有 Realtime Presence 中确实存在
 * 发起老师时才展示入口，避免老师关闭页面后残留会话造成“仍在上课”的误报。
 */
export function LiveClassEntryBanner({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<LiveClassCandidate | null>(null);
  const [onlineSessionId, setOnlineSessionId] = useState<string | null>(null);
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
      const next = result.ok && result.session
        ? { id: result.session.id, teacherId: result.session.teacher_id }
        : null;
      setCandidate((current) => {
        if (current?.id === next?.id && current?.teacherId === next?.teacherId) {
          return current;
        }
        return next;
      });
      if (!next) setOnlineSessionId(null);
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

  useEffect(() => {
    if (!candidate) return;

    const supabase = createClient();
    let disposed = false;

    const channel = supabase.channel(liveChannelName(candidate.id), {
      config: { private: true },
    });

    const syncTeacherPresence = () => {
      if (disposed) return;
      const state = channel.presenceState() as unknown as Record<string, PresenceEntry[]>;
      const teacherEntries = state[candidate.teacherId] ?? [];
      setOnlineSessionId(
        teacherEntries.some((entry) => entry.role === "teacher") ? candidate.id : null
      );
    };

    channel.on("presence", { event: "sync" }, syncTeacherPresence);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) await supabase.realtime.setAuth(accessToken);
      if (disposed) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          syncTeacherPresence();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setOnlineSessionId(null);
        }
      });
    })();

    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [candidate]);

  if (loading || dismissed || !candidate || onlineSessionId !== candidate.id) return null;

  const space = window.location.pathname.split("/")[1];
  const href = `/${space}/dashboard/live/${candidate.id}`;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-[#b7ddd2] bg-[#e6f6f1]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#238777] text-white">
          <GraduationCap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#173f4a]">老师已进入实时课堂</p>
          <p className="app-muted-text truncate text-[11px] font-medium">
            进入课堂，实时跟随老师的讲解与圈点。
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(href)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#238777] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1d6d60]"
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
