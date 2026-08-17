"use client";

import { useActionState, useState } from "react";
import { Save, Upload } from "lucide-react";

import { initialLibraryActionState } from "@/app/dashboard/library/action-state";
import {
  createLibraryResourceAction,
  updateLibraryResourceAction,
} from "@/app/dashboard/library/actions";
import {
  LIBRARY_CATEGORY_LABELS,
  type LibraryCategory,
} from "@/app/dashboard/library/config";

export type LibraryCourseOption = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  slug: string;
};

export type LibraryResourceFormValue = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string;
  category: LibraryCategory;
  is_featured: boolean;
  sort_order: number;
};

const labelCellClass =
  "w-[150px] border-r bg-[var(--surface-soft)] px-4 py-3 text-[11px] font-semibold align-top";
const valueCellClass = "px-4 py-3";
const inputClass =
  "app-input w-full rounded-lg border px-3 py-2.5 text-xs outline-none";

export function LibraryResourceForm({
  courses,
  lockedCourse,
  resource,
}: {
  courses: LibraryCourseOption[];
  lockedCourse?: LibraryCourseOption;
  resource?: LibraryResourceFormValue;
}) {
  const action = resource
    ? updateLibraryResourceAction.bind(null, resource.id)
    : createLibraryResourceAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialLibraryActionState,
  );
  const [source, setSource] = useState("file");
  const [selectedTargetId, setSelectedTargetId] = useState(
    resource?.lesson_id ?? resource?.course_id ?? "",
  );
  const selectedTarget = courses.find(
    (course) => (course.lesson_id ?? course.course_id) === selectedTargetId,
  );

  return (
    <form action={formAction}>
      {lockedCourse && (
        <>
          <input type="hidden" name="course_id" value={lockedCourse.course_id} />
          <input
            type="hidden"
            name="lesson_id"
            value={lockedCourse.lesson_id ?? ""}
          />
        </>
      )}
      {!lockedCourse && selectedTarget && (
        <>
          <input type="hidden" name="course_id" value={selectedTarget.course_id} />
          <input
            type="hidden"
            name="lesson_id"
            value={selectedTarget.lesson_id ?? ""}
          />
        </>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <tbody>
            {!lockedCourse && (
              <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                <th className={labelCellClass}>所属课程</th>
                <td className={valueCellClass}>
                  <select
                    name="lesson_target"
                    required
                    value={selectedTargetId}
                    onChange={(event) => setSelectedTargetId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      请选择课程
                    </option>
                    {courses.map((course) => (
                      <option
                        key={course.id}
                        value={course.lesson_id ?? course.course_id}
                        data-course-id={course.course_id}
                      >
                        {course.title}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )}
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <th className={labelCellClass}>资料标题</th>
              <td className={valueCellClass}>
                <input
                  name="title"
                  required
                  minLength={2}
                  maxLength={140}
                  defaultValue={resource?.title}
                  className={inputClass}
                  placeholder="填写资料名称"
                />
              </td>
            </tr>
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <th className={labelCellClass}>资料说明</th>
              <td className={valueCellClass}>
                <textarea
                  name="description"
                  maxLength={3000}
                  rows={3}
                  defaultValue={resource?.description}
                  className={`${inputClass} resize-y leading-5`}
                  placeholder="简要说明资料用途"
                />
              </td>
            </tr>
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <th className={labelCellClass}>分类与顺序</th>
              <td className={valueCellClass}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <select
                    name="category"
                    defaultValue={resource?.category ?? "language"}
                    className={inputClass}
                  >
                    {Object.entries(LIBRARY_CATEGORY_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    type="number"
                    name="sort_order"
                    min={0}
                    max={100000}
                    defaultValue={resource?.sort_order ?? 0}
                    className={inputClass}
                    aria-label="显示顺序"
                    placeholder="显示顺序"
                  />
                </div>
              </td>
            </tr>

            {!resource && (
              <>
                <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  <th className={labelCellClass}>资料来源</th>
                  <td className={valueCellClass}>
                    <div className="flex flex-wrap gap-5 text-xs font-bold">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="source_kind"
                          value="file"
                          checked={source === "file"}
                          onChange={() => setSource("file")}
                        />
                        上传文件
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="source_kind"
                          value="link"
                          checked={source === "link"}
                          onChange={() => setSource("link")}
                        />
                        外部链接
                      </label>
                    </div>
                  </td>
                </tr>
                <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  <th className={labelCellClass}>
                    {source === "file" ? "选择文件" : "链接地址"}
                  </th>
                  <td className={valueCellClass}>
                    {source === "file" ? (
                      <>
                        <input
                          type="file"
                          name="resource_file"
                          required
                          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                          className={inputClass}
                        />
                        <p className="app-muted-text mt-1.5 text-[10px]">
                          支持文档、图片、表格、演示文稿和压缩包，最大 15 兆。
                        </p>
                      </>
                    ) : (
                      <input
                        type="url"
                        name="external_url"
                        required
                        placeholder="https://"
                        className={inputClass}
                      />
                    )}
                  </td>
                </tr>
              </>
            )}

            <tr>
              <th className={labelCellClass}>推荐设置</th>
              <td className={valueCellClass}>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-bold">
                  <input
                    type="checkbox"
                    name="is_featured"
                    defaultChecked={resource?.is_featured}
                  />
                  设为推荐资料
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {state.message && (
        <p
          className="mt-3 rounded-lg px-3 py-2.5 text-xs font-bold"
          style={{
            color: state.status === "error" ? "#c94f45" : "var(--status-success)",
            backgroundColor:
              state.status === "error" ? "#fff0ed" : "var(--status-success-surface)",
          }}
        >
          {state.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {resource ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--support)" }}
          >
            <Save size={14} />
            {pending ? "正在保存…" : "保存修改"}
          </button>
        ) : (
          <>
            <button
              type="submit"
              name="intent"
              value="publish"
              disabled={pending || courses.length === 0}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)" }}
            >
              <Upload size={14} />
              {pending ? "正在上传…" : "上传并发布"}
            </button>
            <button
              type="submit"
              name="intent"
              value="draft"
              disabled={pending || courses.length === 0}
              className="app-soft-card inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              <Save size={14} />
              保存草稿
            </button>
          </>
        )}
      </div>
    </form>
  );
}
