import { getVisaManagementData } from "../api/service";
import { PlatformVisaOverview } from "./platform-visa-overview";
import { VisaCasesTable } from "./visa-cases-table";
import { VisaTasksTable } from "./visa-tasks-table";

const ROLE_SCOPE_LABELS: Record<string, string> = {
  tenant_super_admin: "当前机构全部学生",
  ceo: "当前机构全部学生",
  admin: "当前机构全部学生",
};

type VisaManagementListingProps = {
  initialQuery?: string;
  initialStatus?: "all" | "action" | "preparing" | "submitted" | "issued";
  deleted?: boolean;
};

export default async function VisaManagementListing({
  initialQuery = "",
  initialStatus = "all",
  deleted = false,
}: VisaManagementListingProps = {}) {
  const result = await getVisaManagementData();

  if (result.scope === "platform") {
    return (
      <PlatformVisaOverview
        rows={result.overview}
        hasError={result.hasError}
      />
    );
  }

  const scopeLabel = ROLE_SCOPE_LABELS[result.role] ?? "当前机构全部学生";
  const tasks = result.cases.flatMap((item) => item.tasks);
  const pendingReviewCount = tasks.filter((task) =>
    ["submitted", "reviewing"].includes(task.status),
  ).length;
  const supportCount = tasks.filter((task) =>
    ["revision_required", "blocked"].includes(task.status),
  ).length;

  return (
    <div className="space-y-4">
      {deleted && (
        <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          签证档案、准备任务和审核记录已经删除；学生账号及其他业务数据保持不变。
        </div>
      )}
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                <th>统计范围</th>
                <th>签证档案</th>
                <th>准备任务</th>
                <th>等待审核</th>
                <th>补充／协助</th>
                <th>已经获签</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{scopeLabel}</th>
                <td>{result.cases.length}</td>
                <td>{tasks.length}</td>
                <td>{pendingReviewCount}</td>
                <td>{supportCount}</td>
                <td>
                  {
                    result.cases.filter(
                      (item) => item.caseStatus === "issued",
                    ).length
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <VisaCasesTable
        data={result.cases}
        scopeLabel={scopeLabel}
        dashboardBasePath={result.dashboardBasePath}
        initialQuery={initialQuery}
        initialStatus={initialStatus}
      />
      <VisaTasksTable cases={result.cases} scopeLabel={scopeLabel} />
    </div>
  );
}
