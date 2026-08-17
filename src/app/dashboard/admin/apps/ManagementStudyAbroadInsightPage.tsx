import { CircleDot } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import { getDocumentReviewManagementData } from "@/features/document-reviews/api/service";
import { getVisaManagementData } from "@/features/visa-management/api/service";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type ServiceStatusKind = "document" | "visa" | "task";

const SERVICE_STATUS_LABELS: Record<
  ServiceStatusKind,
  Record<string, string>
> = {
  document: {
    preparing: "准备中",
    pending_review: "待确认",
    revision_required: "需要补充",
    approved: "已确认",
  },
  visa: {
    admin_preparing: "机构准备中",
    planning: "材料运输中",
    preparing: "学生确认材料",
    ready_to_submit: "准备递签",
    submitted: "已经递签",
    additional_documents: "等待补件",
    approved: "签证批准",
    issued: "已经获签",
    closed: "已经关闭",
  },
  task: {
    pending: "未开始",
    in_progress: "准备中",
    submitted: "待审核",
    reviewing: "审核中",
    approved: "已确认",
    revision_required: "需要补充",
    blocked: "需要协助",
  },
};

function ServiceStatus({
  kind,
  status,
}: {
  kind: ServiceStatusKind;
  status: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <CircleDot className="size-3.5 shrink-0" aria-hidden="true" />
      {SERVICE_STATUS_LABELS[kind][status] ?? status}
    </span>
  );
}

export async function ManagementStudyAbroadInsightPage({
  mode,
}: {
  mode: "records" | "analytics";
}) {
  const [documents, visas] = await Promise.all([
    getDocumentReviewManagementData(),
    getVisaManagementData(),
  ]);

  if (documents.scope === "platform" || visas.scope === "platform") {
    const documentOverview =
      documents.scope === "platform" ? documents.overview : [];
    const visaOverview = visas.scope === "platform" ? visas.overview : [];
    const visaByTenant = new Map(
      visaOverview.map((item) => [item.tenantId, item]),
    );
    const tenantIds = new Set([
      ...documentOverview.map((item) => item.tenantId),
      ...visaOverview.map((item) => item.tenantId),
    ]);
    const rows = [...tenantIds].map((tenantId) => {
      const document = documentOverview.find(
        (item) => item.tenantId === tenantId,
      );
      const visa = visaByTenant.get(tenantId);
      return {
        tenantId,
        tenantName: document?.tenantName ?? visa?.tenantName ?? "机构",
        applications: document?.applicationCount ?? 0,
        pendingDocuments:
          (document?.pendingReviewCount ?? 0) +
          (document?.revisionRequiredCount ?? 0),
        visaCases: visa?.caseCount ?? 0,
        pendingVisaTasks:
          (visa?.pendingTaskCount ?? 0) + (visa?.supportTaskCount ?? 0),
        lastActivityAt:
          [document?.lastActivityAt, visa?.lastActivityAt]
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
      };
    });
    const hasError =
      (documents.scope === "platform" && documents.hasError) ||
      (visas.scope === "platform" && visas.hasError);

    return (
      <div className="space-y-4">
        {hasError && (
          <ManagementNotice tone="warning">
            留学服务机构汇总暂时无法完整读取。当前结果可能不完整，
            请稍后刷新重试。
          </ManagementNotice>
        )}
        <p className="app-muted-text text-xs leading-5">
          平台空间只显示机构级匿名汇总，不读取学生姓名、材料正文或签证任务内容。
        </p>
        <div className="overflow-x-auto border bg-[var(--card)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <caption className="sr-only">各机构留学服务待处理与活动汇总</caption>
            <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3">
                  机构
                </th>
                <th scope="col" className="px-4 py-3">
                  申请项目
                </th>
                <th scope="col" className="px-4 py-3">
                  材料待处理
                </th>
                <th scope="col" className="px-4 py-3">
                  签证档案
                </th>
                <th scope="col" className="px-4 py-3">
                  签证待处理
                </th>
                <th scope="col" className="px-4 py-3">
                  最近活动
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.tenantId}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <th scope="row" className="px-4 py-3 font-medium">
                    {row.tenantName}
                  </th>
                  <td className="px-4 py-3 tabular-nums">{row.applications}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.pendingDocuments}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.visaCases}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.pendingVisaTasks}
                  </td>
                  <td className="app-muted-text px-4 py-3">
                    {formatDate(row.lastActivityAt)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !hasError && (
                <tr>
                  <td
                    colSpan={6}
                    className="app-muted-text px-4 py-10 text-center"
                  >
                    当前没有可巡检的留学服务机构。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const applications = documents.applications;
  const cases = visas.cases;
  const tasks = cases.flatMap((item) =>
    item.tasks.map((task) => ({
      ...task,
      studentName: item.studentName,
      universityName: item.universityName,
    })),
  );
  const pendingDocuments = applications.filter((item) =>
    ["pending_review", "revision_required"].includes(item.reviewStatus),
  ).length;
  const approvedDocuments = applications.filter(
    (item) => item.reviewStatus === "approved",
  ).length;
  const pendingTasks = tasks.filter((item) =>
    [
      "pending",
      "in_progress",
      "submitted",
      "reviewing",
      "revision_required",
      "blocked",
    ].includes(item.status),
  );
  const issuedCases = cases.filter((item) => item.caseStatus === "issued").length;

  if (mode === "analytics") {
    const reviewRate = applications.length
      ? Math.round((approvedDocuments / applications.length) * 100)
      : 0;
    const issuedRate = cases.length
      ? Math.round((issuedCases / cases.length) * 100)
      : 0;
    return (
      <div className="space-y-5">
        <ManagementMetricStrip
          label="留学服务分析概况"
          items={[
            { label: "申请项目", value: applications.length },
            { label: "材料确认率", value: `${reviewRate}%` },
            { label: "签证档案", value: cases.length },
            { label: "获签完成率", value: `${issuedRate}%` },
          ]}
        />
        <p className="app-muted-text text-xs leading-5">
          当前共 {applications.length} 个申请项目，材料确认率为 {reviewRate}%；
          共 {cases.length} 份签证档案，获签完成率为 {issuedRate}%。
        </p>
        <section aria-labelledby="service-attention-heading">
          <h2 id="service-attention-heading" className="sr-only">
            留学服务待办摘要
          </h2>
          <dl className="grid gap-3 lg:grid-cols-3">
            <div className="app-card border p-5">
              <dt className="app-muted-text text-xs">材料需要处理</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {pendingDocuments}
              </dd>
              <p className="app-muted-text mt-2 text-xs">待确认与需补充申请</p>
            </div>
            <div className="app-card border p-5">
              <dt className="app-muted-text text-xs">签证任务待处理</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {pendingTasks.length}
              </dd>
              <p className="app-muted-text mt-2 text-xs">
                准备、审核、补充与阻塞任务
              </p>
            </div>
            <div className="app-card border p-5">
              <dt className="app-muted-text text-xs">已经获签</dt>
              <dd className="mt-2 text-2xl font-semibold tabular-nums">
                {issuedCases}
              </dd>
              <p className="app-muted-text mt-2 text-xs">
                当前机构已完成签证档案
              </p>
            </div>
          </dl>
        </section>
      </div>
    );
  }

  const activityRows = [
    ...applications.map((item) => ({
      key: `application:${item.id}`,
      kind: "document" as const,
      studentName: item.studentName,
      title: `${item.universityName} · 申请材料`,
      status: item.reviewStatus,
      occurredAt: item.updatedAt,
    })),
    ...cases.map((item) => ({
      key: `visa:${item.id}`,
      kind: "visa" as const,
      studentName: item.studentName,
      title: `${item.universityName} · 签证档案`,
      status: item.caseStatus,
      occurredAt: item.updatedAt,
    })),
    ...tasks.map((item) => ({
      key: `task:${item.id}`,
      kind: "task" as const,
      studentName: item.studentName,
      title: `${item.universityName} · ${item.title}`,
      status: item.status,
      occurredAt: item.updatedAt,
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 100);

  return (
    <div className="space-y-4">
      <ManagementMetricStrip
        label="留学服务记录概况"
        items={[
          { label: "申请项目", value: applications.length },
          { label: "材料待处理", value: pendingDocuments },
          { label: "签证档案", value: cases.length },
          { label: "签证任务", value: tasks.length },
          { label: "需要跟进", value: pendingTasks.length },
        ]}
      />
      <div className="overflow-x-auto border bg-[var(--card)]">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <caption className="sr-only">最近留学服务活动记录</caption>
          <thead className="bg-[var(--surface-soft)] text-[var(--foreground-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3">
                学生
              </th>
              <th scope="col" className="px-4 py-3">
                服务事项
              </th>
              <th scope="col" className="px-4 py-3">
                状态
              </th>
              <th scope="col" className="px-4 py-3">
                更新时间
              </th>
            </tr>
          </thead>
          <tbody>
            {activityRows.map((row) => (
              <tr
                key={row.key}
                className="border-t border-[var(--border-subtle)]"
              >
                <th scope="row" className="px-4 py-3 font-medium">
                  {row.studentName}
                </th>
                <td className="px-4 py-3">{row.title}</td>
                <td className="app-muted-text px-4 py-3">
                  <ServiceStatus kind={row.kind} status={row.status} />
                </td>
                <td className="app-muted-text px-4 py-3">
                  {formatDate(row.occurredAt)}
                </td>
              </tr>
            ))}
            {activityRows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="app-muted-text px-4 py-10 text-center"
                >
                  还没有留学服务活动记录。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
