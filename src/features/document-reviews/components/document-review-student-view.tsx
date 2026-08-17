import Link from "next/link";
import { notFound } from "next/navigation";
import { Files } from "lucide-react";

import { createApplicationChecklistItemAction } from "@/app/dashboard/admin/documents/actions";
import { AdminApplicationStageControl } from "@/app/dashboard/admin/documents/AdminApplicationStageControl";
import { AdminCourierInfoForm } from "@/app/dashboard/admin/documents/AdminCourierInfoForm";
import { DocumentItemControls } from "@/app/dashboard/admin/documents/DocumentItemControls";
import {
  APPLICATION_STAGE_LABELS,
  CATEGORY_LABELS,
} from "@/app/dashboard/documents/constants";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  ManagementMetricStrip,
  ManagementPage,
} from "@/components/layout/management-page";
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
    <ManagementPage
      eyebrow="资料审核"
      title={name}
      description="查看学生的申请单、资料准备进度与审核状态，并在当前管理范围内进行处理。"
      icon={Files}
      meta={
        <>
          <span>{result.student.email || `账号 …${studentId.slice(-8)}`}</span>
          <span>
            最近更新：
            <LocalDateTime
              value={latestUpdatedAt ?? null}
              options={DATE_TIME_OPTIONS}
            />
          </span>
        </>
      }
      action={
        <Link
          href={scopeDashboardPath(
            "/dashboard/admin/documents",
            result.dashboardBasePath,
          )}
          className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          返回资料审核
        </Link>
      }
    >
      <ManagementMetricStrip
        label="资料审核概况"
        items={[
          {
            label: "登录账号",
            value: result.student.email || `账号 …${studentId.slice(-8)}`,
          },
          { label: "申请单", value: result.targets.length },
          { label: "资料项目", value: result.documents.length },
          { label: "已处理", value: resolvedCount },
        ]}
      />

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
            className="overflow-hidden border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="font-semibold text-[var(--foreground)]">
                  {target.university_name}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                  {target.program_name || "专业待确认"}
                </p>
              </div>
              <DocumentReviewTargetLockAction
                studentId={studentId}
                targetId={target.id}
                lockedAt={target.documents_locked_at}
              />
            </div>

            <div className="overflow-x-auto border-b border-[var(--border)]">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
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
              <p className="border-b border-[var(--border)] px-4 py-3 text-xs leading-5 text-[var(--foreground-secondary)]">
                <span className="font-semibold text-[var(--foreground)]">
                  最近审核意见：
                </span>
                {target.document_review_note}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
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
                      className="border-t border-[var(--border-subtle)]"
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
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--foreground-secondary)]">
                        {document.notes || "—"}
                      </td>
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--foreground-secondary)]">
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
                        className="px-4 py-10 text-center text-[var(--foreground-muted)]"
                      >
                        这份申请单还没有资料项目
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <details className="border-t border-[var(--border)]">
              <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ring)]">
                申请阶段与快递设置
              </summary>
              <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <AdminCourierInfoForm
                  studentId={studentId}
                  targetId={target.id}
                  courierMailedAt={target.courier_mailed_at}
                  courierEstimatedArrivalAt={target.courier_estimated_arrival_at}
                />
                <div className="mt-4 border-t border-[var(--border)] pt-4">
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
        <section
          aria-labelledby="document-empty-title"
          className="border border-[var(--border)] bg-[var(--card)] px-5 py-12 text-center"
        >
          <h2 id="document-empty-title" className="text-sm font-semibold">
            暂无可审核的申请单
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            这名学生还没有进入资料准备阶段的申请单。
          </p>
        </section>
      )}

      <details className="border border-[var(--border)] bg-[var(--card)]">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--ring)]">
          新增申请资料项目
        </summary>
        <form
          action={createApplicationChecklistItemAction.bind(null, studentId)}
          className="grid gap-3 border-t border-[var(--border)] bg-[var(--surface-soft)] p-4 md:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_180px_auto]"
        >
          <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
            目标大学申请单
            <select
              name="targetId"
              required
              className="mt-1.5 h-9 w-full border border-[var(--border)] bg-[var(--card)] px-2 font-normal text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              {result.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.university_name}
                  {target.program_name ? ` · ${target.program_name}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
            资料名称
            <input
              name="title"
              required
              maxLength={100}
              className="mt-1.5 h-9 w-full border border-[var(--border)] bg-[var(--card)] px-2 font-normal text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            />
          </label>
          <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
            资料分类
            <select
              name="category"
              defaultValue="other"
              className="mt-1.5 h-9 w-full border border-[var(--border)] bg-[var(--card)] px-2 font-normal text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
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
            className="h-9 self-end bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-40"
          >
            添加
          </button>
        </form>
      </details>
    </ManagementPage>
  );
}
