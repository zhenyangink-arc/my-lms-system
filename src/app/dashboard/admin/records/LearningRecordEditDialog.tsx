"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

import {
  LearningRecordForm,
  type LearningRecordFormValue,
} from "./LearningRecordForm";

type Student = { id: string; name: string; email: string };

export function LearningRecordEditDialog({
  students,
  note,
}: {
  students: Student[];
  note: LearningRecordFormValue;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
      >
        <Pencil size={11} />
        编辑
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="修改辅导备注"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="app-card max-h-[92vh] w-full max-w-[980px] overflow-y-auto rounded-3xl border p-4 shadow-2xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">修改辅导备注</h2>
                <p className="app-muted-text mt-1 text-[10px]">
                  修改后会立即更新机构备注；学生可见内容同步更新到学生端。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="app-soft-card flex h-9 w-9 items-center justify-center rounded-xl border"
                aria-label="关闭修改窗口"
              >
                <X size={15} />
              </button>
            </div>
            <LearningRecordForm students={students} note={note} />
          </div>
        </div>
      )}
    </>
  );
}
