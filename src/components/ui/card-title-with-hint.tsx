"use client";

import { CircleAlert } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type CardTitleWithHintProps = {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleClassName?: string;
  hintClassName?: string;
  headingLevel?: 1 | 2 | 3 | 4;
  hintLabel?: string;
  tone?: "default" | "inverse";
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_WIDTH = 320;
const VIEWPORT_GAP = 8;

/**
 * Learning-card title pattern: keep the title visible and place supporting
 * context behind one small, accessible circular exclamation icon.
 */
export function CardTitleWithHint({
  title,
  description,
  className = "",
  titleClassName = "font-bold tracking-tight",
  hintClassName = "",
  headingLevel = 1,
  hintLabel = "查看详细说明",
  tone = "default",
}: CardTitleWithHintProps) {
  const Heading =
    headingLevel === 4 ? "h4" : headingLevel === 3 ? "h3" : headingLevel === 2 ? "h2" : "h1";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const availableWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
    const preferredLeft = rect.right + VIEWPORT_GAP;
    const left = Math.min(
      preferredLeft,
      Math.max(VIEWPORT_GAP, window.innerWidth - availableWidth - VIEWPORT_GAP),
    );
    const top = Math.min(Math.max(VIEWPORT_GAP, rect.top), window.innerHeight - VIEWPORT_GAP);

    setPosition({ left, top });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isOpen, updatePosition]);

  const openHint = () => {
    updatePosition();
    setIsOpen(true);
  };

  return (
    <div className={`card-title-with-hint flex w-fit max-w-full items-start gap-1.5 text-left ${className}`}>
      <Heading className={`card-title-heading min-w-0 text-left ${titleClassName}`}>{title}</Heading>
      {description ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            aria-label={hintLabel}
            aria-describedby={isOpen ? tooltipId : undefined}
            aria-expanded={isOpen}
            onMouseEnter={openHint}
            onMouseLeave={() => setIsOpen(false)}
            onFocus={openHint}
            onBlur={() => setIsOpen(false)}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                openHint();
              }
            }}
            className={`flex h-11 w-11 shrink-0 cursor-help items-start justify-center bg-transparent pt-1 outline-none transition focus-visible:rounded-full focus-visible:ring-2 ${
              tone === "inverse"
                ? "text-white/70 hover:text-white focus-visible:ring-white/70"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] focus-visible:ring-[var(--ring)]"
            } ${hintClassName}`}
          >
            <CircleAlert size={10} aria-hidden="true" />
          </button>
          {isOpen &&
            position &&
            createPortal(
              <span
                id={tooltipId}
                role="tooltip"
                className="app-card pointer-events-none fixed z-[9999] block w-80 max-w-[calc(100vw-1rem)] rounded-2xl border p-3 text-xs font-medium leading-5 text-[var(--foreground-secondary)] shadow-lg"
                style={{ left: position.left, top: position.top }}
              >
                {description}
              </span>,
              document.body,
            )}
        </>
      ) : null}
    </div>
  );
}
