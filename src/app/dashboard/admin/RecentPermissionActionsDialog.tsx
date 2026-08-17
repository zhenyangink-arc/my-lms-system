"use client";

import { useEffect, useState } from "react";
import { Activity, X } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";

const TIME_OPTIONS: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };

type PermissionAction = {
  label: string;
  action: "granted" | "revoked";
  time: string;
};

export function RecentPermissionActionsDialog({ actions }: { actions: PermissionAction[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-semibold transition-colors hover:bg-black/[0.025]"
      >
        <Activity size={12} />
        最近权限操作
        <span className="app-muted-text tabular-nums">{actions.length}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-permission-actions-title"
            className="app-card w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl"
          >
            <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <h2 id="recent-permission-actions-title" className="text-xs font-semibold">最近权限操作</h2>
                <p className="app-muted-text mt-0.5 text-[9px]">最近 {actions.length} 条平台权限变更记录</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭弹窗" className="flex size-7 items-center justify-center rounded-md border hover:bg-black/[0.025]"><X size={13} /></button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto">
              {actions.map((row, index) => (
                <div key={`${row.time}-${index}`} className="grid grid-cols-[minmax(0,1fr)_72px_100px] items-center border-b px-4 py-3 text-[9px] last:border-b-0" style={{ borderColor: "var(--border)" }}>
                  <span className="truncate font-semibold">{row.label}</span>
                  <span className={row.action === "granted" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{row.action === "granted" ? "已授权" : "已收回"}</span>
                  <span className="app-muted-text text-right tabular-nums"><LocalDateTime value={row.time} options={TIME_OPTIONS} /></span>
                </div>
              ))}
              {actions.length === 0 && <p className="app-muted-text px-4 py-10 text-center text-[9px]">暂时没有权限变更记录</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
