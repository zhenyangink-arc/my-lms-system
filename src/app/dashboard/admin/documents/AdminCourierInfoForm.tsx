"use client";

import { useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";

import { ChineseDateInput } from "@/components/ChineseDateInput";
import { updateCourierInfoAction } from "./actions";

export function AdminCourierInfoForm({
  studentId,
  targetId,
  courierMailedAt,
  courierEstimatedArrivalAt,
}: {
  studentId: string;
  targetId: string;
  courierMailedAt: string | null;
  courierEstimatedArrivalAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [mailedAt, setMailedAt] = useState(courierMailedAt ?? "");
  const [estimatedArrivalAt, setEstimatedArrivalAt] = useState(courierEstimatedArrivalAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const canSubmit = mailedAt.trim().length > 0 && estimatedArrivalAt.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("courierMailedAt", mailedAt);
    formData.set("courierEstimatedArrivalAt", estimatedArrivalAt);
    startTransition(async () => {
      try {
        await updateCourierInfoAction(studentId, targetId, formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "快递信息保存失败，请刷新后重试。");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="app-card mt-3 rounded-xl border px-3 py-2.5 text-xs">
      <div className="flex items-center gap-1.5 font-black">
        <PackageCheck size={12} style={{ color: "var(--app-accent)" }} />
        中国到韩国材料寄送（管理员可随时修改，保存后同步到学生端）
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block font-black">
          快递邮寄时间
          <ChineseDateInput
            value={mailedAt}
            onChange={setMailedAt}
            required
            className="app-input mt-1 w-full rounded-lg border px-2 py-1.5 text-left text-xs outline-none"
          />
        </label>
        <label className="block font-black">
          预计到达时间
          <ChineseDateInput
            value={estimatedArrivalAt}
            onChange={setEstimatedArrivalAt}
            required
            className="app-input mt-1 w-full rounded-lg border px-2 py-1.5 text-left text-xs outline-none"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className="mt-2.5 rounded-lg px-3 py-1.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--app-accent)" }}
      >
        {isPending ? "保存中…" : "保存并同步到学生端"}
      </button>
      {error && <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 font-bold text-rose-700">{error}</p>}
    </form>
  );
}
