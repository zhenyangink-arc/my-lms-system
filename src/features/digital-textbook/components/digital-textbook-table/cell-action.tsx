"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { setTextbookStatusAction } from "@/app/dashboard/admin/digital-textbook/actions";
import { Icons } from "@/components/icons";
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
}: {
  row: DigitalTextbookDisplayRow;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<EditorPanel | null>(null);
  const [pending, setPending] = useState(false);
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

  return (
    <>
      <details className="group relative inline-block text-left">
        <summary
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          aria-label="打开互动教材操作"
        >
          <Icons.more className="size-4" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-44 border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
          <MenuButton label="编辑章节词汇" onClick={() => setPanel("vocabulary")} />
          <MenuButton label="编辑章节语法" onClick={() => setPanel("grammar")} />
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
          {message && (
            <p className="px-2 py-1 text-[11px] font-medium text-rose-700">
              {message}
            </p>
          )}
        </div>
      </details>

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
