"use client";

import { ReactNode, useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type LessonCollapsibleCardTone =
  | "default"
  | "indigo"
  | "blue"
  | "green"
  | "yellow"
  | "red";

type LessonCollapsibleCardProps = {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: LessonCollapsibleCardTone;
};

const toneAccentMap: Record<LessonCollapsibleCardTone, string> = {
  default: "var(--primary)",
  indigo: "var(--primary)",
  blue: "var(--primary)",
  green: "var(--status-success)",
  yellow: "var(--status-warning)",
  red: "var(--destructive)",
};

export function LessonCollapsibleCard({
  title,
  icon,
  children,
  defaultOpen = false,
  tone = "default",
}: LessonCollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const accentColor = toneAccentMap[tone] ?? toneAccentMap.default;
  const contentId = useId();

  return (
    <div className="app-card overflow-hidden rounded-2xl border shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--border)",
              color: accentColor,
            }}
          >
            {icon}
          </span>

          <span
            className="truncate text-sm font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {title}
          </span>
        </div>

        <ChevronDown
          aria-hidden="true"
          size={16}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--foreground-muted)" }}
        />
      </button>

      {open && (
        <div
          id={contentId}
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="border-l-2 pl-3"
            style={{ borderColor: accentColor }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
