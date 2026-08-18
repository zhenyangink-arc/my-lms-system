"use client";

import { Gauge, Headphones, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function AssignmentListeningPlayer({ script }: { script: string }) {
  const [normalPlays, setNormalPlays] = useState(0);
  const [slowPlays, setSlowPlays] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const supported = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    []
  );

  useEffect(
    () => () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    []
  );

  function play(rate: number) {
    if (!supported) {
      setError("当前浏览器不能播放合成听力，请使用最新版 Chrome、Edge 或 Safari。");
      return;
    }
    const isSlow = rate < 0.9;
    if ((isSlow && slowPlays >= 1) || (!isSlow && normalPlays >= 2)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    const koreanVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ko"));
    if (koreanVoice) utterance.voice = koreanVoice;
    utterance.lang = "ko-KR";
    utterance.rate = rate;
    utterance.onstart = () => {
      setSpeaking(true);
      if (isSlow) setSlowPlays((count) => count + 1);
      else setNormalPlays((count) => count + 1);
    };
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setError("听力播放失败，请检查系统是否安装了韩语语音后重试。");
    };
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }

  return (
    <div className="app-soft-card mt-4 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--support-surface)] text-[var(--support)]">
          <Headphones size={19} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold">播放听力材料</p>
          <p className="app-muted-text mt-1 text-xs leading-5">
            正常语速最多播放 2 次，慢速最多播放 1 次；听力原文不会直接显示。
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => play(1)}
          disabled={speaking || normalPlays >= 2}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Headphones size={15} aria-hidden="true" />
          正常语速（剩余 {Math.max(0, 2 - normalPlays)} 次）
        </button>
        <button
          type="button"
          onClick={() => play(0.72)}
          disabled={speaking || slowPlays >= 1}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-[var(--support)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Gauge size={15} aria-hidden="true" />
          慢速（剩余 {Math.max(0, 1 - slowPlays)} 次）
        </button>
        {speaking && (
          <button
            type="button"
            onClick={stop}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold text-[var(--status-warning)]"
          >
            <Square size={14} aria-hidden="true" />停止播放
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs font-bold text-[var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  );
}
