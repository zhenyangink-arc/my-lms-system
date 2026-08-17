"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APPLICATION_STAGE_LABELS } from "@/app/dashboard/documents/constants";
import type { DocumentReviewApplication } from "../../api/types";
import {
  DocumentReviewDecisionActions,
  DocumentReviewItemLockAction,
  DocumentReviewTargetLockAction,
} from "../document-review-application-actions";

const REVIEW_LABELS: Record<DocumentReviewApplication["reviewStatus"], string> = {
  preparing: "准备中",
  pending_review: "待确认",
  revision_required: "需补充",
  approved: "已确认",
};

const ITEM_STATUS_LABELS: Record<
  DocumentReviewApplication["documents"][number]["status"],
  string
> = {
  preparing: "准备中",
  completed: "已完成",
  not_needed: "无需准备",
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

export function DocumentReviewApplicationDialog({
  application,
}: {
  application: DocumentReviewApplication;
}) {
  const resolvedCount = application.documents.filter(
    (document) => document.status !== "preparing",
  ).length;

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center border border-[var(--border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--surface-soft)]"
      >
        查看详情
      </DialogTrigger>
      <DialogContent className="max-h-[min(900px,calc(100vh-32px))] max-w-[1000px] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--border)] px-5 py-4 text-left">
          <DialogTitle className="text-base">
            {application.studentName} · {application.universityName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {application.admissionTrackLabel}
            {application.programName ? ` · ${application.programName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-3">
          <p className="text-xs text-[var(--foreground-muted)]">
            整单锁定会限制学生端继续修改资料。
          </p>
          <DocumentReviewTargetLockAction
            studentId={application.studentId}
            targetId={application.id}
            lockedAt={application.documentsLockedAt}
          />
        </div>

        <div className="overflow-x-auto border-b border-[var(--border)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">审核状态</th>
                <th className="px-4 py-3 font-medium">申请阶段</th>
                <th className="px-4 py-3 font-medium">资料进度</th>
                <th className="px-4 py-3 font-medium">学生端状态</th>
                <th className="px-4 py-3 font-medium">审核意见</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 font-semibold">
                  {REVIEW_LABELS[application.reviewStatus]}
                </td>
                <td className="px-4 py-3">
                  {APPLICATION_STAGE_LABELS[application.applicationStage] ?? "阶段待确认"}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {resolvedCount}/{application.documents.length}
                </td>
                <td className="px-4 py-3">
                  {application.documentsLockedAt ? "已锁定" : "可编辑"}
                </td>
                <td className="max-w-72 whitespace-pre-wrap px-4 py-3 text-[var(--foreground-secondary)]">
                  {application.reviewNote || "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section>
          <div className="border-b border-[var(--border)] px-5 py-3">
            <h3 className="text-xs font-semibold">单项资料清单</h3>
            <p className="mt-1 text-[10px] text-[var(--foreground-muted)]">
              当前仅展示资料状态、锁定状态和管理员备注，不提供任何操作入口。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-xs">
              <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">资料名称</th>
                  <th className="px-4 py-3 font-medium">准备状态</th>
                  <th className="px-4 py-3 font-medium">锁定状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                  <th className="px-4 py-3 font-medium">截止日期</th>
                  <th className="px-4 py-3 font-medium">管理员备注</th>
                </tr>
              </thead>
              <tbody>
                {application.documents.map((document) => (
                  <tr key={document.id} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-3">{CATEGORY_LABELS[document.category]}</td>
                    <td className="px-4 py-3 font-semibold">{document.title}</td>
                    <td className="px-4 py-3">{ITEM_STATUS_LABELS[document.status]}</td>
                    <td className="px-4 py-3">{document.lockedAt ? "已锁定" : "未锁定"}</td>
                    <td className="px-4 py-3">
                      <DocumentReviewItemLockAction
                        studentId={application.studentId}
                        item={document}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono">{document.dueDate || "—"}</td>
                    <td className="max-w-72 whitespace-pre-wrap px-4 py-3 text-[var(--foreground-secondary)]">
                      {document.adminNote || "—"}
                    </td>
                  </tr>
                ))}
                {application.documents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--foreground-muted)]">
                      这份申请单还没有资料项目
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <DocumentReviewDecisionActions application={application} />
      </DialogContent>
    </Dialog>
  );
}
