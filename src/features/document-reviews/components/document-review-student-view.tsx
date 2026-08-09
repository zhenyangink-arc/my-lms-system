import { notFound } from "next/navigation";

import { APPLICATION_STAGE_LABELS } from "@/app/dashboard/documents/constants";
import { getDocumentReviewStudentDetailData } from "../api/service";

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

const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
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

  return (
    <div className="space-y-4">
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

      {result.targets.map((target) => {
        const documents = result.documents.filter(
          (document) => document.target_id === target.id,
        );
        const targetResolved = documents.filter(
          (document) => document.status !== "preparing",
        ).length;

        return (
          <section key={target.id} className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
            <div className="overflow-x-auto border-b border-[var(--app-border)]">
              <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">目标大学与项目</th>
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
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--app-text)]">{target.university_name}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">
                        {target.program_name || "专业待确认"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{targetResolved}/{documents.length}</td>
                    <td className="px-4 py-3">{APPLICATION_STAGE_LABELS[target.application_stage] ?? "阶段待确认"}</td>
                    <td className="px-4 py-3">{REVIEW_LABELS[target.document_review_status]}</td>
                    <td className="px-4 py-3">{target.documents_locked_at ? "已锁定" : "可编辑"}</td>
                    <td className="px-4 py-3 font-mono">{target.courier_mailed_at || "—"}</td>
                    <td className="px-4 py-3 font-mono">{target.courier_estimated_arrival_at || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {target.document_review_note && (
              <p className="border-b border-[var(--app-border)] px-4 py-3 text-xs leading-5 text-[var(--app-text-soft)]">
                <span className="font-semibold text-[var(--app-text)]">最近审核意见：</span>
                {target.document_review_note}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-left text-xs">
                <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">分类</th>
                    <th className="px-4 py-3 font-medium">资料名称</th>
                    <th className="px-4 py-3 font-medium">准备状态</th>
                    <th className="px-4 py-3 font-medium">单项锁定</th>
                    <th className="px-4 py-3 font-medium">截止日期</th>
                    <th className="px-4 py-3 font-medium">学生说明</th>
                    <th className="px-4 py-3 font-medium">管理员备注</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-t border-[var(--app-border-soft)]">
                      <td className="px-4 py-3">{CATEGORY_LABELS[document.category]}</td>
                      <td className="px-4 py-3 font-semibold">{document.title}</td>
                      <td className="px-4 py-3">{ITEM_STATUS_LABELS[document.status]}</td>
                      <td className="px-4 py-3">{document.admin_locked_at ? "已锁定" : "未锁定"}</td>
                      <td className="px-4 py-3 font-mono">{document.due_date || "—"}</td>
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--app-text-soft)]">{document.notes || "—"}</td>
                      <td className="max-w-64 whitespace-pre-wrap px-4 py-3 text-[var(--app-text-soft)]">{document.admin_note || "—"}</td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[var(--app-muted)]">
                        这份申请单还没有资料项目
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
