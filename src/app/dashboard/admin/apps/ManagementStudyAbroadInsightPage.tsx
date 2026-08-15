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

    return (
      <div className="space-y-4">
        <p className="app-muted-text text-xs leading-5">
          平台空间只显示机构级匿名汇总，不读取学生姓名、材料正文或签证任务内容。
        </p>
        <div className="overflow-x-auto border bg-[var(--app-card-bg)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">机构</th><th className="px-4 py-3">申请项目</th><th className="px-4 py-3">材料待处理</th><th className="px-4 py-3">签证档案</th><th className="px-4 py-3">签证待处理</th><th className="px-4 py-3">最近活动</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.tenantId} className="border-t border-[var(--app-border-soft)]"><td className="px-4 py-3 font-medium">{row.tenantName}</td><td className="px-4 py-3 tabular-nums">{row.applications}</td><td className="px-4 py-3 tabular-nums">{row.pendingDocuments}</td><td className="px-4 py-3 tabular-nums">{row.visaCases}</td><td className="px-4 py-3 tabular-nums">{row.pendingVisaTasks}</td><td className="app-muted-text px-4 py-3">{formatDate(row.lastActivityAt)}</td></tr>)}</tbody>
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
    ["pending", "in_progress", "submitted", "reviewing", "revision_required", "blocked"].includes(item.status),
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
        <section className="grid overflow-hidden border bg-[var(--app-card-bg)] sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["申请项目", applications.length, "个"],
            ["材料确认率", reviewRate, "%"],
            ["签证档案", cases.length, "个"],
            ["获签完成率", issuedRate, "%"],
          ].map(([label, value, suffix], index) => <div key={String(label)} className={`min-h-24 px-5 py-4 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""}`}><p className="app-muted-text text-xs">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}<span className="app-muted-text ml-1 text-xs font-normal">{suffix}</span></p></div>)}
        </section>
        <section className="grid gap-3 lg:grid-cols-3">
          <div className="app-card border p-5"><p className="app-muted-text text-xs">材料需要处理</p><p className="mt-2 text-2xl font-semibold tabular-nums">{pendingDocuments}</p><p className="app-muted-text mt-2 text-xs">待确认与需补充申请</p></div>
          <div className="app-card border p-5"><p className="app-muted-text text-xs">签证任务待处理</p><p className="mt-2 text-2xl font-semibold tabular-nums">{pendingTasks.length}</p><p className="app-muted-text mt-2 text-xs">准备、审核、补充与阻塞任务</p></div>
          <div className="app-card border p-5"><p className="app-muted-text text-xs">已经获签</p><p className="mt-2 text-2xl font-semibold tabular-nums">{issuedCases}</p><p className="app-muted-text mt-2 text-xs">当前机构已完成签证档案</p></div>
        </section>
      </div>
    );
  }

  const activityRows = [
    ...applications.map((item) => ({
      key: `application:${item.id}`,
      studentName: item.studentName,
      title: `${item.universityName} · 申请材料`,
      status: item.reviewStatus,
      occurredAt: item.updatedAt,
    })),
    ...cases.map((item) => ({
      key: `visa:${item.id}`,
      studentName: item.studentName,
      title: `${item.universityName} · 签证档案`,
      status: item.caseStatus,
      occurredAt: item.updatedAt,
    })),
    ...tasks.map((item) => ({
      key: `task:${item.id}`,
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
      <section className="management-table-panel overflow-hidden border"><div className="overflow-x-auto"><table className="management-summary-table w-full min-w-[680px] border-collapse text-left"><thead><tr><th>申请项目</th><th>材料待处理</th><th>签证档案</th><th>签证任务</th><th>需要跟进</th></tr></thead><tbody><tr><td>{applications.length}</td><td>{pendingDocuments}</td><td>{cases.length}</td><td>{tasks.length}</td><td>{pendingTasks.length}</td></tr></tbody></table></div></section>
      <div className="overflow-x-auto border bg-[var(--app-card-bg)]"><table className="w-full min-w-[760px] border-collapse text-left text-xs"><thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]"><tr><th className="px-4 py-3">学生</th><th className="px-4 py-3">服务事项</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">更新时间</th></tr></thead><tbody>{activityRows.map((row) => <tr key={row.key} className="border-t border-[var(--app-border-soft)]"><td className="px-4 py-3 font-medium">{row.studentName}</td><td className="px-4 py-3">{row.title}</td><td className="app-muted-text px-4 py-3">{row.status}</td><td className="app-muted-text px-4 py-3">{formatDate(row.occurredAt)}</td></tr>)}{activityRows.length === 0 && <tr><td colSpan={4} className="app-muted-text px-4 py-10 text-center">还没有留学服务活动记录。</td></tr>}</tbody></table></div>
    </div>
  );
}
