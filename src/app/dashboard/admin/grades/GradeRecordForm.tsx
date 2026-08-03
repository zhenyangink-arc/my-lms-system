"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import { saveGradeRecordAction } from "@/app/dashboard/grades/actions";
import {
  GRADE_RECORD_STATUS_LABELS,
  type GradeRecordStatus,
} from "@/app/dashboard/grades/config";

export function GradeRecordTableRow({
  itemId,
  studentId,
  studentName,
  studentEmail,
  membershipTier,
  totalPoints,
  record,
}: {
  itemId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  membershipTier: string | null;
  totalPoints: number;
  record?: {
    record_status: GradeRecordStatus;
    score: number | null;
    feedback: string;
  };
}) {
  const action = saveGradeRecordAction.bind(null, itemId, studentId);
  const [state, formAction, pending] = useActionState(
    action,
    initialGradeCenterActionState,
  );
  const formId = `grade-record-${studentId}`;
  const fieldClass = "app-input w-full rounded-md border px-2.5 py-2 text-[11px]";

  return (
    <tr
      className="border-b align-top text-[11px] last:border-b-0"
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <td className="px-4 py-3">
        <p className="font-black">{studentName}</p>
        <p className="app-muted-text mt-1 text-[9px]">{studentEmail}</p>
        {membershipTier && (
          <p className="app-muted-text mt-1 text-[9px]">{membershipTier}</p>
        )}
      </td>
      <td className="px-3 py-3">
        <select
          form={formId}
          name="record_status"
          defaultValue={record?.record_status ?? "graded"}
          className={fieldClass}
        >
          {Object.entries(GRADE_RECORD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          form={formId}
          aria-label={`得分，满分 ${totalPoints}`}
          name="score"
          type="number"
          min="0"
          max={totalPoints}
          step="0.01"
          defaultValue={record?.score ?? ""}
          className={fieldClass}
        />
        <p className="app-muted-text mt-1 text-[9px]">满分 {totalPoints}</p>
      </td>
      <td className="px-3 py-3">
        <textarea
          form={formId}
          aria-label="成绩评语"
          name="feedback"
          maxLength={3000}
          rows={2}
          defaultValue={record?.feedback}
          className={`${fieldClass} resize-y leading-5`}
        />
      </td>
      <td className="px-4 py-3">
        <form id={formId} action={formAction} className="space-y-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--app-secondary)" }}
          >
            <Save size={11} />{pending ? "保存中…" : "保存成绩"}
          </button>
          {state.message && (
            <p
              className="text-[9px] font-bold leading-4"
              style={{
                color:
                  state.status === "error"
                    ? "#c94f45"
                    : "var(--app-success)",
              }}
            >
              {state.message}
            </p>
          )}
        </form>
      </td>
    </tr>
  );
}
