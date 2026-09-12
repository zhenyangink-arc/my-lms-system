"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { TeacherVideoPlayback } from "@/lib/teaching-video";

export function TeacherVideoPlayer({ playback, videoRef, paused, muted, transcript, storageKey, locale, onStatus }: {
  playback: TeacherVideoPlayback;
  videoRef: RefObject<HTMLVideoElement | null>;
  paused: boolean; muted: boolean; transcript: string; storageKey: string; locale: "zh-CN" | "ko-KR";
  onStatus: (status: "loading" | "playing" | "paused" | "ended" | "error") => void;
}) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [textOnly, setTextOnly] = useState(false);
  const callback = useRef(onStatus);
  const lastSaved = useRef(0);
  const ko = locale === "ko-KR";
  useEffect(() => { callback.current = onStatus; }, [onStatus]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else if (!video.ended && !failed && !textOnly) void video.play().catch(() => { setNeedsPlay(true); callback.current("paused"); });
  }, [paused, failed, textOnly, retry, videoRef]);
  useEffect(() => {
    const video = videoRef.current;
    return () => { video?.pause(); };
  }, [videoRef]);

  return <section className="space-y-3" aria-label={ko ? "선생님 영상" : "教师视频"}>
    {playback.objectKey && !textOnly ? <div className="relative overflow-hidden rounded-xl bg-black">
      <video key={retry} ref={videoRef} src={`/api/learning-agent/teacher-video?key=${encodeURIComponent(playback.objectKey)}`}
        controls playsInline muted={muted} preload="auto" aria-label={playback.title}
        className="aspect-video max-h-[65dvh] w-full object-contain"
        onLoadedMetadata={(event) => {
          try {
            const position = Number(sessionStorage.getItem(storageKey));
            if (position > 0 && position < event.currentTarget.duration - 1) event.currentTarget.currentTime = position;
          } catch { /* Storage may be disabled. Playback remains available. */ }
        }}
        onPlaying={() => { setBuffering(false); setNeedsPlay(false); onStatus("playing"); }}
        onWaiting={() => { setBuffering(true); onStatus("loading"); }}
        onPause={(event) => { if (!event.currentTarget.ended && !failed) onStatus("paused"); }}
        onTimeUpdate={(event) => {
          const position = event.currentTarget.currentTime;
          if (Math.abs(position - lastSaved.current) < 2) return;
          lastSaved.current = position;
          try { sessionStorage.setItem(storageKey, String(position)); } catch { /* Optional resume cache. */ }
        }}
        onEnded={() => { try { sessionStorage.removeItem(storageKey); } catch { /* Optional resume cache. */ } onStatus("ended"); }}
        onError={() => { setFailed(true); setBuffering(false); onStatus("error"); }}
      />
      {buffering && !failed && !needsPlay && <p role="status" className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/70 px-3 py-2 text-sm text-white">{ko ? "영상 준비 중…" : "正在准备视频…"}</p>}
      {needsPlay && !failed && <button type="button" disabled={paused} onClick={() => { void videoRef.current?.play().catch(() => setNeedsPlay(true)); }} className="absolute left-1/2 top-1/2 min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-5 font-semibold text-black disabled:opacity-50">{ko ? "영상 재생" : "点击播放视频"}</button>}
    </div> : null}
    {(failed || !playback.objectKey) && playback.status !== "text" && !textOnly && <div role="status" className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]">
      <p>{failed ? ko ? "영상을 재생하지 못했어요." : "视频播放失败。" : playback.status === "stale" ? ko ? "수정된 대사의 영상을 준비하고 있어요." : "台词已更新，视频待重新核对。" : ko ? "선생님 영상을 준비하고 있어요." : "这段教师视频尚未配置。"}</p>
      <div className="flex flex-wrap gap-2">
        {failed && <button type="button" className="min-h-11 rounded-lg border border-[var(--border)] px-4" onClick={() => { setFailed(false); setBuffering(true); onStatus("loading"); setRetry((value) => value + 1); }}>{ko ? "다시 시도" : "重新加载"}</button>}
        <button type="button" className="min-h-11 rounded-lg border border-[var(--border)] px-4" onClick={() => { videoRef.current?.pause(); setTextOnly(true); onStatus("ended"); }}>{ko ? "글로 학습 계속" : "阅读文字后继续"}</button>
      </div>
    </div>}
    {transcript && <details open={textOnly || !playback.objectKey} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--card)] px-4 text-[var(--foreground)]"><summary className="min-h-11 cursor-pointer text-sm font-semibold leading-[2.75rem]">{ko ? "수업 내용" : "本段台词"}</summary><p className="whitespace-pre-line pb-4 text-sm leading-7">{transcript}</p></details>}
  </section>;
}
