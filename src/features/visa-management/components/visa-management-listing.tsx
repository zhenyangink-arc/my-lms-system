import { getVisaManagementData } from "../api/service";
import { PlatformVisaOverview } from "./platform-visa-overview";
import { VisaCasesTable } from "./visa-cases-table";
import { VisaTasksTable } from "./visa-tasks-table";

const ROLE_SCOPE_LABELS: Record<string, string> = {
  tenant_super_admin: "当前机构全部学生",
  ceo: "当前机构全部学生",
  admin: "当前机构全部学生",
};

export default async function VisaManagementListing() {
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

      <VisaCasesTable data={result.cases} scopeLabel={scopeLabel} />
      <VisaTasksTable cases={result.cases} scopeLabel={scopeLabel} />
    </div>
  );
}
