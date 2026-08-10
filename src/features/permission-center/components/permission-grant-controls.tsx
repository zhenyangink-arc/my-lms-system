"use client";

import { useMemo, useState } from "react";

import { updateUnifiedPermissionGrantAction } from "@/app/dashboard/admin/permissions/actions";
import type { AssignablePermissionKey } from "@/lib/permissions/catalog";
import type {
  PermissionCenterIdentity,
  PermissionCenterTenant,
  TenantPermissionGrantCandidate,
} from "../api/types";

function accountName(account: PermissionCenterIdentity) {
  return (
    account.fullName?.trim() ||
    account.loginId?.trim() ||
    account.email?.trim() ||
    `账号 …${account.id.slice(-8)}`
  );
}

export function PermissionGrantControls({
  tenants,
  platformCandidates,
  tenantCandidates,
  permissionKeys,
  permissionLabels,
}: {
  tenants: PermissionCenterTenant[];
  platformCandidates: PermissionCenterIdentity[];
  tenantCandidates: TenantPermissionGrantCandidate[];
  permissionKeys: AssignablePermissionKey[];
  permissionLabels: Record<AssignablePermissionKey, string>;
}) {
  const tenantKeys = permissionKeys.filter(
    (key) => key !== "standard_question_bank.manage",
  );
  const availableTenantIds = useMemo(
    () => new Set(tenantCandidates.map((candidate) => candidate.tenantId)),
    [tenantCandidates],
  );
  const initialTenantId =
    tenants.find(
      (tenant) =>
        tenant.status === "active" && availableTenantIds.has(tenant.id),
    )?.id ??
    tenants.find((tenant) => availableTenantIds.has(tenant.id))?.id ??
    "";
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [targetUserId, setTargetUserId] = useState("");
  const selectedTenantCandidates = tenantCandidates.filter(
    (candidate) => candidate.tenantId === tenantId,
  );

  return (
    <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
      <div className="border-b border-[var(--app-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--app-text)]">
          单条账号授权
        </h3>
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          这里只提供现有的单条授权入口；账号资格和权限范围仍由数据库再次校验。
        </p>
      </div>
      <div className="grid divide-y divide-[var(--app-border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <form
          action={updateUnifiedPermissionGrantAction}
          className="space-y-3 p-4"
        >
          <input type="hidden" name="permissionKey" value="standard_question_bank.manage" />
          <input type="hidden" name="tenantId" value="" />
          <input type="hidden" name="enabled" value="true" />
          <input type="hidden" name="view" value="grants" />
          <div>
            <p className="text-xs font-semibold text-[var(--app-text)]">
              平台标准题库管理
            </p>
            <p className="mt-1 text-[11px] text-[var(--app-muted)]">
              仅可授予正常的平台副负责人或平台管理员。
            </p>
          </div>
          <label className="block space-y-1.5 text-xs">
            <span className="font-medium">被授权账号</span>
            <select
              name="targetUserId"
              required
              defaultValue=""
              className="app-input h-9 w-full border px-2.5 text-xs"
            >
              <option value="" disabled>选择平台账号</option>
              {platformCandidates.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountName(account)} · {account.loginId || "历史账号"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={platformCandidates.length === 0}
            className="h-9 bg-[var(--app-accent)] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            授予平台题库权限
          </button>
        </form>

        <form
          action={updateUnifiedPermissionGrantAction}
          className="space-y-3 p-4"
        >
          <input type="hidden" name="enabled" value="true" />
          <input type="hidden" name="view" value="grants" />
          <div>
            <p className="text-xs font-semibold text-[var(--app-text)]">
              机构模块管理权限
            </p>
            <p className="mt-1 text-[11px] text-[var(--app-muted)]">
              仅可授予对应机构内状态正常的普通管理员。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1.5 text-xs">
              <span className="font-medium">机构</span>
              <select
                name="tenantId"
                required
                value={tenantId}
                onChange={(event) => {
                  setTenantId(event.target.value);
                  setTargetUserId("");
                }}
                className="app-input h-9 w-full border px-2.5 text-xs"
              >
                <option value="" disabled>选择机构</option>
                {tenants
                  .filter((tenant) => availableTenantIds.has(tenant.id))
                  .map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="font-medium">普通管理员</span>
              <select
                name="targetUserId"
                required
                value={targetUserId}
                onChange={(event) => setTargetUserId(event.target.value)}
                className="app-input h-9 w-full border px-2.5 text-xs"
              >
                <option value="" disabled>选择管理员</option>
                {selectedTenantCandidates.map(({ account }) => (
                  <option key={account.id} value={account.id}>
                    {accountName(account)} · {account.loginId || "历史账号"}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs">
              <span className="font-medium">权限</span>
              <select
                name="permissionKey"
                required
                defaultValue={tenantKeys[0]}
                className="app-input h-9 w-full border px-2.5 text-xs"
              >
                {tenantKeys.map((permissionKey) => (
                  <option key={permissionKey} value={permissionKey}>
                    {permissionLabels[permissionKey]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!tenantId || !targetUserId || tenantKeys.length === 0}
            className="h-9 bg-[var(--app-accent)] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            授予机构模块权限
          </button>
        </form>
      </div>
    </section>
  );
}
