import { X } from "lucide-react";
import type { ChangeEvent as ReactChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { TeachingBlackboardElement, TeachingBlackboardSlide } from "@/lib/teaching-blackboard";

const backgroundClass = {
  plain: "bg-[var(--card)]",
  warm: "bg-[color-mix(in_srgb,var(--status-warning)_7%,var(--card))]",
  grid: "bg-[var(--card)] bg-[linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] bg-[size:24px_24px]",
} as const;

const toneClass = {
  default: "text-[var(--foreground)]",
  primary: "text-[var(--primary)]",
  highlight: "text-[var(--status-warning)]",
  muted: "text-[var(--foreground-muted)]",
} as const;

export const BLACKBOARD_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
export type BlackboardResizeHandle = typeof BLACKBOARD_RESIZE_HANDLES[number];

/** Position + resize-cursor for each handle, expressed as an offset from the
 * element box's own edges (they sit half outside the box so they stay
 * reachable even on a box sized down to its content). */
const resizeHandleClass: Record<BlackboardResizeHandle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

function blackboardMediaSrc(objectKey: string) {
  return `/api/learning-agent/blackboard-media?key=${encodeURIComponent(objectKey)}`;
}

/** Grows the edit textarea to fit its content instead of stretching to fill
 * the whole element box — the box can be taller than one line of text, and a
 * textarea stuck at full height made editing feel like typing into an empty
 * void. */
function autosizeTextarea(node: HTMLTextAreaElement | null) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

function BlackboardElementContent({ element }: { element: TeachingBlackboardElement }) {
  if (element.type === "image") {
    if (!element.content) {
      return <div className="flex h-full w-full items-center justify-center border border-dashed border-current text-[0.6em] opacity-60">尚未上传图片</div>;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, dynamically-sized R2 object served through an authenticated route, not a build-time-known asset.
      <img src={blackboardMediaSrc(element.content)} alt="" className="h-full w-full object-cover" draggable={false} />
    );
  }
  if (element.type === "video") {
    if (!element.content) {
      return <div className="flex h-full w-full items-center justify-center border border-dashed border-current text-[0.6em] opacity-60">尚未上传视频</div>;
    }
    return (
      // Stop the native player's own clicks (play/seek/volume) from also
      // being read as a drag-to-move gesture on the wrapping box.
      <video src={blackboardMediaSrc(element.content)} controls onPointerDown={(event) => event.stopPropagation()} className="h-full w-full object-contain" />
    );
  }
  if (element.type === "bullets") {
    const items = element.content.split("\n").map((item) => item.trim()).filter(Boolean);
    return (
      <ul className="grid gap-[0.34em]">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex min-w-0 items-start gap-[0.55em]">
            <span className="mt-[0.42em] h-[0.38em] w-[0.38em] shrink-0 rounded-full bg-current" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (element.type === "expression") {
    return (
      <div>
        <p lang="ko" className="whitespace-pre-line">{element.content}</p>
        {element.translation ? <p className="mt-[0.35em] text-[0.58em] font-medium leading-snug text-[var(--foreground-muted)]">{element.translation}</p> : null}
      </div>
    );
  }
  return <p className="whitespace-pre-line">{element.content}</p>;
}

export function TeachingBlackboardSlideView({
  slide,
  className = "",
  selectedElementId,
  editingElementId,
  onElementPointerDown,
  onElementClick,
  onElementDoubleClick,
  onElementKeyDown,
  onElementDelete,
  onElementContentChange,
  onElementEditBlur,
  onElementResizeStart,
}: {
  slide: TeachingBlackboardSlide;
  className?: string;
  selectedElementId?: string | null;
  /** Which element (if any) is showing its content as an editable textarea
   * directly in the box, instead of its normal styled rendering. */
  editingElementId?: string | null;
  onElementPointerDown?: (event: ReactPointerEvent<HTMLDivElement>, element: TeachingBlackboardElement) => void;
  onElementClick?: (element: TeachingBlackboardElement) => void;
  /** Enters inline edit mode for this element. */
  onElementDoubleClick?: (element: TeachingBlackboardElement) => void;
  onElementKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>, element: TeachingBlackboardElement) => void;
  /** Shows a small delete button directly on the selected element's box. */
  onElementDelete?: (element: TeachingBlackboardElement) => void;
  onElementContentChange?: (element: TeachingBlackboardElement, content: string) => void;
  onElementEditBlur?: () => void;
  /** Shows drag handles on the selected element's box, one per edge/corner. */
  onElementResizeStart?: (event: ReactPointerEvent<HTMLDivElement>, element: TeachingBlackboardElement, handle: BlackboardResizeHandle) => void;
}) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden border border-[var(--border-subtle)] ${backgroundClass[slide.background]} ${className}`} style={{ containerType: "inline-size" }}>
      {slide.elements.map((element) => {
        const isEditing = editingElementId === element.id;
        return (
        <div
          key={element.id}
          className={`absolute ${onElementPointerDown && !isEditing ? "cursor-move touch-none select-none" : ""} ${selectedElementId === element.id ? "outline outline-2 outline-offset-2 outline-[var(--primary)]" : ""}`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.width}%`,
            height: `${element.height}%`,
            fontSize: `${element.fontSize / 8}cqw`,
            fontWeight: element.fontWeight,
            textAlign: element.align,
          }}
          onPointerDown={onElementPointerDown && !isEditing ? (event) => onElementPointerDown(event, element) : undefined}
          onClick={onElementClick ? () => onElementClick(element) : undefined}
          onDoubleClick={onElementDoubleClick ? (event) => { event.stopPropagation(); onElementDoubleClick(element); } : undefined}
          onKeyDown={onElementKeyDown ? (event) => onElementKeyDown(event, element) : undefined}
          role={onElementClick ? "button" : undefined}
          tabIndex={onElementClick ? 0 : undefined}
          aria-label={onElementClick
            ? element.type === "image" || element.type === "video"
              ? `${element.type === "image" ? "图片" : "视频"}：${element.content || "尚未设置对象键"}`
              : `${element.type === "bullets" ? "要点" : element.type === "expression" ? "韩语例句" : "文字"}：${element.content.slice(0, 40) || "空内容"}`
            : undefined}
        >
          <div className={`h-full w-full overflow-hidden leading-[1.34] ${toneClass[element.tone]}`}>
            {isEditing ? (
              <textarea
                autoFocus
                ref={autosizeTextarea}
                value={element.content}
                onChange={(event: ReactChangeEvent<HTMLTextAreaElement>) => { autosizeTextarea(event.currentTarget); onElementContentChange?.(element, event.target.value); }}
                onBlur={() => onElementEditBlur?.()}
                onFocus={(event) => { event.currentTarget.select(); autosizeTextarea(event.currentTarget); }}
                onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") event.currentTarget.blur(); }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                aria-label="编辑黑板文字"
                className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
                style={{ font: "inherit", color: "inherit", textAlign: "inherit", lineHeight: "inherit", maxHeight: "100%" }}
              />
            ) : <BlackboardElementContent element={element} />}
          </div>
          {onElementDelete && selectedElementId === element.id && !isEditing ? (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onElementDelete(element); }}
              aria-label="删除这个黑板内容"
              className="absolute right-0 top-0 z-20 flex h-[5cqw] max-h-6 min-h-4 w-[5cqw] max-w-6 min-w-4 items-center justify-center rounded-bl bg-[var(--status-danger)] text-[var(--card)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <X className="h-[60%] w-[60%]" aria-hidden="true" />
            </button>
          ) : null}
          {onElementResizeStart && selectedElementId === element.id && !isEditing ? BLACKBOARD_RESIZE_HANDLES.map((handle) => (
            <div
              key={handle}
              onPointerDown={(event) => { event.stopPropagation(); onElementResizeStart(event, element, handle); }}
              aria-hidden="true"
              className={`absolute z-10 h-2.5 w-2.5 touch-none rounded-full border-2 border-[var(--card)] bg-[var(--primary)] ${resizeHandleClass[handle]}`}
            />
          )) : null}
        </div>
        );
      })}
    </div>
  );
}
