"use client";

import { ReactNode, useState } from "react";
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
  default: "var(--app-accent)",
  indigo: "#6366f1",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#d97706",
  red: "#dc2626",
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

  return (
    <div className="app-card overflow-hidden rounded-2xl border shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: "var(--app-soft-bg)",
              borderColor: "var(--app-border)",
              color: accentColor,
            }}
          >
            {icon}
          </span>

          <span
            className="truncate text-sm font-bold"
            style={{ color: "var(--app-text)" }}
          >
            {title}
          </span>
        </div>

        <ChevronDown
          size={16}
          className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--app-muted)" }}
        />
      </button>

      {open && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--app-border)" }}
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