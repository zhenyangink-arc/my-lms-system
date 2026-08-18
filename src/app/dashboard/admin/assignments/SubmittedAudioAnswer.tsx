"use client";

import { useRef, useState } from "react";

const playbackRates = [0.8, 1, 1.25] as const;

export function SubmittedAudioAnswer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState<number>(1);

  function changeRate(nextRate: number) {
    setRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }

  return (
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold">学生口语录音</p>
      <audio
        ref={audioRef}
        controls
        preload="none"
        src={src}
        className="h-10 max-w-full"
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="录音播放速度">
        <span className="app-muted-text text-xs">播放速度</span>
        {playbackRates.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={rate === value}
            onClick={() => changeRate(value)}
            className={`min-h-10 rounded-lg border px-3 text-xs font-bold ${
              rate === value
                ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]"
                : "app-card"
            }`}
          >
            {value}×
          </button>
        ))}
      </div>
    </div>
  );
}
