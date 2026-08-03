"use client";

import { useActionState } from "react";
import { Save, Send } from "lucide-react";

import { initialGradeCenterActionState } from "@/app/dashboard/grades/action-state";
import {
  createGradeItemAction,
  updateGradeItemAction,
} from "@/app/dashboard/grades/actions";
import {
  GRADE_ITEM_TYPE_LABELS,
  type GradeItemStatus,
  type GradeItemType,
} from "@/app/dashboard/grades/config";

export type GradeItemFormValue = {
  id: string;
  title: string;
  description: string;
  item_type: GradeItemType;
  term: string;
  total_points: number;
  weight_percent: number;
  status: GradeItemStatus;
  course_id: string | null;
};

export type GradeItemCourseOption = {
  id: string;
  title: string;
};

const fieldClass =
  "app-input w-full rounded-md border px-3 py-2.5 text-xs outline-none";
const headerCellClass =
  "w-32 bg-[var(--app-soft-bg)] px-3 py-3 text-left text-[11px] font-black align-top";
const valueCellClass = "px-3 py-3 align-top";

export function GradeItemForm({
  item,
  courses = [],
}: {
  item?: GradeItemFormValue;
  courses?: GradeItemCourseOption[];
}) {
  const action = item
    ? updateGradeItemAction.bind(null, item.id)
    : createGradeItemAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialGradeCenterActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {item && <input type="hidden" name="status" value={item.status} />}

      <div
        className="overflow-hidden border"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <tbody className="divide-y">
              <tr>
                <th className={headerCellClass}>
                  <label htmlFor={`grade-title-${item?.id ?? "new"}`}>项目名称</label>
                </th>
                <td colSpan={3} className={valueCellClass}>
                  <input
                    id={`grade-title-${item?.id ?? "new"}`}
                    name="title"
                    required
                    minLength={2}
                    maxLength={120}
                    defaultValue={item?.title}
                    placeholder="例如：第一学期期末综合成绩"
                    className={fieldClass}
                  />
                </td>
              </tr>
              <tr>
                <th className={headerCellClass}>成绩类型</th>
                <td className={valueCellClass}>
                  <select
                    name="item_type"
                    defaultValue={item?.item_type ?? "other"}
                    className={fieldClass}
                  >
                    {Object.entries(GRADE_ITEM_TYPE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ),
                    )}
                  </select>
                </td>
                <th className={`${headerCellClass} border-l`}>关联课程</th>
                <td className={valueCellClass}>
                  <select
                    name="course_id"
                    defaultValue={item?.course_id ?? ""}
                    className={fieldClass}
                  >
                    <option value="">不关联具体课程</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>{course.title}</option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <th className={headerCellClass}>学期或阶段</th>
                <td className={valueCellClass}>
                  <input
                    name="term"
                    maxLength={60}
                    defaultValue={item?.term}
                    placeholder="例如：2026 年第一学期"
                    className={fieldClass}
                  />
                </td>
                <th className={`${headerCellClass} border-l`}>满分</th>
                <td className={valueCellClass}>
                  <input
                    type="number"
                    name="total_points"
                    min="0.01"
                    max="10000"
                    step="0.01"
                    required
                    defaultValue={item?.total_points ?? 100}
                    className={fieldClass}
                  />
                </td>
              </tr>
              <tr>
                <th className={headerCellClass}>综合权重</th>
                <td className={valueCellClass}>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="weight_percent"
                      min="0"
                      max="100"
                      step="0.01"
                      defaultValue={item?.weight_percent ?? 0}
                      className={fieldClass}
                    />
                    <span className="app-muted-text text-[10px]">%</span>
                  </div>
                </td>
                <th className={`${headerCellClass} border-l`}>当前状态</th>
                <td className={`${valueCellClass} text-xs font-bold`}>
                  {item ? "保存修改不改变发布状态" : "由保存按钮决定"}
                </td>
              </tr>
              <tr>
                <th className={headerCellClass}>项目说明</th>
                <td colSpan={3} className={valueCellClass}>
                  <textarea
                    name="description"
                    maxLength={2000}
                    rows={4}
                    defaultValue={item?.description}
                    className={`${fieldClass} resize-y leading-5`}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {state.message && (
        <p
          className="rounded-md px-3 py-2.5 text-xs font-bold"
          style={{
            color: state.status === "error" ? "#c94f45" : "var(--app-success)",
            backgroundColor:
              state.status === "error" ? "#fff0ed" : "var(--app-success-soft)",
          }}
        >
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {item ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--app-secondary)" }}
          >
            <Save size={14} />{pending ? "正在保存…" : "保存修改"}
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              <Send size={14} />{pending ? "正在保存…" : "保存并发布"}
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              disabled={pending}
              className="app-soft-card inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-black disabled:opacity-50"
            >
              <Save size={14} />保存草稿
            </button>
          </>
        )}
      </div>
    </form>
  );
}
