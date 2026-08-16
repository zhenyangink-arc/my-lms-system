import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
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
        <ManagementNotice tone="success">
          签证档案、准备任务和审核记录已经删除；学生账号及其他业务数据保持不变。
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="签证管理概况"
        items={[
          { label: "签证档案", value: result.cases.length },
          { label: "准备任务", value: tasks.length },
          { label: "等待审核", value: pendingReviewCount },
          { label: "补充／协助", value: supportCount },
          {
            label: "已经获签",
            value: result.cases.filter((item) => item.caseStatus === "issued")
              .length,
          },
        ]}
      />

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
