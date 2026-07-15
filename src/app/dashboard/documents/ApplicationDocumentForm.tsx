"use client";

import { useActionState, useState } from "react";
import { FileUp, RotateCcw, ShieldCheck } from "lucide-react";

import { saveApplicationDocumentAction } from "./actions";
import { initialDocumentActionState } from "./document-action-state";

export function ApplicationDocumentForm({
  documentId,
  currentStatus,
}: {
  documentId: string;
  currentStatus: string;
}) {
  const isResubmission = currentStatus === "revision_required";
  const isReplacement = currentStatus === "pending_review";
  const [showReplacement, setShowReplacement] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(isResubmission || isReplacement ? "ready" : currentStatus);
  const [state, formAction, pending] = useActionState(
    saveApplicationDocumentAction.bind(null, documentId),
    initialDocumentActionState
  );
  const needsFile = selectedStatus === "ready";

  if (isReplacement && !showReplacement) {
    return (
      <button type="button" onClick={() => setShowReplacement(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition hover:opacity-80" style={{ color: "var(--app-secondary)", borderColor: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
        <RotateCcw size={14} />更换提交文件
      </button>
    );
  }

  return (
    <form action={formAction} className={needsFile ? "space-y-2.5" : "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"}>
      {isResubmission || isReplacement ? (
        <>
          <input type="hidden" name="status" value="ready" />
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black" style={{ color: isReplacement ? "var(--app-secondary)" : "var(--app-warm)", backgroundColor: isReplacement ? "var(--app-secondary-soft)" : "var(--app-warm-soft)" }}><RotateCcw size={15} />{isReplacement ? "交错了？可在审核开始前更换文件" : "请上传修改后的新版本"}</div>
        </>
      ) : (
        <label className="block">
          <span className="sr-only">我的准备状态</span>
          <select name="status" aria-label="我的准备状态" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="app-input w-full rounded-xl border px-3 py-2.5 text-xs font-bold outline-none">
            <option value="not_started">未开始</option>
            <option value="preparing">准备中</option>
            <option value="ready">已准备，提交审核</option>
          </select>
        </label>
      )}

      {needsFile && (
        <label className="block rounded-xl border border-dashed p-3" style={{ borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <span className="flex items-center gap-2 text-xs font-black"><FileUp size={16} style={{ color: "var(--app-accent)" }} />选择申请材料文件</span>
          <input name="document_file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-black" />
          <span className="app-muted-text mt-1.5 block text-[10px] leading-5">支持 PDF、图片和 Word，最大 15MB；文件仅管理员可查看。</span>
        </label>
      )}

      {state.status !== "idle" && <p role="status" className={`col-span-full rounded-xl px-3 py-2 text-xs font-bold ${state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>}

      <button type="submit" disabled={pending} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 ${needsFile ? "w-full" : "shrink-0"}`} style={{ backgroundColor: needsFile ? "var(--app-secondary)" : "var(--app-accent)" }}>
        {needsFile ? <ShieldCheck size={15} /> : null}
        {pending ? (needsFile ? "正在安全上传…" : "正在保存…") : needsFile ? (isReplacement ? "更换提交文件" : isResubmission ? "重新提交审核" : "上传并提交审核") : "保存准备状态"}
      </button>
    </form>
  );
}
