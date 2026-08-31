import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

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

function BlackboardElementContent({ element }: { element: TeachingBlackboardElement }) {
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
  onElementPointerDown,
  onElementClick,
  onElementKeyDown,
}: {
  slide: TeachingBlackboardSlide;
  className?: string;
  selectedElementId?: string | null;
  onElementPointerDown?: (event: ReactPointerEvent<HTMLDivElement>, element: TeachingBlackboardElement) => void;
  onElementClick?: (element: TeachingBlackboardElement) => void;
  onElementKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>, element: TeachingBlackboardElement) => void;
}) {
  return (
    <div className={`relative aspect-video w-full overflow-hidden border border-[var(--border-subtle)] ${backgroundClass[slide.background]} ${className}`} style={{ containerType: "inline-size" }}>
      {slide.elements.map((element) => (
        <div
          key={element.id}
          className={`absolute overflow-hidden leading-[1.34] ${toneClass[element.tone]} ${onElementPointerDown ? "cursor-move touch-none select-none" : ""} ${selectedElementId === element.id ? "outline outline-2 outline-offset-2 outline-[var(--primary)]" : ""}`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.width}%`,
            height: `${element.height}%`,
            fontSize: `${element.fontSize / 8}cqw`,
            fontWeight: element.fontWeight,
            textAlign: element.align,
          }}
          onPointerDown={onElementPointerDown ? (event) => onElementPointerDown(event, element) : undefined}
          onClick={onElementClick ? () => onElementClick(element) : undefined}
          onKeyDown={onElementKeyDown ? (event) => onElementKeyDown(event, element) : undefined}
          role={onElementClick ? "button" : undefined}
          tabIndex={onElementClick ? 0 : undefined}
          aria-label={onElementClick ? `${element.type === "bullets" ? "要点" : element.type === "expression" ? "韩语例句" : "文字"}：${element.content.slice(0, 40) || "空内容"}` : undefined}
        >
          <BlackboardElementContent element={element} />
        </div>
      ))}
    </div>
  );
}
