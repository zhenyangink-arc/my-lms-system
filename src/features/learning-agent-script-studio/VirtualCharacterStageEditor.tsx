"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Move } from "lucide-react";

import {
  TEACHER_KIM_POSES,
  TEACHER_KIM_POSE_LABELS,
  type TeacherKimPose,
} from "@/lib/teacher-kim-character";

export type VirtualCharacterStagePerformance = {
  pose: TeacherKimPose;
  characterX: number;
  characterY: number;
  characterScale: number;
};

const inputClass = "app-input min-h-11 w-full border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65 sm:text-sm";

function lineLabel(line: string, index: number) {
  const plain = line.replace(/\[(?:\/?b|\/?u|\/?color(?:=[^\]]+)?)\]/gi, "").replace(/\s+/g, " ").trim();
  return `台词 ${index + 1}${plain ? `：${plain.slice(0, 24)}${plain.length > 24 ? "…" : ""}` : ""}`;
}

export function VirtualCharacterStageEditor({
  scriptLines,
  performances,
  selectedIndex,
  onSelectedIndexChange,
  onPerformanceChange,
  disabled,
  onDirty,
}: {
  scriptLines: string[];
  performances: VirtualCharacterStagePerformance[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onPerformanceChange: (index: number, patch: Partial<VirtualCharacterStagePerformance>) => void;
  disabled?: boolean;
  onDirty: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const safeIndex = Math.max(0, Math.min(performances.length - 1, selectedIndex));
  const performance = performances[safeIndex];
  if (!performance) return null;

  function moveToPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(10, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100));
    const pointerY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    const y = Math.max(0, Math.min(30, (100 - pointerY) * 0.45));
    onPerformanceChange(safeIndex, { characterX: x, characterY: y });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    moveToPointer(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || disabled) return;
    moveToPointer(event);
  }

  function handlePointerEnd() {
    if (draggingRef.current) onDirty();
    draggingRef.current = false;
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 5 : 1;
    const patch = event.key === "ArrowLeft"
      ? { characterX: Math.max(10, performance.characterX - step) }
      : event.key === "ArrowRight"
        ? { characterX: Math.min(90, performance.characterX + step) }
        : event.key === "ArrowUp"
          ? { characterY: Math.min(30, performance.characterY + step) }
          : event.key === "ArrowDown"
            ? { characterY: Math.max(0, performance.characterY - step) }
            : null;
    if (!patch) return;
    event.preventDefault();
    onPerformanceChange(safeIndex, patch);
    onDirty();
  }

  return (
    <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(28rem,1fr)_16rem]">
      <div className="min-w-0 space-y-2">
        <div
          ref={stageRef}
          className="relative aspect-video w-full overflow-hidden border border-[var(--border)] bg-[linear-gradient(180deg,var(--surface-soft),var(--card))] shadow-sm"
        >
          <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--border)]" aria-hidden="true" />
          <div className="absolute left-3 top-3 max-w-[70%] border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)] shadow-sm">
            {lineLabel(scriptLines[safeIndex] ?? "", safeIndex)}
          </div>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleKeyDown}
            className="group absolute bottom-0 touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed"
            style={{
              left: `${performance.characterX}%`,
              bottom: `${performance.characterY}%`,
              height: `${76 * performance.characterScale}%`,
              aspectRatio: "1 / 2",
              transform: "translateX(-50%)",
            }}
            aria-label={`金老师，当前动作${TEACHER_KIM_POSE_LABELS[performance.pose]}。拖动或使用方向键调整位置，按住 Shift 可一次移动 5%。`}
          >
            <Image
              src={`/api/learning-agent/characters/${performance.pose}-idle`}
              alt=""
              fill
              sizes="(max-width: 1280px) 35vw, 20vw"
              unoptimized
              className="pointer-events-none object-contain drop-shadow-[0_12px_18px_rgba(15,23,42,0.16)]"
            />
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] text-[var(--foreground-secondary)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Move size={17} /></span>
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--foreground-muted)]">拖动金老师调整位置，也可以聚焦人物后使用方向键。人物位置和动作会随当前台词切换。</p>
      </div>

      <div className="space-y-3">
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="block font-semibold text-[var(--foreground)]">设置哪句台词</span>
          <select value={safeIndex} onChange={(event) => onSelectedIndexChange(Number(event.target.value))} disabled={disabled} className={inputClass}>
            {scriptLines.map((line, index) => <option key={index} value={index}>{lineLabel(line, index)}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="block font-semibold text-[var(--foreground)]">人物动作</span>
          <select value={performance.pose} onChange={(event) => { onPerformanceChange(safeIndex, { pose: event.target.value as TeacherKimPose }); onDirty(); }} disabled={disabled} className={inputClass}>
            {TEACHER_KIM_POSES.map((pose) => <option key={pose} value={pose}>{TEACHER_KIM_POSE_LABELS[pose]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">横向位置 %</span><input type="number" inputMode="numeric" min={10} max={90} value={Math.round(performance.characterX)} onChange={(event) => { onPerformanceChange(safeIndex, { characterX: Math.max(10, Math.min(90, Number(event.target.value) || 10)) }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
          <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">离底位置 %</span><input type="number" inputMode="numeric" min={0} max={30} value={Math.round(performance.characterY)} onChange={(event) => { onPerformanceChange(safeIndex, { characterY: Math.max(0, Math.min(30, Number(event.target.value) || 0)) }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="flex items-center justify-between gap-2 font-semibold text-[var(--foreground)]"><span>人物大小</span><span className="tabular-nums text-[var(--foreground-muted)]">{Math.round(performance.characterScale * 100)}%</span></span>
          <input type="range" min={75} max={125} step={5} value={Math.round(performance.characterScale * 100)} onChange={(event) => { onPerformanceChange(safeIndex, { characterScale: Number(event.target.value) / 100 }); onDirty(); }} disabled={disabled} className="min-h-11 w-full accent-[var(--primary)]" />
        </label>
        <button type="button" onClick={() => { onPerformanceChange(safeIndex, { characterX: 75, characterY: 0, characterScale: 1 }); onDirty(); }} disabled={disabled} className="inline-flex min-h-11 w-full items-center justify-center border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50">恢复默认位置</button>
      </div>
    </div>
  );
}
