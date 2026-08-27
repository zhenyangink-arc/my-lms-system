import Link from "next/link";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";
import { getTenantManagementData } from "../api/service";
import { TenantCreateDialog } from "./tenant-create-dialog";
import { TenantOverviewTable } from "./tenant-overview-table";

const VIEWER_LABELS = {
  owner: "平台负责人",
  deputy: "平台副负责人",
} as const;

export default async function TenantManagementListing() {
  const result = await getTenantManagementData();
  const dashboardBasePath = getDashboardBasePath();
  const viewerLabel = VIEWER_LABELS[result.viewer.kind];

  return (
    <ManagementPage
      title="机构管理"
      description={`${viewerLabel}可查看平台全部机构、负责人和成员关系，并按权限执行机构生命周期操作。`}
      action={
        <>
          <Link
            href={scopeDashboardPath(
              "/dashboard/admin/tenants/history",
              dashboardBasePath,
            )}
            className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold"
          >
            查看历史记录
          </Link>
          {result.viewer.canCreateTenant && <TenantCreateDialog />}
        </>
      }
    >
      {result.schemaUnavailable && (
        <ManagementNotice tone="warning">
          租户控制面尚未启用，请先确认多租户数据库迁移状态。
        </ManagementNotice>
      )}
      {!result.schemaUnavailable && result.hasQueryError && (
        <ManagementNotice tone="danger">
          部分租户或负责人信息暂时无法读取，请稍后刷新重试。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="机构运营概况"
        items={[
          { label: "机构总数", value: result.summary.totalTenants },
          { label: "运行中", value: result.summary.activeTenants },
          { label: "停用或归档", value: result.summary.inactiveTenants },
          { label: "成员关系", value: result.summary.totalMemberships },
          { label: "平台副负责人", value: result.deputies.length },
        ]}
      />

      <TenantOverviewTable
        data={result.tenants}
        dashboardBasePath={dashboardBasePath}
        scopeLabel={`${viewerLabel} · 平台全部机构`}
      />
    </ManagementPage>
  );
}
