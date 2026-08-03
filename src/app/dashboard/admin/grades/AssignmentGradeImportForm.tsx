"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import { importAssignmentGradesAction } from "@/app/dashboard/grades/actions";

export function AssignmentGradeImportForm({
  assignments,
}: {
  assignments: Array<{ id: string; title: string }>;
}) {
  const [state, formAction, pending] = useActionState(
    importAssignmentGradesAction,
    initialGradeCenterActionState,
  );

  return (
    <section className="app-card overflow-hidden border">
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--app-border)" }}>
        <h2 className="text-sm font-black">同步作业考试成绩</h2>
        <p className="app-muted-text mt-1 text-[10px]">读取最新一次已批改成绩并生成成绩项目</p>
      </div>
      <form action={formAction}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <tbody>
              <tr className="border-b" style={{ borderColor: "var(--app-border-soft)" }}>
                <th className="w-32 bg-[var(--app-soft-bg)] px-3 py-3 text-[11px] font-black">作业或考试</th>
                <td className="px-3 py-3">
                  <select name="assignment_id" required defaultValue="" className="app-input w-full rounded-md border px-3 py-2.5 text-xs">
                    <option value="" disabled>选择作业、测验或考试</option>
                    {assignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                  </select>
                </td>
                <td className="w-36 px-3 py-3 text-right">
                  <button type="submit" disabled={pending || assignments.length === 0} className="inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-[10px] font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-success)" }}>
                    <RefreshCw size={12} />{pending ? "正在同步…" : "同步最新成绩"}
                  </button>
                </td>
              </tr>
              {state.message && (
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 text-[10px] font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </form>
    </section>
  );
}
