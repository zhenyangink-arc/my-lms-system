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
    <div className="space-y-4">
      {updated && (
        <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          权限已更新，页面展示的是数据库重新计算后的结果。
        </div>
      )}
      {error && (
        <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}
      <PermissionDirectory directory={result.directory} />
      <RolePermissionMatrix directory={result.directory} />
      <PermissionGrantControls
        tenants={result.tenants}
        platformCandidates={result.platformGrantCandidates}
        tenantCandidates={result.tenantGrantCandidates}
        permissionKeys={result.directory.assignablePermissionKeys}
        permissionLabels={result.directory.assignablePermissionLabels}
      />

      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text)]">
            当前生效授权
          </h3>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            平台范围和机构范围分开记录；撤销记录不会出现在本表。
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--app-text)]">
            平台范围授权
          </p>
          <ActivePermissionGrantsTable
            data={platformGrants}
            tenants={result.tenants}
            permissionLabels={result.directory.assignablePermissionLabels}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--app-text)]">
            机构范围授权
          </p>
          <ActivePermissionGrantsTable
            data={tenantGrants}
            tenants={result.tenants}
            permissionLabels={result.directory.assignablePermissionLabels}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--app-text)]">
            权限操作记录
          </h3>
          <p className="mt-1 text-xs text-[var(--app-muted)]">
            仅展示成功写入的授权和撤销记录，最多读取最近 200 条。
          </p>
        </div>
        <PermissionAuditTable
          data={result.auditLogs}
          tenants={result.tenants}
          permissionLabels={result.directory.assignablePermissionLabels}
        />
      </section>
    </div>
  );
}
