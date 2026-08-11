"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * 表格内的可折叠分组行：一个跨列的分组表头 + 组内行。
 * 点击分组表头即可展开/收起该组。
 */
export function AccountGroup({
  label,
  count,
  defaultExpanded = true,
  colSpan,
  children,
}: {
  label: string;
  count: number;
  defaultExpanded?: boolean;
  colSpan: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <>
      <tr className="border-b" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>
        <td colSpan={colSpan} className="px-0 py-0">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11px] font-semibold transition hover:bg-black/[0.02]"
          >
            <ChevronRight size={13} className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
            <span>{label}</span>
            <span className="app-muted-text font-medium">{count} 人</span>
          </button>
        </td>
      </tr>
      {expanded && children}
    </>
  );
}
