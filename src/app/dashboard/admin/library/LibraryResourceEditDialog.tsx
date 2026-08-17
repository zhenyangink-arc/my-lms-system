"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

import {
  LibraryResourceForm,
  type LibraryCourseOption,
  type LibraryResourceFormValue,
} from "./LibraryResourceForm";

export function LibraryResourceEditDialog({
  course,
  courses,
  resource,
}: {
  course: LibraryCourseOption;
  courses: LibraryCourseOption[];
  resource: LibraryResourceFormValue;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-soft-card inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-[10px] font-semibold"
      >
        <Pencil size={11} />
        编辑
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`编辑资料：${resource.title}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="app-card max-h-[90vh] w-full max-w-[860px] overflow-y-auto rounded-2xl border p-5 shadow-2xl">
            <div
              className="mb-4 flex items-center justify-between gap-4 border-b pb-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div>
                <h3 className="text-sm font-semibold">编辑资料</h3>
                <p className="app-muted-text mt-1 text-[10px]">
                  修改标题、分类、顺序和推荐状态；资料仍归属于当前课级目录。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="app-soft-card flex h-8 w-8 items-center justify-center rounded-lg border"
                aria-label="关闭编辑窗口"
              >
                <X size={14} />
              </button>
            </div>
            <LibraryResourceForm
              courses={courses}
              lockedCourse={course}
              resource={resource}
            />
          </section>
        </div>
      )}
    </>
  );
}
