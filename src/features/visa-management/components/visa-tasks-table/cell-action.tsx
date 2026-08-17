"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { VisaTaskReviewControls } from "@/app/dashboard/admin/visa/VisaAdminControls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { VisaTaskDisplayRow } from "./types";

export function VisaTaskCellAction({ task }: { task: VisaTaskDisplayRow }) {
  const [open, setOpen] = useState(false);

  if (task.status !== "submitted" && task.status !== "reviewing") {
    return (
      <span className="text-xs text-[var(--foreground-muted)]">
        {task.status === "approved"
          ? "审核已完成"
          : task.status === "revision_required"
            ? "等待学生补充"
            : "当前无需审核"}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--support)] transition-colors hover:bg-[var(--support-surface)]"
      >
        <ClipboardCheck size={13} />
        {task.status === "submitted" ? "开始审核" : "完成审核"}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            {task.studentName} · {task.universityName}。审核状态变化仍由原 Server Action 按当前数据库状态校验。
          </DialogDescription>
        </DialogHeader>
        <VisaTaskReviewControls taskId={task.id} status={task.status} />
      </DialogContent>
    </Dialog>
  );
}
