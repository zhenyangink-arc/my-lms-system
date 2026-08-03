"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export function HomeworkCollapsibleTableGroup({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <tbody>
      <tr
        className="border-b"
        style={{
          borderColor: "var(--app-border-soft)",
          backgroundColor: "color-mix(in srgb, var(--app-soft-bg) 54%, white)",
        }}
      >
        <td colSpan={9} className="p-0">
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            className="relative flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--app-soft-bg)]"
          >
            {isOpen && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[22px] top-1/2 border-l"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--app-muted) 38%, transparent)",
                }}
              />
            )}
            <ChevronRight
              size={14}
              className={`app-muted-text shrink-0 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
            />
            <span className="text-xs font-bold">{title}</span>
            <span className="app-muted-text text-xs">{subtitle}</span>
            <span className="app-muted-text ml-auto font-mono text-[11px] tabular-nums">
              {count} 个章节作业
            </span>
          </button>
        </td>
      </tr>
      {isOpen && children}
    </tbody>
  );
}
