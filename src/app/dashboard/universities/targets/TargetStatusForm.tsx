"use client";

import { useState } from "react";

import { updateUniversityStatusAction } from "../../planning-actions";

const statusOptions = [
  ["researching", "了解中"],
  ["preparing", "准备材料"],
] as const;

export function TargetStatusForm({
  targetId,
  initialStatus,
  universityName,
  locked = false,
}: {
  targetId: string;
  initialStatus: string;
  universityName: string;
  /** 已提交锁定：不可再修改，按钮显示「已提交」 */
  locked?: boolean;
}) {
  // 数据库中可能存在下拉框以外的状态（如 offer / 旧版 applied），
  // applied 视为已提交，其余回退到「了解中」。
  const [status, setStatus] = useState(
    initialStatus === "applied" ||
      statusOptions.some(([value]) => value === initialStatus)
      ? initialStatus
      : "researching"
  );
  // 只有「准备材料」时才显示提交按钮。
  const showSubmit = status === "preparing";
  // 提交后锁定：按钮变「已提交」，下拉不可再选。
  const isSubmitted = locked;

  return (
    <form
      action={updateUniversityStatusAction.bind(null, targetId)}
      className="flex min-w-0 flex-1 items-end gap-2"
    >
      <label className="min-w-0 flex-1 text-xs font-bold">
        申请状态
        <select
        name="status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        disabled={isSubmitted}
        aria-label={`${universityName}的申请状态`}
        className="app-input mt-1 w-full min-w-0 rounded-xl border px-3 py-2.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {!statusOptions.some(([value]) => value === status) && (
          <option value={status}>已提交</option>
        )}
        {statusOptions.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={isSubmitted}
        aria-hidden={!showSubmit && !isSubmitted}
        tabIndex={showSubmit || isSubmitted ? 0 : -1}
        className={`rounded-xl px-3 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 ${
          showSubmit || isSubmitted ? "" : "invisible"
        } disabled:cursor-not-allowed disabled:opacity-80`}
        style={{ backgroundColor: "var(--support)" }}
      >
        {isSubmitted ? "已提交" : "提交"}
      </button>
    </form>
  );
}
