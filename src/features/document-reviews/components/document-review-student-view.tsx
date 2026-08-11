import Link from "next/link";
import { notFound } from "next/navigation";

import { createApplicationChecklistItemAction } from "@/app/dashboard/admin/documents/actions";
import { AdminApplicationStageControl } from "@/app/dashboard/admin/documents/AdminApplicationStageControl";
import { AdminCourierInfoForm } from "@/app/dashboard/admin/documents/AdminCourierInfoForm";
import { DocumentItemControls } from "@/app/dashboard/admin/documents/DocumentItemControls";
import {
  APPLICATION_STAGE_LABELS,
  CATEGORY_LABELS,
} from "@/app/dashboard/documents/constants";
import { LocalDateTime } from "@/components/LocalDateTime";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getDocumentReviewStudentDetailData } from "../api/service";
import { DocumentReviewTargetLockAction } from "./document-review-application-actions";

const REVIEW_LABELS = {
  preparing: "准备中",
  pending_review: "待确认",
  revision_required: "需补充",
  approved: "已确认",
} as const;

const ITEM_STATUS_LABELS = {
  preparing: "准备中",
  completed: "已完成",
  not_needed: "无需准备",
} as const;

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export default async function DocumentReviewStudentView({
  studentId,
}: {
  studentId: string;
}) {
  const result = await getDocumentReviewStudentDetailData(studentId);
  if (!result) notFound();

  const name = result.student.full_name || result.student.email || "未填写姓名";
  const resolvedCount = result.documents.filter(
    (document) => document.status !== "preparing",
  ).length;
  const latestUpdatedAt = [
    ...result.targets.map((target) => target.updated_at),
    ...result.documents.map((document) => document.updated_at),
  ].sort(
    (left, right) => new Date(right).getTime() - new Date(left).getTime(),
  )[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={scopeDashboardPath(
            "/dashboard/admin/documents",
            result.dashboardBasePath,
          )}
          className="text-xs font-semibold text-[var(--app-text-soft)] hover:text-[var(--app-text)]"
        >
          返回资料审核
        </Link>
        <p className="text-xs text-[var(--app-muted)]">
          最近更新：
          <LocalDateTime
            value={latestUpdatedAt ?? null}
            options={DATE_TIME_OPTIONS}
          />
        </p>
      </div>

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                <th>学生</th>
                <th>登录账号</th>
                <th>申请单</th>
                <th>资料项目</th>
                <th>已处理</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{name}</th>
                <td>{result.student.email || `账号 …${studentId.slice(-8)}`}</td>
                <td>{result.targets.length}</td>
                <td>{result.documents.length}</td>
                <td>{resolvedCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <details className="border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--app-text)]">
          新增申请资料项目
        </summary>
        <form
          action={createApplicationChecklistItemAction.bind(null, studentId)}
          className="grid gap-3 border-t border-[var(--app-border)] bg-[var(--app-soft-bg)] p-4 md:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_180px_auto]"
        >
          <label className="text-xs font-semibold text-[var(--app-text-soft)]">
            目标大学申请单
            <select
              name="targetId"
              required
              className="mt-1.5 h-9 w-full border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2 font-normal text-[var(--app-text)]"
            >
              {result.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.university_name}
                  {target.program_name ? ` · ${target.program_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--app-text-soft)]">
            资料名称
            <input
              name="title"
              required
              maxLength={100}
              className="mt-1.5 h-9 w-full border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2 font-normal text-[var(--app-text)]"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--app-text-soft)]">
            资料分类
            <select
              name="category"
              defaultValue="other"
              className="mt-1.5 h-9 w-full border border-[var(--app-border)] bg-[var(--app-card-bg)] px-2 font-normal text-[var(--app-text)]"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={result.targets.length === 0}
            className="h-9 self-end bg-[var(--app-accent)] px-4 text-xs font-semibold text-white disabled:opacity-40"
          >
            添加
          </button>
        </form>
      </details>

      {result.targets.map((target) => {
        const documents = result.documents.filter(
          (document) => document.target_id === target.id,
        );
        const targetResolved = documents.filter(
          (document) => document.status !== "preparing",
        ).length;

        return (
          <section
            key={target.id}
            className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-4 py-3">
              <div>
                <p className="font-semibold text-[var(--app-text)]">
                  {target.university_name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--app-muted)]">
                  {target.program_name || "专业待确认"}
                </p>
              </div>
              <DocumentReviewTargetLockAction
                studentId={studentId}
                targetId={target.id}
                lockedAt={target.documents_locked_at}
              />
            </div>

            <div className="overflow-x-auto border-b border-[var(--app-border)]">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">资料进度</th>
                    <th className="px-4 py-3 font-medium">申请阶段</th>
                    <th className="px-4 py-3 font-medium">审核状态</th>
                    <th className="px-4 py-3 font-medium">学生端状态</th>
                    <th className="px-4 py-3 font-medium">邮寄日期</th>
                    <th className="px-4 py-3 font-medium">预计到达</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {targetResolved}/{documents.length}
                    </td>
                    <td className="px-4 py-3">
                      {APPLICATION_STAGE_LABELS[target.application_stage] ??
                        "阶段待确认"}
                    </td>
                    <td className="px-4 py-3">
                      {REVIEW_LABELS[target.document_review_status]}
                    </td>
                    <td className="px-4 py-3">
                      {target.documents_locked_at ? "已锁定" : "可编辑"}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {target.courier_mailed_at || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {target.courier_estimated_arrival_at || "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {target.document_review_note && (
              <p className="border-b border-[var(--app-border)] px-4 py-3 text-xs leading-5 text-[var(--app-text-soft)]">
                <span className="font-semibold text-[var(--app-text)]">
                  最近审核意见：
                </span>
                {target.document_review_note}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 font-medium">资料名称</th>
                    <th className="px-4 py-3 font-medium">准备状态</th>
                    <th className="px-4 py-3 font-medium">锁定状态</th>
                    <th className="px-4 py-3 font-medium">截止日期</th>
                    <th className="px-4 py-3 font-medium">学生说明</th>
                    <th className="px-4 py-3 font-medium">管理员备注</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-t border-[var(--app-border-soft)]"
                    >
                      <td className="px-4 py-3">
                        {CATEGORY_LABELS[document.category] ?? document.category}
                      </td>
                      <td className="px-4 py-3 font-semibold">{document.title}</td>
                      <td className="px-4 py-3">
                        {ITEM_STATUS_LABELS[document.status]}
                      </td>
                      <td className="px-4 py-3">
                        {document.admin_locked_at ? "已锁定" : "未锁定"}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {document.due_date || "—"}
                      </td>
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--app-text-soft)]">
                        {document.notes || "—"}
                      </td>
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--app-text-soft)]">
                        {document.admin_note || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <DocumentItemControls
                          studentId={studentId}
                          documentId={document.id}
                          title={document.title}
                          adminNote={document.admin_note}
                          locked={document.admin_locked_at !== null}
                        />
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-[var(--app-muted)]"
                      >
                        这份申请单还没有资料项目
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <details className="border-t border-[var(--app-border)]">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--app-text)]">
                申请阶段与快递设置
              </summary>
              <div className="border-t border-[var(--app-border)] bg-[var(--app-soft-bg)] p-4">
                <AdminCourierInfoForm
                  studentId={studentId}
                  targetId={target.id}
                  courierMailedAt={target.courier_mailed_at}
                  courierEstimatedArrivalAt={target.courier_estimated_arrival_at}
                />
                <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                  <AdminApplicationStageControl
                    studentId={studentId}
                    targetId={target.id}
                    stage={target.application_stage}
                    visaApplicationChannel={target.visa_application_channel}
                  />
                </div>
              </div>
            </details>
          </section>
        );
      })}

      {result.targets.length === 0 && (
        <div className="border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-12 text-center text-sm text-[var(--app-muted)]">
          这名学生还没有进入资料准备阶段的申请单
        </div>
      )}
    </div>
  );
}
