"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minimize2, Move } from "lucide-react";

import {
  TEACHER_KIM_POSES,
  TEACHER_KIM_POSE_LABELS,
  type TeacherKimPose,
} from "@/lib/teacher-kim-character";
import { TeachingBlackboardSlideView } from "@/components/learning-agent/TeachingBlackboardSlide";
import type { TeachingBlackboardSlide } from "@/lib/teaching-blackboard";
import {
  constrainTeachingBlackboardPlacementToViewport,
  defaultTeachingBlackboardPlacement,
  teachingBlackboardPlacementBounds,
  teachingVirtualCharacterPreviewGeometry,
  TEACHING_VIRTUAL_CHARACTER_STAGE,
  type TeachingBlackboardPlacement,
} from "@/lib/teaching-virtual-character";

const FALLBACK_VIEWPORT_SNAPSHOT = `${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportWidthPx}x${TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportHeightPx}`;

function currentViewportSnapshot() {
  return `${Math.round(window.innerWidth)}x${Math.round(window.innerHeight)}`;
}

function subscribeToViewport(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);
  document.addEventListener("fullscreenchange", onStoreChange);
  return () => {
    window.removeEventListener("resize", onStoreChange);
    document.removeEventListener("fullscreenchange", onStoreChange);
  };
}

function viewportFromSnapshot(snapshot: string) {
  const [width, height] = snapshot.split("x").map(Number);
  return {
    width: Number.isFinite(width) ? width : TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportWidthPx,
    height: Number.isFinite(height) ? height : TEACHING_VIRTUAL_CHARACTER_STAGE.preview.fallbackViewportHeightPx,
  };
}

export type VirtualCharacterStagePerformance = {
  pose: TeacherKimPose;
  characterX: number;
  characterY: number;
  characterScale: number;
  dialogueX: number;
  dialogueY: number;
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
  blackboardPlacement,
  selectedIndex,
  onSelectedIndexChange,
  onPerformanceChange,
  onBlackboardPlacementChange,
  disabled,
  onDirty,
}: {
  scriptLines: string[];
  performances: VirtualCharacterStagePerformance[];
  blackboardSlides: TeachingBlackboardSlide[];
  blackboardPlacement: TeachingBlackboardPlacement;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onPerformanceChange: (index: number, patch: Partial<VirtualCharacterStagePerformance>) => void;
  onBlackboardPlacementChange: (patch: Partial<TeachingBlackboardPlacement>) => void;
  disabled?: boolean;
  onDirty: () => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dialogueDraggingRef = useRef(false);
  const blackboardDraggingRef = useRef(false);
  const blackboardDragOffsetRef = useRef({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === editorRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const previewViewport = viewportFromSnapshot(useSyncExternalStore(
    subscribeToViewport,
    currentViewportSnapshot,
    () => FALLBACK_VIEWPORT_SNAPSHOT,
  ));

  const safeIndex = Math.max(0, Math.min(performances.length - 1, selectedIndex));
  const performance = performances[safeIndex];
  if (!performance) return null;
  const activeBlackboardSlide = [...blackboardSlides]
    .sort((left, right) => left.segmentIndex - right.segmentIndex)
    .filter((slide) => slide.segmentIndex <= safeIndex)
    .at(-1) ?? blackboardSlides[0] ?? null;
  const previewGeometry = teachingVirtualCharacterPreviewGeometry(previewViewport.width, previewViewport.height);
  const boundedBlackboardPlacement = constrainTeachingBlackboardPlacementToViewport(
    blackboardPlacement,
    previewViewport.width,
    previewViewport.height,
  );
  const blackboardBounds = teachingBlackboardPlacementBounds(
    previewViewport.width,
    previewViewport.height,
    boundedBlackboardPlacement.scale,
  );

  function updateBlackboardPlacement(patch: Partial<TeachingBlackboardPlacement>) {
    onBlackboardPlacementChange(constrainTeachingBlackboardPlacementToViewport(
      { ...boundedBlackboardPlacement, ...patch },
      previewViewport.width,
      previewViewport.height,
    ));
  }

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

  function moveDialogueToPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dialogueX = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const dialogueY = Math.max(5, Math.min(90, 100 - ((event.clientY - rect.top) / rect.height) * 100));
    onPerformanceChange(safeIndex, { dialogueX, dialogueY });
  }

  function handleDialoguePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dialogueDraggingRef.current = true;
    moveDialogueToPointer(event);
  }

  function handleDialoguePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dialogueDraggingRef.current || disabled) return;
    moveDialogueToPointer(event);
  }

  function handleDialoguePointerEnd() {
    if (dialogueDraggingRef.current) onDirty();
    dialogueDraggingRef.current = false;
  }

  function handleDialogueKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 5 : 1;
    const patch = event.key === "ArrowLeft"
      ? { dialogueX: Math.max(5, performance.dialogueX - step) }
      : event.key === "ArrowRight"
        ? { dialogueX: Math.min(95, performance.dialogueX + step) }
        : event.key === "ArrowUp"
          ? { dialogueY: Math.min(90, performance.dialogueY + step) }
          : event.key === "ArrowDown"
            ? { dialogueY: Math.max(5, performance.dialogueY - step) }
            : null;
    if (!patch) return;
    event.preventDefault();
    onPerformanceChange(safeIndex, patch);
    onDirty();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === editorRef.current) {
        await document.exitFullscreen();
        return;
      }
      await editorRef.current?.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // The browser can reject fullscreen when the user gesture is interrupted.
    }
  }

  function moveBlackboardToPointer(event: ReactPointerEvent<HTMLButtonElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left - blackboardDragOffsetRef.current.x) / rect.width) * 100;
    const y = ((event.clientY - rect.top - blackboardDragOffsetRef.current.y) / rect.height) * 100;
    updateBlackboardPlacement({ x, y });
  }

  function handleBlackboardPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    blackboardDraggingRef.current = true;
    blackboardDragOffsetRef.current = {
      x: event.clientX - (stageRect.left + stageRect.width * boundedBlackboardPlacement.x / 100),
      y: event.clientY - (stageRect.top + stageRect.height * boundedBlackboardPlacement.y / 100),
    };
  }

  function handleBlackboardPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!blackboardDraggingRef.current || disabled) return;
    moveBlackboardToPointer(event);
  }

  function handleBlackboardPointerEnd() {
    if (blackboardDraggingRef.current) onDirty();
    blackboardDraggingRef.current = false;
  }

  function handleBlackboardKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const step = event.shiftKey ? 5 : 1;
    const patch = event.key === "ArrowLeft"
      ? { x: boundedBlackboardPlacement.x - step }
      : event.key === "ArrowRight"
        ? { x: boundedBlackboardPlacement.x + step }
        : event.key === "ArrowUp"
          ? { y: boundedBlackboardPlacement.y - step }
          : event.key === "ArrowDown"
            ? { y: boundedBlackboardPlacement.y + step }
            : null;
    if (!patch) return;
    event.preventDefault();
    updateBlackboardPlacement(patch);
    onDirty();
  }

  return (
    <div ref={editorRef} className={`overflow-y-auto bg-[var(--background)] ${isFullscreen ? "h-screen" : ""}`}>
      <input type="hidden" name="blackboard_x" value={String(blackboardPlacement.x)} />
      <input type="hidden" name="blackboard_y" value={String(blackboardPlacement.y)} />
      <input type="hidden" name="blackboard_scale" value={String(blackboardPlacement.scale)} />
      <div className={`space-y-4 ${isFullscreen ? "p-0" : "px-4 py-4"}`}>
      {isFullscreen ? (
        <button type="button" onClick={() => void toggleFullscreen()} className="fixed right-3 top-3 z-50 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-3 text-xs font-bold text-[var(--foreground-secondary)] shadow-lg backdrop-blur-md hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
          <Minimize2 size={15} aria-hidden="true" />
          退出全屏
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] p-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--foreground)]">当前预览台词</p>
            <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">切换台词可检查对应的黑板画面、人物动作和站位。</p>
          </div>
          <div className="flex min-w-0 gap-2 sm:w-[min(38rem,60%)]">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">设置哪句台词</span>
              <select value={safeIndex} onChange={(event) => onSelectedIndexChange(Number(event.target.value))} disabled={disabled} className={inputClass}>
                {scriptLines.map((line, index) => <option key={index} value={index}>{lineLabel(line, index)}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void toggleFullscreen()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-bold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <Maximize2 size={15} aria-hidden="true" />
              放大全屏
            </button>
          </div>
        </div>
      )}
      {isFullscreen ? (
        <div className="fixed bottom-3 right-3 z-50 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] p-3 shadow-lg backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[var(--foreground)]">全屏舞台工具</p>
            <p className="text-[10px] text-[var(--foreground-muted)]">位置可直接拖动</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-semibold text-[var(--foreground-secondary)]">
              <span className="flex items-center justify-between gap-2"><span>黑板大小</span><span className="tabular-nums">{Math.round(boundedBlackboardPlacement.scale * 100)}%</span></span>
              <input type="range" min={Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumScale, blackboardBounds.maximumScale) * 100} max={blackboardBounds.maximumScale * 100} step={1} value={Math.round(boundedBlackboardPlacement.scale * 100)} onChange={(event) => { updateBlackboardPlacement({ scale: Number(event.target.value) / 100 }); onDirty(); }} disabled={disabled} className="min-h-8 w-full accent-[var(--primary)]" />
            </label>
            <label className="block space-y-1 text-xs font-semibold text-[var(--foreground-secondary)]">
              <span className="flex items-center justify-between gap-2"><span>老师大小</span><span className="tabular-nums">{Math.round(performance.characterScale * 100)}%</span></span>
              <input type="range" min={75} max={125} step={5} value={Math.round(performance.characterScale * 100)} onChange={(event) => { onPerformanceChange(safeIndex, { characterScale: Number(event.target.value) / 100 }); onDirty(); }} disabled={disabled} className="min-h-8 w-full accent-[var(--primary)]" />
            </label>
          </div>
        </div>
      ) : null}
      <div className="min-w-0 space-y-2">
        <div
          ref={stageRef}
          className={`relative w-full overflow-hidden border border-[var(--border)] bg-[color-mix(in_srgb,var(--status-warning)_3%,var(--card))] shadow-sm ${isFullscreen ? "rounded-none" : "rounded-xl"}`}
          style={{
            aspectRatio: previewGeometry.aspectRatio,
            containerType: "inline-size",
          }}
        >
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-[var(--border-subtle)] bg-[var(--card)]"
            style={{ height: `${previewGeometry.headerHeightPercent}%` }}
          >
            <span className="text-[clamp(0.6rem,1.7cqw,0.85rem)] font-bold text-[var(--foreground)]">教学区</span>
          </div>
          <div
            className="absolute flex items-center gap-[0.7cqw] text-[clamp(0.35rem,0.68cqw,0.58rem)] text-[var(--foreground-secondary)]"
            style={{
              left: `${previewGeometry.metadataLeftPercent}%`,
              top: `${previewGeometry.metadataTopPercent}%`,
              width: `${previewGeometry.blackboardWidthPercent}%`,
            }}
          >
            <span className="font-bold text-[var(--foreground-muted)]">当前教学</span>
            <span className="font-semibold">第 1 章 · 你好？</span>
            <span className="h-[0.8cqw] w-px bg-[var(--border-subtle)]" aria-hidden="true" />
            <span className="font-bold text-[var(--foreground)]">课前导航</span>
            {!isFullscreen ? <span className="ml-auto shrink-0 font-semibold text-[var(--primary)]">预览台词 {safeIndex + 1} / {scriptLines.length}</span> : null}
          </div>
          <div
            className="pointer-events-none absolute z-[5] overflow-hidden rounded-[1.1cqw] border border-[color-mix(in_srgb,var(--status-warning)_16%,var(--border-subtle))] bg-[var(--card)] shadow-[0_1.2cqw_3cqw_rgba(15,23,42,0.08)]"
            style={{
              left: `${boundedBlackboardPlacement.x}%`,
              top: `${boundedBlackboardPlacement.y}%`,
              width: `${previewGeometry.blackboardWidthPercent}%`,
              aspectRatio: "16 / 9",
              transform: `translateX(-50%) scale(${boundedBlackboardPlacement.scale})`,
              transformOrigin: "top center",
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
            onPointerDown={handleBlackboardPointerDown}
            onPointerMove={handleBlackboardPointerMove}
            onPointerUp={handleBlackboardPointerEnd}
            onPointerCancel={handleBlackboardPointerEnd}
            onKeyDown={handleBlackboardKeyDown}
            className="group absolute z-10 touch-none select-none rounded-[1.1cqw] border border-transparent bg-transparent cursor-move focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed"
            style={{
              left: `${boundedBlackboardPlacement.x}%`,
              top: `${boundedBlackboardPlacement.y}%`,
              width: `${previewGeometry.blackboardWidthPercent}%`,
              aspectRatio: "16 / 9",
              transform: `translateX(-50%) scale(${boundedBlackboardPlacement.scale})`,
              transformOrigin: "top center",
            }}
            aria-label="黑板。拖动或使用方向键调整位置，按住 Shift 可一次移动 5%。"
          >
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_90%,transparent)] text-[var(--foreground-secondary)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Move size={17} /></span>
          </button>
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
            <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] text-[var(--foreground-secondary)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Move size={17} /></span>
          </button>
          <button
            type="button"
            disabled={disabled}
            onPointerDown={handleDialoguePointerDown}
            onPointerMove={handleDialoguePointerMove}
            onPointerUp={handleDialoguePointerEnd}
            onPointerCancel={handleDialoguePointerEnd}
            onKeyDown={handleDialogueKeyDown}
            className="group absolute z-30 touch-none select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed"
            style={{ left: `${performance.dialogueX}%`, bottom: `${performance.dialogueY}%`, width: `${previewGeometry.bubbleWidthPercent}%`, transform: "translate(-50%, 50%)" }}
            aria-label="老师对话框。拖动或使用方向键调整位置，按住 Shift 可一次移动 5%。"
          >
            <span className="relative block rounded-[0.8cqw] border border-[color-mix(in_srgb,var(--status-warning)_20%,var(--border-subtle))] bg-[var(--card)] p-[0.65cqw] shadow-sm">
              <span className="flex min-w-0 items-center justify-between gap-[0.45cqw]"><span className="truncate text-[0.66cqw] font-bold leading-none">UPLY 韩语-金老师</span><span className="shrink-0 text-[0.54cqw] font-bold text-[var(--status-success)]">台词预览</span></span>
              <span className="mt-[0.5cqw] block whitespace-pre-line text-[0.62cqw] font-normal leading-[1.55] text-[var(--foreground-secondary)]">{plainScriptLine(scriptLines[safeIndex] ?? "") || "这句台词还没有内容"}</span>
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true"><Move size={14} /></span>
            </span>
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--foreground-muted)]">画布对应学生端完整教学区。可以拖动黑板、金老师和对话框调整位置，也可以聚焦后使用方向键；按住 Shift 可一次移动 5%。</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="mb-3 text-sm font-bold text-[var(--foreground)]">金老师</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="mb-3 text-sm font-bold text-[var(--foreground)]">黑板</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">横向位置 %</span><input type="number" inputMode="numeric" min={Math.ceil(blackboardBounds.minimumXPercent)} max={Math.floor(blackboardBounds.maximumXPercent)} value={Math.round(boundedBlackboardPlacement.x)} onChange={(event) => { updateBlackboardPlacement({ x: Number(event.target.value) || blackboardBounds.minimumXPercent }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
            <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">距顶部 %</span><input type="number" inputMode="numeric" min={Math.ceil(blackboardBounds.minimumTopPercent)} max={Math.floor(blackboardBounds.maximumTopPercent)} value={Math.round(boundedBlackboardPlacement.y)} onChange={(event) => { updateBlackboardPlacement({ y: Number(event.target.value) || 0 }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium xl:col-span-2">
            <span className="flex items-center justify-between gap-2 font-semibold text-[var(--foreground)]"><span>黑板大小</span><span className="tabular-nums text-[var(--foreground-muted)]">{Math.round(boundedBlackboardPlacement.scale * 100)}%</span></span>
            <input type="range" min={Math.min(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumScale, blackboardBounds.maximumScale) * 100} max={blackboardBounds.maximumScale * 100} step={1} value={Math.round(boundedBlackboardPlacement.scale * 100)} onChange={(event) => { updateBlackboardPlacement({ scale: Number(event.target.value) / 100 }); onDirty(); }} disabled={disabled} className="min-h-11 w-full accent-[var(--primary)]" />
          </label>
          <button type="button" onClick={() => { onBlackboardPlacementChange(defaultTeachingBlackboardPlacement()); onDirty(); }} disabled={disabled} className="inline-flex min-h-11 w-full self-end items-center justify-center border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50">恢复黑板默认位置</button>
        </div>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <p className="mb-3 text-sm font-bold text-[var(--foreground)]">老师对话框</p>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">横向位置 %</span><input type="number" min={5} max={95} value={Math.round(performance.dialogueX)} onChange={(event) => { onPerformanceChange(safeIndex, { dialogueX: Math.max(5, Math.min(95, Number(event.target.value) || 5)) }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
          <label className="block space-y-1.5 text-sm font-medium"><span className="block font-semibold text-[var(--foreground)]">离教学区底部 %</span><input type="number" min={5} max={90} value={Math.round(performance.dialogueY)} onChange={(event) => { onPerformanceChange(safeIndex, { dialogueY: Math.max(5, Math.min(90, Number(event.target.value) || 5)) }); onDirty(); }} disabled={disabled} className={inputClass} /></label>
          <button type="button" onClick={() => { onPerformanceChange(safeIndex, { dialogueX: Math.min(92, performance.characterX + 10), dialogueY: Math.min(90, performance.characterY + 30) }); onDirty(); }} disabled={disabled} className="inline-flex min-h-11 self-end items-center justify-center border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-50">放回老师旁边</button>
        </div>
      </div>
      </div>
    </div>
  );
}
