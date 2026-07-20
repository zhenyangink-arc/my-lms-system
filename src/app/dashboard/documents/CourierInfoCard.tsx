"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Lock, PackageCheck } from "lucide-react";

import { ChineseDateInput } from "@/components/ChineseDateInput";
import { saveCourierInfoAction } from "./actions";
import { initialDocumentActionState } from "./document-action-state";

function ConfirmButton({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !canSubmit}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: "var(--app-accent)" }}
    >
      <CheckCircle2 size={14} />
      {pending ? "保存中…" : "确认"}
    </button>
  );
}

export function CourierInfoCard({
  targetId,
  courierMailedAt,
  courierEstimatedArrivalAt,
  canEdit,
}: {
  targetId: string;
  courierMailedAt: string | null;
  courierEstimatedArrivalAt: string | null;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(
    saveCourierInfoAction.bind(null, targetId),
    initialDocumentActionState
  );
  const [mailedAt, setMailedAt] = useState(courierMailedAt ?? "");
  const [estimatedArrivalAt, setEstimatedArrivalAt] = useState(courierEstimatedArrivalAt ?? "");
  const canSubmit = mailedAt.trim().length > 0 && estimatedArrivalAt.trim().length > 0;
  const isConfirmed = Boolean(courierMailedAt && courierEstimatedArrivalAt);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <PackageCheck size={14} />
        </span>
        <p className="text-xs font-black">中国至韩国材料寄送信息</p>
      </div>

      {!canEdit ? (
        <p className="app-muted-text mt-3 flex items-center gap-1.5 text-xs leading-4">
          <Lock size={11} />
          请等待管理员确认后再填写快递邮寄时间。
        </p>
      ) : isConfirmed ? (
        <div className="app-card mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs">
          <PackageCheck className="mt-0.5 shrink-0" size={12} style={{ color: "var(--app-accent)" }} />
          <div className="space-y-1">
            <p><span className="app-muted-text">快递邮寄时间：</span><span className="font-black">{courierMailedAt}</span></p>
            <p><span className="app-muted-text">预计到达时间：</span><span className="font-black">{courierEstimatedArrivalAt}</span></p>
            <p className="app-muted-text mt-1.5 flex items-center gap-1.5">
              <Lock size={10} />
              已确认，如需修改请联系管理员。
            </p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-3 space-y-2.5" onClick={(event) => event.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-black">
              快递邮寄时间
              <ChineseDateInput
                name="courierMailedAt"
                value={mailedAt}
                onChange={setMailedAt}
                required
              />
            </label>
            <label className="block text-xs font-black">
              预计到达时间
              <ChineseDateInput
                name="courierEstimatedArrivalAt"
                value={estimatedArrivalAt}
                onChange={setEstimatedArrivalAt}
                required
              />
            </label>
          </div>
          <ConfirmButton canSubmit={canSubmit} />
          {state.status !== "idle" && (
            <p
              role="status"
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                state.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
