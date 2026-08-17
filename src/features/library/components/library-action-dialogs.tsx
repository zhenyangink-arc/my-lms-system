"use client";

import { useState } from "react";

import {
  LibraryResourceForm,
  type LibraryCourseOption,
  type LibraryResourceFormValue,
} from "@/app/dashboard/admin/library/LibraryResourceForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UploadLibraryResourceDialog({
  courses,
}: {
  courses: LibraryCourseOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-9 rounded-md bg-neutral-950 px-4 text-xs font-semibold text-white"
      >
        上传资料
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
            <DialogTitle>上传课程资料</DialogTitle>
            <DialogDescription className="text-xs">
              选择所属课程后上传文件或添加外部链接，可直接发布或先保存草稿。
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5">
            <LibraryResourceForm courses={courses} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditLibraryResourceDialog({
  course,
  courses,
  resource,
  open,
  onOpenChange,
}: {
  course: LibraryCourseOption;
  courses: LibraryCourseOption[];
  resource: LibraryResourceFormValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <DialogTitle>编辑资料</DialogTitle>
          <DialogDescription className="text-xs">
            修改标题、分类、排序和推荐状态；资料仍归属于当前课程。
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5">
          <LibraryResourceForm
            courses={courses}
            lockedCourse={course}
            resource={resource}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
