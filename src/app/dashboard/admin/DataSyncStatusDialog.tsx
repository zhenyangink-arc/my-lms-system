"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, RefreshCw, X } from "lucide-react";

type SyncIssue = {
  label: string;
  message: string;
};

export function DataSyncStatusDialog({ checkedCount, issues }: { checkedCount: number; issues: SyncIssue[] }) {
  const [open, setOpen] = useState(false);
  const isHealthy = issues.length === 0;

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
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold transition-colors ${isHealthy ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
      >
        {isHealthy ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
        {isHealthy ? "数据同步正常" : `${issues.length} 项数据异常`}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="sync-status-title" className="app-card w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
            <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)", backgroundColor: isHealthy ? "#f0fdf4" : "#fffbeb" }}>
              <div className="flex items-center gap-2.5">
                <span className={`flex size-8 items-center justify-center rounded-full ${isHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{isHealthy ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}</span>
                <div><h2 id="sync-status-title" className="text-xs font-semibold">{isHealthy ? "数据同步正常" : "发现数据同步异常"}</h2><p className="app-muted-text mt-0.5 text-[9px]">已检查当前身份可访问的 {checkedCount} 个数据来源</p></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭弹窗" className="flex size-7 items-center justify-center rounded-md border hover:bg-black/[0.025]"><X size={13} /></button>
            </header>

            <div className="max-h-[58vh] overflow-y-auto">
              {isHealthy ? (
                <div className="px-5 py-10 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={22} /><p className="app-muted-text mt-3 text-[9px]">首页数据已按当前账号的数据范围完成检查。</p></div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {issues.map((issue) => <div key={issue.label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3 text-[9px]"><span className="font-semibold text-amber-800">{issue.label}</span><span className="app-muted-text break-words">{issue.message}</span></div>)}
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[9px] font-semibold hover:bg-black/[0.025]"><RefreshCw size={11} />重新检查</button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
