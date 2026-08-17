"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { CourseTreePayload } from "@/app/dashboard/CourseListDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";

type View = { slug: string; title: string };

const HomeTreeGraphPreview = dynamic(
  () =>
    import("./HomeTreeGraphPreview").then(
      (module) => module.HomeTreeGraphPreview
    ),
  {
    loading: () => (
      <div
        className="flex h-full items-center justify-center text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-semibold app-muted-text">
          正在加载课程树图形…
        </p>
      </div>
    ),
  }
);

/**
 * 课程树视图 tab：点击弹出对话框预览该视图下的课程树（不再做页面跳转）。
 */
export function HomeTreeViewTabs({
  views,
  active,
  tree,
}: {
  views: View[];
  active: string;
  tree: CourseTreePayload;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="inline-flex flex-wrap gap-1 rounded-lg p-1"
        style={{ backgroundColor: "var(--surface-soft)" }}
      >
        {views.map((v) => {
          const isActive = v.slug === active;
          return (
            <button
              key={v.slug}
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md px-3 py-1.5 text-xs font-bold transition"
              style={{
                backgroundColor: isActive ? "var(--card)" : "transparent",
                color: isActive ? "var(--foreground)" : "var(--foreground-muted)",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {v.title}
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="bg-black/5"
          className="!max-w-[960px] gap-0 rounded-[20px] p-0 app-glass-panel overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen size={18} style={{ color: "var(--primary)" }} />
              {views.find((v) => v.slug === active)?.title ?? "课程树"} · 预览
            </DialogTitle>
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                color: "var(--primary-hover)",
                backgroundColor: "var(--accent)",
              }}
            >
              {tree.nodes.length} 节点
            </span>
          </div>

          <div className="px-4 pb-4">
            <div
              className="h-[480px] overflow-hidden rounded-2xl border"
              style={{ borderColor: "var(--border)" }}
            >
              {tree.nodes.length > 0 ? (
                open && <HomeTreeGraphPreview tree={tree} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm font-semibold">该视图还没有课程</p>
                  <p className="mt-1 text-xs app-muted-text">
                    打开下面的开关后，课程会出现在这里
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t px-6 py-3 app-divider">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl py-2 text-xs font-bold transition hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
              style={{ color: "var(--foreground-muted)" }}
            >
              关闭
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
