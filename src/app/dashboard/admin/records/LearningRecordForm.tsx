"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";

import { initialLearningRecordActionState } from "@/app/dashboard/records/action-state";
import {
  createLearningRecordNoteAction,
  updateLearningRecordNoteAction,
} from "@/app/dashboard/records/actions";
import {
  LEARNING_RECORD_TYPE_LABELS,
  LEARNING_RECORD_VISIBILITY_LABELS,
  type LearningRecordType,
  type LearningRecordVisibility,
} from "@/app/dashboard/records/config";

type Student = { id: string; name: string; email: string };

export type LearningRecordFormValue = {
  id: string;
  student_id: string;
  record_type: LearningRecordType;
  title: string;
  content: string;
  next_action: string;
  visibility: LearningRecordVisibility;
  occurred_at: string;
};

function localDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const labelCellClass =
  "w-[130px] border-b bg-[var(--surface-soft)] px-4 py-3 text-[11px] font-semibold align-top";
const fieldCellClass = "border-b px-4 py-3";

export function LearningRecordForm({
  students,
  note,
  studentId,
}: {
  students: Student[];
  note?: LearningRecordFormValue;
  studentId?: string;
}) {
  const action = note
    ? updateLearningRecordNoteAction.bind(null, note.id)
    : createLearningRecordNoteAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningRecordActionState,
  );

  return (
    <form action={formAction}>
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <tbody>
            <tr>
              <th className={labelCellClass}>学生</th>
              <td className={fieldCellClass}>
                {studentId && !note ? (
                  <>
                    <input type="hidden" name="student_id" value={studentId} />
                    <p className="flex h-9 items-center text-xs font-semibold">
                      {students.find((student) => student.id === studentId)?.name || "当前学生"}
                    </p>
                  </>
                ) : (
                  <select
                    name="student_id"
                    required
                    defaultValue={note?.student_id ?? ""}
                    className="app-input w-full rounded-lg border px-3 py-2.5 text-xs"
                  >
                    <option value="" disabled>
                      选择学生账号
                    </option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} · {student.email}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <th className={labelCellClass}>记录类型</th>
              <td className={fieldCellClass}>
                <select
                  name="record_type"
                  defaultValue={note?.record_type ?? "coaching"}
                  className="app-input w-full rounded-lg border px-3 py-2.5 text-xs"
                >
                  {Object.entries(LEARNING_RECORD_TYPE_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </td>
            </tr>
            <tr>
              <th className={labelCellClass}>可见范围</th>
              <td className={fieldCellClass}>
                <select
                  name="visibility"
                  defaultValue={note?.visibility ?? "student_visible"}
                  className="app-input w-full rounded-lg border px-3 py-2.5 text-xs"
                >
                  {Object.entries(LEARNING_RECORD_VISIBILITY_LABELS).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </td>
              <th className={labelCellClass}>记录时间</th>
              <td className={fieldCellClass}>
                <input
                  type="datetime-local"
                  name="occurred_at"
                  required
                  defaultValue={localDate(note?.occurred_at)}
                  className="app-input w-full rounded-lg border px-3 py-2.5 text-xs"
                />
              </td>
            </tr>
            <tr>
              <th className={labelCellClass}>标题</th>
              <td className={fieldCellClass} colSpan={3}>
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={note?.title}
                  placeholder="填写本次记录主题"
                  className="app-input w-full rounded-lg border px-3 py-2.5 text-xs"
                />
              </td>
            </tr>
            <tr>
              <th className={labelCellClass}>记录内容</th>
              <td className={fieldCellClass} colSpan={3}>
                <textarea
                  name="content"
                  required
                  minLength={2}
                  maxLength={5000}
                  rows={4}
                  defaultValue={note?.content}
                  placeholder="记录学生当前表现、辅导过程或阶段评价"
                  className="app-input w-full resize-y rounded-lg border px-3 py-2.5 text-xs leading-5"
                />
              </td>
            </tr>
            <tr>
              <th className="w-[130px] bg-[var(--surface-soft)] px-4 py-3 text-[11px] font-semibold align-top">
                下一步建议
              </th>
              <td className="px-4 py-3" colSpan={3}>
                <textarea
                  name="next_action"
                  maxLength={2000}
                  rows={2}
                  defaultValue={note?.next_action}
                  placeholder="可选：填写后续学习安排或关注事项"
                  className="app-input w-full resize-y rounded-lg border px-3 py-2.5 text-xs leading-5"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
        {state.message && (
          <p
            className="mr-auto rounded-lg px-3 py-2 text-xs font-bold"
            style={{
              color: state.status === "error" ? "#c94f45" : "var(--status-success)",
              backgroundColor:
                state.status === "error" ? "#fff0ed" : "var(--status-success-surface)",
            }}
          >
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--support)" }}
        >
          <Save size={14} />
          {pending ? "正在保存…" : note ? "保存修改" : "添加辅导备注"}
        </button>
      </div>
    </form>
  );
}
