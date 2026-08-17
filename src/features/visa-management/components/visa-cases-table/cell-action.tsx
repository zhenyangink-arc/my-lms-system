"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { StudentModuleCardDeleteDialog } from "@/app/dashboard/admin/StudentModuleCardDeleteDialog";
import { deleteStudentVisaCardAction } from "@/app/dashboard/admin/visa/actions";
import { VisaCaseAdminForm } from "@/app/dashboard/admin/visa/VisaAdminControls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import type { VisaManagementCase } from "../../api/types";

export function VisaCaseCellAction({
  item,
  dashboardBasePath,
}: {
  item: VisaManagementCase;
  dashboardBasePath: string;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex min-w-52 items-center justify-end gap-2">
      <Link
        href={scopeDashboardPath(
          `/dashboard/admin/visa/${item.studentId}`,
          dashboardBasePath,
        )}
        className="inline-flex h-8 items-center border border-[var(--border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-soft)]"
      >
        查看详情
      </Link>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger
          type="button"
          className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-soft)]"
        >
          <Pencil size={13} aria-hidden="true" />
          编辑档案
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-[min(1180px,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑 {item.studentName} 的签证档案</DialogTitle>
            <DialogDescription>
              调整办理通道、签证类型、入境日期、办理阶段和顾问意见。递签领区不会采用客户端提交值。
            </DialogDescription>
          </DialogHeader>
          <VisaCaseAdminForm
            studentId={item.studentId}
            visaType={item.visaType}
            applicationChannel={item.applicationChannel}
            targetEntryDate={item.targetEntryDate}
            caseStatus={item.caseStatus}
            advisorNote={item.advisorNote}
          />
        </DialogContent>
      </Dialog>

      <StudentModuleCardDeleteDialog
        action={deleteStudentVisaCardAction.bind(null, item.studentId)}
        studentName={item.studentName}
        cardLabel="签证档案"
        description="将永久清空签证档案、全部准备任务和审核记录。"
      />
    </div>
  );
}
