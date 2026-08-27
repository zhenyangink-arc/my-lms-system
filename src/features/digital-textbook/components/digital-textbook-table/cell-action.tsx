"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";

import {
  publishTextbookChapterAction,
  setTextbookStatusAction,
} from "@/app/dashboard/admin/digital-textbook/actions";
import { Icons } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { DigitalTextbookDisplayRow } from "./columns";

const DigitalTextbookContentDialog = dynamic(
  () =>
    import("../digital-textbook-action-dialogs").then(
      (module) => module.DigitalTextbookContentDialog,
    ),
  {
    loading: () => (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="h-64 w-full max-w-3xl animate-pulse rounded-xl bg-[var(--card)] shadow-xl" />
        <span className="sr-only">正在加载教材编辑器…</span>
      </div>
    ),
  },
);

type EditorPanel = "vocabulary" | "grammar";

export function DigitalTextbookCellAction({
  row,
  canManage,
  canPublishChapter,
}: {
  row: DigitalTextbookDisplayRow;
  canManage: boolean;
  canPublishChapter: boolean;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<EditorPanel | null>(null);
  const [pending, setPending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nextStatus = row.textbookStatus === "published" ? "draft" : "published";

  async function changeStatus() {
    setPending(true);
    setMessage(null);
    const result = await setTextbookStatusAction(row.textbookId, nextStatus);
    if (result.ok) router.refresh();
    else setMessage(result.message ?? "状态更新失败");
    setPending(false);
  }

  async function publishChapter() {
    setPublishing(true);
    setMessage(null);
    const result = await publishTextbookChapterAction(row.chapterId);
    setMessage(result.message ?? (result.ok ? "章节已发布。" : "章节发布失败。"));
    if (result.ok) {
      setPublishDialogOpen(false);
      router.refresh();
    }
    setPublishing(false);
  }

  return (
    <>
      <div className="flex min-w-44 flex-col items-end gap-1.5">
        <div className="flex items-center justify-end gap-2">
          {canPublishChapter && (
            <AlertDialog
              open={publishDialogOpen}
              onOpenChange={(open) => {
                if (!publishing) setPublishDialogOpen(open);
              }}
            >
              <AlertDialogTrigger
                type="button"
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                <Send className="size-3.5" aria-hidden="true" />
                {row.chapterStatus === "published" ? "重新发布" : "发布章节"}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-semibold">
                    发布第 {row.chapterNumber} 章？
                  </AlertDialogTitle>
                  <AlertDialogDescription className="leading-6">
                    系统会同时发布本章教材、关联的章节测试和全部有效测试题。发布后学生将按照学习进度看到本章；尚未制作的音频不会因此自动生成。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel type="button" disabled={publishing}>
                    取消
                  </AlertDialogCancel>
                  <AlertDialogAction
                    type="button"
                    onClick={publishChapter}
                    disabled={publishing}
                    className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {publishing ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="size-4" aria-hidden="true" />
                    )}
                    {publishing ? "发布中…" : "确认发布"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canManage && (
            <details className="group relative inline-block text-left">
              <summary
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                aria-label="打开教材制作操作"
              >
                <Icons.more className="size-4" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-30 mt-1 w-44 border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
                <MenuButton
                  label="编辑章节词汇"
                  onClick={() => setPanel("vocabulary")}
                />
                <MenuButton
                  label="编辑章节语法"
                  onClick={() => setPanel("grammar")}
                />
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  type="button"
                  onClick={changeStatus}
                  disabled={pending}
                  className={`flex w-full items-center px-2 py-2 text-left text-xs font-medium hover:bg-[var(--surface-soft)] disabled:opacity-50 ${
                    nextStatus === "published"
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {pending
                    ? "处理中…"
                    : nextStatus === "published"
                      ? "发布教材"
                      : "下架为草稿"}
                </button>
              </div>
            </details>
          )}
        </div>
        {message && (
          <p
            role="status"
            aria-live="polite"
            className={`max-w-60 text-right text-[10px] font-medium leading-4 ${
              message.includes("已发布")
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {panel && (
        <DigitalTextbookContentDialog
          open
          onOpenChange={(open) => {
            if (!open) setPanel(null);
          }}
          panel={panel}
          row={row}
        />
      )}
    </>
  );
}

function MenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center px-2 py-2 text-left text-xs font-medium text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
    >
      {label}
    </button>
  );
}
