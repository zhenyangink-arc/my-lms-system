import { getPermissionCenterData } from "../api/service";
import { ActivePermissionGrantsTable } from "./active-permission-grants-table";
import {
  PermissionDirectory,
  RolePermissionMatrix,
} from "./permission-directory";
import { PermissionAuditTable } from "./permission-audit-table";

export default async function PermissionCenterListing() {
  const result = await getPermissionCenterData();
  const platformGrants = result.activeGrants.filter(
    (grant) => grant.scopeType === "platform",
  );
  const tenantGrants = result.activeGrants.filter(
    (grant) => grant.scopeType === "tenant",
  );

  return (
    <div className="space-y-4">
      <PermissionDirectory directory={result.directory} />
      <RolePermissionMatrix directory={result.directory} />

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
