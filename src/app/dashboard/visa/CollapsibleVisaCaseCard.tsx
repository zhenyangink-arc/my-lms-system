"use client";

import { type ReactNode, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

export function CollapsibleVisaCaseCard({
  targetEntryDate,
  children,
}: {
  targetEntryDate: string | null;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <section className="app-card rounded-2xl border p-5">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
        <span><span className="app-muted-text block text-xs font-bold">签证档案</span><span className="mt-0.5 block text-lg font-bold">基础办理信息</span></span>
        <span className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 text-xs font-bold app-muted-text"><CalendarDays size={13} aria-hidden="true" />{targetEntryDate ?? "最晚入境日期待确认"}</span><ChevronDown size={18} aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </section>
  );
}
