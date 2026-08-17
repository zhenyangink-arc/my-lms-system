import { ShieldCheck } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getPermissionCenterData } from "../api/service";
import { ActivePermissionGrantsTable } from "./active-permission-grants-table";
import {
  PermissionDirectory,
  RolePermissionMatrix,
} from "./permission-directory";
import { PermissionAuditTable } from "./permission-audit-table";
import { PermissionGrantControls } from "./permission-grant-controls";

export default async function PermissionCenterListing({
  updated = false,
  error = null,
}: {
  updated?: boolean;
  error?: string | null;
}) {
  const result = await getPermissionCenterData();
  const platformGrants = result.activeGrants.filter(
    (grant) => grant.scopeType === "platform",
  );
  const tenantGrants = result.activeGrants.filter(
    (grant) => grant.scopeType === "tenant",
  );

  return (
    <ManagementPage
      eyebrow="安全与治理"
      title="权限中心"
      description="查看角色固定能力和正式权限键，管理账号例外授权，并审计平台与机构范围的每次变更。"
      icon={ShieldCheck}
      meta={
        <>
          <span>平台与机构分域</span>
          <span>数据库二次校验</span>
        </>
      }
    >
      {updated && (
        <ManagementNotice tone="success">
          权限已更新，页面展示的是数据库重新计算后的结果。
        </ManagementNotice>
      )}
      {error && (
        <ManagementNotice tone="danger">
          {error}
        </ManagementNotice>
      )}
      <ManagementMetricStrip
        label="权限中心概况"
        items={[
          {
            label: "正式权限键",
            value: result.directory.assignablePermissionKeys.length,
          },
          { label: "平台生效授权", value: platformGrants.length },
          { label: "机构生效授权", value: tenantGrants.length },
          { label: "最近审计记录", value: result.auditLogs.length },
        ]}
      />
      <PermissionDirectory directory={result.directory} />
      <RolePermissionMatrix directory={result.directory} />
      <PermissionGrantControls
        tenants={result.tenants}
        platformCandidates={result.platformGrantCandidates}
        tenantCandidates={result.tenantGrantCandidates}
        permissionKeys={result.directory.assignablePermissionKeys}
        permissionLabels={result.directory.assignablePermissionLabels}
      />

      <section className="management-content-section space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            当前生效授权
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            平台范围和机构范围分开记录；撤销记录不会出现在本表。
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">
            平台范围授权
          </p>
          <ActivePermissionGrantsTable
            data={platformGrants}
            tenants={result.tenants}
            permissionLabels={result.directory.assignablePermissionLabels}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">
            机构范围授权
          </p>
          <ActivePermissionGrantsTable
            data={tenantGrants}
            tenants={result.tenants}
            permissionLabels={result.directory.assignablePermissionLabels}
          />
        </div>
      </section>

      <section className="management-content-section space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            权限操作记录
          </h2>
          <p className="mt-1 text-xs text-[var(--foreground-muted)]">
            仅展示成功写入的授权和撤销记录，最多读取最近 200 条。
          </p>
        </div>
        <PermissionAuditTable
          data={result.auditLogs}
          tenants={result.tenants}
          permissionLabels={result.directory.assignablePermissionLabels}
        />
      </section>
    </ManagementPage>
  );
}
