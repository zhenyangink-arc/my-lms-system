"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { LiveNote, LivePoint, LiveStroke } from "./live-realtime";

const BOOK_WIDTH = 1180;
const BOOK_HEIGHT = 822;

type LiveCanvasProps = {
  page: number;
  editable: boolean;
  tool: "pen" | "note";
  color: string;
  width: number;
  strokes: LiveStroke[];
  notes: LiveNote[];
  onStrokeComplete: (stroke: LiveStroke) => void;
  onNoteAdd: (note: LiveNote) => void;
};

/** 画笔/批注覆盖层：渲染在电子书 1180×822 坐标空间内，与翻页书天然对齐。 */
export function LiveCanvas({
  page,
  editable,
  tool,
  color,
  width,
  strokes,
  notes,
  onStrokeComplete,
  onNoteAdd,
}: LiveCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drawing, setDrawing] = useState<LiveStroke | null>(null);
  const [noteDraft, setNoteDraft] = useState<LivePoint | null>(null);
  const [noteText, setNoteText] = useState("");

  const toBookPoint = (event: ReactPointerEvent): LivePoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * BOOK_WIDTH) / rect.width,
      y: ((event.clientY - rect.top) * BOOK_HEIGHT) / rect.height,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable) return;
    // 忽略来自批注输入框/气泡内部（foreignObject 里的 HTML 元素）的 pointerdown，
    // 否则点击"取消/确定"会把输入框移动到按钮位置。
    if (!(event.target instanceof SVGElement)) return;
    if (tool === "note") {
      setNoteDraft(toBookPoint(event));
      setNoteText("");
      return;
    }
    if (tool !== "pen") return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    const point = toBookPoint(event);
    setDrawing({ id: crypto.randomUUID(), points: [point], color, width });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable || tool !== "pen" || !drawing) return;
    const point = toBookPoint(event);
    setDrawing((current) =>
      current ? { ...current, points: [...current.points, point] } : current
    );
  };

  const handlePointerUp = () => {
    if (!editable || tool !== "pen" || !drawing) return;
    const finished = drawing;
    setDrawing(null);
    if (finished.points.length > 0) onStrokeComplete(finished);
  };

  const submitNote = () => {
    const text = noteText.trim();
    if (!noteDraft || !text) {
      setNoteDraft(null);
      return;
    }
    onNoteAdd({ id: crypto.randomUUID(), x: noteDraft.x, y: noteDraft.y, text });
    setNoteDraft(null);
  };

  const renderStrokes = (items: LiveStroke[]) =>
    items.map((stroke) => (
      <polyline
        key={stroke.id}
        points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={stroke.color}
        strokeWidth={stroke.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOOK_WIDTH} ${BOOK_HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 z-30"
      style={{
        pointerEvents: editable && (tool === "pen" || tool === "note") ? "auto" : "none",
        cursor: editable ? (tool === "note" ? "crosshair" : "crosshair") : "default",
        touchAction: "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 已完成笔迹（当前页） */}
      {renderStrokes(strokes)}
      {/* 正在绘制的笔迹 */}
      {drawing && <polyline
        points={drawing.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={drawing.color}
        strokeWidth={drawing.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />}
      {/* 文字批注 */}
      {notes.map((note) => (
        <g key={note.id}>
          <circle cx={note.x} cy={note.y} r={7} fill="#e8590c" opacity={0.9} />
          <foreignObject
            x={Math.min(Math.max(note.x + 10, 0), BOOK_WIDTH - 220)}
            y={Math.min(Math.max(note.y - 12, 0), BOOK_HEIGHT - 70)}
            width={210}
            height="auto"
          >
            <div
              className="rounded-lg border border-orange-200 bg-white/95 px-2.5 py-1.5 text-xs font-semibold leading-5 text-slate-800 shadow-md"
              style={{ minHeight: 28 }}
            >
              {note.text}
            </div>
          </foreignObject>
        </g>
      ))}
      {/* 新增批注输入框 */}
      {noteDraft && (
        <foreignObject
          x={Math.min(Math.max(noteDraft.x + 10, 0), BOOK_WIDTH - 240)}
          y={Math.min(Math.max(noteDraft.y - 12, 0), BOOK_HEIGHT - 110)}
          width={230}
          height={100}
        >
          <div className="rounded-lg border border-orange-300 bg-white p-2 shadow-lg">
            <textarea
              autoFocus
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submitNote();
                if (event.key === "Escape") setNoteDraft(null);
              }}
              placeholder="输入讲解文字…"
              className="h-14 w-full resize-none rounded-md border border-slate-200 px-2 py-1 text-xs leading-4 outline-none focus:border-orange-400"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setNoteDraft(null)}
                className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitNote}
                className="rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-orange-600"
              >
                确定
              </button>
            </div>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
