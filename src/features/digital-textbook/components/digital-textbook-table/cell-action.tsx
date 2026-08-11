"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { setTextbookStatusAction } from "@/app/dashboard/admin/digital-textbook/actions";
import { Icons } from "@/components/icons";
import { DigitalTextbookContentDialog } from "../digital-textbook-action-dialogs";
import type { DigitalTextbookDisplayRow } from "./columns";

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
          className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-soft-bg)] hover:text-[var(--app-text)]"
          aria-label="打开互动教材操作"
        >
          <Icons.more className="size-4" aria-hidden="true" />
        </summary>
        <div className="absolute right-0 z-30 mt-1 w-44 border border-[var(--app-border)] bg-[var(--app-card-bg)] p-1 shadow-lg">
          <MenuButton label="编辑章节词汇" onClick={() => setPanel("vocabulary")} />
          <MenuButton label="编辑章节语法" onClick={() => setPanel("grammar")} />
          <div className="my-1 border-t border-[var(--app-border)]" />
          <button
            type="button"
            onClick={changeStatus}
            disabled={pending}
            className={`flex w-full items-center px-2 py-2 text-left text-xs font-medium hover:bg-[var(--app-soft-bg)] disabled:opacity-50 ${
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

      <DigitalTextbookContentDialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        panel={panel ?? "vocabulary"}
        row={row}
      />
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
      className="flex w-full items-center px-2 py-2 text-left text-xs font-medium text-[var(--app-text-soft)] hover:bg-[var(--app-soft-bg)]"
    >
      {label}
    </button>
  );
}
