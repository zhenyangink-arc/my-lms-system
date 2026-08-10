import Link from "next/link";

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--app-muted)]">
          {VIEWER_LABELS[result.viewer.kind]}可查看并管理平台全部机构
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={scopeDashboardPath(
              "/dashboard/admin/tenants/history",
              dashboardBasePath,
            )}
            className="inline-flex h-9 items-center border border-[var(--app-border)] px-3 text-xs font-semibold hover:bg-[var(--app-soft-bg)]"
          >
            查看历史记录
          </Link>
          {result.viewer.canCreateTenant && <TenantCreateDialog />}
        </div>
      </div>
      {result.schemaUnavailable && (
        <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          租户控制面尚未启用，请先确认多租户数据库迁移状态。
        </div>
      )}
      {!result.schemaUnavailable && result.hasQueryError && (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          部分租户或负责人信息暂时无法读取，请稍后刷新重试。
        </div>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>查看范围</th>
                <th>机构总数</th>
                <th>运行中</th>
                <th>停用或归档</th>
                <th>成员关系</th>
                <th>平台副负责人</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{VIEWER_LABELS[result.viewer.kind]} · 全部机构</th>
                <td>{result.summary.totalTenants}</td>
                <td>{result.summary.activeTenants}</td>
                <td>{result.summary.inactiveTenants}</td>
                <td>{result.summary.totalMemberships}</td>
                <td>{result.deputies.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <TenantOverviewTable
        data={result.tenants}
        dashboardBasePath={dashboardBasePath}
        scopeLabel={`${VIEWER_LABELS[result.viewer.kind]} · 平台全部机构`}
      />
    </div>
  );
}
