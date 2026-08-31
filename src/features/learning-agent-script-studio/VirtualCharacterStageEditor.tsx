"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Move } from "lucide-react";

import {
  TEACHER_KIM_POSES,
  TEACHER_KIM_POSE_LABELS,
  type TeacherKimPose,
} from "@/lib/teacher-kim-character";
import { TeachingBlackboardSlideView } from "@/components/learning-agent/TeachingBlackboardSlide";
import type { TeachingBlackboardSlide } from "@/lib/teaching-blackboard";
import { TEACHING_VIRTUAL_CHARACTER_STAGE } from "@/lib/teaching-virtual-character";

export type VirtualCharacterStagePerformance = {
  pose: TeacherKimPose;
  characterX: number;
  characterY: number;
  characterScale: number;
};

const inputClass = "app-input min-h-11 w-full border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-65 sm:text-sm";

function lineLabel(line: string, index: number) {
  const plain = plainScriptLine(line);
  return `台词 ${index + 1}${plain ? `：${plain.slice(0, 24)}${plain.length > 24 ? "…" : ""}` : ""}`;
}

function plainScriptLine(line: string) {
  return line.replace(/\[(?:\/?b|\/?u|\/?color(?:=[^\]]+)?)\]/gi, "").replace(/\s+/g, " ").trim();
}

export function VirtualCharacterStageEditor({
  scriptLines,
  performances,
  blackboardSlides,
  selectedIndex,
  onSelectedIndexChange,
  onPerformanceChange,
  disabled,
  onDirty,
}: {
  scriptLines: string[];
  performances: VirtualCharacterStagePerformance[];
  blackboardSlides: TeachingBlackboardSlide[];
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
  const activeBlackboardSlide = [...blackboardSlides]
    .sort((left, right) => left.segmentIndex - right.segmentIndex)
    .filter((slide) => slide.segmentIndex <= safeIndex)
    .at(-1) ?? blackboardSlides[0] ?? null;

  function moveToPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(10, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100));
    const pointerY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    const y = Math.max(0, Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent, 100 - pointerY));
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
          ? { characterY: Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent, performance.characterY + step) }
          : event.key === "ArrowDown"
            ? { characterY: Math.max(0, performance.characterY - step) }
            : null;
    if (!patch) return;
    event.preventDefault();
    onPerformanceChange(safeIndex, patch);
    onDirty();
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="min-w-0 space-y-2">
        <div
          ref={stageRef}
          className="relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--status-warning)_3%,var(--card))] shadow-sm"
          style={{
            aspectRatio: TEACHING_VIRTUAL_CHARACTER_STAGE.preview.aspectRatio,
            containerType: "inline-size",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-[var(--border-subtle)] bg-[var(--card)]"
            style={{ height: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.headerHeightPercent}%` }}
          >
            <span className="text-[clamp(0.6rem,1.7cqw,0.85rem)] font-bold text-[var(--foreground)]">教学区</span>
          </div>
          <div
            className="absolute flex items-center gap-[0.7cqw] text-[clamp(0.35rem,0.68cqw,0.58rem)] text-[var(--foreground-secondary)]"
            style={{
              left: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.metadataLeftPercent}%`,
              top: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.metadataTopPercent}%`,
              maxWidth: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.blackboardWidthPercent}%`,
            }}
          >
            <span className="font-bold text-[var(--foreground-muted)]">当前教学</span>
            <span className="font-semibold">第 1 章 · 你好？</span>
            <span className="h-[0.8cqw] w-px bg-[var(--border-subtle)]" aria-hidden="true" />
            <span className="font-bold text-[var(--foreground)]">课前导航</span>
          </div>
          <div
            className="absolute overflow-hidden rounded-[1.1cqw] border border-[color-mix(in_srgb,var(--status-warning)_16%,var(--border-subtle))] bg-[var(--card)] shadow-[0_1.2cqw_3cqw_rgba(15,23,42,0.08)]"
            style={{
              left: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.blackboardLeftPercent}%`,
              top: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.blackboardTopPercent}%`,
              width: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.blackboardWidthPercent}%`,
              aspectRatio: "16 / 9",
            }}
          >
            {activeBlackboardSlide ? (
              <TeachingBlackboardSlideView slide={activeBlackboardSlide} className="absolute inset-0 border-0" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--foreground-muted)]">当前台词还没有黑板画面</div>
            )}
          </div>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onKeyDown={handleKeyDown}
            className="group absolute bottom-0 z-20 touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed"
            style={{
              left: `${performance.characterX}%`,
              bottom: `${performance.characterY}%`,
              height: `${TEACHING_VIRTUAL_CHARACTER_STAGE.characterHeightPercent}%`,
              aspectRatio: "1 / 2",
              transform: `translateX(-50%) scale(${performance.characterScale})`,
              transformOrigin: "bottom center",
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
            <span
              className="pointer-events-none absolute bottom-[54%] left-full z-30 ml-[0.55cqw] block w-max text-left"
              style={{ maxWidth: `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.bubbleWidthPercent}cqw` }}
            >
              <span className="relative block rounded-[0.8cqw] border border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)] p-[0.65cqw] shadow-sm">
                <span className="absolute bottom-[1.5cqw] left-[-0.55cqw] h-[1.1cqw] w-[1.1cqw] rotate-45 border-b border-l border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)]" aria-hidden="true" />
                <span className="flex min-w-0 items-center justify-between gap-[0.45cqw]">
                  <span className="truncate text-[0.66cqw] font-bold leading-none text-[var(--foreground)]">UPLY 韩语-金老师</span>
                  <span className="shrink-0 text-[0.54cqw] font-bold leading-none text-[var(--status-success)]">台词预览</span>
                </span>
                <span className="mt-[0.5cqw] block whitespace-pre-line text-[0.62cqw] font-normal leading-[1.55] text-[var(--foreground-secondary)]">
                  {plainScriptLine(scriptLines[safeIndex] ?? "") || "这句台词还没有内容"}
                </span>
              </span>
            </span>
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] text-[var(--foreground-secondary)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Move size={17} /></span>
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--foreground-muted)]">画布对应学生端完整教学区。拖动金老师调整位置，也可以聚焦人物后使用方向键；人物位置和动作会随当前台词切换。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
          <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">离教学区底部 %</span><input type="number" inputMode="numeric" min={0} max={TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent} value={Math.round(performance.characterY)} onChange={(event) => { onPerformanceChange(safeIndex, { characterY: Math.max(0, Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent, Number(event.target.value) || 0)) }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span className="flex items-center justify-between gap-2 font-semibold text-[var(--foreground)]"><span>人物大小</span><span className="tabular-nums text-[var(--foreground-muted)]">{Math.round(performance.characterScale * 100)}%</span></span>
          <input type="range" min={75} max={125} step={5} value={Math.round(performance.characterScale * 100)} onChange={(event) => { onPerformanceChange(safeIndex, { characterScale: Number(event.target.value) / 100 }); onDirty(); }} disabled={disabled} className="min-h-11 w-full accent-[var(--primary)]" />
        </label>
        <button type="button" onClick={() => { onPerformanceChange(safeIndex, { characterX: 75, characterY: 0, characterScale: 1 }); onDirty(); }} disabled={disabled} className="inline-flex min-h-11 w-full self-end items-center justify-center border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50">恢复默认位置</button>
      </div>
    </div>
  );
}
