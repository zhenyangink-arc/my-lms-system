"use client";

import { Info } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type DashboardTitleWithHintProps = {
  title: ReactNode;
  description: ReactNode;
  className?: string;
  titleClassName?: string;
  headingLevel?: 1 | 2 | 3 | 4;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_WIDTH = 320;
const VIEWPORT_GAP = 8;

export function DashboardTitleWithHint({
  title,
  description,
  className = "",
  titleClassName = "text-2xl font-black tracking-tight",
  headingLevel = 1,
}: DashboardTitleWithHintProps) {
  const Heading =
    headingLevel === 4 ? "h4" : headingLevel === 3 ? "h3" : headingLevel === 2 ? "h2" : "h1";
  const triggerRef = useRef<HTMLSpanElement>(null);
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

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <div
      className={`relative flex w-fit max-w-full items-center justify-start gap-1.5 text-left ${className}`}
    >
      <Heading className={`min-w-0 text-left ${titleClassName}`}>{title}</Heading>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label="查看说明"
        aria-describedby={isOpen ? tooltipId : undefined}
        onMouseEnter={() => {
          updatePosition();
          setIsOpen(true);
        }}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => {
          updatePosition();
          setIsOpen(true);
        }}
        onBlur={() => setIsOpen(false)}
        className="app-muted-text flex shrink-0 cursor-help items-center justify-center self-center rounded-full outline-none focus-visible:ring-2"
      >
        <Info size={15} aria-hidden="true" />
      </span>
      {isOpen &&
        position &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            className="app-card pointer-events-none fixed z-[9999] block w-80 max-w-[calc(100vw-1rem)] rounded-2xl border p-3 text-xs leading-5 app-muted-text shadow-lg"
            style={{ left: position.left, top: position.top }}
          >
            {description}
          </span>,
          document.body,
        )}
    </div>
  );
}
