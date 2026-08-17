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
    <form onSubmit={handleSubmit} className="mt-4 border-t border-black/[0.07] pt-4 text-[10px]">
      <div className="flex items-center gap-1.5 font-medium text-zinc-800">
        <PackageCheck size={12} className="text-zinc-500" />
        中国到韩国材料寄送（可随时修改）
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block font-medium text-zinc-600">
          快递邮寄时间
          <ChineseDateInput
            value={mailedAt}
            onChange={setMailedAt}
            required
            className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-left text-[10px] outline-none focus:border-black/25"
          />
        </label>
        <label className="block font-medium text-zinc-600">
          预计到达时间
          <ChineseDateInput
            value={estimatedArrivalAt}
            onChange={setEstimatedArrivalAt}
            required
            className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-left text-[10px] outline-none focus:border-black/25"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className="mt-2.5 rounded-md bg-zinc-950 px-3 py-2 text-[10px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "保存中…" : "保存并同步到学生端"}
      </button>
      {error && <p className="mt-2 border-l-2 border-rose-400 bg-rose-50 px-2.5 py-1.5 font-medium text-rose-700">{error}</p>}
    </form>
  );
}
