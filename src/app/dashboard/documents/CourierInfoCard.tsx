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
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: "var(--primary)" }}
    >
      <CheckCircle2 size={14} aria-hidden="true" />
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
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>
          <PackageCheck size={14} aria-hidden="true" />
        </span>
        <p className="text-xs font-bold">中国至韩国材料寄送信息</p>
      </div>

      {!canEdit ? (
        <p className="app-muted-text mt-3 flex items-center gap-1.5 text-xs leading-4">
          <Lock size={11} aria-hidden="true" />
          请等待管理员确认后再填写快递邮寄时间。
        </p>
      ) : isConfirmed ? (
        <div className="app-card mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs">
          <PackageCheck className="mt-0.5 shrink-0" size={12} style={{ color: "var(--primary)" }} aria-hidden="true" />
          <div className="space-y-1">
            <p><span className="app-muted-text">快递邮寄时间：</span><span className="font-bold">{courierMailedAt}</span></p>
            <p><span className="app-muted-text">预计到达时间：</span><span className="font-bold">{courierEstimatedArrivalAt}</span></p>
            <p className="app-muted-text mt-1.5 flex items-center gap-1.5">
              <Lock size={10} aria-hidden="true" />
              已确认，如需修改请联系管理员。
            </p>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-3 space-y-2.5" onClick={(event) => event.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-bold">
              快递邮寄时间
              <ChineseDateInput
                name="courierMailedAt"
                value={mailedAt}
                onChange={setMailedAt}
                required
              />
            </label>
            <label className="block text-xs font-bold">
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
              role={state.status === "success" ? "status" : "alert"}
              className="rounded-xl px-3 py-2 text-xs font-bold"
              style={state.status === "success"
                ? { color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }
                : { color: "var(--destructive)", backgroundColor: "var(--surface-soft)" }}
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
